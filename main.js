const { app, BrowserWindow, ipcMain, protocol, net, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { pathToFileURL } = require('url');
const { Store } = require('./src/db');
const ai = require('./src/ai');

protocol.registerSchemesAsPrivileged([
  { scheme: 'img', privileges: { standard: true, secure: true, supportFetchAPI: true } }
]);

if (!app.requestSingleInstanceLock()) app.quit();

// O "í" de Vítor no nome do programa entra no User-Agent e quebra cabeçalhos HTTP; mantém só ASCII.
app.userAgentFallback = app.userAgentFallback.normalize('NFD').replace(/[^\x20-\x7E]/g, '');

const store = new Store();
let win;
const busyPages = new Set();

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#F4F5FA',
    title: 'Editora do Vítor',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      offscreen: Boolean(process.env.EDITORA_SHOT)
    }
  });
  win.webContents.session.setSpellCheckerLanguages(['pt-BR']);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  if (process.env.EDITORA_SHOT) testSnapshot();
}

// Modo de teste (só para desenvolvimento): executa um roteiro na tela, tira uma foto e fecha.
function testSnapshot() {
  win.webContents.once('did-finish-load', async () => {
    const wait = ms => new Promise(r => setTimeout(r, ms));
    await wait(1200);
    if (process.env.EDITORA_SHOT_JS) {
      await win.webContents.executeJavaScript(`(async () => { ${process.env.EDITORA_SHOT_JS} })()`).catch(e => console.error('roteiro:', e));
      await wait(parseInt(process.env.EDITORA_SHOT_WAIT || '1200', 10));
    }
    const img = await win.webContents.capturePage();
    fs.writeFileSync(process.env.EDITORA_SHOT, img.toPNG());
    app.quit();
  });
}

app.on('second-instance', () => {
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.whenReady().then(async () => {
  await store.init(process.env.EDITORA_DATA || path.join(app.getPath('userData'), 'dados'));
  protocol.handle('img', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname.replace(/^\/+/, ''));
    const full = store.imagePath(rel);
    if (!full || !fs.existsSync(full)) return new Response('', { status: 404 });
    return net.fetch(pathToFileURL(full).toString());
  });
  registerIpc();
  createWindow();
});

app.on('window-all-closed', () => app.quit());

// ---------- configurações ----------
function settingsRaw() { return store.getSettings(); }
function publicSettings() {
  const s = settingsRaw();
  return {
    cf_account_id: s.cf_account_id || '',
    has_token: Boolean(s.cf_token),
    use_pollinations: s.use_pollinations === '1',
    cf_steps: s.cf_steps || '4',
    has_pin: Boolean(s.pin_hash),
    ai_ready: ai.hasCloudflare(s)
  };
}
const hashPin = pin => crypto.createHash('sha256').update('editora-vitor:' + pin).digest('hex');

// ---------- IPC ----------
function handle(channel, fn) {
  ipcMain.handle(channel, async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) }; }
    catch (err) {
      console.error(channel, err);
      return { ok: false, error: err instanceof ai.FriendlyError ? err.message : 'Algo deu errado. Tente de novo.', kind: err.kind || 'unknown' };
    }
  });
}

function registerIpc() {
  handle('books:list', () => store.listBooks());
  handle('books:get', id => store.getBook(id));
  handle('books:create', async data => {
    const s = settingsRaw();
    let hero_prompt_en = '';
    if (data.hero_desc && ai.hasCloudflare(s)) {
      try { hero_prompt_en = await ai.heroToEnglish(s, data.hero_name, data.hero_desc); } catch (e) { /* tenta de novo no primeiro desenho */ }
    }
    return store.createBook({ ...data, hero_prompt_en });
  });
  handle('books:update', async (id, fields) => {
    const before = store.getBook(id);
    const heroChanged = before && (('hero_desc' in fields && fields.hero_desc !== before.hero_desc) || ('hero_name' in fields && fields.hero_name !== before.hero_name));
    if (heroChanged) {
      fields.hero_prompt_en = '';
      const s = settingsRaw();
      if (ai.hasCloudflare(s) && (fields.hero_desc ?? before.hero_desc)) {
        try { fields.hero_prompt_en = await ai.heroToEnglish(s, fields.hero_name ?? before.hero_name, fields.hero_desc ?? before.hero_desc); } catch (e) { /* fica para depois */ }
      }
    }
    store.updateBook(id, fields);
    return store.getBook(id);
  });
  handle('books:delete', id => store.deleteBook(id));
  handle('books:heroes', () => {
    const seen = new Set();
    return store.listBooks()
      .filter(b => b.hero_name && b.hero_desc)
      .filter(b => { const k = b.hero_name.toLowerCase() + '|' + b.hero_desc; if (seen.has(k)) return false; seen.add(k); return true; })
      .map(b => ({ hero_name: b.hero_name, hero_desc: b.hero_desc, hero_prompt_en: b.hero_prompt_en, from: b.title }));
  });

  handle('pages:add', bookId => store.addPage(bookId));
  handle('pages:update', (id, fields) => store.updatePage(id, fields));
  handle('pages:delete', id => store.deletePage(id));
  handle('pages:move', (id, dir) => store.movePage(id, dir));
  handle('pages:clearImage', id => store.clearPageImage(id));

  handle('ai:draw', async pageId => {
    if (busyPages.has(pageId)) throw new ai.FriendlyError('Essa página já está sendo desenhada. Espere um pouquinho.', 'busy');
    busyPages.add(pageId);
    try {
      const s = settingsRaw();
      const page = store.getPage(pageId);
      const book = store.getBook(page.book_id);
      if (!book.hero_prompt_en && book.hero_desc && ai.hasCloudflare(s)) {
        try {
          book.hero_prompt_en = await ai.heroToEnglish(s, book.hero_name, book.hero_desc);
          store.updateBook(book.id, { hero_prompt_en: book.hero_prompt_en });
        } catch (e) { if (e.kind === 'auth') throw e; }
      }
      const prev = book.pages.find(p => p.position === page.position - 1);
      const img = await ai.generateImage(s, book, page, prev ? prev.text : '');
      const rel = store.saveImage(book.id, page.id, img.buffer, img.ext);
      store.setPageImage(page.id, rel, img.prompt);
      return { page: store.getPage(page.id), source: img.source };
    } finally {
      busyPages.delete(pageId);
    }
  });
  handle('ai:spelling', text => ai.fixSpelling(settingsRaw(), text));

  handle('settings:get', () => publicSettings());
  handle('settings:save', data => {
    const out = {};
    if (typeof data.cf_account_id === 'string') out.cf_account_id = data.cf_account_id.trim();
    if (typeof data.cf_token === 'string' && data.cf_token.trim()) out.cf_token = data.cf_token.trim();
    if (typeof data.use_pollinations === 'boolean') out.use_pollinations = data.use_pollinations ? '1' : '0';
    if (data.cf_steps) out.cf_steps = String(data.cf_steps);
    if (typeof data.new_pin === 'string') out.pin_hash = data.new_pin ? hashPin(data.new_pin) : '';
    store.setSettings(out);
    return publicSettings();
  });
  handle('settings:checkPin', pin => {
    const s = settingsRaw();
    return !s.pin_hash || s.pin_hash === hashPin(String(pin));
  });
  handle('settings:test', async data => {
    const s = { ...settingsRaw() };
    if (data && data.cf_account_id) s.cf_account_id = data.cf_account_id.trim();
    if (data && data.cf_token) s.cf_token = data.cf_token.trim();
    return ai.testConnection(s);
  });
  handle('app:openDataFolder', () => shell.openPath(store.dataDir));
  handle('book:exportPdf', id => exportPdf(id));
}

// ---------- PDF ----------
const esc = t => String(t || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STYLE_LABEL = { manga_pb: 'Mangá', manga_cor: 'Mangá colorido', aquarela: 'Livro ilustrado', gibi: 'Gibi' };

function imageDataUri(rel) {
  const full = rel && store.imagePath(rel);
  if (!full || !fs.existsSync(full)) return '';
  const ext = path.extname(full).toLowerCase() === '.png' ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${fs.readFileSync(full).toString('base64')}`;
}

async function exportPdf(bookId) {
  const book = store.getBook(bookId);
  const fonts = f => pathToFileURL(path.join(__dirname, 'renderer', 'fonts', f)).toString();
  const cover = book.pages.find(p => p.image_file);
  const pagesHtml = book.pages.map((p, i) => {
    const img = imageDataUri(p.image_file);
    return `<section class="page">
      ${img ? `<img src="${img}">` : '<div class="noimg"></div>'}
      <div class="text">${esc(p.text).replace(/\n/g, '<br>')}</div>
      <div class="num">${i + 1}</div>
    </section>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Bangers;src:url("${fonts('bangers-latin-400-normal.woff2')}")}
    @font-face{font-family:Nunito;font-weight:700;src:url("${fonts('nunito-latin-700-normal.woff2')}")}
    @font-face{font-family:Nunito;font-weight:900;src:url("${fonts('nunito-latin-900-normal.woff2')}")}
    @page{size:A4;margin:0}
    *{box-sizing:border-box}
    body{margin:0;font-family:Nunito,sans-serif;color:#1B1F2E}
    .page,.cover{width:210mm;height:297mm;page-break-after:always;position:relative;overflow:hidden}
    .cover{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10mm;padding:18mm;background:#1B1F2E;color:#fff;text-align:center}
    .cover img{width:150mm;height:150mm;object-fit:cover;border:3mm solid #fff;transform:rotate(-1.5deg)}
    .cover h1{font-family:Bangers,Impact,sans-serif;font-weight:400;font-size:40pt;letter-spacing:1.5pt;line-height:1;margin:0}
    .cover p{margin:0;font-weight:900;font-size:13pt;letter-spacing:3pt;text-transform:uppercase;color:#FF8A4C}
    .page{padding:14mm 16mm;display:flex;flex-direction:column;gap:8mm}
    .page img,.noimg{width:178mm;height:178mm;object-fit:cover;border:1.2mm solid #1B1F2E;border-radius:2mm}
    .noimg{background:#EEF0F6}
    .text{font-size:15pt;line-height:1.5;font-weight:700;white-space:normal}
    .num{position:absolute;bottom:9mm;right:16mm;font-family:Bangers,Impact,sans-serif;font-size:16pt;color:#F05A1A}
  </style></head><body>
    <section class="cover">
      ${cover ? `<img src="${imageDataUri(cover.image_file)}">` : ''}
      <h1>${esc(book.title)}</h1>
      <p>${esc(STYLE_LABEL[book.style] || 'Livro')} de Vítor Ribeiro de Oliveira</p>
    </section>
    ${pagesHtml}
  </body></html>`;

  const tmp = path.join(os.tmpdir(), `editora-vitor-${bookId}-${Date.now()}.html`);
  fs.writeFileSync(tmp, html);
  const pdfWin = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  try {
    await pdfWin.loadFile(tmp);
    await pdfWin.webContents.executeJavaScript('document.fonts.ready.then(() => true)');
    const pdf = await pdfWin.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { marginType: 'none' }, preferCSSPageSize: true });
    const safeName = book.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'livro';
    if (process.env.EDITORA_PDF_OUT) { fs.writeFileSync(process.env.EDITORA_PDF_OUT, pdf); return { saved: false, test: true }; }
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: 'Salvar o livro em PDF',
      defaultPath: path.join(app.getPath('documents'), `${safeName}.pdf`),
      filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, pdf);
    shell.openPath(filePath);
    return { saved: true, filePath };
  } finally {
    pdfWin.destroy();
    fs.rmSync(tmp, { force: true });
  }
}

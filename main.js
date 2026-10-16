const { app, BrowserWindow, ipcMain, protocol, net, dialog, shell, nativeImage } = require('electron');
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

// ---------- ajudantes da IA ----------
async function ensureHeroText(s, book) {
  if (!book.hero_prompt_en && book.hero_desc && ai.hasCloudflare(s)) {
    try {
      book.hero_prompt_en = await ai.heroToEnglish(s, book.hero_name, book.hero_desc);
      store.updateBook(book.id, { hero_prompt_en: book.hero_prompt_en });
    } catch (e) { if (e.kind === 'auth' || e.kind === 'quota') throw e; }
  }
  return book;
}
// Personagem escolhido em 512px (gasta menos da cota quando vai como referência).
function heroRef(book) {
  const full = book.hero_ref && store.imagePath(book.hero_ref);
  if (!full || !fs.existsSync(full)) return null;
  return nativeImage.createFromPath(full).resize({ width: 512 }).toJPEG(88);
}
function progress(pageId, done, total, message) {
  if (win && !win.isDestroyed()) win.webContents.send('manga:progress', { pageId, done, total, message });
}
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

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
    // Herói de outro livro: copia a imagem escolhida e a descrição, sem gastar IA.
    const from = data.hero_from && store.getBook(data.hero_from);
    if (from && from.hero_name === data.hero_name && from.hero_desc === data.hero_desc) {
      const id = store.createBook({ ...data, hero_prompt_en: from.hero_prompt_en });
      const src = from.hero_ref && store.imagePath(from.hero_ref);
      if (src && fs.existsSync(src)) store.updateBook(id, { hero_ref: store.saveImage(id, 'personagem', fs.readFileSync(src)) });
      return id;
    }
    return store.createBook(data);
  });
  handle('books:update', async (id, fields) => {
    const before = store.getBook(id);
    const heroChanged = before && 'hero_desc' in fields && fields.hero_desc !== before.hero_desc;
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
      .map(b => ({ hero_name: b.hero_name, hero_desc: b.hero_desc, hero_ref: b.hero_ref, book_id: b.id, from: b.title }));
  });

  handle('pages:add', bookId => store.addPage(bookId));
  handle('pages:update', (id, fields) => store.updatePage(id, fields));
  handle('pages:delete', id => store.deletePage(id));
  handle('pages:move', (id, dir) => store.movePage(id, dir));
  // ----- personagem: duas opções, ele escolhe uma -----
  handle('hero:options', async bookId => {
    const s = settingsRaw();
    const book = await ensureHeroText(s, store.getBook(bookId));
    const images = await ai.heroOptions(s, book);
    for (const old of book.hero_options) if (old !== book.hero_ref) store.removeImageFile(old);
    const files = images.map((buf, i) => store.saveImage(bookId, `personagem-opcao${i + 1}`, buf));
    store.updateBook(bookId, { hero_options: JSON.stringify(files) });
    return store.getBook(bookId);
  });
  handle('hero:choose', async (bookId, rel) => {
    const s = settingsRaw();
    const book = store.getBook(bookId);
    if (!book.hero_options.includes(rel)) throw new ai.FriendlyError('Essa opção não existe mais. Peça novas opções.', 'state');
    const fields = { hero_ref: rel, hero_options: '[]' };
    try { fields.hero_prompt_en = await ai.describeHero(s, fs.readFileSync(store.imagePath(rel))); } catch (e) { if (e.kind === 'auth') throw e; }
    if (book.hero_ref && book.hero_ref !== rel) store.removeImageFile(book.hero_ref);
    for (const other of book.hero_options) if (other !== rel) store.removeImageFile(other);
    store.updateBook(bookId, fields);
    return store.getBook(bookId);
  });

  // ----- transformar a página escrita em mangá -----
  handle('page:manga', async pageId => {
    if (busyPages.has(pageId)) throw new ai.FriendlyError('Essa página já está sendo desenhada. Espere um pouquinho.', 'busy');
    busyPages.add(pageId);
    try {
      const s = settingsRaw();
      const page = store.getPage(pageId);
      const text = (page.text || '').trim();
      if (!text) throw new ai.FriendlyError('Escreva a página primeiro. A IA lê o seu texto para montar os quadrinhos.', 'input');
      const book = await ensureHeroText(s, store.getBook(page.book_id));
      const prev = book.pages.find(p => p.position === page.position - 1);
      progress(pageId, 0, 0, 'Lendo a sua história...');
      const plan = await ai.planPage(s, book, text, prev ? prev.text : '');
      const shapes = ai.LAYOUTS[plan.length];
      const ref = heroRef(book);
      let done = 0;
      progress(pageId, 0, plan.length, `Desenhando ${plan.length} quadrinhos...`);
      const panels = await mapLimit(plan, 2, async (panel, i) => {
        const out = { ...panel, shape: shapes[i], image_file: null, error: '' };
        try {
          out.image_file = store.saveImage(book.id, `p${page.id}-q${i + 1}`, await ai.drawPanel(s, book, panel, shapes[i], ref));
        } catch (e) {
          if (['auth', 'config', 'quota'].includes(e.kind)) throw e;
          out.error = e instanceof ai.FriendlyError ? e.message : 'Esse quadrinho não saiu.';
        }
        progress(pageId, ++done, plan.length, `Quadrinho ${done} de ${plan.length} pronto!`);
        return out;
      });
      return store.setPanels(pageId, panels, text);
    } finally {
      busyPages.delete(pageId);
    }
  });
  handle('panel:redraw', async (pageId, idx) => {
    const key = `${pageId}:${idx}`;
    if (busyPages.has(key)) throw new ai.FriendlyError('Esse quadrinho já está sendo desenhado.', 'busy');
    busyPages.add(key);
    try {
      const s = settingsRaw();
      const page = store.getPage(pageId);
      const panel = page.panels[idx];
      const book = await ensureHeroText(s, store.getBook(page.book_id));
      const buf = await ai.drawPanel(s, book, panel, panel.shape, heroRef(book));
      return store.updatePanel(pageId, idx, { image_file: store.saveImage(book.id, `p${page.id}-q${idx + 1}`, buf), error: '' });
    } finally {
      busyPages.delete(key);
    }
  });
  handle('panel:update', (pageId, idx, fields) => store.updatePanel(pageId, idx, fields));
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
  handle('book:exportPdf', (id, html) => exportPdf(id, html));
}

// ---------- PDF ----------
// O renderer manda as páginas de mangá já montadas (o mesmo HTML da tela); aqui elas viram folhas A4.
function imageDataUri(rel) {
  const full = rel && store.imagePath(rel);
  if (!full || !fs.existsSync(full)) return '';
  const ext = path.extname(full).toLowerCase() === '.png' ? 'png' : 'jpeg';
  return `data:image/${ext};base64,${fs.readFileSync(full).toString('base64')}`;
}

async function exportPdf(bookId, bodyHtml) {
  const book = store.getBook(bookId);
  const cssUrl = f => pathToFileURL(path.join(__dirname, 'renderer', f)).toString();
  // As imagens vão embutidas no arquivo, para a janela de impressão não depender do protocolo img://.
  const body = String(bodyHtml || '').replace(/img:\/\/local\/([^"')\s]+)/g,
    (_m, rel) => imageDataUri(rel.split('/').map(decodeURIComponent).join('/')));
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><link rel="stylesheet" href="${cssUrl('styles.css')}"><link rel="stylesheet" href="${cssUrl('manga.css')}"></head><body class="print">${body}</body></html>`;

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

'use strict';
/* Editora do Vítor: Biblioteca, Novo livro, Personagem, Editor de mangá, Leitor e Área dos pais. */

const API = window.editora;
const $view = document.getElementById('view');

// ---------- ícones (traço simples, herdam a cor) ----------
const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  back: svg('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  left: svg('<path d="M15 18l-6-6 6-6"/>'),
  right: svg('<path d="M9 18l6-6-6-6"/>'),
  wand: svg('<path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8l1.4 1.4M17.8 6.2l1.4-1.4M12.2 6.2l-1.4-1.4"/><path d="M15 9l-12 12"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/>'),
  redo: svg('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  check: svg('<path d="M20 6L9 17l-5-5"/>'),
  image: svg('<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>'),
  spell: svg('<path d="M4 16l4-10 4 10M5.5 12.5h5M14 17l2.5 2.5L21 14"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  pdf: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M12 18v-6M9 15l3 3 3-3"/>'),
  read: svg('<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'),
  pen: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  star: svg('<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'),
  folder: svg('<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
  panels: svg('<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 10h18M12 10v11"/>')
};

const STYLES = [
  { id: 'manga_pb', name: 'Mangá preto e branco', desc: 'Traço forte e retícula, como os mangás japoneses.' },
  { id: 'manga_cor', name: 'Mangá colorido', desc: 'Estilo anime, com cores vivas.' },
  { id: 'gibi', name: 'Gibi', desc: 'Desenho animado. O personagem sai mais igual em todos os quadrinhos.' },
  { id: 'aquarela', name: 'Aquarela', desc: 'Contorno e pintura suave, como o livro da Lanchonete.' }
];
const styleName = id => (STYLES.find(s => s.id === id) || STYLES[0]).name;

// ---------- utilidades de tela ----------
function el(tag, props = {}, ...children) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'icon') n.insertAdjacentHTML('afterbegin', ICON[v]);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') n.value = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    n.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return n;
}
const btn = (label, cls, onClick, icon, extra = {}) => el('button', { type: 'button', class: `btn ${cls}`, onClick, icon, ...extra }, label);
const iconBtn = (icon, label, onClick, cls = '') => {
  const b = el('button', { type: 'button', class: `icon-btn ${cls}`, title: label, 'aria-label': label, onClick });
  b.innerHTML = ICON[icon];
  return b;
};
const imgSrc = rel => `img://local/${rel.split('/').map(encodeURIComponent).join('/')}`;
const firstImage = page => (page.panels || []).map(p => p.image_file).find(Boolean) || null;

let toastTimer;
function toast(msg, kind = '', ms = 4200) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = kind; }, ms);
}

async function call(name, ...args) {
  const r = await API[name](...args);
  if (!r.ok) {
    toast(r.error, 'error', 7000);
    const e = new Error(r.error); e.kind = r.kind; e.shown = true;
    throw e;
  }
  return r.data;
}
async function callQuiet(name, ...args) { return API[name](...args); }

async function busy(button, fn, label) {
  const old = button.lastChild.textContent;
  button.classList.add('loading');
  if (label) button.lastChild.textContent = label;
  try { return await fn(); }
  catch (e) { if (!e.shown) { console.error(e); toast('Algo deu errado. Tente de novo.', 'error'); } }
  finally {
    if (button.isConnected) { button.classList.remove('loading'); button.lastChild.textContent = old; }
  }
}

// ---------- janelas ----------
function openModal({ title, body, actions = [], wide = false, onClose }) {
  const root = document.getElementById('modalRoot');
  const prevFocus = document.activeElement;
  const box = el('div', { class: `modal${wide ? ' wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const back = el('div', { class: 'modal-back' }, box);
  const close = () => {
    back.remove();
    document.removeEventListener('keydown', onKey, true);
    if (onClose) onClose();
    if (prevFocus && prevFocus.isConnected) prevFocus.focus({ preventScroll: true });
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  box.append(el('h2', { text: title }));
  if (body) box.append(...[].concat(body));
  if (actions.length) {
    box.append(el('div', { class: 'modal-foot' }, actions.filter(Boolean).map(a => btn(a.label, a.kind || 'btn-ghost', async ev => {
      if (a.onClick) {
        const r = await a.onClick(ev, close);
        if (r === false) return;
      }
      if (a.close !== false) close();
    }, a.icon))));
  }
  root.append(back);
  const first = box.querySelector('input, textarea, .modal-foot .btn:last-child');
  if (first) first.focus();
  return { close, box };
}
function confirmBox(title, text, okLabel, danger = true) {
  return new Promise(resolve => {
    let answered = false;
    openModal({
      title, body: el('p', { text }),
      onClose: () => { if (!answered) resolve(false); },
      actions: [
        { label: 'Cancelar', kind: 'btn-ghost', onClick: () => { answered = true; resolve(false); } },
        { label: okLabel, kind: danger ? 'btn-danger' : 'btn-primary', onClick: () => { answered = true; resolve(true); } }
      ]
    });
  });
}

// ---------- navegação ----------
const S = { settings: null, cleanup: [], working: new Map() };

async function go(view, params = {}) {
  if (S.flush) await S.flush();
  S.cleanup.forEach(fn => fn());
  S.cleanup = [];
  S.flush = null;
  $view.replaceChildren();
  $view.scrollTop = 0;
  try {
    if (view === 'library') await renderLibrary();
    else if (view === 'new') await renderNew();
    else if (view === 'hero') await renderHero(params.id);
    else if (view === 'editor') await renderEditor(params.id);
    else if (view === 'reader') await renderReader(params.id, params.at || 0);
    else if (view === 'settings') await renderSettings();
  } catch (e) {
    if (!e.shown) { console.error(e); toast('Não consegui abrir essa tela. Tente de novo.', 'error'); }
    if (view !== 'library') go('library');
  }
}

document.getElementById('brand').addEventListener('click', () => go('library'));
const settingsBtn = document.getElementById('settingsBtn');
settingsBtn.innerHTML = ICON.gear;
settingsBtn.addEventListener('click', openParents);

// ======================================================================
// PÁGINA DE MANGÁ (a mesma montagem na tela, no leitor e no PDF)
// ======================================================================
function mangaPage(page, style, { onPanel, onDescribe, onMove, number } = {}) {
  const panels = page.panels || [];
  const sheet = el('div', { class: `manga n${panels.length}`, 'data-style': style });
  // Balão, narração e som: usa o lugar que o Vítor escolheu (em % do quadrinho) e, no editor, deixa arrastar.
  const place = (fig, node, p, i, key) => {
    const at = (p.pos || {})[key];
    if (at) Object.assign(node.style, { left: `${at.x}%`, top: `${at.y}%`, right: 'auto', bottom: 'auto' });
    if (onMove) { node.classList.add('drag'); dragInPanel(fig, node, at => onMove(i, key, at)); }
    fig.append(node);
  };
  panels.forEach((p, i) => {
    // No editor, quadrinho sem desenho vira um quadro para o Vítor contar a cena com as palavras dele.
    if (!p.image_file && onDescribe) { sheet.append(describePanel(p, i, onDescribe)); return; }
    const fig = el(onPanel ? 'button' : 'figure', {
      class: `panel ${p.shape || 'wide'}${p.narration && !repeatsDialogue(p) ? ' has-cap' : ''}`,
      type: onPanel ? 'button' : null,
      'aria-label': onPanel ? `Quadrinho ${i + 1}: editar` : null,
      onClick: onPanel ? () => onPanel(i) : null
    });
    if (p.image_file) fig.append(el('img', { src: imgSrc(p.image_file), alt: '' }));
    else fig.append(el('div', { class: 'panel-empty' }));
    if (p.narration && !repeatsDialogue(p)) place(fig, el('div', { class: 'cap', text: p.narration }), p, i, 'cap');
    (p.dialogue || []).slice(0, 2).forEach((d, k) => {
      if (d) place(fig, el('div', { class: `bal b${k}${/!/.test(d) ? ' shout' : ''}`, text: d }), p, i, `b${k}`);
    });
    if (p.sfx) place(fig, el('div', { class: `sfx${(p.dialogue || [])[1] ? ' mid' : ''}`, text: p.sfx }), p, i, 'sfx');
    if (onPanel) fig.append(el('span', { class: 'panel-edit', text: 'Editar' }));
    sheet.append(fig);
  });
  if (number) sheet.append(el('span', { class: 'folio', text: String(number) }));
  return sheet;
}
// Arrastar dentro do quadrinho. Só conta como arrasto depois de 4px; um clique simples continua abrindo o quadrinho.
function dragInPanel(fig, node, done) {
  node.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const left0 = node.offsetLeft, top0 = node.offsetTop;
    const W = fig.clientWidth, H = fig.clientHeight;
    const maxX = Math.max(0, 100 - node.offsetWidth / W * 100), maxY = Math.max(0, 100 - node.offsetHeight / H * 100);
    const clamp = (v, max) => Math.round(Math.min(max, Math.max(0, v)) * 10) / 10;
    let at = null;
    try { node.setPointerCapture(e.pointerId); } catch {}
    const move = ev => {
      if (!at && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 4) return;
      at = { x: clamp((left0 + ev.clientX - sx) / W * 100, maxX), y: clamp((top0 + ev.clientY - sy) / H * 100, maxY) };
      node.classList.add('dragging');
      Object.assign(node.style, { left: `${at.x}%`, top: `${at.y}%`, right: 'auto', bottom: 'auto' });
    };
    const up = () => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      node.classList.remove('dragging');
      if (!at) return;
      // Engole o clique que vem logo depois do arrasto, para não abrir a janela do quadrinho.
      const eat = ev => { ev.stopPropagation(); ev.preventDefault(); };
      fig.addEventListener('click', eat, { capture: true, once: true });
      setTimeout(() => { fig.removeEventListener('click', eat, { capture: true }); done(at); }, 0);
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  });
}
// Páginas antigas podem ter a fala repetida na narração ("Mas que chato..., disse."): mostra só o balão.
const normText = t => String(t).toLowerCase().normalize('NFD').replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
const repeatsDialogue = p => (p.dialogue || []).some(d => d && (normText(p.narration).includes(normText(d)) || normText(d).includes(normText(p.narration))));

function describePanel(p, i, onDescribe) {
  const said = [repeatsDialogue(p) ? '' : p.narration, ...(p.dialogue || [])].filter(Boolean).join(' ');
  const desc = el('textarea', { class: 'textarea', id: `desc-${i}`, maxlength: 400, value: p.user_desc || '',
    placeholder: 'Ex.: o herói balançando a espada e o monstro voando longe, com cara de surpreso' });
  const go = btn('Desenhar', 'btn-magic', null, 'wand');
  go.addEventListener('click', () => {
    if (!desc.value.trim()) { toast('Conte o que aparece no quadrinho.', 'error'); desc.focus(); return; }
    onDescribe(i, desc.value.trim(), go);
  });
  return el('div', { class: `panel ask ${p.shape || 'wide'}` },
    el('b', { text: `Quadrinho ${i + 1} não saiu` }),
    el('p', { text: (p.error === 'safety' || /combina/.test(p.error || ''))
      ? 'A IA não conseguiu desenhar essa cena. Conte do seu jeito o que aparece nele, como num desenho animado.'
      : 'A IA não conseguiu desenhar. Conte do seu jeito o que aparece nele.' }),
    said ? el('q', { text: said }) : null,
    desc,
    go);
}
function coverSheet(book) {
  const img = book.hero_ref || book.pages.map(firstImage).find(Boolean);
  return el('div', { class: 'cover-sheet', 'data-style': book.style },
    img ? el('img', { src: imgSrc(img), alt: '' }) : null,
    el('div', { class: 'cover-words' },
      el('p', { text: styleName(book.style) }),
      el('h2', { text: book.title }),
      el('p', { text: 'de Vítor Ribeiro de Oliveira' })));
}

// ======================================================================
// BIBLIOTECA
// ======================================================================
async function renderLibrary() {
  const [books, settings] = await Promise.all([call('listBooks'), call('getSettings')]);
  S.settings = settings;
  const drafts = books.filter(b => b.status !== 'published');
  const done = books.filter(b => b.status === 'published');

  const wrap = el('div', { class: 'wrap' });
  wrap.append(el('div', { class: 'lib-head' },
    el('div', { class: 'field' },
      el('h1', { class: 'display', text: 'Biblioteca Mágica' }),
      el('p', { class: 'lead', text: books.length ? 'Escolha um mangá para continuar ou comece uma história nova.' : 'Toda grande coleção começa com um livro.' })),
    btn('Novo mangá', 'btn-primary btn-big', () => go('new'), 'plus')));

  if (!settings.ai_ready) {
    wrap.append(el('div', { class: 'banner' },
      el('span', { text: 'A IA ainda não foi configurada. Um adulto precisa abrir a Área dos pais.' }),
      btn('Área dos pais', 'btn-ghost', openParents, 'gear')));
  }

  if (!books.length) {
    wrap.append(el('div', { class: 'empty' },
      el('p', { class: 'display', text: 'Sua estante está vazia' }),
      el('p', { class: 'lead', text: 'Crie um herói, escreva a primeira página e veja ela virar mangá.' }),
      btn('Criar meu primeiro mangá', 'btn-primary btn-big', () => go('new'), 'plus')));
  }
  if (drafts.length) wrap.append(el('h2', { class: 'section', icon: 'pen' }, 'Em curso'), shelf(drafts));
  if (done.length) wrap.append(el('h2', { class: 'section', icon: 'star' }, 'Publicados'), shelf(done));
  $view.append(wrap);
}

function shelf(books) {
  return el('div', { class: 'shelf' }, books.map(b => {
    const published = b.status === 'published';
    const open = () => go(published ? 'reader' : 'editor', { id: b.id });
    const cover = el('button', { type: 'button', class: 'cover', onClick: open, 'aria-label': `Abrir ${b.title}` },
      b.cover ? el('img', { src: imgSrc(b.cover), alt: '' }) : el('div', { class: 'cover-empty', text: b.title }),
      published ? el('span', { class: 'pill ok badge', text: 'Publicado' }) : null);
    const del = iconBtn('trash', `Apagar ${b.title}`, async () => {
      if (await confirmBox('Apagar este livro?', `"${b.title}" e todos os desenhos dele vão sumir para sempre.`, 'Apagar para sempre')) {
        await call('deleteBook', b.id);
        toast('Livro apagado.');
        go('library');
      }
    });
    return el('article', { class: 'book' },
      cover,
      el('h3', { class: 'book-title', text: b.title }),
      el('p', { class: 'book-meta', text: `${b.page_count} ${b.page_count === 1 ? 'página' : 'páginas'} · ${styleName(b.style)}` }),
      el('div', { class: 'book-actions' },
        published ? btn('Ler', 'btn-soft', open, 'read') : btn('Continuar', 'btn-soft', open, 'pen'),
        published ? btn('Editar', 'btn-ghost', () => go('editor', { id: b.id })) : btn('Ler', 'btn-ghost', () => go('reader', { id: b.id })),
        del));
  }));
}

// ======================================================================
// NOVO LIVRO
// ======================================================================
async function renderNew() {
  const heroes = await call('heroes');
  const f = { style: 'manga_pb', hero_from: null };

  const title = el('input', { class: 'input', id: 'nb-title', maxlength: 80, placeholder: 'Ex.: Lanchonete monstruosa 3', autocomplete: 'off' });
  const heroName = el('input', { class: 'input', id: 'nb-hero', maxlength: 40, placeholder: 'Ex.: Larry, o entregador', autocomplete: 'off' });
  const heroDesc = el('textarea', { class: 'textarea', id: 'nb-desc', maxlength: 600, placeholder: 'Ex.: entregador de pizza, cabelo cacheado preto, boné vermelho, mochila térmica vermelha, tênis branco.' });
  const create = btn('Criar o personagem', 'btn-primary btn-big', null, 'wand');
  const check = () => { create.disabled = !(title.value.trim() && heroName.value.trim() && heroDesc.value.trim()); };
  [title, heroName, heroDesc].forEach(i => i.addEventListener('input', check));
  check();

  const styleBtns = STYLES.map(s => el('button', {
    type: 'button', class: 'style-opt', 'aria-pressed': String(s.id === f.style),
    onClick: e => { f.style = s.id; styleBtns.forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); }
  }, el('div', { class: `swatch sw-${s.id}` }), el('b', { text: s.name }), el('small', { text: s.desc })));

  create.addEventListener('click', () => busy(create, async () => {
    const data = { title: title.value.trim(), hero_name: heroName.value.trim(), hero_desc: heroDesc.value.trim(), style: f.style, hero_from: f.hero_from };
    const id = await call('createBook', data);
    const book = await call('getBook', id);
    go(book.hero_ref ? 'editor' : 'hero', { id });
  }, 'Preparando...'));

  const step = (n, h, ...body) => el('div', { class: 'step' }, el('div', { class: 'step-num', text: n }), el('div', { class: 'step-body' }, el('h3', { text: h }), ...body));

  $view.append(el('div', { class: 'wrap' },
    el('div', { class: 'lib-head' }, el('h1', { class: 'display', text: 'Novo mangá' }), btn('Voltar', 'btn-ghost', () => go('library'), 'back')),
    el('div', { class: 'card form-card' },
      step('1', 'Qual é o nome do mangá?', title),
      step('2', 'Quem é o herói?',
        el('label', { class: 'field' }, el('span', { text: 'Nome do herói' }), heroName),
        el('label', { class: 'field' }, el('span', { text: 'Como ele é? Escreva do seu jeito' }), heroDesc),
        el('p', { class: 'hint', text: 'Conte a cor do cabelo, a roupa e os acessórios. A IA vai desenhar duas opções e você escolhe a melhor.' }),
        heroes.length ? el('div', { class: 'field' },
          el('span', { text: 'Ou chame um herói que já existe' }),
          el('div', { class: 'chips' }, heroes.map(h => el('button', {
            type: 'button', class: 'chip hero-chip', title: `Do livro "${h.from}"`,
            onClick: () => { heroName.value = h.hero_name; heroDesc.value = h.hero_desc; f.hero_from = h.book_id; check(); }
          }, h.hero_ref ? el('img', { src: imgSrc(h.hero_ref), alt: '' }) : null, h.hero_name)))) : null),
      step('3', 'Como vão ser os desenhos?', el('div', { class: 'styles' }, styleBtns)),
      el('div', { class: 'form-foot' }, create))));
  title.focus();
}

// ======================================================================
// PERSONAGEM: duas opções, ele escolhe uma
// ======================================================================
async function renderHero(id) {
  let book = await call('getBook', id);
  const wrap = el('div', { class: 'wrap' });
  const grid = el('div', { class: 'hero-grid' });
  const desc = el('textarea', { class: 'textarea', id: 'hero-desc', maxlength: 600, value: book.hero_desc });
  const name = el('input', { class: 'input', id: 'hero-name', maxlength: 40, value: book.hero_name });
  const again = btn('Desenhar outras duas', 'btn-magic', null, 'redo');

  function paintOptions(loading) {
    grid.replaceChildren();
    if (loading) {
      for (let i = 0; i < 2; i++) grid.append(el('div', { class: 'hero-opt loading' }, el('div', { class: 'drawing' }, el('b', { text: 'Desenhando...' }), el('span', { text: `Opção ${i + 1}` }))));
      return;
    }
    const opts = book.hero_options || [];
    if (!opts.length) {
      grid.append(el('div', { class: 'empty hero-empty' },
        el('p', { class: 'lead', text: book.hero_ref ? 'Este é o personagem atual. Quer ver outras versões dele?' : 'Aperte o botão para a IA desenhar duas versões do herói.' }),
        book.hero_ref ? el('img', { class: 'hero-current', src: imgSrc(book.hero_ref), alt: '' }) : null));
      return;
    }
    opts.forEach((rel, i) => {
      const pick = btn('Escolher este', 'btn-primary btn-big', null, 'check');
      pick.addEventListener('click', () => busy(pick, async () => {
        await call('heroChoose', book.id, rel);
        toast(`${book.hero_name} está pronto! Agora é só escrever.`, 'good', 5000);
        go('editor', { id: book.id });
      }, 'Guardando o personagem...'));
      grid.append(el('div', { class: 'hero-opt' },
        el('img', { src: imgSrc(rel), alt: `Opção ${i + 1}` }),
        el('div', { class: 'hero-opt-foot' }, el('b', { text: `Opção ${i + 1}` }), pick)));
    });
  }

  async function generate() {
    if (again.classList.contains('loading')) return;
    const changed = desc.value.trim() !== book.hero_desc || name.value.trim() !== book.hero_name;
    again.classList.add('loading');
    paintOptions(true);
    try {
      if (changed) book = await call('updateBook', book.id, { hero_name: name.value.trim(), hero_desc: desc.value.trim() });
      book = await call('heroOptions', book.id);
    } catch (e) { /* aviso já mostrado */ }
    finally {
      again.classList.remove('loading');
      if (grid.isConnected) paintOptions(false);
    }
  }
  again.addEventListener('click', generate);

  wrap.append(el('div', { class: 'lib-head' },
    el('div', { class: 'field' },
      el('h1', { class: 'display', text: `Quem é ${book.hero_name}?` }),
      el('p', { class: 'lead', text: 'Escolha a versão que mais combina com a sua história. Ela vai aparecer em todos os quadrinhos.' })),
    btn(book.hero_ref ? 'Voltar para o mangá' : 'Pular por enquanto', 'btn-ghost', () => go('editor', { id: book.id }), 'back')));
  wrap.append(el('div', { class: 'hero-layout' },
    el('div', { class: 'card hero-form' },
      el('label', { class: 'field' }, el('span', { text: 'Nome' }), name),
      el('label', { class: 'field' }, el('span', { text: 'Como ele é' }), desc),
      el('p', { class: 'hint', text: 'Mudou a descrição? Aperte o botão para desenhar de novo.' }),
      again),
    grid));
  $view.append(wrap);
  paintOptions(false);
  if (!book.hero_options.length && !book.hero_ref) generate();
}

// ======================================================================
// EDITOR
// ======================================================================
async function renderEditor(id) {
  const book = await call('getBook', id);
  const E = { book, idx: Math.min(Math.max(0, book.current_page || 0), book.pages.length - 1) };
  const page = () => E.book.pages[E.idx];
  const working = S.working; // páginas sendo transformadas em mangá (sobrevive à troca de tela)

  // ----- salvamento automático -----
  const pending = new Map();
  let timer = null;
  const statusPill = el('span', { class: 'pill ok' });
  const setStatus = st => {
    statusPill.className = `pill ${st === 'saved' ? 'ok' : st === 'error' ? 'err' : 'warn'}`;
    statusPill.textContent = st === 'saved' ? 'Tudo salvo' : st === 'error' ? 'Não salvou, tentando de novo...' : 'Salvando...';
  };
  setStatus('saved');
  const flush = async () => {
    clearTimeout(timer); timer = null;
    if (!pending.size) return;
    const jobs = [...pending.entries()];
    pending.clear();
    try {
      for (const [pid, fields] of jobs) await call('updatePage', pid, fields);
      if (!pending.size) setStatus('saved');
    } catch (e) {
      for (const [pid, fields] of jobs) pending.set(pid, { ...fields, ...(pending.get(pid) || {}) });
      setStatus('error');
      timer = setTimeout(flush, 3000);
    }
  };
  const queue = (pid, fields) => {
    pending.set(pid, { ...(pending.get(pid) || {}), ...fields });
    setStatus('saving');
    clearTimeout(timer);
    timer = setTimeout(flush, 600);
  };
  S.flush = flush;
  const onUnload = e => { if (pending.size) { e.returnValue = false; flush().then(() => window.close()); } };
  window.addEventListener('beforeunload', onUnload);
  S.cleanup.push(() => window.removeEventListener('beforeunload', onUnload));

  let pageSaveTimer;
  const rememberPage = () => {
    clearTimeout(pageSaveTimer);
    pageSaveTimer = setTimeout(() => callQuiet('updateBook', E.book.id, { current_page: E.idx }), 400);
  };
  const reload = async () => {
    await flush();
    E.book = await call('getBook', E.book.id);
    E.idx = Math.min(E.idx, E.book.pages.length - 1);
  };
  const replacePage = fresh => {
    const i = E.book.pages.findIndex(p => p.id === fresh.id);
    if (i >= 0) E.book.pages[i] = { ...fresh, text: E.book.pages[i].text };
  };

  // progresso vindo do programa principal
  const progressLine = el('span');
  const progressBar = el('i');
  S.cleanup.push(API.onProgress(d => {
    const w = working.get(d.pageId);
    if (!w) return;
    w.message = d.message; w.done = d.done; w.total = d.total;
    if (page().id === d.pageId) paintProgress();
  }));
  function paintProgress() {
    const w = working.get(page().id);
    if (!w) return;
    progressLine.textContent = w.message || 'Começando...';
    progressBar.style.width = w.total ? `${Math.round(8 + 92 * w.done / w.total)}%` : '6%';
  }

  // ----- cabeçalho -----
  const head = el('div', { class: 'card ed-head' });
  function paintHead() {
    const b = E.book;
    head.replaceChildren(
      btn('Biblioteca', 'btn-ghost', () => go('library'), 'back'),
      el('button', { type: 'button', class: 'ed-thumb', title: `Personagem: ${b.hero_name}`, onClick: () => go('hero', { id: b.id }) },
        b.hero_ref ? el('img', { src: imgSrc(b.hero_ref), alt: '' }) : el('span', { text: '?' })),
      el('div', { class: 'ed-title' },
        el('button', { type: 'button', title: 'Mudar o nome do mangá', onClick: editTitle }, b.title),
        el('div', { class: 'meta' }, el('span', { class: 'pill', text: styleName(b.style) }), statusPill)),
      el('div', { class: 'ed-tools' },
        btn(b.hero_ref ? `Personagem: ${b.hero_name}` : `Escolher a cara do ${b.hero_name}`, b.hero_ref ? 'btn-ghost' : 'btn-soft', () => go('hero', { id: b.id }), 'user'),
        btn('Ler', 'btn-ghost', async () => { await flush(); go('reader', { id: b.id, at: E.idx + 1 }); }, 'read'),
        b.status === 'published' ? el('span', { class: 'pill ok', text: 'Publicado' }) : btn('Publicar', 'btn-ok', publish, 'check')));
  }

  // ----- escrita -----
  const pageLabel = el('span', { class: 'display' });
  const story = el('textarea', { class: 'story', id: 'story', spellcheck: 'true', placeholder: 'Escreva a página aqui. Ex.: Larry pegou as pizzas e saiu correndo. De repente a bruxa apareceu e gritou: "Essas pizzas são minhas!"' });
  const staleNote = el('p', { class: 'stale', hidden: true }, 'Você mudou o texto. Aperte o botão para atualizar o mangá desta página.');
  story.addEventListener('input', () => { page().text = story.value; queue(page().id, { text: story.value }); paintMakeBtn(); });
  story.addEventListener('blur', flush);
  const spellBtn = btn('Corrigir ortografia', 'btn-soft', null, 'spell');
  spellBtn.addEventListener('click', () => busy(spellBtn, spelling, 'Conferindo...'));
  const makeBtn = btn('Transformar em mangá', 'btn-magic btn-big', () => makeManga(page()), 'wand');
  const writeCard = el('div', { class: 'card write-card' },
    el('div', { class: 'write-head' }, pageLabel, spellBtn),
    story,
    staleNote,
    makeBtn,
    el('p', { class: 'hint center', text: 'A IA lê o que você escreveu, divide em quadrinhos, coloca as falas nos balões e desenha tudo.' }));
  function paintMakeBtn() {
    const p = page();
    const isWorking = working.has(p.id);
    const hasPanels = (p.panels || []).length > 0;
    const stale = hasPanels && (p.panels_text || '').trim() !== (p.text || '').trim();
    makeBtn.disabled = isWorking || !(p.text || '').trim();
    makeBtn.lastChild.textContent = isWorking ? 'Desenhando...' : hasPanels ? 'Refazer o mangá desta página' : 'Transformar em mangá';
    staleNote.hidden = !stale || isWorking;
  }

  // ----- página de mangá -----
  const stage = el('div', { class: 'card stage' });
  function paintStage() {
    const p = page();
    stage.replaceChildren();
    if ((p.panels || []).length) {
      stage.append(mangaPage(p, E.book.style, {
        onPanel: i => editPanel(p, i),
        onDescribe: (i, text, button) => describeAndDraw(p, i, text, button),
        onMove: (i, key, at) => moveBubble(p, i, key, at)
      }));
      stage.append(el('p', { class: 'hint center', text: 'Arraste os balões para mudar de lugar. Clique num quadrinho para mudar as falas ou desenhar de novo.' }));
    } else {
      const empty = el('div', { class: 'manga-empty' });
      empty.innerHTML = ICON.panels;
      empty.append(el('b', { text: 'A página de mangá aparece aqui' }), el('span', { text: 'Escreva o que acontece e aperte "Transformar em mangá".' }));
      stage.append(empty);
    }
    if (working.has(p.id)) {
      stage.append(el('div', { class: 'drawing' },
        el('b', { text: 'Fazendo o mangá...' }),
        progressLine,
        el('div', { class: 'progress' }, progressBar),
        el('span', { class: 'small', text: 'Pode continuar escrevendo em outra página!' })));
      paintProgress();
    }
  }

  // ----- paginação -----
  const prevBtn = el('button', { type: 'button', class: 'round', 'aria-label': 'Página anterior', onClick: () => goPage(E.idx - 1) });
  prevBtn.innerHTML = ICON.left;
  const nextBtn = el('button', { type: 'button', class: 'round', 'aria-label': 'Próxima página', onClick: () => goPage(E.idx + 1) });
  nextBtn.innerHTML = ICON.right;
  const num = el('div', { class: 'num' });
  const pager = el('div', { class: 'card pager' }, prevBtn, num, nextBtn);
  const moveBack = btn('Mover para trás', 'btn-ghost', () => movePage(-1), 'left');
  const moveFwd = btn('Mover para frente', 'btn-ghost', () => movePage(1), 'right');
  const pageTools = el('div', { class: 'page-tools' },
    btn('Página nova', 'btn-primary', addPage, 'plus'), moveBack, moveFwd,
    btn('Apagar página', 'btn-danger', deletePage, 'trash'));
  function paintPager() {
    const n = E.book.pages.length;
    num.replaceChildren(String(E.idx + 1), el('small', { text: `de ${n}` }));
    prevBtn.disabled = moveBack.disabled = E.idx === 0;
    nextBtn.disabled = moveFwd.disabled = E.idx >= n - 1;
  }

  const strip = el('div', { class: 'strip', 'aria-label': 'Todas as páginas' });
  function paintStrip() {
    strip.replaceChildren(...E.book.pages.map((p, i) => {
      const img = firstImage(p);
      return el('button', { type: 'button', class: 'thumb', 'aria-current': String(i === E.idx), onClick: () => goPage(i), title: `Página ${i + 1}` },
        el('div', { class: `t${working.has(p.id) ? ' busy' : ''}` }, img ? el('img', { src: imgSrc(img), alt: '' }) : String(i + 1)),
        `Página ${i + 1}`);
    }),
    el('button', { type: 'button', class: 'thumb add', onClick: addPage, title: 'Página nova' }, el('div', { class: 't', text: '+' }), 'Nova'));
    const cur = strip.children[E.idx];
    if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  function paintPage() {
    pageLabel.textContent = `Página ${E.idx + 1}`;
    story.value = page().text || '';
    paintMakeBtn(); paintStage(); paintPager(); paintStrip();
  }

  // ----- ações -----
  async function goPage(i) {
    if (i < 0 || i >= E.book.pages.length || i === E.idx) return;
    await flush();
    E.idx = i;
    paintPage();
    rememberPage();
    story.focus({ preventScroll: true });
  }
  async function addPage() {
    await flush();
    await call('addPage', E.book.id);
    await reload();
    E.idx = E.book.pages.length - 1;
    paintHead(); paintPage(); rememberPage();
    story.focus({ preventScroll: true });
  }
  async function movePage(dir) {
    await flush();
    await call('movePage', page().id, dir);
    E.idx += dir;
    await reload();
    paintHead(); paintPage(); rememberPage();
  }
  async function deletePage() {
    const p = page();
    if (working.has(p.id)) { toast('Espere o mangá desta página ficar pronto.'); return; }
    const hasStuff = (p.text || '').trim() || (p.panels || []).length;
    if (hasStuff && !(await confirmBox(`Apagar a página ${E.idx + 1}?`, 'O texto e os quadrinhos desta página vão sumir para sempre.', 'Apagar página'))) return;
    await flush();
    await call('deletePage', p.id);
    await reload();
    paintHead(); paintPage(); rememberPage();
    toast('Página apagada.');
  }
  async function makeManga(p) {
    if (!(p.text || '').trim()) { toast('Escreva a página primeiro.', 'error'); story.focus(); return; }
    if (working.has(p.id)) return;
    if ((p.panels || []).length && !(await confirmBox('Refazer o mangá desta página?', 'A IA vai ler o texto de novo e desenhar quadrinhos novos. Os quadrinhos de agora serão trocados.', 'Refazer', false))) return;
    await flush();
    working.set(p.id, { message: 'Lendo a sua história...', done: 0, total: 0 });
    paintMakeBtn(); paintStage(); paintStrip();
    try {
      const fresh = await call('makeManga', p.id);
      replacePage(fresh);
      const failed = fresh.panels.filter(x => !x.image_file).length;
      if (failed) toast(`${failed === 1 ? 'Um quadrinho não saiu' : `${failed} quadrinhos não saíram`}. Clique nele para tentar de novo.`, 'error', 6000);
      else toast('Página de mangá pronta!', 'good', 3000);
    } catch (e) { /* aviso já mostrado */ }
    finally {
      working.delete(p.id);
      if ($view.contains(stage)) { paintMakeBtn(); paintStage(); paintStrip(); paintHead(); }
    }
  }
  async function describeAndDraw(p, i, text, button) {
    await busy(button, async () => {
      const fresh = await call('redrawPanel', p.id, i, text);
      replacePage(fresh);
      if (page().id === p.id) { paintStage(); paintStrip(); paintHead(); }
      toast('Quadrinho desenhado!', 'good', 2500);
    }, 'Desenhando...');
  }
  async function moveBubble(p, i, key, at) {
    const pos = { ...(p.panels[i].pos || {}), [key]: at };
    p.panels[i].pos = pos;
    replacePage(await call('updatePanel', p.id, i, { pos }));
  }
  function editPanel(p, i) {
    const panel = p.panels[i];
    const own = el('textarea', { class: 'textarea small', id: 'pn-own', maxlength: 400, value: panel.user_desc || '',
      placeholder: 'Opcional. Ex.: o Larry de costas olhando a cidade à noite' });
    const cap = el('textarea', { class: 'textarea small', id: 'pn-cap', maxlength: 140, value: panel.narration || '' });
    const d1 = el('input', { class: 'input', id: 'pn-d1', maxlength: 110, value: (panel.dialogue || [])[0] || '' });
    const d2 = el('input', { class: 'input', id: 'pn-d2', maxlength: 110, value: (panel.dialogue || [])[1] || '' });
    const sfx = el('input', { class: 'input', id: 'pn-sfx', maxlength: 16, value: panel.sfx || '', placeholder: 'Ex.: BUM!' });
    const preview = el('div', { class: 'panel-preview' }, panel.image_file ? el('img', { src: imgSrc(panel.image_file), alt: '' }) : el('span', { text: panel.error || 'Sem desenho' }));
    const m = openModal({
      title: `Quadrinho ${i + 1}`, wide: true,
      body: el('div', { class: 'panel-modal' }, preview, el('div', { class: 'col' },
        el('label', { class: 'field' }, el('span', { text: 'Narração (caixinha)' }), cap),
        el('label', { class: 'field' }, el('span', { text: 'Fala 1 (balão)' }), d1),
        el('label', { class: 'field' }, el('span', { text: 'Fala 2 (balão)' }), d2),
        el('label', { class: 'field' }, el('span', { text: 'Som (onomatopeia)' }), sfx),
        el('label', { class: 'field' }, el('span', { text: 'Quer o desenho diferente? Descreva do seu jeito' }), own))),
      actions: [
        panel.pos && Object.keys(panel.pos).length ? { label: 'Balões no lugar original', kind: 'btn-ghost', onClick: async () => {
          replacePage(await call('updatePanel', p.id, i, { pos: null }));
          if (page().id === p.id) paintStage();
        } } : null,
        { label: 'Desenhar de novo', kind: 'btn-magic', icon: 'redo', close: false, onClick: async ev => {
          const b = ev.currentTarget;
          await busy(b, async () => {
            const fresh = await call('redrawPanel', p.id, i, own.value.trim());
            replacePage(fresh);
            const np = E.book.pages.find(x => x.id === p.id);
            preview.replaceChildren(np.panels[i].image_file ? el('img', { src: imgSrc(np.panels[i].image_file), alt: '' }) : el('span', { text: 'Sem desenho' }));
            Object.assign(p, np);
            if (page().id === p.id) { paintStage(); paintStrip(); }
            toast('Quadrinho redesenhado!', 'good', 2500);
          }, 'Desenhando...');
        } },
        { label: 'Salvar textos', kind: 'btn-primary', icon: 'check', onClick: async () => {
          const fresh = await call('updatePanel', p.id, i, {
            narration: cap.value.trim(), dialogue: [d1.value.trim(), d2.value.trim()].filter(Boolean), sfx: sfx.value.trim()
          });
          replacePage(fresh);
          if (page().id === p.id) paintStage();
        } }
      ]
    });
    return m;
  }
  async function spelling() {
    const p = page();
    const original = story.value;
    if (!original.trim()) { toast('Escreva alguma coisa primeiro.'); return; }
    await flush();
    const fixed = await call('spelling', original);
    if (fixed.trim() === original.trim()) { toast('Nenhum erro encontrado. Mandou bem!', 'good'); return; }
    const [a, b] = diffViews(original, fixed);
    openModal({
      title: 'Correção de ortografia', wide: true,
      body: [
        el('p', { text: 'Em amarelo, o que o corretor mudou. Nenhuma ideia sua foi trocada, só a escrita.' }),
        el('div', { class: 'compare' }, a, b)
      ],
      actions: [
        { label: 'Manter o meu', kind: 'btn-ghost' },
        { label: 'Usar a correção', kind: 'btn-primary', icon: 'check', onClick: () => {
          if (page() !== p) return;
          story.value = fixed; p.text = fixed; queue(p.id, { text: fixed }); flush(); paintMakeBtn();
          toast('Correção aplicada.', 'good');
        } }
      ]
    });
  }
  function editTitle() {
    const input = el('input', { class: 'input', id: 'edit-title', maxlength: 80, value: E.book.title });
    openModal({
      title: 'Nome do mangá', body: input,
      actions: [
        { label: 'Cancelar' },
        { label: 'Salvar', kind: 'btn-primary', onClick: async () => {
          const v = input.value.trim();
          if (!v) { toast('O mangá precisa de um nome.'); return false; }
          const fresh = await call('updateBook', E.book.id, { title: v });
          E.book.title = fresh.title; paintHead();
        } }
      ]
    });
  }
  async function publish() {
    await flush();
    await call('updateBook', E.book.id, { status: 'published' });
    toast('Mangá publicado! Ele já está na estante.', 'good', 5000);
    go('reader', { id: E.book.id });
  }

  // ----- montagem -----
  const banner = !E.book.hero_ref ? el('div', { class: 'banner' },
    el('span', { text: `Antes de desenhar, escolha a cara do ${E.book.hero_name}. Assim ele sai igual em todos os quadrinhos.` }),
    btn('Escolher agora', 'btn-primary', () => go('hero', { id: E.book.id }), 'user')) : null;
  $view.append(el('div', { class: 'wrap' },
    head,
    banner,
    el('div', { class: 'ed-grid' },
      el('div', { class: 'col' }, writeCard),
      el('div', { class: 'col' }, stage, pager, pageTools)),
    el('div', { class: 'field' }, el('h2', { class: 'section', text: 'Todas as páginas' }), strip)));
  paintHead();
  paintPage();
  story.setSelectionRange(story.value.length, story.value.length);
  story.focus({ preventScroll: true });
  $view.scrollTop = 0;
}

// diferença palavra por palavra entre o texto original e o corrigido
function diffViews(a, b) {
  const ta = a.split(/(\s+)/), tb = b.split(/(\s+)/);
  const n = ta.length, m = tb.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    L[i][j] = ta[i] === tb[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const left = el('div'), right = el('div');
  let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && ta[i] === tb[j]) { left.append(ta[i]); right.append(tb[j]); i++; j++; }
    else if (j < m && (i >= n || L[i][j + 1] >= L[i + 1][j])) { right.append(/^\s+$/.test(tb[j]) ? tb[j] : el('mark', { text: tb[j] })); j++; }
    else { left.append(/^\s+$/.test(ta[i]) ? ta[i] : el('del', { text: ta[i] })); i++; }
  }
  return [
    el('div', { class: 'diff-col' }, el('div', { class: 'label', text: 'O seu texto' }), left),
    el('div', { class: 'diff-col' }, el('div', { class: 'label', text: 'Com a correção' }), right)
  ];
}

// ======================================================================
// LEITOR
// ======================================================================
async function renderReader(id, at) {
  const book = await call('getBook', id);
  const pages = book.pages;
  const total = pages.length + 1;
  let idx = Math.min(Math.max(0, at), total - 1);

  const stage = el('div', { class: 'reader-stage' });
  const count = el('span', { class: 'count' });
  const prev = el('button', { type: 'button', class: 'round', 'aria-label': 'Voltar página', onClick: () => show(idx - 1) });
  prev.innerHTML = ICON.left;
  const next = el('button', { type: 'button', class: 'round', 'aria-label': 'Passar página', onClick: () => show(idx + 1) });
  next.innerHTML = ICON.right;

  function show(i) {
    if (i < 0 || i >= total) return;
    idx = i;
    if (idx === 0) {
      stage.replaceChildren(coverSheet(book));
      count.textContent = 'Capa';
    } else {
      const p = pages[idx - 1];
      stage.replaceChildren((p.panels || []).length
        ? mangaPage(p, book.style, { number: idx })
        : el('div', { class: 'manga-empty' }, el('b', { text: 'Esta página ainda não virou mangá' }), el('span', { text: p.text || '' })));
      count.textContent = `Página ${idx} de ${total - 1}`;
    }
    prev.disabled = idx === 0;
    next.disabled = idx === total - 1;
  }
  const onKey = e => {
    if (document.querySelector('.modal-back')) return;
    if (e.key === 'ArrowRight') show(idx + 1);
    if (e.key === 'ArrowLeft') show(idx - 1);
  };
  document.addEventListener('keydown', onKey);
  S.cleanup.push(() => document.removeEventListener('keydown', onKey));

  const pdfBtn = btn('Salvar em PDF', 'btn-ghost', null, 'pdf');
  pdfBtn.addEventListener('click', () => busy(pdfBtn, async () => {
    const holder = el('div');
    holder.append(el('section', { class: 'sheet' }, coverSheet(book)));
    pages.forEach((p, i) => {
      if ((p.panels || []).length) holder.append(el('section', { class: 'sheet' }, mangaPage(p, book.style, { number: i + 1 })));
    });
    const r = await call('exportPdf', book.id, holder.innerHTML);
    if (r.saved) toast('PDF salvo! Ele já abriu para você ver.', 'good');
  }, 'Montando o PDF...'));

  $view.append(el('div', { class: 'wrap reader' },
    el('div', { class: 'reader-head' },
      el('div', { class: 'row' }, btn('Biblioteca', 'btn-ghost', () => go('library'), 'back'), el('h1', { class: 'display', text: book.title })),
      el('div', { class: 'row' }, pdfBtn, btn(book.status === 'published' ? 'Editar' : 'Continuar escrevendo', 'btn-primary', () => go('editor', { id: book.id }), 'pen'))),
    el('div', { class: 'reader-nav' }, prev, count, next),
    stage));
  show(idx);
}

// ======================================================================
// ÁREA DOS PAIS
// ======================================================================
async function openParents() {
  const st = await call('getSettings');
  if (!st.has_pin) return go('settings');
  const pin = el('input', { class: 'input pin-input', id: 'pin-check', type: 'password', inputmode: 'numeric', maxlength: 8, autocomplete: 'off' });
  const m = openModal({
    title: 'Área dos pais', body: [el('p', { text: 'Digite a senha dos pais.' }), pin],
    actions: [
      { label: 'Cancelar' },
      { label: 'Entrar', kind: 'btn-primary', onClick: async () => {
        if (await call('checkPin', pin.value)) { go('settings'); return; }
        toast('Senha errada.', 'error'); pin.value = ''; pin.focus(); return false;
      } }
    ]
  });
  pin.addEventListener('keydown', e => { if (e.key === 'Enter') m.box.querySelector('.modal-foot .btn:last-child').click(); });
}

async function renderSettings() {
  let st = await call('getSettings');
  const wrap = el('div', { class: 'settings' });

  const status = el('span');
  const paintStatus = (kind, text) => { status.className = `pill ${kind}`; status.textContent = text; };
  paintStatus(st.ai_ready ? 'ok' : 'warn', st.ai_ready ? 'Configurada' : 'Não configurada');
  const acc = el('input', { class: 'input', id: 'cf-acc', value: st.cf_account_id, placeholder: 'Ex.: 3f2a9c...', autocomplete: 'off', spellcheck: 'false' });
  const tok = el('input', { class: 'input', id: 'cf-tok', type: 'password', placeholder: st.has_token ? 'Token já salvo. Deixe vazio para manter.' : 'Cole o token aqui', autocomplete: 'off', spellcheck: 'false' });
  const testBtn = btn('Testar', 'btn-ghost', null, 'check');
  testBtn.addEventListener('click', () => busy(testBtn, async () => {
    const r = await callQuiet('testAi', { cf_account_id: acc.value, cf_token: tok.value });
    if (r.ok) paintStatus('ok', 'Funcionando!');
    else paintStatus('err', r.error);
  }, 'Testando...'));
  const saveAi = btn('Salvar', 'btn-primary', null, 'check');
  saveAi.addEventListener('click', () => busy(saveAi, async () => {
    st = await call('saveSettings', { cf_account_id: acc.value, cf_token: tok.value });
    tok.value = ''; tok.placeholder = st.has_token ? 'Token já salvo. Deixe vazio para manter.' : 'Cole o token aqui';
    paintStatus(st.ai_ready ? 'ok' : 'warn', st.ai_ready ? 'Configurada' : 'Não configurada');
    toast('Configuração salva.', 'good');
  }, 'Salvando...'));

  const guide = el('ol', { class: 'guide' },
    el('li', {}, 'Entre em ', el('code', { text: 'dash.cloudflare.com' }), ' e crie uma conta grátis (ou faça login).'),
    el('li', {}, 'O ', el('b', { text: 'ID da conta' }), ' aparece no endereço da página, logo depois de ', el('code', { text: 'dash.cloudflare.com/' }), '. É um código de 32 letras e números.'),
    el('li', {}, 'Para o ', el('b', { text: 'token' }), ': vá em Meu perfil, ', el('code', { text: 'Tokens de API' }), ', clique em ', el('b', { text: 'Criar token' }), ', use o modelo ', el('b', { text: 'IA para trabalhadores (Workers AI)' }), ', confirme e copie o código.'),
    el('li', {}, 'Cole os dois aqui, aperte ', el('b', { text: 'Testar' }), ' e depois ', el('b', { text: 'Salvar' }), '.'));

  wrap.append(el('div', { class: 'lib-head' },
    el('div', { class: 'field' }, el('h1', { class: 'display', text: 'Área dos pais' }), el('p', { class: 'lead', text: 'Configurações da IA, senha e onde ficam guardados os livros.' })),
    btn('Voltar', 'btn-ghost', () => go('library'), 'back')));

  wrap.append(el('section', { class: 'card set-card' },
    el('h2', {}, 'IA da Cloudflare (grátis)', status),
    el('p', { class: 'hint', text: 'A Cloudflare dá uma cota diária gratuita. Dá para umas 40 páginas de mangá por dia. Quando a cota acaba, ela volta no dia seguinte, sem cobrar nada.' }),
    guide,
    el('div', { class: 'two' },
      el('label', { class: 'field' }, el('span', { text: 'ID da conta' }), acc),
      el('label', { class: 'field' }, el('span', { text: 'Token da API' }), tok)),
    el('div', { class: 'row' }, testBtn, saveAi)));

  const pin1 = el('input', { class: 'input', id: 'pin1', type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: 'Nova senha (4 a 8 números)', autocomplete: 'off' });
  const pin2 = el('input', { class: 'input', id: 'pin2', type: 'password', inputmode: 'numeric', maxlength: 8, placeholder: 'Repita a senha', autocomplete: 'off' });
  const pinRow = el('div', { class: 'row' });
  const paintPin = () => {
    pinRow.replaceChildren(
      btn(st.has_pin ? 'Trocar senha' : 'Criar senha', 'btn-primary', async () => {
        if (!/^\d{4,8}$/.test(pin1.value)) { toast('Use de 4 a 8 números.', 'error'); return; }
        if (pin1.value !== pin2.value) { toast('As duas senhas estão diferentes.', 'error'); return; }
        st = await call('saveSettings', { new_pin: pin1.value });
        pin1.value = pin2.value = '';
        toast('Senha dos pais salva.', 'good'); paintPin();
      }, 'check'),
      st.has_pin ? btn('Remover senha', 'btn-danger', async () => {
        st = await call('saveSettings', { new_pin: '' });
        toast('Senha removida.'); paintPin();
      }) : null);
  };
  paintPin();
  wrap.append(el('section', { class: 'card set-card' },
    el('h2', { text: 'Senha dos pais' }),
    el('p', { class: 'hint', text: 'Protege esta área para o token da IA não ser alterado sem querer.' }),
    el('div', { class: 'two' }, pin1, pin2),
    pinRow));

  wrap.append(el('section', { class: 'card set-card' },
    el('h2', { text: 'Onde ficam os livros' }),
    el('p', { class: 'hint', text: 'Tudo fica salvo neste computador: o banco de dados, os desenhos e uma cópia de segurança por dia (as últimas 14).' }),
    el('div', { class: 'row' }, btn('Abrir pasta dos livros', 'btn-ghost', () => call('openDataFolder'), 'folder'))));

  $view.append(el('div', { class: 'wrap' }, wrap));
}

go('library');

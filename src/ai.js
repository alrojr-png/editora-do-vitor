// Conversa com a IA da Cloudflare Workers AI (cota grátis diária).
// - Llama: lê a página escrita pelo Vítor e monta o roteiro dos quadrinhos; corrige ortografia.
// - FLUX.2 klein: desenha cada quadrinho usando o personagem escolhido como imagem de referência.
// - FLUX.1 schnell: desenhista reserva se o klein falhar.
const TEXT_MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
const KLEIN = '@cf/black-forest-labs/flux-2-klein-4b';
const SCHNELL = '@cf/black-forest-labs/flux-1-schnell';

const STYLES = {
  manga_pb: 'black and white Japanese manga art, bold clean ink lines, screentone shading, high contrast',
  manga_cor: 'colored anime manga art, cel shading, vibrant colors, clean ink line art',
  aquarela: "storybook comic art, detailed ink outlines with soft watercolor painting",
  gibi: 'cartoon comic book art, bold outlines, flat vivid colors'
};

// Tamanho de cada formato de quadrinho (múltiplos de 512 gastam menos da cota).
const SHAPES = {
  wide: { w: 768, h: 512, hint: 'wide horizontal panel composition' },
  tall: { w: 512, h: 768, hint: 'tall vertical panel composition' },
  splash: { w: 768, h: 1024, hint: 'full page splash panel, dramatic composition' }
};
// Formatos por quantidade de quadrinhos na página (o desenho da página fica no renderer).
const LAYOUTS = { 1: ['splash'], 2: ['wide', 'wide'], 3: ['wide', 'tall', 'tall'], 4: ['tall', 'tall', 'tall', 'tall'] };

class FriendlyError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

function hasCloudflare(s) { return Boolean(s.cf_account_id && s.cf_token); }

// Os filtros de segurança barram personagens descritos como crianças; para a IA todos são "jovens".
function safeWords(text) {
  return String(text || '')
    .replace(/\b(little |young )?(boy|girl|kid|child)s?\b/gi, 'young character')
    .replace(/\bchildren\b/gi, 'young characters');
}

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); }
  finally { clearTimeout(timer); }
}

async function cfFetch(s, model, body, headers, timeoutMs) {
  if (!hasCloudflare(s)) throw new FriendlyError('A IA ainda não foi configurada. Peça para um adulto abrir a Área dos pais.', 'config');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(s.cf_account_id.trim())}/ai/run/${model}`;
  let res;
  try {
    res = await withTimeout(timeoutMs, signal => fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.cf_token.trim()}`, ...headers },
      body,
      signal
    }));
  } catch (e) {
    throw new FriendlyError('Sem conexão com a internet, ou a IA demorou demais para responder.', 'network');
  }
  let json = null;
  try { json = await res.json(); } catch (e) { /* resposta sem JSON */ }
  if (res.ok && json && json.success !== false) return json.result ?? json;

  const msg = JSON.stringify(json?.errors || json || res.status).toLowerCase();
  if (res.status === 401 || res.status === 403 || msg.includes('authentication') || msg.includes('unauthorized')) {
    throw new FriendlyError('A senha da IA (token da Cloudflare) não foi aceita. Peça para um adulto conferir na Área dos pais.', 'auth');
  }
  if (res.status === 429 || msg.includes('allocation') || msg.includes('neurons') || msg.includes('rate limit')) {
    throw new FriendlyError('A tinta mágica de hoje acabou! Amanhã ela enche de novo.', 'quota');
  }
  if (msg.includes('flagged') || msg.includes('nsfw') || msg.includes('"code":3030')) {
    throw new FriendlyError('A IA achou que esse desenho não combina com um livro infantil. Tente contar a cena de outro jeito.', 'safety');
  }
  const err = new FriendlyError(`A IA respondeu com um erro (${res.status}). Tente de novo daqui a pouco.`, 'server');
  err.detail = msg.slice(0, 300);
  throw err;
}

const cfJson = (s, model, body, timeoutMs = 90000) =>
  cfFetch(s, model, JSON.stringify(body), { 'Content-Type': 'application/json' }, timeoutMs);

// ---------- texto ----------
async function chat(s, system, user, maxTokens = 600, extra = {}) {
  let lastErr;
  for (const model of TEXT_MODELS) {
    try {
      const r = await cfJson(s, model, {
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: maxTokens,
        temperature: 0.4,
        ...extra
      }, 60000);
      const out = typeof r.response === 'string' ? r.response : JSON.stringify(r.response ?? '');
      if (out.trim()) return out.trim();
    } catch (e) {
      lastErr = e;
      if (['auth', 'config', 'quota'].includes(e.kind)) throw e;
    }
  }
  throw lastErr || new FriendlyError('A IA de texto não respondeu.', 'server');
}

function clean(s) { return String(s || '').replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim(); }

async function heroToEnglish(s, name, descPt) {
  if (!String(descPt || '').trim()) return '';
  const out = await chat(s,
    'Convert a Portuguese description of a story character into a concise English visual description for an image generator. ' +
    'Max 45 words. Include body/species, hair, face, clothing with colors and accessories. ' +
    'Keep every visual detail the author gave and invent nothing important. Never mention what is missing or not described. ' +
    'Never use the words boy, girl, kid or child; for young characters write "young hero" or "young character". ' +
    'Output only the description, no preamble.',
    `Character name: ${name}\nDescription (Portuguese): ${descPt}`, 200);
  return safeWords(clean(out));
}

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    panels: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scene: { type: 'string' },
          hero: { type: 'boolean' },
          narration: { type: 'string' },
          dialogue: { type: 'array', items: { type: 'string' } },
          sfx: { type: 'string' }
        },
        required: ['scene', 'hero', 'narration', 'dialogue', 'sfx']
      }
    }
  },
  required: ['panels']
};

const PLAN_SYSTEM = [
  'You are a manga storyboard artist adapting ONE page written in Portuguese by a 10-year-old Brazilian author into manga panels.',
  'Rules:',
  '1. Use 2 panels for short pages (1-3 sentences), 3 for medium pages, 4 only for long pages with many events. Panels follow the text in order.',
  '2. Adapt only what the text says. Do not invent new events.',
  '3. scene (English, 25-45 words): a vivid image prompt with the action, pose, facial expression, the setting with background details, other characters with their looks, and a camera angle (close-up, wide shot, low angle, over the shoulder). ' +
    'Call the protagonist "the main character" and do not describe their looks. Never use the words boy, girl, kid or child. Child-friendly: cartoon action is fine, no blood or gore. No text or speech balloons in the picture.',
  '4. hero: true if the main character is visible.',
  '5. narration (Portuguese): the narrator sentences of the text that belong to THIS panel, copied with the author\'s words (max 110 characters), or "".',
  '6. dialogue (Portuguese): what characters say in THIS panel. Copy speech from the text exactly, without quotes or names. If the text has no speech, you may add one very short natural line. Max 2 lines.',
  '7. sfx: a Portuguese manga sound effect for impacts or fast actions ("BUM!", "ZÁS!", "CRASH!", "VRUUM!", "PAF!"), or "".',
  '8. Every sentence of the page must appear in some panel as narration or dialogue, in order.',
  'Example for the page "O dragão acordou e cuspiu fogo na vila. Ana pegou o escudo e gritou: Para com isso!":',
  '{"panels":[{"scene":"Wide shot of a medieval village at dawn, a huge green dragon wakes up on a hill and breathes a stream of fire toward thatched roofs, villagers running away","hero":false,"narration":"O dragão acordou e cuspiu fogo na vila.","dialogue":[],"sfx":"FUUUSH!"},' +
    '{"scene":"Low angle shot of the main character raising a round wooden shield against the fire, determined angry expression, sparks and smoke all around","hero":true,"narration":"Ana pegou o escudo e gritou:","dialogue":["Para com isso!"],"sfx":""}]}',
  'Reply with JSON only.'
].join('\n');

function parsePlan(out) {
  let obj = out;
  if (typeof out === 'string') {
    const start = out.indexOf('{'), end = out.lastIndexOf('}');
    if (start < 0 || end < start) return null;
    try { obj = JSON.parse(out.slice(start, end + 1)); } catch (e) { return null; }
  }
  const panels = Array.isArray(obj?.panels) ? obj.panels : null;
  if (!panels || !panels.length) return null;
  return panels.slice(0, 4).map(p => ({
    scene: safeWords(clean(p.scene)).slice(0, 400) || 'the main character in the scene',
    hero: p.hero !== false,
    narration: clean(p.narration).slice(0, 140),
    dialogue: (Array.isArray(p.dialogue) ? p.dialogue : [p.dialogue]).map(clean).filter(Boolean).slice(0, 2).map(d => d.replace(/^[-–—]\s*/, '').slice(0, 110)),
    sfx: clean(p.sfx).slice(0, 16)
  }));
}

async function planPage(s, book, text, prevText) {
  const user =
    `Main character: ${book.hero_name || 'the hero'}\n` +
    (prevText ? `Previous page (context only, do not adapt it): ${prevText.slice(-500)}\n` : '') +
    `Page to adapt:\n${text.slice(0, 2500)}`;
  let plan = parsePlan(await chat(s, PLAN_SYSTEM, user, 1600));
  if (!plan) {
    // Segunda tentativa com o modo JSON da Cloudflare, que garante o formato (mas escreve cenas mais curtas).
    try { plan = parsePlan(await chat(s, PLAN_SYSTEM, user, 1600, { response_format: { type: 'json_schema', json_schema: PLAN_SCHEMA } })); }
    catch (e) { if (['auth', 'config', 'quota'].includes(e.kind)) throw e; }
  }
  if (!plan) throw new FriendlyError('A IA se confundiu com essa página. Aperte de novo.', 'server');
  return plan;
}

// ---------- desenho ----------
async function klein(s, prompt, w, h, ref) {
  const fd = new FormData();
  fd.append('prompt', prompt.slice(0, 2000));
  fd.append('width', String(w));
  fd.append('height', String(h));
  if (ref) fd.append('input_image_0', new Blob([ref], { type: 'image/jpeg' }), 'personagem.jpg');
  const r = await cfFetch(s, KLEIN, fd, {}, 120000);
  if (!r.image) throw new FriendlyError('A IA não devolveu o desenho. Tente de novo.', 'server');
  return Buffer.from(r.image, 'base64');
}
async function schnell(s, prompt) {
  const r = await cfJson(s, SCHNELL, { prompt: prompt.slice(0, 2000), steps: 4 }, 120000);
  if (!r.image) throw new FriendlyError('A IA não devolveu o desenho. Tente de novo.', 'server');
  return Buffer.from(r.image, 'base64');
}

// O filtro de segurança do klein barra quase todo rosto em estilo anime (testado em 2026-10-16),
// então mangá vai direto para o schnell (sem imagem de referência, só a descrição detalhada).
// Gibi e aquarela usam o klein com o personagem escolhido como referência.
const usesKlein = style => style === 'gibi' || style === 'aquarela';

async function draw(s, prompt, shape, ref, style) {
  if (!usesKlein(style)) return schnell(s, `${prompt} Subject centered in the frame.`);
  const { w, h } = SHAPES[shape] || SHAPES.wide;
  try {
    return await klein(s, prompt, w, h, ref);
  } catch (e) {
    if (!['safety', 'server', 'network'].includes(e.kind)) throw e;
    return schnell(s, prompt);
  }
}

// Uma IA que enxerga descreve o personagem escolhido, para o desenhista repetir as mesmas roupas e cores.
async function describeHero(s, image) {
  const r = await cfJson(s, '@cf/mistralai/mistral-small-3.1-24b-instruct', {
    messages: [{ role: 'user', content: [
      { type: 'text', text: 'Describe this character for an image generator so it can be drawn again identically: body type, hair (style, color), face, every clothing item with its colors, accessories. One paragraph, max 60 words, no preamble. Do not mention the background or the art style. Never use the words boy, girl, kid or child.' },
      { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` } }
    ] }],
    max_tokens: 220
  }, 60000);
  const text = r.response ?? r.choices?.[0]?.message?.content ?? r.description ?? '';
  return safeWords(clean(typeof text === 'string' ? text : JSON.stringify(text)));
}

function heroLine(book) {
  const hero = book.hero_prompt_en || safeWords(book.hero_desc);
  return hero ? `${book.hero_name || 'The main character'}: ${hero}` : (book.hero_name || 'the hero');
}

function panelPrompt(book, panel, shape, hasRef) {
  const style = STYLES[book.style] || STYLES.manga_pb;
  const who = panel.hero
    ? (hasRef
      ? ` The main character is exactly the character from the reference image (same face, hair, clothes and colors). ${heroLine(book)}.`
      : ` The main character, always drawn the same way: ${heroLine(book)}.`)
    : '';
  return `Manga panel, ${style}, ${SHAPES[shape].hint}. ${panel.scene}.${who} No text, no letters, no speech balloons.`;
}

async function drawPanel(s, book, panel, shape, ref) {
  const hasRef = Boolean(ref && panel.hero && usesKlein(book.style));
  return draw(s, panelPrompt(book, panel, shape, hasRef), shape, hasRef ? ref : null, book.style);
}

async function heroOptions(s, book) {
  const style = STYLES[book.style] || STYLES.manga_pb;
  const base = `Character design of one single character, full body, front view, standing in a confident pose, plain white background, ${style}, no text. Character ${heroLine(book)}.`;
  const variants = [
    `${base} Classic heroic design.`,
    `${base} A different take on the same description, with a distinct hairstyle and outfit details.`
  ];
  const results = await Promise.allSettled(variants.map(p => draw(s, p, 'tall', null, book.style)));
  const images = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  if (!images.length) throw results[0].reason;
  return images;
}

async function fixSpelling(s, text) {
  if (!hasCloudflare(s)) throw new FriendlyError('O corretor precisa da IA configurada na Área dos pais.', 'config');
  return (await chat(s,
    'Você é um revisor de textos. Corrija SOMENTE erros de ortografia, acentuação, letras maiúsculas e pontuação de um texto em português do Brasil escrito por uma criança de 10 anos. ' +
    'Não troque palavras por sinônimos, não mude o estilo, não acrescente nem remova frases e mantenha as quebras de linha. ' +
    'Responda apenas com o texto corrigido, sem aspas e sem comentários.',
    text, Math.min(2000, Math.ceil(text.length / 2) + 200))).replace(/^["“]|["”]$/g, '');
}

async function testConnection(s) {
  return Boolean(await chat(s, 'Responda apenas: ok', 'teste', 10));
}

module.exports = { planPage, drawPanel, heroOptions, describeHero, heroToEnglish, fixSpelling, testConnection, hasCloudflare, FriendlyError, LAYOUTS, STYLES };

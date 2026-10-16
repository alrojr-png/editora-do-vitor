// Conversa com as IAs: Cloudflare Workers AI (cota grátis diária) e Pollinations como reserva.
const CF_TEXT_MODELS = ['@cf/meta/llama-3.3-70b-instruct-fp8-fast', '@cf/meta/llama-3.1-8b-instruct'];
const DEFAULT_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';

const STYLES = {
  manga_pb: 'black and white Japanese manga illustration, bold clean ink lines, screentone shading, dramatic manga panel composition, monochrome, high contrast, detailed manga art',
  manga_cor: 'colorful anime manga illustration, cel shading, vibrant colors, clean line art, dynamic anime composition',
  aquarela: "children's storybook illustration, detailed ink outlines with soft watercolor painting, warm light",
  gibi: 'cartoon comic book illustration, bold outlines, flat vivid colors, fun expressive characters'
};

class FriendlyError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

function hasCloudflare(s) { return Boolean(s.cf_account_id && s.cf_token); }

async function withTimeout(ms, fn) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fn(ctrl.signal); }
  finally { clearTimeout(timer); }
}

async function cfRun(s, model, body, timeoutMs = 90000) {
  if (!hasCloudflare(s)) throw new FriendlyError('A IA ainda não foi configurada. Peça para um adulto abrir a Área dos pais.', 'config');
  const url = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(s.cf_account_id.trim())}/ai/run/${model}`;
  let res;
  try {
    res = await withTimeout(timeoutMs, signal => fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${s.cf_token.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
  if (msg.includes('nsfw') || msg.includes('safety') || msg.includes('flagged')) {
    throw new FriendlyError('A IA não quis desenhar essa cena. Tente descrever de outro jeito.', 'safety');
  }
  throw new FriendlyError(`A IA respondeu com um erro (${res.status}). Tente de novo daqui a pouco.`, 'server');
}

async function chat(s, system, user, maxTokens = 600) {
  let lastErr;
  for (const model of CF_TEXT_MODELS) {
    try {
      const r = await cfRun(s, model, {
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
        max_tokens: maxTokens,
        temperature: 0.3
      }, 60000);
      const out = typeof r.response === 'string' ? r.response : JSON.stringify(r.response ?? '');
      if (out.trim()) return out.trim();
    } catch (e) {
      lastErr = e;
      if (e.kind === 'auth' || e.kind === 'config' || e.kind === 'quota') throw e;
    }
  }
  throw lastErr || new FriendlyError('A IA de texto não respondeu.', 'server');
}

function clean(s) { return String(s || '').replace(/^["'\s]+|["'\s]+$/g, '').replace(/\s+/g, ' ').trim(); }

async function heroToEnglish(s, name, descPt) {
  if (!descPt.trim()) return '';
  const out = await chat(s,
    'Convert a Portuguese description of a story character into a concise English visual description for an image generator. ' +
    'Max 45 words. Include body/species, apparent age, hair, face, clothing with colors and accessories. ' +
    'Keep every visual detail the author gave and invent nothing important. Never mention what is missing or not described. ' +
    'Output only the description, no preamble.',
    `Character name: ${name}\nDescription (Portuguese): ${descPt}`, 200);
  return clean(out);
}

async function scenePrompt(s, book, page, prevText) {
  return clean(await chat(s,
    'You turn one page of a children\'s story into ONE prompt for an illustration. The author is a 10-year-old Brazilian kid and writes in Portuguese. ' +
    'Write in English, max 60 words, describing only what is visible: the main character\'s action, pose and expression, the setting, other characters, lighting and camera angle. ' +
    'Do not describe the main character\'s looks (that is added separately); call them "the main character". ' +
    'Keep it suitable for children: cartoon action and fantasy battles are fine, but soften blood, gore, injuries or nudity. ' +
    'Do not ask for text, letters or speech balloons. Output only the prompt.',
    `Main character name: ${book.hero_name || 'the hero'}\n` +
    (prevText ? `Previous page (context only): ${prevText.slice(-600)}\n` : '') +
    `This page's story text: ${(page.text || '').slice(0, 1500) || '(empty)'}\n` +
    `What the main character does in this picture: ${page.action || '(not specified, pick the key moment of the page)'}`, 220));
}

function finalPrompt(book, scene) {
  const hero = book.hero_prompt_en || book.hero_desc;
  const heroPart = hero ? ` The main character, ${book.hero_name || 'the hero'}, looks like this: ${hero}.` : '';
  return `${scene}.${heroPart} Style: ${STYLES[book.style] || STYLES.manga_pb}.`.slice(0, 2000);
}

function fallbackScene(book, page) {
  // Sem IA de texto: usa as palavras do próprio Vítor.
  return clean(`${page.action || ''} ${(page.text || '').slice(0, 400)}`) || `${book.hero_name} in an adventure`;
}

async function cfImage(s, prompt, seed) {
  const model = s.cf_image_model || DEFAULT_IMAGE_MODEL;
  const steps = Math.min(8, Math.max(1, parseInt(s.cf_steps || '4', 10) || 4));
  // O flux-1-schnell da Cloudflare recusa o campo "seed" (erro 5006); a consistência vem da ficha do herói.
  const body = model === DEFAULT_IMAGE_MODEL ? { prompt, steps } : { prompt, steps, seed };
  const r = await cfRun(s, model, body, 120000);
  const b64 = r.image || r.result?.image;
  if (!b64) throw new FriendlyError('A IA não devolveu a imagem. Tente de novo.', 'server');
  return Buffer.from(b64, 'base64');
}

async function pollinationsImage(prompt, seed) {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt.slice(0, 1500))}` +
    `?width=1024&height=1024&seed=${seed}&nologo=true&safe=true&model=flux`;
  let res;
  try {
    res = await withTimeout(150000, signal => fetch(url, { signal }));
  } catch (e) {
    throw new FriendlyError('O desenhista reserva demorou demais. Tente de novo.', 'network');
  }
  const type = res.headers.get('content-type') || '';
  if (res.status === 402 || res.status === 429) throw new FriendlyError('O desenhista reserva só faz 1 desenho por minuto. Espere um pouquinho e tente de novo.', 'quota');
  if (!res.ok || !type.startsWith('image/')) throw new FriendlyError('O desenhista reserva está ocupado agora. Tente daqui a pouco.', 'server');
  return { buffer: Buffer.from(await res.arrayBuffer()), ext: type.includes('png') ? 'png' : 'jpg' };
}

async function generateImage(s, book, page, prevText) {
  let scene;
  if (hasCloudflare(s)) {
    try { scene = await scenePrompt(s, book, page, prevText); }
    catch (e) { if (e.kind === 'auth') throw e; scene = fallbackScene(book, page); }
  } else {
    scene = fallbackScene(book, page);
  }
  const prompt = finalPrompt(book, scene);
  const usePoll = s.use_pollinations === '1';

  if (hasCloudflare(s)) {
    let err;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { return { buffer: await cfImage(s, prompt, book.seed), ext: 'jpg', prompt, source: 'cloudflare' }; }
      catch (e) {
        err = e;
        if (['auth', 'quota', 'config', 'safety'].includes(e.kind)) break;
      }
    }
    if (!usePoll || err.kind === 'auth' || err.kind === 'safety') throw err;
  } else if (!usePoll) {
    throw new FriendlyError('A IA ainda não foi configurada. Peça para um adulto abrir a Área dos pais.', 'config');
  }
  const img = await pollinationsImage(prompt, book.seed);
  return { ...img, prompt, source: 'pollinations' };
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
  const out = await chat(s, 'Responda apenas: ok', 'teste', 10);
  return Boolean(out);
}

module.exports = { generateImage, fixSpelling, heroToEnglish, testConnection, hasCloudflare, FriendlyError, STYLES };

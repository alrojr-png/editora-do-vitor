// Teste rápido: banco + desenho pelo desenhista reserva (sem conta).
const path = require('path');
const { Store } = require('../src/db');
const ai = require('../src/ai');
(async () => {
  const dir = process.argv[2];
  const s = new Store(); await s.init(dir);
  const id = s.createBook({ title: 'O Cão-Herói de Neo-Tóquio', hero_name: 'Rex', hero_desc: 'metade homem, metade cachorro, orelhas pontudas, pelo marrom, capa vermelha, tênis azul', style: 'manga_pb' });
  const book = s.getBook(id);
  const p = book.pages[0];
  s.updatePage(p.id, { text: 'Rex estava patrulhando a cidade quando ouviu um grito vindo da padaria. Ele farejou o ar e sentiu cheiro de encrenca.', action: 'Rex correndo pelos telhados com a capa voando' });
  const p2 = s.getPage(s.addPage(id));
  s.updatePage(p2.id, { text: 'Era o vilão Gato Sombrio roubando todos os pães de queijo!' });
  const t = Date.now();
  const img = await ai.generateImage({ use_pollinations: '1' }, s.getBook(id), s.getPage(p.id), '');
  const rel = s.saveImage(id, p.id, img.buffer, img.ext);
  s.setPageImage(p.id, rel, img.prompt);
  console.log('ok', img.source, img.buffer.length, 'bytes', ((Date.now() - t) / 1000).toFixed(1) + 's');
  console.log('prompt:', img.prompt);
  console.log(JSON.stringify(s.listBooks(), null, 1));
})().catch(e => { console.error('FALHOU', e.message, e.kind); process.exit(1); });

// Banco de dados SQLite (sql.js) gravado em um arquivo no computador.
// Toda alteração é salva no disco logo em seguida, com escrita atômica e cópias de segurança diárias.
const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  hero_name TEXT NOT NULL DEFAULT '',
  hero_desc TEXT NOT NULL DEFAULT '',
  hero_prompt_en TEXT NOT NULL DEFAULT '',
  style TEXT NOT NULL DEFAULT 'manga_pb',
  seed INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'draft',
  current_page INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  text TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  image_file TEXT,
  prompt_used TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pages_book ON pages(book_id, position);
`;

const BOOK_FIELDS = ['title', 'hero_name', 'hero_desc', 'hero_prompt_en', 'style', 'status', 'current_page'];
const PAGE_FIELDS = ['text', 'action'];
const now = () => new Date().toISOString();

class Store {
  async init(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'editora.sqlite');
    this.imagesDir = path.join(dataDir, 'imagens');
    this.backupDir = path.join(dataDir, 'copias-de-seguranca');
    fs.mkdirSync(this.imagesDir, { recursive: true });
    fs.mkdirSync(this.backupDir, { recursive: true });

    const SQL = await initSqlJs({ locateFile: f => path.join(path.dirname(require.resolve('sql.js')), f) });
    this.db = fs.existsSync(this.file) ? new SQL.Database(fs.readFileSync(this.file)) : new SQL.Database();
    this.db.run('PRAGMA foreign_keys = ON;');
    this.db.run(SCHEMA);
    this.flush();
    this.dailyBackup();
  }

  // ---------- gravação ----------
  flush() {
    const data = Buffer.from(this.db.export());
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, data);
    fs.renameSync(tmp, this.file);
  }
  dailyBackup() {
    const name = `editora-${new Date().toISOString().slice(0, 10)}.sqlite`;
    const target = path.join(this.backupDir, name);
    if (!fs.existsSync(target)) fs.copyFileSync(this.file, target);
    const all = fs.readdirSync(this.backupDir).filter(f => f.endsWith('.sqlite')).sort();
    for (const old of all.slice(0, Math.max(0, all.length - 14))) fs.rmSync(path.join(this.backupDir, old), { force: true });
  }

  // ---------- consultas ----------
  all(sql, params = []) {
    const st = this.db.prepare(sql);
    st.bind(params);
    const rows = [];
    while (st.step()) rows.push(st.getAsObject());
    st.free();
    return rows;
  }
  get(sql, params = []) { return this.all(sql, params)[0] || null; }
  run(sql, params = []) { this.db.run(sql, params); }
  lastId() { return this.get('SELECT last_insert_rowid() AS id').id; }

  // ---------- configurações ----------
  getSettings() {
    const out = {};
    for (const r of this.all('SELECT key, value FROM settings')) out[r.key] = r.value;
    return out;
  }
  setSettings(obj) {
    for (const [k, v] of Object.entries(obj)) {
      this.run('INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [k, v == null ? '' : String(v)]);
    }
    this.flush();
  }

  // ---------- livros ----------
  listBooks() {
    return this.all(`
      SELECT b.*,
        (SELECT COUNT(*) FROM pages p WHERE p.book_id = b.id) AS page_count,
        (SELECT p.image_file FROM pages p WHERE p.book_id = b.id AND p.image_file IS NOT NULL ORDER BY p.position LIMIT 1) AS cover
      FROM books b ORDER BY b.updated_at DESC`);
  }
  createBook({ title, hero_name, hero_desc, hero_prompt_en = '', style }) {
    const t = now();
    const seed = Math.floor(Math.random() * 2_000_000_000) + 1;
    this.run(`INSERT INTO books(title, hero_name, hero_desc, hero_prompt_en, style, seed, created_at, updated_at)
              VALUES(?, ?, ?, ?, ?, ?, ?, ?)`, [title, hero_name, hero_desc, hero_prompt_en, style || 'manga_pb', seed, t, t]);
    const id = this.lastId();
    this.run('INSERT INTO pages(book_id, position, updated_at) VALUES(?, 0, ?)', [id, t]);
    this.flush();
    return id;
  }
  getBook(id) {
    const book = this.get('SELECT * FROM books WHERE id = ?', [id]);
    if (!book) return null;
    book.pages = this.all('SELECT * FROM pages WHERE book_id = ? ORDER BY position', [id]);
    return book;
  }
  updateBook(id, fields) {
    const keys = Object.keys(fields).filter(k => BOOK_FIELDS.includes(k));
    if (!keys.length) return;
    this.run(`UPDATE books SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      [...keys.map(k => fields[k]), now(), id]);
    this.flush();
  }
  touchBook(id) { this.run('UPDATE books SET updated_at = ? WHERE id = ?', [now(), id]); }
  deleteBook(id) {
    this.run('DELETE FROM pages WHERE book_id = ?', [id]);
    this.run('DELETE FROM books WHERE id = ?', [id]);
    this.flush();
    fs.rmSync(path.join(this.imagesDir, String(id)), { recursive: true, force: true });
  }

  // ---------- páginas ----------
  getPage(id) { return this.get('SELECT * FROM pages WHERE id = ?', [id]); }
  addPage(bookId) {
    const t = now();
    const max = this.get('SELECT COALESCE(MAX(position), -1) AS m FROM pages WHERE book_id = ?', [bookId]).m;
    this.run('INSERT INTO pages(book_id, position, updated_at) VALUES(?, ?, ?)', [bookId, max + 1, t]);
    const id = this.lastId();
    this.touchBook(bookId);
    this.flush();
    return id;
  }
  updatePage(id, fields) {
    const keys = Object.keys(fields).filter(k => PAGE_FIELDS.includes(k));
    if (!keys.length) return;
    this.run(`UPDATE pages SET ${keys.map(k => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
      [...keys.map(k => fields[k]), now(), id]);
    const p = this.getPage(id);
    if (p) this.touchBook(p.book_id);
    this.flush();
  }
  setPageImage(id, file, prompt) {
    const old = this.getPage(id);
    this.run('UPDATE pages SET image_file = ?, prompt_used = ?, updated_at = ? WHERE id = ?', [file, prompt, now(), id]);
    this.touchBook(old.book_id);
    this.flush();
    if (old && old.image_file && old.image_file !== file) this.removeImageFile(old.image_file);
  }
  clearPageImage(id) {
    const p = this.getPage(id);
    if (!p) return;
    this.run('UPDATE pages SET image_file = NULL, prompt_used = NULL, updated_at = ? WHERE id = ?', [now(), id]);
    this.touchBook(p.book_id);
    this.flush();
    if (p.image_file) this.removeImageFile(p.image_file);
  }
  deletePage(id) {
    const p = this.getPage(id);
    if (!p) return;
    this.run('DELETE FROM pages WHERE id = ?', [id]);
    this.run('UPDATE pages SET position = position - 1 WHERE book_id = ? AND position > ?', [p.book_id, p.position]);
    if (!this.get('SELECT id FROM pages WHERE book_id = ?', [p.book_id])) {
      this.run('INSERT INTO pages(book_id, position, updated_at) VALUES(?, 0, ?)', [p.book_id, now()]);
    }
    this.touchBook(p.book_id);
    this.flush();
    if (p.image_file) this.removeImageFile(p.image_file);
  }
  movePage(id, direction) {
    const p = this.getPage(id);
    if (!p) return;
    const other = this.get('SELECT * FROM pages WHERE book_id = ? AND position = ?', [p.book_id, p.position + direction]);
    if (!other) return;
    this.run('UPDATE pages SET position = ? WHERE id = ?', [other.position, p.id]);
    this.run('UPDATE pages SET position = ? WHERE id = ?', [p.position, other.id]);
    this.touchBook(p.book_id);
    this.flush();
  }

  // ---------- imagens ----------
  saveImage(bookId, pageId, buffer, ext = 'jpg') {
    const dir = path.join(this.imagesDir, String(bookId));
    fs.mkdirSync(dir, { recursive: true });
    const rel = `${bookId}/${pageId}-${Date.now()}.${ext}`;
    fs.writeFileSync(path.join(this.imagesDir, rel), buffer);
    return rel;
  }
  imagePath(rel) {
    const full = path.resolve(this.imagesDir, rel);
    if (!full.startsWith(path.resolve(this.imagesDir) + path.sep)) return null;
    return full;
  }
  removeImageFile(rel) {
    const full = this.imagePath(rel);
    if (full) fs.rmSync(full, { force: true });
  }
}

module.exports = { Store };

const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('editora', {
  listBooks: () => call('books:list'),
  getBook: id => call('books:get', id),
  createBook: data => call('books:create', data),
  updateBook: (id, fields) => call('books:update', id, fields),
  deleteBook: id => call('books:delete', id),
  heroes: () => call('books:heroes'),
  heroOptions: bookId => call('hero:options', bookId),
  heroChoose: (bookId, rel) => call('hero:choose', bookId, rel),
  addPage: bookId => call('pages:add', bookId),
  updatePage: (id, fields) => call('pages:update', id, fields),
  deletePage: id => call('pages:delete', id),
  movePage: (id, dir) => call('pages:move', id, dir),
  makeManga: pageId => call('page:manga', pageId),
  redrawPanel: (pageId, idx, desc) => call('panel:redraw', pageId, idx, desc),
  updatePanel: (pageId, idx, fields) => call('panel:update', pageId, idx, fields),
  onProgress: fn => {
    const listener = (_e, data) => fn(data);
    ipcRenderer.on('manga:progress', listener);
    return () => ipcRenderer.removeListener('manga:progress', listener);
  },
  spelling: text => call('ai:spelling', text),
  getSettings: () => call('settings:get'),
  saveSettings: data => call('settings:save', data),
  checkPin: pin => call('settings:checkPin', pin),
  testAi: data => call('settings:test', data),
  openDataFolder: () => call('app:openDataFolder'),
  exportPdf: (id, html) => call('book:exportPdf', id, html)
});

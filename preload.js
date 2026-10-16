const { contextBridge, ipcRenderer } = require('electron');

const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('editora', {
  listBooks: () => call('books:list'),
  getBook: id => call('books:get', id),
  createBook: data => call('books:create', data),
  updateBook: (id, fields) => call('books:update', id, fields),
  deleteBook: id => call('books:delete', id),
  heroes: () => call('books:heroes'),
  addPage: bookId => call('pages:add', bookId),
  updatePage: (id, fields) => call('pages:update', id, fields),
  deletePage: id => call('pages:delete', id),
  movePage: (id, dir) => call('pages:move', id, dir),
  clearImage: id => call('pages:clearImage', id),
  draw: pageId => call('ai:draw', pageId),
  spelling: text => call('ai:spelling', text),
  getSettings: () => call('settings:get'),
  saveSettings: data => call('settings:save', data),
  checkPin: pin => call('settings:checkPin', pin),
  testAi: data => call('settings:test', data),
  openDataFolder: () => call('app:openDataFolder'),
  exportPdf: id => call('book:exportPdf', id)
});

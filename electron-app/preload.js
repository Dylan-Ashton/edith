const { contextBridge, ipcRenderer, webUtils } = require('electron');
let cachedPaths = { userData: '', documents: '' };
ipcRenderer.invoke('paths').then((p) => { cachedPaths = p; });
contextBridge.exposeInMainWorld('native', {
  openDialog: (kind) => ipcRenderer.invoke('open-dialog', kind),
  saveDialog: (name, kind) => ipcRenderer.invoke('save-dialog', name, kind),
  readFile: (p) => ipcRenderer.invoke('read-file', p),
  writeFile: (p, text) => ipcRenderer.invoke('write-file', p, text),
  writeBinary: (p, bytes) => ipcRenderer.invoke('write-binary', p, bytes),
  stat: (p) => ipcRenderer.invoke('stat', p),
  readHead: (p) => ipcRenderer.invoke('read-head', p),
  askThree: (message, detail, buttons) => ipcRenderer.invoke('ask-three', message, detail, buttons),
  askClose: (name) => ipcRenderer.invoke('ask-close', name),
  closeConfirmed: () => ipcRenderer.send('close-confirmed'),
  setDocState: (s) => ipcRenderer.send('doc-state', s),
  setTheme: (id) => ipcRenderer.send('set-theme', id),
  setRecent: (list) => ipcRenderer.send('recent', list),
  forgetFile: (p) => ipcRenderer.send('forget-file', p),
  readClipboard: () => ipcRenderer.invoke('read-clipboard'),
  paths: () => cachedPaths,
  showInFolder: (p) => ipcRenderer.send('show-in-folder', p),
  // A real dropped file has a path; the main process then lets the page open it (see grant-dropped in main.js)
  pathFor: (file) => { try { const p = webUtils.getPathForFile(file); if (p) ipcRenderer.send('grant-dropped', p); return p || null; } catch (e) { return null; } },
  seedAllowed: (list) => ipcRenderer.invoke('seed-allowed', list),
  onMenu: (cb) => ipcRenderer.on('menu', (e, action, arg) => cb(action, arg)),
  onOpenPath: (cb) => ipcRenderer.on('open-path', (e, p) => cb(p)),
  onCloseRequest: (cb) => ipcRenderer.on('close-request', () => cb())
});

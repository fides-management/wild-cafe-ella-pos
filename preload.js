// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Login
  checkPin: (pin) => ipcRenderer.invoke('login-check-pin', pin),

  // Navigation
  openItemsPage: () => ipcRenderer.invoke('open-items-page'),
    openOrdersPage: () => ipcRenderer.invoke('open-orders-page'),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args)
});

// --- MENU API (separate for clarity & compatibility) ---
contextBridge.exposeInMainWorld('menuAPI', {
  getAll: () => ipcRenderer.invoke('menu-get-all'),
  getCurrency: () => ipcRenderer.invoke('menu-get-currency'),
  add: (item) => ipcRenderer.invoke('menu-add', item),
  update: (item) => ipcRenderer.invoke('menu-update', item),
  delete: (id) => ipcRenderer.invoke('menu-delete', id),

 onMenuUpdated: (callback) => {
  ipcRenderer.removeAllListeners('menu-updated');
  ipcRenderer.on('menu-updated', callback);
}

});
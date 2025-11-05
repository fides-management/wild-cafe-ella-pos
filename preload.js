// preload.js
// ------------------------------------------------------------
// Secure context-bridge for the renderer (index.html)
// ------------------------------------------------------------

const { contextBridge, ipcRenderer } = require('electron');

/* ------------------------------------------------------------------
   electronAPI – legacy wrapper + navigation
   ------------------------------------------------------------------ */
contextBridge.exposeInMainWorld('electronAPI', {
    // Login
    checkPin: (pin) => ipcRenderer.invoke('login-check-pin', pin),

    // Navigation (kept as invoke for consistency with the rest of the app)
    openItemsPage: () => ipcRenderer.invoke('open-items-page'),
    openOrdersPage: () => ipcRenderer.invoke('open-orders-page'),
    openSettings: () => ipcRenderer.send('open-settings'),

    // Generic invoke helper (used by some UI parts)
    invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),

    // ----------------------------------------------------------------
    // DB-related shortcuts – the renderer still calls these old names
    // ----------------------------------------------------------------
    fetchMenu: () => ipcRenderer.invoke('db:fetchMenu'),
    fetchTables: () => ipcRenderer.invoke('db:fetchTables'),
    fetchOngoingOrders: () => ipcRenderer.invoke('db:fetchOngoingOrders'),
    sendOrderToKitchen: (orderData) =>
        ipcRenderer.invoke('db:sendOrderToKitchen', orderData),
    updateOrderToPaid: (paymentData) =>
        ipcRenderer.invoke('db:updateOrderToPaid', paymentData),

    // Event listener
    onDatabaseCleared: (callback) => ipcRenderer.on('database-cleared', callback),
});

/* ------------------------------------------------------------------
   menuAPI – product / menu CRUD
   ------------------------------------------------------------------ */
contextBridge.exposeInMainWorld('menuAPI', {
    productsgetAll: () => ipcRenderer.invoke('products-get-all'),
    getAll: () => ipcRenderer.invoke('menu-get-all'),
    getCurrency: () => ipcRenderer.invoke('menu-get-currency'),
    add: (item) => ipcRenderer.invoke('menu-add', item),
    update: (item) => ipcRenderer.invoke('menu-update', item),
    delete: (id) => ipcRenderer.invoke('menu-delete', id),

    // Ensure we remove old listeners before adding a new one
    onMenuUpdated: (callback) => {
        ipcRenderer.removeAllListeners('menu-updated');
        ipcRenderer.on('menu-updated', callback);
    },
});

/* ------------------------------------------------------------------
   api – categories, desks, settings
   ------------------------------------------------------------------ */
contextBridge.exposeInMainWorld('api', {
    // ---------- Categories ----------
    getCategories: () => ipcRenderer.invoke('get-categories'),
    addCategory: (data) => ipcRenderer.invoke('add-category', data),
    updateCategory: (id, data) => ipcRenderer.invoke('update-category', id, data),
    deleteCategory: (id) => ipcRenderer.invoke('delete-category', id),

    // **THIS WAS MISSING** – the mock in index.html calls it
    openCategoriesPage: () => ipcRenderer.invoke('open-categories-page'),

    // ---------- Desks ----------
    getDesks: () => ipcRenderer.invoke('get-desks'),
    addDesk: (data) => ipcRenderer.invoke('add-desk', data),
    updateDesk: (id, data) => ipcRenderer.invoke('update-desk', id, data),
    deleteDesk: (id) => ipcRenderer.invoke('delete-desk', id),

    openTablesPage: () => ipcRenderer.invoke('open-tables-page'),

    // ---------- Settings ----------
    clearDatabase: () => ipcRenderer.send('clear-database'),
    onDatabaseCleared: (callback) => ipcRenderer.on('database-cleared', callback),
});
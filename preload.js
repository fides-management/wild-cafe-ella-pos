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

    loginAndNavigate: () => ipcRenderer.invoke('login-success-navigate'),

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

    fetchReportData: (data) => ipcRenderer.invoke('db:fetchReportData', data),
    openReportsPage: () => ipcRenderer.invoke('open-reports-page'),

    // Event listener
    onDatabaseCleared: (callback) => ipcRenderer.on('database-cleared', callback),

     onMenuUpdated: (callback) => {
        ipcRenderer.removeAllListeners('menu-updated');
        ipcRenderer.on('menu-updated', callback);
    },

    // --- FIX: ADDED TABLES & CATEGORIES LISTENERS ---
    
    onTablesAdded: (callback) => {
        ipcRenderer.removeAllListeners('tables-added');
        ipcRenderer.on('tables-added', callback);
    },
    
    onTablesUpdated: (callback) => {
        ipcRenderer.removeAllListeners('tables-updated');
        ipcRenderer.on('tables-updated', callback);
    },

    onCategoriesUpdated: (callback) => {
        ipcRenderer.removeAllListeners('categories-updated');
        ipcRenderer.on('categories-updated', callback);
    },
    
    // --- NEW: SETTINGS/CURRENCY LISTENER ---
    onSettingsUpdated: (callback) => {
        ipcRenderer.removeAllListeners('settings-updated');
        ipcRenderer.on('settings-updated', callback);
    },

    // ---------- Settings ----------
    
   getSettings: () => ipcRenderer.invoke('settings-get-all'), // Used to fetch settings
    updateSettings: (data) => ipcRenderer.invoke('settings-update', data),
    
    // ... (other settings handlers)
    
    openSettingsPage: () => ipcRenderer.invoke('open-settings-page'),

    logout: () => ipcRenderer.send("logout-and-close"),

    onSettingsUpdated: (callback) => ipcRenderer.on('settings-updated', callback), // Used for real-time updates
    fetchPastOrders: (filters) => ipcRenderer.invoke('db:fetchPastOrders', filters),
    // ... (rest of listeners)
});

/* ------------------------------------------------------------------
   api – new bridge for managing non-order data (Categories/Tables/Settings)
   ------------------------------------------------------------------ */
contextBridge.exposeInMainWorld('api', {
    // ---------- Menu Items (CRUD) ----------
    getAllMenuItems: () => ipcRenderer.invoke('menu-get-all'),
    addMenuItem: (item) => ipcRenderer.invoke('menu-add', item),
    updateMenuItem: (item) => ipcRenderer.invoke('menu-update', item),
    deleteMenuItem: (id) => ipcRenderer.invoke('menu-delete', id),

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

   getSettings: () => ipcRenderer.invoke('settings-get-all'),
    updateSettings: (data) => ipcRenderer.invoke('settings-update', data),
    
    clearDatabase: () => ipcRenderer.send('clear-database'),
    onDatabaseCleared: (callback) => ipcRenderer.on('database-cleared', callback),

    openSettingsPage: () => ipcRenderer.invoke('open-settings-page'),
});
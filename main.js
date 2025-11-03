// main.js
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// ---------- USE PROMISE VERSION ----------
const mysql = require('mysql2/promise');
// -----------------------------------------

let mainWindow;
let db;

// ---------- MySQL Connection ----------
async function createDB() {
  try {
    db = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '1234',
      database: 'pos_db'
    });
    console.log('MySQL connected (promise mode)');
  } catch (err) {
    console.error('MySQL connection failed:', err);
    process.exit(1);
  }
}

// ---------- IPC: Check PIN ----------
ipcMain.handle('login-check-pin', async (event, pin) => {
  try {
    const [rows] = await db.query(
      'SELECT id, name FROM users WHERE pin = ? AND active = 1 LIMIT 1',
      [pin]
    );
    return rows.length ? rows[0] : null;
  } catch (err) {
    console.error('Login query error:', err);
    return null;
  }
});

// ---------- MENU CRUD ----------
ipcMain.handle('menu-get-all', async () => {
  const [rows] = await db.query(`
    SELECT id, name, category, price, image
    FROM products
    ORDER BY category, name
  `);
  return rows;
});

ipcMain.handle('menu-get-currency', async () => {
  try {
    const [rows] = await db.query('SELECT currency_symbol FROM settings WHERE id = 1');
    const symbol = rows[0]?.currency_symbol;

    // Return trimmed symbol if exists and not empty, else 'Rs'
    return (symbol && typeof symbol === 'string' && symbol.trim()) ? symbol.trim() : 'Rs';
  } catch (err) {
    console.error('Failed to fetch currency:', err);
    return 'Rs'; // Always fallback on DB error
  }
});


ipcMain.handle('menu-add', async (e, item) => {
  await db.query(`
    INSERT INTO products (name, category, price, image) 
    VALUES (?, ?, ?, ?)
  `, [item.name, item.category, item.price, item.icon_class || 'fas fa-utensils']);
  broadcastToAll('menu-updated');
  return true;
});

ipcMain.handle('menu-update', async (e, item) => {
  await db.query(`
    UPDATE products
    SET name = ?, category = ?, price = ?, image = ? 
    WHERE id = ?
  `, [item.name, item.category, item.price, item.icon_class || 'fas fa-utensils', item.id]);
  broadcastToAll('menu-updated');
  return true;
});

ipcMain.handle('menu-delete', async (e, id) => {
  try {
    // ← FROM is required!
    await db.query('DELETE FROM products WHERE id = ?', [id]);
    broadcastToAll('menu-updated');
    return true;
  } catch (err) {
    console.error('Delete error:', err);
    throw err;               // <-- let renderer handle it
  }
});
// ---------- Open Items Page ----------
ipcMain.handle('open-items-page', () => {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    parent: mainWindow,
    modal: false,
    title: 'Menu Items – Wild Cafe Ella POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('./views/items.html');
  // Optional: auto-close when parent closes
  mainWindow.on('closed', () => win.close());
});

ipcMain.handle('open-orders-page', () => {
   const win = new BrowserWindow({
    width: 1000,
    height: 700,
    parent: mainWindow,
    modal: false,
    title: 'Menu Items – Wild Cafe Ella POS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  win.loadFile('./views/orders.html');
});
// ---------- Broadcast to All Windows ----------
function broadcastToAll(channel, ...args) {
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send(channel, ...args);
  });
}

// ---------- Create Main Window ----------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('./views/login.html');
  // mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ---------- Get all completed orders ----------
// Get all orders
ipcMain.handle('orders-get-all', async () => {
  const [rows] = await db.query(`
    SELECT id, order_date, final_total, payment_method, order_data
    FROM sales
    ORDER BY order_date DESC
  `);
  return rows;
});

// Remove order
ipcMain.handle('order-remove', async (e, id) => {
  await db.query('DELETE FROM sales WHERE id = ?', [id]);
  return true;
});

// ---------- (currency already exists) ----------
// ipcMain.handle('menu-get-currency', async () => {
//   const [rows] = await db.query('SELECT currency_symbol FROM settings WHERE id = 1');
//   return rows[0]?.currency_symbol?.trim() || 'Rs';
// });

// ---------- App Lifecycle ----------
app.whenReady().then(async () => {
  await createDB();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
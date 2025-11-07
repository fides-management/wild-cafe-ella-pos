// ================== main.js ==================
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const mysql = require("mysql2/promise");

// Import the handler registration function from the new db.js module
const registerHandlers = require("./db");

// ================== GLOBALS ==================
let mainWindow;
let db;

// ================== DATABASE CONNECTION ==================
async function createDB() {
    try {
        db = await mysql.createConnection({
            host: "localhost",
            user: "root",
            password: "1234",
            database: "wildcafe_pos",
        });
        console.log("MySQL connected");
    } catch (err) {
        console.error("MySQL connection failed:", err);
        process.exit(1);
    }
}

// ================== HELPER ==================
function broadcastToAll(channel, ...args) {
    BrowserWindow.getAllWindows().forEach((win) =>
        win.webContents.send(channel, ...args)
    );
}

// ================== WINDOW CREATION HELPERS ==================
function createChildWindow(options, filePath) {
    const win = new BrowserWindow({
        ...options,
        parent: mainWindow,
        modal: true,               // <-- blocks main window
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Load the view – give a helpful error if the file is missing
    win.loadFile(filePath).catch((err) => {
        console.error(`Failed to load ${filePath}:`, err);
        win.webContents.executeJavaScript(
            `document.body.innerHTML = '<h2 style="color:red;">File not found: ${path.basename(
                filePath
            )}</h2>'`
        );
    });

    // // Close child when main window closes
    // mainWindow.on("closed", () => win.close());

    // **FIX FOR "OBJECT HAS BEEN DESTROYED"**
    // 1. Define the handler function
    const closeChildOnMainWindowClose = () => {
        if (!win.isDestroyed()) {
            win.close();
        }
    };
    
    // 2. Attach the handler to the main window
    mainWindow.on("closed", closeChildOnMainWindowClose);

    // 3. REMOVE the listener when the child window is closed by the user
    win.on("closed", () => {
        // Clean up the main window's listener to prevent memory leaks/errors
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.removeListener("closed", closeChildOnMainWindowClose);
        }
    });

    return win;
}

// ================== MAIN WINDOW ==================
// function createWindow() {
//     mainWindow = new BrowserWindow({
//         width: 1200,
//         height: 800,
//         autoHideMenuBar: false,
//         frame: true,
//         webPreferences: {
//             preload: path.join(__dirname, "preload.js"),
//             contextIsolation: true,
//             nodeIntegration: false,
//         },
//     });

//     // Start with the login screen
//     mainWindow.loadFile(path.join(__dirname, "views", "login.html"));
// }

// function DashboradWindow() {
//     mainWindow = new BrowserWindow({
//         width: 1200,
//         height: 800,
//         autoHideMenuBar: false,
//         frame: true,
//         webPreferences: {
//             preload: path.join(__dirname, "preload.js"),
//             contextIsolation: true,
//             nodeIntegration: false,
//         },
//     });

//     // Start with the login screen
//     mainWindow.loadFile(path.join(__dirname, "views", "index.html"));
// }

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 480,
        height: 605,
        title: "Login– Wild Cafe Ella POS",
        icon: path.join(__dirname, 'build', 'icon.png'),
        minimizable: false,
        maximizable: false,
        resizable: false,
        autoHideMenuBar: true,
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // Start with the login screen
    mainWindow.loadFile(path.join(__dirname, "views", "login.html"));
    
    // NOTE: If you are calling createWindow() somewhere, rename that call to createLoginWindow()
}

/**
 * Closes the current window and opens the main POS window (index.html).
 * This function is called via IPC after a successful login.
 */
function openMainWindow() {
    // 1. Get a reference to the current (login) window
    const loginWindow = mainWindow; 
    
    // 2. Create the new main window instance
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        autoHideMenuBar: true,
          title: "Dashboard– Wild Cafe Ella POS",
        icon: path.join(__dirname, 'build', 'icon.png'),
        frame: true,
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    // 3. Load the main application page
    mainWindow.loadFile(path.join(__dirname, "index.html")); 

    // 4. Close the old (login) window
    if (loginWindow && !loginWindow.isDestroyed()) {
        loginWindow.close();
    }
}

// ---------------------------------------------------------
// IPC Handler (Add this where you register other IPC handlers)
// ---------------------------------------------------------
ipcMain.handle('login-success-navigate', (event) => {
    openMainWindow();
    return true; // Return a success signal
});
// ================== IPC HANDLERS (Navigation) ==================

// ---- Menu Items ----
ipcMain.handle("open-items-page", () => {
    createChildWindow(
        {
            width: 1000,
            height: 700,
            title: "Menu Items – Wild Cafe Ella POS",
            minimizable: false,
            maximizable: false,
            resizable: false,
            autoHideMenuBar: false,
            frame: false,
            modal: false
        },
        path.join(__dirname, "views", "items.html")
    );
});

ipcMain.handle("open-reports-page", () => {
    createChildWindow(
        {
            width: 800,
            height: 700,
            title: "Menu Items – Wild Cafe Ella POS",
            minimizable: false,
            maximizable: false,
            resizable: false,
            autoHideMenuBar: true,
            frame: false,
            modal: false
        },
        path.join(__dirname, "views", "reports.html")
    );
});
// ---- Past Orders ----
ipcMain.handle("open-orders-page", () => {
    createChildWindow(
        {
            width: 1000,
            height: 700,
            title: "Orders – Wild Cafe Ella POS",
            autoHideMenuBar: true,
            minimizable: false,
            maximizable: false,
            resizable: false,
            frame: false,
        },
        path.join(__dirname, "views", "orders.html")
    );
});

// ---- Categories (FIXED) ----
ipcMain.handle("open-categories-page", () => {
    createChildWindow(
        {
            width: 800,
            height: 700,
            title: "Categories – Wild Cafe POS",
             minimizable: false,
            maximizable: false,
            resizable: false,
            autoHideMenuBar: false,
            frame: false,
            modal: false
        },
        path.join(__dirname, "views", "categories.html")
    );
});

ipcMain.handle("open-tables-page", () => {
    createChildWindow(
        {
            width: 800,
            height: 700,
            title: "Tables – Wild Cafe POS",
             minimizable: false,
            maximizable: false,
            resizable: false,
            autoHideMenuBar: false,
            frame: false,
            modal: false
        },
        path.join(__dirname, "views", "tables.html")
    );
});

ipcMain.handle("open-settings-page", () => {
    createChildWindow(
        {
            width: 800,
            height: 700,
            title: "Settings – Wild Cafe POS",
            minimizable: false,
            maximizable: false,
            resizable: false,
            autoHideMenuBar: true,
            frame: false,
            modal: false
        },
        path.join(__dirname, "views", "settings.html")
    );
});

// ---- Settings (kept as simple send) ----
ipcMain.on("open-settings", () => {
    // You can replace this with a real window later
    console.log("Settings requested – implement in a new view if needed");
});

// main.js - Add this handler below your other IPC handlers

ipcMain.on("logout-and-close", () => {
    console.log("Logout requested. Closing main window.");
    // Safely close the main window. This triggers the 'window-all-closed' app exit.
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.close();
    }
});

// Note: Ensure your main.js still has the global mainWindow variable defined.

// ================== APP LIFECYCLE ==================
app.whenReady().then(async () => {
    // 1. DB
    await createDB();

    // 2. Main window
    createWindow();

    // 3. Register all DB-related IPC handlers
    registerHandlers(db, ipcMain, mainWindow, broadcastToAll);

    // macOS re-create window when dock icon is clicked
    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
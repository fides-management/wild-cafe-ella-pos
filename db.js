// db.js
// This file contains all the database logic and registers the IPC handlers.

/**
 * Registers all IPC handlers related to database and application logic.
 *
 * @param {object} db - The MySQL connection object.
 * @param {object} ipcMain - The Electron ipcMain module.
 * @param {object} mainWindow - The main BrowserWindow instance.
 * @param {function} broadcastToAll - Helper function to broadcast messages.
 */
// db.js
function registerHandlers(db, ipcMain, mainWindow, broadcastToAll) {
    
    async function fetchAllMenuItems() {
        const [rows] = await db.query(
            `
            SELECT id, name, category, price, image, code
            FROM products
            ORDER BY category, name
            `
        );
        return rows;
    }

    async function fetchAllDesks() {
        const [rows] = await db.query("SELECT id, name FROM desk ORDER BY name");
        return rows;
    }

    ipcMain.handle("login-check-pin", async (event, pin) => {
        try {
            const [rows] = await db.query(
                "SELECT id, name FROM users WHERE password = ?",
                [pin]
            );
            return rows.length ? rows[0] : null;
        } catch (err) {
            console.error("Login query error:", err);
            return null;
        }
    });

    ipcMain.on("open-settings", () => {
        const settingsPath = require("path").join(__dirname, "views", "settings.html");
        mainWindow.loadFile(settingsPath);
    });

    ipcMain.handle("menu-get-currency", async () => {
        try {
            const [rows] = await db.query(
                "SELECT currency_symbol FROM settings WHERE id = 1"
            );
            const symbol = rows[0]?.currency_symbol;
            return symbol?.trim() || "Rs";
        } catch (err) {
            console.error("Failed to fetch currency:", err);
            return "Rs";
        }
    });

    ipcMain.handle("products-get-all", async () => {
        const [rows] = await db.query(
            `SELECT id, name, price, image, code FROM products`
        );
        return [rows];
    });

    ipcMain.handle("menu-get-all", fetchAllMenuItems);

   ipcMain.handle("menu-add", async (e, item) => {
    // Note: Assuming your DB column for icon is 'image' and we need 'code'.
    await db.query(
        // SQL: Added 'code' column
        `INSERT INTO products (name, code, category, price, image) VALUES (?, ?, ?, ?, ?)`,
        [
            item.name, 
            item.code, // New: Added item.code
            item.category, 
            item.price, 
            item.icon_class || "fas fa-utensils" // Maps to 'image'
        ]
    );
    broadcastToAll("menu-updated");
    return true;
});

  ipcMain.handle("menu-update", async (e, item) => {
    // SQL: Added 'code = ?' to the SET clause
    await db.query(
        `UPDATE products SET name = ?, code = ?, category = ?, price = ?, image = ? WHERE id = ?`,
        [
            item.name, 
            item.code, // New: Added item.code
            item.category, 
            item.price, 
            item.icon_class || "fas fa-utensils", // Maps to 'image'
            item.id
        ]
    );
    broadcastToAll("menu-updated");
    return true;
});

    ipcMain.handle("menu-delete", async (e, id) => {
        try {
            await db.query("DELETE FROM products WHERE id = ?", [id]);
            broadcastToAll("menu-updated");
            return true;
        } catch (err) {
            console.error("Delete error:", err);
            throw err;
        }
    });

    ipcMain.handle("get-categories", async () => {
        const [rows] = await db.query("SELECT * FROM category ORDER BY name");
        return rows;
    });

    ipcMain.handle("add-category", async (event, { name }) => {
        try {
            const [result] = await db.query("INSERT INTO category (name) VALUES (?)", [name]);
            return { id: result.insertId, name };
        } catch (err) {
            if (err.code === "ER_DUP_ENTRY") throw new Error("Category already exists");
            throw err;
        }
    });

    ipcMain.handle("update-category", async (event, id, { name }) => {
        try {
            await db.query("UPDATE category SET name = ? WHERE id = ?", [name, id]);
            return { id, name };
        } catch (err) {
            if (err.code === "ER_DUP_ENTRY") throw new Error("Name already taken");
            throw err;
        }
    });

    ipcMain.handle("delete-category", async (event, id) => {
        await db.query("DELETE FROM category WHERE id = ?", [id]);
    });

    ipcMain.handle("get-desks", fetchAllDesks);

    ipcMain.handle("add-desk", async (event, { name }) => {
        try {
            const [result] = await db.query("INSERT INTO desk (name) VALUES (?)", [name]);
            return { id: result.insertId, name };
        } catch (err) {
            if (err.code === "ER_DUP_ENTRY") throw new Error("Table name already exists");
            throw err;
        }
    });

    ipcMain.handle("update-desk", async (event, id, { name }) => {
        try {
            await db.query("UPDATE desk SET name = ? WHERE id = ?", [name, id]);
            return { id, name };
        } catch (err) {
            if (err.code === "ER_DUP_ENTRY") throw new Error("Name already taken");
            throw err;
        }
    });

    ipcMain.handle("delete-desk", async (event, id) => {
        await db.query("DELETE FROM desk WHERE id = ?", [id]);
    });

    ipcMain.on("clear-database", async () => {
        await db.query("DELETE FROM category");
        await db.query("DELETE FROM desk");
        mainWindow.webContents.send("database-cleared");
    });

    // ipcMain.handle("orders-get-all", async () => {
    //     const [rows] = await db.query(
    //         `SELECT s.id, s.timestamp, s.price, s.payment_mode, s.products, d.name AS table_name, s.active
    //          FROM sales s LEFT JOIN desk d ON s.desk_id = d.id ORDER BY s.timestamp DESC`
    //     );
    //     console.log(rows)
    //     return rows;
    // });

 ipcMain.handle("orders-get-all", async () => {
    const [rows] = await db.query(
        `SELECT s.id, s.timestamp, s.price, s.payment_mode, s.products, d.name AS table_name, s.active
         FROM sales s 
         LEFT JOIN desk d ON s.desk_id = d.id 
         ORDER BY s.timestamp DESC`
    );

    // ✅ Parse JSON before returning
    const parsedRows = rows.map(row => {
        try {
            return {
                ...row,
                products: typeof row.products === "string"
                    ? JSON.parse(row.products)
                    : row.products
            };
        } catch (err) {
            console.error("JSON parse failed for products:", row.products);
            return { ...row, products: [] }; // Fallback
        }
    });

    console.log(parsedRows); // ✅ log the parsed data, not raw "rows"
    return parsedRows;
});


    ipcMain.handle("order-remove", async (e, id) => {
        await db.query("DELETE FROM sales WHERE id = ?", [id]);
        return true;
    });

    // MAPPED HANDLERS
    ipcMain.handle('db:fetchMenu', async () => fetchAllMenuItems());
    ipcMain.handle('db:fetchTables', async () => fetchAllDesks());
    
    ipcMain.handle('db:fetchOngoingOrders', async () => {
        const [rows] = await db.query(
            `SELECT s.id, s.price, s.products, d.name AS table_name, s.timestamp, s.active, s.payment_mode
             FROM sales s LEFT JOIN desk d ON s.desk_id = d.id WHERE s.active = 'pending' ORDER BY s.timestamp ASC`
        );
        return rows.map(row => ({
            ...row,
            products: JSON.parse(row.products)
        }));
    });

    ipcMain.handle('db:sendOrderToKitchen', async (event, orderData) => {
        const { products, price, desk_id } = orderData;
        const productsJson = JSON.stringify(products);
        
        if (!desk_id) {
            throw new Error("Cannot place order: Please select a table.");
        }

        try {
            const [result] = await db.query(
                `INSERT INTO sales (products, price, desk_id, active) VALUES (?, ?, ?, 'pending')`,
                [productsJson, price, desk_id]
            );
            broadcastToAll("orders-updated");
            return { success: true, message: 'Order sent to kitchen.', new_order_id: result.insertId };
        } catch (error) {
            console.error("Error sending order:", error);
            throw new Error(`Failed to place order: ${error.message}`);
        }
    });

    ipcMain.handle('db:updateOrderToPaid', async (event, paymentData) => {
        const { order_id, payment_mode } = paymentData;
        
        try {
            const [updateResult] = await db.query(
                `UPDATE sales SET active = 'paid', payment_mode = ? WHERE id = ? AND active = 'pending'`,
                [payment_mode, order_id]
            );

            if (updateResult.affectedRows === 0) {
                return { success: false, message: 'Order not found or already paid.' };
            }
            
            broadcastToAll("orders-updated");
            return { success: true, message: 'Payment confirmed.' };
        } catch (error) {
            console.error("Error updating order to paid:", error);
            throw new Error(`Failed to finalize payment: ${error.message}`);
        }
    });
}

module.exports = registerHandlers;
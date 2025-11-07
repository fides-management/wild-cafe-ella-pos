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

    // db.js (inside function registerHandlers(db, ipcMain, mainWindow, broadcastToAll) { ... )

// ... (Existing handlers)

    /**
     * Fetches report data based on type and date range.
     * @param {string} type - 'sales', 'items', 'categories', 'tables'.
     * @param {string} startDate - YYYY-MM-DD.
     * @param {string} endDate - YYYY-MM-DD.
     */
    ipcMain.handle('db:fetchReportData', async (event, { type, startDate, endDate }) => {
        let query = '';
        let params = [];
        
        // Helper to adjust end date to include the entire day
        const endDay = new Date(endDate);
        endDay.setDate(endDay.getDate() + 1);
        const adjustedEndDate = endDay.toISOString().split('T')[0];

        switch (type) {
            case 'sales':
                query = `
                    SELECT 
                        id, desk_id, payment_mode, price AS total_price, timestamp, active
                    FROM sales
                    WHERE timestamp >= ? AND timestamp < ?
                    ORDER BY timestamp DESC
                `;
                params = [startDate, adjustedEndDate];
                break;
            case 'items':
                // Note: Extracting item data from the JSON 'products' column requires more complex SQL or post-processing.
                // This query fetches the full sales records which can be processed on the front-end/Electron side.
                query = `
                    SELECT 
                        id, products, timestamp
                    FROM sales
                    WHERE timestamp >= ? AND timestamp < ? AND active = 'paid'
                    ORDER BY timestamp DESC
                `;
                params = [startDate, adjustedEndDate];
                break;
            case 'tables':
                query = `
                    SELECT 
                        s.id, d.name AS table_name, s.price AS total_price, s.timestamp
                    FROM sales s
                    JOIN desk d ON s.desk_id = d.id
                    WHERE s.timestamp >= ? AND s.timestamp < ? AND s.active = 'paid'
                    ORDER BY s.timestamp DESC
                `;
                params = [startDate, adjustedEndDate];
                break;
            case 'categories':
                // Similar to items, fetch full sales and process JSON for categories.
                query = `
                    SELECT 
                        products
                    FROM sales
                    WHERE timestamp >= ? AND timestamp < ? AND active = 'paid'
                `;
                params = [startDate, adjustedEndDate];
                break;
            default:
                return { success: false, message: 'Invalid report type.' };
        }

        try {
            const [rows] = await db.query(query, params);
            return { success: true, data: rows };
        } catch (error) {
            console.error(`Error fetching ${type} report:`, error);
            return { success: false, message: `Failed to fetch report data: ${error.message}` };
        }
    });

// ... (Rest of db.js)

    /**
     * Generates the HTML content for a shop or kitchen receipt.
     * @param {string} type - 'shop' or 'kitchen'
     * @param {object} order - The processed order data from the DB.
     * @param {object} settings - Shop settings (name, address, printers, tax/discount rates).
     * @param {string} currencySymbol - The currency symbol.
     */
   function generateReceiptContent(type, order, settings, currencySymbol) {
    const isKitchen = type === 'kitchen';
    const isShop = type === 'shop';

    // Helper to safely format numbers
    const safeFixed = (val, dec = 2) => {
        const num = parseFloat(val);
        return isNaN(num) ? "0.00" : num.toFixed(dec);
    };

    // --- Kitchen Receipt (Minimal) ---
    if (isKitchen) {
        let content = `
            <html><head><style>
                body { font-family: monospace; font-size: 10px; width: 58mm; margin: 0; padding: 0; }
                h2 { text-align: center; margin: 5px 0; }
                .line { border-top: 1px dashed #000; margin: 5px 0; }
                .item { display: flex; justify-content: space-between; margin: 2px 0; }
                .qty { font-weight: bold; margin-right: 5px; }
            </style></head><body>
                <h2>KITCHEN ORDER</h2>
                <p>Table: ${order.desk_name || order.table_name || 'N/A'}</p>
                <p>Order ID: #${order.orderId || order.id || 'N/A'}</p>
                <div class="line"></div>
                <h3>Items:</h3>
        `;

        (order.items || []).forEach(item => {
            content += `<div class="item"><span class="qty">${item.qty || 1}x</span> <span>${item.name || ''}</span></div>`;
        });

        const notes = (order.notes || '').trim();
        if (notes) {
            content += `<div class="line"></div><p><strong>Notes:</strong> ${notes}</p>`;
        }

        content += `</body></html>`;
        return content;
    }

    // --- Shop/Customer Receipt (Detailed) ---
    if (isShop) {
        let content = `
            <html><head><style>
                body { font-family: monospace; font-size: 11px; width: 80mm; margin: 0; padding: 0; }
                h1 { font-size: 1.2em; text-align: center; margin: 5px 0; }
                .header-info { text-align: center; margin-bottom: 10px; }
                .header-info p { margin: 2px 0; }
                .line { border-top: 1px dashed #000; margin: 10px 0; }
                table { width: 100%; border-collapse: collapse; }
                th, td { text-align: left; padding: 2px 0; }
                .item-qty { width: 10%; }
                .item-name { width: 60%; }
                .item-price { text-align: right; width: 30%; }
                .summary { text-align: right; margin-top: 10px; }
                .summary div { display: flex; justify-content: space-between; margin: 3px 0; }
                .total-line { font-weight: bold; font-size: 1.1em; border-top: 1px solid #000; padding-top: 5px; }
            </style></head><body>
                <h1>${settings.name || 'WILD CAFE ELLA POS'}</h1>
                <div class="header-info">
                    <p>${settings.address || 'Address not set'}</p>
                    <p>Tel: ${settings.phone_number || 'N/A'} | Email: ${settings.email || 'N/A'}</p>
                </div>
                <div class="line"></div>
                <p><strong>Table:</strong> ${order.desk_name || order.table_name || 'N/A'}</p>
                <p><strong>Order ID:</strong> #${order.orderId || order.id || 'N/A'}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
                <div class="line"></div>

                <table>
                    <thead>
                        <tr>
                            <th class="item-qty">Qty</th>
                            <th class="item-name">Item</th>
                            <th class="item-price">Total</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        (order.items || []).forEach(item => {
            const price = Number(item.price) || 0;
            const qty = Number(item.qty) || 0;
            const itemTotal = safeFixed(price * qty);
            content += `
                <tr>
                    <td class="item-qty">${qty}</td>
                    <td class="item-name">${item.name || ''}</td>
                    <td class="item-price">${currencySymbol}${itemTotal}</td>
                </tr>
            `;
        });

        // --- Safe summary calculations ---
        const subtotal = (order.items || []).reduce((sum, i) => sum + ((i.price || 0) * (i.qty || 0)), 0);
        const discountRate = parseFloat(order.discount) || 0;
        const discountAmount = subtotal * (discountRate / 100);
        const taxableBase = subtotal - discountAmount;
        const taxAmount = settings.tax_enabled ? taxableBase * ((settings.tax_rate || 0) / 100) : 0;
        const total = taxableBase + taxAmount;

        content += `
                    </tbody>
                </table>
                <div class="line"></div>
                <div class="summary">
                    <div><span>Subtotal:</span><span>${currencySymbol}${safeFixed(subtotal)}</span></div>
        `;

        if (settings.discount_enabled && discountRate > 0) {
            content += `
                    <div><span>Discount (${discountRate}%):</span><span>-${currencySymbol}${safeFixed(discountAmount)}</span></div>
            `;
        }

        if (settings.tax_enabled) {
            content += `
                    <div><span>Tax (${settings.tax_rate}%):</span><span>+${currencySymbol}${safeFixed(taxAmount)}</span></div>
            `;
        }

        content += `
                    <div class="total-line"><span>TOTAL:</span><span>${currencySymbol}${safeFixed(total)}</span></div>
                    <div><span>Paid By:</span><span>${order.paymentMethod || 'N/A'}</span></div>
                    <div><span>Amount Paid:</span><span>${currencySymbol}${safeFixed(order.amountPaid)}</span></div>
                    <div><span>Change:</span><span>${currencySymbol}${safeFixed(order.change)}</span></div>
                </div>

                <div class="line"></div>
                <p style="text-align:center; font-size: 10px;">*** THANK YOU - VISIT AGAIN ***</p>
            </body></html>
        `;

        return content;
    }
}


/**
 * Prints the receipt content to the specified printer using an invisible window.
 * @param {object} mainWindow - The main BrowserWindow instance.
 * @param {string} printerName - The name of the target printer.
 * @param {string} htmlContent - The HTML content of the receipt.
 */
async function printReceipt(mainWindow, printerName, htmlContent) {
    if (!printerName || printerName === 'none' || printerName.toLowerCase() === 'none') {
        return { success: false, message: "Printer not configured." };
    }

    try {
        const { BrowserWindow } = require('electron');

        let printWindow = new BrowserWindow({
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true
            }
        });

        printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

        return new Promise((resolve) => {
            printWindow.webContents.on('did-finish-load', () => {
                printWindow.webContents.print({
                    silent: true,
                    deviceName: printerName,
                    margins: { marginType: 'custom', top: 0, bottom: 0, left: 0, right: 0 },
                    pageSize: {
                width: 80000, // 80 mm * 1000 microns/mm = 80000 microns
    height: 200000   // initial height in mm (the printer driver handles the rest)
            },
                    printBackground: true,
                }, (success, errorType) => {
                    printWindow.close();
                    printWindow = null;

                    if (success) {
                        resolve({ success: true, message: `Printed to ${printerName}` });
                    } else {
                        resolve({ success: false, message: `Failed: ${errorType}` });
                    }
                });
            });

            setTimeout(() => {
                if (printWindow) {
                    printWindow.close();
                    resolve({ success: false, message: "Printing timeout reached." });
                }
            }, 10000);
        });
    } catch (error) {
        console.error(`Error in printReceipt for ${printerName}:`, error);
        return { success: false, message: `System error: ${error.message}` };
    }
}

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
              broadcastToAll("tables-added");
            return { id: result.insertId, name };
        } catch (err) {
            if (err.code === "ER_DUP_ENTRY") throw new Error("Table name already exists");
            throw err;
        }
    });

    ipcMain.handle("update-desk", async (event, id, { name }) => {
        try {
            await db.query("UPDATE desk SET name = ? WHERE id = ?", [name, id]);
            broadcastToAll("tables-updated");
            return { id, name };
        } catch (err) {
            if (err.code === "ER_DUP_ENTRY") throw new Error("Name already taken");
            throw err;
        }
    });

    ipcMain.handle("delete-desk", async (event, id) => {
        await db.query("DELETE FROM desk WHERE id = ?", [id]);
        broadcastToAll("tables-updated");
    });

    ipcMain.handle('db:fetchOngoingOrders', async () => {
        const [rows] = await db.query(
            `
            SELECT s.id, s.desk_id, s.price, s.products, d.name AS table_name, s.timestamp, s.active
            FROM sales s 
            LEFT JOIN desk d ON s.desk_id = d.id 
            WHERE s.active = 'pending' 
            ORDER BY s.timestamp ASC
            `
        );
        // Parse JSON before returning
        const parsedRows = rows.map(row => {
            try {
                return { 
                    ...row, 
                    products: typeof row.products === "string" ? JSON.parse(row.products) : row.products
                };
            } catch (err) {
                console.error("JSON parse failed for products:", row.products);
                return { ...row, products: [] }; // Fallback
            }
        });
        return parsedRows;
    });

    // ipcMain.handle('db:sendOrderToKitchen', async (event, orderData) => {
    //     const { products, price, desk_id } = orderData;
    //     const productsJson = JSON.stringify(products);
    //     if (!desk_id) {
    //         throw new Error("Cannot place order: Please select a table.");
    //     }
    //     try {
    //         const [result] = await db.query(
    //             `INSERT INTO sales (products, price, desk_id, active) VALUES (?, ?, ?, 'pending')`,
    //             [productsJson, price, desk_id]
    //         );
    //         broadcastToAll("orders-updated");
    //         return { success: true, message: 'Order sent to kitchen.', new_order_id: result.insertId };
    //     } catch (error) {
    //         console.error("Error sending order:", error);
    //         throw new Error(`Failed to place order: ${error.message}`);
    //     }
    // });

    // ipcMain.handle('db:updateOrderToPaid', async (event, paymentData) => {
    //     const { order_id, payment_mode } = paymentData;
    //     try {
    //         const [updateResult] = await db.query(
    //             `UPDATE sales SET active = 'paid', payment_mode = ? WHERE id = ?`,
    //             [payment_mode, order_id]
    //         );
    //         if (updateResult.affectedRows > 0) {
    //             broadcastToAll("orders-updated");
    //             return { success: true, message: 'Order marked as paid.' };
    //         }
    //         throw new Error('Order not found or not updated.');
    //     } catch (error) {
    //         console.error("Error updating order to paid:", error);
    //         throw new Error(`Failed to confirm payment: ${error.message}`);
    //     }
    // });

    // MAPPED HANDLERS
    ipcMain.handle('db:fetchMenu', async () => fetchAllMenuItems());
    ipcMain.handle('db:fetchTables', async () => fetchAllDesks());

   ipcMain.handle("settings-get-all", async () => {
        try {
            const [rows] = await db.query(
                `
                SELECT 
                    tax_enabled, tax_rate, discount_enabled, discount_rate, 
                    currency_symbol, shop_printer, kitchen_printer,
                    name, address, phone_number, email 
                FROM settings 
                WHERE id = 1
                `
            );
            // Ensure boolean-like values are returned as numbers (1/0)
            if (rows.length > 0) {
                 const settings = rows[0];
                 settings.tax_enabled = settings.tax_enabled ? 1 : 0;
                 settings.discount_enabled = settings.discount_enabled ? 1 : 0;
                 return settings;
            }
            return null;
        } catch (err) {
            console.error("Failed to fetch settings:", err);
            throw new Error(`Database error: ${err.message}`);
        }
    });

    // Handler to update settings (Ensure it accepts and uses tax/discount fields)
    ipcMain.handle("settings-update", async (event, data) => {
        const { 
            name, address, phone_number, email, 
            tax_enabled, discount_enabled, tax_rate, discount_rate, currency_symbol,
            shop_printer, kitchen_printer
        } = data;
        
        // Convert checkbox values (checkbox state) to database integers (1 or 0)
        const taxEnabledInt = tax_enabled ? 1 : 0;
        const discountEnabledInt = discount_enabled ? 1 : 0;
        
        try {
            await db.query(
                // ... (long SQL query to UPDATE settings) ...
                `
                UPDATE settings SET 
                    name = ?, address = ?, phone_number = ?, email = ?, 
                    tax_enabled = ?, discount_enabled = ?, 
                    tax_rate = ?, discount_rate = ?, currency_symbol = ?,
                    shop_printer = ?, kitchen_printer = ?
                WHERE id = 1
                `,
                [
                    name, 
                    address, 
                    phone_number, 
                    email, 
                    taxEnabledInt, 
                    discountEnabledInt, 
                    tax_rate, 
                    discount_rate, 
                    currency_symbol,
                    shop_printer,
                    kitchen_printer
                ]
            );
            
            // CRITICAL: This line broadcasts the update to all windows, including items.html
            broadcastToAll("settings-updated"); 
            return { success: true, message: "Settings updated successfully." };
        } catch (err) {
            console.error("Failed to update settings:", err);
            throw new Error(`Database error: ${err.message}`);
        }
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
            
            const newOrderId = result.insertId;

            // Fetch settings for kitchen printing
            const [settingsRows] = await db.query(
                `SELECT kitchen_printer, currency_symbol FROM settings WHERE id = 1`
            );
            const settings = settingsRows[0] || {};
            const currencySymbol = settings.currency_symbol || 'Rs';

            // Prepare kitchen receipt data
            const kitchenReceiptOrder = {
                orderId: newOrderId,
                // Fetch desk name for the receipt
                desk_name: (await db.query(`SELECT name FROM desk WHERE id = ?`, [desk_id]))[0][0]?.name || `Desk ID ${desk_id}`,
                items: products,
                notes: '', 
            };
            
            // Generate and print kitchen receipt
            const kitchenReceiptHTML = generateReceiptContent('kitchen', kitchenReceiptOrder, settings, currencySymbol);
            const kitchenPrintResult = await printReceipt(mainWindow, settings.kitchen_printer, kitchenReceiptHTML);
            
            console.log("Kitchen Print Status:", kitchenPrintResult.message);

            broadcastToAll("orders-updated");
            return { 
                success: true, 
                message: 'Order sent to kitchen.', 
                new_order_id: newOrderId,
                print_status: { kitchen: kitchenPrintResult.message }
            };

        } catch (error) {
            console.error("Error sending order:", error);
            throw new Error(`Failed to place order: ${error.message}`);
        }
    });

    ipcMain.handle("db:updateOrderToPaid", async (event, paymentData) => {
        // NOTE: paymentData MUST include order_id, payment_mode, amount_paid, and change_amount
        const { order_id, payment_mode, amount_paid, change_amount } = paymentData;
        const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

        try {
            // 1. Fetch current order details before updating
            const [orderRows] = await db.query(
                `
                SELECT s.*, d.name AS desk_name 
                FROM sales s 
                LEFT JOIN desk d ON s.desk_id = d.id 
                WHERE s.id = ?
                `,
                [order_id]
            );

            if (orderRows.length === 0) {
                throw new Error("Order not found.");
            }

            const order = orderRows[0];
            
            let products = order.products;
if (typeof products === 'string') {
  try {
    products = JSON.parse(products);
  } catch (err) {
    console.error("Failed to parse products JSON:", err);
  }
}

        
            
            // 2. Fetch settings for receipt and printers
            const [settingsRows] = await db.query(
                `
                SELECT name, address, phone_number, email, currency_symbol, shop_printer, kitchen_printer, tax_enabled, tax_rate, discount_enabled, discount_rate
                FROM settings 
                WHERE id = 1
                `
            );

            const ss = settingsRows[0];
            // You must ensure that your `sales` table has a `discount_rate` column or similar if you intend to use it.
            const discountRate = parseFloat(ss.discount_rate) || 0; 

            const settings = settingsRows.length > 0 ? settingsRows[0] : {};
            const currencySymbol = settings.currency_symbol || "Rs";

            // 3. Prepare data structure for receipt generation
            const tempReceiptOrder = {
                orderId: order_id,
                desk_name: order.desk_name || `Desk ID ${order.desk_id || 'Unknown'}`,
                items: products,
                notes: order.notes || '', 
                paymentMethod: payment_mode,
                amount_paid: parseFloat(amount_paid),
                change: parseFloat(change_amount),
                discount: discountRate, 
            }

            // 4. Generate Receipt Content
            const shopReceiptHTML = generateReceiptContent('shop', tempReceiptOrder, settings, currencySymbol);
           // const kitchenReceiptHTML = generateReceiptContent('kitchen', tempReceiptOrder, settings, currencySymbol);
            
            // 5. Update the sales record to 'paid' 
            // FIX: Add AND active = 'pending' to prevent updating an already paid order (resolves original error).
            const [updateResult] = await db.query(
                `
                UPDATE sales SET 
                    active = 'paid', 
                    payment_mode = ?, 
                    price = ?, 
                    timestamp = ?
                WHERE id = ? AND active = 'pending'
                `,
                [payment_mode, amount_paid, timestamp, order_id]
            );

            if (updateResult.affectedRows === 0) {
                // Throws the original error if the order was already paid or ID is wrong
                throw new Error('Order not found or was already paid.');
            }

            // 6. Print Receipts (Only run AFTER successful DB update)
            const shopPrintResult = await printReceipt(mainWindow, settings.shop_printer, shopReceiptHTML);
          //  const kitchenPrintResult = await printReceipt(mainWindow, settings.kitchen_printer, kitchenReceiptHTML);
            
            // 7. Broadcast update
            broadcastToAll("orders-updated");
            
            return { 
                success: true, 
                message: "Payment confirmed and order marked as paid.",
                print_status: {
                    shop: shopPrintResult.message,
                }
            };
        } catch (error) {
            console.error("Error confirming payment and printing:", error);
            // Re-throw the error with a simplified message for the front end
            throw new Error(`Failed to confirm payment: ${error.message}`);
        }
    });
    // ... (rest of the handlers)
// db.js (Place inside the registerHandlers function, e.g., near other ipcMain.handle calls)

    // --- NEW: FETCH PAST ORDERS (Paid Orders) ---
    // --- NEW: FETCH PAST ORDERS (Paid Orders with Filters) ---
    ipcMain.handle('db:fetchPastOrders', async (event, { dateFrom, dateTo }) => {
        let query = `
            SELECT 
                s.id, s.price, s.products, s.desk_id, s.payment_mode, s.timestamp, 
                d.name AS desk_name
            FROM sales s 
            LEFT JOIN desk d ON s.desk_id = d.id 
            WHERE s.active = 'paid'
        `;
        const params = [];

        if (dateFrom) {
            // Filter from the start of the 'From' date
            query += ` AND s.timestamp >= ?`;
            params.push(`${dateFrom} 00:00:00`); 
        }
        if (dateTo) {
            // Filter up to the end of the 'To' date
            query += ` AND s.timestamp <= ?`;
            params.push(`${dateTo} 23:59:59`); 
        }

        query += ` ORDER BY s.timestamp DESC`;

        try {
            const [rows] = await db.query(query, params);
            
            // Parse JSON products before returning
            const parsedRows = rows.map(row => {
                let products = [];
                try {
                    products = typeof row.products === "string" ? JSON.parse(row.products) : row.products;
                } catch (e) {
                    console.error("JSON parse failed for products in paid order:", row.id);
                }
                
                return {
                    id: row.id,
                    price: parseFloat(row.price),
                    products: products,
                    desk_name: row.desk_name || `Table ID ${row.desk_id}`,
                    payment_mode: row.payment_mode,
                    paid_at: row.timestamp,
                };
            });
            return parsedRows;
        } catch (error) {
            console.error("Error fetching past orders:", error);
            throw new Error(`Failed to fetch past orders: ${error.message}`);
        }
    });

    // --- NEW: REMOVE ORDER (Used by orders.html) ---
    // ipcMain.handle('order-remove', async (event, id) => {
    //     try {
    //         const [result] = await db.query('DELETE FROM sales WHERE id = ?', [id]);
    //         if (result.affectedRows === 0) {
    //             throw new Error('Order not found or already deleted.');
    //         }
    //         return { success: true };
    //     } catch (error) {
    //         console.error("Error removing order:", error);
    //         throw new Error(`Failed to remove order: ${error.message}`);
    //     }
    // });
    // --- NEW: REMOVE ORDER (Used by orders.html) ---
    ipcMain.handle('order-remove', async (event, id) => {
        try {
            const [result] = await db.query('DELETE FROM sales WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                throw new Error('Order not found or already deleted.');
            }
            return { success: true };
        } catch (error) {
            console.error("Error removing order:", error);
            throw new Error(`Failed to remove order: ${error.message}`);
        }
    });
    
}


module.exports = registerHandlers;
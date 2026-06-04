const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { kv } = require('@vercel/kv');

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, '..', 'db.json');

app.use(cors());
app.use(express.json());

// Default database state
const defaultDb = {
  branches: [
    { id: 'sukhumvit', name: 'Sukhumvit Branch (HQ)' },
    { id: 'siam', name: 'Siam Paragon Branch' },
    { id: 'ari', name: 'Ari Branch' }
  ],
  suppliers: [
    { id: 'cp_dairy', name: 'CP Dairy Products', contact: 'sales@cpdairy.com', phone: '02-123-4567' },
    { id: 'bluekoff', name: 'Bluekoff Coffee Co.', contact: 'orders@bluekoff.com', phone: '02-987-6543' },
    { id: 'seafood_exp', name: 'Seafood Express', contact: 'fresh@seafoodexpress.co.th', phone: '02-555-1122' },
    { id: 'thai_fresh', name: 'Thai Fresh Produce', contact: 'order@thaifresh.com', phone: '02-444-5566' },
    { id: 'betagro', name: 'Betagro Group', contact: 'betagro-order@betagro.com', phone: '02-333-4444' },
    { id: 'ecopack', name: 'EcoPack Packaging', contact: 'sales@ecopack.co.th', phone: '02-888-9999' }
  ],
  inventory: [
    { id: 'item_1', name: 'Fresh Milk', unit: 'Gallon', parLevel: 10, currentStock: { sukhumvit: 12, siam: 15, ari: 4 }, price: 120, category: 'Dairy', supplierId: 'cp_dairy' },
    { id: 'item_2', name: 'Premium Espresso Beans', unit: 'kg', parLevel: 8, currentStock: { sukhumvit: 10, siam: 7, ari: 3 }, price: 450, category: 'Beverages', supplierId: 'bluekoff' },
    { id: 'item_3', name: 'Fresh Salmon Fillet', unit: 'kg', parLevel: 6, currentStock: { sukhumvit: 2, siam: 8, ari: 1 }, price: 650, category: 'Seafood', supplierId: 'seafood_exp' },
    { id: 'item_4', name: 'Avocado (Ripened)', unit: 'kg', parLevel: 12, currentStock: { sukhumvit: 15, siam: 10, ari: 14 }, price: 180, category: 'Produce', supplierId: 'thai_fresh' },
    { id: 'item_5', name: 'Takeaway Hot Cup 16oz', unit: 'Pack of 50', parLevel: 15, currentStock: { sukhumvit: 18, siam: 13, ari: 6 }, price: 150, category: 'Packaging', supplierId: 'ecopack' },
    { id: 'item_6', name: 'Chicken Breast Fillet', unit: 'kg', parLevel: 20, currentStock: { sukhumvit: 25, siam: 18, ari: 22 }, price: 95, category: 'Meat', supplierId: 'betagro' }
  ],
  settings: {
    telegramBotToken: '',
    telegramChatId: '',
    notificationsEnabled: false
  },
  logs: [
    {
      id: 'log_initial',
      timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
      type: 'system',
      message: 'Database initialized with standard inventory schema.',
      branchId: 'system'
    }
  ]
};

// Database Read/Write Helpers
async function readDb() {
  if (process.env.KV_REST_API_URL) {
    try {
      const data = await kv.get('inventory_db');
      return data || defaultDb;
    } catch (error) {
      console.error('Error reading from Vercel KV:', error);
      return defaultDb;
    }
  } else {
    try {
      if (!fs.existsSync(DB_PATH)) {
        await writeDb(defaultDb);
        return defaultDb;
      }
      const data = fs.readFileSync(DB_PATH, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Error reading database file:', error);
      return defaultDb;
    }
  }
}

async function writeDb(data) {
  if (process.env.KV_REST_API_URL) {
    try {
      await kv.set('inventory_db', data);
      return true;
    } catch (error) {
      console.error('Error writing to Vercel KV:', error);
      return false;
    }
  } else {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      console.error('Error writing database file:', error);
      return false;
    }
  }
}

// Telegram Helper
function sendTelegramMessage(token, chatId, text) {
  return new Promise((resolve, reject) => {
    if (!token || !chatId) {
      return reject(new Error('Bot Token and Chat ID are required'));
    }

    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    });

    const options = {
      hostname: 'api.telegram.org',
      port: 443,
      path: `/bot${token}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const response = JSON.parse(body);
          if (response.ok) {
            resolve(response.result);
          } else {
            reject(new Error(response.description || 'Telegram API Error'));
          }
        } catch (e) {
          reject(new Error('Failed to parse Telegram response'));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// --- API ROUTES ---

// Branches API
app.get('/api/branches', async (req, res) => {
  const db = await readDb();
  res.json(db.branches);
});

app.post('/api/branches', async (req, res) => {
  const db = await readDb();
  const newBranch = {
    id: req.body.id || 'branch_' + Date.now(),
    name: req.body.name
  };
  
  db.branches.push(newBranch);
  await writeDb(db);
  res.json({ success: true, branch: newBranch });
});

app.put('/api/branches/:id', async (req, res) => {
  const db = await readDb();
  const index = db.branches.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Branch not found' });
  
  db.branches[index].name = req.body.name || db.branches[index].name;
  await writeDb(db);
  res.json({ success: true, branch: db.branches[index] });
});

app.delete('/api/branches/:id', async (req, res) => {
  const db = await readDb();
  const index = db.branches.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Branch not found' });
  
  db.branches.splice(index, 1);
  await writeDb(db);
  res.json({ success: true });
});

// Suppliers API
app.get('/api/suppliers', async (req, res) => {
  const db = await readDb();
  res.json(db.suppliers);
});

// Settings API (Telegram Credentials)
app.get('/api/settings', async (req, res) => {
  const db = await readDb();
  res.json(db.settings);
});

app.post('/api/settings', async (req, res) => {
  const db = await readDb();
  db.settings = {
    telegramBotToken: req.body.telegramBotToken || '',
    telegramChatId: req.body.telegramChatId || '',
    notificationsEnabled: !!req.body.notificationsEnabled
  };
  await writeDb(db);
  res.json({ success: true, settings: db.settings });
});

// Test Telegram Credentials
app.post('/api/telegram/test', async (req, res) => {
  const { token, chatId } = req.body;
  const testMessage = `🔔 <b>Test Notification</b>\n\nYour Restaurant Smart Inventory Alert bot is successfully connected!\n🕒 <i>Time: ${new Date().toLocaleString('th-TH')}</i>`;
  
  try {
    await sendTelegramMessage(token, chatId, testMessage);
    res.json({ success: true, message: 'Test message sent successfully!' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Inventory items CRUD
app.get('/api/inventory', async (req, res) => {
  const db = await readDb();
  res.json(db.inventory);
});

app.post('/api/inventory', async (req, res) => {
  const db = await readDb();
  const newItem = {
    id: 'item_' + Date.now(),
    name: req.body.name,
    unit: req.body.unit,
    parLevel: parseFloat(req.body.parLevel) || 0,
    currentStock: {},
    price: parseFloat(req.body.price) || 0,
    category: req.body.category || 'General',
    supplierId: req.body.supplierId || ''
  };

  // Initialize stock for all branches as 0
  db.branches.forEach(b => {
    newItem.currentStock[b.id] = parseFloat(req.body.currentStock?.[b.id]) || 0;
  });

  db.inventory.push(newItem);
  await writeDb(db);
  res.json({ success: true, item: newItem });
});

app.put('/api/inventory/:id', async (req, res) => {
  const db = await readDb();
  const index = db.inventory.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  const existingItem = db.inventory[index];
  const updatedItem = {
    ...existingItem,
    name: req.body.name || existingItem.name,
    unit: req.body.unit || existingItem.unit,
    parLevel: parseFloat(req.body.parLevel) !== undefined ? parseFloat(req.body.parLevel) : existingItem.parLevel,
    price: parseFloat(req.body.price) !== undefined ? parseFloat(req.body.price) : existingItem.price,
    category: req.body.category || existingItem.category,
    supplierId: req.body.supplierId || existingItem.supplierId
  };

  // Merge branch stock
  if (req.body.currentStock) {
    db.branches.forEach(b => {
      if (req.body.currentStock[b.id] !== undefined) {
        updatedItem.currentStock[b.id] = parseFloat(req.body.currentStock[b.id]);
      }
    });
  }

  db.inventory[index] = updatedItem;
  await writeDb(db);
  res.json({ success: true, item: updatedItem });
});

app.delete('/api/inventory/:id', async (req, res) => {
  const db = await readDb();
  const index = db.inventory.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Item not found' });
  }

  db.inventory.splice(index, 1);
  await writeDb(db);
  res.json({ success: true });
});

// Stock-take endpoint (triggered from iPad)
app.post('/api/stocktake', async (req, res) => {
  const { branchId, counts, submittedBy } = req.body;
  const db = await readDb();

  if (!branchId) {
    return res.status(400).json({ success: false, error: 'Branch ID is required' });
  }

  const branch = db.branches.find(b => b.id === branchId);
  const branchName = branch ? branch.name : branchId;

  const lowStockAlerts = [];
  const timestamp = new Date().toISOString();

  // Process each count
  Object.keys(counts).forEach(itemId => {
    const item = db.inventory.find(i => i.id === itemId);
    if (item) {
      const prevStock = item.currentStock[branchId] || 0;
      const newStock = parseFloat(counts[itemId]);
      
      // Update DB stock level
      item.currentStock[branchId] = newStock;

      // Check if it is below par level
      if (newStock < item.parLevel) {
        const supplier = db.suppliers.find(s => s.id === item.supplierId);
        lowStockAlerts.push({
          itemId,
          name: item.name,
          unit: item.unit,
          currentStock: newStock,
          parLevel: item.parLevel,
          supplierName: supplier ? supplier.name : 'No Supplier Assigned',
          supplierPhone: supplier ? supplier.phone : '',
          supplierContact: supplier ? supplier.contact : '',
          shortage: item.parLevel - newStock
        });
      }

      // Log the individual item adjustment
      db.logs.push({
        id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        timestamp,
        type: 'stock_update',
        branchId,
        branchName,
        itemId,
        itemName: item.name,
        prevStock,
        newStock,
        user: submittedBy || 'Staff (iPad)'
      });
    }
  });

  // Write base stock updates to DB
  await writeDb(db);

  // Send Telegram Alerts if there are low stock items and notifications are enabled
  let telegramSent = false;
  let telegramError = null;

  if (lowStockAlerts.length > 0 && db.settings.notificationsEnabled && db.settings.telegramBotToken && db.settings.telegramChatId) {
    let alertMessage = `⚠️ <b>[LOW STOCK ALERT] - ${branchName.toUpperCase()}</b>\n`;
    alertMessage += `👤 Submitted By: <b>${submittedBy || 'Staff'}</b>\n`;
    alertMessage += `📅 Date: ${new Date().toLocaleString('th-TH')}\n\n`;
    alertMessage += `Items requiring attention:\n`;

    lowStockAlerts.forEach((alert, index) => {
      alertMessage += `${index + 1}. <b>${alert.name}</b>\n`;
      alertMessage += `   • Stock: <code>${alert.currentStock} / ${alert.parLevel} ${alert.unit}</code> (Shortage: <b>${alert.shortage.toFixed(1)}</b>)\n`;
      alertMessage += `   • Supplier: <b>${alert.supplierName}</b> (${alert.supplierPhone || 'N/A'})\n\n`;
    });

    alertMessage += `🛒 <i>Please generate purchase orders for these items immediately.</i>`;

    try {
      await sendTelegramMessage(db.settings.telegramBotToken, db.settings.telegramChatId, alertMessage);
      telegramSent = true;

      // Log Telegram Alert success
      db.logs.push({
        id: 'log_' + Date.now() + '_tg',
        timestamp: new Date().toISOString(),
        type: 'telegram_alert',
        branchId,
        branchName,
        message: `Sent low stock alert via Telegram containing ${lowStockAlerts.length} items.`,
        user: 'System'
      });
      await writeDb(db);
    } catch (err) {
      console.error('Failed to send Telegram notification:', err);
      telegramError = err.message;
      
      // Log Telegram Alert failure
      db.logs.push({
        id: 'log_' + Date.now() + '_tg_err',
        timestamp: new Date().toISOString(),
        type: 'system_error',
        branchId,
        branchName,
        message: `Failed to send Telegram alert: ${err.message}`,
        user: 'System'
      });
      await writeDb(db);
    }
  }

  res.json({
    success: true,
    branchName,
    processedCount: Object.keys(counts).length,
    alertsTriggeredCount: lowStockAlerts.length,
    alerts: lowStockAlerts,
    telegramSent,
    telegramError
  });
});

// Dashboard aggregates API
app.get('/api/dashboard', async (req, res) => {
  const db = await readDb();
  
  // Calculate analytics
  let totalValue = 0;
  let lowStockCountGlobal = 0;
  const itemsByBranchAndStatus = {};

  // Initialize status maps
  db.branches.forEach(b => {
    itemsByBranchAndStatus[b.id] = { safe: 0, warning: 0, critical: 0 };
  });

  const lowStockItems = [];

  db.inventory.forEach(item => {
    // Add value based on global stock sum * item price
    let globalStock = 0;
    
    db.branches.forEach(b => {
      const stock = item.currentStock[b.id] || 0;
      globalStock += stock;

      // Determine stock status for specific branch
      if (stock === 0) {
        itemsByBranchAndStatus[b.id].critical++;
      } else if (stock < item.parLevel) {
        itemsByBranchAndStatus[b.id].warning++;
      } else {
        itemsByBranchAndStatus[b.id].safe++;
      }
    });

    totalValue += globalStock * item.price;

    // Check if item is low stock globally (sum of stocks < parLevel * branches)
    let isLowInAnyBranch = false;
    db.branches.forEach(b => {
      if ((item.currentStock[b.id] || 0) < item.parLevel) {
        isLowInAnyBranch = true;
      }
    });

    if (isLowInAnyBranch) {
      lowStockCountGlobal++;
      lowStockItems.push(item);
    }
  });

  // Sort logs by date descending
  const recentLogs = [...db.logs].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 30);

  res.json({
    stats: {
      totalValue,
      lowStockCountGlobal,
      totalItemsCount: db.inventory.length,
      branchesCount: db.branches.length,
      suppliersCount: db.suppliers.length
    },
    itemsByBranchAndStatus,
    lowStockItems,
    recentLogs
  });
});

// Export the app for Vercel Serverless
module.exports = app;

// Start Server locally if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Smart Inventory server running on http://localhost:${PORT}`);
  });
}

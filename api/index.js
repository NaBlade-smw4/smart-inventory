const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { createClient } = require('@vercel/kv');

// Initialize KV client dynamically supporting multiple prefixes (KV, STORAGE, REDIS)
const kvUrl = process.env.KV_REST_API_URL || process.env.STORAGE_REST_API_URL || process.env.REDIS_REST_API_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.STORAGE_REST_API_TOKEN || process.env.REDIS_REST_API_TOKEN;

const kv = createClient({
  url: kvUrl || '',
  token: kvToken || ''
});

const app = express();
const PORT = process.env.PORT || 5000;
const DB_PATH = path.join(__dirname, '..', 'db.json');

app.use(cors());
app.use(express.json());

// Default database state (using minThreshold and normalLevel)
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
    { id: 'item_1', name: 'Fresh Milk', unit: 'Gallon', minThreshold: 10, normalLevel: 20, currentStock: { sukhumvit: 12, siam: 15, ari: 4 }, price: 120, category: 'Dairy', supplierId: 'cp_dairy' },
    { id: 'item_2', name: 'Premium Espresso Beans', unit: 'kg', minThreshold: 8, normalLevel: 16, currentStock: { sukhumvit: 10, siam: 7, ari: 3 }, price: 450, category: 'Beverages', supplierId: 'bluekoff' },
    { id: 'item_3', name: 'Fresh Salmon Fillet', unit: 'kg', minThreshold: 6, normalLevel: 12, currentStock: { sukhumvit: 2, siam: 8, ari: 1 }, price: 650, category: 'Seafood', supplierId: 'seafood_exp' },
    { id: 'item_4', name: 'Avocado (Ripened)', unit: 'kg', minThreshold: 12, normalLevel: 24, currentStock: { sukhumvit: 15, siam: 10, ari: 14 }, price: 180, category: 'Produce', supplierId: 'thai_fresh' },
    { id: 'item_5', name: 'Takeaway Hot Cup 16oz', unit: 'Pack of 50', minThreshold: 15, normalLevel: 30, currentStock: { sukhumvit: 18, siam: 13, ari: 6 }, price: 150, category: 'Packaging', supplierId: 'ecopack' },
    { id: 'item_6', name: 'Chicken Breast Fillet', unit: 'kg', minThreshold: 20, normalLevel: 40, currentStock: { sukhumvit: 25, siam: 18, ari: 22 }, price: 95, category: 'Meat', supplierId: 'betagro' }
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

// Helper to migrate schema from parLevel to minThreshold and normalLevel
function migrateDbSchema(data) {
  let migrated = false;
  if (data && Array.isArray(data.inventory)) {
    data.inventory = data.inventory.map(item => {
      // Migrate parLevel to minThreshold and normalLevel
      if (item.parLevel !== undefined && item.minThreshold === undefined) {
        item.minThreshold = item.parLevel;
        item.normalLevel = item.normalLevel !== undefined ? item.normalLevel : item.parLevel * 2;
        delete item.parLevel;
        migrated = true;
      }
      // Guarantee both fields exist
      if (item.minThreshold === undefined) {
        item.minThreshold = 0;
        migrated = true;
      }
      if (item.normalLevel === undefined) {
        item.normalLevel = item.minThreshold * 2;
        migrated = true;
      }
      return item;
    });
  }
  return migrated;
}

// Database Read/Write Helpers
async function readDb() {
  if (kvUrl && kvToken) {
    try {
      const data = await kv.get('inventory_db');
      if (!data) return defaultDb;
      
      // Auto migration check
      if (migrateDbSchema(data)) {
        await kv.set('inventory_db', data);
      }
      return data;
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
      const rawData = fs.readFileSync(DB_PATH, 'utf8');
      const data = JSON.parse(rawData);
      
      // Auto migration check
      if (migrateDbSchema(data)) {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
      }
      return data;
    } catch (error) {
      console.error('Error reading database file:', error);
      return defaultDb;
    }
  }
}

async function writeDb(data) {
  if (kvUrl && kvToken) {
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
  const saved = await writeDb(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้ กรุณาเชื่อมต่อ Vercel KV' });
  }
  res.json({ success: true, branch: newBranch });
});

app.put('/api/branches/:id', async (req, res) => {
  const db = await readDb();
  const index = db.branches.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Branch not found' });
  
  db.branches[index].name = req.body.name || db.branches[index].name;
  const saved = await writeDb(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้ กรุณาเชื่อมต่อ Vercel KV' });
  }
  res.json({ success: true, branch: db.branches[index] });
});

app.delete('/api/branches/:id', async (req, res) => {
  const db = await readDb();
  const index = db.branches.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Branch not found' });
  
  db.branches.splice(index, 1);
  const saved = await writeDb(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้ กรุณาเชื่อมต่อ Vercel KV' });
  }
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
  const saved = await writeDb(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกการตั้งค่าได้ กรุณาเชื่อมต่อ Vercel KV' });
  }
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
    minThreshold: parseFloat(req.body.minThreshold) || 0,
    normalLevel: parseFloat(req.body.normalLevel) || 0,
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
  const saved = await writeDb(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกรายการสินค้าได้ กรุณาเชื่อมต่อ Vercel KV' });
  }
  res.json({ success: true, item: newItem });
});

app.put('/api/inventory/:id', async (req, res) => {
  const db = await readDb();
  const index = db.inventory.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  const existingItem = db.inventory[index];
  const updatedItem = {
    ...existingItem,
    name: req.body.name || existingItem.name,
    unit: req.body.unit || existingItem.unit,
    minThreshold: req.body.minThreshold !== undefined ? parseFloat(req.body.minThreshold) : (existingItem.minThreshold !== undefined ? existingItem.minThreshold : existingItem.parLevel),
    normalLevel: req.body.normalLevel !== undefined ? parseFloat(req.body.normalLevel) : existingItem.normalLevel,
    price: req.body.price !== undefined ? parseFloat(req.body.price) : existingItem.price,
    category: req.body.category || existingItem.category,
    supplierId: req.body.supplierId || existingItem.supplierId
  };

  // Clean old fields if exist
  if (updatedItem.parLevel !== undefined) delete updatedItem.parLevel;

  // Merge branch stock
  if (req.body.currentStock) {
    db.branches.forEach(b => {
      if (req.body.currentStock[b.id] !== undefined) {
        updatedItem.currentStock[b.id] = parseFloat(req.body.currentStock[b.id]);
      }
    });
  }

  db.inventory[index] = updatedItem;
  const saved = await writeDb(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกข้อมูลได้ (หากใช้งานบน Vercel กรุณาตรวจสอบว่าได้ทำการเชื่อมต่อ Vercel KV ในเมนู Storage แล้ว)' });
  }
  res.json({ success: true, item: updatedItem });
});

app.delete('/api/inventory/:id', async (req, res) => {
  const db = await readDb();
  const index = db.inventory.findIndex(i => i.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ success: false, error: 'Item not found' });
  }

  db.inventory.splice(index, 1);
  const saved = await writeDb(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถลบรายการสินค้าได้ กรุณาเชื่อมต่อ Vercel KV' });
  }
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

      // Check if it is below or equal to the minimum threshold
      if (newStock <= item.minThreshold) {
        const supplier = db.suppliers.find(s => s.id === item.supplierId);
        const shortage = Math.max(0, item.normalLevel - newStock);
        
        lowStockAlerts.push({
          itemId,
          name: item.name,
          unit: item.unit,
          currentStock: newStock,
          minThreshold: item.minThreshold,
          normalLevel: item.normalLevel,
          supplierName: supplier ? supplier.name : 'No Supplier Assigned',
          supplierPhone: supplier ? supplier.phone : '',
          supplierContact: supplier ? supplier.contact : '',
          shortage: shortage
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
  const savedMain = await writeDb(db);
  if (!savedMain) {
    return res.status(500).json({ success: false, error: 'ไม่สามารถบันทึกผลการเช็คสต็อกได้ กรุณาเชื่อมต่อ Vercel KV' });
  }

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
      alertMessage += `   • สต็อกปัจจุบัน: <code>${alert.currentStock} / ${alert.minThreshold} ${alert.unit}</code> (ต่ำกว่าเกณฑ์ขั้นต่ำ!)\n`;
      alertMessage += `   • 🛒 แนะนำสั่งเพิ่ม: <b>${alert.shortage.toFixed(1)} ${alert.unit}</b> (เพื่อให้ถึงเกณฑ์ปกติ <b>${alert.normalLevel}</b>)\n`;
      alertMessage += `   • ผู้จัดจำหน่าย: <b>${alert.supplierName}</b> (${alert.supplierPhone || 'N/A'})\n\n`;
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
      } else if (stock <= item.minThreshold) {
        itemsByBranchAndStatus[b.id].warning++;
      } else {
        itemsByBranchAndStatus[b.id].safe++;
      }
    });

    totalValue += globalStock * item.price;

    // Check if item is low stock globally (sum of stocks <= minThreshold)
    let isLowInAnyBranch = false;
    db.branches.forEach(b => {
      if ((item.currentStock[b.id] || 0) <= item.minThreshold) {
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

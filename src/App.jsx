import React, { useState, useEffect } from 'react';
import IpadStockTake from './components/IpadStockTake';
import AdminDashboard from './components/AdminDashboard';
import ConfigPanel from './components/ConfigPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState('ipad'); // default to 'ipad' view
  const [theme, setTheme] = useState('dark');
  
  // Data State
  const [branches, setBranches] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [settings, setSettings] = useState({ telegramBotToken: '', telegramChatId: '', notificationsEnabled: false });
  const [dashboardData, setDashboardData] = useState({
    stats: { totalValue: 0, lowStockCountGlobal: 0, totalItemsCount: 0, branchesCount: 0, suppliersCount: 0 },
    itemsByBranchAndStatus: {},
    lowStockItems: [],
    recentLogs: []
  });

  const [loading, setLoading] = useState(true);
  
  // Custom Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const triggerToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      
      const [branchesRes, suppliersRes, inventoryRes, settingsRes, dashboardRes] = await Promise.all([
        fetch('/api/branches'),
        fetch('/api/suppliers'),
        fetch('/api/inventory'),
        fetch('/api/settings'),
        fetch('/api/dashboard')
      ]);

      const [branchesData, suppliersData, inventoryData, settingsData, dashboardDataVal] = await Promise.all([
        branchesRes.json(),
        suppliersRes.json(),
        inventoryRes.json(),
        settingsRes.json(),
        dashboardRes.json()
      ]);

      setBranches(branchesData);
      setSuppliers(suppliersData);
      setInventory(inventoryData);
      setSettings(settingsData);
      setDashboardData(dashboardDataVal);
    } catch (error) {
      console.error('Failed to load system data:', error);
      triggerToast('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบ Backend', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Theme effect
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Stock Audit Submit Handler
  const handleStockTakeSubmit = async (payload) => {
    try {
      const response = await fetch('/api/stocktake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      
      if (data.success) {
        if (data.telegramSent) {
          triggerToast(`✅ บันทึกสต็อกเรียบร้อย! ส่งแจ้งเตือน Telegram แล้ว`, 'success');
        } else if (data.alertsTriggeredCount > 0 && !data.telegramSent) {
          triggerToast(`📝 บันทึกสต็อกเรียบร้อย! มีสินค้าต่ำกว่าเกณฑ์ ${data.alertsTriggeredCount} รายการ (ไม่ได้เปิด Telegram)`, 'warning');
        } else {
          triggerToast(`✅ อัปเดตสต็อกสำหรับ ${data.branchName} เรียบร้อยแล้ว`, 'success');
        }
        
        // Refresh & Redirect to Admin Dashboard to audit outcomes
        await loadAllData();
        setActiveTab('dashboard');
      } else {
        triggerToast(`เกิดข้อผิดพลาด: ${data.error || 'ไม่สามารถส่งข้อมูลได้'}`, 'error');
      }
    } catch (err) {
      triggerToast('การส่งข้อมูลล้มเหลว กรุณาตรวจสอบสถานะเซิร์ฟเวอร์', 'error');
    }
  };

  // Settings Save Handler
  const handleSaveSettings = async (newSettings) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.settings);
        triggerToast('บันทึกการตั้งค่า Telegram เรียบร้อยแล้ว!', 'success');
        loadAllData();
      } else {
        triggerToast('ไม่สามารถบันทึกการตั้งค่าได้', 'error');
      }
    } catch (err) {
      triggerToast('ไม่สามารถเชื่อมต่อกับ Backend API ได้', 'error');
    }
  };

  // Test Telegram Notification Handler
  const handleTestTelegram = async ({ token, chatId }) => {
    try {
      const response = await fetch('/api/telegram/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, chatId })
      });
      const data = await response.json();
      if (data.success) {
        triggerToast('🔔 ส่งข้อความทดสอบ Telegram สำเร็จ!', 'success');
      } else {
        triggerToast(`❌ ข้อผิดพลาดจาก Telegram API: ${data.error}`, 'error');
      }
    } catch (err) {
      triggerToast('การส่งข้อความทดสอบล้มเหลว ตรวจสอบการเชื่อมต่อเครือข่าย', 'error');
    }
  };

  // Inventory CRUD handlers
  const handleAddItem = async (itemPayload) => {
    try {
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(itemPayload)
      });
      const data = await response.json();
      if (data.success) {
        triggerToast(`เพิ่ม ${itemPayload.name} ลงในระบบแล้ว!`, 'success');
        loadAllData();
      } else {
        triggerToast('ไม่สามารถเพิ่มรายการสินค้าได้', 'error');
      }
    } catch (err) {
      triggerToast('เกิดข้อผิดพลาดในการเชื่อมต่อ API', 'error');
    }
  };

  const handleDeleteItem = async (id) => {
    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        triggerToast('ลบรายการสินค้าออกจากระบบแล้ว', 'success');
        loadAllData();
      } else {
        triggerToast('ไม่สามารถลบรายการสินค้าได้', 'error');
      }
    } catch (err) {
      triggerToast('เกิดข้อผิดพลาดในการเชื่อมต่อ API', 'error');
    }
  };

  const handleEditItem = async (id, updatedPayload) => {
    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload)
      });
      const data = await response.json();
      if (data.success) {
        triggerToast('อัปเดตข้อมูลรายการสินค้าสำเร็จ!', 'success');
        loadAllData();
        return true;
      } else {
        triggerToast('ไม่สามารถแก้ไขรายการสินค้าได้', 'error');
        return false;
      }
    } catch (err) {
      triggerToast('เกิดข้อผิดพลาดในการเชื่อมต่อ API', 'error');
      return false;
    }
  };

  // Branch CRUD handlers
  const handleAddBranch = async (branchPayload) => {
    try {
      const response = await fetch('/api/branches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(branchPayload)
      });
      const data = await response.json();
      if (data.success) {
        triggerToast(`เพิ่มสาขา ${branchPayload.name} ลงในระบบแล้ว!`, 'success');
        loadAllData();
      } else {
        triggerToast('ไม่สามารถเพิ่มสาขาได้', 'error');
      }
    } catch (err) {
      triggerToast('เกิดข้อผิดพลาดในการเชื่อมต่อ API', 'error');
    }
  };

  const handleDeleteBranch = async (id) => {
    try {
      const response = await fetch(`/api/branches/${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        triggerToast('ลบสาขาออกจากระบบแล้ว', 'success');
        loadAllData();
      } else {
        triggerToast('ไม่สามารถลบสาขาได้', 'error');
      }
    } catch (err) {
      triggerToast('เกิดข้อผิดพลาดในการเชื่อมต่อ API', 'error');
    }
  };

  const handleEditBranch = async (id, updatedPayload) => {
    try {
      const response = await fetch(`/api/branches/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPayload)
      });
      const data = await response.json();
      if (data.success) {
        triggerToast('อัปเดตข้อมูลสาขาสำเร็จ!', 'success');
        loadAllData();
        return true;
      } else {
        triggerToast('ไม่สามารถแก้ไขข้อมูลสาขาได้', 'error');
        return false;
      }
    } catch (err) {
      triggerToast('เกิดข้อผิดพลาดในการเชื่อมต่อ API', 'error');
      return false;
    }
  };

  return (
    <div className="app-container">
      {/* Header Navbar */}
      <header className="glass-panel navbar">
        <div className="nav-logo">
          <span>📦</span>
          <span>Smart Resto</span>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px', background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            CHAIN PRO
          </span>
        </div>

        <nav className="nav-links">
          <button 
            className={`nav-tab ${activeTab === 'ipad' ? 'active' : ''}`}
            onClick={() => setActiveTab('ipad')}
          >
            📱 เช็คสต็อก (สำหรับพนักงาน)
          </button>
          <button 
            className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            📊 แดชบอร์ดเจ้าของร้าน
          </button>
          <button 
            className={`nav-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            ⚙️ ตั้งค่าระบบ
          </button>
        </nav>

        <div style={{ display: 'flex', gap: '10px' }}>
          {/* Light/Dark Toggle */}
          <button 
            onClick={toggleTheme} 
            className="btn btn-secondary"
            style={{ width: '40px', height: '40px', padding: '0', borderRadius: '50%', fontSize: '1.1rem' }}
            title={`สลับโหมดหน้าจอ`}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          
          <button 
            onClick={loadAllData} 
            className="btn btn-secondary"
            style={{ width: '40px', height: '40px', padding: '0', borderRadius: '50%', fontSize: '1rem' }}
            title="รีเฟรชข้อมูลระบบ"
          >
            🔄
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      {loading ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '80px 20px', flexGrow: 1 }}>
          <div style={{ fontSize: '3rem', animation: 'spin 1.5s linear infinite', display: 'inline-block', marginBottom: '16px' }}>
            ⏳
          </div>
          <p style={{ fontWeight: 600, fontSize: '1.2rem' }}>กำลังโหลดฐานข้อมูลและส่วนประกอบของระบบ...</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px' }}>กำลังเชื่อมต่อกับ Local API Server...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : (
        <main style={{ flexGrow: 1 }}>
          {activeTab === 'ipad' && (
            <IpadStockTake 
              branches={branches}
              inventory={inventory}
              onStockTakeSubmit={handleStockTakeSubmit}
              notification={toast}
            />
          )}

          {activeTab === 'dashboard' && (
            <AdminDashboard 
              dashboardData={dashboardData}
              branches={branches}
              suppliers={suppliers}
            />
          )}

          {activeTab === 'settings' && (
            <ConfigPanel 
              inventory={inventory}
              suppliers={suppliers}
              branches={branches}
              settings={settings}
              onSaveSettings={handleSaveSettings}
              onTestTelegram={handleTestTelegram}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onEditItem={handleEditItem}
              onAddBranch={handleAddBranch}
              onDeleteBranch={handleDeleteBranch}
              onEditBranch={handleEditBranch}
            />
          )}
        </main>
      )}

      {/* Toast Notification HUD */}
      {toast.show && (
        <div className={`notification-banner ${toast.type === 'error' ? 'banner-error' : 'banner-success'}`}>
          <span>{toast.type === 'error' ? '❌' : toast.type === 'warning' ? '⚠️' : '🔔'}</span>
          <span style={{ fontWeight: '500', fontSize: '0.925rem' }}>{toast.message}</span>
        </div>
      )}

      {/* Footer Branding */}
      <footer style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', padding: '16px 0', marginTop: '24px' }}>
        Smart Resto Enterprise Suite • ทำงานผ่านระบบ Local Node • ออกแบบมาเพื่อ iPad และ Desktop Analytics โดยเฉพาะ
      </footer>
    </div>
  );
}

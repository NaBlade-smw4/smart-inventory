import React, { useState } from 'react';

export default function ConfigPanel({ 
  inventory, 
  suppliers, 
  branches, 
  settings, 
  onSaveSettings, 
  onTestTelegram, 
  onAddItem, 
  onDeleteItem,
  onEditItem,
  onAddBranch,
  onDeleteBranch,
  onEditBranch
}) {
  // Telegram form state
  const [tgBotToken, setTgBotToken] = useState(settings.telegramBotToken || '');
  const [tgChatId, setTgChatId] = useState(settings.telegramChatId || '');
  const [tgEnabled, setTgEnabled] = useState(settings.notificationsEnabled || false);
  const [testingTg, setTestingTg] = useState(false);

  // New Item form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('หน่วย');
  const [newItemPar, setNewItemPar] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');
  const [newItemSupplier, setNewItemSupplier] = useState('');

  // Editing state
  const [editingItem, setEditingItem] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '', unit: '', parLevel: '', price: '', category: '', supplierId: ''
  });

  // Branch form state
  const [newBranchName, setNewBranchName] = useState('');
  const [editingBranch, setEditingBranch] = useState(null);
  const [editBranchForm, setEditBranchForm] = useState({ name: '' });

  const handleSaveSettingsSubmit = (e) => {
    e.preventDefault();
    onSaveSettings({
      telegramBotToken: tgBotToken,
      telegramChatId: tgChatId,
      notificationsEnabled: tgEnabled
    });
  };

  const handleTestTelegramSubmit = async () => {
    if (!tgBotToken || !tgChatId) {
      alert('กรุณากรอก Bot Token และ Chat ID ให้ครบถ้วนก่อนทำการทดสอบ');
      return;
    }
    setTestingTg(true);
    await onTestTelegram({ token: tgBotToken, chatId: tgChatId });
    setTestingTg(false);
  };

  const handleAddItemSubmit = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPar || !newItemPrice) {
      alert('กรุณากรอก ชื่อสินค้า, เกณฑ์ขั้นต่ำ และ ราคา ให้ครบถ้วน');
      return;
    }

    const payload = {
      name: newItemName,
      unit: newItemUnit,
      parLevel: parseFloat(newItemPar),
      price: parseFloat(newItemPrice),
      category: newItemCategory,
      supplierId: newItemSupplier || (suppliers[0]?.id || '')
    };

    onAddItem(payload);

    // Reset Form
    setNewItemName('');
    setNewItemUnit('หน่วย');
    setNewItemPar('');
    setNewItemPrice('');
    setNewItemCategory('General');
    setNewItemSupplier('');
  };

  const startEditing = (item) => {
    setEditingItem(item.id);
    setEditForm({
      name: item.name,
      unit: item.unit,
      parLevel: item.parLevel,
      price: item.price,
      category: item.category,
      supplierId: item.supplierId
    });
  };

  const saveEdit = (id) => {
    onEditItem(id, {
      name: editForm.name,
      unit: editForm.unit,
      parLevel: parseFloat(editForm.parLevel),
      price: parseFloat(editForm.price),
      category: editForm.category,
      supplierId: editForm.supplierId
    });
    setEditingItem(null);
  };

  const handleAddBranchSubmit = (e) => {
    e.preventDefault();
    if (!newBranchName.trim()) {
      alert('กรุณากรอกชื่อสาขา');
      return;
    }
    onAddBranch({ name: newBranchName });
    setNewBranchName('');
  };

  const startEditingBranch = (branch) => {
    setEditingBranch(branch.id);
    setEditBranchForm({ name: branch.name });
  };

  const saveEditBranch = (id) => {
    onEditBranch(id, { name: editBranchForm.name });
    setEditingBranch(null);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Settings Grid: Telegram Setup */}
      <div className="settings-grid">
        {/* Telegram Integration Panel */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            💬 ตั้งค่าการเชื่อมต่อ Telegram
          </h2>
          
          <form onSubmit={handleSaveSettingsSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', flexGrow: 1 }}>
            <div>
              <label className="form-label">Telegram Bot Token</label>
              <input
                type="text"
                placeholder="เช่น 123456789:ABCdefGhIJKlmNoPQRsTuvWxYz"
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={tgBotToken}
                onChange={(e) => setTgBotToken(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                สร้าง Bot Token ได้จาก <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>@BotFather</a> บน Telegram
              </span>
            </div>

            <div>
              <label className="form-label">Telegram Chat ID (ไอดีของกลุ่ม/แชนเนล หรือ แชทส่วนตัว)</label>
              <input
                type="text"
                placeholder="เช่น -1001234567890"
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                value={tgChatId}
                onChange={(e) => setTgChatId(e.target.value)}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                ไอดีปลายทางที่ต้องการให้บอทส่งข้อความแจ้งเตือนไปหา
              </span>
            </div>

            <div className="switch-control">
              <div>
                <span style={{ fontWeight: 600, display: 'block', fontSize: '0.95rem' }}>เปิดใช้งานการแจ้งเตือน Telegram</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ส่งการแจ้งเตือนทันทีเมื่อพบสต็อกต่ำกว่ากำหนด</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={tgEnabled}
                  onChange={(e) => setTgEnabled(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', paddingTop: '16px' }}>
              <button 
                type="button" 
                className="btn btn-secondary" 
                style={{ flexGrow: 1 }}
                onClick={handleTestTelegramSubmit}
                disabled={testingTg}
              >
                {testingTg ? 'กำลังส่ง...' : 'ทดสอบการส่งข้อความ ⚡'}
              </button>
              <button 
                type="submit" 
                className="btn btn-primary" 
                style={{ flexGrow: 1 }}
              >
                บันทึกการตั้งค่า
              </button>
            </div>
          </form>
        </div>

        {/* Info card for large chain operations */}
        <div className="glass-panel" style={{ background: 'var(--primary-glow)', borderColor: 'rgba(59, 130, 246, 0.2)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--primary)' }}>💡 เคล็ดลับจากร้านอาหารสาขาขนาดใหญ่</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.6' }}>
            ผู้บริหารธุรกิจร้านอาหารแฟรนไชส์และเชนขนาดใหญ่ใช้ระบบ <b>Par Levels</b> (เกณฑ์ขั้นต่ำ) อย่างเคร่งครัดเพื่อควบคุมต้นทุนและลดของเสีย:
          </p>
          <ul style={{ paddingLeft: '20px', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--text-muted)' }}>
            <li>
              <b>อันตรายของของหมดสต็อก:</b> ทำให้ลูกค้าต้องรอนาน และนำไปสู่รีวิวเชิงลบ ควรตั้งค่า Par level โดยอิงจากระยะเวลาจัดส่งของซัพพลายเออร์บวกเพิ่มความปลอดภัย 2 วัน
            </li>
            <li>
              <b>แจ้งเตือนรวมศูนย์:</b> แนะนำให้สร้างกลุ่ม Telegram ชื่อ <i>"[ชื่อร้าน] บริหารจัดการสต็อก"</i> เชิญผู้จัดการและเชฟเข้ากลุ่ม เพื่อให้ทุกคนเห็นการแจ้งเตือนพร้อมกัน
            </li>
            <li>
              <b>ความโปร่งใสในการตรวจสอบ:</b> การเช็คสต็อกผ่าน iPad บังคับให้พนักงานครัวต้องนับสินค้าจริงที่หน้างาน และมีการบันทึกชื่อผู้ตรวจเช็คทุกครั้ง
            </li>
          </ul>
        </div>
      </div>

      {/* Branch Management Panel */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🏢 จัดการสาขา (Branch Management)
        </h2>
        
        <form onSubmit={handleAddBranchSubmit} style={{ display: 'flex', gap: '16px', alignItems: 'end', marginBottom: '20px' }}>
          <div style={{ flexGrow: 1 }}>
            <label className="form-label">ชื่อสาขาใหม่</label>
            <input
              type="text"
              placeholder="เช่น สาขาทองหล่อ, สาขาลาดพร้าว"
              className="form-input"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px' }}>
            เพิ่มสาขา
          </button>
        </form>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>รหัสสาขา</th>
                <th>ชื่อสาขา</th>
                <th style={{ textAlign: 'right' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {branches.map(branch => {
                const isEditing = editingBranch === branch.id;
                
                return (
                  <tr key={branch.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{branch.id}</td>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                          value={editBranchForm.name}
                          onChange={(e) => setEditBranchForm({ name: e.target.value })}
                        />
                      ) : (
                        <div style={{ fontWeight: '600' }}>{branch.name}</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => setEditingBranch(null)}
                          >
                            ยกเลิก
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => saveEditBranch(branch.id)}
                          >
                            บันทึก
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => startEditingBranch(branch)}
                          >
                            แก้ไข
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => {
                              if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${branch.name}? ข้อมูลสต็อกที่ผูกกับสาขานี้อาจได้รับผลกระทบ`)) {
                                onDeleteBranch(branch.id);
                              }
                            }}
                          >
                            ลบ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add New Item Panel */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ➕ เพิ่มรายการสินค้าใหม่เข้าระบบ
        </h2>
        
        <form onSubmit={handleAddItemSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label className="form-label">ชื่อสินค้า</label>
            <input
              type="text"
              placeholder="เช่น เนื้อวากิว ริบอาย"
              className="form-input"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">หมวดหมู่</label>
            <select
              className="form-select"
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
            >
              <option value="Dairy">ผลิตภัณฑ์นม</option>
              <option value="Beverages">เครื่องดื่ม</option>
              <option value="Seafood">อาหารทะเล</option>
              <option value="Produce">ผักผลไม้</option>
              <option value="Packaging">บรรจุภัณฑ์</option>
              <option value="Meat">เนื้อสัตว์</option>
              <option value="General">ทั่วไป</option>
            </select>
          </div>

          <div>
            <label className="form-label">หน่วยนับ</label>
            <input
              type="text"
              placeholder="เช่น กก., แพ็ค, ลัง"
              className="form-input"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">เกณฑ์ขั้นต่ำ (Par Threshold)</label>
            <input
              type="number"
              placeholder="จำนวนขั้นต่ำ"
              className="form-input"
              value={newItemPar}
              onChange={(e) => setNewItemPar(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">ราคาต่อหน่วย (บาท)</label>
            <input
              type="number"
              placeholder="ต้นทุนต่อหน่วย"
              className="form-input"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">ซัพพลายเออร์ที่จัดส่ง</label>
            <select
              className="form-select"
              value={newItemSupplier}
              onChange={(e) => setNewItemSupplier(e.target.value)}
            >
              <option value="">เลือกซัพพลายเออร์</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div style={{ gridColumn: '1 / -1', justifySelf: 'end', marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '12px 30px' }}>
              เพิ่มเข้าระบบ
            </button>
          </div>
        </form>
      </div>

      {/* Database Inventory Table (CRUD list) */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚙️ รายการสินค้าทั้งหมดในระบบ (Master Inventory List)
        </h2>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>รายละเอียดสินค้า</th>
                <th>หมวดหมู่</th>
                <th>เกณฑ์ขั้นต่ำ</th>
                <th>ราคา (บาท)</th>
                <th>ซัพพลายเออร์</th>
                <th style={{ textAlign: 'right' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map(item => {
                const isEditing = editingItem === item.id;
                const supplier = suppliers.find(s => s.id === (isEditing ? editForm.supplierId : item.supplierId));

                return (
                  <tr key={item.id}>
                    <td>
                      {isEditing ? (
                        <input
                          type="text"
                          className="form-input"
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      ) : (
                        <div style={{ fontWeight: '600' }}>
                          {item.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({item.unit})</span>
                        </div>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="form-select"
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                          value={editForm.category}
                          onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                        >
                          <option value="Dairy">ผลิตภัณฑ์นม</option>
                          <option value="Beverages">เครื่องดื่ม</option>
                          <option value="Seafood">อาหารทะเล</option>
                          <option value="Produce">ผักผลไม้</option>
                          <option value="Packaging">บรรจุภัณฑ์</option>
                          <option value="Meat">เนื้อสัตว์</option>
                          <option value="General">ทั่วไป</option>
                        </select>
                      ) : (
                        item.category === 'Dairy' ? 'ผลิตภัณฑ์นม' : item.category === 'Beverages' ? 'เครื่องดื่ม' : item.category === 'Seafood' ? 'อาหารทะเล' : item.category === 'Produce' ? 'ผักผลไม้' : item.category === 'Packaging' ? 'บรรจุภัณฑ์' : item.category === 'Meat' ? 'เนื้อสัตว์' : item.category
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input
                            type="number"
                            className="form-input"
                            style={{ padding: '6px 10px', fontSize: '0.85rem', width: '80px' }}
                            value={editForm.parLevel}
                            onChange={(e) => setEditForm({ ...editForm, parLevel: e.target.value })}
                          />
                          <span style={{ fontSize: '0.8rem' }}>{editForm.unit}</span>
                        </div>
                      ) : (
                        <b>{item.parLevel} {item.unit}</b>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          type="number"
                          className="form-input"
                          style={{ padding: '6px 10px', fontSize: '0.85rem', width: '100px' }}
                          value={editForm.price}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        />
                      ) : (
                        `${item.price?.toLocaleString()} ฿`
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <select
                          className="form-select"
                          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                          value={editForm.supplierId}
                          onChange={(e) => setEditForm({ ...editForm, supplierId: e.target.value })}
                        >
                          {suppliers.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        supplier ? supplier.name : 'ไม่มีซัพพลายเออร์'
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => setEditingItem(null)}
                          >
                            ยกเลิก
                          </button>
                          <button 
                            className="btn btn-primary" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => saveEdit(item.id)}
                          >
                            บันทึก
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => startEditing(item)}
                          >
                            แก้ไข
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px' }}
                            onClick={() => {
                              if (confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบ ${item.name} ออกจากระบบ?`)) {
                                onDeleteItem(item.id);
                              }
                            }}
                          >
                            ลบ
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
    </div>
  );
}

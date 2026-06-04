import React, { useState, useEffect } from 'react';

export default function IpadStockTake({ branches, inventory, onStockTakeSubmit, notification }) {
  const [selectedBranch, setSelectedBranch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ทั้งหมด');
  const [counts, setCounts] = useState({});
  const [staffName, setStaffName] = useState('');
  const [showSummary, setShowSummary] = useState(false);
  const [modifiedItems, setModifiedItems] = useState(new Set());

  // Initialize counts based on selected branch stock
  useEffect(() => {
    if (branches.length > 0 && !selectedBranch) {
      setSelectedBranch(branches[0].id);
    }
  }, [branches, selectedBranch]);

  useEffect(() => {
    if (selectedBranch && inventory.length > 0) {
      const initialCounts = {};
      inventory.forEach(item => {
        initialCounts[item.id] = item.currentStock[selectedBranch] !== undefined 
          ? item.currentStock[selectedBranch] 
          : 0;
      });
      setCounts(initialCounts);
      setModifiedItems(new Set());
    }
  }, [selectedBranch, inventory]);

  const handleIncrement = (itemId) => {
    setCounts(prev => {
      const current = parseFloat(prev[itemId]) || 0;
      const updated = current + 1;
      
      const newModified = new Set(modifiedItems);
      newModified.add(itemId);
      setModifiedItems(newModified);

      return { ...prev, [itemId]: updated };
    });
  };

  const handleDecrement = (itemId) => {
    setCounts(prev => {
      const current = parseFloat(prev[itemId]) || 0;
      if (current <= 0) return prev;
      const updated = Math.max(0, current - 1);
      
      const newModified = new Set(modifiedItems);
      newModified.add(itemId);
      setModifiedItems(newModified);

      return { ...prev, [itemId]: updated };
    });
  };

  const handleCountChange = (itemId, val) => {
    const numericVal = val === '' ? '' : Math.max(0, parseFloat(val) || 0);
    setCounts(prev => ({ ...prev, [itemId]: numericVal }));
    
    const newModified = new Set(modifiedItems);
    newModified.add(itemId);
    setModifiedItems(newModified);
  };

  const handlePresetSelect = (itemId, presetValue) => {
    setCounts(prev => ({ ...prev, [itemId]: presetValue }));
    
    const newModified = new Set(modifiedItems);
    newModified.add(itemId);
    setModifiedItems(newModified);
  };

  // Get list of unique categories
  const categoriesMap = {
    'Dairy': 'ผลิตภัณฑ์นม',
    'Beverages': 'เครื่องดื่ม',
    'Seafood': 'อาหารทะเล',
    'Produce': 'ผักผลไม้',
    'Packaging': 'บรรจุภัณฑ์',
    'Meat': 'เนื้อสัตว์',
    'General': 'ทั่วไป'
  };

  const getThaiCategory = (cat) => categoriesMap[cat] || cat;

  const rawCategories = [...new Set(inventory.map(item => item.category))];
  const categories = ['ทั้งหมด', ...rawCategories.map(getThaiCategory)];

  // Filter items
  const filteredItems = inventory.filter(item => {
    const itemCatThai = getThaiCategory(item.category);
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          itemCatThai.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ทั้งหมด' || itemCatThai === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getStockStatus = (item, count) => {
    const currentCount = parseFloat(count) || 0;
    if (currentCount === 0) return 'critical';
    if (currentCount < item.parLevel) return 'warning';
    return 'safe';
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'critical') return 'badge-critical';
    if (status === 'warning') return 'badge-warning';
    return 'badge-success';
  };

  const handleSubmitClick = () => {
    if (!staffName.trim()) {
      alert('กรุณากรอกชื่อพนักงานผู้ตรวจเช็คก่อนกดยืนยัน');
      return;
    }
    setShowSummary(true);
  };

  const handleConfirmSubmit = () => {
    setShowSummary(false);
    onStockTakeSubmit({
      branchId: selectedBranch,
      counts,
      submittedBy: staffName
    });
  };

  // Calculations for summary modal
  const lowStockCount = filteredItems.filter(item => {
    const val = counts[item.id] !== undefined ? counts[item.id] : 0;
    return val < item.parLevel;
  }).length;

  const totalItemsCount = inventory.length;
  const progressPercent = Math.round((modifiedItems.size / totalItemsCount) * 100) || 0;

  return (
    <div className="ipad-container animate-fade-in">
      <div className="glass-panel ipad-header">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label className="form-label">สาขาที่กำลังเช็คสต็อก</label>
            <select 
              className="form-select" 
              style={{ minWidth: '220px' }}
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label">ชื่อพนักงานผู้ตรวจเช็ค</label>
            <input 
              type="text" 
              placeholder="เช่น สมชาย, นิติภูมิ" 
              className="form-input"
              style={{ minWidth: '200px' }}
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
            />
          </div>
        </div>

        {/* Progress Tracker */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '220px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>ความคืบหน้าการเช็ค:</span>
            <span style={{ fontWeight: 'bold' }}>{modifiedItems.size} / {totalItemsCount} รายการ ({progressPercent}%)</span>
          </div>
          <div className="chart-track" style={{ height: '8px' }}>
            <div className="chart-fill" style={{ width: `${progressPercent}%`, backgroundColor: 'var(--primary)' }}></div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flexGrow: 1, position: 'relative' }}>
          <input 
            type="text" 
            placeholder="🔍 ค้นหาสินค้า..." 
            className="form-input"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
          {categories.map(cat => (
            <button
              key={cat}
              className={`btn ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '0.85rem' }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* iPad Counting Grid */}
      <div className="ipad-grid">
        {filteredItems.map(item => {
          const currentCount = counts[item.id] !== undefined ? counts[item.id] : 0;
          const status = getStockStatus(item, currentCount);
          const isModified = modifiedItems.has(item.id);

          return (
            <div 
              key={item.id} 
              className={`glass-panel ipad-card status-${status}`}
              style={{
                borderColor: isModified ? 'rgba(59, 130, 246, 0.4)' : 'var(--panel-border)',
                transform: isModified ? 'scale(1.01)' : 'none',
              }}
            >
              <div className="ipad-card-header">
                <div>
                  <h3 className="ipad-item-name">{item.name}</h3>
                  <p className="ipad-item-meta">หมวดหมู่: {getThaiCategory(item.category)}</p>
                  <p className="ipad-item-meta" style={{ color: 'var(--text-muted)' }}>
                    เกณฑ์สั่งซื้อขั้นต่ำ (Par): <b>{item.parLevel} {item.unit}</b>
                  </p>
                </div>
                <span className={`badge ${getStatusBadgeClass(status)}`}>
                  {status === 'critical' ? '🔴 หมด' : status === 'warning' ? '🟡 ใกล้หมด' : '🟢 ปกติ'}
                </span>
              </div>

              {/* Tappable Presets */}
              <div className="presets-container">
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', alignSelf: 'center', marginRight: '4px' }}>ทางลัด:</span>
                {[0, Math.ceil(item.parLevel / 2), item.parLevel, Math.ceil(item.parLevel * 1.5)].map(val => (
                  <button
                    key={val}
                    type="button"
                    className={`preset-btn ${currentCount === val ? 'active' : ''}`}
                    onClick={() => handlePresetSelect(item.id, val)}
                  >
                    {val}
                  </button>
                ))}
              </div>

              <div className="ipad-card-actions">
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  หน่วย: <b>{item.unit}</b>
                </div>

                <div className="qty-control">
                  <button 
                    type="button"
                    className="qty-btn" 
                    onClick={() => handleDecrement(item.id)}
                    style={{ padding: '12px' }}
                  >
                    -
                  </button>
                  <input
                    type="number"
                    className="qty-input"
                    value={currentCount}
                    onChange={(e) => handleCountChange(item.id, e.target.value)}
                  />
                  <button 
                    type="button"
                    className="qty-btn" 
                    onClick={() => handleIncrement(item.id)}
                    style={{ padding: '12px' }}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Submission Action Bar */}
      <div 
        className="glass-panel" 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          position: 'sticky', 
          bottom: '16px', 
          marginTop: '16px',
          boxShadow: '0 -10px 25px rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(59, 130, 246, 0.2)'
        }}
      >
        <div>
          <h4 style={{ fontSize: '1.1rem' }}>ยืนยันการนับสต็อก</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            บันทึกข้อมูลเข้าสาขา: <b>{branches.find(b => b.id === selectedBranch)?.name || selectedBranch}</b>
          </p>
        </div>

        <button 
          onClick={handleSubmitClick} 
          className="btn btn-primary"
          style={{ padding: '14px 28px', fontSize: '1.05rem', boxShadow: '0 0 15px rgba(59, 130, 246, 0.3)' }}
        >
          บันทึกยอดสต็อก
        </button>
      </div>

      {/* Summary / Confirmation Modal */}
      {showSummary && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in">
            <div className="modal-header">
              <h2 style={{ fontSize: '1.4rem' }}>ยืนยันการบันทึกข้อมูล</h2>
              <button className="modal-close" onClick={() => setShowSummary(false)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p>
                คุณกำลังบันทึกยอดสต็อกสำหรับ:<br />
                📍 <b>{branches.find(b => b.id === selectedBranch)?.name}</b><br />
                👤 ผู้ตรวจเช็ค: <b>{staffName}</b>
              </p>

              <div 
                className="glass-panel" 
                style={{ 
                  background: 'rgba(0, 0, 0, 0.2)', 
                  padding: '16px', 
                  borderRadius: 'var(--border-radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>รายการที่ตรวจสอบแล้ว:</span>
                  <b>{modifiedItems.size} รายการ</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>รายการที่ไม่ได้แก้ไข:</span>
                  <b>{totalItemsCount - modifiedItems.size} รายการ</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: lowStockCount > 0 ? 'var(--warning)' : 'inherit' }}>
                  <span>รายการที่ต่ำกว่าเกณฑ์สั่งซื้อ:</span>
                  <b>{lowStockCount} รายการ</b>
                </div>
              </div>

              {lowStockCount > 0 && (
                <div 
                  style={{ 
                    border: '1px solid rgba(245, 158, 11, 0.3)', 
                    background: 'var(--warning-glow)', 
                    padding: '12px', 
                    borderRadius: 'var(--border-radius-sm)',
                    fontSize: '0.85rem',
                    color: 'var(--warning)'
                  }}
                >
                  ⚠️ <b>จะมีการแจ้งเตือนสต็อกต่ำ</b> ถูกรวบรวมและส่งไปยัง Telegram โดยอัตโนมัติ!
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setShowSummary(false)}>
                  ยกเลิก
                </button>
                <button className="btn btn-primary" onClick={handleConfirmSubmit}>
                  ยืนยันและบันทึก
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

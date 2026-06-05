import React, { useState } from 'react';

export default function AdminDashboard({ dashboardData, branches, suppliers }) {
  const { stats, itemsByBranchAndStatus, lowStockItems, recentLogs } = dashboardData;
  const [selectedSupplierDraft, setSelectedSupplierDraft] = useState(null);
  const [draftOrderContent, setDraftOrderContent] = useState('');

  const formatTime = (isoString) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' ' + 
             date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    } catch (e) {
      return isoString;
    }
  };

  const getLogTypeBadge = (type) => {
    switch (type) {
      case 'stock_update': return <span className="badge badge-primary">เช็คสต็อก</span>;
      case 'telegram_alert': return <span className="badge badge-warning">ส่ง Telegram</span>;
      case 'system_error': return <span className="badge badge-critical">ข้อผิดพลาด</span>;
      default: return <span className="badge badge-secondary">ระบบ</span>;
    }
  };

  // Group low stock items by supplier to generate consolidated Purchase Orders (POs)
  const generateConsolidatedDraft = (supplierId) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    if (!supplier) return;

    const supplierItems = lowStockItems.filter(item => item.supplierId === supplierId);
    
    let draftText = `📍 **ร่างใบสั่งซื้อสินค้า (PO)**\n`;
    draftText += `ถึง: **${supplier.name}** (${supplier.contact || 'N/A'})\n`;
    draftText += `โทรศัพท์: ${supplier.phone || 'N/A'}\n`;
    draftText += `วันที่: ${new Date().toLocaleDateString('th-TH')}\n`;
    draftText += `--------------------------------------------\n`;
    draftText += `เรียน ฝ่ายขาย ${supplier.name},\n\n`;
    draftText += `ทางร้านมีความประสงค์จะสั่งซื้อสินค้าเร่งด่วนตามรายการด้านล่างนี้:\n\n`;

    supplierItems.forEach(item => {
      // Calculate consolidated shortage or branch details
      let itemDetails = '';
      branches.forEach(b => {
        const stock = item.currentStock[b.id] || 0;
        const minVal = item.minThreshold !== undefined ? item.minThreshold : item.parLevel;
        const normalVal = item.normalLevel !== undefined ? item.normalLevel : minVal * 2;

        if (stock <= minVal) {
          const shortage = Math.max(0, normalVal - stock);
          itemDetails += `  • ${b.name}: สั่งซื้อ **${shortage.toFixed(1)} ${item.unit}** (สต็อกปัจจุบัน: ${stock} / เกณฑ์ขั้นต่ำ: ${minVal} / เป้าหมายปกติ: ${normalVal})\n`;
        }
      });

      draftText += `📦 **${item.name}**\n${itemDetails}\n`;
    });

    draftText += `รบกวนยืนยันการรับออเดอร์และแจ้งกำหนดการส่งสินค้าครับ/ค่ะ\n\n`;
    draftText += `ขอแสดงความนับถือ,\n`;
    draftText += `ทีมงาน Smart Resto`;

    setSelectedSupplierDraft(supplier);
    setDraftOrderContent(draftText);
  };

  const handleCopyDraft = () => {
    navigator.clipboard.writeText(draftOrderContent);
    alert('คัดลอกร่างใบสั่งซื้อลงคลิปบอร์ดแล้ว!');
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* KPIs Grid */}
      <div className="kpis-grid">
        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--primary-glow)', color: 'var(--primary)' }}>
            💰
          </div>
          <div className="kpi-details">
            <h3>มูลค่าสต็อกโดยประมาณ</h3>
            <p>{stats?.totalValue?.toLocaleString('th-TH')} <span style={{ fontSize: '1rem', fontWeight: 500 }}>บาท</span></p>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--critical-glow)', color: 'var(--critical)' }}>
            ⚠️
          </div>
          <div className="kpi-details">
            <h3>สินค้าสต็อกต่ำ</h3>
            <p>{stats?.lowStockCountGlobal || 0} <span style={{ fontSize: '1rem', fontWeight: 500 }}>รายการ</span></p>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'var(--success-glow)', color: 'var(--success)' }}>
            🏢
          </div>
          <div className="kpi-details">
            <h3>สาขาทั้งหมด</h3>
            <p>{stats?.branchesCount || 0} <span style={{ fontSize: '1rem', fontWeight: 500 }}>สาขา</span></p>
          </div>
        </div>

        <div className="glass-panel kpi-card">
          <div className="kpi-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            🤝
          </div>
          <div className="kpi-details">
            <h3>ซัพพลายเออร์</h3>
            <p>{stats?.suppliersCount || 0} <span style={{ fontSize: '1rem', fontWeight: 500 }}>ราย</span></p>
          </div>
        </div>
      </div>

      {/* Main Stats Block */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        
        {/* Branch Stock Breakdown */}
        <div className="glass-panel">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            📊 สถานะสต็อกแยกตามสาขา
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '10px' }}>
            {branches.map(branch => {
              const counts = itemsByBranchAndStatus?.[branch.id] || { safe: 0, warning: 0, critical: 0 };
              const total = counts.safe + counts.warning + counts.critical;
              
              const safePct = total ? (counts.safe / total) * 100 : 0;
              const warnPct = total ? (counts.warning / total) * 100 : 0;
              const critPct = total ? (counts.critical / total) * 100 : 0;

              return (
                <div key={branch.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                    <span style={{ fontWeight: 600 }}>{branch.name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      รวม: <b>{total}</b> รายการ
                    </span>
                  </div>
                  
                  {/* Multi-segment progress bar */}
                  <div style={{ display: 'flex', height: '24px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
                    {counts.safe > 0 && (
                      <div 
                        style={{ width: `${safePct}%`, background: 'var(--success)' }} 
                        title={`ปกติ: ${counts.safe}`}
                      />
                    )}
                    {counts.warning > 0 && (
                      <div 
                        style={{ width: `${warnPct}%`, background: 'var(--warning)' }} 
                        title={`ต่ำกว่าเกณฑ์: ${counts.warning}`}
                      />
                    )}
                    {counts.critical > 0 && (
                      <div 
                        style={{ width: `${critPct}%`, background: 'var(--critical)' }} 
                        title={`หมด: ${counts.critical}`}
                      />
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }}/>
                      ปกติ: {counts.safe}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }}/>
                      ต่ำกว่าเกณฑ์ขั้นต่ำ: {counts.warning}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--critical)' }}/>
                      หมด: {counts.critical}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Telegram Integration Quick Status */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🤖 ระบบแจ้งเตือน Telegram อัตโนมัติ
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
              เมื่อผลการเช็คสต็อกต่ำกว่าเกณฑ์ขั้นต่ำที่กำหนด ระบบจะส่งการแจ้งเตือนและคำนวณยอดสั่งซื้อด่วนไปยัง Telegram ทันที
            </p>

            <div 
              className="glass-panel" 
              style={{ 
                background: 'rgba(0,0,0,0.15)', 
                border: '1px dashed var(--panel-border)', 
                padding: '16px', 
                borderRadius: 'var(--border-radius-md)' 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '0.9rem' }}>
                <span>สถานะการแจ้งเตือน:</span>
                {lowStockItems.length > 0 ? (
                  <span className="badge badge-warning">มีรายการรอสั่งซื้อ</span>
                ) : (
                  <span className="badge badge-success">สต็อกปกติ</span>
                )}
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                สามารถตั้งค่า Telegram Bot Token และ Chat ID ได้ที่หน้า <b>ตั้งค่าระบบ</b>
              </p>
            </div>
          </div>
          
          <div style={{ borderTop: '1px solid var(--panel-border)', paddingTop: '16px', marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ระบบแนะนำสั่งซื้ออัตโนมัติ (Auto-PO)</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 'bold' }}>เปิดใช้งาน ✅</span>
          </div>
        </div>
      </div>

      {/* Critical Reorder Panel */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🚨 ศูนย์สั่งซื้อสินค้า (สร้างแบบร่าง PO อัตโนมัติ)
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '16px' }}>
          รายการสินค้าด้านล่างนี้มีจำนวนต่ำกว่าหรือเท่ากับเกณฑ์ขั้นต่ำ กดปุ่ม **สร้างใบสั่งซื้อ** เพื่อดูแบบร่างคำสั่งซื้อที่จัดกลุ่มตามซัพพลายเออร์แล้ว
        </p>

        {lowStockItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: '3rem', marginBottom: '10px' }}>🎉</p>
            <p style={{ fontWeight: 'bold' }}>สินค้าทุกรายการมีจำนวนเพียงพอ!</p>
            <p style={{ fontSize: '0.85rem' }}>ไม่ต้องสั่งซื้อสินค้าเพิ่มเติมในขณะนี้</p>
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ชื่อสินค้า</th>
                  <th>หมวดหมู่</th>
                  <th>ระดับสต็อกแต่ละสาขา</th>
                  <th>เกณฑ์เตือน (Min) / เป้าหมาย (Normal)</th>
                  <th>ซัพพลายเออร์ / จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {lowStockItems.map(item => {
                  const supplier = suppliers.find(s => s.id === item.supplierId);
                  const minVal = item.minThreshold !== undefined ? item.minThreshold : item.parLevel;
                  const normalVal = item.normalLevel !== undefined ? item.normalLevel : minVal * 2;
                  
                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: '600' }}>{item.name}</td>
                      <td>{item.category === 'Dairy' ? 'ผลิตภัณฑ์นม' : item.category === 'Beverages' ? 'เครื่องดื่ม' : item.category === 'Seafood' ? 'อาหารทะเล' : item.category === 'Produce' ? 'ผักผลไม้' : item.category === 'Packaging' ? 'บรรจุภัณฑ์' : item.category === 'Meat' ? 'เนื้อสัตว์' : item.category}</td>
                      <td>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {branches.map(b => {
                            const stock = item.currentStock[b.id] || 0;
                            const isLow = stock <= minVal;
                            return (
                              <span 
                                key={b.id} 
                                className={`badge ${isLow ? 'badge-critical' : 'badge-success'}`}
                                style={{ textTransform: 'none', fontSize: '0.7rem' }}
                              >
                                {b.name.split(' ')[0]}: {stock}
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td>
                        <b>{minVal} {item.unit}</b> <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>/</span> <b>{normalVal} {item.unit}</b>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {supplier ? supplier.name : 'ไม่ได้ระบุ'}
                          </span>
                          {supplier && (
                            <button 
                              className="btn btn-secondary" 
                              style={{ padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px', minWidth: 'max-content' }}
                              onClick={() => generateConsolidatedDraft(item.supplierId)}
                            >
                              สร้างใบสั่งซื้อ
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Audit Log / Activity */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📜 ประวัติการใช้งานระบบ (Live Audit Log)
        </h2>

        <div 
          style={{ 
            maxHeight: '300px', 
            overflowY: 'auto', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '8px',
            paddingRight: '4px'
          }}
        >
          {recentLogs && recentLogs.length > 0 ? (
            recentLogs.map((log) => (
              <div 
                key={log.id} 
                className="glass-panel" 
                style={{ 
                  padding: '12px 18px', 
                  borderRadius: 'var(--border-radius-md)', 
                  background: 'rgba(0,0,0,0.15)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '12px',
                  border: '1px solid rgba(255,255,255,0.03)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {getLogTypeBadge(log.type)}
                  <div>
                    <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>
                      {log.type === 'stock_update' ? (
                        <>
                          บันทึกสต็อก <b>{log.itemName}</b>: <code>{log.prevStock}</code> ➔ <b>{log.newStock}</b>
                        </>
                      ) : log.type === 'telegram_alert' ? (
                        <>ส่งการแจ้งเตือนสต็อกต่ำไปยัง Telegram เรียบร้อยแล้ว</>
                      ) : (
                        log.message
                      )}
                    </p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📍 สาขา: <b>{log.branchName || log.branchId}</b> | ผู้ใช้: <b>{log.user}</b>
                    </p>
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {formatTime(log.timestamp)}
                </div>
              </div>
            ))
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>ยังไม่มีประวัติการใช้งาน</p>
          )}
        </div>
      </div>

      {/* PO Draft Modal */}
      {selectedSupplierDraft && (
        <div className="modal-overlay">
          <div className="modal-content animate-fade-in" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem' }}>ร่างใบสั่งซื้อสินค้ารวม (PO)</h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>ซัพพลายเออร์: {selectedSupplierDraft.name}</p>
              </div>
              <button className="modal-close" onClick={() => setSelectedSupplierDraft(null)}>×</button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <textarea
                className="form-input"
                style={{ 
                  fontFamily: 'monospace', 
                  fontSize: '0.85rem', 
                  minHeight: '260px', 
                  background: 'var(--bg-color)', 
                  border: '1px solid var(--panel-border)',
                  lineHeight: '1.4'
                }}
                value={draftOrderContent}
                readOnly
              />
              
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                💡 คุณสามารถคัดลอกร่างใบสั่งซื้อนี้เพื่อส่งผ่าน อีเมล, LINE, WhatsApp หรือ Telegram ให้กับซัพพลายเออร์ได้ทันที
              </p>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedSupplierDraft(null)}>
                  ปิด
                </button>
                <button className="btn btn-primary" onClick={handleCopyDraft}>
                  คัดลอกร่าง PO
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

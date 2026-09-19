import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLeadContext } from '../store/LeadContext.js';
import { FileText, Printer, X, ShieldAlert, History, Search } from 'lucide-react';
import { calculateSettlement } from '../utils/settlementCalculator.js';
import { ToastNotificationContainer, type ToastData } from '../components/ToastNotification.js';



export const HistoryPage = () => {
  const { getHistorySettlements } = useLeadContext();
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [toasts, setToasts] = useState([]);

  const addToast = (toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const items = await getHistorySettlements();
      setHistoryItems(items);
    } catch (err) {
      console.error('Failed to load settlement history:', err);
      setError('Failed to load settlement history. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const filteredHistory = useMemo(() => {
    return historyItems.filter(item => {
      const matchSearch =
        !searchTerm ||
        item.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.carBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.carModel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.garageName && item.garageName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.numberPlate && item.numberPlate.toLowerCase().includes(searchTerm.toLowerCase()));

      let matchDate = true;
      if (filterDate) {
        const d = new Date(item.createdAt);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        matchDate = `${year}-${month}-${day}` === filterDate;
      }

      return matchSearch && matchDate;
    });
  }, [historyItems, searchTerm, filterDate]);

  const handlePrintSettlement = (settlement) => {
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      addToast({
        type: 'warning',
        title: 'Popup Blocked',
        message: 'Please allow popups to generate and print the settlement statement.',
      });
      return;
    }

    const lineItems = (settlement.billing?.lineItems || []).map(item => ({
      name: item.name,
      amount: Number(item.amount) || 0,
      splitEnabled: !!item.splitEnabled,
      mechhelpPct: Number(item.mechhelpPct) ?? 20,
      garagePct: Number(item.garagePct) ?? 80,
    }));
    const paidTo = settlement.billing?.paidTo || 'garage';
    const discount = settlement.billing?.discount ?? 0;

    const calc = calculateSettlement(lineItems, paidTo, discount);
    const rawMechhelp = calc.totalMechhelpEntitled + calc.discount;
    const adjustedMechhelp = calc.totalMechhelpEntitled;
    const garageTotal = calc.totalGarageEntitled;
    const totalCharged = calc.totalAmount;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Archived Settlement Statement - ${settlement.customerName}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1f2937; padding: 32px; font-size: 13px; line-height: 1.5; background: #fff; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
            .logo { font-size: 24px; font-weight: 800; color: #1e40af; letter-spacing: -0.5px; }
            .subtitle { color: #6b7280; font-size: 12px; margin-top: 3px; font-weight: 500; }
            .meta { text-align: right; font-size: 12px; color: #4b5563; }
            .section { margin-bottom: 24px; }
            .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 8px; letter-spacing: 0.5px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; background: #f9fafb; padding: 14px; border-radius: 8px; border: 1px solid #e5e7eb; }
            .info-item span { display: block; font-size: 11px; color: #6b7280; text-transform: uppercase; margin-bottom: 2px; }
            .info-item strong { font-size: 13px; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 8px; }
            th { background: #f3f4f6; color: #374151; font-weight: 600; text-align: left; padding: 9px 12px; font-size: 11px; text-transform: uppercase; border-bottom: 1.5px solid #e5e7eb; }
            td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; font-size: 12.5px; }
            .summary-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-top: 16px; }
            .row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .row.bold { font-weight: 700; }
            .divider { border-top: 1px solid #e5e7eb; margin: 10px 0; }
            .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 11px; }
            @media print {
              body { padding: 0; }
              @page { margin: 1.5cm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">MECHHELP PARTNERS</div>
              <div class="subtitle">Archived Booking Billing &amp; Settlement Statement</div>
            </div>
            <div class="meta">
              <div><strong>Statement Date:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
              <div><strong>Garage:</strong> ${settlement.garageName || 'Partner Garage'}</div>
              <div><strong>Status:</strong> Finally Settled</div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Booking Details</div>
            <div class="info-grid">
              <div class="info-item"><span>Customer Name</span><strong>${settlement.customerName}</strong></div>
              <div class="info-item"><span>Vehicle</span><strong>${settlement.carBrand} ${settlement.carModel}${settlement.numberPlate ? ` (${settlement.numberPlate})` : ''}</strong></div>
              <div class="info-item"><span>Booking Date</span><strong>${new Date(settlement.bookingDate).toLocaleDateString('en-GB')}</strong></div>
              <div class="info-item"><span>Payment Collected By</span><strong style="text-transform: capitalize;">${settlement.billing?.paidTo || 'N/A'}</strong></div>
            </div>
          </div>

          <div class="section">
            <div class="section-title">Sold Services / Line Items</div>
            <table>
              <thead>
                <tr>
                  <th>Item Description</th>
                  <th>Split Ratio</th>
                  <th style="text-align: right;">Gross Amount</th>
                  <th style="text-align: right;">MechHelp Share</th>
                  <th style="text-align: right;">Garage Share</th>
                </tr>
              </thead>
              <tbody>
                ${lineItems.map(item => `
                  <tr>
                    <td><strong>${item.name}</strong></td>
                    <td>${item.splitEnabled ? `${item.mechhelpPct}% / ${item.garagePct}%` : 'Split Disabled (100% Garage)'}</td>
                    <td style="text-align: right;">₹${item.amount.toFixed(2)}</td>
                    <td style="text-align: right;">${item.splitEnabled ? `₹${(item.amount * item.mechhelpPct / 100).toFixed(2)}` : '₹0.00'}</td>
                    <td style="text-align: right;">₹${(item.splitEnabled ? item.amount * item.garagePct / 100 : item.amount).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="summary-card">
            <div class="row bold">
              <span>Total Amount (charged to customer):</span>
              <span>₹${totalCharged.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div class="row" style="color: #4b5563;">
              <span>MechHelp Entitled (before discount):</span>
              <span>₹${rawMechhelp.toFixed(2)}</span>
            </div>
            ${discount > 0 ? `
              <div class="row" style="color: #dc2626;">
                <span>Discount (borne by MechHelp):</span>
                <span>− ₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            ` : ''}
            <div class="row bold" style="color: #111827;">
              <span>MechHelp Entitled (after discount):</span>
              <span style="${adjustedMechhelp < 0 ? 'color: #dc2626;' : ''}">₹${adjustedMechhelp.toFixed(2)}</span>
            </div>
            <div class="row" style="color: #4b5563;">
              <span>Total Garage Entitled:</span>
              <span>₹${garageTotal.toFixed(2)}</span>
            </div>
            <div class="divider"></div>
            <div class="row bold" style="font-size: 14px;">
              <span>Net Settlement Effect:</span>
              <span style="color: ${settlement.netAmount > 0 ? '#16a34a' : settlement.netAmount < 0 ? '#dc2626' : '#4b5563'};">
                ${settlement.netAmount > 0 ? 'Garage owes MechHelp' : 'MechHelp owes Garage'} ₹${Math.abs(settlement.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div class="footer">
            Generated automatically by MechHelp CRM — Official Archived Settlement Document
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  return (
    <div className="settlements-page animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={24} style={{ color: 'var(--accent-primary)' }} />
            <h1>Settlement History</h1>
          </div>
          <p>Archived bookings marked Settlement across all partner garages</p>
        </div>
      </div>

      {error && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <ShieldAlert size={18} /><span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '2.2rem' }}
            placeholder="Search by customer, vehicle, garage, or plate..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem 0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
          <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Filter Date:</label>
          <input
            type="date"
            className="form-input"
            style={{ padding: '0.25rem 0.5rem', width: 'auto', minWidth: '130px', fontSize: '0.875rem', border: 'none', background: 'transparent' }}
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
          {filterDate && (
            <button type="button" className="btn-icon" onClick={() => setFilterDate('')} title="Clear date filter">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}><p>Loading archived settlements...</p></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Garage</th>
                <th>Customer / Vehicle</th>
                <th>Total Amount</th>
                <th>Collected By</th>
                <th>Net Effect</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {searchTerm || filterDate ? 'No matching archived settlement records found.' : 'No bookings marked Final Settlement yet.'}
                  </td>
                </tr>
              ) : (
                filteredHistory.map((s) => (
                  <tr key={s.id} className="settlement-row" onClick={() => setSelectedSettlement(s)}>
                    <td>{new Date(s.createdAt).toLocaleDateString('en-GB')}</td>
                    <td>
                      <strong style={{ color: 'var(--accent-primary)' }}>{s.garageName || 'Garage'}</strong>
                    </td>
                    <td>
                      <strong>{s.customerName}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {s.carBrand} {s.carModel}{s.numberPlate ? ` • ${s.numberPlate}` : ''}
                      </div>
                    </td>
                    <td>₹{s.billing?.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}</td>
                    <td>
                      <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                        {s.billing?.paidTo || '-'}
                      </span>
                    </td>
                    <td>
                      <strong className={s.netAmount > 0 ? 'text-green' : s.netAmount < 0 ? 'text-red' : 'text-gray'}>
                        {s.netAmount > 0 ? '+' : ''}{s.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </td>
                    <td>
                      <span className="badge badge-green" style={{ backgroundColor: 'rgba(22, 163, 74, 0.15)', color: '#16a34a', border: '1px solid rgba(22, 163, 74, 0.3)' }}>
                        Finally Settled
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm flex items-center justify-center"
                        onClick={(e) => { e.stopPropagation(); setSelectedSettlement(s); }}
                        title="View Billing Breakdown"
                      >
                        <FileText size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Billing Breakdown Modal (Read-Only mode for History) */}
      {selectedSettlement && createPortal(
        <div className="modal-overlay" style={{ zIndex: 1100 }}>
          <div
            className="modal-content surface-panel animate-fade-in"
            style={{
              maxWidth: '550px',
              maxHeight: 'calc(100vh - 12rem)',
              overflowY: 'auto',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-light)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div className="modal-header">
              <h2>Billing Breakdown — Archived</h2>
              <button onClick={() => setSelectedSettlement(null)} className="btn-icon">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.875rem' }}>
              <div className="breakdown-section" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div><span className="breakdown-label">Customer:</span><strong>{selectedSettlement.customerName}</strong></div>
                  <div><span className="breakdown-label">Garage:</span><strong>{selectedSettlement.garageName || 'N/A'}</strong></div>
                  <div><span className="breakdown-label">Vehicle:</span><span>{selectedSettlement.carBrand} {selectedSettlement.carModel}{selectedSettlement.numberPlate ? ` (${selectedSettlement.numberPlate})` : ''}</span></div>
                  <div><span className="breakdown-label">Booking Date:</span><span>{new Date(selectedSettlement.bookingDate).toLocaleDateString('en-GB')}</span></div>
                  <div><span className="breakdown-label">Payment Collected By:</span><strong style={{ textTransform: 'capitalize' }}>{selectedSettlement.billing?.paidTo}</strong></div>
                  <div><span className="breakdown-label">Archived Status:</span><strong style={{ color: '#16a34a' }}>Finally Settled</strong></div>
                </div>
              </div>

              <div className="breakdown-section" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Line Items</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {(selectedSettlement.billing?.lineItems || []).map((item, idx) => (
                    <div key={item.id || idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem', borderRadius: '4px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
                      <div>
                        <strong>{item.name}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {item.splitEnabled ? `Split (${item.mechhelpPct}/${item.garagePct})` : 'Split disabled (100% to Garage)'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div>₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                        {item.splitEnabled && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            MH: ₹{(item.amount * item.mechhelpPct / 100).toFixed(2)} | G: ₹{(item.amount * item.garagePct / 100).toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Total Amount (charged to customer):</span>
                  <strong>₹{selectedSettlement.billing?.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>

                {(() => {
                  const lineItems = (selectedSettlement.billing?.lineItems || []).map(item => ({
                    name: item.name,
                    amount: Number(item.amount) || 0,
                    splitEnabled: !!item.splitEnabled,
                    mechhelpPct: Number(item.mechhelpPct) ?? 20,
                    garagePct: Number(item.garagePct) ?? 80,
                  }));
                  const paidTo = selectedSettlement.billing?.paidTo || 'garage';
                  const discount = selectedSettlement.billing?.discount ?? 0;

                  const calc = calculateSettlement(lineItems, paidTo, discount);
                  const rawMechhelp = calc.totalMechhelpEntitled + calc.discount;
                  const adjustedMechhelp = calc.totalMechhelpEntitled;
                  const garageTotal = calc.totalGarageEntitled;

                  return (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>MechHelp Entitled (before discount):</span>
                        <span>₹{rawMechhelp.toFixed(2)}</span>
                      </div>
                      {calc.discount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--danger)' }}>
                          <span>Discount (borne by MechHelp):</span>
                          <span>− ₹{calc.discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <strong>MechHelp Entitled (after discount):</strong>
                        <strong style={{ color: adjustedMechhelp < 0 ? 'var(--danger)' : 'inherit' }}>₹{adjustedMechhelp.toFixed(2)}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <span>Total Garage Entitled:</span>
                        <span>₹{garageTotal.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}

                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                  <span>Net Settlement Effect:</span>
                  <strong className={selectedSettlement.netAmount > 0 ? 'text-green' : selectedSettlement.netAmount < 0 ? 'text-red' : 'text-gray'}>
                    {selectedSettlement.netAmount > 0 ? 'Garage owes MechHelp' : 'MechHelp owes Garage'}
                    <div style={{ fontSize: '1.1rem', textAlign: 'right', marginTop: '0.1rem' }}>
                      ₹{Math.abs(selectedSettlement.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </div>
                  </strong>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <button
                type="button"
                className="btn btn-secondary flex items-center gap-1.5"
                onClick={() => handlePrintSettlement(selectedSettlement)}
              >
                <Printer size={16} /> Print
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedSettlement(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <ToastNotificationContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
};

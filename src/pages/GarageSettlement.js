import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLeadContext } from '../store/LeadContext.js';
import { ChevronLeft, Landmark, FileText, CheckCircle2, ShieldAlert, Plus, Trash2, X, Printer, UserPlus, Pencil } from 'lucide-react';
import { calculateSettlement } from '../../shared/settlementCalculator.js';
import { AddDirectCustomerModal } from '../components/AddDirectCustomerModal.js';
import { EditBookingModal } from '../components/EditBookingModal.js';
import { ConfirmationModal } from '../components/ConfirmationModal.js';
import { ToastNotificationContainer, type ToastData } from '../components/ToastNotification.js';
import './GarageSettlement.css';





// ─── Manage Garages Modal ────────────────────────────────────────────────────



const ManageGaragesModal = ({ garages, onClose, onAdd, onRemove }) => {
  const [tab, setTab] = useState('add');
  const [newGarageName, setNewGarageName] = useState('');
  const [selectedGarageId, setSelectedGarageId] = useState('');
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleAdd = async () => {
    if (!newGarageName.trim()) { setLocalError('Enter a garage name.'); return; }
    try {
      setSaving(true); setLocalError(null); setSuccess(null);
      await onAdd(newGarageName.trim());
      setSuccess(`"${newGarageName.trim()}" added successfully.`);
      setNewGarageName('');
    } catch (err) {
      setLocalError(err.message || 'Failed to add garage.');
    } finally { setSaving(false); }
  };

  const handleRemove = async () => {
    if (!selectedGarageId) { setLocalError('Select a garage to remove.'); return; }
    const garage = garages.find(g => g.id === selectedGarageId);
    if (!garage) return;
    try {
      setSaving(true); setLocalError(null); setSuccess(null);
      await onRemove(garage.id, garage.balance);
      setSuccess(`"${garage.name}" has been archived.`);
      setSelectedGarageId('');
    } catch (err) {
      setLocalError(err.message || 'Failed to remove garage.');
    } finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content surface-panel animate-fade-in" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h2>Manage Garages</h2>
          <button onClick={onClose} className="btn-icon"><XIcon size={20} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', padding: '0 1.5rem' }}>
          {(['add', 'remove'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => { setTab(t); setLocalError(null); setSuccess(null); }}
              style={{
                background: 'none', border: 'none', padding: '0.75rem 1rem',
                fontWeight: tab === t ? 600 : 400,
                color: tab === t ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: tab === t ? '2px solid var(--accent-primary)' : '2px solid transparent',
                cursor: 'pointer', fontSize: '0.9rem', textTransform: 'capitalize'
              }}
            >{t === 'add' ? '+ Add Garage' : '✕ Remove Garage'}</button>
          ))}
        </div>

        <div className="modal-body">
          {localError && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>{localError}</span>
            </div>
          )}
          {success && (
            <div style={{ backgroundColor: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              ✓ {success}
            </div>
          )}

          {tab === 'add' && (
            <div>
              <label className="form-label">Garage Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Sunrise Auto Works"
                value={newGarageName}
                onChange={e => setNewGarageName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
                disabled={saving}
                style={{ marginBottom: '1rem' }}
              />
              <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={handleAdd} disabled={saving}>
                <Plus size={16} style={{ marginRight: '0.5rem' }} />
                {saving ? 'Adding...' : 'Add Garage'}
              </button>
            </div>
          )}

          {tab === 'remove' && (
            <div>
              <label className="form-label">Select Garage to Archive</label>
              <select
                className="form-select"
                value={selectedGarageId}
                onChange={e => setSelectedGarageId(e.target.value)}
                disabled={saving}
                style={{ marginBottom: '0.5rem' }}
              >
                <option value="">Choose a garage...</option>
                {garages.map(g => (
                  <option key={g.id} value={g.id}>
                    {g.name}{g.balance !== 0 ? ` — ⚠ Balance: ₹${Math.abs(g.balance).toFixed(2)}` : ' — Settled'}
                  </option>
                ))}
              </select>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Archived garages are hidden from new bookings but historical records are preserved.
                Only garages with a ₹0 balance can be archived.
              </p>
              <button type="button" className="btn btn-danger" style={{ width: '100%' }} onClick={handleRemove} disabled={saving || !selectedGarageId}>
                <Trash2 size={16} style={{ marginRight: '0.5rem' }} />
                {saving ? 'Archiving...' : 'Archive Garage'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Record Payment Modal ────────────────────────────────────────────────────



const RecordPaymentModal = ({ garageName, currentBalance, onClose, onRecord }) => {
  const [amountStr, setAmountStr] = useState('');
  const [direction, setDirection] = useState(() => {
    if (currentBalance < 0) return 'mechhelp_to_garage';
    if (currentBalance > 0) return 'garage_to_mechhelp';
    return 'mechhelp_to_garage';
  });
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState(null);

  const outstanding = Math.abs(currentBalance);
  const enteredAmount = Number(amountStr) || 0;

  // Compose balance linearly based on selected direction:
  // - mechhelp_to_garage (+amount): reduces what we owe (or increases what garage owes us)
  // - garage_to_mechhelp (-amount): reduces what garage owes us (or increases what we owe)
  const calculatedNewBalance = direction === 'mechhelp_to_garage'
    ? currentBalance + enteredAmount
    : currentBalance - enteredAmount;

  const directionText = direction === 'mechhelp_to_garage'
    ? `We are paying ${garageName}`
    : `${garageName} is paying us`;

  const handleRecord = async () => {
    if (!amountStr || enteredAmount <= 0) { setLocalError('Enter a valid payment amount.'); return; }
    try {
      setSaving(true); setLocalError(null);
      await onRecord(enteredAmount, direction);
    } catch (err) {
      setLocalError(err.message || 'Failed to record payment.');
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content surface-panel animate-fade-in" style={{ maxWidth: '460px' }}>
        <div className="modal-header">
          <h2>Record Payment</h2>
          <button onClick={onClose} className="btn-icon"><XIcon size={20} /></button>
        </div>
        <div className="modal-body">
          {/* Outstanding Balance Banner */}
          <div style={{ padding: '0.875rem 1rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {garageName} — Current Balance
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: currentBalance > 0 ? 'var(--success)' : currentBalance < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
              {currentBalance === 0 ? 'Settled (₹0.00)' : `${currentBalance > 0 ? "You're owed +" : "You owe "}₹${outstanding.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
            </div>
          </div>

          {localError && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <ShieldAlert size={16} /><span>{localError}</span>
            </div>
          )}

          {/* Explicit Direction Selector Cards */}
          <label className="form-label" style={{ marginBottom: '0.5rem' }}>Payment Direction</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <button
              type="button"
              onClick={() => setDirection('mechhelp_to_garage')}
              disabled={saving}
              style={{
                padding: '0.875rem 0.75rem',
                borderRadius: '8px',
                border: direction === 'mechhelp_to_garage' ? '2px solid var(--danger)' : '1px solid var(--border-light)',
                backgroundColor: direction === 'mechhelp_to_garage' ? 'var(--danger-bg)' : 'var(--bg-secondary)',
                color: direction === 'mechhelp_to_garage' ? 'var(--danger)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                MechHelp → Garage
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                We are paying {garageName}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDirection('garage_to_mechhelp')}
              disabled={saving}
              style={{
                padding: '0.875rem 0.75rem',
                borderRadius: '8px',
                border: direction === 'garage_to_mechhelp' ? '2px solid var(--success)' : '1px solid var(--border-light)',
                backgroundColor: direction === 'garage_to_mechhelp' ? 'var(--success-bg)' : 'var(--bg-secondary)',
                color: direction === 'garage_to_mechhelp' ? 'var(--success)' : 'var(--text-secondary)',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Garage → MechHelp
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.85 }}>
                {garageName} is paying us
              </div>
            </button>
          </div>

          {/* Amount Input */}
          <label className="form-label">Payment Amount (₹)</label>
          <input
            type="number"
            className="form-input"
            placeholder="e.g. 5000"
            value={amountStr}
            onChange={e => setAmountStr(e.target.value)}
            min={0.01}
            disabled={saving}
            style={{ marginBottom: '1rem' }}
            autoFocus
          />

          {/* Live Dynamic Preview */}
          {enteredAmount > 0 && (
            <div style={{ padding: '0.875rem', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Action:</span>
                <strong>{directionText} ₹{enteredAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.35rem', marginTop: '0.35rem' }}>
                <span>Resulting Balance:</span>
                <strong style={{ color: calculatedNewBalance === 0 ? 'var(--text-secondary)' : calculatedNewBalance > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {calculatedNewBalance === 0
                    ? '₹0 (Settled)'
                    : `${calculatedNewBalance > 0 ? "You're owed +" : "You owe "}₹${Math.abs(calculatedNewBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
                </strong>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleRecord} disabled={saving || enteredAmount <= 0}>
              <CheckCircle2 size={16} style={{ marginRight: '0.25rem' }} />
              {saving ? 'Recording...' : 'Record Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export const GarageSettlement = () => {
  const { getGaragesWithBalances, getGarageSettlements, getAllSettlements, settleGarage, addGarage, removeGarage, recordPayment, markFinalSettlement, deleteSettlement } = useLeadContext();

  // Navigation states
  const [activeGarageId, setActiveGarageId] = useState(null);
  const [activeGarageName, setActiveGarageName] = useState('');
  const [selectedSettlement, setSelectedSettlement] = useState(null);
  const [editingSettlement, setEditingSettlement] = useState(null);

  // Whether the currently active view is the MechHelp master ledger (not a real garage)
  const isMasterLedger = activeGarageId === 'MECHHELP_MASTER';

  // Data states
  const [garages, setGarages] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [garageBalance, setGarageBalance] = useState(0);
  
  // Filter state
  const [filterDate, setFilterDate] = useState('');

  // Modal states
  const [showManageModal, setShowManageModal]     = useState(false);
  const [showPaymentModal, setShowPaymentModal]   = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);

  // Toast & Custom Confirmation Modal states
  const [toasts, setToasts] = useState([]);
  const [confirmModalState, setConfirmModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'primary' | 'warning' | 'success';
    onConfirm: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: async () => {},
  });

  const addToast = (toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const dismissToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  // Loading & error states
  const [loadingGarages, setLoadingGarages] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load Level 1: Garages list
  const loadGarages = async () => {
    try {
      setLoadingGarages(true);
      setError(null);
      const data = await getGaragesWithBalances();
      setGarages(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load garages list. Please refresh.');
    } finally {
      setLoadingGarages(false);
    }
  };

  useEffect(() => { loadGarages(); }, []);

  // Load Level 2: Garage settlements detail (or master ledger if MECHHELP_MASTER)
  useEffect(() => {
    if (activeGarageId) {
      const loadDetails = async () => {
        try {
          setLoadingDetails(true);
          setError(null);
          if (activeGarageId === 'MECHHELP_MASTER') {
            const data = await getAllSettlements();
            setSettlements(data.settlements);
            setGarageBalance(0); // No single balance for master ledger
          } else {
            const data = await getGarageSettlements(activeGarageId);
            setSettlements(data.settlements);
            setGarageBalance(data.balance);
          }
        } catch (err) {
          console.error(err);
          setError(`Failed to load details for ${activeGarageName}.`);
        } finally {
          setLoadingDetails(false);
        }
      };
      loadDetails();
    } else {
      setSettlements([]);
      setGarageBalance(0);
      setFilterDate('');
    }
  }, [activeGarageId, activeGarageName]);

  // Derived filtered settlements
  const filteredSettlements = useMemo(() => {
    if (!filterDate) return settlements;
    return settlements.filter(s => {
      const d = new Date(s.createdAt);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}` === filterDate;
    });
  }, [settlements, filterDate]);

  // Sort garages by absolute balance descending
  const sortedGarages = useMemo(() =>
    [...garages].sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
    [garages]
  );

  // ─── Overall summary figures ───────────────────────────────────────────────
  const summary = useMemo(() => {
    let totalOwedToGarages = 0;   // sum of negative balances (we owe them)
    let totalOwedByGarages = 0;   // sum of positive balances (they owe us)
    garages.forEach(g => {
      if (g.balance < 0) totalOwedToGarages += Math.abs(g.balance);
      else if (g.balance > 0) totalOwedByGarages += g.balance;
    });
    return {
      totalOwedToGarages: Math.round(totalOwedToGarages * 100) / 100,
      totalOwedByGarages: Math.round(totalOwedByGarages * 100) / 100,
      net: Math.round((totalOwedByGarages - totalOwedToGarages) * 100) / 100,
    };
  }, [garages]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleAddGarage = async (name) => {
    await addGarage(name);
    await loadGarages();
  };

  const handleRemoveGarage = async (garageId: string, balance: number) => {
    await removeGarage(garageId, balance);
    await loadGarages();
  };

  const handleRecordPayment = async (amount: number, direction: 'mechhelp_to_garage' | 'garage_to_mechhelp') => {
    if (!activeGarageId) return;
    setActionLoading(true);
    try {
      await recordPayment(activeGarageId, amount, direction, garageBalance);
      // Reload detail view and garage list
      const data = await getGarageSettlements(activeGarageId);
      setSettlements(data.settlements);
      setGarageBalance(data.balance);
      await loadGarages();
      setShowPaymentModal(false);
      addToast({
        type: 'success',
        title: '✓ Payment recorded successfully',
      });
    } catch (err) {
      throw err; // bubble up to modal's error handler
    } finally {
      setActionLoading(false);
    }
  };

  const handlePrintSettlement = (settlement) => {
    const printWindow = window.open('', '_blank', 'width=850,height=950');
    if (!printWindow) {
      addToast({
        type: 'warning',
        title: 'Popup Blocked',
        message: 'Please allow popups to generate and print the settlement PDF statement.',
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
          <title>Settlement Statement - ${settlement.customerName}</title>
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
              <div class="subtitle">Vehicle Booking Billing & Settlement Statement</div>
            </div>
            <div class="meta">
              <div><strong>Statement Date:</strong> ${new Date().toLocaleDateString('en-GB')}</div>
              <div><strong>Garage:</strong> ${activeGarageName || 'Partner Garage'}</div>
              <div><strong>Status:</strong> ${settlement.settled ? 'Settled' : 'Outstanding'}</div>
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
            Generated automatically by MechHelp CRM — Official Garage Settlement Document
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

  const handleFinalSettlement = (settlement) => {
    if (!settlement) return;
    setConfirmModalState({
      isOpen: true,
      title: 'Finalize Settlement?',
      message: 'Are you sure you want to mark this booking as finally settled?\n\nThis will archive the record to Settlement History.',
      confirmText: 'Final Settlement',
      cancelText: 'Cancel',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setError(null);
          await markFinalSettlement(settlement.id, settlement.billing?.id);
          setSelectedSettlement(null);
          if (activeGarageId) {
            if (activeGarageId === 'MECHHELP_MASTER') {
              const data = await getAllSettlements();
              setSettlements(data.settlements);
            } else {
              const data = await getGarageSettlements(activeGarageId);
              setSettlements(data.settlements);
              setGarageBalance(data.balance);
            }
          }
          await loadGarages();
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
          addToast({
            type: 'success',
            title: '✓ Settlement finalized successfully',
            message: 'Moved to Settlement History.',
          });
        } catch (err) {
          console.error(err);
          setError(err.message || 'Failed to mark final settlement.');
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleDeleteBooking = (settlement) => {
    if (!settlement) return;
    setConfirmModalState({
      isOpen: true,
      title: 'Delete Booking?',
      message: 'Are you sure you want to delete this booking? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      variant: 'danger',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setError(null);
          await deleteSettlement(settlement.id, settlement.billing?.id, settlement.leadId);
          if (activeGarageId) {
            if (activeGarageId === 'MECHHELP_MASTER') {
              const data = await getAllSettlements();
              setSettlements(data.settlements);
            } else {
              const data = await getGarageSettlements(activeGarageId);
              setSettlements(data.settlements);
              setGarageBalance(data.balance);
            }
          }
          await loadGarages();
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
          addToast({
            type: 'success',
            title: '✓ Booking deleted successfully',
          });
        } catch (err) {
          console.error(err);
          setError(err.message || 'Failed to delete booking.');
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleSettleAll = () => {
    if (!activeGarageId) return;
    setConfirmModalState({
      isOpen: true,
      title: 'Settle All Entries?',
      message: `Are you sure you want to mark ALL outstanding entries for "${activeGarageName}" as fully settled?\n\nThis clears ₹${Math.abs(garageBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}.`,
      confirmText: 'Settle All',
      cancelText: 'Cancel',
      variant: 'primary',
      onConfirm: async () => {
        try {
          setActionLoading(true);
          setError(null);
          await settleGarage(activeGarageId);
          const data = await getGarageSettlements(activeGarageId);
          setSettlements(data.settlements);
          setGarageBalance(data.balance);
          await loadGarages();
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
          addToast({
            type: 'success',
            title: '✓ Garage balance settled successfully',
          });
        } catch (err) {
          console.error(err);
          setError('Failed to settle garage balance.');
          setConfirmModalState(prev => ({ ...prev, isOpen: false }));
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handlePrintAllSettlements = () => {
    if (!activeGarageId || filteredSettlements.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addToast({
        type: 'warning',
        title: 'Popup Blocked',
        message: 'Please allow popups to generate the settlement print document.',
      });
      return;
    }

    const dateRangeStr = filterDate 
      ? new Date(filterDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'All Time';

    let html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${activeGarageName} - Settlement History</title>
          <style>
            body { font-family: 'Inter', system-ui, sans-serif; color: #111827; margin: 0; padding: 40px; background: #fff; }
            @page { margin: 15mm; size: A4 portrait; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 30px; }
            .header-title { margin: 0 0 5px 0; font-size: 24px; color: #111827; }
            .header-subtitle { margin: 0; font-size: 14px; color: #4b5563; }
            
            .summary-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 15px; margin-bottom: 30px; display: flex; gap: 30px; }
            .summary-item { display: flex; flex-direction: column; }
            .summary-item-label { font-size: 12px; text-transform: uppercase; color: #6b7280; font-weight: 600; margin-bottom: 4px; }
            .summary-item-value { font-size: 18px; font-weight: 700; color: #111827; }
            .summary-item-value.positive { color: #16a34a; }
            .summary-item-value.negative { color: #dc2626; }

            .record-card { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 20px; page-break-inside: avoid; }
            .record-header { background: #f9fafb; padding: 10px 15px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; border-radius: 8px 8px 0 0; }
            .record-date { font-weight: 600; font-size: 14px; color: #111827; }
            .record-type { font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 12px; background: #e5e7eb; color: #374151; }
            
            .record-body { padding: 15px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-bottom: 15px; }
            .info-item { font-size: 13px; display: flex; flex-direction: column; }
            .info-item span { color: #6b7280; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 2px; }
            
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 15px; }
            th { text-align: left; background: #f9fafb; padding: 8px; border-bottom: 1px solid #e5e7eb; color: #4b5563; font-weight: 600; }
            td { padding: 8px; border-bottom: 1px solid #f3f4f6; }
            
            .totals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f9fafb; padding: 15px; border-radius: 6px; font-size: 13px; }
            .totals-row { display: flex; justify-content: space-between; margin-bottom: 6px; }
            .totals-row.bold { font-weight: 700; color: #111827; }
            .divider { height: 1px; background: #e5e7eb; margin: 10px 0; }

            .footer { margin-top: 40px; font-size: 11px; color: #9ca3af; text-align: center; border-top: 1px solid #f3f4f6; padding-top: 15px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div>
              <h1 class="header-title">${activeGarageName}</h1>
              <p class="header-subtitle">Settlement History Report</p>
            </div>
            <div style="text-align: right;">
              <div style="font-weight: 600; font-size: 14px;">Generated on: ${new Date().toLocaleDateString('en-GB')}</div>
            </div>
          </div>

          <div class="summary-box">
            <div class="summary-item">
              <span class="summary-item-label">Date Range</span>
              <span class="summary-item-value">${dateRangeStr}</span>
            </div>
            <div class="summary-item">
              <span class="summary-item-label">Records Included</span>
              <span class="summary-item-value">${filteredSettlements.length}</span>
            </div>
            <div class="summary-item">
              <span class="summary-item-label">Overall Unsettled Balance</span>
              <span class="summary-item-value ${garageBalance > 0 ? 'positive' : garageBalance < 0 ? 'negative' : ''}">
                ${garageBalance === 0 ? 'Settled (₹0)' : garageBalance > 0 ? "You're owed +₹" + garageBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : "You owe ₹" + Math.abs(garageBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
    `;

    filteredSettlements.forEach(s => {
      const isPaymentRow = !s.billing && s.settled;
      const isMechHelpPaying = s.netAmount > 0;
      const dateStr = new Date(s.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

      html += `<div class="record-card">`;
      html += `<div class="record-header">
                 <span class="record-date">${dateStr}</span>
                 <span class="record-type">${isPaymentRow ? 'Payment Record' : 'Service Booking'}</span>
               </div>`;
      html += `<div class="record-body">`;

      if (isPaymentRow) {
        html += `
          <div style="font-size: 14px;">
            <strong>${isMechHelpPaying ? 'Payment: MechHelp → Garage' : 'Payment: Garage → MechHelp'}</strong><br/>
            <span style="color: #6b7280; font-size: 13px;">${isMechHelpPaying ? `We paid ${activeGarageName}` : `${activeGarageName} paid us`}</span>
          </div>
          <div style="margin-top: 15px; font-size: 16px; font-weight: 700; color: ${isMechHelpPaying ? '#dc2626' : '#16a34a'}">
             Amount: ₹${Math.abs(s.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
        `;
      } else {
        const b = s.billing!;
        const lineItems = b.lineItems || [];
        const discount = b.discount || 0;
        
        const { totalAmount, totalMechhelpEntitled, totalGarageEntitled } = calculateSettlement(
          lineItems.map(i => ({
            name: i.name,
            amount: i.amount,
            splitEnabled: i.splitEnabled,
            mechhelpPct: i.mechhelpPct,
            garagePct: i.garagePct
          })),
          b.paidTo,
          discount
        );
        const rawMechhelp = totalMechhelpEntitled + discount;

        html += `
          <div class="info-grid">
            <div class="info-item"><span>Customer</span><strong>${s.customerName}</strong></div>
            <div class="info-item"><span>Vehicle</span><strong>${s.carBrand} ${s.carModel}${s.numberPlate ? ` (${s.numberPlate})` : ''}</strong></div>
            <div class="info-item"><span>Status</span><strong style="text-transform: capitalize;">${b.status}</strong></div>
            <div class="info-item"><span>Collected By</span><strong style="text-transform: capitalize;">${b.paidTo || 'N/A'}</strong></div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Service/Item</th>
                <th>Split</th>
                <th style="text-align: right;">Gross</th>
                <th style="text-align: right;">MechHelp</th>
                <th style="text-align: right;">Garage</th>
              </tr>
            </thead>
            <tbody>
              ${lineItems.map(item => `
                <tr>
                  <td><strong>${item.name}</strong></td>
                  <td>${item.splitEnabled ? `${item.mechhelpPct}% / ${item.garagePct}%` : 'Disabled'}</td>
                  <td style="text-align: right;">₹${item.amount.toFixed(2)}</td>
                  <td style="text-align: right;">${item.splitEnabled ? `₹${(item.amount * item.mechhelpPct / 100).toFixed(2)}` : '₹0.00'}</td>
                  <td style="text-align: right;">₹${(item.splitEnabled ? item.amount * item.garagePct / 100 : item.amount).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals-grid">
            <div>
              <div class="totals-row">
                <span>Total Amount (charged to customer):</span>
                <strong>₹${totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
              </div>
              <div class="totals-row" style="color: #4b5563;">
                <span>MechHelp Entitled (before discount):</span>
                <span>₹${rawMechhelp.toFixed(2)}</span>
              </div>
              ${discount > 0 ? `
                <div class="totals-row" style="color: #dc2626;">
                  <span>Discount (borne by MechHelp):</span>
                  <span>− ₹${discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              ` : ''}
            </div>
            <div>
              <div class="totals-row">
                <span>MechHelp Entitled (after discount):</span>
                <strong style="${totalMechhelpEntitled < 0 ? 'color: #dc2626;' : ''}">₹${totalMechhelpEntitled.toFixed(2)}</strong>
              </div>
              <div class="totals-row" style="color: #4b5563;">
                <span>Total Garage Entitled:</span>
                <span>₹${totalGarageEntitled.toFixed(2)}</span>
              </div>
              <div class="divider"></div>
              <div class="totals-row bold">
                <span>Net Settlement Effect:</span>
                <span style="color: ${s.netAmount > 0 ? '#16a34a' : s.netAmount < 0 ? '#dc2626' : '#4b5563'};">
                  ${s.netAmount > 0 ? 'Garage owes us' : 'We owe Garage'} ₹${Math.abs(s.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        `;
      }

      html += `</div></div>`;
    });

    html += `
          <div class="footer">
            Generated automatically by MechHelp CRM — Official Garage Settlement History Document
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

  const getBalanceBadge = (bal) => {
    if (bal > 0) return <span className="balance-badge text-green">You're owed ₹{bal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>;
    if (bal < 0) return <span className="balance-badge text-red">You owe ₹{Math.abs(bal).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>;
    return <span className="balance-badge text-gray">Settled (₹0)</span>;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="settlements-page animate-fade-in">
      {error && (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.75rem 1rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
          <ShieldAlert size={18} /><span>{error}</span>
        </div>
      )}

      {/* ── Level 1: Garage List ───────────────────────────────────────────── */}
      {!activeGarageId && (
        <>
          {/* Header with Manage button */}
          <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
            <div>
              <h1>Garage Settlement</h1>
              <p>Review balances, track splits, and manage payments between MechHelp and partner garages</p>
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowManageModal(true)}
              style={{ flexShrink: 0 }}
            >
              <Plus size={16} style={{ marginRight: '0.4rem' }} />
              Manage Garages
            </button>
          </div>

          {/* Overall summary */}
          {!loadingGarages && garages.length > 0 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem',
              padding: '1rem 1.25rem',
              borderRadius: '12px',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border-light)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Garages Owe MechHelp
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--success)' }}>
                  ₹{summary.totalOwedByGarages.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ textAlign: 'center', borderLeft: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', padding: '0 1rem' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  MechHelp Owes Garages
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--danger)' }}>
                  ₹{summary.totalOwedToGarages.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  Net Position
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: summary.net >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {summary.net >= 0 ? '+' : ''}₹{Math.abs(summary.net).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  {summary.net > 0 ? 'net owed to MechHelp' : summary.net < 0 ? 'net owed to garages' : 'balanced'}
                </div>
              </div>
            </div>
          )}

          {/* ── MechHelp Master Ledger Card ─────────────────────────────── */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>MechHelp</h2>
            <div
              className="garage-card surface-panel"
              style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '1.25rem 1.5rem', gap: '1rem' }}
              onClick={() => { setActiveGarageId('MECHHELP_MASTER'); setActiveGarageName('MechHelp — Master Ledger'); }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ background: 'var(--accent-bg)', borderRadius: '10px', padding: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={22} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Master Ledger</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>All completed bookings across every garage</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', fontWeight: 600 }}>View all billing history →</span>
              </div>
            </div>
          </div>

          {/* ── Partner Garages ─────────────────────────────────────────── */}
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.75rem' }}>Partner Garages</h2>
          {loadingGarages ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}><p>Loading garages list...</p></div>
          ) : (
            <div className="garage-grid">
              {sortedGarages.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                  No garages found. Use "Manage Garages" to add one.
                </div>
              ) : (
                sortedGarages.map((g) => (
                  <div
                    key={g.id}
                    className="garage-card surface-panel"
                    onClick={() => { setActiveGarageId(g.id); setActiveGarageName(g.name); }}
                  >
                    <div className="garage-card-header">
                      <Landmark size={24} className="garage-icon" />
                      <h3>{g.name}</h3>
                    </div>
                    <div className="garage-card-body">{getBalanceBadge(g.balance)}</div>
                    <div className="garage-card-footer"><span>View details &amp; settlements</span></div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* ── Level 2: Garage Detail View ───────────────────────────────────── */}
      {activeGarageId && (
        <>
          <div className="detail-header-sticky">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary btn-icon"
                onClick={() => { setActiveGarageId(null); setActiveGarageName(''); }}
                disabled={actionLoading}
              >
                <ChevronLeft size={20} />
              </button>
              <div>
                <h1 style={{ fontSize: '1.5rem' }}>{activeGarageName}</h1>
                <p style={{ fontSize: '0.875rem', marginTop: '0.125rem' }}>Detailed billing &amp; settlement history</p>
              </div>
            </div>

            <div className="balance-settle-action" style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'flex-end', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--bg-secondary)', padding: '0.25rem 0.5rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
                <label style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Filter Date:</label>
                <input 
                  type="date" 
                  className="form-input" 
                  style={{ padding: '0.25rem 0.5rem', width: 'auto', minWidth: '130px', fontSize: '0.875rem', border: 'none', background: 'transparent' }} 
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                />
                {filterDate && (
                  <button type="button" className="btn-icon" onClick={() => setFilterDate('')} title="Clear filter">
                    <XIcon size={16} />
                  </button>
                )}
              </div>
              {!isMasterLedger && (
                <div className="balance-info-block">
                  <span className="balance-label">Unsettled Balance:</span>
                  <span className={`balance-value ${garageBalance > 0 ? 'text-green' : garageBalance < 0 ? 'text-red' : 'text-gray'}`}>
                    {garageBalance > 0 ? '+' : ''}{garageBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              )}
              {!isMasterLedger && garageBalance !== 0 && (
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setShowPaymentModal(true)}
                    disabled={actionLoading || loadingDetails}
                  >
                    <CheckCircle2 size={16} style={{ marginRight: '0.25rem' }} /> Record Payment
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleSettleAll}
                    disabled={actionLoading || loadingDetails}
                    title="Mark all entries as fully settled at once"
                  >
                    Mark All Settled
                  </button>
                </div>
              )}
              {/* Print + Add Customer — always visible in detail view */}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowAddCustomerModal(true)}
                disabled={actionLoading || loadingDetails || isMasterLedger}
                title={isMasterLedger ? 'Switch to a specific garage to add a customer' : 'Add a walk-in customer directly against this garage'}
              >
                <UserPlus size={16} style={{ marginRight: '0.25rem' }} /> Add Customer
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handlePrintAllSettlements}
                disabled={actionLoading || loadingDetails || filteredSettlements.length === 0}
                title="Print visible settlement history"
              >
                <Printer size={16} style={{ marginRight: '0.25rem' }} /> Print
              </button>
            </div>
          </div>

          {loadingDetails ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}><p>Loading settlement history...</p></div>
          ) : (
            <div className="table-container" style={{ marginTop: '1.5rem' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer / Vehicle</th>
                    <th>Total Amount</th>
                    <th>Collected By</th>
                    <th>Net Effect</th>
                    <th>Status</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSettlements.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        {filterDate ? 'No settlement history found for this date.' : 'No settlement history found for this garage.'}
                      </td>
                    </tr>
                  ) : (
                    filteredSettlements.map((s) => {
                      const isPaymentRow = !s.billing && s.settled;
                      const isMechHelpPaying = s.netAmount > 0;
                      return (
                        <tr
                          key={s.id}
                          className={`settlement-row ${s.settled ? 'row-settled' : 'row-unsettled'}`}
                          onClick={() => !isPaymentRow && setSelectedSettlement(s)}
                          style={{ cursor: isPaymentRow ? 'default' : 'pointer' }}
                        >
                          <td>{new Date(s.createdAt).toLocaleDateString('en-GB')}</td>
                          <td>
                            {isPaymentRow ? (
                              <div>
                                <strong style={{ color: isMechHelpPaying ? 'var(--danger)' : 'var(--success)' }}>
                                  {isMechHelpPaying ? 'Payment: MechHelp → Garage' : 'Payment: Garage → MechHelp'}
                                </strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {isMechHelpPaying ? `We paid ${activeGarageName}` : `${activeGarageName} paid us`}
                                </div>
                              </div>
                            ) : (
                              <>
                                <strong>{s.customerName}</strong>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {s.carBrand} {s.carModel}{s.numberPlate ? ` • ${s.numberPlate}` : ''}
                                </div>
                              </>
                            )}
                          </td>
                          <td>{isPaymentRow ? '—' : `₹${s.billing?.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 }) || '0.00'}`}</td>
                          <td>
                            {isPaymentRow ? (
                              <span className={`badge ${isMechHelpPaying ? 'badge-red' : 'badge-green'}`}>
                                {isMechHelpPaying ? 'MechHelp Paid' : 'Garage Paid'}
                              </span>
                            ) : (
                              <span className="badge badge-gray" style={{ textTransform: 'capitalize' }}>
                                {s.billing?.paidTo || '-'}
                              </span>
                            )}
                          </td>
                          <td>
                            <strong className={s.netAmount > 0 ? 'text-green' : s.netAmount < 0 ? 'text-red' : 'text-gray'}>
                              {s.netAmount > 0 ? '+' : ''}{s.netAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </strong>
                          </td>
                          <td>
                            <span className={`badge ${s.settled ? (isPaymentRow ? 'badge-blue' : 'badge-green') : 'badge-orange'}`}>
                              {isPaymentRow ? 'Payment' : s.settled ? 'Settled' : 'Outstanding'}
                            </span>
                          </td>
                          <td>
                            {!isPaymentRow && (
                              <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-start' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm flex items-center justify-center"
                                  onClick={(e) => { e.stopPropagation(); setEditingSettlement(s); }}
                                  title="Edit Booking"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm flex items-center justify-center text-red"
                                  onClick={(e) => { e.stopPropagation(); handleDeleteBooking(s); }}
                                  title="Delete Booking"
                                  style={{ color: 'var(--danger)' }}
                                >
                                  <Trash2 size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm flex items-center justify-center"
                                  onClick={(e) => { e.stopPropagation(); setSelectedSettlement(s); }}
                                  title="View Details"
                                >
                                  <FileText size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Level 3: Billing Breakdown Modal ──────────────────────────────── */}
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
              <h2>Billing Breakdown</h2>
              <button onClick={() => setSelectedSettlement(null)} className="btn-icon">
                <XIcon size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '0.875rem' }}>
              <div className="breakdown-section" style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div><span className="breakdown-label">Customer:</span><strong>{selectedSettlement.customerName}</strong></div>
                  <div><span className="breakdown-label">Vehicle:</span><span>{selectedSettlement.carBrand} {selectedSettlement.carModel}{selectedSettlement.numberPlate ? ` (${selectedSettlement.numberPlate})` : ''}</span></div>
                  <div><span className="breakdown-label">Booking Date:</span><span>{new Date(selectedSettlement.bookingDate).toLocaleDateString('en-GB')}</span></div>
                  <div><span className="breakdown-label">Payment Collected By:</span><strong style={{ textTransform: 'capitalize' }}>{selectedSettlement.billing?.paidTo}</strong></div>
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
                {/* Raw totals */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span>Total Amount (charged to customer):</span>
                  <strong>₹{selectedSettlement.billing?.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                </div>

                {/* Pre-discount MechHelp share from line items */}
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
              <button
                type="button"
                className="btn btn-success flex items-center gap-1.5"
                style={{ backgroundColor: '#16a34a', color: '#fff', border: 'none' }}
                onClick={() => handleFinalSettlement(selectedSettlement)}
              >
                <CheckCircle2 size={16} /> Final Settlement
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setSelectedSettlement(null)}>Close</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Manage Garages Modal ──────────────────────────────────────────── */}
      {showManageModal && (
        <ManageGaragesModal
          garages={garages}
          onClose={() => setShowManageModal(false)}
          onAdd={handleAddGarage}
          onRemove={handleRemoveGarage}
        />
      )}

      {/* ── Record Payment Modal ──────────────────────────────────────────── */}
      {showPaymentModal && activeGarageId && (
        <RecordPaymentModal
          garageName={activeGarageName}
          currentBalance={garageBalance}
          onClose={() => setShowPaymentModal(false)}
          onRecord={handleRecordPayment}
        />
      )}

      {/* ── Add Direct Customer Modal ─────────────────────────────────────── */}
      {showAddCustomerModal && activeGarageId && !isMasterLedger && (
        <AddDirectCustomerModal
          isOpen={showAddCustomerModal}
          onClose={() => setShowAddCustomerModal(false)}
          onSaved={async () => {
            const data = await getGarageSettlements(activeGarageId);
            setSettlements(data.settlements);
            setGarageBalance(data.balance);
            loadGarages();
          }}
          garageId={activeGarageId}
          garageName={activeGarageName}
        />
      )}

      {/* ── Edit Booking Modal ───────────────────────────────────────────── */}
      {editingSettlement && (
        <EditBookingModal
          isOpen={!!editingSettlement}
          onClose={() => setEditingSettlement(null)}
          onSaved={async () => {
            if (activeGarageId) {
              if (activeGarageId === 'MECHHELP_MASTER') {
                const data = await getAllSettlements();
                setSettlements(data.settlements);
              } else {
                const data = await getGarageSettlements(activeGarageId);
                setSettlements(data.settlements);
                setGarageBalance(data.balance);
              }
            }
            await loadGarages();
          }}
          settlement={editingSettlement}
          currentGarageId={activeGarageId || undefined}
          currentGarageName={activeGarageName || undefined}
        />
      )}

      {/* ── Toast Notifications ──────────────────────────────────────────── */}
      <ToastNotificationContainer toasts={toasts} onDismiss={dismissToast} />

      {/* ── Reusable Confirmation Modal ───────────────────────────────────── */}
      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
        cancelText={confirmModalState.cancelText}
        variant={confirmModalState.variant}
        loading={actionLoading}
        onConfirm={confirmModalState.onConfirm}
        onCancel={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};

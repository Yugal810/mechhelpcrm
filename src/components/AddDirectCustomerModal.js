import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, ShieldAlert, Landmark } from 'lucide-react';
import { useLeadContext } from '../store/LeadContext.js';

export const AddDirectCustomerModal = ({
  isOpen,
  onClose,
  onSaved,
  garageId,
  garageName,
}) => {
  const { finalizeDirectBilling } = useLeadContext();

  const [customerName, setCustomerName] = useState('');
  const [carBrand, setCarBrand]         = useState('');
  const [carModel, setCarModel]         = useState('');
  const [numberPlate, setNumberPlate]   = useState('');
  const [bookingDate, setBookingDate]   = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  const [lineItems, setLineItems] = useState([
    { name: 'General Service', amount: '', splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false },
  ]);
  const [discountStr, setDiscountStr] = useState('0');

  const [paidTo, setPaidTo] = useState('garage');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError]       = useState(null);

  const handleAddItem = () =>
    setLineItems(prev => [
      ...prev,
      { name: '', amount: '', splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false },
    ]);

  const handleRemoveItem = (idx) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx, field, value) => {
    setLineItems(prev =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        const updated = { ...item, [field]: value };
        if (field === 'mechhelpPct') updated.garagePct  = Math.max(0, 100 - Number(value));
        if (field === 'garagePct')  updated.mechhelpPct = Math.max(0, 100 - Number(value));
        return updated;
      })
    );
  };

  const grossAmount  = lineItems.reduce((s, item) => s + (Number(item.amount) || 0), 0);
  const discountVal  = Math.max(0, Number(discountStr) || 0);
  const runningTotal = grossAmount - discountVal;

  const handleClose = () => {
    setCustomerName('');
    setCarBrand('');
    setCarModel('');
    setNumberPlate('');
    const d = new Date();
    setBookingDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    setLineItems([{ name: 'General Service', amount: '', splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false }]);
    setDiscountStr('0');
    setPaidTo('garage');
    setError(null);
    onClose();
  };

  const handleSave = async () => {
    try {
      setError(null);
      setIsSaving(true);

      if (!customerName.trim()) throw new Error('Customer Name is required.');
      if (lineItems.some(item => !item.name.trim()))
        throw new Error('All line items must have a name.');
      if (lineItems.some(item => isNaN(Number(item.amount)) || Number(item.amount) < 0))
        throw new Error('All line items must have a valid non-negative amount.');
      if (isNaN(discountVal) || discountVal < 0)
        throw new Error('Discount must be a valid non-negative number.');
      lineItems.forEach((item, idx) => {
        if (item.splitEnabled && item.mechhelpPct + item.garagePct !== 100)
          throw new Error(`Line item #${idx + 1} split percentages must sum to 100%.`);
      });

      const formattedItems = lineItems.map(item => ({
        name: item.name,
        amount: Number(item.amount) || 0,
        splitEnabled: item.splitEnabled,
        mechhelpPct: item.splitEnabled ? item.mechhelpPct : 0,
        garagePct:   item.splitEnabled ? item.garagePct   : 100,
      }));

      await finalizeDirectBilling(
        customerName.trim(),
        carBrand.trim(),
        carModel.trim(),
        numberPlate.trim(),
        bookingDate,
        garageId,
        garageName,
        formattedItems,
        paidTo,
        discountVal
      );

      handleClose();
      onSaved();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to save. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content surface-panel animate-fade-in" style={{ maxWidth: '620px', maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Add Direct / Walk-in Customer</h2>
          <button onClick={handleClose} className="btn-icon" disabled={isSaving}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ paddingBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
            <Landmark size={16} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
            <span style={{ color: 'var(--text-muted)' }}>Garage:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{garageName}</strong>
            <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>locked</span>
          </div>

          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>1. Customer Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Customer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Sharma"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Booking Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={bookingDate}
                  onChange={e => setBookingDate(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Vehicle</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" placeholder="Brand (e.g. Maruti)" value={carBrand} onChange={e => setCarBrand(e.target.value)} disabled={isSaving} />
                  <input type="text" className="form-input" placeholder="Model (e.g. Swift)" value={carModel} onChange={e => setCarModel(e.target.value)} disabled={isSaving} />
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Number Plate</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. MH12AB1234"
                  value={numberPlate}
                  onChange={e => setNumberPlate(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>2. Sold Services / Parts</h3>
              <button type="button" className="btn btn-secondary btn-sm flex items-center gap-1" onClick={handleAddItem} disabled={isSaving}>
                <Plus size={14} /> Add Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {lineItems.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{ flex: 2 }}>
                      <input type="text" className="form-input" placeholder="Item name (e.g. Engine Oil)" value={item.name} onChange={e => handleItemChange(idx, 'name', e.target.value)} disabled={isSaving} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input type="number" className="form-input" placeholder="Amount (₹)" value={item.amount} onChange={e => handleItemChange(idx, 'amount', e.target.value)} disabled={isSaving} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <input type="checkbox" id={`split-${idx}`} checked={item.splitEnabled} onChange={e => handleItemChange(idx, 'splitEnabled', e.target.checked)} disabled={isSaving} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                      <label htmlFor={`split-${idx}`} style={{ fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>Split (80/20)</label>
                    </div>
                    {lineItems.length > 1 && (
                      <button type="button" className="btn-icon" onClick={() => handleRemoveItem(idx)} disabled={isSaving} title="Remove item">
                        <Trash2 size={16} style={{ color: 'var(--danger)' }} />
                      </button>
                    )}
                  </div>

                  {item.splitEnabled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)', paddingTop: '0.25rem' }}>
                      {!item.showPctEdit ? (
                        <>
                          <span>Split: MechHelp {item.mechhelpPct}% | Garage {item.garagePct}%</span>
                          <button type="button" style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', padding: 0, fontSize: '0.75rem', textDecoration: 'underline' }} onClick={() => handleItemChange(idx, 'showPctEdit', true)}>
                            edit split %
                          </button>
                        </>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <label style={{ whiteSpace: 'nowrap' }}>MH %:</label>
                          <input type="number" min="0" max="100" style={{ width: '60px', padding: '2px 4px', fontSize: '0.75rem' }} className="form-input" value={item.mechhelpPct} onChange={e => handleItemChange(idx, 'mechhelpPct', e.target.value)} />
                          <label style={{ whiteSpace: 'nowrap' }}>Garage %:</label>
                          <input type="number" min="0" max="100" style={{ width: '60px', padding: '2px 4px', fontSize: '0.75rem' }} className="form-input" value={item.garagePct} onChange={e => handleItemChange(idx, 'garagePct', e.target.value)} />
                          <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px', fontSize: '0.72rem' }} onClick={() => handleItemChange(idx, 'showPctEdit', false)}>Done</button>
                        </div>
                      )}
                      <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
                        MechHelp: ₹{( (Number(item.amount) || 0) * item.mechhelpPct / 100 ).toFixed(2)} | Garage: ₹{( (Number(item.amount) || 0) * item.garagePct / 100 ).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', alignItems: 'center' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  Discount (₹)
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>absorbed by MechHelp</span>
                </label>
                <input
                  type="number"
                  min="0"
                  className="form-input"
                  placeholder="0"
                  value={discountStr}
                  onChange={e => setDiscountStr(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: 'var(--bg-tertiary)', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-light)' }}>
                💡 Discount reduces MechHelp's share only — the garage's entitlement stays the same.
              </div>
            </div>

            <div style={{ marginTop: '1rem', padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem' }}>Running Total (charged to customer):</strong>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>
                ₹{runningTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </strong>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>3. Who Received Payment?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <button
                type="button"
                className={`btn ${paidTo === 'garage' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'center', padding: '0.75rem', fontWeight: 600 }}
                onClick={() => setPaidTo('garage')}
                disabled={isSaving}
              >
                Garage
              </button>
              <button
                type="button"
                className={`btn ${paidTo === 'mechhelp' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'center', padding: '0.75rem', fontWeight: 600 }}
                onClick={() => setPaidTo('mechhelp')}
                disabled={isSaving}
              >
                MechHelp
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', margin: 0 }}>
              {paidTo === 'garage'
                ? 'Garage collected funds from customer. Settlement will calculate MechHelp entitlement.'
                : 'MechHelp collected funds directly. Settlement will calculate Garage entitlement.'}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
            <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={isSaving}>Cancel</button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Billing Record'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

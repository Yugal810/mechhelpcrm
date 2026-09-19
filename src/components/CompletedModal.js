import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, ShieldAlert } from 'lucide-react';
import { useLeadContext } from '../store/LeadContext.js';







export const CompletedModal = ({ isOpen, onClose, lead }) => {
  const { finalizeBilling, getGarageList } = useLeadContext();
  const [lineItems, setLineItems] = useState([
    { name: 'General Service', amount: '', splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false }
  ]);
  const [discountStr, setDiscountStr] = useState('0');
  const [paidTo, setPaidTo] = useState('garage');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Booking summary fields
  const [customerName, setCustomerName] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [numberPlate, setNumberPlate] = useState('');
  const [bookingDateTime, setBookingDateTime] = useState('');

  // Garage dropdown state — stores both id and display name
  const [garageList, setGarageList] = useState([]);
  const [selectedGarageId, setSelectedGarageId] = useState('');
  const [selectedGarageName, setSelectedGarageName] = useState('');
  const [garageListLoading, setGarageListLoading] = useState(false);

  // Load garage list once when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setGarageListLoading(true);
    getGarageList()
      .then(list => setGarageList(list))
      .catch(err => console.error('Failed to load garages:', err))
      .finally(() => setGarageListLoading(false));
  }, [isOpen]);

  // Pre-populate fields when lead changes
  useEffect(() => {
    if (lead) {
      setCustomerName(lead.customerName || '');
      setCarBrand(lead.carBrand || '');
      setCarModel(lead.carModel || '');
      setNumberPlate(lead.numberPlate || '');
      setBookingDateTime(lead.bookingDateTime ? new Date(lead.bookingDateTime).toLocaleDateString('en-GB') : '');
      setDiscountStr('0');

      // Reset line items and payment
      setLineItems([
        { name: 'General Service', amount: '', splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false }
      ]);
      setPaidTo('garage');
      setError(null);
    }
  }, [lead]);

  // Pre-select garage once both lead and garageList are available.
  // Priority: match by garage_id → fallback to case-insensitive name match.
  useEffect(() => {
    if (!lead) return;

    let matched: GarageOption | undefined;

    if (lead.garageId && garageList.length > 0) {
      matched = garageList.find(g => g.id === lead.garageId);
    }

    if (!matched && lead.garageAssigned && garageList.length > 0) {
      const needle = lead.garageAssigned.trim().toLowerCase();
      matched = garageList.find(g => g.name.trim().toLowerCase() === needle);
    }

    if (matched) {
      setSelectedGarageId(matched.id);
      setSelectedGarageName(matched.name);
    } else if (lead.garageAssigned) {
      setSelectedGarageName(lead.garageAssigned);
    }
  }, [lead, garageList]);

  if (!isOpen || !lead) return null;

  const handleGarageChange = (e) => {
    const id = e.target.value;
    const garage = garageList.find(g => g.id === id);
    setSelectedGarageId(id);
    setSelectedGarageName(garage?.name || '');
  };

  const handleAddItem = () => {
    setLineItems(prev => [
      ...prev,
      { name: '', amount: '', splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false }
    ]);
  };

  const handleRemoveItem = (index) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: keyof TempLineItem, value: any) => {
    setLineItems(prev => prev.map((item, i) => {
      if (i === index) {
        const updated = { ...item, [field]: value };
        // Keep split percentages complementary when editing either side
        if (field === 'mechhelpPct') {
          updated.garagePct = Math.max(0, 100 - Number(value));
        } else if (field === 'garagePct') {
          updated.mechhelpPct = Math.max(0, 100 - Number(value));
        }
        return updated;
      }
      return item;
    }));
  };

  // grossAmount = sum of line item amounts (pre-discount, what was billed to each item)
  const grossAmount = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const discountVal = Math.max(0, Number(discountStr) || 0);
  // runningTotal = what the customer actually pays (post-discount)
  const runningTotal = grossAmount - discountVal;

  const handleSave = async () => {
    try {
      setError(null);
      setIsSaving(true);

      // Validation
      if (!selectedGarageId) {
        throw new Error('Please select a garage before completing this booking.');
      }
      if (lineItems.some(item => !item.name.trim())) {
        throw new Error('All line items must have a name.');
      }
      if (lineItems.some(item => isNaN(Number(item.amount)) || Number(item.amount) < 0)) {
        throw new Error('All line items must have a valid non-negative amount.');
      }
      if (isNaN(discountVal) || discountVal < 0) {
        throw new Error('Discount must be a valid non-negative number.');
      }
      lineItems.forEach((item, idx) => {
        if (item.splitEnabled && (item.mechhelpPct + item.garagePct !== 100)) {
          throw new Error(`Line item #${idx + 1} split percentages must sum to 100%.`);
        }
      });

      // Map line items — splitEnabled OFF → 100% garage, 0% MechHelp
      const formattedItems = lineItems.map(item => ({
        name: item.name,
        amount: Number(item.amount) || 0,
        splitEnabled: item.splitEnabled,
        mechhelpPct: item.splitEnabled ? item.mechhelpPct : 0,
        garagePct: item.splitEnabled ? item.garagePct : 100
      }));

      // Pass pre-resolved garageId and garageName + discount so finalize processes everything cleanly
      await finalizeBilling(lead.id, formattedItems, paidTo, selectedGarageId, selectedGarageName, discountVal, numberPlate, carBrand, carModel, customerName);
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to complete booking. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content surface-panel animate-fade-in" style={{ maxWidth: '600px', maxHeight: 'calc(100vh - 12rem)', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Mark Booking Completed</h2>
          <button onClick={onClose} className="btn-icon" disabled={isSaving}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ paddingBottom: '1.5rem' }}>
          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Summary */}
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>1. Booking Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem', fontSize: '0.875rem' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Customer Name</label>
                <input type="text" className="form-input" value={customerName} onChange={e => setCustomerName(e.target.value)} disabled={isSaving} />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Vehicle</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" placeholder="Brand" value={carBrand} onChange={e => setCarBrand(e.target.value)} disabled={isSaving} />
                  <input type="text" className="form-input" placeholder="Model" value={carModel} onChange={e => setCarModel(e.target.value)} disabled={isSaving} />
                </div>
              </div>
              <div>
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
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Garage</label>
                <select
                  className="form-select"
                  value={selectedGarageId}
                  onChange={handleGarageChange}
                  disabled={isSaving || garageListLoading}
                >
                  <option value="">{garageListLoading ? 'Loading...' : 'Select Garage...'}</option>
                  {selectedGarageName && !garageList.some(g => g.id === selectedGarageId || g.name === selectedGarageName) && (
                    <option value={selectedGarageId || selectedGarageName}>{selectedGarageName} (Archived)</option>
                  )}
                  {garageList.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Booking Date</label>
                <input type="text" className="form-input" value={bookingDateTime} disabled />
              </div>
            </div>
          </div>

          {/* Section 2: Line Items */}
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
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Item name (e.g. Engine Oil)"
                        value={item.name}
                        onChange={e => handleItemChange(idx, 'name', e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Amount (₹)"
                        value={item.amount}
                        onChange={e => handleItemChange(idx, 'amount', e.target.value)}
                        disabled={isSaving}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                      <input
                        type="checkbox"
                        id={`split-${idx}`}
                        checked={item.splitEnabled}
                        onChange={e => handleItemChange(idx, 'splitEnabled', e.target.checked)}
                        disabled={isSaving}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <label htmlFor={`split-${idx}`} style={{ fontSize: '0.75rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>Split (80/20)</label>
                    </div>
                    <button
                      type="button"
                      className="btn-icon"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={isSaving || lineItems.length === 1}
                      style={{ color: 'var(--danger)' }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Live split breakdown — always recalculates on amount/toggle change */}
                  {item.splitEnabled ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                      {!item.showPctEdit ? (
                        <button
                          type="button"
                          onClick={() => handleItemChange(idx, 'showPctEdit', true)}
                          style={{ background: 'none', border: 'none', color: 'var(--info)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          edit split %
                        </button>
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>MechHelp %:</span>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '60px', padding: '0.25rem' }}
                            value={item.mechhelpPct}
                            onChange={e => handleItemChange(idx, 'mechhelpPct', Number(e.target.value))}
                            disabled={isSaving}
                            max={100}
                            min={0}
                          />
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Garage %:</span>
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: '60px', padding: '0.25rem' }}
                            value={item.garagePct}
                            onChange={e => handleItemChange(idx, 'garagePct', Number(e.target.value))}
                            disabled={isSaving}
                            max={100}
                            min={0}
                          />
                          <button
                            type="button"
                            onClick={() => handleItemChange(idx, 'showPctEdit', false)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
                          >
                            Hide
                          </button>
                        </div>
                      )}

                      {!item.showPctEdit && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          MechHelp: ₹{((Number(item.amount) || 0) * item.mechhelpPct / 100).toFixed(2)} | Garage: ₹{((Number(item.amount) || 0) * item.garagePct / 100).toFixed(2)}
                        </span>
                      )}
                    </div>
                  ) : (
                    /* Split OFF → 100% goes to garage, 0% to MechHelp */
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                      No split — full ₹{(Number(item.amount) || 0).toFixed(2)} goes to Garage
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Discount — absorbed 100% by MechHelp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px dashed var(--border-light)', backgroundColor: 'var(--bg-secondary)' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span>Discount (₹)</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 500, background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-light)' }}>absorbed by MechHelp</span>
                </label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="0"
                  min={0}
                  value={discountStr}
                  onChange={e => setDiscountStr(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', maxWidth: '220px', margin: 0 }}>
                💡 Discount reduces MechHelp's share only — the garage's entitlement stays the same.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
              <strong>Running Total (charged to customer):</strong>
              <strong style={{ fontSize: '1.25rem', color: 'var(--accent-primary)' }}>₹{runningTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          {/* Section 3: Who Received Payment */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>3. Who Received Payment?</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' }}>
              <button
                type="button"
                className={`btn ${paidTo === 'garage' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaidTo('garage')}
                disabled={isSaving}
                style={{ padding: '0.75rem' }}
              >
                Garage
              </button>
              <button
                type="button"
                className={`btn ${paidTo === 'mechhelp' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaidTo('mechhelp')}
                disabled={isSaving}
                style={{ padding: '0.75rem' }}
              >
                MechHelp
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              {paidTo === 'garage'
                ? '💡 Garage collected payment directly from the customer.'
                : '💡 Customer paid MechHelp directly.'}
            </p>
          </div>

          {/* Footer Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-light)' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Processing...' : 'Save & Mark Completed'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

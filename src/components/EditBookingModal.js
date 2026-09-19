import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, Trash2, ShieldAlert, Landmark, Save } from 'lucide-react';
import { useLeadContext } from '../store/LeadContext.js';
import { calculateSettlement } from '../../shared/settlementCalculator.js';







export const EditBookingModal = ({
  isOpen,
  onClose,
  onSaved,
  settlement,
  currentGarageId,
  currentGarageName,
}) => {
  const { updateSettlementBilling, getGarageList } = useLeadContext();

  const [customerName, setCustomerName] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [numberPlate, setNumberPlate] = useState('');
  const [bookingDate, setBookingDate] = useState('');

  const [garageList, setGarageList] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedGarageId, setSelectedGarageId] = useState('');
  const [selectedGarageName, setSelectedGarageName] = useState('');

  const [lineItems, setLineItems] = useState([]);
  const [discountStr, setDiscountStr] = useState('0');
  const [paidTo, setPaidTo] = useState('garage');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Load garage list
  useEffect(() => {
    if (!isOpen) return;
    getGarageList()
      .then(list => setGarageList(list))
      .catch(err => console.error('Failed to fetch garage list:', err));
  }, [isOpen, getGarageList]);

  // Pre-fill state when settlement changes
  useEffect(() => {
    if (settlement && isOpen) {
      setCustomerName(settlement.customerName || '');
      setCarBrand(settlement.carBrand || '');
      setCarModel(settlement.carModel || '');
      setNumberPlate(settlement.numberPlate || '');

      if (settlement.bookingDate) {
        const d = new Date(settlement.bookingDate);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        setBookingDate(`${yyyy}-${mm}-${dd}`);
      } else {
        const d = new Date();
        setBookingDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
      }

      const gid = settlement.garageId || currentGarageId || '';
      const gname = settlement.garageName || currentGarageName || '';
      setSelectedGarageId(gid);
      setSelectedGarageName(gname);

      if (settlement.billing) {
        setPaidTo(settlement.billing.paidTo || 'garage');
        setDiscountStr(String(settlement.billing.discount ?? 0));
        
        const existingItems = settlement.billing.lineItems || [];
        if (existingItems.length > 0) {
          setLineItems(
            existingItems.map(item => ({
              name: item.name,
              amount: String(item.amount),
              splitEnabled: !!item.splitEnabled,
              mechhelpPct: item.splitEnabled ? (item.mechhelpPct ?? 20) : 20,
              garagePct: item.splitEnabled ? (item.garagePct ?? 80) : 80,
              showPctEdit: false,
            }))
          );
        } else {
          setLineItems([
            { name: 'General Service', amount: String(settlement.billing.totalAmount || 0), splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false }
          ]);
        }
      } else {
        setPaidTo('garage');
        setDiscountStr('0');
        setLineItems([
          { name: 'General Service', amount: '0', splitEnabled: true, mechhelpPct: 20, garagePct: 80, showPctEdit: false }
        ]);
      }

      setError(null);
    }
  }, [settlement, isOpen, currentGarageId, currentGarageName]);

  if (!isOpen || !settlement || !settlement.billing) return null;

  const handleGarageChange = (e) => {
    const id = e.target.value;
    const g = garageList.find(item => item.id === id);
    setSelectedGarageId(id);
    setSelectedGarageName(g ? g.name : '');
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
    setLineItems(prev =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: value };
        if (field === 'mechhelpPct') updated.garagePct = Math.max(0, 100 - Number(value));
        if (field === 'garagePct') updated.mechhelpPct = Math.max(0, 100 - Number(value));
        return updated;
      })
    );
  };

  // Live calculation preview
  const formattedItemsForCalc = lineItems.map(item => ({
    name: item.name,
    amount: Number(item.amount) || 0,
    splitEnabled: item.splitEnabled,
    mechhelpPct: item.splitEnabled ? item.mechhelpPct : 0,
    garagePct: item.splitEnabled ? item.garagePct : 100,
  }));
  const discountVal = Math.max(0, Number(discountStr) || 0);
  const calcResult = calculateSettlement(formattedItemsForCalc, paidTo, discountVal);

  const handleSave = async () => {
    try {
      setError(null);
      setIsSaving(true);

      if (!customerName.trim()) throw new Error('Customer Name is required.');
      if (lineItems.some(item => !item.name.trim())) throw new Error('All line items must have a name.');
      if (lineItems.some(item => isNaN(Number(item.amount)) || Number(item.amount) < 0)) throw new Error('All line items must have a valid non-negative amount.');
      if (isNaN(discountVal) || discountVal < 0) throw new Error('Discount must be a valid non-negative number.');

      lineItems.forEach((item, idx) => {
        if (item.splitEnabled && item.mechhelpPct + item.garagePct !== 100) {
          throw new Error(`Line item #${idx + 1} split percentages must sum to 100%.`);
        }
      });

      const finalGarageId = selectedGarageId || settlement.garageId || currentGarageId || '';
      const finalGarageName = selectedGarageName || settlement.garageName || currentGarageName || '';

      await updateSettlementBilling(
        settlement.id,
        settlement.billing!.id,
        settlement.leadId || null,
        {
          customerName: customerName.trim(),
          carBrand: carBrand.trim(),
          carModel: carModel.trim(),
          numberPlate: numberPlate.trim(),
          bookingDate,
          garageId: finalGarageId,
          garageName: finalGarageName,
          lineItems: formattedItemsForCalc,
          paidTo,
          discount: discountVal,
        }
      );

      await onSaved();
      onClose();
    } catch (err) {
      console.error('Error updating booking:', err);
      setError(err.message || 'Failed to update booking. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content surface-panel animate-fade-in" style={{ maxWidth: '620px', maxHeight: 'calc(100vh - 10rem)', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>Edit Booking &amp; Settlement Details</h2>
          <button onClick={onClose} className="btn-icon" disabled={isSaving}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body" style={{ paddingBottom: '1.5rem', fontSize: '0.875rem' }}>
          {error && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <ShieldAlert size={18} />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Customer & Garage */}
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)' }}>1. Customer &amp; Garage Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Customer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Garage</label>
                {garageList.length > 0 ? (
                  <select
                    className="form-select"
                    value={selectedGarageId}
                    onChange={handleGarageChange}
                    disabled={isSaving}
                  >
                    <option value="">Select Garage...</option>
                    {garageList.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-light)' }}>
                    <Landmark size={16} style={{ color: 'var(--accent-primary)' }} />
                    <strong>{selectedGarageName || currentGarageName || 'Garage Locked'}</strong>
                  </div>
                )}
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Car Brand</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Maruti Suzuki"
                  value={carBrand}
                  onChange={e => setCarBrand(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Car Model</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Swift Dzire"
                  value={carModel}
                  onChange={e => setCarModel(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div>
                <label className="form-label" style={{ marginBottom: '0.25rem' }}>Number Plate</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. MH 12 AB 1234"
                  value={numberPlate}
                  onChange={e => setNumberPlate(e.target.value)}
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
            </div>
          </div>

          {/* Section 2: Services / Line Items */}
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>2. Sold Services / Line Items</h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddItem}
                disabled={isSaving}
              >
                <Plus size={14} style={{ marginRight: '0.25rem' }} /> Add Line Item
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {lineItems.map((item, index) => (
                <div
                  key={index}
                  style={{
                    padding: '0.875rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-light)',
                  }}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 40px', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Item Description (e.g. Engine Oil Synthetic)"
                      value={item.name}
                      onChange={e => handleItemChange(index, 'name', e.target.value)}
                      disabled={isSaving}
                    />
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>₹</span>
                      <input
                        type="number"
                        className="form-input"
                        style={{ paddingLeft: '1.4rem' }}
                        placeholder="Amount"
                        value={item.amount}
                        onChange={e => handleItemChange(index, 'amount', e.target.value)}
                        min={0}
                        disabled={isSaving}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn-icon text-red"
                      onClick={() => handleRemoveItem(index)}
                      disabled={isSaving || lineItems.length === 1}
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* Split toggle & custom percentage */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={item.splitEnabled}
                        onChange={e => handleItemChange(index, 'splitEnabled', e.target.checked)}
                        disabled={isSaving}
                      />
                      <span>Enable MechHelp Split</span>
                    </label>

                    {item.splitEnabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {!item.showPctEdit ? (
                          <span>
                            Ratio: <strong>{item.mechhelpPct}% MechHelp / {item.garagePct}% Garage</strong>
                            <button
                              type="button"
                              onClick={() => handleItemChange(index, 'showPctEdit', true)}
                              style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', marginLeft: '0.5rem', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Edit Split %
                            </button>
                          </span>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span>MH:</span>
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '55px', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                              value={item.mechhelpPct}
                              onChange={e => handleItemChange(index, 'mechhelpPct', Number(e.target.value))}
                              min={0} max={100}
                            />
                            <span>% / Garage:</span>
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: '55px', padding: '0.2rem 0.4rem', fontSize: '0.78rem' }}
                              value={item.garagePct}
                              onChange={e => handleItemChange(index, 'garagePct', Number(e.target.value))}
                              min={0} max={100}
                            />
                            <span>%</span>
                            <button
                              type="button"
                              onClick={() => handleItemChange(index, 'showPctEdit', false)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                            >
                              Done
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Discount field */}
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-secondary)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-light)' }}>
              <div>
                <strong style={{ fontSize: '0.875rem' }}>Discount (₹)</strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Borne 100% by MechHelp (garage gets full split share)</div>
              </div>
              <div style={{ position: 'relative', width: '130px' }}>
                <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>₹</span>
                <input
                  type="number"
                  className="form-input"
                  style={{ paddingLeft: '1.4rem' }}
                  value={discountStr}
                  onChange={e => setDiscountStr(e.target.value)}
                  min={0}
                  disabled={isSaving}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Payment Collected By */}
          <div style={{ borderBottom: '1px solid var(--border-light)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>3. Payment Collected By</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px',
                  border: paidTo === 'garage' ? '2px solid var(--accent-primary)' : '1px solid var(--border-light)',
                  backgroundColor: paidTo === 'garage' ? 'var(--accent-bg)' : 'var(--bg-secondary)', cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="paidTo"
                  value="garage"
                  checked={paidTo === 'garage'}
                  onChange={() => setPaidTo('garage')}
                  disabled={isSaving}
                />
                <div>
                  <strong>Garage Collected</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Garage owes MechHelp our share</div>
                </div>
              </label>
              <label
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem', borderRadius: '8px',
                  border: paidTo === 'mechhelp' ? '2px solid var(--accent-primary)' : '1px solid var(--border-light)',
                  backgroundColor: paidTo === 'mechhelp' ? 'var(--accent-bg)' : 'var(--bg-secondary)', cursor: 'pointer'
                }}
              >
                <input
                  type="radio"
                  name="paidTo"
                  value="mechhelp"
                  checked={paidTo === 'mechhelp'}
                  onChange={() => setPaidTo('mechhelp')}
                  disabled={isSaving}
                />
                <div>
                  <strong>MechHelp Collected</strong>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>MechHelp owes Garage their share</div>
                </div>
              </label>
            </div>
          </div>

          {/* Dynamic Summary Breakdown Preview */}
          <div style={{ padding: '0.875rem 1rem', borderRadius: '8px', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border-light)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
              <span>Total Customer Paid (Gross - Discount):</span>
              <strong>₹{calcResult.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>MechHelp Entitled (after discount):</span>
              <span style={{ color: calcResult.totalMechhelpEntitled < 0 ? 'var(--danger)' : 'inherit' }}>₹{calcResult.totalMechhelpEntitled.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Garage Entitled:</span>
              <span>₹{calcResult.totalGarageEntitled.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-light)', paddingTop: '0.35rem', marginTop: '0.35rem', fontWeight: 700 }}>
              <span>Updated Net Settlement Effect:</span>
              <span className={calcResult.netAmount > 0 ? 'text-green' : calcResult.netAmount < 0 ? 'text-red' : 'text-gray'}>
                {calcResult.netAmount > 0 ? 'Garage owes MechHelp' : 'MechHelp owes Garage'} ₹{Math.abs(calcResult.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem', borderTop: '1px solid var(--border-light)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>Cancel</button>
          <button type="button" className="btn btn-primary flex items-center gap-1.5" onClick={handleSave} disabled={isSaving}>
            <Save size={16} />
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

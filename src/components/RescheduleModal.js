import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Car, User, Phone } from 'lucide-react';
import { useLeadContext } from '../store/LeadContext.js';



export const RescheduleModal = ({ isOpen, onClose, lead, onSave }) => {
  const { getGarageList } = useLeadContext();
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newGarage, setNewGarage] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [garageList, setGarageList] = useState([]);

  const currentDateTime = lead?.bookingDateTime ? new Date(lead.bookingDateTime) : null;
  const currentDate = currentDateTime ? currentDateTime.toISOString().split('T')[0] : '';
  const currentTime = currentDateTime ? currentDateTime.toTimeString().slice(0, 5) : '';

  useEffect(() => {
    if (isOpen && lead) {
      setNewDate('');
      setNewTime('');
      setNewGarage(lead.garageAssigned || '');
      setReason('');
      setRemarks('');
      setError('');
      getGarageList()
        .then(list => setGarageList(list))
        .catch(err => console.error('Failed to load garages in RescheduleModal:', err));
    }
  }, [isOpen, lead]);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!newDate || !newTime || !reason) {
      setError('Please fill out all required fields.');
      return;
    }

    const selectedDate = new Date(`${newDate}T${newTime}`);
    if (selectedDate < new Date()) {
      setError('New booking date and time cannot be in the past.');
      return;
    }

    setIsSubmitting(true);

    try {
      const historyEntry: RescheduleHistoryEntry = {
        previousDate: currentDate,
        previousTime: currentTime,
        previousGarage: lead.garageAssigned,
        newDate: newDate,
        newTime: newTime,
        newGarage: newGarage,
        reason,
        remarks,
        rescheduledBy: 'Chetan',
        rescheduledOn: new Date().toISOString()
      };

      const updatedLead: Lead = {
        ...lead,
        bookingDateTime: selectedDate.toISOString(),
        garageAssigned: newGarage,
        bookingHistory: [...(lead.bookingHistory || []), historyEntry]
      };

      await onSave(updatedLead);
      onClose();
    } catch (err) {
      setError('Failed to reschedule. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content surface-panel animate-fade-in" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2>Reschedule Booking</h2>
          <button onClick={onClose} className="btn-icon"><X size={20} /></button>
        </div>

        <div className="modal-body">
          {error && <div style={{ background: 'var(--danger-bg)', color: 'var(--danger)', padding: '0.75rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', fontSize: '0.875rem' }}>{error}</div>}
          
          <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem', border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>Current Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <User size={14} style={{ color: 'var(--info)' }} />
                <span>{lead.customerName}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <Phone size={14} style={{ color: 'var(--info)' }} />
                <span>{lead.identifier}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <Car size={14} style={{ color: 'var(--info)' }} />
                <span>{lead.carBrand} {lead.carModel}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                <MapPin size={14} style={{ color: 'var(--info)' }} />
                <span>{lead.garageAssigned || 'No Garage'}</span>
              </div>
              <div style={{ gridColumn: 'span 2', marginTop: '0.5rem', padding: '0.5rem', background: 'var(--warning-bg)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.2)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={14} style={{ color: 'var(--warning)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--warning)' }}>
                  Current: {currentDate ? new Date(currentDate.includes('T') ? currentDate : `${currentDate}T00:00:00`).toLocaleDateString('en-GB') : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">New Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">New Time *</label>
                <input
                  type="time"
                  className="form-input"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Update Garage (Optional)</label>
              <select 
                className="form-select"
                value={newGarage}
                onChange={(e) => setNewGarage(e.target.value)}
              >
                <option value="">Keep current garage...</option>
                {newGarage && !garageList.some(g => g.name === newGarage) && (
                  <option value={newGarage}>{newGarage} (Archived)</option>
                )}
                {garageList.map(g => (
                  <option key={g.id} value={g.name}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Reason for Reschedule *</label>
              <select 
                className="form-select"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              >
                <option value="">Select a reason...</option>
                <option value="Customer Request">Customer Request</option>
                <option value="Garage Busy">Garage Busy</option>
                <option value="Parts Unavailable">Parts Unavailable</option>
                <option value="Executive Unavailable">Executive Unavailable</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Remarks</label>
              <textarea 
                className="form-textarea"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Additional context..."
              />
            </div>

            <div className="modal-footer" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-light)' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save & Reschedule'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

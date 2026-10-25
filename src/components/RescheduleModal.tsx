import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Lead, RescheduleHistoryEntry } from '../types';
import { X, Calendar, Clock, MapPin, Car, User, Phone, CalendarClock, AlertCircle } from 'lucide-react';
import { useLeadContext } from '../store/LeadContext';
import './RescheduleModal.css';

interface RescheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Lead | null;
  onSave: (updatedLead: Lead) => Promise<void>;
}

export const RescheduleModal: React.FC<RescheduleModalProps> = ({ isOpen, onClose, lead, onSave }) => {
  const { getGarageList } = useLeadContext();
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newGarage, setNewGarage] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [garageList, setGarageList] = useState<{ id: string; name: string }[]>([]);

  // Parse current booking date and time
  const currentDateTime = lead?.bookingDateTime ? new Date(lead.bookingDateTime.includes('T') ? lead.bookingDateTime : `${lead.bookingDateTime}T00:00:00`) : null;
  const currentDate = currentDateTime && !isNaN(currentDateTime.getTime()) ? currentDateTime.toISOString().split('T')[0] : '';
  const hasSpecificTime = lead?.bookingDateTime?.includes('T') && lead.bookingDateTime.split('T')[1]?.length >= 4;
  const currentTime = currentDateTime && !isNaN(currentDateTime.getTime()) && hasSpecificTime ? currentDateTime.toTimeString().slice(0, 5) : '';

  const formattedCurrentDate = currentDateTime && !isNaN(currentDateTime.getTime())
    ? currentDateTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : 'Not Scheduled';
  
  const formattedCurrentTime = currentTime
    ? currentDateTime?.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

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
  }, [isOpen, lead, getGarageList]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !lead) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newDate || !newTime || !reason) {
      setError('Please provide a new date, time, and select a reason for rescheduling.');
      return;
    }

    const selectedDate = new Date(`${newDate}T${newTime}`);
    if (isNaN(selectedDate.getTime())) {
      setError('Invalid date or time format selected.');
      return;
    }

    if (selectedDate < new Date()) {
      setError('The new booking date and time cannot be in the past.');
      return;
    }

    setIsSubmitting(true);

    try {
      const historyEntry: RescheduleHistoryEntry = {
        previousDate: currentDate || new Date().toISOString().split('T')[0],
        previousTime: currentTime || '10:00',
        previousGarage: lead.garageAssigned || 'Not Assigned',
        newDate: newDate,
        newTime: newTime,
        newGarage: newGarage || lead.garageAssigned,
        reason,
        remarks: remarks.trim(),
        rescheduledBy: 'Chetan',
        rescheduledOn: new Date().toISOString()
      };

      const updatedLead: Lead = {
        ...lead,
        bookingDateTime: selectedDate.toISOString(),
        garageAssigned: newGarage || lead.garageAssigned,
        bookingHistory: [...(lead.bookingHistory || []), historyEntry]
      };

      await onSave(updatedLead);
      onClose();
    } catch (err: any) {
      console.error('Failed to save reschedule:', err);
      setError(err?.message || 'Failed to reschedule booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return createPortal(
    <div 
      className="reschedule-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="reschedule-modal-container surface-panel">
        {/* Header */}
        <div className="reschedule-modal-header">
          <div className="reschedule-header-title">
            <div className="reschedule-header-icon">
              <CalendarClock size={20} />
            </div>
            <div className="reschedule-header-text">
              <h2>Reschedule Booking</h2>
              <p>Change appointment date, time, or assigned garage</p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="reschedule-close-btn"
            disabled={isSubmitting}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="reschedule-modal-body">
            {error && (
              <div className="reschedule-error-banner">
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Current Details Card */}
            <div className="reschedule-current-card">
              <span className="reschedule-card-heading">Current Booking Details</span>
              <div className="reschedule-info-grid">
                <div className="reschedule-info-item" title={lead.customerName}>
                  <User size={15} />
                  <span>Customer: <strong>{lead.customerName}</strong></span>
                </div>
                <div className="reschedule-info-item">
                  <Phone size={15} />
                  <span>Phone: <strong>{lead.identifier}</strong></span>
                </div>
                <div className="reschedule-info-item" title={`${lead.carBrand} ${lead.carModel}`}>
                  <Car size={15} />
                  <span>Vehicle: <strong>{lead.carBrand} {lead.carModel}</strong></span>
                </div>
                <div className="reschedule-info-item" title={lead.garageAssigned || 'No Garage'}>
                  <MapPin size={15} />
                  <span>Garage: <strong>{lead.garageAssigned || 'Not Assigned'}</strong></span>
                </div>
              </div>

              <div className="reschedule-current-badge">
                <Calendar size={16} />
                <span>
                  Current: {formattedCurrentDate} {formattedCurrentTime ? `at ${formattedCurrentTime}` : ''}
                </span>
              </div>
            </div>

            {/* Input Controls */}
            <div className="reschedule-form">
              <div className="reschedule-form-row">
                <div className="reschedule-field">
                  <label>
                    <Calendar size={14} style={{ color: 'var(--text-muted)' }} />
                    New Date *
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    min={todayStr}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="reschedule-field">
                  <label>
                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    New Time *
                  </label>
                  <input
                    type="time"
                    className="form-input"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="reschedule-field">
                <label>
                  <MapPin size={14} style={{ color: 'var(--text-muted)' }} />
                  Reassign Garage (Optional)
                </label>
                <select 
                  className="form-select"
                  value={newGarage}
                  onChange={(e) => setNewGarage(e.target.value)}
                  disabled={isSubmitting}
                >
                  <option value="">Keep currently assigned garage...</option>
                  {newGarage && !garageList.some(g => g.name === newGarage) && (
                    <option value={newGarage}>{newGarage} (Currently Assigned)</option>
                  )}
                  {garageList.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div className="reschedule-field">
                <label>
                  Reason for Reschedule *
                </label>
                <select 
                  className="form-select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  disabled={isSubmitting}
                >
                  <option value="">Select a reason...</option>
                  <option value="Customer Request">Customer Request</option>
                  <option value="Garage Busy / Fully Booked">Garage Busy / Fully Booked</option>
                  <option value="Parts Unavailable">Parts Unavailable</option>
                  <option value="Executive / Mechanic Unavailable">Executive / Mechanic Unavailable</option>
                  <option value="Customer Unreachable">Customer Unreachable</option>
                  <option value="Vehicle Not Available">Vehicle Not Available</option>
                  <option value="Weather / Emergency">Weather / Emergency</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="reschedule-field">
                <label>Remarks / Notes</label>
                <textarea 
                  className="form-textarea"
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Additional context or customer request details..."
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="reschedule-modal-footer">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose} 
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSubmitting}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <CalendarClock size={16} />
              {isSubmitting ? 'Rescheduling...' : 'Save & Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { addDays, format } from 'date-fns';
import { useLeadContext } from '../store/LeadContext.js';



export const CallOutcomeModal = ({ isOpen, onClose, lead, onBooked }) => {
  const { updateLead } = useLeadContext();
  const [outcome, setOutcome] = useState('Call Not Received');
  const [followUpDate, setFollowUpDate] = useState(
    format(addDays(new Date(), 1), 'yyyy-MM-dd')
  );
  
  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create activity record
    const newActivity: CallActivity = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      outcome: outcome,
    };

    const updatedLead: Lead = {
      ...lead,
      leadType: outcome,
      lastContactedDate: new Date().toISOString(),
      activityHistory: [newActivity, ...(lead.activityHistory || [])]
    };

    if (outcome === 'Call Not Received') {
      updatedLead.nextFollowUpDate = format(addDays(new Date(), 1), 'yyyy-MM-dd');
      updateLead(updatedLead);
      onClose();
    } else if (outcome === 'Details Shared' || outcome === 'Retarget') {
      updatedLead.nextFollowUpDate = followUpDate;
      updateLead(updatedLead);
      onClose();
    } else if (outcome === 'Booked') {
      // Don't update directly here; pass to AddLeadModal to fill booking details
      onBooked(updatedLead);
      onClose();
    } else if (outcome === 'Completed' || outcome === 'Lost') {
      // Just update, user doesn't follow up
      updateLead(updatedLead);
      onClose();
    } else if (outcome === 'Fresh Lead') {
       updatedLead.nextFollowUpDate = followUpDate;
       updateLead(updatedLead);
       onClose();
    }
  };

  const needsDate = outcome === 'Details Shared' || outcome === 'Shared Quotation' || outcome === 'Retarget' || outcome === 'Fresh Lead';

  return createPortal(
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content surface-panel animate-fade-in" style={{ maxWidth: '400px' }}>
        <div className="modal-header">
          <h2>Log Call: {lead.customerName}</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4">
          <div className="form-group">
            <label className="form-label">Call Outcome</label>
            <select className="form-select" value={outcome} onChange={e => setOutcome(e.target.valueType)}>
              <option value="Fresh Lead">Fresh Lead</option>
              <option value="Call Not Received">Call Not Received</option>
              <option value="Details Shared">Details Shared</option>
              <option value="Shared Quotation">Shared Quotation</option>
              <option value="Retarget">Retarget</option>
              <option value="Booked">Booked</option>
              <option value="Completed">Completed</option>
              <option value="Lost">Lost</option>
            </select>
          </div>

          {needsDate && (
            <div className="form-group animate-fade-in">
              <label className="form-label">Next Follow-up Date</label>
              <input 
                type="date" 
                className="form-input" 
                value={followUpDate} 
                onChange={e => setFollowUpDate(e.target.value)} 
                required
              />
            </div>
          )}

          <div className="modal-footer mt-4 p-0">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">
              {outcome === 'Booked' ? 'Continue to Booking' : 'Save Outcome'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

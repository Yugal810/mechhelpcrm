import React from 'react';
import { createPortal } from 'react-dom';
import { BookingTimeline } from './BookingTimeline.js';



export const TimelineModal = ({ isOpen, onClose, lead }) => {
  if (!isOpen || !lead) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal-content surface-panel animate-fade-in" 
        style={{ maxWidth: '550px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>Booking Timeline</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body" style={{ maxHeight: '75vh', overflowY: 'auto' }}>
          <BookingTimeline lead={lead} />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

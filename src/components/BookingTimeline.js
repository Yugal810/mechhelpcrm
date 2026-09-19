import React from 'react';
import { Calendar, ChevronRight, CheckCircle, User } from 'lucide-react';



export const BookingTimeline = ({ lead }) => {
  const history = lead.bookingHistory || [];
  
  if (history.length === 0) {
    return (
      <div className="text-gray-400 text-sm italic py-4">
        No reschedule history for this booking.
      </div>
    );
  }

  return (
    <div className="booking-timeline mt-4">
      <h3 className="text-sm font-semibold mb-4 text-gray-300">Activity Log & Timeline</h3>
      
      <div className="relative border-l border-gray-700 ml-3 space-y-6">
        {/* Original Creation (Implied by the first history entry) */}
        <div className="relative pl-6">
          <div className="absolute w-3 h-3 bg-success rounded-full -left-[6.5px] top-1"></div>
          <p className="text-sm font-semibold">Booking Created</p>
          <p className="text-xs text-gray-400">
            {new Date(history[0].previousDate).toLocaleDateString('en-GB')} at {history[0].previousTime}
          </p>
          <p className="text-xs text-gray-500 mt-1">Garage: {history[0].previousGarage || 'Not Assigned'}</p>
        </div>

        {/* Reschedule Entries */}
        {history.map((entry, idx) => (
          <div key={idx} className="relative pl-6">
            <div className="absolute w-3 h-3 bg-warning rounded-full -left-[6.5px] top-1"></div>
            
            <div className="surface-card p-3 rounded border border-gray-700/50 text-sm">
              <div className="flex justify-between items-start mb-2">
                <span className="font-semibold text-warning flex items-center">
                  <Calendar size={14} className="mr-1" /> Rescheduled
                </span>
                <span className="text-xs text-gray-500">
                  {new Date(entry.rescheduledOn).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              
              <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-2 bg-dark-eval p-2 rounded">
                <div className="text-xs text-gray-400">
                  <div className="line-through">{new Date(entry.previousDate).toLocaleDateString('en-GB')}</div>
                  <div className="line-through">{entry.previousTime}</div>
                </div>
                <ChevronRight size={14} className="text-gray-500" />
                <div className="text-xs font-semibold text-accent">
                  <div>{new Date(entry.newDate).toLocaleDateString('en-GB')}</div>
                  <div>{entry.newTime}</div>
                </div>
              </div>
              
              <div className="text-xs space-y-1">
                <p><span className="text-gray-400">Reason:</span> {entry.reason}</p>
                {entry.remarks && <p><span className="text-gray-400">Remarks:</span> {entry.remarks}</p>}
                <p className="flex items-center text-gray-400 mt-2">
                  <User size={12} className="mr-1" /> By {entry.rescheduledBy}
                </p>
              </div>
            </div>
          </div>
        ))}
        
        {/* Current State */}
        <div className="relative pl-6">
          <div className="absolute w-3 h-3 bg-primary rounded-full -left-[6.5px] top-1"></div>
          <p className="text-sm font-semibold flex items-center">
            <CheckCircle size={14} className="text-primary mr-1" /> Current Booking
          </p>
          <p className="text-xs text-gray-300 mt-1">
            {lead.bookingDateTime ? new Date(lead.bookingDateTime.includes('T') ? lead.bookingDateTime : `${lead.bookingDateTime}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
          </p>
          <p className="text-xs text-gray-400 mt-1">Garage: {lead.garageAssigned || 'Not Assigned'}</p>
        </div>
      </div>
    </div>
  );
};

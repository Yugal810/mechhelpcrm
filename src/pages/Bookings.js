import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLeadContext } from '../store/LeadContext.js';
import { isToday, isTomorrow } from 'date-fns';
import { Search, ChevronLeft, ChevronRight, CalendarClock, History, AlertCircle } from 'lucide-react';
import { RescheduleModal } from '../components/RescheduleModal.js';
import { TimelineModal } from '../components/TimelineModal.js';
import { DeleteConfirmAction } from '../components/DeleteConfirmAction.js';
import { BookingStatusDropdown } from '../components/BookingStatusDropdown.js';
import { CompletedModal } from '../components/CompletedModal.js';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge.js';
import { LeadNoteButton } from '../components/LeadNoteButton.js';

const parseBookingDate = (dStr?: string): Date => {
  if (!dStr) return new Date(NaN);
  return new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
};

export const Bookings = () => {
  const { leads, updateLead, deleteLead } = useLeadContext();
  const [searchParams] = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Modals & Delete state
  const [rescheduleLead, setRescheduleLead] = useState(null);
  const [timelineLead, setTimelineLead] = useState(null);
  const [completedLead, setCompletedLead] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter) setFilter(urlFilter);
  }, [searchParams]);

  // Include any lead that has a bookingDateTime (Booked, Completed, Lost/Cancelled)
  const allBookings = leads.filter(l => l.bookingDateTime);

  const filteredData = useMemo(() => {
    let data = allBookings;

    // Apply specific filter
    if (filter === 'today') {
      data = data.filter(l => l.leadType === 'Booked' && isToday(parseBookingDate(l.bookingDateTime)));
    } else if (filter === 'tomorrow') {
      data = data.filter(l => l.leadType === 'Booked' && isTomorrow(parseBookingDate(l.bookingDateTime)));
    } else if (filter === 'unnotified') {
      data = data.filter(l => l.leadType === 'Booked' && isTomorrow(parseBookingDate(l.bookingDateTime)) && !l.garageNotified);
    } else if (filter === 'rescheduled') {
      data = data.filter(l => (l.bookingHistory?.length || 0) > 0);
    } else if (filter === 'completed') {
      data = data.filter(l => l.leadType === 'Completed');
    } else if (filter === 'cancelled') {
      data = data.filter(l => l.leadType === 'Lost');
    } else if (filter === 'all') {
      // 'All Bookings' — every booking ever created regardless of status (spec §11)
      // No additional filter: allBookings already scopes to leads with a bookingDateTime
    }

    // Apply search across multiple fields
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      data = data.filter(l => 
        l.customerName.toLowerCase().includes(lowerSearch) ||
        l.carBrand.toLowerCase().includes(lowerSearch) ||
        l.carModel.toLowerCase().includes(lowerSearch) ||
        l.identifier.toLowerCase().includes(lowerSearch) ||
        (l.garageAssigned && l.garageAssigned.toLowerCase().includes(lowerSearch))
      );
    }

    // Sort by booking date ascending
    return data.sort((a, b) => parseBookingDate(a.bookingDateTime).getTime() - parseBookingDate(b.bookingDateTime).getTime());
  }, [allBookings, filter, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleStatusChange = async (leadId: string, newStatus: LeadType) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      await updateLead({ ...lead, leadType: newStatus });
    }
  };

  const handleMarkNotified = (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) updateLead({ ...lead, garageNotified: true });
  };

  const handleSaveReschedule = async (updatedLead) => {
    await updateLead(updatedLead);
    alert('Booking rescheduled successfully!');
  };

  const handleDelete = async (leadId) => {
    try {
      setDeleteError(null);
      setDeletingId(leadId);
      await deleteLead(leadId);
    } catch (err) {
      console.error('Error deleting booking:', err);
      setDeleteError(err?.message || 'Failed to delete booking. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="bookings animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Bookings Hub</h1>
          <p>Manage, track, and reschedule all vehicle bookings</p>
        </div>
      </div>
      
      {deleteError && (
        <div className="surface-panel" style={{ padding: '1rem', marginBottom: '1.5rem', borderLeft: '4px solid var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: 'var(--danger)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={18} />
            <span>{deleteError}</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={() => setDeleteError(null)}>Dismiss</button>
        </div>
      )}

      <div className="filters surface-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search customer, phone, car, or garage..." 
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          
          <select 
            className="form-select" 
            style={{ width: 'auto' }}
            value={filter}
            onChange={(e) => { setFilter(e.target.value); setCurrentPage(1); }}
          >
            <option value="all">All Bookings</option>
            <option value="today">Today's Bookings</option>
            <option value="tomorrow">Tomorrow's Bookings</option>
            <option value="rescheduled">Rescheduled Bookings</option>
            <option value="completed">Completed Bookings</option>
            <option value="cancelled">Cancelled Bookings</option>
            <option value="unnotified">Needs Garage Notification</option>
          </select>
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Showing {filteredData.length} records
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Vehicle / Garage</th>
              <th>Current Booking</th>
              <th>History</th>
              <th>Status</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No bookings match your criteria.</td></tr>
            ) : (
              currentData.map(lead => {
                const rescheduleCount = lead.bookingHistory?.length || 0;
                const isConfirmed = lead.leadType === 'Booked';
                
                return (
                  <tr key={lead.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                        <strong>{lead.customerName}</strong>
                        {lead.isVip && <span className="badge badge-vip text-[10px] px-1 py-0">VIP</span>}
                        <ServiceTypeBadge serviceType={lead.serviceType} compact />
                      </div>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                        {lead.priority === 'High' ? '🔴 High' : lead.priority === 'Low' ? '🟢 Low' : '🟡 Medium'}
                      </div>
                      <small className="text-gray-400">{lead.identifier}</small>
                    </td>
                    <td>
                      <div className="text-sm font-medium">{lead.carBrand} {lead.carModel}</div>
                      {lead.numberPlate && <div className="text-xs text-muted font-medium">{lead.numberPlate}</div>}
                      <div className="text-xs text-gray-400">{lead.garageAssigned || 'No Garage'}</div>
                    </td>
                    <td>
                      <div className="text-sm font-medium">
                        {parseBookingDate(lead.bookingDateTime).toLocaleDateString('en-GB')}
                      </div>
                    </td>
                    <td>
                      {rescheduleCount > 0 ? (
                        <div className="flex flex-col items-start">
                          <span className="badge badge-warning mb-1 flex items-center gap-1 text-[10px]">
                            <History size={10} /> Rescheduled ({rescheduleCount})
                          </span>
                          <button 
                            className="text-xs text-accent hover:underline flex items-center"
                            onClick={() => setTimelineLead(lead)}
                          >
                            View Timeline
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </td>
                    <td>
                      <BookingStatusDropdown
                        leadId={lead.id}
                        currentStatus={lead.leadType}
                        onStatusChange={handleStatusChange}
                        disabled={deletingId === lead.id}
                        billingFinalized={lead.leadType === 'Completed'}
                      />
                      
                      {!lead.garageNotified && isConfirmed && (
                        <div className="mt-1">
                          <span className="badge badge-red text-[10px]">Garage Not Notified</span>
                        </div>
                      )}
                    </td>
                    <td><LeadNoteButton lead={lead} /></td>
                    <td>
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          {isConfirmed && (
                            <button 
                              className="btn btn-secondary btn-sm flex items-center justify-center gap-1"
                              onClick={() => setRescheduleLead(lead)}
                              disabled={deletingId === lead.id}
                            >
                              <CalendarClock size={14} /> Reschedule
                            </button>
                          )}
                          <DeleteConfirmAction
                            size="sm"
                            isDeleting={deletingId === lead.id}
                            onConfirm={() => handleDelete(lead.id)}
                          />
                        </div>
                        {!lead.garageNotified && isConfirmed && (
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => handleMarkNotified(lead.id)}
                            disabled={deletingId === lead.id}
                          >
                            Mark Notified
                          </button>
                        )}
                        {lead.garageNotified && isConfirmed && lead.leadType !== 'Completed' && (
                          <button 
                            type="button"
                            className="btn btn-sm flex items-center justify-center gap-1"
                            onClick={() => setCompletedLead(lead)}
                            disabled={deletingId === lead.id}
                            style={{ backgroundColor: 'var(--success)', color: '#fff', border: 'none' }}
                          >
                            Completed
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        
        {totalPages > 1 && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary btn-icon" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                className="btn btn-secondary btn-icon" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      <RescheduleModal 
        isOpen={!!rescheduleLead} 
        onClose={() => setRescheduleLead(null)} 
        lead={rescheduleLead} 
        onSave={handleSaveReschedule} 
      />
      
      <TimelineModal
        isOpen={!!timelineLead}
        onClose={() => setTimelineLead(null)}
        lead={timelineLead}
      />

      <CompletedModal
        isOpen={!!completedLead}
        onClose={() => setCompletedLead(null)}
        lead={completedLead}
      />
    </div>
  );
};

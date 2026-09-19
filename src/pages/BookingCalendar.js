import React, { useState, useMemo } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday, 
  addMonths, 
  subMonths 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Car, Wrench, Clock, ShieldAlert, History } from 'lucide-react';
import { useLeadContext } from '../store/LeadContext.js';
import { TimelineModal } from '../components/TimelineModal.js';
import { RescheduleModal } from '../components/RescheduleModal.js';
import './BookingCalendar.css';

const parseBookingDate = (dStr) => {
  if (!dStr) return new Date(NaN);
  return new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
};

export const BookingCalendar = () => {
  const { leads, updateLead } = useLeadContext();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  
  // Secondary modals
  const [timelineLead, setTimelineLead] = useState(null);
  const [rescheduleLead, setRescheduleLead] = useState(null);

  // All bookings from LeadContext (matching Bookings Hub logic)
  const allBookings = useMemo(() => {
    return leads.filter(l => l.bookingDateTime);
  }, [leads]);

  // Group bookings by date string (yyyy-MM-dd)
  const bookingsByDate = useMemo(() => {
    const map = new Map();
    allBookings.forEach(lead => {
      const bDate = parseBookingDate(lead.bookingDateTime);
      if (!isNaN(bDate.getTime())) {
        const key = format(bDate, 'yyyy-MM-dd');
        if (!map.has(key)) {
          map.set(key, []);
        }
        map.get(key).push(lead);
      }
    });
    return map;
  }, [allBookings]);

  // Generate days for current calendar view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: startDate, end: endDate });
  }, [currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const selectedDayBookings = useMemo(() => {
    if (!selectedDay) return [];
    const key = format(selectedDay, 'yyyy-MM-dd');
    return bookingsByDate.get(key) || [];
  }, [selectedDay, bookingsByDate]);

  const handleSaveReschedule = async (updatedLead) => {
    await updateLead(updatedLead);
    setRescheduleLead(null);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Booked': return 'status-booked';
      case 'Completed': return 'status-completed';
      case 'Lost': return 'status-lost';
      default: return 'status-rescheduled';
    }
  };

  return (
    <div className="booking-calendar-page animate-fade-in">
      {/* Calendar Top Header */}
      <div className="calendar-header">
        <div className="calendar-title-group">
          <div className="stat-icon" style={{ background: 'var(--bg-tertiary)', padding: '0.6rem', borderRadius: 'var(--radius-md)', display: 'flex' }}>
            <Calendar size={24} color="var(--accent-primary)" />
          </div>
          <div>
            <h1>Booking Calendar</h1>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              View and manage bookings by date in a monthly view
            </p>
          </div>
        </div>

        <div className="month-navigator">
          <button className="btn btn-secondary btn-sm" onClick={handleToday}>
            Today
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrevMonth} title="Previous Month">
              <ChevronLeft size={18} />
            </button>
            <span className="month-title">
              {format(currentMonth, 'MMMM yyyy')}
            </span>
            <button className="btn btn-secondary btn-sm" onClick={handleNextMonth} title="Next Month">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Month Grid View */}
      <div className="calendar-grid-container surface-panel">
        <div className="calendar-weekdays">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="weekday-cell">
              {day}
            </div>
          ))}
        </div>

        <div className="calendar-days-grid">
          {calendarDays.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDate.get(dateKey) || [];
            const count = dayBookings.length;
            const inCurrentMonth = isSameMonth(day, currentMonth);
            const today = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={`calendar-day-cell ${!inCurrentMonth ? 'other-month' : ''} ${today ? 'is-today' : ''} ${count > 0 ? 'has-bookings' : ''}`}
                onClick={() => setSelectedDay(day)}
              >
                <div className="day-cell-top">
                  <span className="day-number">{format(day, 'd')}</span>
                  {count > 0 && (
                    <span className="booking-count-badge">
                      {count}
                    </span>
                  )}
                </div>

                <div className="day-bookings-list">
                  {dayBookings.slice(0, 2).map((b) => (
                    <div key={b.id} className={`day-booking-chip ${getStatusBadgeClass(b.leadType)}`}>
                      {b.customerName} - {b.carModel || b.carBrand}
                    </div>
                  ))}
                  {count > 2 && (
                    <span className="more-bookings-tag">
                      +{count - 2} more
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Day Details Modal */}
      {selectedDay && (
        <div className="modal-overlay" onClick={() => setSelectedDay(null)}>
          <div 
            className="modal-content surface-panel animate-fade-in" 
            style={{ maxWidth: '650px', width: '90%' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.25rem', marginBottom: '0.2rem' }}>
                  {format(selectedDay, 'EEEE, MMMM d, yyyy')}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  {selectedDayBookings.length} {selectedDayBookings.length === 1 ? 'booking' : 'bookings'} scheduled
                </div>
              </div>
              <button className="btn-close" onClick={() => setSelectedDay(null)}>&times;</button>
            </div>

            <div className="modal-body" style={{ maxHeight: '65vh', overflowY: 'auto', padding: '1.25rem' }}>
              {selectedDayBookings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                  <Calendar size={40} style={{ marginBottom: '0.75rem', opacity: 0.5 }} />
                  <p style={{ fontSize: '1rem', fontWeight: 500, margin: 0 }}>No bookings on this date</p>
                  <span style={{ fontSize: '0.85rem' }}>There are no customer bookings scheduled for {format(selectedDay, 'MMMM d')}.</span>
                </div>
              ) : (
                selectedDayBookings.map((b) => {
                  const bDate = parseBookingDate(b.bookingDateTime);
                  const timeStr = b.bookingDateTime?.includes('T') 
                    ? format(bDate, 'hh:mm a') 
                    : null;

                  return (
                    <div key={b.id} className="day-booking-card">
                      <div className="day-booking-card-header">
                        <div className="customer-info">
                          <h4>
                            {b.customerName}
                            {b.isVip && (
                              <span style={{ marginLeft: '0.5rem', background: 'var(--vip-bg)', color: 'var(--vip)', fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: 'var(--radius-full)', fontWeight: 600 }}>
                                VIP
                              </span>
                            )}
                          </h4>
                          <div className="vehicle-text">
                            <Car size={14} style={{ display: 'inline', marginRight: '0.3rem', verticalAlign: '-2px' }} />
                            {b.carBrand} {b.carModel} • <span style={{ color: 'var(--text-muted)' }}>ID: {b.identifier}</span>
                          </div>
                        </div>

                        <span className={`badge-status ${getStatusBadgeClass(b.leadType)}`}>
                          {b.leadType}
                        </span>
                      </div>

                      <div className="day-booking-details">
                        <div className="detail-item">
                          <Wrench size={14} />
                          <span>Garage: <strong>{b.garageAssigned || 'Unassigned'}</strong></span>
                        </div>
                        {timeStr && (
                          <div className="detail-item">
                            <Clock size={14} />
                            <span>Time: <strong>{timeStr}</strong></span>
                          </div>
                        )}
                        <div className="detail-item">
                          <ShieldAlert size={14} />
                          <span>Priority: <strong>{b.priority}</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.8rem', justifyContent: 'flex-end' }}>
                        {(b.bookingHistory?.length || 0) > 0 && (
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => setTimelineLead(b)}
                            title="View reschedule timeline"
                          >
                            <History size={14} style={{ marginRight: '0.3rem' }} /> History
                          </button>
                        )}
                        <button 
                          className="btn btn-secondary btn-sm"
                          onClick={() => setRescheduleLead(b)}
                        >
                          Reschedule
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedDay(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals for Timeline & Reschedule actions */}
      {timelineLead && (
        <TimelineModal 
          isOpen={!!timelineLead} 
          onClose={() => setTimelineLead(null)} 
          lead={timelineLead} 
        />
      )}

      {rescheduleLead && (
        <RescheduleModal 
          isOpen={!!rescheduleLead} 
          onClose={() => setRescheduleLead(null)} 
          lead={rescheduleLead} 
          onSave={handleSaveReschedule} 
        />
      )}
    </div>
  );
};

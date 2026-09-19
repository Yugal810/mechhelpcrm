import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeadContext } from '../store/LeadContext.js';
import { useTheme } from '../store/ThemeContext.js';
import { CallOutcomeModal } from './CallOutcomeModal.js';
import { AddLeadModal } from './AddLeadModal.js';
import { CheckCircle, Calendar, Sun, Moon, List, RotateCcw } from 'lucide-react';
import './StickyHeader.css';
import { isToday, isTomorrow, isBefore, startOfToday } from 'date-fns';

export const StickyHeader = () => {
  const { leads, isLoading } = useLeadContext();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [selectedCallLead, setSelectedCallLead] = React.useState(null);
  const [bookingLead, setBookingLead] = React.useState(null);

  const parseBookingDate = (dStr) => {
    if (!dStr) return new Date(NaN);
    return new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
  };

  const today = startOfToday();

  const bookedLeads = leads.filter(l => l.leadType === 'Booked' && l.bookingDateTime);
  const bookingsToday = bookedLeads.filter(l => isToday(parseBookingDate(l.bookingDateTime))).length;
  const bookingsTomorrow = bookedLeads.filter(l => isTomorrow(parseBookingDate(l.bookingDateTime))).length;
  const totalBookings = bookedLeads.length;

  // Reminders logic matching ReminderPage (Retarget leads due today or rolled over from past)
  const todayReminders = leads.filter(l => {
    if (l.leadType !== 'Retarget') return false;
    const fDate = parseBookingDate(l.nextFollowUpDate);
    return isToday(fDate) || isBefore(fDate, today);
  });
  const morningReminders = todayReminders.filter(l => l.retargetTimeSlot === 'morning').length;
  // Legacy leads with no time slot (null/undefined) default to Evening — mirrors ReminderPage logic
  const eveningReminders = todayReminders.filter(l => l.retargetTimeSlot === 'evening' || !l.retargetTimeSlot).length;

  const rescheduledCustomers = leads.filter(l => (l.bookingHistory?.length || 0) > 0).length;
  const rescheduledToday = leads.filter(l => 
    l.bookingHistory?.some(h => isToday(new Date(h.rescheduledOn)))
  ).length;

  return (
    <header className="sticky-header surface-header">
      <div className="header-content">
        <div className="header-stats">
          <div className="stat-box clickable" onClick={() => navigate('/leads/today/morning')}>
            <Sun size={18} className="text-warning" />
            <div className="stat-content">
              <span className="stat-label">Reminders: Morning</span>
              <span className="stat-value">{isLoading ? '-' : morningReminders}</span>
            </div>
          </div>

          <div className="stat-box clickable" onClick={() => navigate('/leads/today/evening')}>
            <Moon size={18} className="text-primary" />
            <div className="stat-content">
              <span className="stat-label">Reminders: Evening</span>
              <span className="stat-value">{isLoading ? '-' : eveningReminders}</span>
            </div>
          </div>
          
          <div className="stat-box clickable" onClick={() => navigate('/bookings?filter=today')}>
            <CheckCircle size={18} className="text-success" />
            <div className="stat-content">
              <span className="stat-label">Bookings Today</span>
              <span className="stat-value">{isLoading ? '-' : bookingsToday}</span>
            </div>
          </div>

          <div className="stat-box clickable" onClick={() => navigate('/bookings?filter=tomorrow')}>
            <Calendar size={18} className="text-warning" />
            <div className="stat-content">
              <span className="stat-label">Tomorrow</span>
              <span className="stat-value">{isLoading ? '-' : bookingsTomorrow}</span>
            </div>
          </div>

          <div className="stat-box clickable" onClick={() => navigate('/bookings?filter=rescheduled')}>
            <RotateCcw size={18} className="text-warning" />
            <div className="stat-content">
              <span className="stat-label">Rescheduled</span>
              <span className="stat-value">{isLoading ? '-' : rescheduledCustomers}</span>
              <span className="stat-subtext" style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{rescheduledToday} today</span>
            </div>
          </div>

          <div className="stat-box clickable" onClick={() => navigate('/bookings?filter=all')}>
            <List size={18} className="text-primary" />
            <div className="stat-content">
              <span className="stat-label">Total Bookings</span>
              <span className="stat-value">{isLoading ? '-' : totalBookings}</span>
            </div>
          </div>
        </div>

        <button onClick={toggleTheme} className="btn-icon theme-toggle" aria-label="Toggle Theme">
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
      {bookingLead && (
        <AddLeadModal 
          isOpen={!!bookingLead} 
          onClose={() => setBookingLead(null)} 
          initialData={bookingLead}
        />
      )}
      {selectedCallLead && (
        <CallOutcomeModal
          isOpen={!!selectedCallLead}
          onClose={() => setSelectedCallLead(null)}
          lead={selectedCallLead}
          onBooked={(l) => setBookingLead(l)}
        />
      )}
    </header>
  );
};

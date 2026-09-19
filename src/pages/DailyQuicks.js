import React, { useCallback, useEffect, useState } from 'react';
import {
  Users,
  Phone,
  Car,
  Calendar,
  CalendarClock,
  BellRing,
  RotateCcw,
  Star,
  AlertCircle,
  CalendarDays,
  History,
} from 'lucide-react';
import { useLeadContext } from '../store/LeadContext.js';
import { DailyQuicksService } from '../utils/dailyQuicksService.js';
import { formatISTDisplayDate, toISTDateString } from '../../shared/dailyQuicks/istDate.js';
import './DailyQuicks.css';



const STAT_CARDS: StatCardConfig[] = [
  { key: 'totalLeads', title: 'Total Leads', subtitle: 'All leads in CRM', icon: <Users size={20} />, iconClass: 'text-primary' },
  { key: 'callsDueToday', title: 'Calls Due Today', subtitle: 'Overdue + due today', icon: <Phone size={20} />, iconClass: 'text-accent' },
  { key: 'totalBookings', title: 'Total Bookings', subtitle: 'Active booked leads', icon: <Car size={20} />, iconClass: 'text-success' },
  { key: 'todaysBookings', title: "Today's Bookings", subtitle: 'Appointments today', icon: <Calendar size={20} />, iconClass: 'text-success' },
  { key: 'tomorrowsBookings', title: "Tomorrow's Bookings", subtitle: 'Appointments tomorrow', icon: <CalendarClock size={20} />, iconClass: 'text-warning' },
  { key: 'garageNotifications', title: 'Garage Notifications', subtitle: 'Tomorrow, not notified', icon: <BellRing size={20} />, iconClass: 'text-danger' },
  { key: 'rescheduledBookings', title: 'Rescheduled Bookings', subtitle: 'With reschedule history', icon: <RotateCcw size={20} />, iconClass: 'text-warning' },
  { key: 'vipCustomers', title: 'VIP Customers', subtitle: 'VIP flagged leads', icon: <Star size={20} />, iconClass: 'text-vip' },
];

const SECTION_CONFIG = [
  { key: 'todaysCalls' as const, title: "Today's Calls" },
  { key: 'todaysBookings' as const, title: "Today's Bookings" },
  { key: 'tomorrowsBookings' as const, title: "Tomorrow's Bookings" },
  { key: 'rescheduledBookings' as const, title: 'Rescheduled Bookings' },
  { key: 'garageNotifications' as const, title: 'Garage Notifications' },
  { key: 'vipCustomers' as const, title: 'VIP Customers' },
];

const StatCardSkeleton = () => (
  <div className="daily-quicks-stat-card surface-panel daily-quicks-skeleton daily-quicks-skeleton-card" />
);

const SectionSkeleton = () => (
  <div className="daily-quicks-section surface-panel daily-quicks-skeleton daily-quicks-skeleton-section" />
);

const EntryTable = ({ entries }) => {
  if (entries.length === 0) {
    return <div className="daily-quicks-empty">No entries for this section.</div>;
  }

  return (
    <table className="daily-quicks-mini-table">
      <tbody>
        {entries.map((entry) => (
          <tr key={`${entry.customerName}-${entry.identifier}`}>
            <td>{entry.customerName}</td>
            <td className="identifier-col">{entry.identifier}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export const DailyQuicks = () => {
  const { leads, isLoading: leadsLoading } = useLeadContext();
  const today = toISTDateString();

  const [selectedDate, setSelectedDate] = useState(today);
  const [storedSummary, setStoredSummary] = useState(null);
  const [previousSummaries, setPreviousSummaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadData = useCallback(async (date) => {
    setIsLoading(true);
    setError(null);
    try {
      const [summary, allSummaries] = await Promise.all([
        DailyQuicksService.getSummaryForDate(date, leads),
        DailyQuicksService.listSummaries(60),
      ]);
      setStoredSummary(summary);
      setPreviousSummaries(allSummaries);
    } catch (err) {
      console.error('Failed to load Daily Quicks', err);
      setError('Unable to load Daily Quicks summary. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [leads]);

  useEffect(() => {
    if (leadsLoading) return;
    loadData(selectedDate);
  }, [selectedDate, leadsLoading, loadData]);

  const summary = storedSummary?.summary;
  const isToday = selectedDate === today;

  return (
    <div className="daily-quicks animate-fade-in">
      <div className="dashboard-header">
        <div>
          <h1>Daily Quicks</h1>
          <p>Your morning command center — one summary for dashboard and email</p>
        </div>
      </div>

      {error && (
        <div className="daily-quicks-error">
          <AlertCircle size={20} />
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => loadData(selectedDate)}>
            Retry
          </button>
        </div>
      )}

      {summary && !isLoading && (
        <div className="daily-quicks-date-badge">
          <CalendarDays size={16} />
          {isToday ? 'Today' : 'Archive'} — {formatISTDisplayDate(summary.date)}
          {storedSummary?.generatedAt && (
            <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
              · Generated {new Date(storedSummary.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
            </span>
          )}
        </div>
      )}

      {(isLoading || leadsLoading) ? (
        <>
          <div className="daily-quicks-stat-grid">
            {Array.from({ length: 8 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
          <div className="daily-quicks-sections">
            {Array.from({ length: 6 }).map((_, i) => (
              <SectionSkeleton key={i} />
            ))}
          </div>
        </>
      ) : summary ? (
        <>
          <div className="daily-quicks-stat-grid">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className="daily-quicks-stat-card surface-panel">
                <div className={`daily-quicks-stat-icon ${card.iconClass}`}>
                  {card.icon}
                </div>
                <div className="daily-quicks-stat-content">
                  <span className="daily-quicks-stat-label">{card.title}</span>
                  <span className="daily-quicks-stat-value">{summary.stats[card.key]}</span>
                  <span className="daily-quicks-stat-subtitle">{card.subtitle}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="daily-quicks-sections">
            {SECTION_CONFIG.map((section) => {
              const entries = summary.sections[section.key];
              return (
                <div key={section.key} className="daily-quicks-section surface-panel">
                  <div className="daily-quicks-section-header">
                    <h2>{section.title}</h2>
                    <span className="daily-quicks-section-count">{entries.length}</span>
                  </div>
                  <EntryTable entries={entries} />
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <History size={32} />
          <p>No summary available for {formatISTDisplayDate(selectedDate)}.</p>
        </div>
      )}

      {previousSummaries.length > 0 && (
        <div className="daily-quicks-previous">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <h2 className="section-title" style={{ marginBottom: 0 }}>Summary History</h2>
            {!isToday && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelectedDate(today)}>
                Back to Today
              </button>
            )}
          </div>
          <div className="daily-quicks-previous-list">
            {previousSummaries.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`daily-quicks-previous-item ${selectedDate === item.date ? 'active' : ''}`}
                onClick={() => setSelectedDate(item.date)}
              >
                <span className="daily-quicks-previous-date">
                  {formatISTDisplayDate(item.date)}
                </span>
                <span className="daily-quicks-previous-meta">
                  {item.summary.stats.totalLeads} leads · {item.summary.stats.callsDueToday} calls due
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

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
  Sparkles,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { useLeadContext } from '../store/LeadContext';
import { DailyQuicksService } from '../utils/dailyQuicksService';
import type { DailyQuicksEntry, DailyQuicksSummary, StoredDailySummary } from '../../shared/dailyQuicks/types';
import { formatISTDisplayDate, toISTDateString } from '../../shared/dailyQuicks/istDate';
import './DailyQuicks.css';

interface StatCardConfig {
  key: keyof DailyQuicksSummary['stats'];
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconClass: string;
}

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
  { key: 'todaysCalls' as const, title: "Today's Calls", icon: <Phone size={16} /> },
  { key: 'todaysBookings' as const, title: "Today's Bookings", icon: <Calendar size={16} /> },
  { key: 'tomorrowsBookings' as const, title: "Tomorrow's Bookings", icon: <CalendarClock size={16} /> },
  { key: 'rescheduledBookings' as const, title: 'Rescheduled Bookings', icon: <RotateCcw size={16} /> },
  { key: 'garageNotifications' as const, title: 'Garage Notifications', icon: <BellRing size={16} /> },
  { key: 'vipCustomers' as const, title: 'VIP Customers', icon: <Star size={16} /> },
];

const StatCardSkeleton: React.FC = () => (
  <div className="daily-quicks-stat-card surface-panel daily-quicks-skeleton daily-quicks-skeleton-card" />
);

const SectionSkeleton: React.FC = () => (
  <div className="daily-quicks-section surface-panel daily-quicks-skeleton daily-quicks-skeleton-section" />
);

const EntryTable: React.FC<{ entries: DailyQuicksEntry[] }> = ({ entries }) => {
  if (entries.length === 0) {
    return (
      <div className="daily-quicks-empty">
        <CheckCircle2 size={24} strokeWidth={1.5} className="empty-icon" />
        <span>No entries for this section</span>
      </div>
    );
  }

  return (
    <div className="daily-quicks-list-container">
      {entries.map((entry, idx) => {
        const rawName = (entry.customerName || '').trim();
        const isCleanName = rawName && !/^[.\,\s\-_]+$/.test(rawName);
        const displayName = isCleanName ? rawName : (entry.identifier || 'Direct Customer');

        return (
          <div key={`${entry.identifier}-${idx}`} className="daily-quicks-entry-row">
            <span className="daily-quicks-entry-name" title={displayName}>
              {displayName}
            </span>
            {entry.identifier && (
              <span className="daily-quicks-entry-id" title={entry.identifier}>
                {entry.identifier}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export const DailyQuicks: React.FC = () => {
  const { leads, isLoading: leadsLoading } = useLeadContext();
  const today = toISTDateString();

  const selectedDate = today;
  const [storedSummary, setStoredSummary] = useState<StoredDailySummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (date: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const summary = await DailyQuicksService.getSummaryForDate(date, leads);
      setStoredSummary(summary);
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
      <div className="daily-quicks-hero">
        <div className="daily-quicks-hero-left">
          <div className="daily-quicks-badge">
            <Sparkles size={14} /> Morning Command Center
          </div>
          <h1>Daily Quicks</h1>
          <p>Real-time operational summary & briefing for sales & service teams</p>
        </div>

        <div className="daily-quicks-hero-right">
          {summary && !isLoading && (
            <div className="daily-quicks-date-pill">
              <CalendarDays size={15} />
              <span>{isToday ? 'Live Today' : 'Archive'} · {formatISTDisplayDate(summary.date)}</span>
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => loadData(selectedDate)}
            title="Refresh calculations"
          >
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} /> Refresh
          </button>
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
                    <div className="daily-quicks-section-title">
                      <span className="section-icon">{section.icon}</span>
                      <h2>{section.title}</h2>
                    </div>
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
    </div>
  );
};

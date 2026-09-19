import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';



/**
 * Maps each `leadType` value that can appear in the Bookings Hub to its
 * display label, badge CSS class, and dot colour.
 *
 * "Confirmed" is the Bookings Hub display label for `leadType === 'Booked'`.
 */
export const BOOKING_STATUS_OPTIONS: Array<{ value: LeadType; config: StatusConfig }> = [
  {
    value: 'Booked',
    config: { label: 'Confirmed', badgeClass: 'badge-blue', dotColor: 'var(--info)' },
  },
  {
    value: 'Call Not Received',
    config: { label: 'Call Not Received', badgeClass: 'badge-red', dotColor: 'var(--danger)' },
  },
  {
    value: 'Details Shared',
    config: { label: 'Detail Shared', badgeClass: 'badge-orange', dotColor: 'var(--warning)' },
  },
  {
    value: 'Shared Quotation',
    config: { label: 'Shared Quotation', badgeClass: 'badge-blue', dotColor: 'var(--info)' },
  },
  {
    value: 'Redirected',
    config: { label: 'Redirected', badgeClass: 'badge-purple', dotColor: 'var(--vip)' },
  },
  {
    value: 'Completed',
    config: { label: 'Completed', badgeClass: 'badge-green', dotColor: 'var(--success)' },
  },
  {
    value: 'Lost',
    config: { label: 'Lost', badgeClass: 'badge-red', dotColor: 'var(--danger)' },
  },
  {
    value: 'Rescheduled',
    config: { label: 'Rescheduled', badgeClass: 'badge-teal', dotColor: '#0d9488' },
  },
];

export const getStatusConfig = (leadType): StatusConfig => {
  const match = BOOKING_STATUS_OPTIONS.find(o => o.value === leadType);
  return match?.config ?? { label: leadType === 'Booked' ? 'Confirmed' : leadType, badgeClass: 'badge-gray', dotColor: 'var(--text-muted)' };
};



/**
 * Options that can be selected via this dropdown.
 * "Completed" is intentionally excluded — it is set exclusively through the
 * bill-entry modal (CompletedModal) so the billing flow is never bypassed.
 */
const SELECTABLE_OPTIONS = BOOKING_STATUS_OPTIONS.filter(o => o.value !== 'Completed');

export const BookingStatusDropdown = ({
  leadId,
  currentStatus,
  onStatusChange,
  disabled = false,
  billingFinalized = false,
}) => {
  const [optimisticStatus, setOptimisticStatus] = useState(currentStatus);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const wrapRef = useRef(null);

  useEffect(() => {
    setOptimisticStatus(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleSelect = useCallback(
    async (newStatus) => {
      if (newStatus === optimisticStatus) {
        setIsOpen(false);
        return;
      }

      const previousStatus = optimisticStatus;
      setIsOpen(false);
      setError(null);

      // Optimistic update
      setOptimisticStatus(newStatus);
      setIsSaving(true);

      try {
        await onStatusChange(leadId, newStatus);
      } catch (err) {
        setOptimisticStatus(previousStatus);
        setError(err?.message || 'Failed to save. Please try again.');
        setTimeout(() => setError(null), 4000);
      } finally {
        setIsSaving(false);
      }
    },
    [leadId, optimisticStatus, onStatusChange],
  );

  const config = getStatusConfig(optimisticStatus);

  // ── Static badge: billing is done, nothing left to action ──────────────────
  if (billingFinalized) {
    const completedConfig = getStatusConfig('Completed');
    return (
      <div className="booking-status-wrap">
        <span
          className={`booking-status-trigger ${completedConfig.badgeClass}`}
          aria-label="Billing finalised — booking completed"
          title="Billing has already been finalized for this booking"
          style={{ cursor: 'default', userSelect: 'none', pointerEvents: 'none', opacity: 0.85 }}
        >
          {completedConfig.label}
        </span>
      </div>
    );
  }

  return (
    <div className="booking-status-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`booking-status-trigger ${config.badgeClass} ${isSaving ? 'saving' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Booking status: ${config.label}. Click to change.`}
        disabled={disabled || isSaving}
        onClick={() => !isSaving && setIsOpen(prev => !prev)}
      >
        {isSaving ? (
          <>
            <span
              style={{
                width: '10px',
                height: '10px',
                border: '2px solid currentColor',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'bsd-spin 0.6s linear infinite',
              }}
            />
            Saving…
          </>
        ) : (
          <>
            {config.label}
            <ChevronDown size={11} />
          </>
        )}
      </button>

      {isOpen && !isSaving && (
        <div
          className="booking-status-menu"
          role="listbox"
          aria-label="Select booking status"
        >
          {SELECTABLE_OPTIONS.map(({ value, config: optConfig }) => (
            <button
              key={value}
              type="button"
              role="option"
              aria-selected={value === optimisticStatus}
              className={`booking-status-option ${value === optimisticStatus ? 'active' : ''}`}
              onClick={() => handleSelect(value)}
            >
              <span
                className="booking-status-dot"
                style={{ backgroundColor: optConfig.dotColor }}
              />
              {optConfig.label}
              {value === optimisticStatus && (
                <span style={{ marginLeft: 'auto', fontSize: '0.7rem', opacity: 0.6 }}>✓</span>
              )}
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="booking-status-error" role="alert">
          <AlertCircle size={11} />
          {error}
        </div>
      )}

      <style>{`@keyframes bsd-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

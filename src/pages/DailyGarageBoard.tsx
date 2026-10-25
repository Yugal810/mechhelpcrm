import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Building2,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  MoreVertical,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { DailyGarageBoardService, SettlementService, toYmd } from '../utils/dataLayer';
import { useLeadContext } from '../store/LeadContext';
import type { DailyGarageEntry, DailyGarageEntryStatus } from '../types';
import './DailyGarageBoard.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns today's date as a YYYY-MM-DD string in local time. */
function todayString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add/subtract N days to a YYYY-MM-DD string without timezone shifting. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Format YYYY-MM-DD for display, e.g. "Sun, 13 Sep 2026". */
function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Sub-components ─────────────────────────────────────────────────────────

// Delete Confirmation Modal Component ─────────────────────────────────────────

interface DeleteConfirmModalProps {
  customerName: string;
  carName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  customerName,
  carName,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="dgb-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dgb-confirm-title">
      <div className="dgb-modal dgb-confirm-modal">
        <div className="dgb-confirm-body">
          <div className="dgb-confirm-icon-wrapper">
            <Trash2 size={24} strokeWidth={2} />
          </div>
          <h3 id="dgb-confirm-title" className="dgb-confirm-title">Remove Entry?</h3>
          <p className="dgb-confirm-desc">
            Are you sure you want to remove <strong>"{carName} ({customerName})"</strong> from the board?
          </p>
        </div>

        <div className="dgb-confirm-footer">
          <button
            id="dgb-confirm-cancel-btn"
            className="dgb-btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            id="dgb-confirm-delete-btn"
            className="dgb-btn-danger"
            onClick={onConfirm}
            autoFocus
          >
            <Trash2 size={14} /> Remove Entry
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Inline Car Card with Dominant Visual Status & Fast Floor Scanning ─────────

interface EntryCardProps {
  entry: DailyGarageEntry;
  onStatusChange: (id: string, status: DailyGarageEntryStatus) => void;
  onDelete: (id: string) => void;
}

const EntryCard: React.FC<EntryCardProps> = ({ entry, onStatusChange, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const calculatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuWidth = 205;
    const menuHeight = 165;
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Determine vertical placement: below if space permits, otherwise above
    const spaceBelow = viewportHeight - rect.bottom;
    const showAbove = spaceBelow < menuHeight + 10 && rect.top > menuHeight + 10;
    const top = showAbove ? rect.top - menuHeight - 4 : rect.bottom + 4;

    // Align right side of menu to right side of trigger button
    let left = rect.right - menuWidth;
    if (left < 10) left = 10;
    if (left + menuWidth > viewportWidth - 10) {
      left = viewportWidth - menuWidth - 10;
    }

    setMenuPos({ top, left });
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!menuOpen) {
      calculatePosition();
      setMenuOpen(true);
    } else {
      setMenuOpen(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current && !popoverRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Close menu on scroll or resize so it doesn't detach
  useEffect(() => {
    if (!menuOpen) return;
    const handleScrollOrResize = () => setMenuOpen(false);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [menuOpen]);

  // Handle ESC key
  useEffect(() => {
    if (!menuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  const handleStatusSelect = (status: DailyGarageEntryStatus) => {
    onStatusChange(entry.id, status);
    setMenuOpen(false);
  };

  const handleOpenDeleteModal = () => {
    setMenuOpen(false);
    setShowConfirmDelete(true);
  };

  return (
    <>
      <div className={`dgb-inline-card status-${entry.status}`}>
        {/* Top row: Primary Focal Point (Car Model) + Three-Dot Trigger */}
        <div className="dgb-card-top-row">
          <span className="dgb-card-car-model" title={entry.carName}>
            {entry.carName}
          </span>
          <button
            ref={triggerRef}
            id={`dgb-menu-trigger-${entry.id}`}
            className="dgb-card-menu-trigger"
            onClick={toggleMenu}
            title="Actions menu"
            aria-label={`Options for ${entry.carName}`}
          >
            <MoreVertical size={14} />
          </button>
        </div>

        {/* Secondary: Customer Name */}
        <div className="dgb-card-customer" title={entry.customerName}>
          {entry.customerName}
        </div>

        {/* Details Row: Number Plate & Dominant Status Badge */}
        <div className="dgb-card-details-row">
          {entry.numberPlate ? (
            <span className="dgb-card-plate-badge" title="Number Plate">
              {entry.numberPlate}
            </span>
          ) : (
            <span className="dgb-card-plate-none">
              No plate
            </span>
          )}

          {/* Dominant Status Badge Pill */}
          {entry.status === 'picked_up' && (
            <span className="dgb-card-status-pill pill-picked-up">
              <Car size={9} /> PICKED UP
            </span>
          )}
          {entry.status === 'arrived' && (
            <span className="dgb-card-status-pill pill-arrived">
              <Check size={9} strokeWidth={3} /> ARRIVED
            </span>
          )}
          {entry.status === 'done' && (
            <span className="dgb-card-status-pill pill-done">
              <CheckCircle2 size={9} strokeWidth={2.5} /> DONE
            </span>
          )}
          {entry.status === 'pending' && (
            <span className="dgb-card-status-pill pill-pending">
              <Clock size={9} /> PENDING
            </span>
          )}
        </div>

        {/* Three-Dot Popover Menu rendered via Portal with computed coordinates */}
        {menuOpen && menuPos && createPortal(
          <div
            ref={popoverRef}
            className="dgb-card-menu-popover"
            role="menu"
            style={{
              top: `${menuPos.top}px`,
              left: `${menuPos.left}px`,
            }}
          >
            <button
              id={`dgb-opt-picked-up-${entry.id}`}
              className="dgb-menu-item item-picked-up"
              onClick={() => handleStatusSelect('picked_up')}
            >
              <Car size={14} /> Picked Up
            </button>

            <button
              id={`dgb-opt-arrived-${entry.id}`}
              className="dgb-menu-item item-arrived"
              onClick={() => handleStatusSelect('arrived')}
            >
              <Check size={14} strokeWidth={2.5} /> Mark Arrived
            </button>

            <button
              id={`dgb-opt-done-${entry.id}`}
              className="dgb-menu-item item-done"
              onClick={() => handleStatusSelect('done')}
            >
              <CheckCircle2 size={14} strokeWidth={2.5} /> Mark Serviced/Done
            </button>

            <button
              id={`dgb-opt-pending-${entry.id}`}
              className="dgb-menu-item item-pending"
              onClick={() => handleStatusSelect('pending')}
            >
              <Clock size={14} /> Reset to Pending
            </button>

            <div className="dgb-menu-divider" />

            <button
              id={`dgb-opt-delete-${entry.id}`}
              className="dgb-menu-item item-delete"
              onClick={handleOpenDeleteModal}
            >
              <Trash2 size={14} /> Delete Entry
            </button>
          </div>,
          document.body
        )}
      </div>

      {/* Styled Delete Confirmation Modal */}
      {showConfirmDelete && (
        <DeleteConfirmModal
          customerName={entry.customerName}
          carName={entry.carName}
          onConfirm={() => {
            setShowConfirmDelete(false);
            onDelete(entry.id);
          }}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}
    </>
  );
};

// Add Entry Modal ─────────────────────────────────────────────────────────────

interface AddEntryModalProps {
  garageId: string;
  garageName: string;
  date: string;
  onClose: () => void;
  onAdded: (entry: DailyGarageEntry) => void;
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({
  garageId,
  garageName,
  date,
  onClose,
  onAdded,
}) => {
  const [tab, setTab] = useState<'salesiq' | 'custom'>('salesiq');

  // SalesIQ & Form States
  const [tagInput, setTagInput] = useState('');
  const [lookupState, setLookupState] = useState<'idle' | 'loading' | 'found' | 'not-found' | 'error'>('idle');

  // Editable Form Fields
  const [customerName, setCustomerName] = useState('');
  const [carName, setCarName] = useState('');
  const [numberPlate, setNumberPlate] = useState('');
  const [leadId, setLeadId] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleTagLookup = async () => {
    const tag = tagInput.trim();
    if (!tag) return;
    setLookupState('loading');
    try {
      const result = await DailyGarageBoardService.lookupByTag(tag);
      if (result) {
        setLookupState('found');
        setCustomerName(result.customerName || '');
        setCarName(result.carName || '');
        setNumberPlate(result.numberPlate || '');
        setLeadId(result.leadId);
      } else {
        setLookupState('not-found');
      }
    } catch (err: any) {
      setLookupState('error');
    }
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTagLookup(); }
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !carName.trim()) return;
    setSaving(true);
    try {
      const entry = await DailyGarageBoardService.addEntry({
        garageId,
        customerName: customerName.trim(),
        carName: carName.trim(),
        numberPlate: numberPlate.trim() || undefined,
        source: tab,
        leadId: tab === 'salesiq' ? leadId : undefined,
        createdDate: date,
      });
      onAdded(entry);
      onClose();
    } catch (err: any) {
      alert(`Failed to add entry: ${err?.message || 'Unknown error'}`);
    } finally {
      setSaving(false);
    }
  };

  const canSubmit = customerName.trim().length > 0 && carName.trim().length > 0;

  return (
    <div className="dgb-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="dgb-modal-title">
      <div className="dgb-modal">
        {/* Header */}
        <div className="dgb-modal-header">
          <h2 id="dgb-modal-title" className="dgb-modal-title">
            Add Car to Garage
            <span style={{ fontSize: '0.78rem', fontWeight: 400, color: 'var(--text-muted)', marginLeft: '0.4rem' }}>
              → {garageName}
            </span>
          </h2>
          <button
            id="dgb-modal-close-btn"
            className="dgb-modal-close"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="dgb-modal-body">
          {/* Tabs */}
          <div className="dgb-modal-tabs">
            <button
              id="dgb-tab-salesiq"
              className={`dgb-tab-btn ${tab === 'salesiq' ? 'is-active' : ''}`}
              onClick={() => {
                setTab('salesiq');
                setLookupState('idle');
              }}
            >
              <Tag size={14} /> SalesIQ Tag
            </button>
            <button
              id="dgb-tab-custom"
              className={`dgb-tab-btn ${tab === 'custom' ? 'is-active' : ''}`}
              onClick={() => {
                setTab('custom');
                setCustomerName('');
                setCarName('');
                setNumberPlate('');
              }}
            >
              <Type size={14} /> Custom Entry
            </button>
          </div>

          {/* SalesIQ Mode */}
          {tab === 'salesiq' && (
            <div className="dgb-modal-form">
              <div className="dgb-form-group">
                <label htmlFor="dgb-tag-input" className="dgb-form-label">SalesIQ Tag / Identifier</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="dgb-tag-input"
                    className="dgb-form-input"
                    type="text"
                    value={tagInput}
                    onChange={e => {
                      setTagInput(e.target.value);
                      setLookupState('idle');
                    }}
                    onKeyDown={handleTagKeyDown}
                    placeholder="Enter SalesIQ tag (e.g. SIQ-1234)"
                    autoFocus
                  />
                  <button
                    id="dgb-tag-lookup-btn"
                    className="dgb-btn-primary"
                    style={{ flex: 'none', padding: '0.6rem 0.875rem' }}
                    onClick={handleTagLookup}
                    disabled={!tagInput.trim() || lookupState === 'loading'}
                  >
                    {lookupState === 'loading' ? (
                      <RefreshCw size={14} className="spin" />
                    ) : (
                      <Search size={14} />
                    )}
                    Lookup
                  </button>
                </div>
              </div>

              {/* Lookup Found State */}
              {lookupState === 'found' && (
                <>
                  <div className="dgb-tag-status found">
                    <Check size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <strong>Lead Found & Auto-Filled!</strong>
                      <div style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                        Review or edit the three fields below before adding to board.
                      </div>
                    </div>
                  </div>

                  <div className="dgb-form-group">
                    <label htmlFor="dgb-siq-car" className="dgb-form-label">Car / Model</label>
                    <input
                      id="dgb-siq-car"
                      className="dgb-form-input"
                      type="text"
                      value={carName}
                      onChange={e => setCarName(e.target.value)}
                    />
                  </div>

                  <div className="dgb-form-group">
                    <label htmlFor="dgb-siq-customer" className="dgb-form-label">Customer Name</label>
                    <input
                      id="dgb-siq-customer"
                      className="dgb-form-input"
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                    />
                  </div>

                  <div className="dgb-form-group">
                    <label htmlFor="dgb-siq-plate" className="dgb-form-label">Number Plate</label>
                    <input
                      id="dgb-siq-plate"
                      className="dgb-form-input"
                      type="text"
                      value={numberPlate}
                      onChange={e => setNumberPlate(e.target.value)}
                      placeholder="e.g. MH 02 AB 1234"
                    />
                  </div>
                </>
              )}

              {/* Lookup Not Found State */}
              {(lookupState === 'not-found' || lookupState === 'error') && (
                <div className="dgb-tag-status not-found">
                  <X size={16} strokeWidth={2.5} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>No lead found for tag "{tagInput.trim()}"</strong>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>
                      Please check the SalesIQ Tag or switch to Custom Entry to enter car details manually.
                    </div>
                    <button
                      id="dgb-switch-custom-link"
                      className="dgb-switch-custom-btn"
                      onClick={() => setTab('custom')}
                    >
                      Switch to Custom Entry →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Custom Mode */}
          {tab === 'custom' && (
            <div className="dgb-modal-form">
              <div className="dgb-form-group">
                <label htmlFor="dgb-custom-car" className="dgb-form-label">Car / Model *</label>
                <input
                  id="dgb-custom-car"
                  className="dgb-form-input"
                  type="text"
                  value={carName}
                  onChange={e => setCarName(e.target.value)}
                  placeholder="e.g. Maruti Swift"
                  autoFocus
                />
              </div>

              <div className="dgb-form-group">
                <label htmlFor="dgb-custom-name" className="dgb-form-label">Customer Name *</label>
                <input
                  id="dgb-custom-name"
                  className="dgb-form-input"
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div className="dgb-form-group">
                <label htmlFor="dgb-custom-plate" className="dgb-form-label">Number Plate</label>
                <input
                  id="dgb-custom-plate"
                  className="dgb-form-input"
                  type="text"
                  value={numberPlate}
                  onChange={e => setNumberPlate(e.target.value)}
                  placeholder="e.g. MH 02 AB 1234 (optional)"
                  onKeyDown={e => { if (e.key === 'Enter' && canSubmit) handleSubmit(); }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="dgb-modal-footer">
          <button
            id="dgb-modal-cancel-btn"
            className="dgb-btn-secondary"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            id="dgb-modal-submit-btn"
            className="dgb-btn-primary"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
          >
            {saving ? <RefreshCw size={14} className="spin" /> : <Plus size={14} />}
            Add to Board
          </button>
        </div>
      </div>
    </div>
  );
};

// Garage Row Component (Inline Layout & Distinct Active vs Empty States) ────

interface GarageRowProps {
  garageId: string;
  garageName: string;
  entries: DailyGarageEntry[];
  date: string;
  onStatusChange: (id: string, status: DailyGarageEntryStatus) => void;
  onDelete: (id: string) => void;
  onEntryAdded: (entry: DailyGarageEntry) => void;
}

const GarageRow: React.FC<GarageRowProps> = ({
  garageId,
  garageName,
  entries,
  date,
  onStatusChange,
  onDelete,
  onEntryAdded,
}) => {
  const [showModal, setShowModal] = useState(false);

  // Filter entries robustly by garageId or garageName (case-insensitive)
  const matchingEntries = entries.filter(e =>
    e.garageId === garageId ||
    e.garageId === garageName ||
    (e.garageId && e.garageId.toLowerCase() === garageId.toLowerCase()) ||
    (e.garageId && e.garageId.toLowerCase() === garageName.toLowerCase())
  );

  const count = matchingEntries.length;
  const hasCars = count > 0;

  return (
    <>
      <div className={`dgb-garage-row ${hasCars ? 'has-cars' : 'is-empty'}`}>
        {/* Left: Tinted Anchor Chip & Garage Name */}
        <div className="dgb-garage-row-left">
          <span className="dgb-garage-chip"><Building2 size={15} strokeWidth={2} /></span>
          <h3 className="dgb-garage-name">{garageName}</h3>
        </div>

        {/* Middle: Inline Flex Wrap Container for Small Car Cards */}
        <div className="dgb-garage-row-cars">
          {!hasCars ? (
            <span className="dgb-no-cars-inline">No active cars today</span>
          ) : (
            matchingEntries.map(entry => (
              <EntryCard
                key={entry.id}
                entry={entry}
                onStatusChange={onStatusChange}
                onDelete={onDelete}
              />
            ))
          )}
        </div>

        {/* Right: Unified Action & Counter Group */}
        <div className="dgb-garage-row-right">
          <div className="dgb-garage-action-group">
            <button
              id={`dgb-create-${garageId}`}
              className="dgb-create-btn"
              onClick={() => setShowModal(true)}
              title={`Add car to ${garageName}`}
            >
              <Plus size={14} strokeWidth={2.5} />
              Add Car
            </button>

            <span id={`dgb-count-${garageId}`} className="dgb-garage-count-badge">
              {count} {count === 1 ? 'car' : 'cars'}
            </span>
          </div>
        </div>
      </div>

      {showModal && (
        <AddEntryModal
          garageId={garageId}
          garageName={garageName}
          date={date}
          onClose={() => setShowModal(false)}
          onAdded={entry => {
            onEntryAdded(entry);
            setShowModal(false);
          }}
        />
      )}
    </>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export const DailyGarageBoard: React.FC = () => {
  const { leads } = useLeadContext();
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [garages, setGarages] = useState<{ id: string; name: string }[]>([]);
  const [entries, setEntries] = useState<DailyGarageEntry[]>([]);
  const [loadingGarages, setLoadingGarages] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const today = todayString();
  const minDate = addDays(today, -7);
  const maxDate = addDays(today, 7);
  const isToday = selectedDate === today;

  const [deletedLeadIds, setDeletedLeadIds] = useState<Set<string>>(new Set());

  // Dynamically map Booked leads from CRM matching selectedDate
  const bookedLeadEntries: DailyGarageEntry[] = useMemo(() => {
    return leads
      .filter(l => l.leadType === 'Booked' && l.garageAssigned && !deletedLeadIds.has(l.id))
      .filter(l => toYmd(l.bookingDateTime || l.nextFollowUpDate) === selectedDate)
      .map(l => ({
        id: `lead-dgb-${l.id}`,
        garageId: l.garageAssigned || '',
        customerName: l.customerName || 'Customer',
        carName: `${l.carBrand || ''} ${l.carModel || ''}`.trim() || 'Vehicle',
        numberPlate: l.numberPlate,
        notes: l.notes || '',
        status: 'pending' as DailyGarageEntryStatus,
        source: 'salesiq' as const,
        leadId: l.id,
        createdDate: selectedDate,
        createdAt: l.createdDate || new Date().toISOString()
      }));
  }, [leads, selectedDate, deletedLeadIds]);

  const combinedEntries = useMemo(() => {
    const existingLeadIds = new Set(entries.map(e => e.leadId).filter(Boolean));
    const newFromLeads = bookedLeadEntries.filter(ble => !existingLeadIds.has(ble.leadId));
    return [...entries, ...newFromLeads];
  }, [entries, bookedLeadEntries]);

  // Load garages once on mount
  useEffect(() => {
    SettlementService.getGarageList()
      .then(list => setGarages(list))
      .catch(err => setError(`Failed to load garages: ${err?.message}`))
      .finally(() => setLoadingGarages(false));
  }, []);

  // Reload entries whenever date changes
  const loadEntries = useCallback(async (date: string) => {
    setLoadingEntries(true);
    setError(null);
    try {
      const data = await DailyGarageBoardService.getEntries(date);
      setEntries(data);
    } catch (err: any) {
      setError(`Failed to load entries: ${err?.message}`);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    loadEntries(selectedDate);
  }, [selectedDate, loadEntries]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleStatusChange = async (id: string, status: DailyGarageEntryStatus) => {
    const isVirtual = id.startsWith('lead-dgb-');
    const realLeadId = isVirtual ? id.replace('lead-dgb-', '') : (entries.find(e => e.id === id)?.leadId || null);
    const target = combinedEntries.find(e => e.id === id);

    // Immediate 0ms optimistic update
    setEntries(prev => {
      const matchIdx = prev.findIndex(e => e.id === id || (realLeadId && e.leadId === realLeadId));
      if (matchIdx !== -1) {
        const next = [...prev];
        next[matchIdx] = { ...next[matchIdx], status };
        return next;
      } else if (target) {
        return [...prev, { ...target, status }];
      }
      return prev;
    });

    try {
      const saved = await DailyGarageBoardService.updateEntry(id, { status });
      // Update with the saved DB record (real UUID)
      setEntries(prev => {
        const filtered = prev.filter(e => e.id !== id && (saved.leadId ? e.leadId !== saved.leadId : true));
        return [...filtered, saved];
      });
    } catch (err: any) {
      console.error('Failed to update status:', err);
      alert(`Failed to update status: ${err?.message}`);
      loadEntries(selectedDate);
    }
  };

  const handleDelete = async (id: string) => {
    const isVirtual = id.startsWith('lead-dgb-');
    const realLeadId = isVirtual ? id.replace('lead-dgb-', '') : (entries.find(e => e.id === id)?.leadId || null);

    if (realLeadId) {
      setDeletedLeadIds(prev => new Set(prev).add(realLeadId));
    }
    setEntries(prev => prev.filter(e => e.id !== id && (realLeadId ? e.leadId !== realLeadId : true)));

    try {
      await DailyGarageBoardService.deleteEntry(id);
    } catch (err: any) {
      console.error('Failed to delete entry:', err);
      alert(`Failed to delete entry: ${err?.message}`);
      loadEntries(selectedDate);
    }
  };

  const handleEntryAdded = (entry: DailyGarageEntry) => {
    setEntries(prev => [...prev, entry]);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!val) return;
    if (val < minDate) {
      setSelectedDate(minDate);
      setNoticeMsg('Only the past and next 7 days are available.');
    } else if (val > maxDate) {
      setSelectedDate(maxDate);
      setNoticeMsg('Only the past and next 7 days are available.');
    } else {
      setSelectedDate(val);
      setNoticeMsg(null);
    }
  };

  const goToPrev = () => {
    if (selectedDate <= minDate) return;
    setSelectedDate(prev => addDays(prev, -1));
    setNoticeMsg(null);
  };

  const goToNext = () => {
    if (selectedDate >= maxDate) return;
    setSelectedDate(prev => addDays(prev, 1));
    setNoticeMsg(null);
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  const isLoading = loadingGarages || loadingEntries;

  return (
    <div className="dgb-page">
      {/* ─ Header ─────────────────────────────────────────────────────────── */}
      <div className="dgb-header">
        <div className="dgb-header-left">
          <h1 className="dgb-header-title">
            <span className="dgb-header-title-icon"><ClipboardList size={18} strokeWidth={2} /></span>
            Daily Garage Board
          </h1>
          <p className="dgb-header-subtitle">
            Floor-level car tracking per garage · {formatDate(selectedDate)}
          </p>
        </div>

        <div className="dgb-header-right">
          <button
            id="dgb-prev-day-btn"
            className="dgb-today-btn"
            onClick={goToPrev}
            disabled={selectedDate <= minDate}
            aria-label="Previous day"
            title={selectedDate <= minDate ? 'Reached past 7-day limit' : 'Previous day'}
          >
            <ChevronLeft size={14} />
          </button>

          <input
            id="dgb-date-picker"
            type="date"
            className="dgb-date-input"
            value={selectedDate}
            min={minDate}
            max={maxDate}
            onChange={handleDateChange}
            aria-label="Select date"
          />

          <button
            id="dgb-next-day-btn"
            className="dgb-today-btn"
            onClick={goToNext}
            disabled={selectedDate >= maxDate}
            aria-label="Next day"
            title={selectedDate >= maxDate ? 'Reached next 7-day limit' : 'Next day'}
          >
            <ChevronRight size={14} />
          </button>

          {!isToday && (
            <button
              id="dgb-today-jump-btn"
              className="dgb-today-btn"
              onClick={() => {
                setSelectedDate(today);
                setNoticeMsg(null);
              }}
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* ─ Notice Banner for Clamped Dates ───────────────────────────────── */}
      {noticeMsg && (
        <div style={{
          margin: '0.75rem 2rem 0',
          padding: '0.5rem 0.875rem',
          background: 'var(--warning-bg)',
          color: 'var(--warning)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span>{noticeMsg}</span>
          <button
            style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.8 }}
            onClick={() => setNoticeMsg(null)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─ Body ───────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{
          margin: '1rem 2rem 0',
          padding: '0.75rem 1rem',
          background: 'var(--danger-bg)',
          color: 'var(--danger)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="dgb-loading">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="dgb-skeleton-row" />)}
        </div>
      ) : garages.length === 0 ? (
        <div className="dgb-empty-state">
          <Building2 size={48} strokeWidth={1} />
          <h3>No garages found</h3>
          <p>Add garages in the Garage Settlement section first.</p>
        </div>
      ) : (
        <div className="dgb-body">
          {garages.map(garage => (
            <GarageRow
              key={garage.id}
              garageId={garage.id}
              garageName={garage.name}
              entries={combinedEntries}
              date={selectedDate}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onEntryAdded={handleEntryAdded}
            />
          ))}
        </div>
      )}
    </div>
  );
};

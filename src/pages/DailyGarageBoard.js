import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Building2,
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
  Edit2,
} from 'lucide-react';
import { DailyGarageBoardService, SettlementService } from '../utils/dataLayer.js';
import './DailyGarageBoard.css';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Returns today's date as a YYYY-MM-DD string in local time. */
function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Add/subtract N days to a YYYY-MM-DD string without timezone shifting. */
function addDays(isoDate, days) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Format YYYY-MM-DD for display, e.g. "Sun, 13 Sep 2026". */
function formatDate(iso) {
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



const DeleteConfirmModal = ({
  customerName,
  carName,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
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
    </div>
  );
};

// Inline Car Card with Dominant Visual Status & Fast Floor Scanning ─────────



const EntryCard = ({ entry, onStatusChange, onDelete, onEdit }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const popoverRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const handleStatusSelect = (status) => {
    onStatusChange(entry.id, status);
    setMenuOpen(false);
  };

  const handleOpenDeleteModal = () => {
    setMenuOpen(false);
    setShowConfirmDelete(true);
  };

  return (
    <>
      <div className={`dgb-inline-card status-${entry.status}`} ref={popoverRef}>
        {/* Top row: Primary Focal Point (Car Model) + Three-Dot Trigger */}
        <div className="dgb-card-top-row">
          <span className="dgb-card-car-model" title={entry.carName}>
            {entry.carName}
          </span>
          <button
            id={`dgb-menu-trigger-${entry.id}`}
            className="dgb-card-menu-trigger"
            onClick={() => setMenuOpen(prev => !prev)}
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

        {/* Three-Dot Popover Menu */}
        {menuOpen && (
          <div className="dgb-card-menu-popover" role="menu">
            <button
              id={`dgb-opt-arrived-${entry.id}`}
              className="dgb-menu-item item-arrived"
              onClick={() => handleStatusSelect('arrived')}
            >
              <Check size={14} strokeWidth={2.5} /> Mark Arrived (Green)
            </button>

            <button
              id={`dgb-opt-done-${entry.id}`}
              className="dgb-menu-item item-done"
              onClick={() => handleStatusSelect('done')}
            >
              <CheckCircle2 size={14} strokeWidth={2.5} /> Mark Serviced/Done (Blue)
            </button>

            <button
              id={`dgb-opt-pending-${entry.id}`}
              className="dgb-menu-item item-pending"
              onClick={() => handleStatusSelect('pending')}
            >
              <Clock size={14} /> Reset to Pending
            </button>

            <button
              id={`dgb-opt-edit-${entry.id}`}
              className="dgb-menu-item"
              onClick={() => {
                setMenuOpen(false);
                onEdit(entry);
              }}
            >
              <Edit2 size={14} /> Edit Entry
            </button>

            <div className="dgb-menu-divider" />

            <button
              id={`dgb-opt-delete-${entry.id}`}
              className="dgb-menu-item item-delete"
              onClick={handleOpenDeleteModal}
            >
              <Trash2 size={14} /> Delete Entry
            </button>
          </div>
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



const AddEntryModal = ({
  garageId,
  garageName,
  date,
  onClose,
  onAdded,
  initialData,
}) => {
  const [tab, setTab] = useState(initialData ? 'custom' : 'salesiq');

  // SalesIQ & Form States
  const [tagInput, setTagInput] = useState('');
  const [lookupState, setLookupState] = useState('idle');

  // Editable Form Fields
  const [customerName, setCustomerName] = useState(initialData ? initialData.customerName : '');
  const [carName, setCarName] = useState(initialData ? initialData.carName : '');
  const [numberPlate, setNumberPlate] = useState(initialData ? (initialData.numberPlate || '') : '');
  const [leadId, setLeadId] = useState(initialData ? initialData.leadId : undefined);
  const [saving, setSaving] = useState(false);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
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
    } catch (err) {
      setLookupState('error');
    }
  };

  const handleTagKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); handleTagLookup(); }
  };

  const handleSubmit = async () => {
    if (!customerName.trim() || !carName.trim()) return;
    setSaving(true);
    try {
      let entry;
      if (initialData) {
        entry = await DailyGarageBoardService.updateEntry(initialData.id, {
          customerName: customerName.trim(),
          carName: carName.trim(),
          numberPlate: numberPlate.trim(), // Always pass the string so it's not undefined
        });
      } else {
        entry = await DailyGarageBoardService.addEntry({
          garageId,
          customerName: customerName.trim(),
          carName: carName.trim(),
          numberPlate: numberPlate.trim() || undefined,
          source: tab,
          leadId: tab === 'salesiq' ? leadId : undefined,
          createdDate: date,
        });
      }
      onAdded(entry);
      onClose();
    } catch (err) {
      alert(`Failed to ${initialData ? 'update' : 'add'} entry: ${err?.message || 'Unknown error'}`);
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
            {initialData ? 'Edit Car' : 'Add Car to Garage'}
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
          {!initialData && (
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
          )}

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
            {initialData ? 'Save Changes' : 'Add to Board'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Garage Row Component (Inline Layout & Distinct Active vs Empty States) ────



const GarageRow = ({
  garageId,
  garageName,
  entries,
  date,
  onStatusChange,
  onDelete,
  onEntryAdded,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);

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
                onEdit={(entryToEdit) => setEditingEntry(entryToEdit)}
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

      {(showModal || editingEntry) && (
        <AddEntryModal
          garageId={garageId}
          garageName={garageName}
          date={date}
          initialData={editingEntry}
          onClose={() => {
            setShowModal(false);
            setEditingEntry(null);
          }}
          onAdded={entry => {
            onEntryAdded(entry, !!editingEntry);
            setShowModal(false);
            setEditingEntry(null);
          }}
        />
      )}
    </>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────

export const DailyGarageBoard = () => {
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [noticeMsg, setNoticeMsg] = useState(null);
  const [garages, setGarages] = useState([]);
  const [entries, setEntries] = useState([]);
  const [loadingGarages, setLoadingGarages] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [error, setError] = useState(null);

  const today = todayString();
  const minDate = addDays(today, -7);
  const maxDate = addDays(today, 7);
  const isToday = selectedDate === today;

  // Load garages once on mount
  useEffect(() => {
    SettlementService.getGarageList()
      .then(list => setGarages(list))
      .catch(err => setError(`Failed to load garages: ${err?.message}`))
      .finally(() => setLoadingGarages(false));
  }, []);

  // Reload entries whenever date changes
  const loadEntries = useCallback(async (date) => {
    setLoadingEntries(true);
    setError(null);
    try {
      const data = await DailyGarageBoardService.getEntries(date);
      setEntries(data);
    } catch (err) {
      setError(`Failed to load entries: ${err?.message}`);
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    loadEntries(selectedDate);
  }, [selectedDate, loadEntries]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleStatusChange = async (id, status) => {
    // Optimistic update
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    try {
      await DailyGarageBoardService.updateEntry(id, { status });
    } catch (err) {
      alert(`Failed to update status: ${err?.message}`);
      // Revert on error
      loadEntries(selectedDate);
    }
  };

  const handleDelete = async (id) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    try {
      await DailyGarageBoardService.deleteEntry(id);
    } catch (err) {
      alert(`Failed to delete entry: ${err?.message}`);
      loadEntries(selectedDate);
    }
  };

  const handleEntryAdded = (entry, isEdit) => {
    setEntries(prev => {
      if (isEdit) {
        return prev.map(e => (e.id === entry.id ? entry : e));
      }
      return [...prev, entry];
    });
  };

  const handleDateChange = (e) => {
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
              entries={entries}
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

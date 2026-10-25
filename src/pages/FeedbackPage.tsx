import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  MessageSquareHeart, 
  Search, 
  Star, 
  Check, 
  X, 
  RefreshCw, 
  Car, 
  Building2, 
  Calendar, 
  Phone, 
  Award,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Save
} from 'lucide-react';
import { useLeadContext } from '../store/LeadContext';
import { FeedbackService } from '../utils/dataLayer';
import type { Lead } from '../types';
import './FeedbackPage.css';

interface RowFeedbackState {
  rating: number | null;
  notes: string;
  isSaving: boolean;
  isSaved: boolean;
}

export const FeedbackPage: React.FC = () => {
  const { leads, updateLead } = useLeadContext();

  // Billing map: leadId -> { totalAmount, paidTo }
  const [billingsMap, setBillingsMap] = useState<Record<string, { totalAmount: number; paidTo: string }>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGarage, setSelectedGarage] = useState('ALL');
  const [ratingFilter, setRatingFilter] = useState('ALL'); // 'ALL' | 'RATED' | 'UNRATED' | 'HIGH' | 'MID' | 'LOW'
  const [filterDate, setFilterDate] = useState('');

  // Row-level feedback edits: leadId -> RowFeedbackState
  const [feedbackStates, setFeedbackStates] = useState<Record<string, RowFeedbackState>>({});

  // Filter only Completed bookings
  const completedLeads = useMemo(() => {
    return leads.filter(l => l.leadType === 'Completed');
  }, [leads]);

  // Load billings map on mount
  const loadBillings = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const bMap = await FeedbackService.getBillingsMap();
      setBillingsMap(bMap);
    } catch (e) {
      console.warn('Could not load billings map:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBillings();
  }, [loadBillings]);

  // Initialize/sync local feedback state from leads data
  useEffect(() => {
    setFeedbackStates(prev => {
      const next = { ...prev };
      completedLeads.forEach(lead => {
        if (!next[lead.id]) {
          next[lead.id] = {
            rating: lead.rating ?? null,
            notes: lead.feedbackNotes || '',
            isSaving: false,
            isSaved: false,
          };
        } else {
          // Keep dirty notes if user is typing, else sync rating
          if (next[lead.id].rating === null && lead.rating !== null && lead.rating !== undefined) {
            next[lead.id].rating = lead.rating;
          }
          if (!next[lead.id].notes && lead.feedbackNotes) {
            next[lead.id].notes = lead.feedbackNotes;
          }
        }
      });
      return next;
    });
  }, [completedLeads]);

  // Unique Garages for dropdown
  const uniqueGarages = useMemo(() => {
    const set = new Set<string>();
    completedLeads.forEach(l => {
      if (l.garageAssigned) set.add(l.garageAssigned);
    });
    return Array.from(set).sort();
  }, [completedLeads]);

  // Helper to extract clean dialable phone number
  const getDialablePhone = (identifier?: string | null) => {
    if (!identifier) return null;
    const trimmed = identifier.trim();
    if (trimmed.toLowerCase().startsWith('walkin') || trimmed.toLowerCase().includes('walk-in')) {
      return null;
    }
    const digits = trimmed.replace(/[^\d+]/g, '');
    if (digits.replace(/\D/g, '').length < 7) {
      return null;
    }
    return digits;
  };

  const handleCallCustomer = (e: React.MouseEvent, rawIdentifier?: string | null) => {
    e.stopPropagation();
    const phone = getDialablePhone(rawIdentifier);
    if (!phone) {
      alert('This booking was created as a walk-in without a recorded phone number.');
      return;
    }
    window.location.href = `tel:${phone}`;
  };

  // Handle rating button click
  const handleRate = async (lead: Lead, score: number | null) => {
    const currentNotes = feedbackStates[lead.id]?.notes ?? (lead.feedbackNotes || '');
    
    // Optimistic local state update
    setFeedbackStates(prev => ({
      ...prev,
      [lead.id]: {
        ...(prev[lead.id] || { notes: currentNotes }),
        rating: score,
        isSaving: true,
        isSaved: false,
      }
    }));

    // Persist to Supabase and fallback
    await FeedbackService.updateFeedback(lead.id, score, currentNotes);

    // Update context
    await updateLead({
      ...lead,
      rating: score,
      feedbackNotes: currentNotes,
    });

    setFeedbackStates(prev => ({
      ...prev,
      [lead.id]: {
        ...(prev[lead.id] || { notes: currentNotes, rating: score }),
        isSaving: false,
        isSaved: true,
      }
    }));

    setTimeout(() => {
      setFeedbackStates(prev => ({
        ...prev,
        [lead.id]: {
          ...(prev[lead.id] || { notes: currentNotes, rating: score }),
          isSaved: false,
        }
      }));
    }, 2000);
  };

  // Handle notes text change
  const handleNotesChange = (leadId: string, val: string) => {
    setFeedbackStates(prev => ({
      ...prev,
      [leadId]: {
        ...(prev[leadId] || { rating: null }),
        notes: val,
        isSaved: false,
      }
    }));
  };

  // Save notes on blur or manual click
  const handleSaveNotes = async (lead: Lead) => {
    const row = feedbackStates[lead.id];
    if (!row) return;

    setFeedbackStates(prev => ({
      ...prev,
      [lead.id]: { ...prev[lead.id], isSaving: true }
    }));

    await FeedbackService.updateFeedback(lead.id, row.rating, row.notes);

    await updateLead({
      ...lead,
      rating: row.rating,
      feedbackNotes: row.notes,
    });

    setFeedbackStates(prev => ({
      ...prev,
      [lead.id]: { ...prev[lead.id], isSaving: false, isSaved: true }
    }));

    setTimeout(() => {
      setFeedbackStates(prev => ({
        ...prev,
        [lead.id]: { ...prev[lead.id], isSaved: false }
      }));
    }, 2500);
  };

  // Filtered Completed Leads
  const filteredLeads = useMemo(() => {
    return completedLeads.filter(lead => {
      // 1. Search Query
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const custMatch = lead.customerName?.toLowerCase().includes(q);
        const phoneMatch = lead.identifier?.toLowerCase().includes(q);
        const carMatch = `${lead.carBrand || ''} ${lead.carModel || ''}`.toLowerCase().includes(q);
        const plateMatch = lead.numberPlate?.toLowerCase().includes(q);
        const notesMatch = feedbackStates[lead.id]?.notes?.toLowerCase().includes(q);
        if (!custMatch && !phoneMatch && !carMatch && !plateMatch && !notesMatch) {
          return false;
        }
      }

      // 2. Garage Filter
      if (selectedGarage !== 'ALL') {
        if (lead.garageAssigned !== selectedGarage) {
          return false;
        }
      }

      // 3. Rating Filter
      const rating = feedbackStates[lead.id]?.rating ?? (lead.rating ?? null);
      if (ratingFilter === 'RATED' && rating === null) return false;
      if (ratingFilter === 'UNRATED' && rating !== null) return false;
      if (ratingFilter === 'HIGH' && (rating === null || rating < 8)) return false;
      if (ratingFilter === 'MID' && (rating === null || rating < 5 || rating > 7)) return false;
      if (ratingFilter === 'LOW' && (rating === null || rating > 4)) return false;

      // 4. Date Filter
      if (filterDate) {
        const leadDate = lead.bookingDateTime?.split('T')[0] || lead.createdDate?.split('T')[0];
        if (leadDate !== filterDate) {
          return false;
        }
      }

      return true;
    });
  }, [completedLeads, searchTerm, selectedGarage, ratingFilter, filterDate, feedbackStates]);

  // ─── Analytics / KPIs ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const total = completedLeads.length;
    let ratedCount = 0;
    let sumScore = 0;
    let highCount = 0;

    completedLeads.forEach(l => {
      const r = feedbackStates[l.id]?.rating ?? (l.rating ?? null);
      if (r !== null && r !== undefined) {
        ratedCount++;
        sumScore += r;
        if (r >= 8) highCount++;
      }
    });

    const avg = ratedCount > 0 ? (sumScore / ratedCount).toFixed(1) : '—';
    const csat = ratedCount > 0 ? Math.round((highCount / ratedCount) * 100) : 0;
    const completionPct = total > 0 ? Math.round((ratedCount / total) * 100) : 0;

    return { total, ratedCount, avg, csat, completionPct };
  }, [completedLeads, feedbackStates]);

  return (
    <div className="feedback-page animate-fade-in">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="feedback-header">
        <div className="feedback-title-group">
          <div className="feedback-title-icon">
            <MessageSquareHeart size={22} />
          </div>
          <div>
            <h1>Customer Feedback</h1>
            <p>Track customer reviews, satisfaction scores (1–10), and observations for completed bookings</p>
          </div>
        </div>

        <button 
          type="button" 
          className="btn btn-secondary flex items-center gap-2"
          onClick={loadBillings}
          disabled={isRefreshing}
          title="Refresh bookings and billing data"
        >
          <RefreshCw size={14} className={isRefreshing ? 'spin' : ''} />
          Refresh
        </button>
      </div>

      {/* ─── KPI Metric Cards ──────────────────────────────────────────────── */}
      <div className="feedback-metrics-grid">
        <div className="feedback-metric-card surface-panel metric-total">
          <span className="metric-label">Completed Bookings</span>
          <div className="metric-value-row">
            <span className="metric-value">{metrics.total}</span>
            <span className="metric-subtext">total completed</span>
          </div>
        </div>

        <div className="feedback-metric-card surface-panel metric-rated">
          <span className="metric-label">Feedback Logged</span>
          <div className="metric-value-row">
            <span className="metric-value">{metrics.ratedCount}</span>
            <span className="metric-subtext">({metrics.completionPct}% rated)</span>
          </div>
        </div>

        <div className="feedback-metric-card surface-panel metric-avg">
          <span className="metric-label">Average Score</span>
          <div className="metric-value-row">
            <span className="metric-value">{metrics.avg}</span>
            <span className="metric-subtext">{metrics.avg !== '—' ? '/ 10' : 'no ratings'}</span>
          </div>
        </div>

        <div className="feedback-metric-card surface-panel metric-csat">
          <span className="metric-label">CSAT (Score 8–10)</span>
          <div className="metric-value-row">
            <span className="metric-value">{metrics.csat}%</span>
            <span className="metric-subtext">high satisfaction</span>
          </div>
        </div>
      </div>

      {/* ─── Filters & Search Toolbar ──────────────────────────────────────── */}
      <div className="feedback-filters-bar surface-panel">
        <div className="feedback-filters-left">
          {/* Search Box */}
          <div className="feedback-search-box">
            <Search size={15} className="feedback-search-icon" />
            <input
              type="text"
              className="form-input"
              placeholder="Search customer, phone, car, plate, notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Garage Filter */}
          <select 
            className="feedback-select" 
            value={selectedGarage} 
            onChange={e => setSelectedGarage(e.target.value)}
          >
            <option value="ALL">All Garages ({uniqueGarages.length})</option>
            {uniqueGarages.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Rating Filter */}
          <select 
            className="feedback-select" 
            value={ratingFilter} 
            onChange={e => setRatingFilter(e.target.value)}
          >
            <option value="ALL">All Ratings</option>
            <option value="RATED">Rated Only</option>
            <option value="UNRATED">Unrated Only</option>
            <option value="HIGH">Promoters (8–10)</option>
            <option value="MID">Passives (5–7)</option>
            <option value="LOW">Detractors (1–4)</option>
          </select>

          {/* Date Picker */}
          <input 
            type="date"
            className="feedback-date-input"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            title="Filter by Booking Date"
          />

          {(searchTerm || selectedGarage !== 'ALL' || ratingFilter !== 'ALL' || filterDate) && (
            <button 
              type="button" 
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSearchTerm('');
                setSelectedGarage('ALL');
                setRatingFilter('ALL');
                setFilterDate('');
              }}
            >
              <X size={13} /> Reset
            </button>
          )}
        </div>

        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
          Showing {filteredLeads.length} of {completedLeads.length} bookings
        </div>
      </div>

      {/* ─── Completed Bookings Table (Desktop) ────────────────────────────── */}
      <div className="feedback-table-card surface-panel">
        <table className="feedback-table">
          <thead>
            <tr>
              <th className="col-date">Date</th>
              <th className="col-customer">Customer</th>
              <th className="col-vehicle">Vehicle</th>
              <th className="col-garage">Garage</th>
              <th className="col-bill">Bill</th>
              <th className="col-rating">Rating (1–10)</th>
              <th className="col-notes">Feedback Notes</th>
            </tr>
          </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="feedback-empty-state">
                      <AlertCircle size={32} />
                      <h3>No Completed Bookings Found</h3>
                      <p>
                        {completedLeads.length === 0 
                          ? 'No bookings have been marked as Completed yet.' 
                          : 'No completed bookings match the selected filters.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLeads.map(lead => {
                  const state = feedbackStates[lead.id] || {
                    rating: lead.rating ?? null,
                    notes: lead.feedbackNotes || '',
                    isSaving: false,
                    isSaved: false,
                  };

                  const currentScore = state.rating;
                  const billingInfo = billingsMap[lead.id];
                  const rawDate = lead.bookingDateTime || lead.createdDate;
                  const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  }) : '—';

                  return (
                    <tr key={lead.id} className="feedback-row">
                      {/* 1. Date */}
                      <td className="col-date">
                        <span className="feedback-date-text">{formattedDate}</span>
                      </td>

                      {/* 2. Customer & Phone */}
                      <td className="col-customer">
                        <div className="feedback-cust-name" title={lead.customerName || 'Unknown Customer'}>
                          <span>{lead.customerName || 'Unknown Customer'}</span>
                          {lead.isVip && (
                            <span className="badge badge-vip vip-pill">VIP</span>
                          )}
                        </div>
                        <div className="feedback-cust-phone">
                          {(() => {
                            const dialPhone = getDialablePhone(lead.identifier);
                            if (dialPhone) {
                              return (
                                <a 
                                  href={`tel:${dialPhone}`}
                                  onClick={(e) => handleCallCustomer(e, lead.identifier)}
                                  className="feedback-cust-phone-link"
                                  title={`Click to call ${lead.identifier}`}
                                >
                                  <Phone size={10} style={{ flexShrink: 0 }} />
                                  <span>{lead.identifier}</span>
                                </a>
                              );
                            }
                            return (
                              <span className="feedback-cust-phone-walkin" title={lead.identifier}>
                                {lead.identifier?.toLowerCase().startsWith('walkin') ? 'Walk-in Customer' : (lead.identifier || '—')}
                              </span>
                            );
                          })()}
                        </div>
                      </td>

                      {/* 3. Vehicle & Service Mode */}
                      <td className="col-vehicle">
                        <div className="feedback-vehicle-title" title={`${lead.carBrand || ''} ${lead.carModel || ''}`}>
                          {lead.carBrand} {lead.carModel}
                        </div>
                        <div className="feedback-vehicle-sub">
                          {lead.numberPlate ? (
                            <span className="plate-pill">{lead.numberPlate}</span>
                          ) : (
                            <span className="no-plate-text">No plate</span>
                          )}
                          {lead.bookingType && (
                            <span className="mode-pill">{lead.bookingType}</span>
                          )}
                        </div>
                      </td>

                      {/* 4. Garage */}
                      <td className="col-garage">
                        <span className="feedback-garage-badge" title={lead.garageAssigned || 'Not Assigned'}>
                          <Building2 size={11} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.garageAssigned || 'Not Assigned'}</span>
                        </span>
                      </td>

                      {/* 5. Bill Amount */}
                      <td className="col-bill">
                        <span className="feedback-bill-amount" style={{ color: billingInfo ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {billingInfo ? `₹${billingInfo.totalAmount.toLocaleString('en-IN')}` : '—'}
                        </span>
                      </td>

                      {/* 6. Rating (Out of 10) */}
                      <td className="col-rating">
                        <div className="rating-picker-container">
                          <div className="rating-buttons-strip">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                              const isLow = score <= 4;
                              const isMid = score >= 5 && score <= 7;
                              const isHigh = score >= 8;
                              const isSelected = currentScore === score;

                              let className = 'rating-score-btn';
                              if (isLow) className += ' rate-low';
                              else if (isMid) className += ' rate-mid';
                              else if (isHigh) className += ' rate-high';
                              if (isSelected) className += ' active';

                              return (
                                <button
                                  key={score}
                                  type="button"
                                  className={className}
                                  onClick={() => handleRate(lead, isSelected ? null : score)}
                                  title={`Give rating: ${score} / 10`}
                                >
                                  {score}
                                </button>
                              );
                            })}

                            {currentScore !== null && (
                              <button
                                type="button"
                                className="rating-clear-btn"
                                onClick={() => handleRate(lead, null)}
                                title="Clear rating"
                              >
                                <X size={11} />
                              </button>
                            )}
                          </div>

                          {/* Descriptive Score Badge */}
                          <div className="rating-badge-status">
                            {currentScore === null ? (
                              <span className="rating-badge-status badge-unrated">
                                ○ Unrated
                              </span>
                            ) : currentScore >= 8 ? (
                              <span className="rating-badge-status badge-promoter">
                                ★ {currentScore}/10 — Promoter (Excellent)
                              </span>
                            ) : currentScore >= 5 ? (
                              <span className="rating-badge-status badge-passive">
                                ● {currentScore}/10 — Passive (Satisfactory)
                              </span>
                            ) : (
                              <span className="rating-badge-status badge-detractor">
                                ⚠ {currentScore}/10 — Detractor (Unsatisfied)
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 7. Feedback Notes */}
                      <td className="col-notes">
                        <div className="feedback-notes-wrapper">
                          <input
                            type="text"
                            className="feedback-notes-input"
                            placeholder="Add feedback..."
                            value={state.notes}
                            onChange={e => handleNotesChange(lead.id, e.target.value)}
                            onBlur={() => handleSaveNotes(lead)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleSaveNotes(lead);
                              }
                            }}
                            title={state.notes || 'Add feedback notes...'}
                          />

                          <button
                            type="button"
                            className={`feedback-save-btn ${state.isSaved ? 'btn-saved' : ''}`}
                            onClick={() => handleSaveNotes(lead)}
                            disabled={state.isSaving}
                            title={state.isSaved ? 'Saved!' : 'Save note'}
                          >
                            {state.isSaving ? (
                              <RefreshCw size={11} className="spin" />
                            ) : state.isSaved ? (
                              <Check size={12} strokeWidth={3} />
                            ) : (
                              <Save size={11} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
      </div>

      {/* ─── Completed Bookings Mobile Cards (Mobile Only <= 768px) ────────── */}
      <div className="feedback-mobile-list">
        {filteredLeads.length === 0 ? (
          <div className="feedback-empty-state surface-panel">
            <AlertCircle size={32} />
            <h3>No Completed Bookings Found</h3>
            <p>
              {completedLeads.length === 0 
                ? 'No bookings have been marked as Completed yet.' 
                : 'No completed bookings match the selected filters.'}
            </p>
          </div>
        ) : (
          filteredLeads.map(lead => {
            const state = feedbackStates[lead.id] || {
              rating: lead.rating ?? null,
              notes: lead.feedbackNotes || '',
              isSaving: false,
              isSaved: false,
            };

            const currentScore = state.rating;
            const billingInfo = billingsMap[lead.id];
            const rawDate = lead.bookingDateTime || lead.createdDate;
            const formattedDate = rawDate ? new Date(rawDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric'
            }) : '—';

            return (
              <div key={lead.id} className="feedback-mobile-card surface-panel">
                {/* Mobile Card Header: Customer & Date */}
                <div className="feedback-mobile-card-header">
                  <div className="feedback-mobile-cust-info">
                    <span className="feedback-mobile-cust-name">{lead.customerName || 'Unknown Customer'}</span>
                    {lead.isVip && <span className="badge badge-vip vip-pill">VIP</span>}
                  </div>
                  <span className="feedback-mobile-date">{formattedDate}</span>
                </div>

                {/* Sub details: Phone & Garage & Bill */}
                <div className="feedback-mobile-meta-row">
                  {(() => {
                    const dialPhone = getDialablePhone(lead.identifier);
                    if (dialPhone) {
                      return (
                        <a 
                          href={`tel:${dialPhone}`} 
                          onClick={(e) => handleCallCustomer(e, lead.identifier)}
                          className="feedback-mobile-phone-link"
                          title={`Tap to call ${lead.identifier}`}
                        >
                          <Phone size={12} style={{ flexShrink: 0 }} />
                          <span>{lead.identifier}</span>
                        </a>
                      );
                    }
                    return (
                      <div 
                        className="feedback-mobile-phone-link phone-disabled"
                        title={lead.identifier}
                        onClick={(e) => handleCallCustomer(e, lead.identifier)}
                      >
                        <Phone size={12} style={{ flexShrink: 0 }} />
                        <span>Walk-in Customer</span>
                      </div>
                    );
                  })()}

                  <div className="feedback-mobile-garage-pill" title={lead.garageAssigned || 'Not Assigned'}>
                    <Building2 size={11} />
                    <span>{lead.garageAssigned || 'Not Assigned'}</span>
                  </div>

                  {billingInfo && (
                    <span className="feedback-mobile-bill-pill">
                      ₹{billingInfo.totalAmount.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                {/* Vehicle Row */}
                <div className="feedback-mobile-vehicle-row">
                  <div className="feedback-mobile-vehicle-name">
                    <Car size={13} />
                    <span>{lead.carBrand} {lead.carModel}</span>
                  </div>
                  <div className="feedback-mobile-vehicle-tags">
                    {lead.numberPlate && <span className="plate-pill">{lead.numberPlate}</span>}
                    {lead.bookingType && <span className="mode-pill">{lead.bookingType}</span>}
                  </div>
                </div>

                {/* Rating Strip (1–10) */}
                <div className="feedback-mobile-rating-section">
                  <div className="feedback-mobile-rating-header">
                    <span className="feedback-mobile-section-label">Rating (1–10):</span>
                    <span className={`feedback-mobile-status-badge ${
                      currentScore === null 
                        ? 'badge-unrated' 
                        : currentScore >= 8 
                        ? 'badge-promoter' 
                        : currentScore >= 5 
                        ? 'badge-passive' 
                        : 'badge-detractor'
                    }`}>
                      {currentScore === null ? '○ Unrated' : `${currentScore}/10 ${currentScore >= 8 ? 'Promoter' : currentScore >= 5 ? 'Passive' : 'Detractor'}`}
                    </span>
                  </div>

                  <div className="feedback-mobile-rating-grid">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(score => {
                      const isLow = score <= 4;
                      const isMid = score >= 5 && score <= 7;
                      const isHigh = score >= 8;
                      const isSelected = currentScore === score;

                      let className = 'rating-score-btn mobile-score-btn';
                      if (isLow) className += ' rate-low';
                      else if (isMid) className += ' rate-mid';
                      else if (isHigh) className += ' rate-high';
                      if (isSelected) className += ' active';

                      return (
                        <button
                          key={score}
                          type="button"
                          className={className}
                          onClick={() => handleRate(lead, isSelected ? null : score)}
                        >
                          {score}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Feedback Notes */}
                <div className="feedback-mobile-notes-section">
                  <span className="feedback-mobile-section-label">Notes:</span>
                  <div className="feedback-notes-wrapper">
                    <input
                      type="text"
                      className="feedback-notes-input"
                      placeholder="Add customer feedback notes..."
                      value={state.notes}
                      onChange={e => handleNotesChange(lead.id, e.target.value)}
                      onBlur={() => handleSaveNotes(lead)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveNotes(lead);
                        }
                      }}
                    />

                    <button
                      type="button"
                      className={`feedback-save-btn ${state.isSaved ? 'btn-saved' : ''}`}
                      onClick={() => handleSaveNotes(lead)}
                      disabled={state.isSaving}
                      title={state.isSaved ? 'Saved!' : 'Save note'}
                    >
                      {state.isSaving ? (
                        <RefreshCw size={11} className="spin" />
                      ) : state.isSaved ? (
                        <Check size={12} strokeWidth={3} />
                      ) : (
                        <Save size={11} />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

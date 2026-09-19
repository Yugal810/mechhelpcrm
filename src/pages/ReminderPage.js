import React, { useState, useMemo } from 'react';
import { useLeadContext } from '../store/LeadContext.js';
import { AddLeadModal } from '../components/AddLeadModal.js';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge.js';
import { LeadNoteButton } from '../components/LeadNoteButton.js';
import { Edit, Search, Sun, Moon, PhoneForwarded, FileText } from 'lucide-react';
import { DeleteConfirmAction } from '../components/DeleteConfirmAction.js';
import { isBefore, isToday, startOfToday, differenceInCalendarDays } from 'date-fns';

const parseDate = (dStr?: string): Date => {
  if (!dStr) return new Date(NaN);
  return new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
};



export const ReminderPage = ({ slot }) => {
  const { leads, deleteLead } = useLeadContext();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStaleness, setFilterStaleness] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(undefined);

  const today = startOfToday();

  // Calculate total counts for each staleness bucket for the current slot
  const allSlotLeads = useMemo(() => {
    if (slot !== 'morning' && slot !== 'evening') return [];
    return leads.filter(l => {
      if (l.leadType !== 'Retarget') return false;
      const followUpDate = parseDate(l.nextFollowUpDate);
      if (!isToday(followUpDate) && !isBefore(followUpDate, today)) return false;
      if (slot === 'morning') return l.retargetTimeSlot === 'morning';
      if (slot === 'evening') return l.retargetTimeSlot === 'evening' || !l.retargetTimeSlot;
      return false;
    });
  }, [leads, slot, today]);

  const stalenessCounts = useMemo(() => {
    let fresh = 0;
    let count1to7 = 0;
    let count8to14 = 0;
    let count15plus = 0;

    allSlotLeads.forEach(l => {
      const followUpDate = parseDate(l.nextFollowUpDate);
      const days = differenceInCalendarDays(today, followUpDate);
      if (days === 0) fresh++;
      else if (days >= 1 && days <= 7) count1to7++;
      else if (days >= 8 && days <= 14) count8to14++;
      else if (days >= 15) count15plus++;
    });

    return { total: allSlotLeads.length, fresh, count1to7, count8to14, count15plus };
  }, [allSlotLeads, today]);

  const sectionLeads = useMemo(() => {
    let data = leads.filter(l => {
      if (slot === 'shared-quotation') {
        return l.leadType === 'Shared Quotation';
      }

      if (slot === 'details-shared') {
        if (l.leadType !== 'Details Shared') return false;
        const stageTimeStr = l.detailsSharedAt || l.createdDate;
        if (!stageTimeStr) return false;
        const entryDate = parseDate(stageTimeStr);
        const daysInStage = differenceInCalendarDays(new Date(), entryDate);
        return daysInStage >= 3;
      }

      if (l.leadType !== 'Retarget') return false;
      const followUpDate = parseDate(l.nextFollowUpDate);
      if (!isToday(followUpDate) && !isBefore(followUpDate, today)) return false;
      if (slot === 'morning' && l.retargetTimeSlot !== 'morning') return false;
      if (slot === 'evening' && (l.retargetTimeSlot !== 'evening' && !!l.retargetTimeSlot)) return false;

      if (filterStaleness) {
        const days = differenceInCalendarDays(today, followUpDate);
        if (filterStaleness === 'fresh' && days !== 0) return false;
        if (filterStaleness === '1-7' && (days < 1 || days > 7)) return false;
        if (filterStaleness === '8-14' && (days < 8 || days > 14)) return false;
        if (filterStaleness === '15+' && days < 15) return false;
      }

      return true;
    });

    if (filterPriority) {
      data = data.filter(l => l.priority === filterPriority);
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(l =>
        l.customerName.toLowerCase().includes(lower) ||
        l.identifier.toLowerCase().includes(lower) ||
        l.carBrand.toLowerCase().includes(lower) ||
        l.carModel.toLowerCase().includes(lower) ||
        (l.priority || '').toLowerCase().includes(lower)
      );
    }

    return data.sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());
  }, [leads, filterPriority, filterStaleness, searchTerm, slot, today]);

  const handleEdit = (lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const isMorning = slot === 'morning';
  const isEvening = slot === 'evening';
  const isDetailsShared = slot === 'details-shared';

  const title = isMorning
    ? "Today's Reminder: Morning"
    : isEvening
    ? "Today's Reminder: Evening"
    : isDetailsShared
    ? "Detail Shared Reminders"
    : "Quotation Reminders";

  const subtitle = isMorning
    ? 'Retarget callbacks preferred during morning hours'
    : isEvening
    ? 'Retarget callbacks preferred during evening hours'
    : isDetailsShared
    ? 'Leads in "Details Shared" stage for 3 or more days needing follow-up'
    : 'All leads currently in "Shared Quotation" stage';

  const Icon = isMorning ? Sun : isEvening ? Moon : isDetailsShared ? PhoneForwarded : FileText;
  const iconClass = isMorning ? 'text-warning' : isEvening ? 'text-primary' : isDetailsShared ? 'text-accent' : 'text-info';

  return (
    <div className="all-leads animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Icon size={28} className={iconClass} />
          <div>
            <h1 style={{ margin: 0 }}>{title}</h1>
            <p style={{ margin: 0, marginTop: '0.25rem' }}>{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="filters surface-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px', maxWidth: '400px' }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by Name, Identifier, or Car..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>

          <select className="form-select" style={{ width: 'auto' }} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          {(isMorning || isEvening) && (
            <select
              className="form-select"
              style={{ width: 'auto' }}
              value={filterStaleness}
              onChange={e => setFilterStaleness(e.target.value)}
            >
              <option value="">All Reminders ({stalenessCounts.total})</option>
              <option value="fresh">Fresh / Today ({stalenessCounts.fresh})</option>
              <option value="1-7">Rolled over 1–7 days ({stalenessCounts.count1to7})</option>
              <option value="8-14">Rolled over 1–2 weeks ({stalenessCounts.count8to14})</option>
              <option value="15+">Not picking up / 2+ weeks ({stalenessCounts.count15plus})</option>
            </select>
          )}
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {sectionLeads.length} {sectionLeads.length === 1 ? 'lead' : 'leads'} {slot === 'details-shared' ? 'pending follow-up' : slot === 'shared-quotation' ? 'in stage' : 'for today'}
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name & Priority</th>
              <th>Identifier (Source)</th>
              <th>Car</th>
              <th>Stage / Slot</th>
              <th>Note</th>
              <th>Next Follow-Up</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sectionLeads.map(lead => {
              const followUpDate = parseDate(lead.nextFollowUpDate);
              const daysOverdue = differenceInCalendarDays(today, followUpDate);

              return (
                <tr key={lead.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                      <strong>{lead.customerName || 'Unknown'}</strong>
                      {lead.isVip && <span className="badge badge-vip">VIP</span>}
                      <ServiceTypeBadge serviceType={lead.serviceType} compact />
                    </div>
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', color: 'var(--text-secondary)' }}>
                      {lead.priority === 'High' ? '🔴 High' : lead.priority === 'Low' ? '🟢 Low' : '🟡 Medium'}
                    </div>
                  </td>
                  <td>{lead.identifier} <br /><small className="text-muted">({lead.leadSource})</small></td>
                  <td>{lead.carBrand} {lead.carModel}</td>
                  <td>
                    <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                      {slot === 'details-shared'
                        ? '📋 Details Shared'
                        : slot === 'shared-quotation'
                        ? '📄 Shared Quotation'
                        : lead.retargetTimeSlot === 'morning'
                        ? '☀️ Morning'
                        : lead.retargetTimeSlot === 'evening'
                        ? '🌙 Evening'
                        : lead.leadType}
                    </span>
                  </td>
                  <td><LeadNoteButton lead={lead} /></td>
                  <td>
                    <div>
                      <span className={daysOverdue > 0 && !['Booked', 'Completed', 'Lost'].includes(lead.leadType) ? 'text-danger font-bold' : ''}>
                        {lead.nextFollowUpDate}
                      </span>
                      {daysOverdue > 0 && (
                        <div style={{ fontSize: '0.7rem', color: 'var(--danger)', marginTop: '0.1rem' }}>
                          ({daysOverdue}d rolled over)
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEdit(lead)}>
                        <Edit size={14} /> Edit
                      </button>
                      <DeleteConfirmAction
                        size="sm"
                        onConfirm={() => deleteLead(lead.id)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {sectionLeads.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>
                  {slot === 'details-shared'
                    ? 'No leads in Details Shared stage for 3+ days.'
                    : slot === 'shared-quotation'
                    ? 'No leads currently in Shared Quotation stage.'
                    : `No ${isMorning ? 'morning' : 'evening'} reminders for today.`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <AddLeadModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setSelectedLead(undefined); }}
          initialData={selectedLead}
        />
      )}
    </div>
  );
};

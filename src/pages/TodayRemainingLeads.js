import React, { useState, useMemo } from 'react';
import { useLeadContext } from '../store/LeadContext.js';
import { AddLeadModal } from '../components/AddLeadModal.js';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge.js';
import { LeadNoteButton } from '../components/LeadNoteButton.js';
import { Edit, Search, Sun, Moon } from 'lucide-react';
import { DeleteConfirmAction } from '../components/DeleteConfirmAction.js';
import { isBefore, isToday, startOfToday } from 'date-fns';

const parseDate = (dStr) => {
  if (!dStr) return new Date(NaN);
  return new Date(dStr.includes('T') ? dStr : `${dStr}T00:00:00`);
};

export const TodayRemainingLeads = () => {
  const { leads, deleteLead } = useLeadContext();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(undefined);

  const today = startOfToday();

  // Filter leads due today (including auto-rolled-over un-actioned retarget reminders)
  const allTodayLeads = useMemo(() => {
    let data = leads.filter(l => {
      const fDate = parseDate(l.nextFollowUpDate);
      return isToday(fDate) || (l.leadType === 'Retarget' && isBefore(fDate, today));
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
  }, [leads, filterPriority, searchTerm]);

  // Group into Morning and Evening.
  // Untagged leads (retargetTimeSlot is null/undefined) default to Morning.
  const eveningLeads = useMemo(() => {
    return allTodayLeads.filter(l => l.retargetTimeSlot === 'evening');
  }, [allTodayLeads]);

  const morningLeads = useMemo(() => {
    return allTodayLeads.filter(l => l.retargetTimeSlot !== 'evening');
  }, [allTodayLeads]);

  const handleEdit = (lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const renderTableSection = (title, subtitle, icon, sectionLeads, badgeClass) => (
    <div className="surface-panel" style={{ padding: '1.5rem', marginBottom: '2rem', borderRadius: '12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {icon}
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>{title}</h2>
          <span className={`badge ${badgeClass}`} style={{ marginLeft: '0.5rem' }}>
            {sectionLeads.length} {sectionLeads.length === 1 ? 'lead' : 'leads'}
          </span>
        </div>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{subtitle}</p>
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
            {sectionLeads.map(lead => (
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
                <td>{lead.identifier} <br/><small className="text-muted">({lead.leadSource})</small></td>
                <td>{lead.carBrand} {lead.carModel}</td>
                <td>
                  <span className="badge badge-gray" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                    {lead.retargetTimeSlot === 'morning' ? '☀️ Morning' : lead.retargetTimeSlot === 'evening' ? '🌙 Evening' : lead.leadType}
                  </span>
                </td>
                <td><LeadNoteButton lead={lead} /></td>
                <td>
                  <span className={isBefore(new Date(lead.nextFollowUpDate), today) && !['Booked', 'Completed', 'Lost'].includes(lead.leadType) ? 'text-danger font-bold' : ''}>
                    {lead.nextFollowUpDate}
                  </span>
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
            ))}
            {sectionLeads.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>No leads in this section for today.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="all-leads animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Today's Remainder</h1>
          <p>Leads scheduled for follow-up today, split by morning and evening callback preference</p>
        </div>
      </div>

      <div className="filters surface-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '1rem', flex: 1, minWidth: '300px' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
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
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Total {allTodayLeads.length} reminders today ({morningLeads.length} Morning · {eveningLeads.length} Evening)
        </div>
      </div>

      {/* Morning Section */}
      {renderTableSection(
        "Today's Reminder: Morning",
        "Retarget callbacks preferred during morning hours",
        <Sun size={20} className="text-warning" />,
        morningLeads,
        "badge-yellow"
      )}

      {/* Evening Section */}
      {renderTableSection(
        "Today's Reminder: Evening",
        "Retarget callbacks preferred during evening hours",
        <Moon size={20} className="text-primary" />,
        eveningLeads,
        "badge-purple"
      )}


      
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

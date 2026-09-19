import React, { useState } from 'react';
import { useLeadContext } from '../store/LeadContext.js';
import { isToday, isBefore, startOfToday, differenceInDays } from 'date-fns';
import { AddLeadModal } from '../components/AddLeadModal.js';
import { CallOutcomeModal } from '../components/CallOutcomeModal.js';
import { Plus, Phone, Edit } from 'lucide-react';
import { DeleteConfirmAction } from '../components/DeleteConfirmAction.js';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge.js';
import './Dashboard.css';

export const Dashboard = () => {
  const { leads, deleteLead } = useLeadContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteErrorId, setDeleteErrorId] = useState(null);

  const today = startOfToday();

  // Active leads (not booked/completed/lost)
  const activeLeads = leads.filter(l => !['Booked', 'Completed', 'Lost'].includes(l.leadType));

  const overdue = activeLeads.filter(l => isBefore(new Date(l.nextFollowUpDate), today))
    .sort((a, b) => new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime());
    
  const dueToday = activeLeads.filter(l => isToday(new Date(l.nextFollowUpDate)));

  const vipTouchBase = activeLeads.filter(l => 
    l.isVip && 
    !isBefore(new Date(l.nextFollowUpDate), today) && 
    !isToday(new Date(l.nextFollowUpDate)) &&
    differenceInDays(today, new Date(l.lastContactedDate)) >= 30
  );

  const priorityQueue = [...overdue, ...dueToday, ...vipTouchBase];

  const [selectedCallLead, setSelectedCallLead] = useState(null);
  const [selectedEditLead, setSelectedEditLead] = useState(null);
  const [bookingLead, setBookingLead] = useState(null);

  const handleMarkContacted = (lead) => {
    setSelectedCallLead(lead);
  };

  const handleEdit = (lead) => {
    setSelectedEditLead(lead);
  };

  const handleDelete = async (leadId) => {
    try {
      setDeleteErrorId(null);
      await deleteLead(leadId);
    } catch {
      setDeleteErrorId(leadId);
    }
  };

  return (
    <div className="dashboard animate-fade-in">
      <div className="dashboard-header">
        <h1>Dashboard / Call Queue</h1>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} /> New Lead
        </button>
      </div>

      <div className="queue-section">
        <h2 className="section-title">Ranked Call Queue</h2>
        {priorityQueue.length === 0 ? (
          <div className="empty-state surface-panel">
            <p>You're all caught up! No priority calls pending.</p>
          </div>
        ) : (
          <div className="queue-list">
            {priorityQueue.map(lead => {
              const isOverdue = isBefore(new Date(lead.nextFollowUpDate), today);
              const isVipTouch = differenceInDays(today, new Date(lead.lastContactedDate)) >= 30;

              return (
                <div key={lead.id} className={`queue-card surface-panel ${isOverdue ? 'border-danger' : ''}`}>
                  <div className="queue-card-left">
                    <div className="queue-card-header">
                      <h3>{lead.customerName || 'Unknown'}</h3>
                      <span className={`badge ${lead.isVip ? 'badge-vip' : 'badge-gray'}`}>
                        {lead.isVip ? 'VIP' : lead.leadSource}
                      </span>
                      <ServiceTypeBadge serviceType={lead.serviceType} />
                      {isOverdue && <span className="badge badge-red">Overdue</span>}
                      {isVipTouch && lead.isVip && <span className="badge badge-vip">30d Touchbase</span>}
                    </div>
                    <div className="queue-card-details">
                      <div className="queue-card-detail-item">
                        <span className="label-caps">Identifier</span>
                        <span className="detail-val">{lead.identifier}</span>
                      </div>
                      <div className="queue-card-detail-item">
                        <span className="label-caps">Car</span>
                        <span className="detail-val">{lead.carBrand} {lead.carModel}</span>
                      </div>
                      <div className="queue-card-detail-item">
                        <span className="label-caps">Stage</span>
                        <span className="detail-val">{lead.leadType}</span>
                      </div>
                    </div>
                  </div>
                  <div className="queue-card-actions">
                    <DeleteConfirmAction
                      size="md"
                      onConfirm={() => handleDelete(lead.id)}
                    />
                    <button className="btn btn-secondary" onClick={() => handleEdit(lead)}>
                      <Edit size={16} /> Edit
                    </button>
                    <button className="btn btn-primary" onClick={() => handleMarkContacted(lead)}>
                      <Phone size={16} /> Mark Contacted
                    </button>
                    {deleteErrorId === lead.id && (
                      <span style={{ color: 'var(--danger)', fontSize: '0.75rem', position: 'absolute', marginTop: '3rem', marginLeft: '0.5rem' }}>Failed to delete.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AddLeadModal 
        isOpen={isModalOpen || !!bookingLead || !!selectedEditLead} 
        onClose={() => { setIsModalOpen(false); setBookingLead(null); setSelectedEditLead(null); }} 
        initialData={selectedEditLead || bookingLead || undefined}
      />
      {selectedCallLead && (
        <CallOutcomeModal
          isOpen={!!selectedCallLead}
          onClose={() => setSelectedCallLead(null)}
          lead={selectedCallLead}
          onBooked={(l) => setBookingLead(l)}
        />
      )}
    </div>
  );
};

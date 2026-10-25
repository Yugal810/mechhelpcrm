import React, { useState } from 'react';
import { useLeadContext } from '../store/LeadContext';
import { AddLeadModal } from '../components/AddLeadModal';
import { FullPageLeadEdit } from '../components/FullPageLeadEdit';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge';
import type { Lead } from '../types';

export const Kanban: React.FC = () => {
  const { leads, updateLead } = useLeadContext();
  const stages = ['Fresh Lead', 'Call Not Received', 'Details Shared', 'Shared Quotation', 'Retarget', 'Booked', 'Completed', 'Lost'];

  const [bookingLead, setBookingLead] = useState<Lead | null>(null);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  const onDragStart = (e: React.DragEvent, leadId: string) => {
    e.dataTransfer.setData('leadId', leadId);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDrop = (e: React.DragEvent, newStage: string) => {
    const leadId = e.dataTransfer.getData('leadId');
    const lead = leads.find(l => l.id === leadId);
    if (!lead || lead.leadType === newStage) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (newStage === 'Booked') {
      // Open modal to fill booking details
      setBookingLead({ 
        ...lead, 
        leadType: 'Booked',
        bookingDateTime: todayStr,
        nextFollowUpDate: todayStr
      });
    } else if (newStage === 'Retarget') {
      updateLead({ 
        ...lead, 
        leadType: 'Retarget',
        nextFollowUpDate: todayStr 
      });
    } else {
      // Just update stage immediately
      updateLead({ ...lead, leadType: newStage as any });
    }
  };

  if (editingLead) {
    return (
      <FullPageLeadEdit
        lead={editingLead}
        onClose={() => setEditingLead(null)}
      />
    );
  }

  return (
    <div className="kanban animate-fade-in" style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', height: '100%' }}>
      {stages.map(stage => {
        const stageLeads = leads.filter(l => l.leadType === stage);
        return (
          <div 
            key={stage} 
            className="kanban-column surface-panel" 
            style={{ minWidth: '300px', padding: '1rem', display: 'flex', flexDirection: 'column', background: 'var(--bg-secondary)', border: '1px dashed var(--border-light)', boxShadow: 'none' }}
            onDragOver={onDragOver}
            onDrop={e => onDrop(e, stage)}
          >
            <h3 style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-light)', paddingBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '1rem' }}>
              {stage} <span className="badge badge-gray">{stageLeads.length}</span>
            </h3>
            <div className="kanban-cards" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
              {stageLeads.map(lead => (
                <div 
                  key={lead.id} 
                  className="kanban-card surface-panel" 
                  style={{ padding: '1rem', cursor: 'grab' }}
                  draggable
                  onDragStart={e => onDragStart(e, lead.id)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <strong 
                      style={{ fontSize: '0.875rem', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => setEditingLead(lead)}
                      title="Click to edit lead"
                    >
                      {lead.customerName || 'Unknown'}
                    </strong>
                    <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                      <span className="badge badge-gray text-[10px] px-1 py-0">
                        {lead.priority === 'High' ? '🔴' : lead.priority === 'Low' ? '🟢' : '🟡'}
                      </span>
                      {lead.isVip && <span className="badge badge-vip text-[10px] px-1 py-0">VIP</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{lead.identifier}</div>
                    <ServiceTypeBadge serviceType={lead.serviceType} compact />
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{lead.carBrand} {lead.carModel}</span>
                    {lead.leadType === 'Booked' && (
                      <span className="text-[10px] text-success font-medium">{new Date(lead.bookingDateTime || '').toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {bookingLead && (
        <AddLeadModal 
          isOpen={!!bookingLead} 
          onClose={() => setBookingLead(null)} 
          initialData={bookingLead}
        />
      )}
    </div>
  );
};

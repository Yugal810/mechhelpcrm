import React from 'react';
import { useLeadContext } from '../store/LeadContext.js';
import { Check } from 'lucide-react';

export const WhatsappBroadcast = () => {
  const { leads, updateLead } = useLeadContext();

  const broadcastLeads = leads.filter(l => l.whatsappBroadcast);

  const markSent = (leadId) => {
    const lead = leads.find(l => l.id === leadId);
    if (lead) {
      updateLead({
        ...lead,
        notes: lead.notes + `\n[${new Date().toLocaleDateString()}] WhatsApp Broadcast Sent.`
      });
      // In a real app we might track this in a separate 'lastBroadcastDate' field
    }
  };

  return (
    <div className="whatsapp-broadcast animate-fade-in">
      <div className="dashboard-header">
        <h1>WhatsApp Broadcast List</h1>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Identifier</th>
              <th>Car</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {broadcastLeads.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No leads flagged for broadcast.</td></tr>
            )}
            {broadcastLeads.map(lead => (
              <tr key={lead.id}>
                <td><strong>{lead.customerName}</strong></td>
                <td>{lead.identifier} <span className="badge badge-gray">{lead.leadSource}</span></td>
                <td>{lead.carBrand} {lead.carModel}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => markSent(lead.id)}>
                    <Check size={14} /> Mark Sent Today
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

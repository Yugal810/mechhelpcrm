import React, { useState, useMemo } from 'react';
import { useLeadContext } from '../store/LeadContext.js';
import { DeleteConfirmAction } from '../components/DeleteConfirmAction.js';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge.js';
import { LeadNoteButton } from '../components/LeadNoteButton.js';
import { differenceInDays, startOfToday } from 'date-fns';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export const VipCustomers = () => {
  const { leads, deleteLead } = useLeadContext();
  const today = startOfToday();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState(null);
  const itemsPerPage = 10;

  const vipLeads = useMemo(() => {
    let data = leads
      .filter(l => l.isVip)
      .map(l => ({
        ...l,
        daysSinceContact: differenceInDays(today, new Date(l.lastContactedDate))
      }));

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(l => 
        l.customerName.toLowerCase().includes(lower) || 
        l.identifier.toLowerCase().includes(lower) ||
        l.carBrand.toLowerCase().includes(lower) ||
        l.carModel.toLowerCase().includes(lower)
      );
    }

    return data.sort((a, b) => b.daysSinceContact - a.daysSinceContact);
  }, [leads, searchTerm, today]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(vipLeads.length / itemsPerPage));
  const currentData = vipLeads.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleDelete = async (id) => {
    try {
      setError(null);
      await deleteLead(id);
    } catch (err) {
      console.error('Failed to delete VIP customer:', err);
      setError('Failed to delete VIP customer. Please try again.');
    }
  };

  return (
    <div className="vip-customers animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>VIP & Big Customers</h1>
          <p className="text-muted">Proactively stay in touch even without an active deal.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '0.75rem 1rem', marginBottom: '1.5rem', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', border: '1px solid var(--danger)', fontSize: '0.875rem' }}>
          {error}
        </div>
      )}

      <div className="filters surface-panel" style={{ padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ position: 'relative', flex: 1, maxWidth: '400px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search VIPs by Name, Car, or Identifier..." 
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Showing {vipLeads.length} VIP Customers
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Car Model</th>
              <th>Last Contacted</th>
              <th>Days Since Contact</th>
              <th>Stage</th>
              <th>Note</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentData.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No VIP customers match your search.</td></tr>
            )}
            {currentData.map(lead => (
              <tr key={lead.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <strong>{lead.customerName || 'Unknown'}</strong>
                    <ServiceTypeBadge serviceType={lead.serviceType} compact />
                  </div>
                  <small className="text-muted">{lead.identifier}</small>
                </td>
                <td>{lead.carBrand} {lead.carModel}</td>
                <td>{new Date(lead.lastContactedDate).toLocaleDateString()}</td>
                <td>
                  <span className={`badge ${lead.daysSinceContact >= 30 ? 'badge-red' : 'badge-green'}`}>
                    {lead.daysSinceContact} Days
                  </span>
                </td>
                <td><span className="badge badge-gray">{lead.leadType}</span></td>
                <td><LeadNoteButton lead={lead} /></td>
                <td>
                  <DeleteConfirmAction
                    size="sm"
                    onConfirm={() => handleDelete(lead.id)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {totalPages > 1 && (
          <div style={{ padding: '1rem', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary btn-icon" 
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                className="btn btn-secondary btn-icon" 
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

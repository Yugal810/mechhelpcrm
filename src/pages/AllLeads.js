import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLeadContext } from '../store/LeadContext.js';
import { AddLeadModal } from '../components/AddLeadModal.js';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge.js';
import { LeadNoteButton } from '../components/LeadNoteButton.js';
import { Edit, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { DeleteConfirmAction } from '../components/DeleteConfirmAction.js';
import { isBefore, startOfToday } from 'date-fns';

export const AllLeads = () => {
  const { leads, deleteLead } = useLeadContext();
  const [searchParams] = useSearchParams();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStage, setFilterStage] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('');
  const [specialFilter, setSpecialFilter] = useState('all');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(undefined);

  const today = startOfToday();

  useEffect(() => {
    const urlFilter = searchParams.get('filter');
    if (urlFilter) {
      setSpecialFilter(urlFilter);
    }
  }, [searchParams]);

  const filteredData = useMemo(() => {
    let data = leads;

    // Apply special URL filters
    if (specialFilter === 'calls-due-today') {
      data = data.filter(l => 
        !['Booked', 'Completed', 'Lost'].includes(l.leadType) &&
        new Date(l.nextFollowUpDate) <= today
      );
    } else if (specialFilter === 'rescheduled') {
      data = data.filter(l => (l.bookingHistory?.length || 0) > 0);
    }

    // Apply stage filter
    if (filterStage) {
      data = data.filter(l => l.leadType === filterStage);
    }

    // Apply priority filter
    if (filterPriority) {
      data = data.filter(l => l.priority === filterPriority);
    }

    // Apply service type filter
    if (filterServiceType) {
      if (filterServiceType === 'Both') {
        data = data.filter(l => l.serviceType?.includes('Service') && l.serviceType?.includes('Painting/Denting'));
      } else if (filterServiceType === 'Service') {
        data = data.filter(l => l.serviceType?.includes('Service'));
      } else if (filterServiceType === 'Painting/Denting') {
        data = data.filter(l => l.serviceType?.includes('Painting/Denting'));
      }
    }

    // Apply search
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

    // Sort by creation date descending, or by follow up date if "calls-due-today"
    if (specialFilter === 'calls-due-today') {
      data = data.sort((a, b) => new Date(a.nextFollowUpDate).getTime() - new Date(b.nextFollowUpDate).getTime());
    } else {
      data = data.sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());
    }

    return data;
  }, [leads, specialFilter, filterStage, filterPriority, filterServiceType, searchTerm, today]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));
  const currentData = filteredData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleEdit = (lead) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };



  return (
    <div className="all-leads animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <h1>Leads Database</h1>
          <p>Complete directory of all your leads</p>
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
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              style={{ paddingLeft: '2.5rem' }}
            />
          </div>
          
          <select className="form-select" style={{ width: 'auto' }} value={filterStage} onChange={e => { setFilterStage(e.target.value); setCurrentPage(1); }}>
            <option value="">All Stages</option>
            {['Fresh Lead', 'Call Not Received', 'Details Shared', 'Shared Quotation', 'Retarget', 'Booked', 'Completed', 'Lost'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select className="form-select" style={{ width: 'auto' }} value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setCurrentPage(1); }}>
            <option value="">All Priorities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>

          <select className="form-select" style={{ width: 'auto' }} value={filterServiceType} onChange={e => { setFilterServiceType(e.target.value); setCurrentPage(1); }}>
            <option value="">All Service Types</option>
            <option value="Service">Service</option>
            <option value="Painting/Denting">Painting/Denting</option>
            <option value="Both">Both (Service + Painting)</option>
          </select>

          {specialFilter !== 'all' && (
            <button className="btn btn-secondary btn-sm" onClick={() => { setSpecialFilter('all'); setCurrentPage(1); }}>
              Clear Special Filter
            </button>
          )}
        </div>
        
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Showing {filteredData.length} leads
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name & Priority</th>
              <th>Identifier (Source)</th>
              <th>Car</th>
              <th>Stage</th>
              <th>Note</th>
              <th>Next Follow-Up</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentData.map(lead => (
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
                <td><span className="badge badge-gray">{lead.leadType}</span></td>
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
            {currentData.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No leads match your criteria.</td></tr>
            )}
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

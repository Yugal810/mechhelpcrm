import React, { useState, useEffect, useMemo } from 'react';

import { useLeadContext } from '../store/LeadContext.js';
import { AddLeadModal } from '../components/AddLeadModal.js';
import { CallOutcomeModal } from '../components/CallOutcomeModal.js';
import { ServiceTypeBadge } from '../components/ServiceTypeBadge.js';
import { Plus, Phone, ClipboardEdit, Edit, RefreshCw } from 'lucide-react';
import { DeleteConfirmAction } from '../components/DeleteConfirmAction.js';
import { isBefore, startOfToday } from 'date-fns';
import './SujalList.css';

export const SujalList = () => {
  const { leads, sujalList, addSujalItem, updateSujalItem, deleteSujalItem, deleteLead, isLoading } = useLeadContext();
  const [newTag, setNewTag] = useState('');
  const [newPriority, setNewPriority] = useState('Medium');
  const [deleteErrorId, setDeleteErrorId] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItemForConversion, setSelectedItemForConversion] = useState(null);
  const [selectedLeadForEdit, setSelectedLeadForEdit] = useState(null);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState(null);
  const [bookingLead, setBookingLead] = useState(null);

  const [openLogCallRowId, setOpenLogCallRowId] = useState(null);

  const today = startOfToday();

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenLogCallRowId(null);
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Retarget backlog: EVERY lead with leadType === 'Retarget' across all days & slots
  const retargetLeads = useMemo(() => {
    return leads
      .filter(l => l.leadType === 'Retarget')
      .sort((a, b) => new Date(b.createdDate || 0).getTime() - new Date(a.createdDate || 0).getTime());
  }, [leads]);

  const handleDelete = async (id) => {
    try {
      setDeleteErrorId(null);
      await deleteSujalItem(id);
    } catch {
      setDeleteErrorId(id);
    }
  };

  const handleDeleteLead = async (id) => {
    try {
      setDeleteErrorId(null);
      await deleteLead(id);
    } catch {
      setDeleteErrorId(id);
    }
  };

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newTag.trim()) return;
    
    addSujalItem({
      salesIqTag: newTag,
      priority: newPriority,
      status: 'Pending',
    });
    setNewTag('');
  };

  const handleSelectOutcome = (item: SujalCallListItem, status: SujalStatus) => {
    updateSujalItem({ 
      ...item, 
      status,
    });

    if (status === 'Booked') {
      setSelectedItemForConversion(item);
      setIsModalOpen(true);
    }

    setOpenLogCallRowId(null);
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Call Not Received':
        return 'badge-red';
      case 'Details Shared':
        return 'badge-blue';
      case 'Retargeted':
        return 'badge-orange';
      case 'Booked':
        return 'badge-green';
      case 'Completed':
        return 'badge-teal';
      case 'Lost':
        return 'badge-red';
      default:
        return 'badge-gray';
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const activeItems = sujalList.filter(item => 
    item.dateAdded.startsWith(todayStr) || 
    item.status === 'Call Not Received' || 
    item.status === 'Pending'
  );

  return (
    <div className="sujal-list animate-fade-in">
      <div className="dashboard-header" style={{ marginBottom: '2rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <h1 style={{ margin: 0 }}>Pending Call List</h1>
            <div className="daily-call-stat-card">
              <div className="stat-icon-box">
                <RefreshCw size={16} className="text-accent" />
              </div>
              <div className="stat-content">
                <span className="stat-label">Retarget Backlog</span>
                <span className="stat-value">{isLoading ? '-' : `${retargetLeads.length} ${retargetLeads.length === 1 ? 'lead' : 'leads'}`}</span>
              </div>
            </div>
          </div>
          <p style={{ marginTop: '0.25rem' }}>Complete backlog of retarget leads across all days and time slots</p>
        </div>
      </div>

      {/* Retarget Leads Backlog Table */}
      <div className="surface-panel" style={{ padding: '1.5rem', marginBottom: '2.5rem', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <RefreshCw size={20} className="text-warning" />
            <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Retarget Backlog (All Days)</h2>
            <span className="badge badge-orange" style={{ marginLeft: '0.5rem' }}>
              {retargetLeads.length} {retargetLeads.length === 1 ? 'lead' : 'leads'}
            </span>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            All Retarget stage leads regardless of follow-up date or time slot
          </p>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Customer & Priority</th>
                <th>Identifier (Source)</th>
                <th>Car</th>
                <th>Time Slot</th>
                <th>Next Follow-Up</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {retargetLeads.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No retarget leads in the backlog.
                  </td>
                </tr>
              )}
              {retargetLeads.map(lead => (
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
                      {lead.retargetTimeSlot === 'morning' ? '☀️ Morning' : lead.retargetTimeSlot === 'evening' ? '🌙 Evening' : 'Unscheduled'}
                    </span>
                  </td>
                  <td>
                    <span className={isBefore(new Date(lead.nextFollowUpDate), today) ? 'text-danger font-bold' : ''}>
                      {lead.nextFollowUpDate}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedLeadForEdit(lead)}>
                        <Edit size={14} /> Edit
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={() => setSelectedLeadForCall(lead)}>
                        <Phone size={14} /> Log Call
                      </button>
                      <DeleteConfirmAction
                        size="sm"
                        onConfirm={() => handleDeleteLead(lead.id)}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Tag Call List Section */}
      <div className="surface-panel" style={{ padding: '1.5rem', borderRadius: '12px' }}>
        <div style={{ marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0 }}>Quick Tag Call List</h2>
          <p style={{ margin: 0, marginTop: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Quickly add ad-hoc SalesIQ tags or phone numbers for instant calling
          </p>
        </div>

        <div className="add-item-form" style={{ marginBottom: '1.5rem' }}>
          <form onSubmit={handleAdd}>
            <div className="form-group row-align" style={{ gap: '1rem', display: 'flex', alignItems: 'center', marginBottom: 0 }}>
              <input 
                type="text" 
                className="form-input" 
                style={{ flex: 2 }}
                placeholder="SalesIQ Tag (e.g. #4521) or Phone" 
                value={newTag} 
                onChange={e => setNewTag(e.target.value)} 
              />
              <select className="form-select" style={{ flex: 1 }} value={newPriority} onChange={e => setNewPriority(e.target.value)}>
                <option value="High">High Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="Low">Low Priority</option>
              </select>
              <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
                <Plus size={18} style={{ marginRight: '0.5rem' }} /> Add to List
              </button>
            </div>
          </form>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Identifier (Tag/Phone)</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Added On</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeItems.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No quick tag calls on the list for today.</td></tr>
              )}
              {activeItems.map(item => (
                <tr key={item.id}>
                  <td><strong>{item.salesIqTag}</strong></td>
                  <td>
                    <span className={`badge ${item.priority === 'High' ? 'badge-red' : item.priority === 'Medium' ? 'badge-orange' : 'badge-blue'}`}>
                      {item.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusBadgeClass(item.status)}`}>{item.status}</span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {new Date(item.dateAdded).toLocaleDateString()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <DeleteConfirmAction
                        size="sm"
                        onConfirm={() => handleDelete(item.id)}
                      />
                      <a href={`tel:${item.salesIqTag}`} className="btn btn-secondary btn-sm" title="Call">
                        <Phone size={14} /> Call
                      </a>
                      {openLogCallRowId === item.id ? (
                        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
                          <select
                            className="form-select btn-sm"
                            style={{ 
                              height: '32px', 
                              padding: '0 0.5rem', 
                              fontSize: '0.875rem',
                              borderRadius: '6px',
                              borderColor: 'var(--border-color)',
                              backgroundColor: 'var(--bg-secondary)',
                              color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                            value=""
                            autoFocus
                            onChange={(e) => {
                              const selectedOutcome = e.target.value;
                              if (selectedOutcome) {
                                handleSelectOutcome(item, selectedOutcome);
                              }
                            }}
                          >
                            <option value="" disabled>Select Outcome...</option>
                            <option value="Call Not Received">Call Not Received</option>
                            <option value="Details Shared">Details Shared</option>
                            <option value="Retargeted">Retargeted</option>
                            <option value="Booked">Booked</option>
                            <option value="Completed">Completed</option>
                            <option value="Lost">Lost</option>
                          </select>
                        </div>
                      ) : (
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenLogCallRowId(prev => prev === item.id ? null : item.id);
                          }}
                        >
                          <ClipboardEdit size={14} /> Log Call
                        </button>
                      )}
                    </div>
                    {deleteErrorId === item.id && (
                      <span style={{ color: 'var(--danger)', fontSize: '0.75rem', position: 'absolute', marginTop: '2.5rem' }}>Failed to delete.</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {(isModalOpen || !!selectedLeadForEdit || !!bookingLead) && (
        <AddLeadModal 
          isOpen={isModalOpen || !!selectedLeadForEdit || !!bookingLead} 
          onClose={() => {
            setIsModalOpen(false);
            setSelectedItemForConversion(null);
            setSelectedLeadForEdit(null);
            setBookingLead(null);
          }} 
          initialData={
            selectedLeadForEdit ||
            bookingLead ||
            (selectedItemForConversion ? {
              leadSource: 'SalesIQ',
              identifier: selectedItemForConversion.salesIqTag,
              leadType: 'Booked'
            } : undefined)
          }
        />
      )}

      {selectedLeadForCall && (
        <CallOutcomeModal
          isOpen={!!selectedLeadForCall}
          onClose={() => setSelectedLeadForCall(null)}
          lead={selectedLeadForCall}
          onBooked={(l) => setBookingLead(l)}
        />
      )}
    </div>
  );
};

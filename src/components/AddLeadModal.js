import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';
import { useLeadContext } from '../store/LeadContext.js';
import { LeadService } from '../utils/dataLayer.js';
import { fetchOptions } from '../services/mechhelpApi.js';
import { SearchableSelect } from './SearchableSelect.jsx';
import './AddLeadModal.css';



export const AddLeadModal = ({ isOpen, onClose, initialData }) => {
  const { addLead, updateLead, getGarageList } = useLeadContext();
  const isEditing = !!initialData?.id;

  const [createdDate, setCreatedDate] = useState(
    initialData?.createdDate
      ? (initialData.createdDate.includes('T') ? initialData.createdDate.split('T')[0] : initialData.createdDate)
      : new Date().toISOString().split('T')[0]
  );
  const [serviceType, setServiceType] = useState(initialData?.serviceType || []);
  const [leadSource, setLeadSource] = useState(initialData?.leadSource || 'SalesIQ');
  const [salesperson, setSalesperson] = useState(initialData?.salesperson || 'Choice');
  const [identifier, setIdentifier] = useState(initialData?.identifier || '');
  const [customerName, setCustomerName] = useState(initialData?.customerName || '');
  const [carBrand, setCarBrand] = useState(initialData?.carBrand || '');
  const [carModel, setCarModel] = useState(initialData?.carModel || '');
  const [numberPlate, setNumberPlate] = useState(initialData?.numberPlate || '');
  const [priority, setPriority] = useState(initialData?.priority || 'Medium');
  const [leadType, setLeadType] = useState(initialData?.leadType || 'Fresh Lead');
  const [retargetTimeSlot, setRetargetTimeSlot] = useState(initialData?.retargetTimeSlot || null);
  
  const [bookingType, setBookingType] = useState(initialData?.bookingType);
  const [garageAssigned, setGarageAssigned] = useState(initialData?.garageAssigned || '');
  const [bookingDateTime, setBookingDateTime] = useState(initialData?.bookingDateTime ? initialData.bookingDateTime.split('T')[0] : '');

  const [garageList, setGarageList] = useState([]);

  useEffect(() => {
    if (isOpen) {
      getGarageList()
        .then(list => setGarageList(list))
        .catch(err => console.error('Failed to load garages in AddLeadModal:', err));
    }
  }, [isOpen]);

  
  const [nextFollowUpDate, setNextFollowUpDate] = useState(
    initialData?.nextFollowUpDate || new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isVip, setIsVip] = useState(initialData?.isVip || false);
  const [whatsappBroadcast, setWhatsappBroadcast] = useState(initialData?.whatsappBroadcast || false);

  const [errors, setErrors] = useState({});

  const [normalBrands, setNormalBrands] = useState([]);
  const [premiumBrands, setPremiumBrands] = useState([]);
  const [apiModels, setApiModels] = useState([]);
  const [premiumModelsSet, setPremiumModelsSet] = useState(new Set());

  useEffect(() => {
    if (isOpen) {
      Promise.all([
        fetchOptions({ type: 'normal' }),
        fetchOptions({ type: 'premium' })
      ]).then(([normalData, premiumData]) => {
        setNormalBrands(normalData.brands || []);
        setPremiumBrands(premiumData.brands || []);
        setPremiumModelsSet(new Set(premiumData.models || []));
      }).catch(err => console.error('Error fetching brands:', err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && carBrand) {
      Promise.all([
        fetchOptions({ brand: carBrand, type: 'normal' }),
        fetchOptions({ brand: carBrand, type: 'premium' })
      ]).then(([normalData, premiumData]) => {
        const combinedModels = Array.from(new Set([...(normalData.models || []), ...(premiumData.models || [])])).sort();
        setApiModels(combinedModels);
        setPremiumModelsSet(prev => new Set([...prev, ...(premiumData.models || [])]));
      }).catch(err => console.error('Error fetching models:', err));
    } else {
      setApiModels([]);
    }
  }, [isOpen, carBrand]);

  // Auto-VIP logic
  useEffect(() => {
    if (carModel && premiumModelsSet.has(carModel) && !isEditing) {
      setIsVip(true);
    }
  }, [carModel, isEditing, premiumModelsSet]);

  // Reset form when opening in Create mode, or populate when opening in Edit mode
  useEffect(() => {
    if (isOpen) {
      if (!initialData?.id) {
        // Create mode: Reset all fields to defaults
        setCreatedDate(new Date().toISOString().split('T')[0]);
        setServiceType([]);
        setLeadSource('SalesIQ');
        setSalesperson('Choice');
        setIdentifier('');
        setCustomerName('');
        setCarBrand('');
        setCarModel('');
        setNumberPlate('');
        setPriority('Medium');
        setLeadType('Fresh Lead');
        setRetargetTimeSlot(null);
        setBookingType(undefined);
        setGarageAssigned('');
        setBookingDateTime('');
        setNextFollowUpDate(new Date().toISOString().split('T')[0]);
        setNotes('');
        setIsVip(false);
        setWhatsappBroadcast(false);
        setErrors({});
      } else {
        // Edit mode: Populate from initialData
        setCreatedDate(
          initialData.createdDate
            ? (initialData.createdDate.includes('T') ? initialData.createdDate.split('T')[0] : initialData.createdDate)
            : new Date().toISOString().split('T')[0]
        );
        setServiceType(initialData.serviceType || []);
        setLeadSource(initialData.leadSource || 'SalesIQ');
        setSalesperson(initialData.salesperson || 'Choice');
        setIdentifier(initialData.identifier || '');
        setCustomerName(initialData.customerName || '');
        setCarBrand(initialData.carBrand || '');
        setCarModel(initialData.carModel || '');
        setNumberPlate(initialData.numberPlate || '');
        setPriority(initialData.priority || 'Medium');
        setLeadType(initialData.leadType || 'Fresh Lead');
        setRetargetTimeSlot(initialData.retargetTimeSlot || null);
        setBookingType(initialData.bookingType);
        setGarageAssigned(initialData.garageAssigned || '');
        setBookingDateTime(initialData.bookingDateTime ? initialData.bookingDateTime.split('T')[0] : '');
        setNextFollowUpDate(initialData.nextFollowUpDate || new Date().toISOString().split('T')[0]);
        setNotes(initialData.notes || '');
        setIsVip(initialData.isVip || false);
        setWhatsappBroadcast(initialData.whatsappBroadcast || false);
        setErrors({});
      }
    }
  }, [isOpen, initialData]);

  // Real-time debounced duplicate validation for SalesIQ Tag
  useEffect(() => {
    if (leadSource !== 'SalesIQ' || !identifier.trim() || !isOpen) {
      return;
    }
    const timer = setTimeout(async () => {
      const isDup = await LeadService.checkSalesIqTagExists(
        identifier,
        isEditing ? initialData?.id : undefined
      );
      if (isDup) {
        setErrors(prev => ({
          ...prev,
          identifier: "This SalesIQ Tag is already in use — each tag must be unique."
        }));
      } else {
        setErrors(prev => {
          if (prev.identifier === "This SalesIQ Tag is already in use — each tag must be unique.") {
            const next = { ...prev };
            delete next.identifier;
            return next;
          }
          return prev;
        });
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [identifier, leadSource, isEditing, initialData?.id, isOpen]);

  const handleIdentifierBlur = async () => {
    if (leadSource === 'SalesIQ' && identifier.trim()) {
      const isDup = await LeadService.checkSalesIqTagExists(
        identifier,
        isEditing ? initialData?.id : undefined
      );
      if (isDup) {
        setErrors(prev => ({
          ...prev,
          identifier: "This SalesIQ Tag is already in use — each tag must be unique."
        }));
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    
    const newErrors = {};

    if (leadSource === 'SalesIQ') {
      if (!identifier.trim()) {
        newErrors.identifier = "SalesIQ Tag is required";
      } else {
        const isDup = await LeadService.checkSalesIqTagExists(
          identifier,
          isEditing ? initialData?.id : undefined
        );
        if (isDup) {
          newErrors.identifier = "This SalesIQ Tag is already in use — each tag must be unique.";
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      
      const firstErrorKey = Object.keys(newErrors)[0];
      const errorElement = document.getElementById(`field-${firstErrorKey}`);
      if (errorElement) {
        const formGroup = errorElement.closest('.form-group') || errorElement;
        const modalBody = document.querySelector('.modal-body');
        
        if (modalBody) {
          const elementRect = formGroup.getBoundingClientRect();
          const bodyRect = modalBody.getBoundingClientRect();
          
          const targetScrollTop = modalBody.scrollTop + (elementRect.top - bodyRect.top) - 20;
          
          modalBody.scrollTo({
            top: targetScrollTop,
            behavior: 'smooth'
          });
        } else {
          formGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
        errorElement.focus({ preventScroll: true });
      }
      return;
    }

    const finalCarBrand = carBrand.trim();
    const finalCarModel = carModel.trim();

    // Custom brand/model is just saved directly to the lead

    const lead = {
      id: isEditing ? initialData.id : uuidv4(),
      customerName,
      leadSource,
      salesperson,
      identifier,
      carBrand: finalCarBrand,
      carModel: finalCarModel,
      priority,
      leadType,
      bookingType: leadType === 'Booked' ? bookingType : undefined,
      garageAssigned: leadType === 'Booked' ? garageAssigned : undefined,
      bookingDateTime: leadType === 'Booked' ? bookingDateTime : undefined,
      garageNotified: isEditing ? !!initialData?.garageNotified : false,
      nextFollowUpDate,
      lastContactedDate: isEditing ? initialData.lastContactedDate : new Date().toISOString(),
      isVip,
      whatsappBroadcast,
      retargetTimeSlot: leadType === 'Retarget' ? retargetTimeSlot : null,
      detailsSharedAt: leadType === 'Details Shared'
        ? (isEditing && initialData?.leadType === 'Details Shared' && initialData?.detailsSharedAt
            ? initialData.detailsSharedAt
            : new Date().toISOString())
        : null,
      serviceType,
      numberPlate: numberPlate.trim() || undefined,
      notes,
      createdDate: createdDate
        ? (createdDate.includes('T') ? createdDate : `${createdDate}T00:00:00.000Z`)
        : (isEditing ? initialData.createdDate : new Date().toISOString()),
    };

    try {
      if (isEditing) {
        await updateLead(lead);
      } else {
        await addLead(lead);
      }
      onClose();
    } catch (err) {
      console.error('Error saving lead in AddLeadModal:', err);
      const errMsg = err?.message || '';
      const errCode = err?.code || '';
      if (
        errCode === '23505' ||
        errMsg.toLowerCase().includes('unique') ||
        errMsg.toLowerCase().includes('duplicate') ||
        errMsg.toLowerCase().includes('already in use') ||
        errMsg.includes('idx_leads_unique_salesiq_tag')
      ) {
        setErrors({ identifier: "This SalesIQ Tag is already in use — each tag must be unique." });
        const errorElement = document.getElementById('field-identifier');
        if (errorElement) {
          const formGroup = errorElement.closest('.form-group') || errorElement;
          const modalBody = document.querySelector('.modal-body');
          if (modalBody) {
            const elementRect = formGroup.getBoundingClientRect();
            const bodyRect = modalBody.getBoundingClientRect();
            const targetScrollTop = modalBody.scrollTop + (elementRect.top - bodyRect.top) - 20;
            modalBody.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
          } else {
            formGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          errorElement.focus({ preventScroll: true });
        }
      } else {
        alert(errMsg || 'Failed to save lead.');
      }
    }
  };

  return createPortal(
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>{isEditing ? 'Edit Lead' : 'Add New Lead'}</h2>
          <button className="btn-close" onClick={onClose}>&times;</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form-wrapper" noValidate>
          <div className="modal-body">
            {/* FEATURE 2: Date field at TOP of form */}
            <div className="form-group mb-4">
              <label className="form-label">Date</label>
              <input 
                id="field-createdDate"
                type="date" 
                className="form-input" 
                value={createdDate} 
                onChange={e => setCreatedDate(e.target.value)} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Customer Name</label>
              <input 
                id="field-customerName"
                type="text" 
                className={`form-input ${errors.customerName ? 'is-invalid' : ''}`} 
                value={customerName} 
                onChange={e => {
                  setCustomerName(e.target.value);
                  if (errors.customerName) setErrors(prev => ({...prev, customerName: ''}));
                }} 
              />
              {errors.customerName && <div className="invalid-feedback">{errors.customerName}</div>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Lead Source</label>
                <select 
                  className="form-select" 
                  value={leadSource} 
                  onChange={e => {
                    setLeadSource(e.target.valueSource);
                    setIdentifier('');
                    if (errors.identifier) setErrors(prev => ({...prev, identifier: ''}));
                  }}
                >
                  <option value="SalesIQ">SalesIQ</option>
                  <option value="Direct Call">Direct Call</option>
                  <option value="Referral">Referral</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Salesperson</label>
                <select 
                  id="field-salesperson"
                  className="form-select" 
                  value={salesperson} 
                  onChange={e => setSalesperson(e.target.value)}
                >
                  <option value="Choice">Choice</option>
                  <option value="Nothing">Nothing</option>
                  <option value="Tecno">Tecno</option>
                  <option value="Realme">Realme</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                {leadSource === 'SalesIQ' ? 'SalesIQ Tag (Required)' : 'Last 4 Digits of Phone'}
              </label>
              <input 
                id="field-identifier"
                type="text" 
                className={`form-input ${errors.identifier ? 'is-invalid' : ''}`} 
                maxLength={leadSource === 'SalesIQ' ? 50 : 4}
                value={identifier} 
                onBlur={handleIdentifierBlur}
                onChange={e => {
                  const val = e.target.value;
                  if (leadSource !== 'SalesIQ' && !/^\d{0,4}$/.test(val)) return;
                  setIdentifier(val);
                  if (errors.identifier) setErrors(prev => ({...prev, identifier: ''}));
                }} 
              />
              {errors.identifier && <div className="invalid-feedback">{errors.identifier}</div>}
              {leadSource !== 'SalesIQ' && !errors.identifier && <small className="text-muted text-xs mt-1">Do not enter full phone numbers. Privacy rule enforced.</small>}
            </div>

            <div className="form-row" style={{ position: 'relative', zIndex: 100 }}>
              <div className="form-group">
                <label className="form-label">Car Brand</label>
                <SearchableSelect 
                  className={`form-input ${errors.carBrand ? 'is-invalid' : ''}`}
                  placeholder="Search or type brand..."
                  grouped={true}
                  value={carBrand}
                  onChange={val => {
                    setCarBrand(val);
                    setCarModel('');
                    if (errors.carBrand) setErrors(prev => ({...prev, carBrand: ''}));
                  }}
                  options={[
                    { label: 'Normal Cars', items: normalBrands },
                    { label: 'Premium Cars', items: premiumBrands }
                  ]}
                />
                {errors.carBrand && <div className="invalid-feedback">{errors.carBrand}</div>}
              </div>
              <div className="form-group">
                <label className="form-label">Car Model</label>
                <SearchableSelect 
                  className={`form-input ${errors.carModel ? 'is-invalid' : ''}`}
                  placeholder="Search or type model..."
                  grouped={false}
                  disabled={!carBrand}
                  value={carModel}
                  onChange={val => {
                    setCarModel(val);
                    if (errors.carModel) setErrors(prev => ({...prev, carModel: ''}));
                  }}
                  options={apiModels}
                />
                {errors.carModel && <div className="invalid-feedback">{errors.carModel}</div>}
              </div>
            </div>

            {/* FEATURE 1: Service Type multi-select right before Number Plate */}
            <div className="form-group mb-4">
              <label className="form-label">Service Type</label>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: serviceType.includes('Service') ? '1px solid var(--teal)' : '1px solid var(--border-light)',
                    backgroundColor: serviceType.includes('Service') ? 'rgba(20, 184, 166, 0.15)' : 'var(--bg-tertiary)',
                    color: serviceType.includes('Service') ? 'var(--teal)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    userSelect: 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={serviceType.includes('Service')}
                    onChange={e => {
                      if (e.target.checked) {
                        setServiceType(prev => [...prev, 'Service']);
                      } else {
                        setServiceType(prev => prev.filter(s => s !== 'Service'));
                      }
                    }}
                    style={{ accentColor: 'var(--teal)', width: '16px', height: '16px' }}
                  />
                  🛠️ Service
                </label>

                <label
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: serviceType.includes('Painting/Denting') ? '1px solid var(--vip)' : '1px solid var(--border-light)',
                    backgroundColor: serviceType.includes('Painting/Denting') ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-tertiary)',
                    color: serviceType.includes('Painting/Denting') ? 'var(--vip)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    userSelect: 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={serviceType.includes('Painting/Denting')}
                    onChange={e => {
                      if (e.target.checked) {
                        setServiceType(prev => [...prev, 'Painting/Denting']);
                      } else {
                        setServiceType(prev => prev.filter(s => s !== 'Painting/Denting'));
                      }
                    }}
                    style={{ accentColor: 'var(--vip)', width: '16px', height: '16px' }}
                  />
                  🎨 Painting/Denting
                </label>
              </div>
            </div>

            <div className="form-group mb-4">
              <label className="form-label">Number Plate</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. MH12AB1234"
                value={numberPlate}
                onChange={e => setNumberPlate(e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Priority</label>
                <select className="form-select" value={priority} onChange={e => setPriority(e.target.value)}>
                  <option value="High">🔴 High Priority</option>
                  <option value="Medium">🟡 Medium Priority</option>
                  <option value="Low">🟢 Low Priority</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Lead Type / Stage</label>
                <select className="form-select" value={leadType} onChange={e => {
                  const newType = e.target.valueType;
                  setLeadType(newType);
                  if (newType !== 'Retarget') setRetargetTimeSlot(null);
                }}>
                  {['Fresh Lead', 'Call Not Received', 'Details Shared', 'Shared Quotation', 'Retarget', 'Booked', 'Completed', 'Lost'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {leadType === 'Retarget' && (
                  <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Time Slot:</span>
                    <button
                      type="button"
                      className={`btn btn-sm ${retargetTimeSlot === 'morning' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', borderRadius: '16px' }}
                      onClick={() => setRetargetTimeSlot(retargetTimeSlot === 'morning' ? null : 'morning')}
                    >
                      ☀️ Morning
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${retargetTimeSlot === 'evening' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.2rem 0.6rem', fontSize: '0.8rem', borderRadius: '16px' }}
                      onClick={() => setRetargetTimeSlot(retargetTimeSlot === 'evening' ? null : 'evening')}
                    >
                      🌙 Evening
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Next Follow-up Date</label>
              <input 
                id="field-nextFollowUpDate"
                type="date" 
                className={`form-input ${errors.nextFollowUpDate ? 'is-invalid' : ''}`} 
                value={nextFollowUpDate} 
                onChange={e => {
                  setNextFollowUpDate(e.target.value);
                  if (errors.nextFollowUpDate) setErrors(prev => ({...prev, nextFollowUpDate: ''}));
                }} 
              />
              {errors.nextFollowUpDate && <div className="invalid-feedback">{errors.nextFollowUpDate}</div>}
            </div>

            {leadType === 'Booked' && (
              <div className="booking-section p-4 rounded-md bg-opacity-10 bg-accent-glow mb-4 border border-accent-glow">
                <h4 className="mb-3 text-sm font-semibold text-accent-primary">Booking Details</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Booking Type</label>
                    <select 
                      id="field-bookingType"
                      className={`form-select ${errors.bookingType ? 'is-invalid' : ''}`} 
                      value={bookingType || ''} 
                      onChange={e => {
                        setBookingType(e.target.value);
                        if (errors.bookingType) setErrors(prev => ({...prev, bookingType: ''}));
                      }}
                    >
                      <option value="">Select...</option>
                      <option value="Pickup">Pickup</option>
                      <option value="Garage Visit">Garage Visit</option>
                    </select>
                    {errors.bookingType && <div className="invalid-feedback">{errors.bookingType}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Garage Assigned</label>
                    <select 
                      id="field-garageAssigned"
                      className={`form-select ${errors.garageAssigned ? 'is-invalid' : ''}`} 
                      value={garageAssigned} 
                      onChange={e => {
                        setGarageAssigned(e.target.value);
                        if (errors.garageAssigned) setErrors(prev => ({...prev, garageAssigned: ''}));
                      }}
                    >
                      <option value="">Select Garage...</option>
                      {garageAssigned && !garageList.some(g => g.name === garageAssigned) && (
                        <option value={garageAssigned}>{garageAssigned} (Archived)</option>
                      )}
                      {garageList.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                    {errors.garageAssigned && <div className="invalid-feedback">{errors.garageAssigned}</div>}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Booking Date</label>
                  <input 
                    id="field-bookingDateTime"
                    type="date" 
                    className={`form-input ${errors.bookingDateTime ? 'is-invalid' : ''}`} 
                    value={bookingDateTime} 
                    onChange={e => {
                      setBookingDateTime(e.target.value);
                      if (errors.bookingDateTime) setErrors(prev => ({...prev, bookingDateTime: ''}));
                    }} 
                  />
                  {errors.bookingDateTime && <div className="invalid-feedback">{errors.bookingDateTime}</div>}
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-textarea" rows={3} value={notes} onChange={e => setNotes(e.target.value)}></textarea>
            </div>

            <div className="form-row flags-row">
              <label className="flag-label">
                <input type="checkbox" className="form-checkbox" checked={isVip} onChange={e => setIsVip(e.target.checked)} />
                VIP / Premium Customer
              </label>
              <label className="flag-label">
                <input type="checkbox" className="form-checkbox" checked={whatsappBroadcast} onChange={e => setWhatsappBroadcast(e.target.checked)} />
                Add to WhatsApp Broadcast
              </label>
            </div>

          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{isEditing ? 'Save Changes' : 'Create Lead'}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

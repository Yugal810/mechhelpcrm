import React, { useState, useEffect, useMemo } from 'react';
import type { Lead, LeadSource, Salesperson, LeadType, BookingType, Priority, ServiceType } from '../../types';
import { CAR_BRANDS, PREMIUM_MODELS } from '../../data/seed';
import { User, Phone, Car, Calendar, ShieldAlert, CheckCircle, Tag, MessageSquare, Save, Sparkles, Check, RotateCcw } from 'lucide-react';
import { searchCars, fetchOptions } from './api';
import { toYmd } from '../../utils/dataLayer';
import './LeadEditPanel.css';

interface LeadEditPanelProps {
  activeLead: Lead | null;
  allLeads: Lead[];
  onSelectLead: (leadId: string) => void;
  onSaveLead: (lead: Lead) => Promise<void>;
  garageList: { id: string; name: string }[];
  onSelectCar?: (car: any) => void;
  carMode?: string;
  searchedAddress?: string;
  selectedPlanInfo?: { name: string; price: string | number } | null;
  targetDate?: string;
}

const getTomorrowYmd = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const LeadEditPanel: React.FC<LeadEditPanelProps> = ({
  activeLead,
  allLeads,
  onSelectLead,
  onSaveLead,
  garageList,
  onSelectCar,
  carMode = 'all',
  searchedAddress,
  selectedPlanInfo,
  targetDate,
}) => {
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [createdDate, setCreatedDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [leadSource, setLeadSource] = useState<LeadSource>('SalesIQ');
  const [salesperson, setSalesperson] = useState<Salesperson>('Choice');
  const [identifier, setIdentifier] = useState('');
  const [carBrand, setCarBrand] = useState('');
  const [carModel, setCarModel] = useState('');
  const [fuelType, setFuelType] = useState('');
  const [customYear, setCustomYear] = useState('');
  const [options, setOptions] = useState<{ brands: string[]; models: string[] }>({
    brands: [],
    models: [],
  });
  const [numberPlate, setNumberPlate] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [leadType, setLeadType] = useState<LeadType>('Fresh Lead');
  const [retargetTimeSlot, setRetargetTimeSlot] = useState<'morning' | 'evening' | null>(null);
  const [serviceType, setServiceType] = useState<ServiceType[]>([]);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [bookingType, setBookingType] = useState<BookingType | undefined>(undefined);
  const [garageAssigned, setGarageAssigned] = useState('');
  const [bookingDateTime, setBookingDateTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isVip, setIsVip] = useState(false);
  const [whatsappBroadcast, setWhatsappBroadcast] = useState(false);

  const checkIsPremium = (brandStr: string, modelStr: string, carObj?: any): boolean => {
    if (carObj && (carObj.type === 'premium' || carObj.pricing_category === 'premium')) {
      return true;
    }
    const bLower = (brandStr || '').trim().toLowerCase();
    const mLower = (modelStr || '').trim().toLowerCase();
    const premiumBrands = [
      'mercedes-benz', 'mercedes', 'bmw', 'audi', 'volvo', 'land rover',
      'porsche', 'jaguar', 'lexus', 'ferrari', 'lamborghini', 'rolls-royce',
      'bentley', 'maserati', 'aston martin'
    ];
    if (premiumBrands.some(pb => bLower.includes(pb))) return true;
    if (PREMIUM_MODELS.some(pm => pm.toLowerCase() === mLower || (mLower && pm.toLowerCase().includes(mLower) && mLower.length >= 3))) return true;
    return false;
  };

  useEffect(() => {
    if (activeLead) {
      setCreatedDate(toYmd(activeLead.createdDate) || new Date().toISOString().split('T')[0]);
      setCustomerName(activeLead.customerName || '');
      setLeadSource(activeLead.leadSource || 'SalesIQ');
      setSalesperson(activeLead.salesperson || 'Choice');
      setIdentifier(activeLead.identifier || '');
      setCarBrand(activeLead.carBrand || '');
      setCarModel(activeLead.carModel || '');
      setFuelType(activeLead.fuelType || '');
      setCustomYear(activeLead.customYear || '');
      setNumberPlate(activeLead.numberPlate || '');
      setPriority(activeLead.priority || 'Medium');
      setLeadType(activeLead.leadType || 'Fresh Lead');
      setRetargetTimeSlot(activeLead.retargetTimeSlot || null);
      let parsedServiceType: ServiceType[] = [];
      if (Array.isArray(activeLead.serviceType)) {
        parsedServiceType = activeLead.serviceType;
      } else if (typeof activeLead.serviceType === 'string' && (activeLead.serviceType as string).trim()) {
        try {
          const parsed = JSON.parse(activeLead.serviceType);
          if (Array.isArray(parsed)) parsedServiceType = parsed;
          else parsedServiceType = [(activeLead.serviceType as string).trim() as ServiceType];
        } catch {
          parsedServiceType = [(activeLead.serviceType as string).trim() as ServiceType];
        }
      }
      setServiceType(parsedServiceType);

      const tomorrow = getTomorrowYmd();
      const leadFollowUp = toYmd(activeLead.nextFollowUpDate);
      const todayStr = toYmd(new Date().toISOString());

      if (targetDate && targetDate.trim()) {
        setNextFollowUpDate(toYmd(targetDate));
      } else if (!leadFollowUp || leadFollowUp <= todayStr) {
        setNextFollowUpDate(tomorrow);
      } else {
        setNextFollowUpDate(leadFollowUp);
      }

      setBookingType(activeLead.bookingType);
      setGarageAssigned(activeLead.garageAssigned || '');
      setBookingDateTime(toYmd(activeLead.bookingDateTime));
      setNotes(activeLead.notes || '');
      setIsVip(activeLead.isVip || false);
      setWhatsappBroadcast(activeLead.whatsappBroadcast || false);
      setSaveStatus(null);
    }
  }, [activeLead]);

  // Sync targetDate from SelectedCarCard to nextFollowUpDate
  useEffect(() => {
    if (targetDate && targetDate.trim()) {
      setNextFollowUpDate(toYmd(targetDate));
    } else {
      setNextFollowUpDate(getTomorrowYmd());
    }
  }, [targetDate]);

  // Sync searched address from salesperson input into notes
  useEffect(() => {
    if (searchedAddress && searchedAddress.trim()) {
      const addr = searchedAddress.trim();
      setNotes((prev) => {
        if (!prev) return `Address: ${addr}`;
        if (prev.includes(addr)) return prev;
        if (prev.includes('Address: ')) {
          return prev.replace(/Address: .*/, `Address: ${addr}`);
        }
        return `${prev}\nAddress: ${addr}`;
      });
    }
  }, [searchedAddress]);

  // Sync selected service plan into notes
  useEffect(() => {
    if (selectedPlanInfo) {
      const planLine = `Selected Service Plan: ${selectedPlanInfo.name} Plan (₹${selectedPlanInfo.price})`;
      setNotes((prev) => {
        if (!prev) return planLine;
        if (prev.includes(planLine)) return prev;
        if (/Selected Service Plan: .*/i.test(prev)) {
          return prev.replace(/Selected Service Plan: .*/i, planLine);
        }
        return `${prev}\n${planLine}`;
      });
    } else {
      setNotes((prev) => {
        if (!prev || !/Selected Service Plan: .*/i.test(prev)) return prev;
        const lines = prev.split('\n').filter((l) => !l.toLowerCase().startsWith('selected service plan:'));
        return lines.join('\n').trim();
      });
    }
  }, [selectedPlanInfo]);

  // Fetch brand and model suggestions dynamically with debouncing
  useEffect(() => {
    let isMounted = true;
    const timer = setTimeout(() => {
      fetchOptions({ type: carMode, brand: carBrand, model: carModel })
        .then((data) => {
          if (!isMounted) return;
          const seedBrands = CAR_BRANDS.filter(b => b.brand !== 'Other').map(b => b.brand);
          const allBrands = Array.from(new Set([...(data.brands || []), ...seedBrands])).sort();
          setOptions({
            brands: allBrands,
            models: data.models || [],
          });
        })
        .catch((err) => console.error('Error loading brand/model options:', err));
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [carBrand, carModel, carMode]);

  // Dynamic filtering according to user typing input
  const filteredBrands = useMemo(() => {
    const seedBrands = CAR_BRANDS.filter(b => b.brand !== 'Other').map(b => b.brand);
    const combined = Array.from(new Set([...(options.brands || []), ...seedBrands])).sort();
    if (!carBrand.trim()) return combined;
    const q = carBrand.trim().toLowerCase();
    return combined.filter(b => b.toLowerCase().includes(q));
  }, [options.brands, carBrand]);

  const filteredModels = useMemo(() => {
    let seedModels: string[] = [];
    if (carBrand.trim()) {
      const q = carBrand.trim().toLowerCase();
      const matched = CAR_BRANDS.filter(b =>
        b.brand.toLowerCase() === q ||
        b.brand.toLowerCase().includes(q) ||
        q.includes(b.brand.toLowerCase())
      );
      seedModels = matched.flatMap(b => b.models).filter(m => m !== 'Other');
    } else {
      seedModels = CAR_BRANDS.flatMap(b => b.models).filter(m => m !== 'Other');
    }
    const combined = Array.from(new Set([...(options.models || []), ...seedModels])).sort();
    if (!carModel.trim()) return combined;
    const q = carModel.trim().toLowerCase();
    return combined.filter(m => m.toLowerCase().includes(q));
  }, [options.models, carBrand, carModel]);

  function handleModelChange(val: string) {
    setCarModel(val);
    const isPrem = checkIsPremium(carBrand, val);
    setIsVip(isPrem);
  }

  // Auto search vehicle specs when vehicle inputs change (debounced with cancellation)
  useEffect(() => {
    if (!carBrand.trim() && !carModel.trim() && !fuelType.trim() && !customYear.trim()) {
      setIsVip(false);
      if (onSelectCar) onSelectCar(null);
      return;
    }

    const isPremInput = checkIsPremium(carBrand, carModel);
    setIsVip(isPremInput);

    let isMounted = true;
    const timer = setTimeout(() => {
      searchCars({ brand: carBrand, model: carModel, fuelType, customYear }, carMode)
        .then((cars) => {
          if (!isMounted) return;
          if (cars && cars.length > 0) {
            const foundCar = cars[0];
            if (foundCar.brand && foundCar.brand !== '-' && (!carBrand || carBrand.trim() === '')) {
              setCarBrand(foundCar.brand);
            }
            if (onSelectCar) {
              onSelectCar({ ...foundCar, userYear: customYear });
            }
            setIsVip(checkIsPremium(foundCar.brand || carBrand, foundCar.model || carModel, foundCar));
          } else if (onSelectCar) {
            onSelectCar(null);
          }
        })
        .catch((err) => {
          if (isMounted) console.error('Error fetching specs in LeadEditPanel:', err);
        });
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [carBrand, carModel, fuelType, customYear, carMode, onSelectCar]);

  const handleResetFilters = () => {
    setCarBrand('');
    setCarModel('');
    setFuelType('');
    setCustomYear('');
    setNumberPlate('');
    setServiceType([]);
    if (onSelectCar) {
      onSelectCar(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;

    setIsSaving(true);
    setSaveStatus(null);

    const updatedLead: Lead = {
      ...activeLead,
      customerName,
      leadSource,
      salesperson,
      identifier,
      carBrand,
      carModel,
      fuelType: fuelType.trim() || undefined,
      customYear: customYear.trim() || undefined,
      numberPlate: numberPlate.trim() || undefined,
      priority,
      leadType,
      retargetTimeSlot: leadType === 'Retarget' ? retargetTimeSlot : null,
      serviceType,
      nextFollowUpDate: leadType === 'Booked'
        ? (bookingDateTime ? (bookingDateTime.includes('T') ? bookingDateTime : `${bookingDateTime}T00:00:00.000Z`) : (nextFollowUpDate ? (nextFollowUpDate.includes('T') ? nextFollowUpDate : `${nextFollowUpDate}T00:00:00.000Z`) : new Date().toISOString()))
        : (nextFollowUpDate ? (nextFollowUpDate.includes('T') ? nextFollowUpDate : `${nextFollowUpDate}T00:00:00.000Z`) : ''),
      bookingType: leadType === 'Booked' ? bookingType : undefined,
      garageAssigned: leadType === 'Booked' ? garageAssigned : undefined,
      bookingDateTime: leadType === 'Booked'
        ? (bookingDateTime ? (bookingDateTime.includes('T') ? bookingDateTime : `${bookingDateTime}T00:00:00.000Z`) : (nextFollowUpDate ? (nextFollowUpDate.includes('T') ? nextFollowUpDate : `${nextFollowUpDate}T00:00:00.000Z`) : new Date().toISOString()))
        : undefined,
      notes,
      isVip,
      whatsappBroadcast,
      createdDate: createdDate
        ? (createdDate.includes('T') ? createdDate : `${createdDate}T00:00:00.000Z`)
        : activeLead.createdDate,
    };

    try {
      await onSaveLead(updatedLead);
      setSaveStatus('✅ Lead updated successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err: any) {
      console.error('Error saving lead:', err);
      setSaveStatus('❌ Failed to save lead changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="lead-edit-panel-container">
      <div className="lead-edit-panel-header">
        <div className="lead-edit-header-left">
          <div className="lead-avatar-icon">
            <User size={20} />
          </div>
          <div>
            <h3 className="lead-panel-title">
              {activeLead
                ? (!activeLead.customerName && !activeLead.identifier
                    ? 'New Lead'
                    : `Lead Details & Edit: ${activeLead.customerName || 'Unknown Customer'}`)
                : 'Select a Lead to Edit'}
            </h3>
            <p className="lead-panel-subtitle">
              {activeLead
                ? (!activeLead.customerName && !activeLead.identifier
                    ? 'Fill in the details below to create a new lead'
                    : `Identifier: ${activeLead.identifier} • Source: ${activeLead.leadSource}`)
                : 'Choose a lead from your CRM database to prefill details & edit'}
            </p>
          </div>
        </div>
      </div>

      {activeLead ? (
        <form onSubmit={handleSubmit} className="lead-edit-form">
          <div className="lead-edit-grid">
            {/* Column 1: Customer & Identifiers */}
            <div className="lead-edit-card">
              <h4 className="card-subheading">
                <User size={16} /> Customer Info
              </h4>

              <div className="lead-field-group">
                <label>Customer Name</label>
                <input
                  type="text"
                  className="lead-input"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name..."
                />
              </div>

              <div className="lead-field-row">
                <div className="lead-field-group">
                  <label>Lead Source</label>
                  <select
                    className="lead-select"
                    value={leadSource}
                    onChange={(e) => setLeadSource(e.target.value as LeadSource)}
                  >
                    <option value="SalesIQ">SalesIQ</option>
                    <option value="Direct Call">Direct Call</option>
                    <option value="Referral">Referral</option>
                  </select>
                </div>

                <div className="lead-field-group">
                  <label>Salesperson</label>
                  <select
                    className="lead-select"
                    value={salesperson}
                    onChange={(e) => setSalesperson(e.target.value as Salesperson)}
                  >
                    <option value="Choice">Choice</option>
                    <option value="Nothing">Nothing</option>
                    <option value="Tecno">Tecno</option>
                    <option value="Realme">Realme</option>
                  </select>
                </div>
              </div>

              <div className="lead-field-group">
                <label>{leadSource === 'SalesIQ' ? 'SalesIQ Tag' : 'Phone / Identifier'}</label>
                <input
                  type="text"
                  className="lead-input"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="SalesIQ Tag or Phone"
                />
              </div>

              <div className="lead-field-group">
                <label>Date Added</label>
                <input
                  type="date"
                  className="lead-input"
                  value={createdDate}
                  onChange={(e) => setCreatedDate(e.target.value)}
                />
              </div>
            </div>

            {/* Column 2: Vehicle & Services */}
            <div className="lead-edit-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 className="card-subheading">
                  <Car size={16} /> Vehicle & Services
                </h4>
                <button
                  type="button"
                  className="btn-reset-filters"
                  onClick={handleResetFilters}
                  title="Reset vehicle & service filters"
                >
                  <RotateCcw size={12} /> Reset Filters
                </button>
              </div>

              <div className="lead-field-row">
                <div className="lead-field-group">
                  <label htmlFor="leadCarBrandInput">Car Brand</label>
                  <input
                    id="leadCarBrandInput"
                    list="leadBrandOptions"
                    className="lead-input"
                    value={carBrand}
                    placeholder="Type or select brand..."
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onChange={(e) => setCarBrand(e.target.value)}
                  />
                  <datalist id="leadBrandOptions">
                    {filteredBrands.map((b) => (
                      <option key={b} value={b} />
                    ))}
                  </datalist>
                </div>

                <div className="lead-field-group">
                  <label htmlFor="leadCarModelInput">Car Model</label>
                  <input
                    id="leadCarModelInput"
                    list="leadModelOptions"
                    className="lead-input"
                    value={carModel}
                    placeholder="Type or select model..."
                    onFocus={(e) => e.target.select()}
                    onClick={(e) => (e.target as HTMLInputElement).select()}
                    onChange={(e) => handleModelChange(e.target.value)}
                  />
                  <datalist id="leadModelOptions">
                    {filteredModels.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="lead-field-row">
                <div className="lead-field-group">
                  <label>Fuel Type</label>
                  <select
                    className="lead-select"
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                  >
                    <option value="">Any Fuel</option>
                    <option value="Petrol">Petrol</option>
                    <option value="Diesel">Diesel</option>
                    <option value="CNG">CNG</option>
                    <option value="Electric">Electric</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>

                <div className="lead-field-group">
                  <label>Year Filter</label>
                  <input
                    type="text"
                    className="lead-input"
                    value={customYear}
                    onChange={(e) => setCustomYear(e.target.value)}
                    placeholder="e.g. 2020"
                  />
                </div>
              </div>

              <div className="lead-field-group">
                <label>Number Plate</label>
                <input
                  type="text"
                  className="lead-input"
                  value={numberPlate}
                  onChange={(e) => setNumberPlate(e.target.value)}
                  placeholder="e.g. MH12AB1234"
                />
              </div>

              <div className="lead-field-group">
                <label>Service Type</label>
                <div className="service-pills">
                  <button
                    type="button"
                    className={`service-pill ${(Array.isArray(serviceType) && serviceType.includes('Service')) ? 'active-teal' : ''}`}
                    onClick={() => {
                      setServiceType(prev => {
                        const arr = Array.isArray(prev) ? prev : [];
                        return arr.includes('Service') ? arr.filter(s => s !== 'Service') : [...arr, 'Service'];
                      });
                    }}
                  >
                    🛠️ Service
                  </button>

                  <button
                    type="button"
                    className={`service-pill ${(Array.isArray(serviceType) && serviceType.includes('Painting/Denting')) ? 'active-vip' : ''}`}
                    onClick={() => {
                      setServiceType(prev => {
                        const arr = Array.isArray(prev) ? prev : [];
                        return arr.includes('Painting/Denting') ? arr.filter(s => s !== 'Painting/Denting') : [...arr, 'Painting/Denting'];
                      });
                    }}
                  >
                    🎨 Painting/Denting
                  </button>
                </div>
              </div>

              <div className="lead-flags-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isVip}
                    onChange={(e) => setIsVip(e.target.checked)}
                  />
                  <span>VIP Customer</span>
                </label>

                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={whatsappBroadcast}
                    onChange={(e) => setWhatsappBroadcast(e.target.checked)}
                  />
                  <span>WhatsApp Broadcast</span>
                </label>
              </div>
            </div>

            {/* Column 3: Lead Status & Actions */}
            <div className="lead-edit-card">
              <h4 className="card-subheading">
                <ShieldAlert size={16} /> Lead Stage & Notes
              </h4>

              <div className="lead-field-row">
                <div className="lead-field-group">
                  <label>Priority</label>
                  <select
                    className="lead-select"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Priority)}
                  >
                    <option value="High">🔴 High Priority</option>
                    <option value="Medium">🟡 Medium Priority</option>
                    <option value="Low">🟢 Low Priority</option>
                  </select>
                </div>

                <div className="lead-field-group">
                  <label>Lead Stage</label>
                  <select
                    className="lead-select"
                    value={leadType}
                    onChange={(e) => {
                      const newStage = e.target.value as LeadType;
                      setLeadType(newStage);
                      const todayStr = new Date().toISOString().split('T')[0];
                      if (newStage === 'Booked') {
                        setBookingDateTime(todayStr);
                        setNextFollowUpDate(todayStr);
                      } else if (newStage === 'Retarget') {
                        setNextFollowUpDate(todayStr);
                      } else {
                        setRetargetTimeSlot(null);
                      }
                    }}
                  >
                    {['Fresh Lead', 'Call Not Received', 'Details Shared', 'Shared Quotation', 'Retarget', 'Booked', 'Completed', 'Lost'].map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>

              {leadType === 'Retarget' && (
                <div className="lead-field-group">
                  <label>Time Slot</label>
                  <div className="slot-buttons">
                    <button
                      type="button"
                      className={`slot-btn ${retargetTimeSlot === 'morning' ? 'active' : ''}`}
                      onClick={() => setRetargetTimeSlot(retargetTimeSlot === 'morning' ? null : 'morning')}
                    >
                      ☀️ Morning
                    </button>
                    <button
                      type="button"
                      className={`slot-btn ${retargetTimeSlot === 'evening' ? 'active' : ''}`}
                      onClick={() => setRetargetTimeSlot(retargetTimeSlot === 'evening' ? null : 'evening')}
                    >
                      🌙 Evening
                    </button>
                  </div>
                </div>
              )}

              {leadType === 'Booked' ? (
                <div className="lead-field-group">
                  <label>Booking Date</label>
                  <input
                    type="date"
                    className="lead-input"
                    value={bookingDateTime}
                    onChange={(e) => {
                      setBookingDateTime(e.target.value);
                      setNextFollowUpDate(e.target.value);
                    }}
                  />
                </div>
              ) : (
                <div className="lead-field-group">
                  <label>Next Follow-Up Date</label>
                  <input
                    type="date"
                    className="lead-input"
                    value={nextFollowUpDate}
                    onChange={(e) => setNextFollowUpDate(e.target.value)}
                  />
                </div>
              )}

              {leadType === 'Booked' && (
                <div className="booking-subcard">
                  <h5>Booking Details</h5>
                  <div className="lead-field-row">
                    <div className="lead-field-group">
                      <label>Type</label>
                      <select
                        className="lead-select"
                        value={bookingType || ''}
                        onChange={(e) => setBookingType(e.target.value as BookingType)}
                      >
                        <option value="">Select...</option>
                        <option value="Pickup">Pickup</option>
                        <option value="Garage Visit">Garage Visit</option>
                      </select>
                    </div>

                    <div className="lead-field-group">
                      <label>Garage</label>
                      <select
                        className="lead-select"
                        value={garageAssigned}
                        onChange={(e) => setGarageAssigned(e.target.value)}
                      >
                        <option value="">Select Garage...</option>
                        {garageList.map(g => (
                          <option key={g.id} value={g.name}>{g.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="lead-field-group">
                <label>Notes & History</label>
                <textarea
                  className="lead-textarea"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this customer..."
                />
              </div>
            </div>
          </div>

          <div className="lead-edit-footer">
            {saveStatus && (
              <span className={`save-status-msg ${saveStatus.includes('✅') ? 'success' : 'error'}`}>
                {saveStatus}
              </span>
            )}
            <button type="submit" className="btn-save-lead" disabled={isSaving}>
              <Save size={16} />
              {isSaving ? 'Saving Changes...' : 'Save Lead Changes'}
            </button>
          </div>
        </form>
      ) : (
        <div className="lead-edit-empty">
          <Sparkles size={24} />
          <p>Click any lead in your CRM (Leads, Reminders, Kanban) or select one above to edit lead details here.</p>
        </div>
      )}
    </div>
  );
};

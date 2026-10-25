import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Lead } from '../types';
import { useLeadContext } from '../store/LeadContext';
import { MapView } from './vehicleSpecs/MapView';
import { GarageSheet } from './vehicleSpecs/GarageSheet';
import { SelectedCarCard } from './vehicleSpecs/SelectedCarCard';
import { LeadEditPanel } from './vehicleSpecs/LeadEditPanel';
import './vehicleSpecs/VehicleSpecs.css';
import './EditLeadModal.css';

interface EditLeadModalProps {
  isOpen: boolean;
  lead: Lead | null;
  onClose: () => void;
  onSaveSuccess?: () => void;
}

export const EditLeadModal: React.FC<EditLeadModalProps> = ({
  isOpen,
  lead,
  onClose,
  onSaveSuccess,
}) => {
  const { leads, updateLead, getGarageList } = useLeadContext();
  const [address, setAddress] = useState('');
  const [garages, setGarages] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [origin, setOrigin] = useState<any>(null);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [userNote, setUserNote] = useState('');
  const [resetKey] = useState(0);
  const [garageList, setGarageList] = useState<{ id: string; name: string }[]>([]);
  const [selectedPlanInfo, setSelectedPlanInfo] = useState<{ name: string; price: string | number } | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      getGarageList()
        .then((res) => setGarageList(res || []))
        .catch((err) => console.error('Error fetching garage list in EditLeadModal:', err));
    }
  }, [isOpen, getGarageList]);

  useEffect(() => {
    if (lead && lead.notes) {
      setUserNote(lead.notes);

      const matchAddress = lead.notes.match(/Address:\s*([^\n]+)/i);
      if (matchAddress && matchAddress[1] && matchAddress[1].trim()) {
        setAddress(matchAddress[1].trim());
      } else {
        setAddress('');
      }

      const matchPlan = lead.notes.match(/Selected Service Plan:\s*(Lite|Basic|Pro)\s*Plan\s*\(₹?\s*(\d+)\)/i);
      if (matchPlan && matchPlan[1] && matchPlan[2]) {
        setSelectedPlanInfo({ name: matchPlan[1], price: matchPlan[2] });
      } else {
        setSelectedPlanInfo(null);
      }
    } else {
      setAddress('');
      setSelectedPlanInfo(null);
    }
  }, [lead?.id, lead?.notes]);

  if (!isOpen || !lead) return null;

  const selectedGarageObject =
    garages?.find((g) => `${g.garage_name}-${g.lat}` === selected) || null;

  return createPortal(
    <div className="edit-lead-modal-overlay" onClick={onClose}>
      <div className="edit-lead-modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="edit-lead-modal-header">
          <h3 className="edit-lead-modal-title">
            Edit Lead: {lead.customerName || lead.identifier || 'Lead Details'}
          </h3>
          <button
            type="button"
            className="edit-lead-modal-close"
            onClick={onClose}
            title="Close edit modal"
          >
            <X size={20} />
          </button>
        </div>

        <div className="edit-lead-modal-body vehicle-specs-wrapper">
          <div className="app">
            <section className="hero">
              <MapView
                origin={origin}
                garages={garages || []}
                activeId={selected}
                isCollapsed={false}
              />
              <div className="map-veil" />

              <div className="hero-ui">
                <div className="hero-columns">
                  <div className="sheet-wrap">
                    <GarageSheet
                      address={address}
                      setAddress={setAddress}
                      garages={garages}
                      setGarages={setGarages}
                      selected={selected}
                      setSelected={setSelected}
                      onResults={(nextOrigin, nextGarages) => {
                        setOrigin(nextOrigin);
                        if (nextGarages?.length) setGarages(nextGarages);
                      }}
                    />
                  </div>

                  <div className="selected-car-wrap">
                    <SelectedCarCard
                      car={selectedCar}
                      selectedGarage={selectedGarageObject}
                      note={userNote}
                      setNote={setUserNote}
                      resetKey={resetKey}
                      selectedPlanName={selectedPlanInfo?.name}
                      onSelectPlan={(planInfo) => setSelectedPlanInfo(planInfo)}
                      onTargetDateChange={(d) => setTargetDate(d)}
                    />
                  </div>
                </div>
              </div>
            </section>

            <div>
              <LeadEditPanel
                activeLead={lead}
                allLeads={leads}
                onSelectLead={() => {}}
                onSaveLead={async (updatedLead) => {
                  await updateLead(updatedLead);
                  if (onSaveSuccess) onSaveSuccess();
                  onClose();
                }}
                garageList={garageList}
                onSelectCar={(car) => setSelectedCar(car)}
                carMode="all"
                searchedAddress={address}
                selectedPlanInfo={selectedPlanInfo}
                targetDate={targetDate}
              />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

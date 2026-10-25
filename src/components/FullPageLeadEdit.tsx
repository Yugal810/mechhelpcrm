import React, { useState, useEffect, useRef } from "react";
import { MapView } from "./vehicleSpecs/MapView";
import { GarageSheet } from "./vehicleSpecs/GarageSheet";
import { SelectedCarCard } from "./vehicleSpecs/SelectedCarCard";
import { SettingsPage } from "./vehicleSpecs/SettingsPage";
import { LeadEditPanel } from "./vehicleSpecs/LeadEditPanel";
import { useLeadContext } from "../store/LeadContext";
import "./vehicleSpecs/VehicleSpecs.css";
import type { Lead } from "../types";
import { ArrowLeft } from "lucide-react";

interface FullPageLeadEditProps {
  lead: Lead | null;
  onClose: () => void;
}

const getTodayYmd = (): string => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getTomorrowYmd = (): string => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const BLANK_LEAD: Lead = {
  id: '',
  customerName: '',
  leadSource: 'SalesIQ',
  salesperson: 'Nothing',
  identifier: '',
  carBrand: '',
  carModel: '',
  priority: 'Medium',
  leadType: 'Fresh Lead',
  garageNotified: false,
  nextFollowUpDate: getTomorrowYmd(),
  lastContactedDate: getTodayYmd(),
  isVip: false,
  whatsappBroadcast: false,
  notes: '',
  createdDate: getTodayYmd(),
};

export const FullPageLeadEdit: React.FC<FullPageLeadEditProps> = ({ lead, onClose }) => {
  const { leads, addLead, updateLead, getGarageList, setIsEditingLead } = useLeadContext();
  const isNewLead = !lead || !lead.id;

  const [page, setPage] = useState<"dashboard" | "settings">("dashboard");
  const [address, setAddress] = useState("");
  const [garages, setGarages] = useState<any[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [origin, setOrigin] = useState<any>(null);
  const [selectedCar, setSelectedCar] = useState<any>(null);
  const [userNote, setUserNote] = useState("");
  const [carMode] = useState<string>("all");
  const [resetKey, setResetKey] = useState(0);
  const [garageList, setGarageList] = useState<{ id: string; name: string }[]>([]);

  const [selectedPlanInfo, setSelectedPlanInfo] = useState<{ name: string; price: string | number } | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');

  const editPanelSectionRef = useRef<HTMLDivElement>(null);

  // Keep track of active lead (refreshing from context if updated), or blank template for new lead
  const activeLead = isNewLead ? BLANK_LEAD : (leads && lead?.id ? (leads.find((l) => l.id === lead.id) || lead) : lead!);

  // Toggle global isEditingLead flag to hide sticky header stat cards
  useEffect(() => {
    if (setIsEditingLead) {
      setIsEditingLead(true);
      return () => setIsEditingLead(false);
    }
  }, [setIsEditingLead]);

  useEffect(() => {
    if (getGarageList) {
      getGarageList()
        .then((res) => setGarageList(res || []))
        .catch((err) => console.error("Error fetching garage list:", err));
    }
  }, [getGarageList]);

  // Extract address and selected plan from lead notes on load
  useEffect(() => {
    if (activeLead && activeLead.notes) {
      setUserNote(activeLead.notes);

      const matchAddress = activeLead.notes.match(/Address:\s*([^\n]+)/i);
      if (matchAddress && matchAddress[1] && matchAddress[1].trim()) {
        setAddress(matchAddress[1].trim());
      } else {
        setAddress("");
      }

      const matchPlan = activeLead.notes.match(/Selected Service Plan:\s*(Lite|Basic|Pro)\s*Plan\s*\(₹?\s*(\d+)\)/i);
      if (matchPlan && matchPlan[1] && matchPlan[2]) {
        setSelectedPlanInfo({ name: matchPlan[1], price: matchPlan[2] });
      } else {
        setSelectedPlanInfo(null);
      }
    } else {
      setAddress("");
      setSelectedPlanInfo(null);
    }
  }, [activeLead?.id, activeLead?.notes]);

  // Scroll cleanly to top on mount
  useEffect(() => {
    try {
      window.scrollTo(0, 0);
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        pageContainer.scrollTop = 0;
      }
    } catch (e) {
      console.error("Scroll error:", e);
    }
  }, [activeLead?.id]);

  const selectedGarageObject =
    garages?.find((g) => `${g.garage_name}-${g.lat}` === selected) || null;

  if (page === "settings") {
    return (
      <div className="vehicle-specs-wrapper">
        <div className="app app-settings-view">
          <SettingsPage onBack={() => setPage("dashboard")} />
        </div>
      </div>
    );
  }

  return (
    <div className="vehicle-specs-wrapper animate-fade-in" style={{ margin: "-2rem -2.5rem -2rem -2.5rem", width: "calc(100% + 5rem)", minHeight: "calc(100vh - 0px)" }}>
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
            <header className="brand-bar" style={{ justifyContent: 'flex-end' }}>
              <div className="header-actions" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onClose}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, padding: '0.5rem 1rem' }}
                  title="Close edit view and return"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  type="button"
                  className="btn-settings-header"
                  onClick={() => setPage("settings")}
                  title="Open Garage Management Settings"
                >
                  Settings
                </button>
              </div>
            </header>

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

        <div ref={editPanelSectionRef}>
          <LeadEditPanel
            activeLead={activeLead}
            allLeads={leads}
            onSelectLead={() => {}}
            onSaveLead={async (updatedLead) => {
              if (isNewLead) {
                const { id: _id, createdDate: _cd, bookingHistory: _bh, activityHistory: _ah, ...newLeadData } = updatedLead as any;
                await addLead(newLeadData);
              } else {
                await updateLead(updatedLead);
              }
              setTimeout(() => {
                onClose();
              }, 800);
            }}
            garageList={garageList}
            onSelectCar={(car) => setSelectedCar(car)}
            carMode={carMode}
            searchedAddress={address}
            selectedPlanInfo={selectedPlanInfo}
            targetDate={targetDate}
          />
        </div>
      </div>
    </div>
  );
};

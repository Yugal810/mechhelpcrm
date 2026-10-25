import React, { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MapView } from "../components/vehicleSpecs/MapView";
import { GarageSheet } from "../components/vehicleSpecs/GarageSheet";
import { SelectedCarCard } from "../components/vehicleSpecs/SelectedCarCard";
import { SettingsPage } from "../components/vehicleSpecs/SettingsPage";
import { LeadEditPanel } from "../components/vehicleSpecs/LeadEditPanel";
import { useLeadContext } from "../store/LeadContext";
import "../components/vehicleSpecs/VehicleSpecs.css";

export const VehicleSpecs: React.FC = () => {
  const { leads, updateLead, getGarageList } = useLeadContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

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

  const leadId = searchParams.get("leadId");
  const activeLead = leads.find((l) => l.id === leadId) || null;

  useEffect(() => {
    getGarageList()
      .then((res) => setGarageList(res || []))
      .catch((err) => console.error("Error fetching garage list:", err));
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

  // Auto scroll down to Edit Panel when leadId is present
  useEffect(() => {
    if (leadId && editPanelSectionRef.current) {
      const timer = setTimeout(() => {
        editPanelSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [leadId]);

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
    <div className="vehicle-specs-wrapper">
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
              <div className="header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button
                  type="button"
                  className="btn-settings-header"
                  onClick={() => navigate(-1)}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  title="Close edit page and go back"
                >
                  ← Back
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
            onSelectLead={(id) => {
              if (id) {
                setSearchParams({ leadId: id });
              } else {
                setSearchParams({});
              }
            }}
            onSaveLead={async (updatedLead) => {
              await updateLead(updatedLead);
              if (leadId) {
                setTimeout(() => {
                  navigate(-1);
                }, 800);
              }
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

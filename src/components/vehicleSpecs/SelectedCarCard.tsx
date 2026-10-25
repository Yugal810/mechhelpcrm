import React, { useState, useEffect } from "react";

function formatDateToYYYYMMDD(dateObj: Date | null) {
  if (!dateObj || isNaN(dateObj.getTime())) return "";
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface SelectedCarCardProps {
  car: any;
  selectedGarage: any;
  note?: string;
  setNote?: (val: string) => void;
  resetKey: number;
  selectedPlanName?: string | null;
  onSelectPlan?: (planInfo: { name: string; price: string | number } | null) => void;
  onTargetDateChange?: (date: string) => void;
}

export const SelectedCarCard: React.FC<SelectedCarCardProps> = ({
  car,
  selectedGarage,
  note,
  setNote,
  resetKey,
  selectedPlanName,
  onSelectPlan,
  onTargetDateChange,
}) => {
  const [bookingDate, setBookingDate] = useState("");
  const [months, setMonths] = useState("");
  const [weeks, setWeeks] = useState("");
  const [days, setDays] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const garageDisplayName =
    typeof selectedGarage === "object" && selectedGarage !== null
      ? selectedGarage.garage_name || selectedGarage.name || "n/a"
      : selectedGarage || "n/a";

  useEffect(() => {
    if (onTargetDateChange) {
      onTargetDateChange(bookingDate);
    }
  }, [bookingDate, onTargetDateChange]);

  useEffect(() => {
    if (selectedPlanName !== undefined) {
      setSelectedPlan(selectedPlanName);
    }
  }, [selectedPlanName]);

  useEffect(() => {
    setBookingDate("");
    setMonths("");
    setWeeks("");
    setDays("");
  }, [car?.id, car?.brand, car?.model, resetKey]);

  const handleTogglePlan = (planName: string, planPrice: string | number) => {
    const nextPlan = selectedPlan === planName ? null : planName;
    setSelectedPlan(nextPlan);
    if (onSelectPlan) {
      onSelectPlan(nextPlan ? { name: planName, price: planPrice } : null);
    }
  };

  function handleOffsetChange(type: string, value: string) {
    const nextMonths = type === "months" ? value : months;
    const nextWeeks = type === "weeks" ? value : weeks;
    const nextDays = type === "days" ? value : days;

    if (type === "months") setMonths(value);
    if (type === "weeks") setWeeks(value);
    if (type === "days") setDays(value);

    const m = Math.max(0, parseInt(nextMonths, 10) || 0);
    const w = Math.max(0, parseInt(nextWeeks, 10) || 0);
    const d = Math.max(0, parseInt(nextDays, 10) || 0);

    if (m === 0 && w === 0 && d === 0) {
      setBookingDate("");
      return;
    }

    const target = new Date();
    if (m > 0) target.setMonth(target.getMonth() + m);
    if (w > 0) target.setDate(target.getDate() + w * 7);
    if (d > 0) target.setDate(target.getDate() + d);

    setBookingDate(formatDateToYYYYMMDD(target));
  }

  const litePrice = car?.mech_lite || car?.["mech lite"] || car?.mechLite;
  const basicPrice = car?.mech_basic || car?.["mech basic"] || car?.mechBasic;
  const proPrice = car?.mech_pro || car?.["mech pro"] || car?.mechPro;
  const hasPricing = litePrice || basicPrice || proPrice;

  return (
    <div className="selected-car-card">
      {car ? (
        <div className="selected-car-body">
          <div className="selected-car-top-bar">
            <div className="car-main-info">
              <span className="selected-car-subtitle">Selected Vehicle</span>
              <h4 className="car-title">
                {car.brand} {car.model}{car.userYear ? ` ${car.userYear}` : ""}
              </h4>
            </div>

            <div className="spec-stats inline-stats">
              <div className="spec-stat">
                <small>Fuel</small>
                <strong>{car.fuelType || car.fuel || car.fueltype || "—"}</strong>
              </div>
              <div className="spec-stat">
                <small>Oil capacity</small>
                <strong>
                  {car.oil_capacity || car["oil capacity (l)"] || car.oilCapacity || "—"}
                  {car.oil_capacity || car["oil capacity (l)"] || car.oilCapacity ? " L" : ""}
                </strong>
              </div>
            </div>
          </div>

          {hasPricing && (
            <div className="pricing-plans-section inline-pricing">
              <div className="plans-header-label">Service Plans</div>
              <div className="pricing-plans-grid">
                <div
                  className={`plan-chip plan-lite ${selectedPlan === "Lite" ? "is-selected" : ""}`}
                  onClick={() => handleTogglePlan("Lite", litePrice)}
                  role="button"
                  tabIndex={0}
                  title="Click to select Lite plan"
                >
                  <span className="plan-badge">Lite</span>
                  <span className="plan-amount">₹{litePrice}</span>
                </div>
                <div
                  className={`plan-chip plan-basic ${selectedPlan === "Basic" ? "is-selected" : ""}`}
                  onClick={() => handleTogglePlan("Basic", basicPrice)}
                  role="button"
                  tabIndex={0}
                  title="Click to select Basic plan"
                >
                  <span className="plan-badge">Basic</span>
                  <span className="plan-amount">₹{basicPrice}</span>
                </div>
                <div
                  className={`plan-chip plan-pro ${selectedPlan === "Pro" ? "is-selected" : ""}`}
                  onClick={() => handleTogglePlan("Pro", proPrice)}
                  role="button"
                  tabIndex={0}
                  title="Click to select Pro plan"
                >
                  <span className="plan-badge">Pro</span>
                  <span className="plan-amount">₹{proPrice}</span>
                </div>
              </div>
            </div>
          )}

          {selectedGarage && (
            <div className="selected-garage-line">
              <span className="garage-label">Garage:</span>
              <strong className="garage-val">{garageDisplayName}</strong>
            </div>
          )}

          <div className="reminder-section">
            <span className="reminder-section-label">Set Reminder</span>
            <div className="reminder-inputs-grid">
              <div className="reminder-field" title="Months from now">
                <input
                  type="number"
                  min="0"
                  max="48"
                  placeholder="0"
                  value={months}
                  onChange={(e) => handleOffsetChange("months", e.target.value)}
                  aria-label="Months reminder"
                />
                <span>Months</span>
              </div>
              <div className="reminder-field" title="Weeks from now">
                <input
                  type="number"
                  min="0"
                  max="52"
                  placeholder="0"
                  value={weeks}
                  onChange={(e) => handleOffsetChange("weeks", e.target.value)}
                  aria-label="Weeks reminder"
                />
                <span>Weeks</span>
              </div>
              <div className="reminder-field" title="Days from now">
                <input
                  type="number"
                  min="0"
                  max="365"
                  placeholder="0"
                  value={days}
                  onChange={(e) => handleOffsetChange("days", e.target.value)}
                  aria-label="Days reminder"
                />
                <span>Days</span>
              </div>
            </div>

            <div className="reminder-date-preview">
              <span className="preview-label">Target Date</span>
              <div
                className="calendar-picker-wrap"
                title="Click to select reminder date"
                onClick={(e) => {
                  const input = e.currentTarget.querySelector("input[type='date']") as HTMLInputElement | null;
                  if (input && typeof (input as any).showPicker === "function") {
                    try {
                      (input as any).showPicker();
                    } catch (err) { }
                  }
                }}
              >
                <input
                  type="date"
                  className="booking-date-input"
                  value={bookingDate}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof (e.target as any).showPicker === "function") {
                      try {
                        (e.target as any).showPicker();
                      } catch (err) { }
                    }
                  }}
                  onChange={(e) => {
                    setBookingDate(e.target.value);
                    setMonths("");
                    setWeeks("");
                    setDays("");
                  }}
                  aria-label="Booking reminder date"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="selected-car-empty">
          <p>No vehicle selected yet.</p>
          <small>
            Filter vehicles below and click on the top matched car to select it here.
          </small>
        </div>
      )}
    </div>
  );
};

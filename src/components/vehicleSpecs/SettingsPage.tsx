import React, { useEffect, useState } from "react";
import {
  fetchGarages,
  createGarage,
  toggleGarageStatus,
} from "./api";

interface SettingsPageProps {
  onBack: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  const [garages, setGarages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    garage_name: "",
    address: "",
    contact: "",
    lat: "",
    lon: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadGarages();
  }, []);

  async function loadGarages() {
    try {
      setLoading(true);
      const data = await fetchGarages();
      if (Array.isArray(data)) {
        setGarages(data);
        setError(null);
      } else {
        setGarages([]);
      }
    } catch (err: any) {
      console.error("Failed to load partner garages from MongoDB:", err);
      setGarages([]);
      setError("Could not load partner garages from MongoDB database.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.garage_name.trim()) {
      setError("Garage name is required.");
      return;
    }
    if (!form.lat.trim() || !form.lon.trim()) {
      setError("Latitude and Longitude are required.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await createGarage(form);
      setMessage("Garage added successfully and saved to database!");
      setForm({ garage_name: "", address: "", contact: "", lat: "", lon: "" });
      await loadGarages();
      setTimeout(() => setMessage(null), 4000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Failed to add garage.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(id: string) {
    try {
      setError(null);
      await toggleGarageStatus(id);
      setGarages((prev) =>
        prev.map((g) => (g.id === id ? { ...g, enabled: !g.enabled } : g))
      );
    } catch (err) {
      console.error(err);
      setError("Failed to update garage status in database.");
    }
  }

  const filteredGarages = (garages || []).filter((g) => {
    if (!g) return false;
    const name = String(g.garage_name || g.name || "").toLowerCase();
    const addr = String(g.address || "").toLowerCase();
    const cont = String(g.contact || "").toLowerCase();
    const s = (search || "").toLowerCase().trim();
    return name.includes(s) || addr.includes(s) || cont.includes(s);
  });

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <div className="settings-title-row">
            <h2>Garage Management & Settings</h2>
            <span className="db-badge">Database Sync</span>
          </div>
          <p className="settings-sub">
            Add new partner garages or toggle availability. Disabled garages are
            automatically excluded from distance calculations.
          </p>
        </div>
        <button type="button" className="btn-back" onClick={onBack}>
          ← Back to Map
        </button>
      </header>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="settings-grid">
        <div className="settings-card form-card">
          <h3>Add New Partner Garage</h3>
          <p className="card-desc">
            Saves directly to <code>MongoDB Database</code>
          </p>

          <form onSubmit={handleSubmit} className="garage-form">
            <div className="form-group">
              <label htmlFor="gName">Garage Name *</label>
              <input
                id="gName"
                type="text"
                placeholder="e.g. Apex Auto Works"
                value={form.garage_name}
                onChange={(e) =>
                  setForm({ ...form, garage_name: e.target.value })
                }
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="gAddress">Address *</label>
              <input
                id="gAddress"
                type="text"
                placeholder="e.g. Plot 45, West High Court Road, Dharampeth"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="gLat">Latitude *</label>
                <input
                  id="gLat"
                  type="text"
                  placeholder="21.1458"
                  value={form.lat}
                  onChange={(e) => setForm({ ...form, lat: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="gLon">Longitude *</label>
                <input
                  id="gLon"
                  type="text"
                  placeholder="79.0882"
                  value={form.lon}
                  onChange={(e) => setForm({ ...form, lon: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="gContact">Contact Number</label>
              <input
                id="gContact"
                type="text"
                placeholder="e.g. 9823012345"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn-primary-block"
              disabled={submitting}
            >
              {submitting ? "Saving to Database..." : "+ Add Garage to Database"}
            </button>
          </form>
        </div>

        <div className="settings-card list-card">
          <div className="list-header">
            <div>
              <h3>Partner Garages ({garages.length})</h3>
              <p className="card-desc">Toggle switch to enable/disable garages</p>
            </div>
            <input
              type="text"
              className="search-input"
              placeholder="Filter garages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="loading-state">Loading Database records...</div>
          ) : (
            <div className="table-responsive">
              <table className="garage-table">
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Garage Name</th>
                    <th>Address</th>
                    <th>Contact</th>
                    <th>Coordinates</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredGarages.map((g, idx) => {
                    const isEnabled =
                      g.enabled !== false &&
                      g.is_enabled !== false &&
                      g.is_active !== false;
                    const garageId = g.id || g._id || String(idx);
                    const name = g.garage_name || g.name || "Unnamed Garage";
                    const addr = g.address || "—";
                    const cont = g.contact || "—";
                    const latVal =
                      typeof g.lat === "number" ? g.lat.toFixed(4) : g.lat || "—";
                    const lonVal =
                      typeof g.lon === "number" ? g.lon.toFixed(4) : g.lon || "—";

                    return (
                      <tr
                        key={garageId}
                        className={isEnabled ? "row-enabled" : "row-disabled"}
                      >
                        <td>
                          <label
                            className="toggle-switch"
                            title={
                              isEnabled
                                ? "Enabled: included in distance search"
                                : "Disabled: excluded from distance search"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={() => handleToggle(garageId)}
                            />
                            <span className="slider round" />
                          </label>
                        </td>
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start" }}>
                            <strong className="garage-title-text">{name}</strong>
                            <span
                              className={`status-pill ${
                                isEnabled ? "active" : "inactive"
                              }`}
                            >
                              {isEnabled ? "Active in Search" : "Disabled"}
                            </span>
                          </div>
                        </td>
                        <td className="text-muted">{addr}</td>
                        <td className="text-muted">{cont}</td>
                        <td className="coords-cell">
                          <code>
                            {latVal}, {lonVal}
                          </code>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

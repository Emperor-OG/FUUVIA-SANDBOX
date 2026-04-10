import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/StoreInfo.css";

export default function StoreInfo({ store, onClose }) {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState("delivery");

  const [selections, setSelections] = useState({});
  const [nationwide, setNationwide] = useState(false);
  const [nationwideFee, setNationwideFee] = useState("");
  const [nationwideEst, setNationwideEst] = useState("");

  const [dropoff, setDropoff] = useState([]);
  const [schedule, setSchedule] = useState({});

  const API_BASE = import.meta.env.VITE_API_URL || "";

  const days = useMemo(
    () => [
      { key: "monday", label: "Monday" },
      { key: "tuesday", label: "Tuesday" },
      { key: "wednesday", label: "Wednesday" },
      { key: "thursday", label: "Thursday" },
      { key: "friday", label: "Friday" },
      { key: "saturday", label: "Saturday" },
      { key: "sunday", label: "Sunday" },
    ],
    []
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!store) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [store, onClose]);

  useEffect(() => {
    if (!store?.id) return;

    if (tab === "delivery") loadDelivery();
    if (tab === "dropoff") loadDropoff();
    if (tab === "schedule") loadSchedule();
  }, [store, tab]);

  async function loadDelivery() {
    try {
      const [provRes, savedRes] = await Promise.all([
        fetch(`${API_BASE}/api/provinces`),
        fetch(`${API_BASE}/api/${store.id}/delivery_locations`),
      ]);

      if (!provRes.ok || !savedRes.ok) throw new Error("Bad response");

      const provData = await provRes.json();
      const saved = await savedRes.json();
      const savedSelections = saved.selections || {};
      const hydrated = {};

      provData.forEach((prov) => {
        const savedProv = savedSelections[prov.id];
        hydrated[prov.id] = { id: prov.id, name: prov.name, cities: {} };

        prov.cities.forEach((city) => {
          const savedCity = savedProv?.cities?.[city.id];
          if (savedCity?.checked) {
            hydrated[prov.id].cities[city.id] = {
              id: city.id,
              name: city.name,
              fee: savedCity.fee ?? savedProv?.fee ?? "",
              est: savedCity.est ?? savedProv?.est ?? "",
            };
          }
        });
      });

      setSelections(hydrated);
      setNationwide(saved.store?.delivers_nationwide || false);
      setNationwideFee(saved.store?.nationwide_fee || "");
      setNationwideEst(saved.store?.nationwide_estimated_time || "");
    } catch (err) {
      console.error("Failed to load delivery:", err);
      setSelections({});
    }
  }

  async function loadDropoff() {
    try {
      const res = await fetch(`${API_BASE}/api/dropoff_locations?store_id=${store.id}`);
      const data = await res.json();
      setDropoff(data.locations || []);
    } catch (err) {
      console.error("Dropoff error:", err);
      setDropoff([]);
    }
  }

  async function loadSchedule() {
    try {
      const res = await fetch(`${API_BASE}/api/stores/storefront/${store.id}`);
      const data = await res.json();
      const s = data.store;
      const formatted = {};

      days.forEach(({ key, label }) => {
        formatted[label] = {
          open: s?.[`${key}_open`]?.slice(0, 5) || "Closed",
          close: s?.[`${key}_close`]?.slice(0, 5) || "Closed",
        };
      });

      setSchedule(formatted);
    } catch (err) {
      console.error("Schedule error:", err);
      setSchedule({});
    }
  }

  if (!store || !mounted) return null;

  return createPortal(
    <div className="storeinfo-root" role="dialog" aria-modal="true">
      <div className="storeinfo-overlay" onClick={onClose} />

      <div className="storeinfo-shell" onClick={(e) => e.stopPropagation()}>
        <div className="storeinfo-header">
          <h2>
            <i className="bx bx-store"></i>
            <span>{store?.store_name}</span>
          </h2>

          <button
            className="storeinfo-close-btn"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <i className="bx bx-x"></i>
          </button>
        </div>

        <div className="storeinfo-tabs-section">
          <button
            type="button"
            className={tab === "delivery" ? "active" : ""}
            onClick={() => setTab("delivery")}
          >
            <i className="bx bx-package"></i>
            <span>Delivery</span>
          </button>

          <button
            type="button"
            className={tab === "dropoff" ? "active" : ""}
            onClick={() => setTab("dropoff")}
          >
            <i className="bx bx-map-pin"></i>
            <span>Drop-off / Pick-up</span>
          </button>

          <button
            type="button"
            className={tab === "schedule" ? "active" : ""}
            onClick={() => setTab("schedule")}
          >
            <i className="bx bx-time-five"></i>
            <span>Schedule</span>
          </button>
        </div>

        <div className="storeinfo-body">
          {tab === "delivery" && (
            <div className="delivery-tree">
              {nationwide ? (
                <div className="nationwide-display">
                  <div className="nationwide-title">
                    <i className="bx bx-world"></i>
                    <span>Nationwide Delivery</span>
                  </div>

                  <div className="nationwide-meta">
                    <span>R{nationwideFee || "-"}</span>
                    <span>{nationwideEst || "-"}</span>
                  </div>
                </div>
              ) : Object.values(selections).filter((prov) => Object.keys(prov.cities).length > 0).length === 0 ? (
                <div className="empty-state">No delivery locations available</div>
              ) : (
                Object.values(selections)
                  .filter((prov) => Object.keys(prov.cities).length > 0)
                  .map((prov) => (
                    <div key={prov.id} className="province-card">
                      <div className="province-header">
                        <i className="bx bx-map"></i>
                        <strong>{prov.name}</strong>
                      </div>

                      <div className="city-list">
                        {Object.values(prov.cities).map((city) => (
                          <div key={city.id} className="city-row">
                            <span className="city-name">{city.name}</span>
                            <span className="city-fee">R{city.fee}</span>
                            <span className="city-est">{city.est}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
              )}
            </div>
          )}

          {tab === "dropoff" && (
            <table className="storeinfo-table-section">
              <thead>
                <tr>
                  <th>Province</th>
                  <th>Town</th>
                  <th>Postal Code</th>
                  <th>Street Address</th>
                  <th>Fee</th>
                  <th>Notes</th>
                </tr>
              </thead>

              <tbody>
                {dropoff.length === 0 ? (
                  <tr>
                    <td colSpan="6">No drop-off locations</td>
                  </tr>
                ) : (
                  dropoff.map((loc) => (
                    <tr key={loc.id}>
                      <td data-label="Province">{loc.province || "-"}</td>
                      <td data-label="Town">{loc.suburb || loc.city || "-"}</td>
                      <td data-label="Postal Code">{loc.postal_code || "-"}</td>
                      <td data-label="Street Address">{loc.street_address || "-"}</td>
                      <td data-label="Fee">R{loc.price ?? "-"}</td>
                      <td data-label="Notes">{loc.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {tab === "schedule" && (
            <table className="storeinfo-table-section">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Opening</th>
                  <th>Closing</th>
                </tr>
              </thead>

              <tbody>
                {days.map(({ key, label }) => (
                  <tr key={key}>
                    <td data-label="Day">{label}</td>
                    <td data-label="Opening">{schedule[label]?.open || "Closed"}</td>
                    <td data-label="Closing">{schedule[label]?.close || "Closed"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

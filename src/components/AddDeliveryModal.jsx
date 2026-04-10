import React, { useState, useEffect } from "react";
import "../styles/AddDeliveryModal.css";

const AddDeliveryModal = ({ storeId, isOpen, onClose }) => {
  const [provinces, setProvinces] = useState([]);
  const [selections, setSelections] = useState({});
  const [nationwide, setNationwide] = useState(false);
  const [nationwideFee, setNationwideFee] = useState("");
  const [nationwideEst, setNationwideEst] = useState("");

  const API_BASE = import.meta.env.VITE_API_URL || "";

  // ------------------------------
  // Load modal + hydrate
  // ------------------------------
  useEffect(() => {
    if (!isOpen || !storeId) return;

    const loadData = async () => {
      try {
        const [provRes, savedRes] = await Promise.all([
          fetch(`${API_BASE}/api/provinces`),
          fetch(`${API_BASE}/api/${storeId}/delivery_locations`),
        ]);

        const provData = await provRes.json();
        const saved = await savedRes.json();
        const savedSelections = saved.selections || {};

        const hydratedSelections = {};

        provData.forEach((prov) => {
          const savedProv = savedSelections[prov.id];

          hydratedSelections[prov.id] = {
            checked: savedProv?.checked || false,
            fee: savedProv?.fee ?? "",
            est: savedProv?.est ?? "",
            cities: {},
          };

          prov.cities.forEach((city) => {
            const savedCity = savedProv?.cities?.[city.id];

            hydratedSelections[prov.id].cities[city.id] = {
              checked: savedCity?.checked || false,
              fee: savedCity?.fee ?? savedProv?.fee ?? "",
              est: savedCity?.est ?? savedProv?.est ?? "",
            };
          });
        });

        setProvinces(provData);
        setSelections(hydratedSelections);

        setNationwide(saved.store?.delivers_nationwide || false);
        setNationwideFee(saved.store?.nationwide_fee || "");
        setNationwideEst(saved.store?.nationwide_estimated_time || "");
      } catch (err) {
        console.error("Failed to load delivery modal:", err);
      }
    };

    loadData();
  }, [isOpen, storeId, API_BASE]);

  // ------------------------------
  // Toggle province
  // ------------------------------
  const toggleProvince = (provId) => {
    if (nationwide) return;

    setSelections((prev) => {
      const next = { ...prev };
      const newChecked = !next[provId].checked;

      next[provId].checked = newChecked;

      Object.keys(next[provId].cities).forEach((cid) => {
        next[provId].cities[cid].checked = newChecked;
      });

      return next;
    });
  };

  // ------------------------------
  // Toggle city
  // ------------------------------
  const toggleCity = (provId, cityId) => {
    if (nationwide) return;

    setSelections((prev) => {
      const next = { ...prev };

      next[provId].cities[cityId].checked =
        !next[provId].cities[cityId].checked;

      next[provId].checked = Object.values(next[provId].cities).some(
        (c) => c.checked
      );

      return next;
    });
  };

  // ------------------------------
  // Handle fee / est changes
  // ------------------------------
  const handleChange = (provId, cityId, field, value) => {
    if (nationwide) return;

    setSelections((prev) => {
      const next = { ...prev };

      if (cityId) {
        next[provId].cities[cityId][field] = value;
      } else {
        const oldProvValue = next[provId][field];
        next[provId][field] = value;

        Object.keys(next[provId].cities).forEach((cid) => {
          const city = next[provId].cities[cid];

          if (!city[field] || city[field] === oldProvValue) {
            city[field] = value;
          }
        });
      }

      return next;
    });
  };

  // ------------------------------
  // Save delivery
  // ------------------------------
  const handleSave = async () => {
    try {
      const locations = [];

      Object.entries(selections).forEach(([provId, prov]) => {
        Object.entries(prov.cities).forEach(([cityId, city]) => {
          if (city.checked) {
            locations.push({
              province_id: Number(provId),
              city_id: Number(cityId),
              fee: city.fee || prov.fee || 0,
              est: city.est || prov.est || "",
            });
          }
        });
      });

      const res = await fetch(`${API_BASE}/api/${storeId}/delivery/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          nationwide,
          nationwideFee,
          nationwideEst,
          locations,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      onClose();
    } catch (err) {
      console.error("Save failed:", err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay show" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <span className="close-delivery-btn" onClick={onClose}>
          &times;
        </span>

        <h2>Delivery Locations</h2>

        {/* Nationwide */}
        <div className="nationwide-row">
          <label>
            <input
              type="checkbox"
              checked={nationwide}
              onChange={() => setNationwide(!nationwide)}
            />
            Nationwide Delivery
          </label>

          <input
            type="number"
            placeholder="Fee"
            value={nationwideFee}
            onChange={(e) => setNationwideFee(e.target.value)}
          />

          <input
            type="text"
            placeholder="ETA"
            value={nationwideEst}
            onChange={(e) => setNationwideEst(e.target.value)}
          />
        </div>

        {!nationwide &&
          provinces.map((prov) => (
            <div key={prov.id} className="province-card">
              <div className="province-header">
                <label>
                  <input
                    type="checkbox"
                    checked={selections[prov.id]?.checked || false}
                    onChange={() => toggleProvince(prov.id)}
                  />
                  {prov.name}
                </label>

                <input
                  type="number"
                  placeholder="Fee"
                  value={selections[prov.id]?.fee || ""}
                  onChange={(e) =>
                    handleChange(prov.id, null, "fee", e.target.value)
                  }
                />

                <input
                  type="text"
                  placeholder="ETA"
                  value={selections[prov.id]?.est || ""}
                  onChange={(e) =>
                    handleChange(prov.id, null, "est", e.target.value)
                  }
                />
              </div>

              <div className="cities-dropdown">
                {prov.cities.map((city) => (
                  <div key={city.id} className="city-row">
                    <label>
                      <input
                        type="checkbox"
                        checked={
                          selections[prov.id]?.cities?.[city.id]?.checked ||
                          false
                        }
                        onChange={() => toggleCity(prov.id, city.id)}
                      />
                      {city.name}
                    </label>

                    <input
                      type="number"
                      placeholder="Fee"
                      value={
                        selections[prov.id]?.cities?.[city.id]?.fee || ""
                      }
                      onChange={(e) =>
                        handleChange(prov.id, city.id, "fee", e.target.value)
                      }
                    />

                    <input
                      type="text"
                      placeholder="ETA"
                      value={
                        selections[prov.id]?.cities?.[city.id]?.est || ""
                      }
                      onChange={(e) =>
                        handleChange(prov.id, city.id, "est", e.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>
            Cancel
          </button>

          <button className="save-btn" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddDeliveryModal;

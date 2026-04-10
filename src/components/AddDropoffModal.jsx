import React, { useEffect, useState } from "react";
import "../styles/AddDropoffModal.css"; // Reuse AddDeliveryModal styles

export default function AddDropoffModal({ storeId, isOpen, onClose }) {
  const [dropoffs, setDropoffs] = useState([]);
  const [form, setForm] = useState({
    province: "",
    city: "",
    suburb: "",
    postal_code: "",
    street_address: "",
    price: "",
    notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Use correct base URL
  const API_BASE = import.meta.env.VITE_API_URL || "";

  // 🔹 Load drop-off locations
  useEffect(() => {
    if (!isOpen || !storeId) return;

    const fetchDropoffs = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/dropoff_locations?store_id=${storeId}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to load drop-off locations");
        setDropoffs(data.locations || []);
      } catch (err) {
        console.error("❌ Error loading drop-offs:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchDropoffs();
  }, [isOpen, storeId]);

  // 🔹 Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // 🔹 Add new drop-off
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!storeId) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/${storeId}/dropoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to add drop-off location");

      setDropoffs((prev) => [...prev, data.location]);
      setForm({
        province: "",
        city: "",
        suburb: "",
        postal_code: "",
        street_address: "",
        price: "",
        notes: "",
      });
    } catch (err) {
      console.error("❌ Add error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Delete drop-off
  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this drop-off location?")) return;

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/api/${storeId}/dropoff/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to delete drop-off location");

      setDropoffs((prev) => prev.filter((loc) => loc.id !== id));
    } catch (err) {
      console.error("❌ Delete error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`modal-overlay ${isOpen ? "show" : ""}`}>
      <div className="modal">
        <button className="close-dropoff-btn" onClick={onClose}>×</button>
        <h2>Drop-off Locations</h2>

        {error && <p className="error-text">{error}</p>}
        {loading && <p>Loading...</p>}

        {/* Drop-off list */}
        {!loading && (
          <table className="delivery-table">
            <thead>
              <tr>
                <th>Province</th>
                <th>City</th>
                <th>Suburb</th>
                <th>Postal Code</th>
                <th>Street Address</th>
                <th>Price</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {dropoffs.length > 0 ? (
                dropoffs.map((loc) => (
                  <tr key={loc.id}>
                    <td>{loc.province}</td>
                    <td>{loc.city}</td>
                    <td>{loc.suburb}</td>
                    <td>{loc.postal_code}</td>
                    <td>{loc.street_address}</td>
                    <td>R{loc.price}</td>
                    <td>{loc.notes || "-"}</td>
                    <td>
                      <button className="delete-dropoff-loc" onClick={() => handleDelete(loc.id)}>
                        <i className="bx bx-trash"></i>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center" }}>
                    No drop-off locations added yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {/* Add new drop-off form */}
        <form className="delivery-form" onSubmit={handleAdd}>
          <input name="province" value={form.province} onChange={handleChange} placeholder="Province" required />
          <input name="city" value={form.city} onChange={handleChange} placeholder="City" required />
          <input name="suburb" value={form.suburb} onChange={handleChange} placeholder="Suburb" required />
          <input name="postal_code" value={form.postal_code} onChange={handleChange} placeholder="Postal Code" required />
          <input name="street_address" value={form.street_address} onChange={handleChange} placeholder="Street Address" required />
          <input name="price" value={form.price} onChange={handleChange} placeholder="Price (R)" type="number" step="0.01" required />
          <input name="notes" value={form.notes} onChange={handleChange} placeholder="Notes (optional)" />
          <button type="submit" disabled={loading}>Add Drop-off</button>
        </form>
      </div>
    </div>
  );
}

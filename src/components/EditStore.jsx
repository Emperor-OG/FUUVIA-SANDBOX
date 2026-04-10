import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/EditStore.css";
import Loading from "./Loading";

// --- Country dropdown ---
const CountrySelector = ({ value, disabled }) => {
  const countries = [
    "South Africa",
    "Nigeria",
    "Ghana",
    "Kenya",
    "Tanzania",
    "Uganda",
    "Zimbabwe",
  ];
  const normalizedValue = countries.includes(value) ? value : "";
  return (
    <select name="country" value={normalizedValue} disabled={disabled} required>
      <option value="">Select Country</option>
      {countries.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
};

// --- Account Type dropdown ---
const AccountTypeSelector = ({ value, disabled }) => {
  const types = ["Savings", "Cheque", "Current", "Business"];
  const normalizedValue = types.includes(value) ? value : "";
  return (
    <select name="account_type" value={normalizedValue} disabled={disabled} required>
      <option value="">Select Account Type</option>
      {types.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
};

// ================================
// FIELD DEFINITIONS
// ================================
const storeFields = [
  { key: "store_name", label: "Store Name", type: "text", tab: "info", maxLength: 50 },

  { key: "cell_number", label: "Primary Number", type: "text", tab: "info" },
  { key: "secondary_number", label: "Secondary Number", type: "text", tab: "info", placeholder: "Optional" },
  { key: "email", label: "Contact Email", type: "text", tab: "info" },
  { key: "description", label: "Store Description", type: "textarea", tab: "info" },

  // Headquarters
  { key: "country", label: "Country", type: "text", tab: "info" },
  { key: "province", label: "Province", type: "text", tab: "info" },
  { key: "city", label: "City", type: "text", tab: "info" },
  { key: "suburb", label: "Suburb", type: "text", tab: "info" },
  { key: "street", label: "Street", type: "text", tab: "info" },
  { key: "postal_code", label: "Postal Code", type: "text", tab: "info" },

  // Bank
  { key: "bank_name", label: "Bank Name", type: "text", tab: "info" },
  { key: "account_holder", label: "Account Holder", type: "text", tab: "info" },
  { key: "account_number", label: "Account Number", type: "text", tab: "info" },
  { key: "account_type", label: "Account Type", type: "text", tab: "info" },

  // Schedule
  { key: "monday_open", label: "Monday Open", type: "time", tab: "schedule" },
  { key: "monday_close", label: "Monday Close", type: "time", tab: "schedule" },
  { key: "tuesday_open", label: "Tuesday Open", type: "time", tab: "schedule" },
  { key: "tuesday_close", label: "Tuesday Close", type: "time", tab: "schedule" },
  { key: "wednesday_open", label: "Wednesday Open", type: "time", tab: "schedule" },
  { key: "wednesday_close", label: "Wednesday Close", type: "time", tab: "schedule" },
  { key: "thursday_open", label: "Thursday Open", type: "time", tab: "schedule" },
  { key: "thursday_close", label: "Thursday Close", type: "time", tab: "schedule" },
  { key: "friday_open", label: "Friday Open", type: "time", tab: "schedule" },
  { key: "friday_close", label: "Friday Close", type: "time", tab: "schedule" },
  { key: "saturday_open", label: "Saturday Open", type: "time", tab: "schedule" },
  { key: "saturday_close", label: "Saturday Close", type: "time", tab: "schedule" },
  { key: "sunday_open", label: "Sunday Open", type: "time", tab: "schedule" },
  { key: "sunday_close", label: "Sunday Close", type: "time", tab: "schedule" },
];

const adminFields = [
  { key: "store_owner", label: "Store Owner", type: "email", tab: "admins", readOnly: true },
  ...Array.from({ length: 10 }, (_, idx) => ({
    key: `admin${idx + 1}`,
    label: idx === 0 ? "Admin 1 (Owner)" : `Admin ${idx + 1}`,
    type: "email",
    tab: "admins",
    placeholder: idx === 0 ? "Owner email (read only)" : `Admin ${idx + 1} email`,
    readOnly: idx === 0, // Admin 1 is read-only
  })),
];

// ================================
// COMPONENT
// ================================
export default function EditStore({ storeId, onClose }) {
  const [storeData, setStoreData] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bannerFile, setBannerFile] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [activeTab, setActiveTab] = useState("info");

  const navigate = useNavigate();
  const CONTACT_NAME = import.meta.env.VITE_CONTACT_NAME || "MBA-MEDIA";
  const API_BASE = import.meta.env.VITE_API_URL || "";
  const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "support@example.com";

  useEffect(() => {
    async function fetchStore() {
      try {
        const res = await fetch(`${API_BASE}/api/stores/storefront/${storeId}`, { credentials: "include" });
        if (!res.ok) throw new Error("Failed to fetch store");
        const data = await res.json();
        setStoreData(data.store || {});
      } catch (err) {
        console.error(err);
        alert("Failed to load store details");
      } finally {
        setLoading(false);
      }
    }
    if (storeId) fetchStore();
  }, [storeId]);

  const handleChange = (key, value) => setStoreData((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (type, e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (type === "banner") {
      setBannerFile(file);
      setStoreData((p) => ({ ...p, banner_url: URL.createObjectURL(file) }));
    } else {
      setLogoFile(file);
      setStoreData((p) => ({ ...p, logo_url: URL.createObjectURL(file) }));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const formData = new FormData();
      Object.entries(storeData).forEach(([key, val]) => {
        if (["banner_url", "logo_url"].includes(key)) return;
        if (val !== null && val !== undefined) formData.append(key, val);
      });
      if (bannerFile) formData.append("bannerFile", bannerFile);
      if (logoFile) formData.append("logoFile", logoFile);

      const res = await fetch(`${API_BASE}/api/stores/storefront/${storeId}`, {
        method: "PUT",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update store");
      window.location.reload();
    } catch (err) {
      console.error(err);
      alert("Failed to update store");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Permanently delete this store?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/stores/storefront/${storeId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to delete store");
      alert("Store deleted successfully");
      navigate("/Market");
    } catch (err) {
      console.error(err);
      alert("Failed to delete store");
    }
  };

  if (loading || saving)
    return <Loading message={saving ? "Updating store..." : "Loading store details..."} />;

  const allFields = [...storeFields, ...adminFields];
  const readOnlyFields = [
    "country", "province", "city", "suburb", "street", "postal_code",
    "bank_name", "account_holder", "account_number", "account_type"
  ];

  return (
    <div className="edit-store-modal">
      <div className="edit-store-overlay" onClick={onClose}></div>
      <div className="edit-store-content">
        <span className="edit-store-close" onClick={onClose}>&times;</span>
        <h2>Edit Store Details</h2>

        {/* Images */}
        <div className="store-images-section">
          <div className="store-image">
            <label className="image-upload-label">
              <span>Banner</span>

              {storeData.banner_url && (
                <img
                  src={storeData.banner_url}
                  alt="Banner"
                  className="store-preview-image"
                />
              )}

              <input
                className="LogoBannerInp"
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange("banner", e)}
              />
            </label>
          </div>

          <div className="store-image">
            <label className="image-upload-label">
              <span>Logo</span>

              {storeData.logo_url && (
                <img
                  src={storeData.logo_url}
                  alt="Logo"
                  className="store-preview-image"
                />
              )}

              <input
                className="LogoBannerInp"
                type="file"
                accept="image/*"
                onChange={(e) => handleFileChange("logo", e)}
              />
            </label>
          </div>
        </div>

        {/* Tabs */}
        <div className="edit-store-tabs">
          <button className={activeTab === "info" ? "active" : ""} onClick={() => setActiveTab("info")}>Store Info</button>
          <button className={activeTab === "schedule" ? "active" : ""} onClick={() => setActiveTab("schedule")}>Schedule</button>
          <button className={activeTab === "admins" ? "active" : ""} onClick={() => setActiveTab("admins")}>Admins</button>
        </div>

        <table className="edit-store-table">
          <tbody>
            {allFields.filter(f => f.tab === activeTab).map(f => {
              const isReadOnly = readOnlyFields.includes(f.key) || f.readOnly;
              const showHQLabel = f.key === "country";
              const showBankLabel = f.key === "bank_name";
              const showStoreLabel = f.key === "store_name";

              return (
                <React.Fragment key={f.key}>
                  {showStoreLabel && (
                    <tr><td colSpan={2}><strong>Store Info</strong></td></tr>
                  )}
                  {showHQLabel && (
                    <tr>
                      <td colSpan={2}>
                        <strong>Headquarters</strong>
                        <div className="discreet-note">
                          To change, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{CONTACT_NAME}</a>
                        </div>
                      </td>
                    </tr>
                  )}
                  {showBankLabel && (
                    <tr>
                      <td colSpan={2}>
                        <strong>Account Details</strong>
                        <div className="discreet-note">
                          To change, contact <a href={`mailto:${SUPPORT_EMAIL}`}>{CONTACT_NAME}</a>
                        </div>
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td><strong>{f.label}</strong></td>
                    <td>
                      {f.key === "country" ? (
                        <CountrySelector value={storeData.country || ""} disabled={isReadOnly} />
                      ) : f.key === "account_type" ? (
                        <AccountTypeSelector value={storeData.account_type || ""} disabled={isReadOnly} />
                      ) : f.type === "textarea" ? (
                        <textarea
                          name={f.key}
                          placeholder={f.placeholder || ""}
                          value={storeData[f.key] || ""}
                          onChange={(e) => handleChange(f.key, e.target.value)}
                          disabled={isReadOnly}
                          rows={4}
                          maxLength={f.maxLength || undefined}
                        />
                      ) : (
                        <input
                          type={f.type}
                          name={f.key}
                          placeholder={f.placeholder || ""}
                          value={storeData[f.key] || ""}
                          onChange={
                            isReadOnly
                              ? undefined
                              : (e) => handleChange(f.key, e.target.value)
                          }
                          disabled={isReadOnly}
                          maxLength={f.maxLength || undefined}
                        />
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>

        <div className="edit-store-buttons">
          <button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save Changes"}</button>
          <button onClick={handleDelete} className="delete-btn">Delete Store</button>
        </div>
      </div>
    </div>
  );
}


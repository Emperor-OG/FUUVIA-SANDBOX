import React from "react";
import "../styles/EUStorePanel.css";

export default function EUStorePanel({ store, onActionClick }) {
  if (!store) return null; // Prevent crashes if store is null

  const handleContactClick = () => {
    if (!store.email) return alert("This store has no contact email listed.");
    window.location.href = `mailto:${store.email}?subject=Inquiry about ${encodeURIComponent(
      store.store_name
    )}`;
  };

  return (
    <div id="eu-store-panel">
      {/* Store banner and logo */}
      <div className="store-images">
        {store.banner_url && (
          <img
            src={store.banner_url}
            alt="Store Banner"
            id="EUstore-banner"
          />
        )}
        {store.logo_url && (
          <img
            src={store.logo_url}
            alt="Store Logo"
            id="EUstore-logo"
          />
        )}
      </div>

      {/* Store basic info */}
      <div id="EUstore-details">
        <h2 className="EUstore-name">{store.store_name}</h2>
        <p>
          <strong>Province:</strong> {store.province}
        </p>
        <p>
          <strong>City:</strong> {store.city}
        </p>

        {store.description && (
          <p className="EUstore-description">
            <strong>Description:</strong> {store.description}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="EUstore-actions">
        {/* ✅ Opens the Store Info modal in Store.jsx */}
        <button onClick={() => onActionClick("storeInfo")}>
          <i className="bx bx-info-circle"></i>&nbsp;Store Info
        </button>

      </div>
    </div>
  );
}

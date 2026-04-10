import React from "react";
import "../styles/StorePanel.css";

export default function StorePanel({ store, onActionClick }) {
  if (!store) return null; // ✅ Prevent crashes if store is null

  return (
    <div className="store-panel">
      {/* Store images */}
      <div className="store-images">
        {store.banner_url && (
          <img
            src={store.banner_url}
            alt="Banner"
            className="store-banner"
            id="store-banner"
          />
        )}
        {store.logo_url && (
          <img
            src={store.logo_url}
            alt="Logo"
            className="store-logo"
            id="store-logo"
          />
        )}
      </div>

      {/* Store details */}
      <div className="store-details">
        <p className="store-name-detail">
          <strong>{store.store_name}</strong>
        </p>
        <p>
          <strong>Store ID:</strong> {store.id}
        </p>
        <p>
          <strong>Email:</strong> {store.email}
        </p>
        <p>
          <strong>Primary Phone:</strong> {store.cell_number}
        </p>
        <p>
          <strong>Secondary Phone:</strong> {store.secondary_number || "N/A"}
        </p>
        <p>
          <strong>Province:</strong> {store.province}
        </p>
        <p>
          <strong>City:</strong> {store.city}
        </p>
        {store.description && (
          <p className="store-description">
            <strong>Description:</strong> {store.description}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="store-actions">
        <button onClick={() => onActionClick("deliveryLocations")}>
          Delivery Locations
        </button>
        <button onClick={() => onActionClick("dropoffLocations")}>
          Dropoff Locations
        </button>
        <button onClick={() => onActionClick("editStore")}>
          Edit Store
        </button>
        <button onClick={() => onActionClick("addProduct")}>
          Add Products
        </button>
        <button onClick={() => onActionClick("orders")}>
          Orders & Stats
        </button>
      </div>
    </div>
  );
}

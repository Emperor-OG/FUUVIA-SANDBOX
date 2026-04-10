// src/components/StoreCard.jsx
import React from "react";
import "../styles/StoreCard.css";
import "boxicons/css/boxicons.min.css";
import StoreStatus from "./StoreStatus.jsx"; // ✅ Import the component

export default function StoreCard({ store, onClick, isFavourite = false, onHeartClick }) {
  return (
    <div
      className="store-card"
      id={`store-${store.id}`}
      onClick={() => onClick(store.id)}
    >
      <div className="banner-container">
        <img
          src={store.banner_url || "https://storage.googleapis.com/your-default-banner.jpg"}
          alt={`${store.store_name} Banner`}
          className="store-banner"
        />
        <img
          src={store.logo_url || ""}
          alt={`${store.store_name} Logo`}
          className="store-logo"
        />

        {/* Favourite Heart Icon (top-right) */}
        <button
          className={`favourite-btn ${isFavourite ? "favourited" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            onHeartClick();
          }}
        >
          <i className={isFavourite ? "bx bxs-heart" : "bx bx-heart"}></i>
        </button>

        {/* ✅ Open/Closed Status (top-left) */}
        <div className="store-status-pill-wrapper">
          <StoreStatus storeId={store.id} isOpen={store.is_open} />
        </div>
      </div>

      <div className="store-info">
        <h3 className="store-name">{store.store_name}</h3>
        <p className="store-number">{store.id}</p>
        <p className="store-location">{store.province} • {store.city}</p>
      </div>
    </div>
  );
}

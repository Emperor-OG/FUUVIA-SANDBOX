// src/components/FavouriteCard.jsx
import React from "react";
import "../styles/FavouriteCard.css";
import "boxicons/css/boxicons.min.css";

export default function FavouriteCard({ store, onClick, onHeartClick }) {
  return (
    <div
      className="favourite-card"
      id={`fav-${store.id}`}
      onClick={() => onClick(store.id)}
    >
      <div className="favourite-banner-container">
        <img
          src={store.banner_url || "https://storage.googleapis.com/your-default-banner.jpg"}
          alt={`${store.store_name} Banner`}
          className="favourite-banner"
        />
        <img
          src={store.logo_url || ""}
          alt={`${store.store_name} Logo`}
          className="favourite-logo"
        />

        {/* Heart Icon */}
        <button
          className="favourite-btn favourited"
          onClick={(e) => {
            e.stopPropagation();
            onHeartClick();
          }}
        >
          <i className="bx bxs-heart"></i>
        </button>
      </div>

      <div className="favourite-info">
        <h4 className="favourite-name">{store.store_name}</h4>
      </div>
    </div>
  );
}

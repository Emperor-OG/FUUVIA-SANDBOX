import React from "react";
import "../styles/Loading.css";

export default function Loading({ message = "Loading..." }) {
  return (
    <div className="loading-overlay">
      <div className="loading-spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  );
}
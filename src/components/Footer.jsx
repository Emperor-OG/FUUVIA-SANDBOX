import React from "react";
import "../styles/Footer.css";

export default function Footer() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL;

  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>FUUVIA</h4>
          <p>Private Company – Registration No: 2025 / 901048 / 07</p>
          <p>Tax Number: 9201506293</p>
          <p>Financial Year End: December</p>
        </div>

        <div className="footer-section">
          <h4>Address</h4>
          <p>12 Njhakanjhaka, Bungeni Village</p>
          <p>Sifahla, Limpopo, 0957</p>
        </div>

        <div className="footer-section">
          <h4>Contact</h4>
          <p>Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a></p>
          <p>Phone: +27 78 107 5269</p>
        </div>
      </div>
      <div className="footer-bottom">
        &copy; {new Date().getFullYear()} FUUVIA. All rights reserved.
      </div>
    </footer>
  );
}

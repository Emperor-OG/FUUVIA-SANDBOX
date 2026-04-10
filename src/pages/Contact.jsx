import React from "react";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import "../styles/Contact.css";

export default function Contact() {
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@fuuvia.com";

  return (
    <div className="contact-page">
      {/* HEADER */}
      <Header />

      <div className="contact-layout">

        {/* MAIN CONTENT */}
        <main className="contact-content">
          <div className="section">
            <h1>Contact Us</h1>
            <p>
              If you have questions, need support, to request account or data deletion  or want to reach <strong>FUUVIA</strong>, you can contact us via:
            </p>

            <ul>
              <li>
                <strong>Email:</strong>{" "}
                <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
              </li>
              <li><strong>Phone:</strong> +27 78 107 5269</li>
              <li><strong>Registered Address:</strong> 12 Njhakanjhaka, Bungeni Village, Sifahla, Limpopo, 0957</li>
              <li><strong>Postal Address:</strong> 12 Njhakanjhaka, Bungeni Village, Sifahla, Limpopo, 0957</li>
              <li><strong>Registration Number:</strong> 2025 / 901048 / 07</li>
              <li><strong>Tax Number:</strong> 9201506293</li>
            </ul>
          </div>

          {/* FOOTER */}
          <Footer />
        </main>
      </div>
    </div>
  );
}

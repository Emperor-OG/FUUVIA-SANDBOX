import React from "react";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import "../styles/Privacy.css";

export default function Privacy() {
  const siteName = import.meta.env.VITE_NAME || "FUUVIA";
  const supportEmail =
    import.meta.env.VITE_SUPPORT_EMAIL || "support@fuuvia.com";

  return (
    <div className="privacy-page">
      {/* ================= HEADER ================= */}
      <Header />

      <div className="privacy-layout" style={{ display: "flex" }}>
        {/* ================= MAIN CONTENT ================= */}
        <main className="privacy-main">
          <div className="section">
            <h1>Privacy Policy</h1>

            <p>
              {siteName} collects personal information from customers to provide a secure and reliable online shopping experience. We manage all transactions directly and may work with subcontracted fulfilment partners to deliver products.
            </p>

            <h2>1. Information We Collect</h2>
            <ul>
              <li>Full name and identification information</li>
              <li>Contact details (email, phone)</li>
              <li>Order history and transaction details</li>
              <li>Payment information for processing transactions</li>
              <li>Optional data to improve services and user experience</li>
            </ul>

            <h2>2. Purpose of Collection</h2>
            <ul>
              <li>Verify identity and prevent fraudulent transactions</li>
              <li>Process payments securely</li>
              <li>Coordinate order fulfilment and delivery</li>
              <li>Provide customer support and after-sales service</li>
              <li>Enhance and improve platform services</li>
            </ul>

            <h2>3. Data Security</h2>
            <p>
              All personal data is stored securely using encryption and strict access controls. We retain customer information only as long as necessary to fulfil orders, provide services, or comply with legal obligations.
            </p>

            <h2>4. Data Sharing</h2>
            <p>
              {siteName} does not share personal information with unauthorized parties. Data may be shared with:
            </p>
            <ul>
              <li>Payment processors</li>
              <li>Subcontracted fulfilment partners to deliver products on behalf of {siteName}</li>
              <li>Authorities when legally required</li>
              <li>During investigations of fraud or disputes</li>
            </ul>

            <h2>5. Your Rights</h2>
            <ul>
              <li>Access and request corrections to your personal information</li>
              <li>Request deletion of personal information where applicable</li>
              <li>Contact our support team for any privacy-related concerns</li>
            </ul>

            <h2>6. Contact</h2>
            <p>
              For any questions regarding this privacy policy, please contact us at:{" "}
              <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
            </p>
          </div>

          {/* ================= FOOTER ================= */}
          <Footer />
        </main>
      </div>
    </div>
  );
}

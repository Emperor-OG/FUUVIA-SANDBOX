import React from "react";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import "../styles/TermsOfService.css";

export default function TermsOfService() {
  const siteName = import.meta.env.VITE_NAME || "FUUVIA";
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@fuuvia.com";

  return (
    <div className="terms-page">
      {/* HEADER */}
      <Header />

      <div className="terms-layout" style={{ display: "flex" }}>

        {/* MAIN CONTENT */}
        <main className="terms-main">
          {/* Terms of Use Section */}
          <div className="section">
            <h1>Terms of Use</h1>
            <p>• <strong>{siteName}</strong> provides a marketplace platform for vendors to list and sell their products directly to customers. {siteName} is not responsible for delivery or product handling. Vendors must fulfill all orders in a timely and professional manner.</p>
            <p>• In cases where a seller commits fraud or a criminal act, {siteName} cannot be held liable in court, but will fully cooperate with authorities and assist in investigations to ensure justice is served.</p>
            <p>• Vendors are expected to maintain high standards of customer satisfaction and reliable service delivery at all times.</p>
            <p>• {siteName} may apply a minimum 10% commission and may markup products by 10% to 15% (current markup is 11.25%) for platform services and transaction processing.</p>
            <p>• Vendors must provide accurate, verifiable, and up-to-date personal and business information. Failure to comply may result in account suspension or deletion.</p>
            <p>• Payments for orders processed via Paystack are transferred directly to the vendor’s bank account, typically within 2=3 business days after processing.</p>
          </div>

          {/* Acceptable Use Policy Section */}
          <div className="section">
            <h1>Acceptable Use Policy (AUP)</h1>

            <section>
              <h2>1. Prohibited Products & Services</h2>
              <p>Vendors may not list or sell:</p>
              <ul>
                <li>Illegal items or substances</li>
                <li>Counterfeit or pirated goods</li>
                <li>Weapons, firearms, or hazardous materials</li>
                <li>Items violating intellectual property rights</li>
                <li>Products prohibited by law or by {siteName}’s internal policies</li>
              </ul>
            </section>

            <section>
              <h2>2. Vendor Responsibilities</h2>
              <ul>
                <li>Provide accurate, complete, and honest business/product information</li>
                <li>Fulfill orders promptly and according to product descriptions</li>
                <li>Ensure products are safe, compliant, and meet quality standards</li>
                <li>Maintain good communication with customers and resolve issues professionally</li>
              </ul>
            </section>

            <section>
              <h2>3. Fraud Prevention</h2>
              <p>Any attempt to manipulate the platform, commit fraud, or provide false information is strictly prohibited. Violations may result in immediate account suspension or termination and potential legal action.</p>
            </section>

            <section>
              <h2>4. Dispute Handling</h2>
              <ul>
                <li>Customers may submit complaints via {siteName} support.</li>
                <li>Vendors must cooperate fully with investigations and provide requested information promptly.</li>
                <li>All dispute-related records are securely stored and reviewed for resolution.</li>
                <li>Serious violations may be escalated to law enforcement authorities as required.</li>
              </ul>
            </section>

            <section>
              <h2>5. Consequences</h2>
              <p>Non-compliance with these policies may result in account suspension, termination, or legal action. Vendors are expected to comply with all applicable laws and platform rules at all times.</p>
            </section>

            <section>
              <h2>6. Acceptance</h2>
              <p>By registering as a vendor on {siteName}, you agree to follow this Acceptable Use Policy and all associated terms outlined in this document.</p>
            </section>
          </div>

          {/* Shipping Policy Section */}
          <div className="section">
            <h1>Shipping Policy</h1>
            <p>• All products listed on {siteName} are shipped directly by the vendors to the customers who place orders.</p>
            <p>• Vendors are required to provide accurate and complete delivery information to the customer, including shipping address, estimated delivery times, and, where available, tracking numbers from the shipping carrier. This ensures that customers can follow the progress of their shipment and receive their orders as expected.</p>
            <p>• Vendors must update customers promptly if there are any delays, issues, or changes in the delivery process.</p>
            <p>• Delivery times depend on the vendor and the shipping method selected. {siteName} is not responsible for delays caused by vendors, courier services, or external factors beyond our control.</p>
          </div>

          {/* Returns Policy Section */}
          <div className="section">
            <h1>Returns Policy</h1>
            <p>• Customers may request returns or exchanges directly with vendors, in accordance with the vendor-specific return conditions listed on their product pages.</p>
            <p>• Vendors are responsible for processing all returns, refunds, and exchanges in a timely manner and ensuring that customers are kept informed throughout the process.</p>
            <p>• {siteName} may assist in mediating disputes between customers and vendors, but does not directly process refunds or handle returned items on behalf of vendors.</p>
            <p>• Vendors should clearly communicate return windows, conditions, and any applicable fees to ensure transparency and maintain trust with customers.</p>
          </div>

          {/* FOOTER */}
          <Footer />
        </main>
      </div>
    </div>
  );
}

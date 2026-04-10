import React from "react";
import Header from "../components/Header.jsx";
import Footer from "../components/Footer.jsx";
import "../styles/AboutUs.css";

export default function AboutUs() {
  const siteName = import.meta.env.VITE_NAME || "FUUVIA";
  const supportEmail = import.meta.env.VITE_SUPPORT_EMAIL || "support@fuuvia.com";

  let founders = [
    "Sagwadi Baloyi",
    "Pfumelani Elton Chuma",
    "Nsuku Vunene Mabunda",
    "Nkateko Neo Misunwa",
    "Ntsakiso Glad Sambo",
    "Hlaluko Brandly Shirindza",
    "Tsetselelo Shirinda",
  ];

  founders = founders
    .sort((a, b) => {
      const surnameA = a.split(" ").slice(-1)[0];
      const surnameB = b.split(" ").slice(-1)[0];
      return surnameA.localeCompare(surnameB);
    })
    .map((fullName) => {
      const parts = fullName.split(" ");
      const surname = parts[parts.length - 1];
      const firstInitial = parts[0][0];
      return `${firstInitial}.${surname}`;
    });

  return (
    <div className="about-page" style={{ minHeight: "100vh" }}>
      {/* HEADER */}
      <Header />

      <div className="about-layout" style={{ display: "flex" }}>

        {/* MAIN CONTENT */}
        <main>
          <div>
            <h1>About {siteName}</h1>
            <p>
              FUUVIA – <strong>Future Universal Media</strong> – is a curated online
              retail platform offering a carefully selected range of gifts, lifestyle
              products, and custom-designed items. We sell directly to customers and
              work with a small network of trusted supply partners to fulfil products
              under our direction and quality standards.
            </p>

            <h2>How We Operate</h2>
              <p>
                FUUVIA operates as a single retailer, not an open marketplace.
                Customers purchase directly from FUUVIA, and we manage the entire
                ordering process including payment, fulfilment coordination,
                delivery, and customer support.
              </p>
              <p>
                We collaborate with a limited number of pre-approved partners who
                prepare or supply products on our behalf. These partners do not sell
                independently on the platform, ensuring a consistent and reliable
                shopping experience for every customer.
              </p>

            <h2>Founders & Ownership</h2>
            <p>{siteName} was created by <strong>O.Mabasa</strong> and co-owned by:</p>
            <ul>
              {founders.map((f) => <li key={f}>{f}</li>)}
            </ul>

            <h2>Partners</h2>
            <p>
              We work with a select group of contracted fulfilment partners who
              assist in producing and supplying products according to our
              specifications. Additional partners are introduced only after a
              strict review process to ensure quality and reliability.
            </p>

            <h2>Mission</h2>
            <p>
              {siteName}'s mission is to provide customers with a trusted place to
              discover meaningful products while building strong, responsible
              partnerships with specialised suppliers who help us deliver quality
              goods efficiently and consistently.
            </p>

            <h2>Our Commitment to Customers</h2>
            <p>
              Every order placed on FUUVIA is handled directly by our team. We take
              full responsibility for product quality, payments, delivery
              coordination, and after-sales support so customers always know who
              they are dealing with.
            </p>

            <h2>Business Information</h2>
            <ul>
              <li>Registration Number: 2025 / 901048 / 07</li>
              <li>Business Name: FUUVIA</li>
              <li>Enterprise Type: Private Company</li>
              <li>Status: In Business</li>
              <li>Business Start Date: 18/11/2025</li>
              <li>Financial Year End: December</li>
              <li>Tax Number: 9201506293</li>
            </ul>

            <h2>Registered Address</h2>
            <p>12 Njhakanjhaka, Bungeni Village, Sifahla, Limpopo, 0957</p>

            <h2>Postal Address</h2>
            <p>12 Njhakanjhaka, Bungeni Village, Sifahla, Limpopo, 0957</p>

            <h2>Contact</h2>
            <p>
              Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a><br />
              Phone: +27 78 107 5269
            </p>
          </div>

          {/* FOOTER */}
          <Footer />
        </main>
      </div>

      {/* RESPONSIVE STYLES */}
      <style>
        {`
          @media screen and (max-width: 768px) {
            .about-main {
              margin-left: 0 !important;
              width: 100% !important;
            }
            .sidenav-container {
              display: none !important;
            }
          }
        `}
      </style>
    </div>
  );
}

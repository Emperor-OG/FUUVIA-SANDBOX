import React, { useState } from "react";
import Loading from "../components/Loading.jsx"; // ✅ Import loading component
import "../styles/StoreModal.css";

export default function StoreModal({ isOpen, onClose, userEmail }) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false); // ✅ Loading state

  const banks = [
    { name: "Capitec Bank", code: "470010" },
    { name: "FNB (First National Bank)", code: "250655" },
    { name: "ABSA Bank", code: "632005" },
    { name: "Standard Bank", code: "051001" },
    { name: "Nedbank", code: "198765" },
    { name: "Discovery Bank", code: "679000" },
    { name: "TymeBank", code: "678910" },
    { name: "African Bank", code: "430000" },
    { name: "Bidvest Bank", code: "462005" },
    { name: "Investec Bank", code: "580105" },
  ];

  const [storeData, setStoreData] = useState({
    storeName: "",
    storeOwner: "",
    cellNumber: "",
    secondaryNumber: "",
    email: "",
    country: "ZA",
    street: "",
    suburb: "",
    province: "",
    city: "",
    postalCode: "",
    description: "",
    bankName: "",
    branchCode: "",
    accountHolder: "",
    accountNumber: "",
    accountType: "",
    banner: null,
    logo: null,
    compliance: null,
    poa: null,
    proofOfResidence: null,
  });

  const [acknowledgeDetails, setAcknowledgeDetails] = useState(false);
  const [acknowledgeBank, setAcknowledgeBank] = useState(false);
  const [previews, setPreviews] = useState({ banner: null, logo: null });

  const handleInput = (e) => {
    const { name, value, files } = e.target;
    if (files) {
      const file = files[0];
      setStoreData({ ...storeData, [name]: file });
      if (name === "banner" || name === "logo") {
        setPreviews({ ...previews, [name]: URL.createObjectURL(file) });
      }
    } else {
      setStoreData({ ...storeData, [name]: value });
    }
  };

  const handleBankSelect = (e) => {
    const selectedBank = banks.find((b) => b.name === e.target.value);
    if (selectedBank) {
      setStoreData({
        ...storeData,
        bankName: selectedBank.name,
        branchCode: selectedBank.code,
      });
    }
  };

  const handleNext = (e) => {
    e.preventDefault();
    if (!storeData.storeName || !storeData.banner || !storeData.logo || !storeData.compliance) {
      alert("Please complete all required fields and uploads.");
      return;
    }
    if (!acknowledgeDetails) {
      alert("You must acknowledge that the details are correct before proceeding.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !storeData.bankName ||
      !storeData.accountHolder ||
      !storeData.accountNumber ||
      !storeData.accountType ||
      !storeData.poa ||
      !storeData.proofOfResidence
    ) {
      alert("Please complete all bank details and uploads.");
      return;
    }
    if (!acknowledgeBank) {
      alert("You must acknowledge the banking details before submitting.");
      return;
    }

    try {
      setLoading(true); // ✅ Show loading spinner

      const formData = new FormData();
      Object.keys(storeData).forEach((key) => {
        if (storeData[key]) formData.append(key, storeData[key]);
      });
      formData.append("createdBy", userEmail);

      const res = await fetch("/api/stores", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      setLoading(false); // ✅ Hide loading

      if (data.success) {
        onClose();
        setTimeout(() => window.location.reload(), 800);
      } else {
        console.error(data);
        alert("Failed to create store.");
      }
    } catch (err) {
      console.error(err);
      setLoading(false);
      alert("Server error while creating store.");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {loading && <Loading />} {/* ✅ Show loading overlay during submit */}

      <div className="overlay" onClick={onClose}></div>
      <div className="modal">
        <form className="form">
          {step === 0 && (
            <>
              <h2>Before You Create a Store</h2>
              <p>Please have the following documents ready:</p>
              <ul>
                <li>ID / Passport / Driver’s Licence</li>
                <li>Proof of Account</li>
                <li>Proof of Residence</li>
              </ul>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setStep(1);
                }}
              >
                Continue →
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <h3>Store Details</h3>
              <input type="text" name="storeName" placeholder="Store Name" maxLength={50} required onChange={handleInput} />
              <input type="text" name="storeOwner" placeholder="Store Owner/Admin" required onChange={handleInput} />
              <input type="tel" name="cellNumber" placeholder="Primary Number" required onChange={handleInput} />
              <input type="tel" name="secondaryNumber" placeholder="Secondary Number" onChange={handleInput} />
              <input type="email" name="email" placeholder="Email" required onChange={handleInput} />
              <textarea name="description" placeholder="Description" required onChange={handleInput}></textarea>

              <h4>Address Details</h4>
              <input type="text" name="street" placeholder="Street Address" required onChange={handleInput} />
              <input type="text" name="suburb" placeholder="Suburb" onChange={handleInput} />
              <input type="text" name="province" placeholder="Province" required onChange={handleInput} />
              <input type="text" name="city" placeholder="City" required onChange={handleInput} />
              <input type="text" name="postalCode" placeholder="Postal Code" required onChange={handleInput} />
              <select name="country" value={storeData.country} onChange={handleInput} required>
                <option value="">Select Country</option>
                <option value="South Africa">South Africa</option>
                <option value="Nigeria">Nigeria</option>
                <option value="Ghana">Ghana</option>
                <option value="Kenya">Kenya</option>
              </select>

              <h4>Uploads</h4>
              <label>Store Banner</label>
              <input type="file" name="banner" accept="image/*" hidden id="bannerUpload" onChange={handleInput} />
              <button onClick={(e) => { e.preventDefault(); document.getElementById("bannerUpload").click(); }}>Upload Banner</button>
              {previews.banner && <img src={previews.banner} alt="Banner preview" className="preview-img" />}

              <label>Store Logo</label>
              <input type="file" name="logo" accept="image/*" hidden id="logoUpload" onChange={handleInput} />
              <button onClick={(e) => { e.preventDefault(); document.getElementById("logoUpload").click(); }}>Upload Logo</button>
              {previews.logo && <img src={previews.logo} alt="Logo preview" className="preview-img" />}

              <label>Compliance (ID/Passport/License)</label>
              <input type="file" name="compliance" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" hidden id="complianceUpload" onChange={handleInput} />
              <button onClick={(e) => { e.preventDefault(); document.getElementById("complianceUpload").click(); }}>Upload Compliance</button>
              {storeData.compliance && <p>Uploaded: {storeData.compliance.name}</p>}

              <label>Proof of Residence</label>
              <input type="file" name="proofOfResidence" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" hidden id="residenceUpload" onChange={handleInput} />
              <button onClick={(e) => { e.preventDefault(); document.getElementById("residenceUpload").click(); }}>Upload Proof of Residence</button>
              {storeData.proofOfResidence && <p>Uploaded: {storeData.proofOfResidence.name}</p>}

              <label className="checkbox-label">
                <input type="checkbox" checked={acknowledgeDetails} onChange={(e) => setAcknowledgeDetails(e.target.checked)} />
                I confirm all information entered is correct.
              </label>

              <button onClick={handleNext}>Next →</button>
            </>
          )}

          {step === 2 && (
            <>
              <h3>Bank Details</h3>
              <select name="bankName" value={storeData.bankName} onChange={handleBankSelect} required>
                <option value="">Select Bank</option>
                {banks.map((b) => (<option key={b.code} value={b.name}>{b.name}</option>))}
              </select>
              <input type="hidden" name="branchCode" value={storeData.branchCode} />
              <input type="text" name="accountHolder" placeholder="Account Holder" required onChange={handleInput} />
              <input type="text" name="accountNumber" placeholder="Account Number" required onChange={handleInput} />
              <select name="accountType" value={storeData.accountType} onChange={handleInput} required>
                <option value="">Select Account Type</option>
                <option value="Savings">Savings</option>
                <option value="Cheque">Cheque</option>
                <option value="Current">Current</option>
                <option value="Business">Business</option>
              </select>

              <label>Proof of Account</label>
              <input type="file" name="poa" accept=".pdf,.doc,.docx" hidden id="poaUpload" onChange={handleInput} />
              <button onClick={(e) => { e.preventDefault(); document.getElementById("poaUpload").click(); }}>Upload Proof of Account</button>
              {storeData.poa && <p>Uploaded: {storeData.poa.name}</p>}

              <label className="checkbox-label">
                <input type="checkbox" checked={acknowledgeBank} onChange={(e) => setAcknowledgeBank(e.target.checked)} />
                I acknowledge these banking details belong to me/my organisation.
              </label>

              <button onClick={handleSubmit}>Submit</button>
            </>
          )}
        </form>
      </div>
    </>
  );
}




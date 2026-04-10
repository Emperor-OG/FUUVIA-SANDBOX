import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Settings.css";

export default function Settings() {
  const navigate = useNavigate();

  const handleLogout = () => {
    // Example: clear session/local storage
    localStorage.clear();
    navigate("/");
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Account</h2>
        <button onClick={() => navigate("/profile")}>Edit Profile</button>
        <button onClick={() => alert("Change Password clicked")}>Change Password</button>
      </section>

      <section className="settings-section">
        <h2>Preferences</h2>
        <button onClick={() => alert("Notifications settings")}>Notifications</button>
        <button onClick={() => alert("Theme settings")}>Theme</button>
      </section>

      <section className="settings-section">
        <h2>About</h2>
        <button onClick={() => navigate("/about-us")}>About Us</button>
      </section>

      <section className="settings-section">
        <button className="logout-btn" onClick={handleLogout}>
          Log Out
        </button>
      </section>
    </div>
  );
}

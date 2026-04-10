import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "../styles/Menu.css";
import { useTheme } from "../theme/ThemeContext";

export default function Menu({ menuOpen, toggleMenu }) {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const SUPPORT_EMAIL = import.meta.env.VITE_SUPPORT_EMAIL || "";
  const API_URL = import.meta.env.VITE_API_URL || "";

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [visible, setVisible] = useState(menuOpen);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/user`, {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Failed to check auth");

        const data = await res.json();

        if (!isMounted) return;
        setIsAuthenticated(!!data?.authenticated);
      } catch {
        if (!isMounted) return;
        setIsAuthenticated(false);
      }
    };

    if (menuOpen) {
      setVisible(true);
      setClosing(false);
      checkAuth();
      document.body.style.overflow = "hidden";
    } else if (visible) {
      setClosing(true);
      document.body.style.overflow = "";

      const timeout = setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 240);

      return () => clearTimeout(timeout);
    }

    return () => {
      isMounted = false;
      if (!menuOpen) document.body.style.overflow = "";
    };
  }, [API_URL, menuOpen, visible]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const closeMenu = () => {
    toggleMenu();
  };

  const handleLogout = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/logout`, {
        method: "GET",
        credentials: "include",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.message || "Error logging out");
        return;
      }

      setIsAuthenticated(false);
      localStorage.removeItem("postLoginRedirect");
      closeMenu();
      navigate("/signin");
    } catch (err) {
      console.error("Logout failed:", err);
      alert("Logout failed. Please try again.");
    }
  };

  const handleSignIn = () => {
    localStorage.setItem(
      "postLoginRedirect",
      `${location.pathname}${location.search}${location.hash}`
    );
    closeMenu();
    navigate("/signin");
  };

  const handleThemeChange = (nextTheme) => {
    setTheme(nextTheme);
  };

  const handleHelp = () => {
    closeMenu();
    if (!SUPPORT_EMAIL) {
      alert("Support email is not configured.");
      return;
    }
    window.location.href = `mailto:${SUPPORT_EMAIL}`;
  };

  const navItems = [
    { id: "about", label: "About Us", link: "/about" },
    { id: "terms", label: "Terms of Service", link: "/terms" },
    { id: "privacy", label: "Privacy Policy", link: "/privacy" },
    { id: "contact", label: "Contact Us", link: "/contact" },
  ];

  if (!visible && !menuOpen) return null;

  return (
    <div className={`menu-root ${menuOpen ? "open" : ""} ${closing ? "closing" : ""}`}>
      <div className="menu-overlay" onClick={closeMenu}></div>

      <aside className={`side-menu ${menuOpen ? "open" : ""} ${closing ? "closing" : ""}`}>
        <button
          className="side-menu-close-btn"
          onClick={closeMenu}
          type="button"
          aria-label="Close menu"
        >
          ×
        </button>

        <div className="menu-header">
          <div className="menu-title">Menu</div>
        </div>

        <nav className="menu-nav">
          {navItems.map((item) => (
            <Link key={item.id} to={item.link} className="menu-link" onClick={closeMenu}>
              {item.label}
            </Link>
          ))}

          <button type="button" className="menu-link menu-link-button" onClick={handleHelp}>
            Help
          </button>

          <div className="appearance-box">
            <div className="appearance-label">Appearance:</div>

            <div className="theme-row">
              <button
                type="button"
                className={`theme-button ${theme === "light" ? "active" : ""}`}
                onClick={() => handleThemeChange("light")}
              >
                Light
              </button>

              <button
                type="button"
                className={`theme-button ${theme === "dark" ? "active" : ""}`}
                onClick={() => handleThemeChange("dark")}
              >
                Dark
              </button>
            </div>
          </div>

          <div className="auth-section">
            {isAuthenticated ? (
              <button type="button" className="auth-button" onClick={handleLogout}>
                Log Out
              </button>
            ) : (
              <button type="button" className="auth-button" onClick={handleSignIn}>
                Sign In
              </button>
            )}
          </div>
        </nav>
      </aside>
    </div>
  );
}

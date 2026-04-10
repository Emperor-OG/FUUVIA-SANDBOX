// Header.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import "boxicons/css/boxicons.min.css";
import Menu from "./Menu";
import "../styles/Header.css";

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_API_URL || "";
  const NAME = import.meta.env.VITE_NAME || "FUUVIA";

  const toggleMenu = () => setMenuOpen((prev) => !prev);

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/user`, {
          credentials: "include",
        });

        if (!res.ok) throw new Error("Auth check failed");

        const data = await res.json();

        if (!isMounted) return;
        setIsAuthenticated(!!data?.authenticated);
      } catch (err) {
        if (!isMounted) return;
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [API_URL]);

  const handleSignInClick = () => {
    localStorage.setItem(
      "postLoginRedirect",
      `${window.location.pathname}${window.location.search}${window.location.hash}`
    );
    navigate("/signin");
  };

  return (
    <>
      <header className="header">
        <Link to="/market" className="LogoCon">
          <h3 className="logo">{NAME}</h3>
        </Link>

        <div className="header-buttons">
          <button className="menu-btn" onClick={toggleMenu} type="button">
            <i className="bx bx-menu"></i>
          </button>
        </div>

        {!isAuthenticated && (
          <button
            className="header-signin-tab"
            onClick={handleSignInClick}
            type="button"
          >
            <i className="bx bx-user"></i>
            <span>Sign In</span>
          </button>
        )}
      </header>

      <Menu menuOpen={menuOpen} toggleMenu={toggleMenu} />
    </>
  );
}

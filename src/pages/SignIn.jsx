import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/SignIn.css";

function SignIn() {
  const navigate = useNavigate();

  const API_URL = import.meta.env.VITE_API_URL || "";
  const NAME = import.meta.env.VITE_NAME || "FUUVIA";

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/user`, {
          credentials: "include",
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data?.authenticated) {
          const redirectTo =
            localStorage.getItem("postLoginRedirect") || "/market";
          localStorage.removeItem("postLoginRedirect");
          navigate(redirectTo, { replace: true });
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    };

    checkAuth();
  }, [navigate, API_URL]);

  const handleGoogleSignIn = () => {
    window.location.href = `${API_URL}/auth/google`;
  };

  const handleContinueAsGuest = () => {
    const redirectTo =
      localStorage.getItem("postLoginRedirect") || "/market";

    localStorage.removeItem("postLoginRedirect");

    navigate(redirectTo, { replace: true });
  };

  return (
    <div className="signin-page">
      <div className="signin-bg">
        <div className="signin-card">
          <div className="signin-brand-strip"></div>

          <div className="signin-body">
            <div className="signin-header">
              <h1 className="signin-title">Welcome to {NAME}</h1>

              <p className="signin-subtitle">
                Sign in to continue to checkout, past orders, and manage your
                stores.
              </p>
            </div>

            <div className="signin-content">
              <button
                className="google-btn"
                onClick={handleGoogleSignIn}
                type="button"
              >
                <i className="bx bxl-google google-icon"></i>
                <span>Sign in with Google</span>
              </button>

              {/* ✅ Continue as Guest */}
              <button
                className="guest-btn"
                onClick={handleContinueAsGuest}
                type="button"
              >
                <i className="bx bx-user"></i>
                <span>Continue as Guest</span>
              </button>

              <p className="signin-note">
                We use Google sign-in for a faster and safer experience.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignIn;

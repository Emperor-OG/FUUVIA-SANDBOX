import React, { useEffect, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";

import SignIn from "./pages/SignIn";
import Market from "./pages/Market";
import StoreDashboard from "./pages/StoreDashboard";
import Store from "./pages/Store";
import Checkout from "./pages/Checkout";
import PaymentSuccess from "./pages/paymentSuccess";
import Settings from "./pages/Settings";
import PastOrders from "./pages/PastOrders";

import About from "./pages/AboutUs";
import Terms from "./pages/TermsOfService";
import Privacy from "./pages/Privacy";
import Contact from "./pages/Contact";

const API_BASE = import.meta.env.VITE_API_URL || "";
const API_URL = import.meta.env.VITE_API_URL || "";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/user`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to check authentication");
        }

        const data = await res.json();

        if (!isMounted) return;

        if (data?.authenticated) {
          setStatus("authenticated");
        } else {
          const redirectPath = `${location.pathname}${location.search}${location.hash}`;
          localStorage.setItem("postLoginRedirect", redirectPath);
          setStatus("unauthenticated");
        }
      } catch (err) {
        if (!isMounted) return;

        const redirectPath = `${location.pathname}${location.search}${location.hash}`;
        localStorage.setItem("postLoginRedirect", redirectPath);
        setStatus("unauthenticated");
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, [location]);

  if (status === "loading") {
    return null;
  }

  if (status === "unauthenticated") {
    return <Navigate to="/signin" replace />;
  }

  return children;
}

function LoginSuccessRedirect() {
  useEffect(() => {
    const redirectTo = localStorage.getItem("postLoginRedirect") || "/market";
    localStorage.removeItem("postLoginRedirect");
    window.location.replace(redirectTo);
  }, []);

  return null;
}

function PublicOnlySignIn() {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const res = await fetch(`${API_URL}/auth/user`, {
          credentials: "include",
        });

        if (!res.ok) {
          throw new Error("Failed to check authentication");
        }

        const data = await res.json();

        if (!isMounted) return;

        if (data?.authenticated) {
          const redirectTo =
            localStorage.getItem("postLoginRedirect") || "/market";
          localStorage.removeItem("postLoginRedirect");
          window.location.replace(redirectTo);
        } else {
          setStatus("guest");
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus("guest");
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  if (status === "loading") {
    return null;
  }

  return <SignIn />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/market" replace />} />
      <Route path="/market" element={<Market />} />
      <Route path="/store" element={<Store />} />
      <Route path="/signin" element={<PublicOnlySignIn />} />
      <Route path="/login-success" element={<LoginSuccessRedirect />} />

      <Route
        path="/store-dashboard"
        element={
          <ProtectedRoute>
            <StoreDashboard />
          </ProtectedRoute>
        }
      />

      {/* Public page that handles signed-out state internally */}
      <Route path="/past-orders" element={<PastOrders />} />

      <Route
        path="/checkout"
        element={
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Settings />
          </ProtectedRoute>
        }
      />

      <Route path="/payment-success" element={<PaymentSuccess />} />

      <Route path="/about" element={<About />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/contact" element={<Contact />} />

      <Route path="*" element={<Navigate to="/market" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}

export default App;

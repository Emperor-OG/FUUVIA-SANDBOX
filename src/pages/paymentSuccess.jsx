// pages/PaymentSuccess.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/PaymentSuccess.css";

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const reference = searchParams.get("reference");

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [countdown, setCountdown] = useState(4);

  const API_BASE = import.meta.env.VITE_API_URL || "";

  // ---------------- VERIFY PAYMENT ----------------
  useEffect(() => {
    if (!reference) {
      setStatus("error");
      return;
    }

    const verifyPayment = async () => {
      try {
        await axios.get(`${API_BASE}/api/payments/verify/${reference}`, {
          withCredentials: true,
        });

        // ✅ Clear ALL marketplace carts
        Object.keys(localStorage)
          .filter(k => k.startsWith("cart_"))
          .forEach(k => localStorage.removeItem(k));

        setStatus("success");
      } catch (err) {
        console.error("Verification failed:", err);
        setStatus("error");
      }
    };

    verifyPayment();
  }, [reference]);

  // ---------------- REDIRECT COUNTDOWN ----------------
  useEffect(() => {
    if (status !== "success") return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/past-orders"); // 👈 redirect to PastOrders.jsx
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, navigate]);

  // ---------------- UI STATES ----------------
  if (status === "verifying") {
    return (
      <div className="payment-success-page">
        <div className="payment-card">
          <div className="spinner" />
          <h2>Confirming your payment…</h2>
          <p>Please wait while we secure your order.</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="payment-success-page">
        <div className="payment-card error">
          <h2>Payment Verification Failed</h2>
          <p>
            We couldn’t confirm this transaction. If funds were deducted,
            they will automatically reverse.
          </p>

          <button onClick={() => navigate("/cart")}>
            Return to Cart
          </button>
        </div>
      </div>
    );
  }

  // SUCCESS UI
  return (
    <div className="payment-success-page">
      <div className="payment-card success">
        <div className="checkmark">✓</div>

        <h1>Payment Successful</h1>
        <p>Your order has been placed and sent to the merchant.</p>

        <div className="redirect-box">
          Redirecting to your orders in <strong>{countdown}</strong>…
        </div>

        <button onClick={() => navigate("/past-orders")}>
          View Orders Now
        </button>
      </div>
    </div>
  );
}

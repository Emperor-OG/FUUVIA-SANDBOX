import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import "../styles/PastOrders.css";

export default function PastOrders() {
  const navigate = useNavigate();
  const [orderHistory, setOrderHistory] = useState([]);
  const [activeOrder, setActiveOrder] = useState(null);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [imageIndices, setImageIndices] = useState({});
  const [isAuthenticated, setIsAuthenticated] = useState(null);
  const API_BASE = import.meta.env.VITE_API_URL || "";

  function normalizePaymentStatus(status) {
    return String(status || "").trim().toLowerCase();
  }

  function normalizeOrderStatus(status) {
    return String(status || "").trim().toLowerCase();
  }

  function getDisplayStatus(status) {
    const normalized = normalizeOrderStatus(status);

    if (normalized === "pending") return "Order Received";
    if (normalized === "processing") return "Processing / Being Packed";
    if (normalized === "dispatch") return "Dispatched / On Its Way";
    if (normalized === "completed") return "Completed";
    if (normalized === "cancelled") return "Cancelled";

    return status || "Unknown";
  }

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const authRes = await fetch(`${API_BASE}/auth/user`, {
          credentials: "include",
        });

        if (!authRes.ok) {
          throw new Error("Failed to check authentication");
        }

        const authData = await authRes.json();

        if (!authData?.authenticated) {
          setIsAuthenticated(false);
          setOrderHistory([]);
          return;
        }

        setIsAuthenticated(true);

        const res = await axios.get(`${API_BASE}/api/orders`, {
          withCredentials: true,
        });

        if (res.data.success && Array.isArray(res.data.orders)) {
          const parsedOrders = res.data.orders
            .map((order) => ({
              ...order,
              items:
                typeof order.items === "string"
                  ? JSON.parse(order.items)
                  : Array.isArray(order.items)
                  ? order.items
                  : [],
            }))
            .filter(
              (order) => normalizePaymentStatus(order.payment_status) === "paid"
            );

          setOrderHistory(parsedOrders);

          const initialIndices = {};
          parsedOrders.forEach((order) => {
            initialIndices[order.id] = 0;
          });
          setImageIndices(initialIndices);
        } else {
          setOrderHistory([]);
        }
      } catch (err) {
        if (err?.response?.status === 401) {
          setIsAuthenticated(false);
          setOrderHistory([]);
        } else {
          console.error("Failed to fetch orders:", err);
          setIsAuthenticated(true);
          setOrderHistory([]);
        }
      } finally {
        setLoadingOrders(false);
      }
    };

    fetchOrders();
  }, [API_BASE]);

  useEffect(() => {
    if (!isAuthenticated || orderHistory.length === 0) return;

    const interval = setInterval(() => {
      setImageIndices((prev) => {
        const updated = { ...prev };

        orderHistory.forEach((order) => {
          if (order.items.length > 0) {
            const currentIndex = prev[order.id] ?? 0;
            updated[order.id] = (currentIndex + 1) % order.items.length;
          }
        });

        return updated;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [orderHistory, isAuthenticated]);

  const hasOrders = useMemo(() => orderHistory.length > 0, [orderHistory]);

  if (loadingOrders) {
    return (
      <div className="new-orders-page">
        <Header />
        <div className="new-orders-wrapper">
          <div className="orders-header">
            <h2>Orders</h2>
            <p className="orders-subtitle">Loading your paid orders...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="new-orders-page">
        <Header />

        <div className="new-orders-wrapper">
          <div className="orders-header">
            <h2>Orders</h2>
            <p className="orders-subtitle">View your paid order history here.</p>
          </div>

          <div className="orders-empty-card">
            <p>Sign in to view your past orders.</p>

            <button
              className="orders-signin-btn"
              onClick={() => {
                localStorage.setItem("postLoginRedirect", "/past-orders");
                navigate("/signin");
              }}
            >
              <i className="bx bx-user"></i>
              <span>Sign In</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="new-orders-page">
      <Header />

      <div className="new-orders-wrapper">
        <div className="orders-header">
          <h2>Orders</h2>
          <p className="orders-subtitle">Your paid order history.</p>
        </div>

        {!hasOrders && (
          <div className="orders-empty-card">
            <p>No paid orders found.</p>
          </div>
        )}

        <div className="new-orders-grid">
          {orderHistory.map((order) => (
            <div
              key={order.id}
              className="new-order-card"
              onClick={() => setActiveOrder(order)}
            >
              <div className="new-order-card-inner">
                <div className="new-order-info">
                  <p className="new-order-id">
                    <strong>Order #{order.id}</strong>
                  </p>

                  <p className="new-order-store">
                    <strong>{order.store_name}</strong>
                  </p>

                  <div className="new-order-meta">
                    <p>Total: R{Number(order.total_amount || 0).toFixed(2)}</p>
                    <p>Type: {order.type || "N/A"}</p>
                  </div>

                  <div className="new-order-tags">
                    <span className="new-order-payment-status paid">Paid</span>
                    <span
                      className={`new-order-status ${normalizeOrderStatus(
                        order.order_status
                      )}`}
                    >
                      {getDisplayStatus(order.order_status)}
                    </span>
                  </div>
                </div>

                {order.items.length > 0 && (
                  <div className="new-order-image">
                    <img
                      src={order.items[imageIndices[order.id] ?? 0]?.image}
                      alt={order.items[imageIndices[order.id] ?? 0]?.name}
                      title={order.items[imageIndices[order.id] ?? 0]?.name}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {activeOrder && (
        <div
          className="new-order-modal-overlay"
          onClick={() => setActiveOrder(null)}
        >
          <div className="new-order-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="new-modal-close-btn"
              onClick={() => setActiveOrder(null)}
              aria-label="Close"
            >
              &times;
            </button>

            <div className="new-modal-content">
              <div className="new-modal-section">
                <p className="new-modal-order-id">
                  <strong>Order #{activeOrder.id}</strong>
                </p>

                <p className="new-modal-store">
                  <strong>{activeOrder.store_name}</strong>
                </p>

                <div className="new-order-tags modal-tags">
                  <span className="new-order-payment-status paid">Paid</span>
                  <span
                    className={`new-order-status ${normalizeOrderStatus(
                      activeOrder.order_status
                    )}`}
                  >
                    {getDisplayStatus(activeOrder.order_status)}
                  </span>
                </div>
              </div>

              <div className="new-modal-section">
                <h4>Customer</h4>

                <p>
                  <strong>Name:</strong> {activeOrder.customer_name}
                </p>

                <p>
                  <strong>Email:</strong>{" "}
                  <a
                    href={`mailto:${activeOrder.customer_email}`}
                    className="new-email-link"
                  >
                    {activeOrder.customer_email}
                  </a>
                </p>

                <p>
                  <strong>Phone:</strong> {activeOrder.customer_phone}
                </p>

                <p>
                  <strong>Order Type:</strong> {activeOrder.type || "N/A"}
                </p>
              </div>

              <div className="new-modal-section">
                <h4>
                  {activeOrder.type?.toLowerCase() === "delivery"
                    ? "Delivery address"
                    : activeOrder.type?.toLowerCase() === "pickup" ||
                      activeOrder.type?.toLowerCase() === "dropoff"
                    ? "Pickup location"
                    : "Address"}
                </h4>

                {activeOrder.street && (
                  <p>
                    <strong>Street:</strong> {activeOrder.street}
                  </p>
                )}
                {activeOrder.unit && (
                  <p>
                    <strong>Unit:</strong> {activeOrder.unit}
                  </p>
                )}
                {activeOrder.building && (
                  <p>
                    <strong>Building:</strong> {activeOrder.building}
                  </p>
                )}
                {activeOrder.suburb && (
                  <p>
                    <strong>Suburb:</strong> {activeOrder.suburb}
                  </p>
                )}
                {activeOrder.city && (
                  <p>
                    <strong>City:</strong> {activeOrder.city}
                  </p>
                )}
                {activeOrder.province && (
                  <p>
                    <strong>Province:</strong> {activeOrder.province}
                  </p>
                )}
                {activeOrder.postal_code && (
                  <p>
                    <strong>Postal Code:</strong> {activeOrder.postal_code}
                  </p>
                )}
                {activeOrder.notes && (
                  <p>
                    <strong>Notes:</strong> {activeOrder.notes}
                  </p>
                )}
              </div>

              <div className="new-modal-section">
                <h4>Items</h4>

                <ul className="new-order-items-list">
                  {activeOrder.items.map((item, idx) => (
                    <li key={idx} className="new-order-item">
                      <img src={item.image} alt={item.name} />
                      <div className="new-item-info">
                        <span className="new-item-name">{item.name}</span>
                        {item.variant && (
                          <span className="new-item-variant">{item.variant}</span>
                        )}
                        <span className="new-item-qty-price">
                          x {item.quantity} = R
                          {(
                            Number(item.price || 0) * Number(item.quantity || 0)
                          ).toFixed(2)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="new-modal-section">
                <h4>Summary</h4>

                <div className="modal-summary-row">
                  <span>Subtotal</span>
                  <strong>R{Number(activeOrder.cart_total || 0).toFixed(2)}</strong>
                </div>

                <div className="modal-summary-row">
                  <span>Location Fee</span>
                  <strong>
                    R{Number(activeOrder.location_fee || 0).toFixed(2)}
                  </strong>
                </div>

                <div className="modal-summary-row modal-summary-total">
                  <span>Total</span>
                  <strong>
                    R{Number(activeOrder.total_amount || 0).toFixed(2)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// src/components/StoreOrders.jsx
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import OrderDetailModal from "./OrderDetailModal";
import StoreReportModal from "./StoreReportModal";
import "../styles/StoreOrders.css";

export default function StoreOrders({ storeId, onClose }) {
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState("pending");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    if (storeId) fetchOrders();
  }, [storeId]);

  // ----------------------------
  // Fetch store orders
  // ----------------------------
  async function fetchOrders() {
    try {
      const res = await axios.get(`/api/orders/store/${storeId}`);
      setOrders(res.data.orders || []);
    } catch (err) {
      console.error("Failed to load orders", err);
    }
  }

  // ----------------------------
  // Update order status
  // ----------------------------
  async function updateOrderStatus(orderId, newStatus) {
    try {
      await axios.put(`/api/orders/update-status/${orderId}`, {
        order_status: newStatus,
      });
      fetchOrders();
    } catch (err) {
      console.error("Failed to update status", err);
    }
  }

  // ----------------------------
  // Helpers
  // ----------------------------
  function normalizeStatus(status) {
    return String(status || "").trim().toLowerCase();
  }

  function normalizePaymentStatus(status) {
    return String(status || "").trim().toLowerCase();
  }

  function isPaidOrder(order) {
    return normalizePaymentStatus(order.payment_status) === "paid";
  }

  function getSafeItems(order) {
    try {
      const parsed =
        typeof order.items === "string" ? JSON.parse(order.items) : order.items;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function getDisplayStatus(status) {
    const normalized = normalizeStatus(status);

    if (normalized === "pending") return "New Order";
    if (normalized === "processing") return "Processing / Being Packed";
    if (normalized === "dispatch") return "Dispatch / On Its Way";
    if (normalized === "completed") return "Completed";
    if (normalized === "cancelled") return "Cancelled";

    return status || "Unknown";
  }

  function getNextStatus(status) {
    const normalized = normalizeStatus(status);

    if (normalized === "pending") return "processing";
    if (normalized === "processing") return "dispatch";
    if (normalized === "dispatch") return "completed";
    return null;
  }

  function getStatusButtonLabel(status) {
    const normalized = normalizeStatus(status);

    if (normalized === "pending") return "Mark as Processing";
    if (normalized === "processing") return "Mark as Dispatch";
    if (normalized === "dispatch") return "Mark as Completed";
    if (normalized === "completed") return "Completed";

    return "Update Status";
  }

  function formatTimestamp(ts) {
    if (!ts) return "Unknown";
    return new Date(ts).toLocaleString();
  }

  // ----------------------------
  // Visible orders for store workflow
  // Only paid orders should appear in seller workflow tabs
  // ----------------------------
  const visibleOrders = useMemo(() => {
    return orders.filter((order) => {
      const orderStatus = normalizeStatus(order.order_status);
      return (
        isPaidOrder(order) &&
        ["pending", "processing", "dispatch", "completed"].includes(orderStatus)
      );
    });
  }, [orders]);

  // ----------------------------
  // Order counters (for tabs)
  // ----------------------------
  const pendingCount = visibleOrders.filter(
    (o) => normalizeStatus(o.order_status) === "pending"
  ).length;

  const processingCount = visibleOrders.filter(
    (o) => normalizeStatus(o.order_status) === "processing"
  ).length;

  const dispatchCount = visibleOrders.filter(
    (o) => normalizeStatus(o.order_status) === "dispatch"
  ).length;

  const completedCount = visibleOrders.filter(
    (o) => normalizeStatus(o.order_status) === "completed"
  ).length;

  // ----------------------------
  // Filter orders by active tab
  // ----------------------------
  const filteredOrders = visibleOrders.filter(
    (o) => normalizeStatus(o.order_status) === activeTab
  );

  // ----------------------------
  // Store stats calculations
  // Stats based on paid/real seller orders only
  // ----------------------------
  const totalOrders = visibleOrders.length;

  let totalItems = 0;
  visibleOrders.forEach((o) => {
    const items = getSafeItems(o);
    items.forEach((i) => {
      totalItems += Number(i.quantity || 1);
    });
  });

  const totalRevenue = visibleOrders.reduce(
    (sum, o) => sum + Number(o.total_amount || 0),
    0
  );

  const avgOrderAmount = totalOrders === 0 ? 0 : totalRevenue / totalOrders;
  const avgItemsPerOrder = totalOrders === 0 ? 0 : totalItems / totalOrders;

  let avgOrdersPerDay = 0;
  let avgItemsPerDay = 0;
  let avgRevenuePerDay = 0;

  if (visibleOrders.length > 0) {
    const sortedOrders = [...visibleOrders].sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );

    const first = new Date(sortedOrders[0].created_at);
    const last = new Date();
    const diffDays = Math.max(1, (last - first) / (1000 * 60 * 60 * 24));

    avgOrdersPerDay = totalOrders / diffDays;
    avgItemsPerDay = totalItems / diffDays;
    avgRevenuePerDay = totalRevenue / diffDays;
  }

  // ----------------------------
  // Render
  // ----------------------------
  return (
    <div className="som-overlay" onClick={onClose}>
      <div className="som-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="som-header">
          <h2>Store Orders</h2>
          <button className="som-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="som-tabs">
          <button
            className={`som-tab ${activeTab === "pending" ? "active" : ""}`}
            onClick={() => setActiveTab("pending")}
          >
            New Orders
            <span className="som-tab-count">{pendingCount}</span>
          </button>

          <button
            className={`som-tab ${activeTab === "processing" ? "active" : ""}`}
            onClick={() => setActiveTab("processing")}
          >
            Processing / Being Packed
            <span className="som-tab-count">{processingCount}</span>
          </button>

          <button
            className={`som-tab ${activeTab === "dispatch" ? "active" : ""}`}
            onClick={() => setActiveTab("dispatch")}
          >
            Dispatch / On Its Way
            <span className="som-tab-count">{dispatchCount}</span>
          </button>

          <button
            className={`som-tab ${activeTab === "completed" ? "active" : ""}`}
            onClick={() => setActiveTab("completed")}
          >
            Completed
            <span className="som-tab-count">{completedCount}</span>
          </button>
        </div>

        {/* Orders List */}
        <div className="som-orders-list">
          {filteredOrders.length === 0 && (
            <p className="som-no-orders">
              No {getDisplayStatus(activeTab).toLowerCase()} orders
            </p>
          )}

          {filteredOrders.map((order) => {
            const items = getSafeItems(order);
            const nextStatus = getNextStatus(order.order_status);
            const currentStatus = normalizeStatus(order.order_status);

            return (
              <div key={order.id} className="som-order-card">
                {/* LEFT INFO */}
                <div className="som-order-info">
                  <h3>Order #{order.id}</h3>

                  <p>
                    Payment:{" "}
                    <strong>{order.payment_status || "Unknown"}</strong>
                  </p>

                  <p>
                    Status:{" "}
                    <span
                      className={`som-order-status som-order-status-${currentStatus}`}
                    >
                      {getDisplayStatus(order.order_status)}
                    </span>
                  </p>

                  <p>
                    Type: <strong>{order.type || "N/A"}</strong>
                  </p>

                  <p>Created: {formatTimestamp(order.created_at)}</p>
                  <p>Total: R{Number(order.total_amount || 0).toFixed(2)}</p>
                  <p>Items: {items.length}</p>
                </div>

                {/* CENTERED BUTTON */}
                <div className="som-details-row">
                  <button
                    className="som-details-btn"
                    onClick={() => setSelectedOrder(order)}
                  >
                    See order details
                  </button>
                </div>

                {/* RIGHT STATUS BUTTON */}
                <button
                  className={`som-status-btn ${currentStatus}`}
                  onClick={() => nextStatus && updateOrderStatus(order.id, nextStatus)}
                  disabled={!nextStatus}
                >
                  {getStatusButtonLabel(order.order_status)}
                </button>
              </div>
            );
          })}
        </div>

        {/* Stats Bar */}
        <div className="som-stats-bar">
          <div>
            <strong>Total Orders:</strong> {totalOrders}
          </div>
          <div>
            <strong>Total Items:</strong> {totalItems}
          </div>
          <div>
            <strong>Total Revenue:</strong> R{totalRevenue.toFixed(2)}
          </div>
          <div>
            <strong>Average Order:</strong> R{avgOrderAmount.toFixed(2)}
          </div>
          <div>
            <strong>Avg Items/Order:</strong> {avgItemsPerOrder.toFixed(1)}
          </div>
          <div>
            <strong>Avg Orders/Day:</strong> {avgOrdersPerDay.toFixed(2)}
          </div>
          <div>
            <strong>Avg Items/Day:</strong> {avgItemsPerDay.toFixed(1)}
          </div>
          <div>
            <strong>Avg Revenue/Day:</strong> R{avgRevenuePerDay.toFixed(2)}
          </div>
        </div>

        {/* Report Button */}
        <div style={{ marginTop: "1rem", textAlign: "center" }}>
          <button
            className="som-report-btn"
            onClick={() => setShowReport(true)}
          >
            Generate Monthly Report
          </button>
        </div>

        {/* Order Details Modal */}
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}

        {/* Store Report Modal */}
        {showReport && (
          <StoreReportModal
            orders={visibleOrders}
            onClose={() => setShowReport(false)}
          />
        )}
      </div>
    </div>
  );
}

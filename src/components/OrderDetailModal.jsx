import React from "react";
import "../styles/OrderDetailsModal.css"; // ✅ dedicated CSS file

export default function OrderDetailModal({ order, onClose }) {
  if (!order) return null;

  // Parse items safely
  let items = [];
  try {
    items =
      typeof order.items === "string"
        ? JSON.parse(order.items)
        : order.items || [];
  } catch (err) {
    console.error("Invalid items JSON:", order.items);
    items = [];
  }

  // Determine dynamic address heading
  const addressHeading =
    order.type?.toLowerCase() === "delivery"
      ? "Delivery at:"
      : order.type?.toLowerCase() === "pickup" || order.type?.toLowerCase() === "dropoff"
      ? "Pickup at:"
      : "Address:";

  return (
    <div className="odm-overlay" onClick={onClose}>
      <div className="odm-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="odm-header">
          <h2>Order #{order.id}</h2>
          <button className="odm-close-btn" onClick={onClose}>&times;</button>
        </div>

        {/* Customer Details */}
        <div className="odm-section">
          <h3>Customer Details</h3>
          <p><strong>Name:</strong> {order.customer_name}</p>
          <p>
            <strong>Email:</strong>{" "}
            <a href={`mailto:${order.customer_email}`} className="odm-email-link">
              {order.customer_email}
            </a>
          </p>
          <p><strong>Phone:</strong> {order.customer_phone}</p>
          <p><strong>Order Type:</strong> {order.type || "N/A"}</p>
        </div>

        {/* Delivery/Pickup Address */}
        <div className="odm-section">
          <h3>{addressHeading}</h3>
          {order.street && <p><strong>Street:</strong> {order.street}</p>}
          {order.unit && <p><strong>Unit:</strong> {order.unit}</p>}
          {order.building && <p><strong>Building:</strong> {order.building}</p>}
          {order.suburb && <p><strong>Suburb:</strong> {order.suburb}</p>}
          {order.city && <p><strong>City:</strong> {order.city}</p>}
          {order.province && <p><strong>Province:</strong> {order.province}</p>}
          {order.postal_code && <p><strong>Postal Code:</strong> {order.postal_code}</p>}
          {order.notes && <p><strong>Notes:</strong> {order.notes}</p>}
        </div>

        {/* Items */}
        <div className="odm-section">
          <h3>Items</h3>
          {items.length === 0 ? (
            <p className="odm-empty-items">No items found</p>
          ) : (
            <div className="odm-items-list">
              {items.map((item, idx) => (
                <div key={idx} className="odm-item-row">
                  {item.image && (
                    <img src={item.image} alt={item.name} className="odm-item-image" />
                  )}
                  <div className="odm-item-details">
                    <p><strong>Name:</strong> {item.name}</p>
                    {item.variant && <p><strong>Variant:</strong> {item.variant}</p>}
                    <p><strong>Quantity:</strong> {item.quantity}</p>
                    <p><strong>Price:</strong> R{(item.price * item.quantity).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="odm-section odm-total-section">
          <h3>Total: R{Number(order.total_amount).toFixed(2)}</h3>
        </div>
      </div>
    </div>
  );
}

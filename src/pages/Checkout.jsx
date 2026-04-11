import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import axios from "axios";
import "../styles/Checkout.css";

export default function Checkout() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const storeId = searchParams.get("id");
  const API_BASE = import.meta.env.VITE_API_URL || "";

  const [cartItems, setCartItems] = useState([]);
  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [dropoffOptions, setDropoffOptions] = useState([]);
  const [tab, setTab] = useState("delivery");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [address, setAddress] = useState({
    street: "",
    unit: "",
    building: "",
    notes: "",
  });

  const [user, setUser] = useState({
    name: "",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);

  const [storeDeliveryInfo, setStoreDeliveryInfo] = useState({
    delivers_nationwide: false,
    nationwide_fee: 0,
    nationwide_estimated_time: "",
  });

  const normalizeCartItems = (items = []) => {
    if (!Array.isArray(items)) return [];

    return items
      .map((item) => {
        const basePrice = Number(
          item.base_price ??
            item.seller_price ??
            item.product_base_price ??
            0
        );

        const markupPrice = Number(
          item.markup_price ??
            (basePrice +
              basePrice *
                ((Number(item.markup_percentage || item.markup_percent) || 10) /
                  100))
        );

        const finalPrice = Number(
          item.price ??
            item.final_price ??
            (markupPrice + Number(item.affiliate_markup || 0))
        );

        return {
          product_id: item.product_id ?? null,
          variant_id: item.variant_id ?? item.id ?? null,
          sku_id: item.sku_id ?? null,
          name: item.name ?? "",
          variant: item.variant ?? "",
          size: item.size ?? null,
          price: finalPrice,
          quantity: Math.max(1, Number(item.quantity) || Number(item.qty) || 1),
          image: item.image ?? "",
        };
      })
      .filter((item) => item.variant_id !== null);
  };

  useEffect(() => {
    let initialCart = [];

    if (location.state?.cartItems) {
      initialCart = normalizeCartItems(location.state.cartItems);
    } else if (storeId) {
      const saved = localStorage.getItem(`cart_${storeId}`);
      if (saved) {
        try {
          initialCart = normalizeCartItems(JSON.parse(saved));
        } catch (err) {
          console.warn("Cart parse failed", err);
          initialCart = [];
        }
      }
    }

    setCartItems(initialCart);
  }, [storeId, location.state]);

  useEffect(() => {
    if (!storeId) return;
    localStorage.setItem(`cart_${storeId}`, JSON.stringify(cartItems));
  }, [cartItems, storeId]);

  const cartTotal = useMemo(() => {
    return cartItems.reduce(
      (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );
  }, [cartItems]);

  const locationPrice = Number(
    selectedLocation?.price ?? storeDeliveryInfo.nationwide_fee ?? 0
  );

  const totalWithLocation = cartTotal + locationPrice;

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      setError("Store ID missing.");
      return;
    }

    const fetchLocations = async () => {
      setLoading(true);
      setError(null);

      try {
        const deliveryRes = await axios.get(
          `${API_BASE}/api/${storeId}/checkout-options`
        );

        const data = deliveryRes.data || {};

        setStoreDeliveryInfo({
          delivers_nationwide: Boolean(data.delivers_nationwide),
          nationwide_fee: Number(data.nationwide_fee || 0),
          nationwide_estimated_time: data.nationwide_estimated_time || "",
        });

        const provinces = Array.isArray(data.provinces) ? data.provinces : [];
        const cities = Array.isArray(data.cities) ? data.cities : [];

        const deliveryList = cities.map((city) => ({
          id: city.id,
          city: city.name || "",
          suburb: city.suburb || "",
          province:
            provinces.find((p) => p.id === city.province_id)?.name || "",
          price: Number(city.price ?? data.nationwide_fee ?? 0),
          estimated_time:
            city.estimated_time || data.nationwide_estimated_time || "",
          street_address: city.street_address || "",
          postal_code: city.postal_code || "",
          notes: city.notes || "",
        }));

        setDeliveryOptions(deliveryList);

        const dropoffRes = await axios.get(
          `${API_BASE}/api/dropoff_locations?store_id=${storeId}`
        );

        setDropoffOptions(dropoffRes.data?.locations || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load delivery or pickup locations");
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, [storeId, API_BASE]);

  useEffect(() => {
    setSelectedLocation(null);
    setSearchQuery("");
  }, [tab]);

  const hasValidCart =
    cartItems.length > 0 &&
    cartItems.every((item) => {
      if (!item.variant_id) return false;
      if (item.quantity < 1) return false;
      if (item.price < 0) return false;
      return true;
    });

  const canPay =
    hasValidCart &&
    selectedLocation &&
    user.name.trim() &&
    user.email.trim() &&
    user.phone.trim() &&
    (tab === "pickup" || (tab === "delivery" && address.street.trim()));

  const handlePay = async () => {
    if (!canPay || paying) return;

    setPaying(true);

    try {
      const fullAddress =
        tab === "pickup"
          ? {
              street:
                selectedLocation.street_address ||
                selectedLocation.address ||
                `${selectedLocation.city || ""}`.trim(),
              unit: "",
              building: "",
              notes: selectedLocation.notes || "",
              city: selectedLocation.city || "",
              suburb: selectedLocation.suburb || "",
              province: selectedLocation.province || "",
              postal_code: selectedLocation.postal_code || "",
            }
          : {
              street: address.street.trim(),
              unit: address.unit.trim(),
              building: address.building.trim(),
              notes: address.notes.trim(),
              city: selectedLocation.city || "",
              suburb: selectedLocation.suburb || "",
              province: selectedLocation.province || "",
              postal_code: selectedLocation.postal_code || "",
            };

      const checkoutItems = cartItems.map((item) => ({
        product_id: item.product_id ?? null,
        variant_id: item.variant_id,
        sku_id: item.sku_id ?? null,
        quantity: Number(item.quantity) || 1,
        price: Number(item.price) || 0,
        name: item.name ?? "",
        variant: item.variant ?? "",
        size: item.size ?? null,
        image: item.image ?? "",
      }));

      const { data } = await axios.post(
        `${API_BASE}/api/payments/initiate`,
        {
          items: checkoutItems,
          total: totalWithLocation,
          type: tab,
          locationId: selectedLocation.id,
          locationPrice,
          address: fullAddress,
          customerEmail: user.email.trim(),
          customerPhone: user.phone.trim(),
          customerName: user.name.trim(),
          storeId,
        },
        { withCredentials: true }
      );

      if (!data?.authorization_url) {
        throw new Error("Missing Paystack authorization URL");
      }

      window.location.href = data.authorization_url;
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || err?.response?.data?.error || "Payment initiation failed");
      setPaying(false);
    }
  };

  const currentLocations = (tab === "delivery"
    ? deliveryOptions
    : dropoffOptions
  ).filter((loc) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    return (
      (loc.city || "").toLowerCase().includes(q) ||
      (loc.province || "").toLowerCase().includes(q) ||
      (loc.suburb || "").toLowerCase().includes(q)
    );
  });

  if (loading) {
    return (
      <div className="checkout-page">
        <div className="checkout-container checkout-state-card">
          <p className="checkout-state-text">Loading checkout...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="checkout-page">
        <div className="checkout-container checkout-state-card">
          <p className="checkout-error">{error}</p>
        </div>
      </div>
    );
  }

  if (!cartItems.length) {
    return (
      <div className="checkout-page">
        <div className="checkout-container checkout-state-card">
          <p className="checkout-empty">Your cart is empty.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <div className="checkout-container">
        <div className="checkout-header">
          <h2 id="Checkout-title">Checkout</h2>
          <p className="checkout-subtitle">
            Complete your details and choose delivery or pickup.
          </p>
        </div>

        <div className="checkout-tabs">
          <button
            className={tab === "delivery" ? "active" : ""}
            onClick={() => setTab("delivery")}
            type="button"
          >
            Delivery
          </button>
          <button
            className={tab === "pickup" ? "active" : ""}
            onClick={() => setTab("pickup")}
            type="button"
          >
            Pickup
          </button>
        </div>

        <section className="checkout-section">
          <h3 className="section-title">
            {tab === "delivery" ? "Choose your area" : "Choose pickup location"}
          </h3>

          <input
            type="text"
            placeholder={
              tab === "delivery"
                ? "Search for your city, suburb or province"
                : "Search pickup location"
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="location-search"
          />

          <div className="location-list-container">
            {currentLocations.length === 0 ? (
              <p className="no-locations">No locations found.</p>
            ) : (
              currentLocations.map((loc) => (
                <div
                  key={loc.id}
                  className={`location-item ${
                    selectedLocation?.id === loc.id ? "selected" : ""
                  }`}
                  onClick={() => setSelectedLocation(loc)}
                >
                  <div className="location-item-top">
                    <h4 className="location-title">
                      {loc.city || "Unnamed location"}
                    </h4>
                    {(loc.province || loc.suburb) && (
                      <span className="location-meta">
                        {loc.suburb || loc.province}
                      </span>
                    )}
                  </div>

                  <div className="location-item-body">
                    <p>
                      <strong>Fee:</strong> R{Number(loc.price || 0).toFixed(2)}
                    </p>
                    <p>
                      <strong>ETA:</strong> {loc.estimated_time || "N/A"}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="details-block">
          <h3 className="section-title">Your details</h3>

          <div className="user-details">
            <input
              type="text"
              placeholder="Full Name"
              value={user.name}
              onChange={(e) =>
                setUser((prev) => ({ ...prev, name: e.target.value }))
              }
            />
            <input
              type="email"
              placeholder="Email Address"
              value={user.email}
              onChange={(e) =>
                setUser((prev) => ({ ...prev, email: e.target.value }))
              }
            />
            <input
              type="tel"
              placeholder="Cellphone Number"
              value={user.phone}
              onChange={(e) =>
                setUser((prev) => ({ ...prev, phone: e.target.value }))
              }
            />
          </div>

          {tab === "delivery" && selectedLocation && (
            <>
              <h3 className="section-title">Delivery address</h3>

              <div className="address-form">
                <input
                  type="text"
                  placeholder="Street Address"
                  value={address.street}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, street: e.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Unit / Complex"
                  value={address.unit}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, unit: e.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Building Name"
                  value={address.building}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, building: e.target.value }))
                  }
                />
                <input
                  type="text"
                  placeholder="Delivery Notes"
                  value={address.notes}
                  onChange={(e) =>
                    setAddress((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
            </>
          )}
        </section>

        <section className="summary">
          <h3 id="Total-price">Order Summary</h3>

          <div className="summary-row">
            <span>Subtotal</span>
            <strong>R{cartTotal.toFixed(2)}</strong>
          </div>

          <div className="summary-row">
            <span>{tab === "delivery" ? "Delivery Fee" : "Pickup Fee"}</span>
            <strong>R{locationPrice.toFixed(2)}</strong>
          </div>

          <div className="summary-row total-row">
            <span>Total</span>
            <strong>R{totalWithLocation.toFixed(2)}</strong>
          </div>

          <button
            disabled={!canPay || paying}
            onClick={handlePay}
            type="button"
            className="pay-btn"
          >
            {paying ? "Redirecting to secure payment..." : "Proceed to Payment"}
          </button>
        </section>
      </div>
    </div>
  );
}

import React, { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../styles/Cart.css";

export default function Cart({
  cartItems = [],
  showCart,
  onCloseCart,
  onRemoveItem,
  onUpdateQuantity,
  storeId: propStoreId,
  storeIsOpen = true,
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const storeId = propStoreId || searchParams.get("id");
  const API_BASE = import.meta.env.VITE_API_URL || "";

  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  const normalizedItems = useMemo(() => {
    return cartItems.map((item, index) => {
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
        ...item,
        product_id:
          item.product_id ??
          item.productId ??
          item.base_product_id ??
          item.parent_product_id ??
          null,

        variant_id:
          item.variant_id ??
          item.variantId ??
          item.id ??
          null,

        sku_id:
          item.sku_id ??
          item.skuId ??
          item.sku?.id ??
          item.sku?.sku_id ??
          null,

        store_id: item.store_id ?? storeId ?? null,
        name: item.name ?? item.product_name ?? "Item",
        variant: item.variant ?? item.variant_name ?? item.color ?? "",
        size: item.size ?? item.size_name ?? item.selectedSize ?? null,
        price: finalPrice,
        quantity: Math.max(
          1,
          Number(item.quantity ?? item.qty ?? item.count ?? 1) || 1
        ),
        image: item.image ?? item.image_url ?? "",
        cart_key:
          item.cart_key ??
          item.cartKey ??
          `${item.store_id ?? storeId ?? "no-store"}-${item.product_id ?? item.productId ?? "no-product"}-${item.variant_id ?? item.variantId ?? item.id ?? "no-variant"}-${item.sku_id ?? item.skuId ?? "no-sku"}-${item.size ?? item.size_name ?? item.selectedSize ?? "no-size"}-${index}`,
      };
    });
  }, [cartItems, storeId]);

  const total = normalizedItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  if (!showCart) return null;

  const handleCheckout = async () => {
    if (!storeIsOpen) return;

    if (!storeId) {
      alert("Store ID missing!");
      return;
    }

    try {
      setCheckingAuth(true);

      const res = await fetch(`${API_BASE}/auth/user`, {
        credentials: "include",
      });

      if (!res.ok) {
        throw new Error("Failed to check authentication");
      }

      const data = await res.json();

      if (data?.authenticated) {
        onCloseCart?.();
        navigate(`/checkout?id=${storeId}`, {
          state: { cartItems: normalizedItems },
        });
        return;
      }

      setShowSignInPrompt(true);
    } catch (err) {
      console.error("Checkout auth check failed:", err);
      setShowSignInPrompt(true);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleSignInRedirect = () => {
    localStorage.setItem("postLoginRedirect", `/checkout?id=${storeId}`);
    onCloseCart?.();
    setShowSignInPrompt(false);
    navigate("/signin");
  };

  const handleDecrease = (item) => {
    if (item.quantity <= 1) return;

    onUpdateQuantity?.(
      item.variant_id,
      item.quantity - 1,
      item.sku_id ?? null,
      item.product_id ?? null,
      item.cart_key,
      item.size ?? null
    );
  };

  const handleIncrease = (item) => {
    onUpdateQuantity?.(
      item.variant_id,
      item.quantity + 1,
      item.sku_id ?? null,
      item.product_id ?? null,
      item.cart_key,
      item.size ?? null
    );
  };

  const handleRemove = (item) => {
    onRemoveItem?.(
      item.variant_id,
      item.sku_id ?? null,
      item.product_id ?? null,
      item.cart_key,
      item.size ?? null
    );
  };

  return (
    <>
      <div className="cart-overlay" onClick={onCloseCart}>
        <div className="cart-drawer" onClick={(e) => e.stopPropagation()}>
          <div className="cart-header">
            <h2>Your Cart</h2>
            <i className="bx bx-x cart-close" onClick={onCloseCart}></i>
          </div>

          <div className="cart-items">
            {normalizedItems.length === 0 ? (
              <p className="empty-cart-text">Your cart is empty</p>
            ) : (
              normalizedItems.map((item) => (
                <div className="cart-item" key={item.cart_key}>
                  <img
                    src={item.image}
                    alt={item.name || "Cart item"}
                    className="cart-img"
                  />

                  <div className="cart-item-info">
                    <h4>{item.name}</h4>
                    {item.variant && <p>Variant: {item.variant}</p>}
                    {item.size && <p>Size: {item.size}</p>}
                    <p>R{Number(item.price || 0).toFixed(2)}</p>

                    <div className="qty-controls">
                      <button
                        className="qty-btn"
                        onClick={() => handleDecrease(item)}
                        disabled={item.quantity <= 1}
                        type="button"
                      >
                        −
                      </button>

                      <span className="qty-text">{item.quantity}</span>

                      <button
                        className="qty-btn"
                        onClick={() => handleIncrease(item)}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <i
                    className="bx bx-trash trash-btn"
                    onClick={() => handleRemove(item)}
                  ></i>
                </div>
              ))
            )}
          </div>

          {normalizedItems.length > 0 && (
            <div className="cart-footer">
              <h3>Total: R{total.toFixed(2)}</h3>
              <button
                className="checkout-btn"
                onClick={handleCheckout}
                disabled={!storeIsOpen || checkingAuth}
                title={storeIsOpen ? "Proceed to checkout" : "Store is closed"}
                style={{
                  opacity: storeIsOpen ? 1 : 0.5,
                  cursor: storeIsOpen ? "pointer" : "not-allowed",
                }}
                type="button"
              >
                {storeIsOpen
                  ? checkingAuth
                    ? "Checking..."
                    : "Checkout"
                  : "Store Closed"}
              </button>
            </div>
          )}
        </div>
      </div>

      {showSignInPrompt && (
        <div
          className="cart-overlay"
          onClick={() => setShowSignInPrompt(false)}
          style={{ zIndex: 1200 }}
        >
          <div
            className="cart-drawer"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "420px",
              width: "90%",
              minHeight: "unset",
              borderRadius: "16px",
            }}
          >
            <div className="cart-header">
              <h2>Sign In Required</h2>
              <i
                className="bx bx-x cart-close"
                onClick={() => setShowSignInPrompt(false)}
              ></i>
            </div>

            <div
              style={{
                padding: "1rem 1.25rem 0.5rem",
                textAlign: "center",
              }}
            >
              <p style={{ margin: 0 }}>
                Sign in to continue with checkout.
              </p>
            </div>

            <div
              className="cart-footer"
              style={{
                display: "flex",
                gap: "0.75rem",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <button
                className="checkout-btn"
                onClick={handleSignInRedirect}
                type="button"
              >
                <i className="bx bx-user"></i>
                Sign In
              </button>

              <button
                className="checkout-btn"
                onClick={() => setShowSignInPrompt(false)}
                type="button"
                style={{
                  background: "transparent",
                  color: "var(--text)",
                  border: "1px solid var(--border, rgba(255,255,255,0.15))",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import EUStorePanel from "../components/EUStorePanel.jsx";
import EUProductLibrary from "../components/EUProductLibrary.jsx";
import Loading from "../components/Loading.jsx";
import StoreInfo from "../components/StoreInfo.jsx";
import ProductModal from "../components/ProductModal.jsx";
import Cart from "../components/Cart.jsx";
import StoreStatus from "../components/StoreStatus.jsx";
import "../styles/Store.css";

export default function Store() {
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get("id");

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showInfoModal, setShowInfoModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [cartItems, setCartItems] = useState([]);
  const [showCart, setShowCart] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "";

  const buildCartKey = (item, index = 0) => {
    const resolvedStoreId = item.store_id ?? storeId ?? "no-store";
    const resolvedProductId = item.product_id ?? item.productId ?? "no-product";
    const resolvedVariantId =
      item.variant_id ?? item.variantId ?? item.id ?? "no-variant";
    const resolvedSkuId = item.sku_id ?? item.skuId ?? "no-sku";
    const resolvedSize =
      item.size ?? item.size_name ?? item.selectedSize ?? "no-size";

    return `${resolvedStoreId}-${resolvedProductId}-${resolvedVariantId}-${resolvedSkuId}-${resolvedSize}-${index}`;
  };

  const normalizeCartItem = (item, index = 0) => ({
    ...item,
    store_id: item.store_id ?? storeId ?? null,
    product_id: item.product_id ?? item.productId ?? null,
    variant_id: item.variant_id ?? item.variantId ?? item.id ?? null,
    sku_id: item.sku_id ?? item.skuId ?? null,
    cart_key: item.cart_key ?? item.cartKey ?? buildCartKey(item, index),
    name: item.name ?? item.product_name ?? "",
    variant: item.variant ?? item.variant_name ?? "",
    size: item.size ?? item.size_name ?? item.selectedSize ?? null,
    price: Number(item.price ?? item.amount ?? 0) || 0,
    quantity: Math.max(1, Number(item.quantity ?? item.qty ?? 1) || 1),
    image: item.image ?? item.image_url ?? "",
  });

  useEffect(() => {
    const savedCart = localStorage.getItem(`cart_${storeId}`);
    if (!savedCart) return;

    try {
      const parsed = JSON.parse(savedCart);
      const normalized = Array.isArray(parsed)
        ? parsed.map((item, index) => normalizeCartItem(item, index))
        : [];

      setCartItems(normalized);
    } catch (err) {
      console.error("Cart parse error:", err);
    }
  }, [storeId]);

  useEffect(() => {
    localStorage.setItem(`cart_${storeId}`, JSON.stringify(cartItems));
  }, [cartItems, storeId]);

  const fetchStoreAndProducts = async () => {
    if (!storeId) {
      setError("No store ID provided");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const [storeRes, productRes] = await Promise.all([
        fetch(`${API_BASE}/api/stores/storefront/${storeId}`),
        fetch(`${API_BASE}/api/stores/${storeId}/products`),
      ]);

      if (!storeRes.ok) {
        throw new Error(`Store fetch failed: ${storeRes.status}`);
      }

      if (!productRes.ok) {
        throw new Error(`Product fetch failed: ${productRes.status}`);
      }

      const storeData = await storeRes.json();
      const productData = await productRes.json();

      if (!storeData.store) {
        throw new Error("Store not found");
      }

      setStore(storeData.store);
      setProducts(productData.products || productData || []);

      localStorage.setItem(`store_${storeId}`, JSON.stringify(storeData.store));
    } catch (err) {
      console.error("Store load error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const cachedStore = localStorage.getItem(`store_${storeId}`);

    if (cachedStore) {
      try {
        setStore(JSON.parse(cachedStore));
        setLoading(false);
      } catch {
        // ignore bad cache
      }
    }

    fetchStoreAndProducts();
  }, [storeId]);

  useEffect(() => {
    if (!storeId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stores/storefront/${storeId}`);
        if (!res.ok) return;

        const data = await res.json();

        if (data.store) {
          setStore((prev) => ({
            ...prev,
            is_open: data.store.is_open,
          }));
        }
      } catch (err) {
        console.error("Store status refresh error:", err);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [storeId, API_BASE]);

  const handleActionClick = (action) => {
    if (action === "storeInfo") {
      setShowInfoModal(true);
    }
  };

  const handleAddToCart = (item) => {
    const normalizedItem = normalizeCartItem(item, cartItems.length);

    setCartItems((prev) => {
      const existing = prev.find(
        (i) =>
          i.product_id === normalizedItem.product_id &&
          i.variant_id === normalizedItem.variant_id &&
          (i.sku_id ?? null) === (normalizedItem.sku_id ?? null) &&
          String(i.size ?? "") === String(normalizedItem.size ?? "")
      );

      if (existing) {
        return prev.map((i) =>
          i.product_id === normalizedItem.product_id &&
          i.variant_id === normalizedItem.variant_id &&
          (i.sku_id ?? null) === (normalizedItem.sku_id ?? null) &&
          String(i.size ?? "") === String(normalizedItem.size ?? "")
            ? { ...i, quantity: i.quantity + normalizedItem.quantity }
            : i
        );
      }

      return [...prev, normalizedItem];
    });
  };

  const handleRemoveFromCart = (
    variantId,
    skuId = null,
    productId = null,
    cartKey = null,
    size = null
  ) => {
    setCartItems((prev) =>
      prev.filter((item) => {
        if (cartKey && item.cart_key) {
          return item.cart_key !== cartKey;
        }

        if (skuId != null) {
          return !(
            item.variant_id === variantId &&
            (item.sku_id ?? null) === skuId
          );
        }

        return !(
          item.variant_id === variantId &&
          (item.product_id ?? null) === (productId ?? null) &&
          String(item.size ?? "") === String(size ?? "")
        );
      })
    );
  };

  const handleUpdateCartQuantity = (
    variantId,
    qty,
    skuId = null,
    productId = null,
    cartKey = null,
    size = null
  ) => {
    if (qty < 1) {
      return handleRemoveFromCart(variantId, skuId, productId, cartKey, size);
    }

    setCartItems((prev) =>
      prev.map((item) => {
        if (cartKey && item.cart_key) {
          return item.cart_key === cartKey
            ? { ...item, quantity: qty }
            : item;
        }

        if (skuId != null) {
          return item.variant_id === variantId &&
            (item.sku_id ?? null) === skuId
            ? { ...item, quantity: qty }
            : item;
        }

        return item.variant_id === variantId &&
          (item.product_id ?? null) === (productId ?? null) &&
          String(item.size ?? "") === String(size ?? "")
          ? { ...item, quantity: qty }
          : item;
      })
    );
  };

  return (
    <div className="store-page">
      <Header />

      <div className="store-layout">
        <main className="store-container">
          {loading && (
            <div className="store-loading-wrap">
              <Loading message="Loading Store..." />
            </div>
          )}

          {error && <p className="store-error">{error}</p>}

          {!loading && store && (
            <>
              <section className="store-hero">
                <EUStorePanel
                  store={store}
                  onActionClick={handleActionClick}
                />
              </section>

              <section className="store-products-section">
                <EUProductLibrary
                  products={products}
                  onProductClick={(product) => setSelectedProduct(product)}
                />
              </section>
            </>
          )}
        </main>

        <Cart
          cartItems={cartItems}
          showCart={showCart}
          onCloseCart={() => setShowCart(false)}
          onRemoveItem={handleRemoveFromCart}
          onUpdateQuantity={handleUpdateCartQuantity}
          storeId={store?.id}
          storeIsOpen={store?.is_open}
        />
      </div>

      {showInfoModal && store && (
        <StoreInfo store={store} onClose={() => setShowInfoModal(false)} />
      )}

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      <button
        className="cart-float-btn"
        onClick={() => setShowCart(true)}
        aria-label="Open cart"
      >
        <i className="bx bx-cart"></i>
        {cartItems.length > 0 && (
          <span className="cart-count">{cartItems.length}</span>
        )}
      </button>

      {store && store.id && (
        <div className="store-status-floating">
          <StoreStatus storeId={store.id} isOpen={store.is_open} />
        </div>
      )}
    </div>
  );
}

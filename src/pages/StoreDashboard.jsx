// src/pages/StoreDashboard.jsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Header from "../components/Header.jsx";
import StorePanel from "../components/StorePanel.jsx";
import ProductLibrary from "../components/ProductLibrary.jsx";
import AddProductModal from "../components/AddProducts.jsx";
import EditProductModal from "../components/EditProduct.jsx";
import EditStore from "../components/EditStore.jsx";
import AddDeliveryModal from "../components/AddDeliveryModal.jsx";
import AddDropoffModal from "../components/AddDropoffModal.jsx";
import Loading from "../components/Loading.jsx";
import StoreStatus from "../components/StoreStatus.jsx";
import StoreOrdersModal from "../components/StoreOrders.jsx";
import "../styles/StoreDashboard.css";

export default function StoreDashboard() {
  const [searchParams] = useSearchParams();
  const storeId = searchParams.get("id"); // <-- read store ID from URL

  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  // Modal states
  const [modalStoreId, setModalStoreId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editingStore, setEditingStore] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showDropoffModal, setShowDropoffModal] = useState(false);
  const [showOrdersModal, setShowOrdersModal] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "";

  // =======================
  // FETCH STORE + PRODUCTS
  // =======================
  const fetchStoreAndProducts = async () => {
    if (!storeId) {
      setError("No store selected.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // --- FETCH STORE ---
      const storeRes = await fetch(
        `${API_BASE}/api/stores/storefront/${storeId}`,
        { credentials: "include" }
      );
      const storeText = await storeRes.text();
      let storeData;
      try {
        storeData = JSON.parse(storeText);
      } catch {
        console.error("Store fetch returned invalid JSON:", storeText);
        throw new Error("Failed to parse store data from server");
      }

      if (!storeData.store) throw new Error("Store not found");
      setStore(storeData.store);

      // --- FETCH PRODUCTS ---
      const productsRes = await fetch(
        `${API_BASE}/api/stores/${storeId}/products`,
        { credentials: "include" }
      );
      const productsText = await productsRes.text();
      let productsData;
      try {
        productsData = JSON.parse(productsText);
      } catch {
        console.error("Products fetch returned invalid JSON:", productsText);
        throw new Error("Failed to parse products data from server");
      }

      // Handle different formats
      if (Array.isArray(productsData)) {
        setProducts(productsData);
      } else if (Array.isArray(productsData.products)) {
        setProducts(productsData.products);
      } else if (Array.isArray(productsData.data)) {
        setProducts(productsData.data);
      } else {
        console.warn("Unexpected products API response:", productsData);
        setProducts([]);
      }
    } catch (err) {
      console.error("❌ Error fetching store or products:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStoreAndProducts();
  }, [storeId]);

  // =======================
  // UPDATE STORE STATUS EVERY 60s
  // =======================
  useEffect(() => {
    if (!storeId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/api/stores/storefront/${storeId}`);
        if (!res.ok) return;
        const text = await res.text();
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          console.warn("Skipping store status update due to invalid JSON");
          return;
        }
        if (data.store) {
          setStore((prev) => ({ ...prev, is_open: data.store.is_open }));
        }
      } catch (err) {
        console.error("Error refreshing store status:", err);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [storeId, API_BASE]);

  // =======================
  // MODAL CONTROLS
  // =======================
  const handleOpenAddModal = () => setModalStoreId(storeId);
  const handleCloseAddModal = () => setModalStoreId(null);
  const handleEditProduct = (product) => setEditingProduct(product);
  const handleCloseEditModal = () => setEditingProduct(null);
  const handleOpenEditStore = () => setEditingStore(true);
  const handleCloseEditStore = () => setEditingStore(false);
  const handleOpenDeliveryModal = () => setShowDeliveryModal(true);
  const handleCloseDeliveryModal = () => setShowDeliveryModal(false);
  const handleOpenDropoffModal = () => setShowDropoffModal(true);
  const handleCloseDropoffModal = () => setShowDropoffModal(false);

  const handleProductAdded = (newProduct) =>
    setProducts((prev) => [...prev, newProduct]);

  const handleProductUpdated = (updatedProduct) => {
    if (!updatedProduct) {
      setProducts((prev) => prev.filter((p) => p.id !== editingProduct.id));
    } else {
      setProducts((prev) =>
        prev.map((p) => (p.id === updatedProduct.id ? updatedProduct : p))
      );
    }
  };

  // =======================
  // STORE PANEL ACTIONS
  // =======================
  const handleActionClick = (action) => {
    switch (action) {
      case "addProduct":
        handleOpenAddModal();
        break;
      case "editStore":
        handleOpenEditStore();
        break;
      case "deliveryLocations":
        handleOpenDeliveryModal();
        break;
      case "dropoffLocations":
        handleOpenDropoffModal();
        break;
      case "orders":
        setShowOrdersModal(true);
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  };

  // =======================
  // RENDER
  // =======================
  if (loading)
    return (
      <div className="store-dashboard-page">
        <Header />
        <main className="store-dashboard-loading">
          <Loading message="Loading store details..." />
        </main>
      </div>
    );

  if (error)
    return (
      <div className="store-dashboard-page">
        <Header />
        <main className="store-dashboard-error">{error}</main>
      </div>
    );

  return (
    <div className="store-dashboard-page">
      <Header />
      <div className="store-dashboard-layout">
        <main className="store-dashboard-main">
          <StorePanel store={store} onActionClick={handleActionClick} />
          <ProductLibrary products={products} onEditProduct={handleEditProduct} />
        </main>
      </div>

      {/* MODALS */}
      {modalStoreId && (
        <AddProductModal
          storeId={modalStoreId}
          isOpen={!!modalStoreId}
          onClose={handleCloseAddModal}
          onProductAdded={handleProductAdded}
          setLoading={setProcessing}
        />
      )}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          storeId={storeId}
          isOpen={!!editingProduct}
          onClose={handleCloseEditModal}
          onProductUpdated={handleProductUpdated}
          setLoading={setProcessing}
        />
      )}
      {editingStore && <EditStore storeId={storeId} onClose={handleCloseEditStore} />}
      {showDeliveryModal && (
        <AddDeliveryModal
          storeId={storeId}
          isOpen={showDeliveryModal}
          onClose={handleCloseDeliveryModal}
        />
      )}
      {showDropoffModal && (
        <AddDropoffModal
          storeId={storeId}
          isOpen={showDropoffModal}
          onClose={handleCloseDropoffModal}
        />
      )}
      {showOrdersModal && (
        <StoreOrdersModal storeId={storeId} onClose={() => setShowOrdersModal(false)} />
      )}

      {/* Global processing overlay */}
      {processing && <Loading message="Processing..." />}

      {/* Floating StoreStatus */}
      {store && store.id && (
        <div className="store-status-floating">
          <StoreStatus storeId={store.id} isOpen={store.is_open} />
        </div>
      )}
    </div>
  );
}

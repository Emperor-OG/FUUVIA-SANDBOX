import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header.jsx";
import StoreCard from "../components/StoreCard.jsx";
import FavouriteCard from "../components/FavouriteCard.jsx";
import StoreModal from "../components/StoreModal.jsx";
import Loading from "../components/Loading.jsx";
import "../styles/Market.css";

export default function Market() {
  const navigate = useNavigate();

  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [userEmail, setUserEmail] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [favourites, setFavourites] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStore, setSelectedStore] = useState("");
  const [showSignInPrompt, setShowSignInPrompt] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);

  const API_BASE = import.meta.env.VITE_API_URL || "";
  const NAME = import.meta.env.VITE_NAME || "FUUVIA";

  useEffect(() => {
    const formatStores = (rawStores) =>
      rawStores.map((store) => {
        const adminEmails = [];

        for (let i = 1; i <= 10; i++) {
          if (store[`admin${i}`]) {
            adminEmails.push(String(store[`admin${i}`]).trim().toLowerCase());
          }
        }

        return {
          ...store,
          admin_emails: adminEmails,
        };
      });

    const fetchUserAndStores = async () => {
      try {
        const [userRes, storesRes] = await Promise.all([
          fetch(`${API_BASE}/auth/user`, {
            credentials: "include",
          }),
          fetch(`${API_BASE}/api/stores`, {
            credentials: "include",
          }),
        ]);

        let resolvedUserEmail = "";

        try {
          if (!userRes.ok) {
            throw new Error("Failed to fetch auth user");
          }

          const userData = await userRes.json();

          if (userData?.authenticated) {
            resolvedUserEmail = userData?.user?.email
              ? String(userData.user.email).trim().toLowerCase()
              : "";
          }
        } catch (userErr) {
          console.warn("Continuing as guest:", userErr);
        }

        setUserEmail(resolvedUserEmail);

        if (!storesRes.ok) {
          throw new Error("Failed to fetch stores");
        }

        const storesData = await storesRes.json();

        if (storesData.success && Array.isArray(storesData.stores)) {
          const formattedStores = formatStores(storesData.stores);
          setStores(formattedStores);
          setFilteredStores(formattedStores);
        } else if (Array.isArray(storesData)) {
          const formattedStores = formatStores(storesData);
          setStores(formattedStores);
          setFilteredStores(formattedStores);
        } else {
          setStores([]);
          setFilteredStores([]);
        }
      } catch (err) {
        console.error("Error fetching market data:", err);
        setStores([]);
        setFilteredStores([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserAndStores();

    try {
      const favs = JSON.parse(localStorage.getItem("favourites") || "[]");
      setFavourites(Array.isArray(favs) ? favs : []);
    } catch {
      setFavourites([]);
    }
  }, [API_BASE]);

  useEffect(() => {
    localStorage.setItem("favourites", JSON.stringify(favourites));
  }, [favourites]);

  const toggleFavourite = (store) => {
    setFavourites((prev) => {
      const exists = prev.find((s) => s.id === store.id);
      if (exists) return prev.filter((s) => s.id !== store.id);
      return [...prev, store];
    });
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
  };

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStores(stores);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();

    setFilteredStores(
      stores.filter(
        (store) =>
          (store.store_name &&
            store.store_name.toLowerCase().includes(lowerQuery)) ||
          (store.id && store.id.toString().includes(lowerQuery)) ||
          (store.province &&
            store.province.toLowerCase().includes(lowerQuery)) ||
          (store.city && store.city.toLowerCase().includes(lowerQuery)) ||
          (store.description &&
            store.description.toLowerCase().includes(lowerQuery))
      )
    );
  }, [stores, searchQuery]);

  const normalizedUserEmail = userEmail.trim().toLowerCase();

  const userStores = useMemo(() => {
    if (!normalizedUserEmail) return [];

    return stores.filter((store) => {
      const admins = Array.isArray(store.admin_emails)
        ? store.admin_emails
        : Array.from({ length: 10 }, (_, i) => store[`admin${i + 1}`])
            .filter(Boolean)
            .map((email) => String(email).trim().toLowerCase());

      return admins.includes(normalizedUserEmail);
    });
  }, [stores, normalizedUserEmail]);

  const handleSelectChange = (e) => {
    const storeId = e.target.value;
    setSelectedStore(storeId);

    if (storeId) {
      localStorage.setItem("postLoginRedirect", `/store-dashboard?id=${storeId}`);
      navigate(`/store-dashboard?id=${storeId}`);
    }
  };

  const handlePastOrdersClick = () => {
    navigate("/past-orders");
  };

  const handleAddStoreClick = async () => {
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
        const resolvedEmail = data?.user?.email
          ? String(data.user.email).trim().toLowerCase()
          : "";

        if (resolvedEmail) {
          setUserEmail(resolvedEmail);
        }

        setModalOpen(true);
        return;
      }

      setShowSignInPrompt(true);
    } catch (err) {
      console.error("Add store auth check failed:", err);
      setShowSignInPrompt(true);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleSignInRedirect = () => {
    localStorage.setItem("postLoginRedirect", "/market");
    setShowSignInPrompt(false);
    navigate("/signin");
  };

  const hasStores = stores.length > 0;
  const hasFavourites = favourites.length > 0;

  return (
    <>
      <div className="market-page">
        <Header />

        <main className="market-container">
          {loading && <Loading message="Processing..." />}

          {hasStores && !loading && (
            <div className="store-header">
              <div className="header-left">
                <div className="market-search-bar desktop-search">
                  <input
                    type="text"
                    placeholder="Search stores..."
                    value={searchQuery}
                    onChange={handleSearch}
                  />
                </div>
              </div>

              <div className="header-right">
                {userStores.length > 0 ? (
                  <select
                    value={selectedStore}
                    onChange={handleSelectChange}
                    className="store-dropdown"
                  >
                    <option value="">Select your store...</option>
                    {userStores.map((store) => (
                      <option key={store.id} value={store.id}>
                        {store.store_name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="no-store-text"></span>
                )}

                <button
                  className="add-store-btn"
                  onClick={handleAddStoreClick}
                  disabled={checkingAuth}
                  type="button"
                >
                  {checkingAuth ? "Checking..." : "+ Add Store"}
                </button>

                <button
                  className="past-orders-btn desktop-btn"
                  onClick={handlePastOrdersClick}
                  type="button"
                >
                  Past Orders
                </button>
              </div>
            </div>
          )}

          <div className="market-search-bar mobile-search">
            <input
              type="text"
              placeholder="Search stores..."
              value={searchQuery}
              onChange={handleSearch}
            />
          </div>

          <div className="market-content">
            {hasFavourites && (
              <div className="favourites-section">
                <h3 id="favourites-title">Your Favourites</h3>
                <div className="favourites-row">
                  {favourites.map((fav) => {
                    const store = stores.find((s) => s.id === fav.id) || fav;

                    return (
                      <FavouriteCard
                        key={store.id}
                        store={store}
                        onHeartClick={() => toggleFavourite(store)}
                        onClick={() => navigate(`/store?id=${store.id}`)}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {hasStores ? (
              <>
                <h3
                  className={`all-stores-label ${
                    !hasFavourites ? "no-favourites-heading" : ""
                  }`}
                >
                  {NAME} Market
                </h3>

                <div className="stores-grid">
                  {filteredStores.map((store) => (
                    <StoreCard
                      key={store.id}
                      store={store}
                      isFavourite={favourites.some((s) => s.id === store.id)}
                      onHeartClick={() => toggleFavourite(store)}
                      onClick={() => navigate(`/store?id=${store.id}`)}
                    />
                  ))}
                </div>
              </>
            ) : (
              !loading && (
                <div className="no-store-section">
                  <div
                    className="add-store-card"
                    onClick={handleAddStoreClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        handleAddStoreClick();
                      }
                    }}
                  >
                    {checkingAuth ? "Checking..." : "+ Add Store"}
                  </div>
                </div>
              )
            )}
          </div>
        </main>

        <button
          className="past-orders-btn mobile-btn"
          onClick={handlePastOrdersClick}
          type="button"
        >
          <i className="bx bx-list-check"></i>
        </button>

        {modalOpen && (
          <>
            <div className="overlay" onClick={() => setModalOpen(false)}></div>
            <StoreModal
              isOpen={modalOpen}
              onClose={() => setModalOpen(false)}
              onSubmit={() => setModalOpen(false)}
              userEmail={normalizedUserEmail}
            />
          </>
        )}
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
                Sign in to continue with adding your store.
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

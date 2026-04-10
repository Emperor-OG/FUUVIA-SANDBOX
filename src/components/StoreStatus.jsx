// src/components/StoreStatus.jsx
import React, { useEffect, useState } from "react";
import "../styles/StoreStatus.css";

function normalizeStatus(val) {
  if (val === true) return true;
  if (val === false || val === null || val === undefined) return false;
  if (typeof val === "number") return val === 1;
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    return ["true", "t", "1", "yes", "open"].includes(v);
  }
  return Boolean(val);
}

export default function StoreStatus({ storeId, isOpen }) {
  const [open, setOpen] = useState(normalizeStatus(isOpen));

  useEffect(() => {
    if (!storeId) return; // ✅ Skip until storeId exists

    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/stores/storefront/${storeId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data?.store?.is_open !== undefined) {
          setOpen(normalizeStatus(data.store.is_open));
        }
      } catch (err) {
        console.error("Error fetching store status:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [storeId]);

  const statusText = open ? "Open" : "Closed";
  const statusClass = open ? "open" : "closed";

  return (
    <div className={`store-status ${statusClass}`}>
      {statusText}
    </div>
  );
}

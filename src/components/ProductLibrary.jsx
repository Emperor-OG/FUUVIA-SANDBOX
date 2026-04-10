// src/components/ProductLibrary.jsx
import React, { useEffect, useState, useRef } from "react";
import "../styles/ProductLibrary.css";

export default function ProductLibrary({ products = [], onEditProduct }) {
  useEffect(() => {
    console.log("ProductLibrary received products:", products);
  }, [products]);

  if (!products || products.length === 0)
    return <p className="no-products">No products available at this store.</p>;

  return (
    <div className="product-library">
      <div className="product-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onEditProduct={onEditProduct}
          />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, onEditProduct }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  // ---------- Images ----------
  const mainImages = Array.isArray(product.images)
    ? product.images
    : product.images
    ? [product.images]
    : [];

  const variantImages = Array.isArray(product.variants)
    ? product.variants.map((v) => v.image).filter(Boolean)
    : [];

  const allImages = [...mainImages, ...variantImages];

  useEffect(() => {
    if (allImages.length <= 1 || isPaused) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length);
    }, 3000);

    return () => clearInterval(intervalRef.current);
  }, [allImages.length, isPaused]);

  // ---------- Pricing ----------
  const firstVariant = product?.variants?.[0] || {};
  const basePrice =
    parseFloat(firstVariant.seller_price || product.base_price) || 0;

  const markupPrice =
    parseFloat(firstVariant.markup_price) ||
    basePrice + basePrice * ((firstVariant.markup_percentage || 10) / 100);

  const finalMarkup = markupPrice.toFixed(2);

  // ---------- Stock ----------
  const totalStock =
    product.total_stock ||
    product.stock ||
    product.variants?.reduce(
      (sum, v) =>
        sum +
        (Array.isArray(v.skus)
          ? v.skus.reduce((skuSum, sku) => skuSum + (sku.stock || 0), 0)
          : v.stock || 0),
      0
    ) ||
    0;

  // ---------- Dots for 1-3 images logic ----------
  const getDots = () => {
    if (allImages.length <= 1) return [];
    return [0, 1, 2].filter((i) => i < allImages.length);
  };

  const mapDotToImageIndex = (dotIndex) => {
    if (allImages.length <= 3) return dotIndex;
    // cycle every 3 dots
    const cycle = Math.floor(currentIndex / 3);
    return (dotIndex + cycle * 3) % allImages.length;
  };

  return (
    <div className="product-card">
      {/* ---------- Images ---------- */}
      {allImages.length > 0 && (
        <div
          className="image-slideshow"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <img
            src={allImages[currentIndex]}
            alt={`${product.name} ${currentIndex + 1}`}
            className="slide-image"
          />

          {/* Dots */}
          {allImages.length > 1 && (
            <div className="slide-dots">
              {getDots().map((dot) => (
                <span
                  key={dot}
                  className={`dot ${
                    currentIndex % 3 === dot ? "active" : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(mapDotToImageIndex(dot));
                  }}
                ></span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ---------- Product Info ---------- */}
      <h3 className="product-name">{product.name}</h3>

      <p>
        Final Selling Price: <strong>R{finalMarkup}</strong>
      </p>

      <p>
        Seller's Asking Price: <strong>R{basePrice.toFixed(2)}</strong>
      </p>

      <p>
        Availability: <strong>{totalStock}</strong>
      </p>

      {onEditProduct && (
        <button
          className="edit-product-btn"
          onClick={() => onEditProduct(product)}
        >
          Edit
        </button>
      )}
    </div>
  );
}

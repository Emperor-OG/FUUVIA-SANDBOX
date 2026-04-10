// src/components/EUProductLibrary.jsx
import React, { useEffect, useState, useRef } from "react";
import "../styles/EUProductLibrary.css";

export default function EUProductLibrary({ products = [], onProductClick, onAddToCart }) {
  useEffect(() => {
  }, [products]);

  if (!products || products.length === 0)
    return <p className="no-products">No products available at this store.</p>;

  return (
    <div className="eu-product-library">
      <div className="eu-product-grid">
        {products.map((product) => (
          <EUProductCard
            key={product.id}
            product={product}
            onProductClick={onProductClick}
            onAddToCart={onAddToCart}
          />
        ))}
      </div>
    </div>
  );
}

function EUProductCard({ product, onProductClick, onAddToCart }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const intervalRef = useRef(null);

  // ---------- Image Handling ----------
  const mainImages = Array.isArray(product.images)
    ? product.images
    : product.images
    ? [product.images]
    : [];

  const variantImages = Array.isArray(product.variant_images)
    ? product.variant_images
    : product.variant_images
    ? [product.variant_images]
    : [];

  const allImages = [...mainImages, ...variantImages];

  // ---------- Slideshow ----------
  useEffect(() => {
    if (allImages.length <= 1 || isPaused) return;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length);
    }, 5000);

    return () => clearInterval(intervalRef.current);
  }, [allImages.length, isPaused]);

  // ---------- Pricing ----------
  const basePrice = parseFloat(product.base_price || product.seller_price) || 0;

  const markupPrice =
    parseFloat(product.markup_price) ||
    basePrice + basePrice * ((product.markup_percentage || 10) / 100);

  const finalMarkup = markupPrice.toFixed(2);

  // ---------- Stock ----------
  const stock =
    product.stock ||
    product.total_stock ||
    product.variants?.reduce((sum, v) => sum + (v.stock || 0), 0) ||
    0;

  // ---------- Dots logic ----------
  const getDots = () => {
    if (allImages.length <= 1) return [];
    return [0, 1, 2].filter((i) => i < allImages.length);
  };

  const mapDotToImageIndex = (dotIndex) => {
    if (allImages.length <= 3) return dotIndex;
    const cycle = Math.floor(currentIndex / 3);
    return (dotIndex + cycle * 3) % allImages.length;
  };

  return (
    <div className="eu-product-card" onClick={() => onProductClick?.(product)}>
      {/* ---------- Image Slideshow ---------- */}
      {allImages.length > 0 && (
        <div
          className="eu-image-slideshow"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          <img
            src={allImages[currentIndex]}
            alt={`${product.name} ${currentIndex + 1}`}
            className="eu-slide-image"
          />

          {/* Dots */}
          {allImages.length > 1 && (
            <div className="eu-slide-dots">
              {getDots().map((dot) => (
                <span
                  key={dot}
                  className={`eu-dot ${
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
      <div className="eu-product-info">
        <h3 className="eu-product-name">{product.name}</h3>

        <p>
          <strong>Price:</strong> R{finalMarkup}
        </p>

        <p>
          <strong>Stock:</strong> {stock > 0 ? `${stock} left` : "Out of stock"}
        </p>
      </div>

      {/* ---------- Add to Cart (optional) ---------- */}
      {/* Uncomment if needed */}
      {/*
      <button
        id="Add-to-cart-btn"
        onClick={(e) => {
          e.stopPropagation();
          onAddToCart?.(product);
        }}
      >
        <i className="bx bx-cart-add"></i>
      </button>
      */}
    </div>
  );
}

// src/components/EUProductsLibrary.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/EUProductLibrary.css";

export default function EUProductLibrary({
  products = [],
  onProductClick,
  onAddToCart,
}) {
  useEffect(() => {}, [products]);

  if (!products || products.length === 0) {
    return <p className="no-products">No products available at this store.</p>;
  }

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

  const mainImages = useMemo(() => {
    if (Array.isArray(product.images)) return product.images.filter(Boolean);
    if (product.images) return [product.images];
    return [];
  }, [product.images]);

  const variantImages = useMemo(() => {
    if (Array.isArray(product.variant_images)) {
      return product.variant_images.filter(Boolean);
    }
    if (product.variant_images) return [product.variant_images];
    return [];
  }, [product.variant_images]);

  const allImages = useMemo(() => {
    return [...mainImages, ...variantImages].filter(Boolean);
  }, [mainImages, variantImages]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [product?.id]);

  useEffect(() => {
    if (allImages.length <= 1 || isPaused) return undefined;

    intervalRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % allImages.length);
    }, 5000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [allImages.length, isPaused]);

  const basePrice = Number(product.base_price || product.seller_price || 0);

  const markupPrice = Number(
    product.markup_price ||
      (basePrice + basePrice * ((Number(product.markup_percentage) || 10) / 100))
  );

  const finalPrice = Number(
    product.price ??
      product.final_price ??
      (markupPrice + Number(product.affiliate_markup || 0))
  );

  const stock =
    Number(product.stock) ||
    Number(product.total_stock) ||
    product.variants?.reduce((sum, v) => sum + Number(v.stock || 0), 0) ||
    0;

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
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="eu-product-info">
        <h3 className="eu-product-name">{product.name}</h3>

        <p>
          <strong>Price:</strong> R{finalPrice.toFixed(2)}
        </p>

        <p>
          <strong>Stock:</strong> {stock > 0 ? `${stock} left` : "Out of stock"}
        </p>
      </div>

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

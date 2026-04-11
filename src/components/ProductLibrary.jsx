// src/components/ProductLibrary.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/ProductLibrary.css";

export default function ProductLibrary({ products = [], onEditProduct }) {
  useEffect(() => {
    console.log("ProductLibrary received products:", products);
  }, [products]);

  if (!products || products.length === 0) {
    return <p className="no-products">No products available at this store.</p>;
  }

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

  const mainImages = useMemo(() => {
    if (Array.isArray(product.images)) return product.images.filter(Boolean);
    if (product.images) return [product.images];
    return [];
  }, [product.images]);

  const variantImages = useMemo(() => {
    if (!Array.isArray(product.variants)) return [];
    return product.variants.map((v) => v.image).filter(Boolean);
  }, [product.variants]);

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
    }, 3000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [allImages.length, isPaused]);

  const firstVariant = product?.variants?.[0] || {};

  const basePrice = Number(firstVariant.seller_price || product.base_price || 0);

  const markupPrice = Number(
    firstVariant.markup_price ||
      product.markup_price ||
      (basePrice +
        basePrice * ((Number(firstVariant.markup_percentage) || 10) / 100))
  );

  const finalPrice = Number(
    firstVariant.price ??
      product.price ??
      product.final_price ??
      (markupPrice + Number(product.affiliate_markup || 0))
  );

  const totalStock =
    Number(product.total_stock) ||
    Number(product.stock) ||
    product.variants?.reduce(
      (sum, v) =>
        sum +
        (Array.isArray(v.skus)
          ? v.skus.reduce((skuSum, sku) => skuSum + Number(sku.stock || 0), 0)
          : Number(v.stock || 0)),
      0
    ) ||
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
    <div className="product-card">
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

          {allImages.length > 1 && (
            <div className="slide-dots">
              {getDots().map((dot) => (
                <span
                  key={dot}
                  className={`dot ${currentIndex % 3 === dot ? "active" : ""}`}
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

      <h3 className="product-name">{product.name}</h3>

      <p>
        Final Selling Price: <strong>R{finalPrice.toFixed(2)}</strong>
      </p>

      <p>
        Seller&apos;s Asking Price: <strong>R{basePrice.toFixed(2)}</strong>
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

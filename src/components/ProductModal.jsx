import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "../styles/ProductModal.css";

export default function ProductModal({
  product,
  onClose,
  onAddToCart,
  cartItems = [],
}) {
  const [mounted, setMounted] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [currentImage, setCurrentImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const touchStart = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!product) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [product, onClose]);

  const variants = useMemo(
    () => (Array.isArray(product?.variants) ? product.variants : []),
    [product]
  );

  const baseImages = useMemo(
    () => (Array.isArray(product?.images) ? product.images.filter(Boolean) : []),
    [product]
  );

  const variantImages = useMemo(
    () => variants.map((v) => v?.image).filter(Boolean),
    [variants]
  );

  const allImages = useMemo(
    () => [...new Set([...baseImages, ...variantImages])],
    [baseImages, variantImages]
  );

  const getVariantByImage = (img) =>
    variants.find((v) => v?.image === img) || null;

  const getVariantStock = (variant) => {
    if (!variant) return 0;

    if (Array.isArray(variant.skus) && variant.skus.length > 0) {
      return variant.skus.reduce(
        (total, sku) => total + Number(sku.stock || 0),
        0
      );
    }

    return Number(variant.stock || 0);
  };

  useEffect(() => {
    if (!product) return;

    const firstVariant = variants[0] || null;
    setSelectedVariant(firstVariant);
    setSelectedSize(null);

    if (firstVariant?.skus?.length) {
      setQuantity(0);
    } else {
      setQuantity(1);
    }

    if (firstVariant?.image) {
      const idx = allImages.indexOf(firstVariant.image);
      setCurrentImage(idx >= 0 ? idx : 0);
    } else {
      setCurrentImage(0);
    }
  }, [product, variants, allImages]);

  useEffect(() => {
    if (!selectedVariant?.image) return;

    const idx = allImages.indexOf(selectedVariant.image);
    if (idx >= 0) {
      setCurrentImage(idx);
    }
  }, [selectedVariant?.id, allImages]);

  useEffect(() => {
    const img = allImages[currentImage];
    if (!img) return;

    const variant = getVariantByImage(img);
    if (!variant) return;

    const currentHasImage = selectedVariant?.image === img;
    if (currentHasImage) return;

    setSelectedVariant((prev) => {
      if (prev?.id === variant.id) return prev;
      return variant;
    });
  }, [currentImage, allImages, selectedVariant]);

  useEffect(() => {
    if (!selectedVariant) {
      setSelectedSize(null);
      setQuantity(1);
      return;
    }

    setSelectedSize(null);
    setQuantity(
      Array.isArray(selectedVariant.skus) && selectedVariant.skus.length > 0
        ? 0
        : 1
    );
  }, [selectedVariant?.id]);

  useEffect(() => {
    if (selectedSize) {
      setQuantity(1);
    } else if (selectedVariant?.skus?.length) {
      setQuantity(0);
    }
  }, [selectedSize, selectedVariant?.id]);

  const getCartQuantity = () => {
    return cartItems.reduce((total, item) => {
      const sameProduct = item.product_id === product?.id;
      const sameVariant = item.variant_id === (selectedVariant?.id || null);
      const sameSize = (item.size || null) === (selectedSize?.size || null);

      if (sameProduct && sameVariant && sameSize) {
        return total + Number(item.quantity || 0);
      }

      return total;
    }, 0);
  };

  const rawStock =
    selectedSize?.stock ??
    selectedVariant?.stock ??
    product?.stock ??
    0;

  const availableStock = Math.max(Number(rawStock || 0) - getCartQuantity(), 0);

  const basePrice = Number(
    selectedVariant?.seller_price ??
      product?.base_price ??
      product?.seller_price ??
      0
  );

  const markupPrice = Number(
    selectedVariant?.markup_price ??
      product?.markup_price ??
      (basePrice +
        basePrice * ((selectedVariant?.markup_percentage || product?.markup_percentage || 10) / 100))
  );

  const price = Number(
    selectedVariant?.price ??
      product?.price ??
      product?.final_price ??
      (markupPrice + Number(product?.affiliate_markup || 0))
  );

  const nextImage = () => {
    if (!allImages.length) return;
    setCurrentImage((prev) => (prev + 1) % allImages.length);
  };

  const prevImage = () => {
    if (!allImages.length) return;
    setCurrentImage((prev) => (prev - 1 + allImages.length) % allImages.length);
  };

  const handleTouchStart = (e) => {
    touchStart.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStart.current == null) return;

    const diff = touchStart.current - e.changedTouches[0].clientX;

    if (diff > 50) nextImage();
    if (diff < -50) prevImage();

    touchStart.current = null;
  };

  const increaseQty = () => {
    if (quantity < availableStock) {
      setQuantity((q) => q + 1);
    }
  };

  const decreaseQty = () => {
    setQuantity((q) => Math.max(1, q - 1));
  };

  const handleAdd = () => {
    if (selectedVariant?.skus?.length && !selectedSize) {
      alert("Please select a size");
      return;
    }

    if (availableStock <= 0) {
      alert("This item is out of stock");
      return;
    }

    if (quantity <= 0 || quantity > availableStock) {
      alert("Not enough stock available");
      return;
    }

    onAddToCart?.({
      product_id: product.id,
      variant_id: selectedVariant?.id || null,
      size: selectedSize?.size || null,
      name: product.name,
      variant: selectedVariant?.name || null,
      price,
      image: selectedVariant?.image || baseImages[0] || null,
      quantity,
    });

    onClose?.();
  };

  if (!product || !mounted) return null;

  return createPortal(
    <div className="product-modal-root" role="dialog" aria-modal="true">
      <div className="product-modal-overlay" onClick={onClose} />

      <div
        className="product-modal-shell"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="product-modal-header">
          <h2>{product.name}</h2>
          <button
            className="product-modal-close"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <i className="bx bx-x" />
          </button>
        </div>

        <div className="product-modal-body">
          {allImages.length > 0 && (
            <div
              className="product-modal-slider"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {allImages.length > 1 && (
                <button
                  className="product-slide-btn left"
                  onClick={prevImage}
                  type="button"
                >
                  <i className="bx bx-chevron-left" />
                </button>
              )}

              <img
                src={allImages[currentImage]}
                className="product-slider-img"
                alt={product.name}
              />

              {allImages.length > 1 && (
                <button
                  className="product-slide-btn right"
                  onClick={nextImage}
                  type="button"
                >
                  <i className="bx bx-chevron-right" />
                </button>
              )}
            </div>
          )}

          {allImages.length > 1 && (
            <div className="product-thumbnail-row">
              {allImages.map((img, i) => (
                <img
                  key={`${img}-${i}`}
                  src={img}
                  alt=""
                  className={`product-thumbnail ${
                    i === currentImage ? "active" : ""
                  }`}
                  onClick={() => setCurrentImage(i)}
                />
              ))}
            </div>
          )}

          {variants.length > 0 && (
            <div className="product-variant-box">
              <h4>Select Variant:</h4>

              {variants.map((variant) => (
                <div key={variant.id} className="product-variant-block">
                  <label className="product-variant-option">
                    <input
                      type="radio"
                      name="variant"
                      checked={selectedVariant?.id === variant.id}
                      onChange={() => setSelectedVariant(variant)}
                    />
                    <span>
                      {variant.name}{" "}
                      <span className="product-variant-stock">
                        ({getVariantStock(variant)})
                      </span>
                    </span>
                  </label>

                  {selectedVariant?.id === variant.id &&
                    Array.isArray(variant.skus) &&
                    variant.skus.length > 0 && (
                      <div className="product-size-grid">
                        {variant.skus.map((sku, i) => (
                          <button
                            key={`${sku.size}-${i}`}
                            type="button"
                            className={`product-size-btn ${
                              selectedSize?.size === sku.size ? "active" : ""
                            }`}
                            disabled={Number(sku.stock || 0) === 0}
                            onClick={() => setSelectedSize(sku)}
                          >
                            {sku.size}{" "}
                            <span className="product-size-stock">
                              ({sku.stock})
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </div>
          )}

          {product.description && (
            <p className="product-description">{product.description}</p>
          )}

          <div className="product-price-box">
            <strong>Price:</strong> R{Number(price).toFixed(2)}
          </div>

          <div className="product-stock-box">Available: {availableStock}</div>

          <div className="product-qty-box">
            <button
              onClick={decreaseQty}
              disabled={quantity <= 1 || availableStock === 0}
              type="button"
            >
              <i className="bx bx-minus" />
            </button>

            <span>{quantity}</span>

            <button
              onClick={increaseQty}
              disabled={
                availableStock === 0 ||
                (selectedVariant?.skus?.length && !selectedSize) ||
                quantity >= availableStock
              }
              type="button"
            >
              <i className="bx bx-plus" />
            </button>
          </div>
        </div>

        <div className="product-modal-footer">
          <button
            className="product-add-btn"
            disabled={
              availableStock === 0 ||
              (selectedVariant?.skus?.length && !selectedSize)
            }
            onClick={handleAdd}
            type="button"
          >
            <i className="bx bx-cart" />
            {availableStock === 0 ? "Out of Stock" : `Add ${quantity} to Cart`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

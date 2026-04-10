// src/components/EditProduct.jsx
import { useState, useEffect } from "react";
import "../styles/EditProducts.css";

const API_URL = import.meta.env.VITE_API_URL || "";
const MARKUP_PERCENT = parseFloat(import.meta.env.VITE_MARKUP_PERCENTAGE || 12);

export default function EditProduct({
  storeId,
  product,
  isOpen,
  onClose,
  onProductUpdated,
}) {
  // -------------------------
  // Categories Dropdown
  // -------------------------
  const categories = [
    "Footwear",
    "Electronics",
    "Clothing",
    "Hats",
    "Bags (Handbags)",
    "Bags (Backpacks)",
    "Accessories",
    "Home & Garden",
    "Pots & Planters",
    "Beauty & Personal Care",
    "Sports & Fitness",
    "Toys & Games",
  ];

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load product data into form
  useEffect(() => {
    if (!product) return;

    setName(product.name || "");
    setDescription(product.description || "");
    setCategory(product.category || "");

    const loadedVariants = (product.variants || []).map((v) => ({
      id: v.id,
      name: v.name || "",
      seller_price: v.seller_price ?? "",
      markup_price:
        v.markup_price ??
        ((parseFloat(v.seller_price || 0) * (1 + MARKUP_PERCENT / 100)).toFixed(2)),
      stock: v.stock ?? "",
      image: null,
      existingImage: v.image || "",
      skus: Array.isArray(v.skus)
        ? v.skus.map((sku) => ({
            size: sku.size || "",
            stock: sku.stock || "",
          }))
        : [],
    }));

    setVariants(loadedVariants);
  }, [product]);

  if (!isOpen) return null;

  const calculateMarkup = (price) => {
    return ((parseFloat(price) || 0) * (1 + MARKUP_PERCENT / 100)).toFixed(2);
  };

  // -------------------------
  // Variant Functions
  // -------------------------
  const handleVariantChange = (index, field, value) => {
    const updated = [...variants];
    updated[index][field] = value ?? "";

    if (field === "seller_price") {
      updated[index].markup_price = calculateMarkup(value);
    }

    setVariants(updated);
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        name: "",
        seller_price: "",
        markup_price: "0.00",
        stock: "",
        image: null,
        existingImage: "",
        skus: [],
      },
    ]);
  };

  const removeVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleImageChange = (index, file) => {
    const updated = [...variants];
    updated[index].image = file ?? null;
    setVariants(updated);
  };

  // -------------------------
  // SKU Functions
  // -------------------------
  const addSku = (variantIndex) => {
    const updated = [...variants];
    updated[variantIndex].skus.push({ size: "", stock: "" });
    updated[variantIndex].stock = "";
    setVariants(updated);
  };

  const removeSku = (variantIndex, skuIndex) => {
    const updated = [...variants];
    updated[variantIndex].skus = updated[variantIndex].skus.filter(
      (_, i) => i !== skuIndex
    );
    setVariants(updated);
  };

  const handleSkuChange = (variantIndex, skuIndex, field, value) => {
    const updated = [...variants];
    updated[variantIndex].skus[skuIndex][field] = value ?? "";
    setVariants(updated);
  };

  const calculateVariantStock = (variant) => {
    if (!variant.skus.length) return Number(variant.stock || 0);

    return variant.skus.reduce((total, sku) => {
      return total + Number(sku.stock || 0);
    }, 0);
  };

  // -------------------------
  // Submit update
  // -------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name ?? "");
      formData.append("description", description ?? "");
      formData.append("category", category ?? "");

      const variantData = variants.map((v) => ({
        id: v.id,
        name: v.name ?? "",
        seller_price: v.seller_price ?? "",
        markup_price: calculateMarkup(v.seller_price),
        stock: calculateVariantStock(v),
        skus: v.skus,
      }));

      formData.append("variants", JSON.stringify(variantData));

      variants.forEach((v) => {
        if (v.image) formData.append("images", v.image);
        if (v.existingImage) formData.append("existingImages", v.existingImage);
      });

      const res = await fetch(
        `${API_URL}/api/stores/${storeId}/products/${product.id}`,
        {
          method: "PUT",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error("Failed to update product");
      }

      const data = await res.json();

      if (onProductUpdated) {
        onProductUpdated(data);
      }

      onClose();
    } catch (err) {
      console.error("Update product error:", err);
      alert("Error updating product");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Delete product
  // -------------------------
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this product?")) return;

    setLoading(true);

    try {
      const res = await fetch(
        `${API_URL}/api/stores/${storeId}/products/${product.id}`,
        {
          method: "DELETE",
        }
      );

      if (!res.ok) {
        throw new Error("Failed to delete product");
      }

      if (onProductUpdated) {
        onProductUpdated(null);
      }

      onClose();
    } catch (err) {
      console.error("Delete product error:", err);
      alert("Failed to delete product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <form onSubmit={handleSubmit} className="add-product-form">
          <h2>Edit Product</h2>

          <label>Product Name</label>
          <input
            className="form-input"
            placeholder="Product Name"
            value={name ?? ""}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label>Description</label>
          <textarea
            className="form-input"
            placeholder="Description"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />

          <label>Category</label>
          <select
            className="form-input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="">Select Category</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <h3>Variants</h3>

          {variants.map((variant, vIndex) => (
            <div key={variant.id || vIndex} className="variant-card">
              <h4>Variant {vIndex + 1}</h4>

              <label>Variant Image</label>
              <input
                className="form-input"
                type="file"
                accept="image/*"
                onChange={(e) => handleImageChange(vIndex, e.target.files?.[0] || null)}
              />

              {variant.image && (
                <img
                  src={URL.createObjectURL(variant.image)}
                  alt="Preview"
                  className="variant-preview"
                />
              )}

              {!variant.image && variant.existingImage && (
                <img
                  src={variant.existingImage}
                  alt="Existing"
                  className="variant-preview"
                />
              )}

              <label>Variant Name</label>
              <input
                className="form-input"
                placeholder="Variant Name"
                value={variant.name ?? ""}
                onChange={(e) =>
                  handleVariantChange(vIndex, "name", e.target.value)
                }
              />

              <label>Seller Price</label>
              <input
                className="form-input"
                type="number"
                step="0.01"
                placeholder="Seller Price"
                value={variant.seller_price ?? ""}
                onChange={(e) =>
                  handleVariantChange(vIndex, "seller_price", e.target.value)
                }
                required
              />

              <div className="final-price">
                Final Price ({MARKUP_PERCENT}% markup): R {variant.markup_price}
              </div>

              {variant.skus.length === 0 && (
                <>
                  <label>Variant Stock</label>
                  <input
                    className="form-input"
                    type="number"
                    placeholder="Variant Stock"
                    value={variant.stock ?? ""}
                    onChange={(e) =>
                      handleVariantChange(vIndex, "stock", e.target.value)
                    }
                  />
                </>
              )}

              {variant.skus.length > 0 && (
                <div>
                  <h4>SKUs</h4>

                  {variant.skus.map((sku, skuIndex) => (
                    <div key={skuIndex} className="sku-row">
                      <label>Size</label>
                      <input
                        className="form-input"
                        placeholder="Size"
                        value={sku.size ?? ""}
                        onChange={(e) =>
                          handleSkuChange(vIndex, skuIndex, "size", e.target.value)
                        }
                      />

                      <label>Stock</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="Stock"
                        value={sku.stock ?? ""}
                        onChange={(e) =>
                          handleSkuChange(vIndex, skuIndex, "stock", e.target.value)
                        }
                      />

                      <button
                        type="button"
                        className="remove-btn"
                        onClick={() => removeSku(vIndex, skuIndex)}
                      >
                        Remove
                      </button>
                    </div>
                  ))}

                  <button
                    type="button"
                    className="add-btn"
                    onClick={() => addSku(vIndex)}
                  >
                    Add SKU
                  </button>
                </div>
              )}

              <button
                type="button"
                className="remove-btn"
                onClick={() => removeVariant(vIndex)}
              >
                Remove Variant
              </button>

              <div className="variant-stock">
                Variant Total Stock: {calculateVariantStock(variant)}
              </div>
            </div>
          ))}

          <button type="button" className="add-btn" onClick={addVariant}>
            Add Variant
          </button>

          <br />
          <br />

          <button type="submit" className="submit-btn" disabled={loading}>
            {loading ? "Saving..." : "Update Product"}
          </button>

          <button
            type="button"
            className="delete-prod-btn"
            onClick={handleDelete}
            disabled={loading}
            style={{ marginTop: "10px", backgroundColor: "#ff4d4f" }}
          >
            Delete Product
          </button>
        </form>
      </div>
    </div>
  );
}

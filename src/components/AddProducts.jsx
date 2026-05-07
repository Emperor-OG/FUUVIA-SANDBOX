import { useState } from "react";
import "../styles/AddProducts.css";

const API_URL = import.meta.env.VITE_API_URL || "";

// -------------------------
// AddImageButton Component
// -------------------------
function AddImageButton({ image, onChange, variantIndex }) {
  const inputId = `variant-image-${variantIndex}`;

  return (
    <div
      className="add-image-card"
      onClick={() => document.getElementById(inputId).click()}
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => onChange(e.target.files[0])}
      />
      {!image && <div className="add-image-placeholder">+ Add Image</div>}
      {image && (
        <img
          src={URL.createObjectURL(image)}
          alt="Preview"
          className="image-preview"
          key={image.name}
        />
      )}
    </div>
  );
}

// -------------------------
// AddProducts Main Component
// -------------------------
export default function AddProducts({
  storeId,
  isOpen,
  onClose,
  onProductAdded,
}) {
  const MARKUP_PERCENT = parseFloat(
    import.meta.env.VITE_MARKUP_PERCENTAGE || 12
  );

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
  const [variants, setVariants] = useState([
    {
      name: "",
      seller_price: "",
      markup_price: "0.00",
      stock: "",
      image: null,
      skus: [],
    },
  ]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const calculateMarkup = (price) =>
    ((parseFloat(price) || 0) * (1 + MARKUP_PERCENT / 100)).toFixed(2);

  // -------------------------
  // Variant Functions
  // -------------------------
  const handleVariantChange = (index, field, value) => {
    const updated = [...variants];
    updated[index][field] = value;

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
        skus: [],
      },
    ]);
  };

  const removeVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleImageChange = (index, file) => {
    const updated = [...variants];
    updated[index].image = file;
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
    updated[variantIndex].skus[skuIndex][field] = value;
    setVariants(updated);
  };

  const calculateVariantStock = (variant) => {
    if (!variant.skus.length) return variant.stock || 0;

    return variant.skus.reduce(
      (total, sku) => total + Number(sku.stock || 0),
      0
    );
  };

  // -------------------------
  // Submit Function
  // -------------------------
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("description", description);
      formData.append("category", category);

      const variantData = variants.map((v) => ({
        name: v.name,
        seller_price: v.seller_price,
        markup_price: calculateMarkup(v.seller_price),
        stock: calculateVariantStock(v),
        skus: v.skus,
      }));

      formData.append("variants", JSON.stringify(variantData));

      variants.forEach((v) => {
        if (v.image) {
          formData.append("images", v.image);
        }
      });

      const res = await fetch(`${API_URL}/api/stores/${storeId}/products`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to create product");
      }

      const data = await res.json();

      if (onProductAdded) {
        onProductAdded(data);
      }

      setName("");
      setDescription("");
      setCategory("");
      setVariants([
        {
          name: "",
          seller_price: "",
          markup_price: "0.00",
          stock: "",
          image: null,
          skus: [],
        },
      ]);

      onClose();
    } catch (err) {
      console.error(err);
      alert("Error creating product");
    } finally {
      setLoading(false);
    }
  };

  // -------------------------
  // Render
  // -------------------------
  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        <form onSubmit={handleSubmit} className="add-product-form">
          <h2>Add Product</h2>

          <label>Product Name</label>
          <input
            className="form-input"
            placeholder="Product Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label>Description</label>
          <textarea
            className="form-input"
            placeholder="Description"
            value={description}
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
            <div key={vIndex} className="variant-card">
              <h4>Variant {vIndex + 1}</h4>

              <AddImageButton
                variantIndex={vIndex}
                image={variant.image}
                onChange={(file) => handleImageChange(vIndex, file)}
              />

              <label>Variant Name</label>
              <input
                className="form-input"
                placeholder="Variant Name (Red, Blue, etc)"
                value={variant.name}
                onChange={(e) =>
                  handleVariantChange(vIndex, "name", e.target.value)
                }
              />

              <label>Seller Price</label>
              <input
                className="form-input"
                type="number"
                placeholder="Seller Price"
                value={variant.seller_price}
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
                    value={variant.stock}
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
                        placeholder="Size (S, M, 10, etc)"
                        value={sku.size}
                        onChange={(e) =>
                          handleSkuChange(
                            vIndex,
                            skuIndex,
                            "size",
                            e.target.value
                          )
                        }
                      />

                      <label>Stock</label>
                      <input
                        className="form-input"
                        type="number"
                        placeholder="Stock"
                        value={sku.stock}
                        onChange={(e) =>
                          handleSkuChange(
                            vIndex,
                            skuIndex,
                            "stock",
                            e.target.value
                          )
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
                </div>
              )}

              <button
                type="button"
                className="add-btn"
                onClick={() => addSku(vIndex)}
              >
                Add SKU
              </button>

              {variants.length > 1 && (
                <button
                  type="button"
                  className="remove-btn"
                  onClick={() => removeVariant(vIndex)}
                >
                  Remove Variant
                </button>
              )}

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
            {loading ? "Saving..." : "Add Product"}
          </button>
        </form>
      </div>
    </div>
  );
}

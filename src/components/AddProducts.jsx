import { useEffect, useState } from "react";
import "../styles/AddProducts.css";

const API_URL = import.meta.env.VITE_API_URL || "";

/* =========================================================
   IMAGE COMPONENT
========================================================= */
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

      {!image && (
        <div className="add-image-placeholder">+ Add Image</div>
      )}

      {image && (
        <img
          src={URL.createObjectURL(image)}
          alt="preview"
          className="image-preview"
        />
      )}
    </div>
  );
}

/* =========================================================
   MAIN COMPONENT
========================================================= */
export default function AddProducts({
  storeId,
  isOpen,
  onClose,
  onProductAdded,
}) {
  /* -------------------------
     STATE
  ------------------------- */
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // NOW USING category_id (NOT STRING)
  const [categoryId, setCategoryId] = useState("");

  const [categories, setCategories] = useState([]);

  const [variants, setVariants] = useState([
    {
      name: "",
      seller_price: "",
      stock: "",
      image: null,
      skus: [],
    },
  ]);

  const [loading, setLoading] = useState(false);

  /* -------------------------
     FETCH CATEGORIES FROM DB
  ------------------------- */
  useEffect(() => {
    if (!isOpen) return;

    const fetchCategories = async () => {
      try {
        const res = await fetch(`${API_URL}/api/categories`);
        const data = await res.json();
        setCategories(data);
      } catch (err) {
        console.error("Failed to load categories", err);
      }
    };

    fetchCategories();
  }, [isOpen]);

  if (!isOpen) return null;

  /* -------------------------
     VARIANTS
  ------------------------- */
  const handleVariantChange = (index, field, value) => {
    const updated = [...variants];
    updated[index][field] = value;
    setVariants(updated);
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        name: "",
        seller_price: "",
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

  /* -------------------------
     SKU LOGIC
  ------------------------- */
  const addSku = (variantIndex) => {
    const updated = [...variants];
    updated[variantIndex].skus.push({ size: "", stock: "" });
    setVariants(updated);
  };

  const removeSku = (vIndex, skuIndex) => {
    const updated = [...variants];
    updated[vIndex].skus = updated[vIndex].skus.filter(
      (_, i) => i !== skuIndex
    );
    setVariants(updated);
  };

  const handleSkuChange = (vIndex, skuIndex, field, value) => {
    const updated = [...variants];
    updated[vIndex].skus[skuIndex][field] = value;
    setVariants(updated);
  };

  const calculateVariantStock = (variant) => {
    if (!variant.skus.length) return Number(variant.stock || 0);

    return variant.skus.reduce(
      (sum, sku) => sum + Number(sku.stock || 0),
      0
    );
  };

  /* -------------------------
     SUBMIT (NO PRICING LOGIC)
  ------------------------- */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("name", name);
      formData.append("description", description);
      formData.append("category_id", categoryId);

      const variantData = variants.map((v) => ({
        name: v.name,
        seller_price: v.seller_price,
        stock: calculateVariantStock(v),
        skus: v.skus,
      }));

      formData.append("variants", JSON.stringify(variantData));

      variants.forEach((v) => {
        if (v.image) formData.append("images", v.image);
      });

      const res = await fetch(
        `${API_URL}/api/stores/${storeId}/products`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed");

      onProductAdded?.(data);

      // reset
      setName("");
      setDescription("");
      setCategoryId("");
      setVariants([
        {
          name: "",
          seller_price: "",
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

  /* -------------------------
     UI
  ------------------------- */
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
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label>Description</label>
          <textarea
            className="form-input"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {/* ================= CATEGORY FROM DB ================= */}
          <label>Category</label>
          <select
            className="form-input"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Select Category</option>

            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
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
                onChange={(file) =>
                  handleImageChange(vIndex, file)
                }
              />

              <label>Variant Name</label>
              <input
                className="form-input"
                value={variant.name}
                onChange={(e) =>
                  handleVariantChange(
                    vIndex,
                    "name",
                    e.target.value
                  )
                }
              />

              <label>Seller Price</label>
              <input
                className="form-input"
                type="number"
                value={variant.seller_price}
                onChange={(e) =>
                  handleVariantChange(
                    vIndex,
                    "seller_price",
                    e.target.value
                  )
                }
                required
              />

              <label>Stock</label>
              <input
                className="form-input"
                type="number"
                value={variant.stock}
                onChange={(e) =>
                  handleVariantChange(
                    vIndex,
                    "stock",
                    e.target.value
                  )
                }
              />

              {/* SKU */}
              {variant.skus.map((sku, sIndex) => (
                <div key={sIndex} className="sku-row">
                  <input
                    placeholder="Size"
                    value={sku.size}
                    onChange={(e) =>
                      handleSkuChange(
                        vIndex,
                        sIndex,
                        "size",
                        e.target.value
                      )
                    }
                  />

                  <input
                    type="number"
                    placeholder="Stock"
                    value={sku.stock}
                    onChange={(e) =>
                      handleSkuChange(
                        vIndex,
                        sIndex,
                        "stock",
                        e.target.value
                      )
                    }
                  />

                  <button
                    type="button"
                    onClick={() =>
                      removeSku(vIndex, sIndex)
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() => addSku(vIndex)}
              >
                Add SKU
              </button>

              <div className="variant-stock">
                Total Stock: {calculateVariantStock(variant)}
              </div>

              {variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(vIndex)}
                >
                  Remove Variant
                </button>
              )}
            </div>
          ))}

          <button type="button" onClick={addVariant}>
            Add Variant
          </button>

          <button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Add Product"}
          </button>
        </form>

      </div>
    </div>
  );
}

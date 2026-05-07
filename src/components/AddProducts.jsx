import {
  useEffect,
  useState,
} from "react";

import "../styles/AddProducts.css";

const API_URL =
  import.meta.env.VITE_API_URL || "";

/* =========================================================
   ADD IMAGE BUTTON
========================================================= */
function AddImageButton({
  image,
  onChange,
  variantIndex,
}) {
  const inputId = `variant-image-${variantIndex}`;

  return (
    <div
      className="add-image-card"
      onClick={() =>
        document
          .getElementById(inputId)
          .click()
      }
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) =>
          onChange(e.target.files[0])
        }
      />

      {!image && (
        <div className="add-image-placeholder">
          + Add Image
        </div>
      )}

      {image && (
        <img
          src={URL.createObjectURL(image)}
          alt="Preview"
          className="image-preview"
        />
      )}
    </div>
  );
}

/* =========================================================
   ADD PRODUCTS
========================================================= */
export default function AddProducts({
  storeId,
  isOpen,
  onClose,
  onProductAdded,
}) {
  /* =========================================================
     STATE
  ========================================================= */
  const [categories, setCategories] =
    useState([]);

  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [category, setCategory] =
    useState("");

  const [variants, setVariants] =
    useState([
      {
        name: "",
        seller_price: "",
        stock: "",
        image: null,
        skus: [],
      },
    ]);

  const [loading, setLoading] =
    useState(false);

  const [loadingCategories, setLoadingCategories] =
    useState(true);

  /* =========================================================
     FETCH CATEGORIES
  ========================================================= */
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/categories`
        );

        if (!res.ok) {
          throw new Error(
            "Failed to fetch categories"
          );
        }

        const data = await res.json();

        setCategories(data);
      } catch (err) {
        console.error(
          "Categories fetch error:",
          err
        );
      } finally {
        setLoadingCategories(false);
      }
    };

    fetchCategories();
  }, []);

  if (!isOpen) return null;

  /* =========================================================
     VARIANT FUNCTIONS
  ========================================================= */
  const handleVariantChange = (
    index,
    field,
    value
  ) => {
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
    setVariants(
      variants.filter((_, i) => i !== index)
    );
  };

  const handleImageChange = (
    index,
    file
  ) => {
    const updated = [...variants];

    updated[index].image = file;

    setVariants(updated);
  };

  /* =========================================================
     SKU FUNCTIONS
  ========================================================= */
  const addSku = (variantIndex) => {
    const updated = [...variants];

    updated[variantIndex].skus.push({
      size: "",
      stock: "",
    });

    updated[variantIndex].stock = "";

    setVariants(updated);
  };

  const removeSku = (
    variantIndex,
    skuIndex
  ) => {
    const updated = [...variants];

    updated[variantIndex].skus =
      updated[variantIndex].skus.filter(
        (_, i) => i !== skuIndex
      );

    setVariants(updated);
  };

  const handleSkuChange = (
    variantIndex,
    skuIndex,
    field,
    value
  ) => {
    const updated = [...variants];

    updated[variantIndex].skus[skuIndex][
      field
    ] = value;

    setVariants(updated);
  };

  const calculateVariantStock = (
    variant
  ) => {
    if (!variant.skus.length) {
      return variant.stock || 0;
    }

    return variant.skus.reduce(
      (total, sku) =>
        total + Number(sku.stock || 0),
      0
    );
  };

  /* =========================================================
     SUBMIT
  ========================================================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("name", name);

      formData.append(
        "description",
        description
      );

      formData.append(
        "category",
        category
      );

      const variantData = variants.map(
        (v) => ({
          name: v.name,
          seller_price: v.seller_price,
          stock:
            calculateVariantStock(v),
          skus: v.skus,
        })
      );

      formData.append(
        "variants",
        JSON.stringify(variantData)
      );

      variants.forEach((v) => {
        if (v.image) {
          formData.append(
            "images",
            v.image
          );
        }
      });

      const res = await fetch(
        `${API_URL}/api/stores/${storeId}/products`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (!res.ok) {
        throw new Error(
          "Failed to create product"
        );
      }

      const data = await res.json();

      if (onProductAdded) {
        onProductAdded(data);
      }

      /* RESET */
      setName("");

      setDescription("");

      setCategory("");

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

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <div className="modal-overlay">
      <div className="modal">
        <button
          className="modal-close"
          onClick={onClose}
        >
          ✕
        </button>

        <form
          onSubmit={handleSubmit}
          className="add-product-form"
        >
          <h2>Add Product</h2>

          {/* PRODUCT NAME */}
          <label>Product Name</label>

          <input
            className="form-input"
            placeholder="Product Name"
            value={name}
            onChange={(e) =>
              setName(e.target.value)
            }
            required
          />

          {/* DESCRIPTION */}
          <label>Description</label>

          <textarea
            className="form-input"
            placeholder="Description"
            value={description}
            onChange={(e) =>
              setDescription(
                e.target.value
              )
            }
          />

          {/* CATEGORY */}
          <label>Category</label>

          <select
            className="form-input"
            value={category}
            onChange={(e) =>
              setCategory(
                e.target.value
              )
            }
            required
          >
            <option value="">
              {loadingCategories
                ? "Loading categories..."
                : "Select Category"}
            </option>

            {categories.map((cat) => (
              <option
                key={cat.id}
                value={cat.name}
              >
                {cat.name}
              </option>
            ))}
          </select>

          <h3>Variants</h3>

          {/* VARIANTS */}
          {variants.map(
            (variant, vIndex) => (
              <div
                key={vIndex}
                className="variant-card"
              >
                <h4>
                  Variant {vIndex + 1}
                </h4>

                <AddImageButton
                  variantIndex={vIndex}
                  image={variant.image}
                  onChange={(file) =>
                    handleImageChange(
                      vIndex,
                      file
                    )
                  }
                />

                {/* VARIANT NAME */}
                <label>
                  Variant Name
                </label>

                <input
                  className="form-input"
                  placeholder="Variant Name"
                  value={variant.name}
                  onChange={(e) =>
                    handleVariantChange(
                      vIndex,
                      "name",
                      e.target.value
                    )
                  }
                />

                {/* SELLER PRICE */}
                <label>
                  Seller Price
                </label>

                <input
                  className="form-input"
                  type="number"
                  placeholder="Seller Price"
                  value={
                    variant.seller_price
                  }
                  onChange={(e) =>
                    handleVariantChange(
                      vIndex,
                      "seller_price",
                      e.target.value
                    )
                  }
                  required
                />

                <div className="final-price">
                  Final selling price will
                  be calculated
                  automatically based on
                  category pricing.
                </div>

                {/* STOCK */}
                {variant.skus.length ===
                  0 && (
                  <>
                    <label>
                      Variant Stock
                    </label>

                    <input
                      className="form-input"
                      type="number"
                      placeholder="Variant Stock"
                      value={
                        variant.stock
                      }
                      onChange={(e) =>
                        handleVariantChange(
                          vIndex,
                          "stock",
                          e.target.value
                        )
                      }
                    />
                  </>
                )}

                {/* SKUS */}
                {variant.skus.length >
                  0 && (
                  <div>
                    <h4>SKUs</h4>

                    {variant.skus.map(
                      (
                        sku,
                        skuIndex
                      ) => (
                        <div
                          key={skuIndex}
                          className="sku-row"
                        >
                          <label>
                            Size
                          </label>

                          <input
                            className="form-input"
                            placeholder="Size"
                            value={sku.size}
                            onChange={(
                              e
                            ) =>
                              handleSkuChange(
                                vIndex,
                                skuIndex,
                                "size",
                                e.target
                                  .value
                              )
                            }
                          />

                          <label>
                            Stock
                          </label>

                          <input
                            className="form-input"
                            type="number"
                            placeholder="Stock"
                            value={sku.stock}
                            onChange={(
                              e
                            ) =>
                              handleSkuChange(
                                vIndex,
                                skuIndex,
                                "stock",
                                e.target
                                  .value
                              )
                            }
                          />

                          <button
                            type="button"
                            className="remove-btn"
                            onClick={() =>
                              removeSku(
                                vIndex,
                                skuIndex
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}

                {/* ADD SKU */}
                <button
                  type="button"
                  className="add-btn"
                  onClick={() =>
                    addSku(vIndex)
                  }
                >
                  Add SKU
                </button>

                {/* REMOVE VARIANT */}
                {variants.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() =>
                      removeVariant(
                        vIndex
                      )
                    }
                  >
                    Remove Variant
                  </button>
                )}

                {/* TOTAL STOCK */}
                <div className="variant-stock">
                  Variant Total Stock:{" "}
                  {calculateVariantStock(
                    variant
                  )}
                </div>
              </div>
            )
          )}

          {/* ADD VARIANT */}
          <button
            type="button"
            className="add-btn"
            onClick={addVariant}
          >
            Add Variant
          </button>

          <br />
          <br />

          {/* SUBMIT */}
          <button
            type="submit"
            className="submit-btn"
            disabled={
              loading ||
              loadingCategories
            }
          >
            {loading
              ? "Saving..."
              : "Add Product"}
          </button>
        </form>
      </div>
    </div>
  );
}

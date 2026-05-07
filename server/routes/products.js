const express = require("express");
const router = express.Router();
const multer = require("multer");

const pool = require("../db");

const { uploadFileToBucket, buckets } = require("../GCS");

const {
  calculatePricing,
  AFFILIATE_MARKUP_PERCENT,
} = require("../config/pricing");

require("dotenv").config();

/* =========================================================
   MULTER
========================================================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

/* =========================================================
   SAFE IMAGE UPLOAD (FIXED)
========================================================= */
async function safelyUploadImage(file) {
  try {
    if (!file?.buffer) return null;

    // IMPORTANT: DO NOT re-wrap Buffer again unnecessarily
    return await uploadFileToBucket(file, buckets.storeProducts);
  } catch (err) {
    console.error("Image upload failed:", err);
    return null;
  }
}

/* =========================================================
   CREATE PRODUCT
========================================================= */
router.post(
  "/:storeId/products",
  upload.array("images"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { storeId } = req.params;
      const { name, description, category, variants } = req.body;

      if (!name || !variants) {
        return res.status(400).json({
          error: "Name and variants required",
        });
      }

      let parsedVariants;
      try {
        parsedVariants = JSON.parse(variants);
      } catch {
        return res.status(400).json({
          error: "Invalid variants JSON",
        });
      }

      await client.query("BEGIN");

      const productRes = await client.query(
        `
        INSERT INTO products (store_id, name, description, category, stock)
        VALUES ($1,$2,$3,$4,0)
        RETURNING *
        `,
        [storeId, name, description || "", category || null]
      );

      const product = productRes.rows[0];

      let productStockTotal = 0;
      const uploadedVariants = [];

      /* =========================================================
         FIX: safer image mapping (fallback by index OR null)
      ========================================================= */
      const files = req.files || [];

      for (let i = 0; i < parsedVariants.length; i++) {
        const v = parsedVariants[i];

        const file = files[i]; // may be undefined safely

        let imageUrl = null;

        if (file?.buffer) {
          imageUrl = await safelyUploadImage(file);
        }

        const variantStock =
          Array.isArray(v.skus) && v.skus.length
            ? v.skus.reduce((sum, sku) => sum + Number(sku.stock || 0), 0)
            : Number(v.stock || 0);

        const pricing = await calculatePricing({
          client,
          sellerPrice: v.seller_price,
          category,
        });

        const variantRes = await client.query(
          `
          INSERT INTO variants (
            product_id,
            name,
            seller_price,
            markup_price,
            final_price,
            stock,
            image_url,
            markup_percent,
            affiliate_markup_percent
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
          RETURNING *
          `,
          [
            product.id,
            v.name || "",
            pricing.seller_price,
            pricing.markup_price,
            pricing.final_price,
            variantStock,
            imageUrl,
            pricing.markup_percentage,
            pricing.affiliate_markup_percentage,
          ]
        );

        const variant = variantRes.rows[0];

        if (Array.isArray(v.skus) && v.skus.length) {
          for (const sku of v.skus) {
            await client.query(
              `
              INSERT INTO skus (variant_id, size, stock)
              VALUES ($1,$2,$3)
              `,
              [variant.id, sku.size || "", Number(sku.stock || 0)]
            );
          }
        }

        productStockTotal += variantStock;

        uploadedVariants.push({
          id: variant.id,
          name: variant.name,
          seller_price: Number(variant.seller_price || 0),
          markup_price: Number(variant.markup_price || 0),
          price: Number(variant.final_price || 0),
          affiliate_markup_percentage: Number(
            variant.affiliate_markup_percent || 0
          ),
          stock: Number(variant.stock || 0),
          image: variant.image_url || null,
          markup_percentage: Number(variant.markup_percent || 0),
          skus: Array.isArray(v.skus) ? v.skus : [],
        });
      }

      await client.query(
        `UPDATE products SET stock=$1 WHERE id=$2`,
        [productStockTotal, product.id]
      );

      await client.query("COMMIT");

      const firstVariant = uploadedVariants[0] || null;

      res.json({
        id: product.id,
        store_id: product.store_id,
        name: product.name,
        description: product.description,
        category: product.category,
        stock: productStockTotal,

        base_price: firstVariant?.seller_price || 0,
        markup_price: firstVariant?.markup_price || 0,
        price: firstVariant?.price || 0,

        affiliate_markup_percentage:
          firstVariant?.affiliate_markup_percentage ||
          AFFILIATE_MARKUP_PERCENT,

        markup_percentage: firstVariant?.markup_percentage || 0,

        images: uploadedVariants.map((v) => v.image).filter(Boolean),
        variants: uploadedVariants,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Product creation error:", err);

      res.status(500).json({
        error: "Failed to create product",
        details: err.message,
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   GET PRODUCTS (UNCHANGED LOGIC)
========================================================= */
router.get("/:storeId/products", async (req, res) => {
  try {
    const { storeId } = req.params;

    const productsRes = await pool.query(
      `SELECT * FROM products WHERE store_id=$1 ORDER BY id DESC`,
      [storeId]
    );

    const products = productsRes.rows;

    if (!products.length) return res.json([]);

    const productIds = products.map((p) => p.id);

    const variantsRes = await pool.query(
      `SELECT * FROM variants WHERE product_id = ANY($1::int[]) ORDER BY id ASC`,
      [productIds]
    );

    const variants = variantsRes.rows;

    const variantIds = variants.map((v) => v.id);

    let skus = [];

    if (variantIds.length) {
      const skusRes = await pool.query(
        `SELECT variant_id, size, stock FROM skus WHERE variant_id = ANY($1::int[])`,
        [variantIds]
      );

      skus = skusRes.rows;
    }

    const skuMap = {};
    for (const sku of skus) {
      if (!skuMap[sku.variant_id]) skuMap[sku.variant_id] = [];
      skuMap[sku.variant_id].push({
        size: sku.size,
        stock: Number(sku.stock || 0),
      });
    }

    const variantMap = {};

    for (const v of variants) {
      const variantObj = {
        id: v.id,
        name: v.name,
        seller_price: Number(v.seller_price || 0),
        markup_price: Number(v.markup_price || 0),
        price: Number(v.final_price || 0),
        affiliate_markup_percentage: Number(
          v.affiliate_markup_percent || 0
        ),
        stock: Number(v.stock || 0),
        image: v.image_url || null,
        skus: skuMap[v.id] || [],
        markup_percentage: Number(v.markup_percent || 0),
      };

      if (!variantMap[v.product_id]) variantMap[v.product_id] = [];
      variantMap[v.product_id].push(variantObj);
    }

    const response = products.map((p) => {
      const productVariants = variantMap[p.id] || [];

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        stock: Number(p.stock || 0),

        base_price: productVariants[0]?.seller_price || 0,
        markup_price: productVariants[0]?.markup_price || 0,
        price: productVariants[0]?.price || 0,

        affiliate_markup_percentage:
          productVariants[0]?.affiliate_markup_percentage ||
          AFFILIATE_MARKUP_PERCENT,

        markup_percentage: productVariants[0]?.markup_percentage || 0,

        images: productVariants.map((v) => v.image).filter(Boolean),
        variants: productVariants,
      };
    });

    res.json(response);
  } catch (err) {
    console.error("GET products error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================================================
   UPDATE PRODUCT (UNCHANGED LOGIC)
========================================================= */
router.put(
  "/:storeId/products/:productId",
  upload.array("images"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { storeId, productId } = req.params;
      const { name, description, category, variants } = req.body;

      const parsedVariants = JSON.parse(variants);

      await client.query("BEGIN");

      await client.query(
        `UPDATE products SET name=$1, description=$2, category=$3 WHERE id=$4 AND store_id=$5`,
        [name, description, category, productId, storeId]
      );

      const existing = await client.query(
        `SELECT * FROM variants WHERE product_id=$1`,
        [productId]
      );

      const existingVariants = existing.rows;

      let totalStock = 0;

      for (let i = 0; i < parsedVariants.length; i++) {
        const v = parsedVariants[i];
        const existingVariant = existingVariants.find(
          (ev) => ev.name === v.name
        );

        let imageUrl = existingVariant?.image_url || null;

        if (req.files?.[i]) {
          imageUrl = await safelyUploadImage(req.files[i]);
        }

        const stock =
          Array.isArray(v.skus) && v.skus.length
            ? v.skus.reduce((s, x) => s + Number(x.stock || 0), 0)
            : Number(v.stock || 0);

        totalStock += stock;

        const pricing = await calculatePricing({
          client,
          sellerPrice: v.seller_price,
          category,
        });

        if (existingVariant) {
          await client.query(
            `UPDATE variants SET seller_price=$1, markup_price=$2, final_price=$3, stock=$4, image_url=$5 WHERE id=$6`,
            [
              pricing.seller_price,
              pricing.markup_price,
              pricing.final_price,
              stock,
              imageUrl,
              existingVariant.id,
            ]
          );
        } else {
          await client.query(
            `INSERT INTO variants (product_id,name,seller_price,markup_price,final_price,stock,image_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [
              productId,
              v.name,
              pricing.seller_price,
              pricing.markup_price,
              pricing.final_price,
              stock,
              imageUrl,
            ]
          );
        }
      }

      await client.query(
        `UPDATE products SET stock=$1 WHERE id=$2`,
        [totalStock, productId]
      );

      await client.query("COMMIT");

      res.json({ message: "Updated" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Failed update" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   DELETE PRODUCT (UNCHANGED LOGIC)
========================================================= */
router.delete("/:storeId/products/:productId", async (req, res) => {
  const client = await pool.connect();

  try {
    const { storeId, productId } = req.params;

    const variants = await client.query(
      `SELECT id FROM variants WHERE product_id=$1`,
      [productId]
    );

    for (const v of variants.rows) {
      await client.query(`DELETE FROM skus WHERE variant_id=$1`, [v.id]);
    }

    await client.query(`DELETE FROM variants WHERE product_id=$1`, [
      productId,
    ]);

    await client.query(
      `DELETE FROM products WHERE id=$1 AND store_id=$2`,
      [productId, storeId]
    );

    res.json({ message: "Deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Delete failed" });
  } finally {
    client.release();
  }
});

module.exports = router;

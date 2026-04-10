// routes/products.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db");
const { uploadFileToBucket, buckets } = require("../GCS");
require("dotenv").config();

const MARKUP_PERCENTAGE = parseFloat(process.env.MARKUP_PERCENTAGE || 11.25);

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =========================================================
   CREATE PRODUCT
   POST /api/stores/:storeId/products
========================================================= */
router.post("/:storeId/products", upload.array("images"), async (req, res) => {
  const client = await pool.connect();

  try {
    const { storeId } = req.params;
    const { name, description, category, variants } = req.body;

    if (!name || !variants)
      return res.status(400).json({ error: "Name and variants required" });

    const parsedVariants = JSON.parse(variants);

    await client.query("BEGIN");

    const productRes = await client.query(
      `INSERT INTO products (store_id, name, description, category, stock)
       VALUES ($1,$2,$3,$4,0)
       RETURNING *`,
      [storeId, name, description, category]
    );

    const product = productRes.rows[0];

    let productStockTotal = 0;
    const uploadedVariants = [];

    for (let i = 0; i < parsedVariants.length; i++) {
      const v = parsedVariants[i];

      let imageUrl = null;
      if (req.files && req.files[i]) {
        imageUrl = await uploadFileToBucket(
          req.files[i],
          buckets.storeProducts
        );
      }

      const variantStock = v.skus?.length
        ? v.skus.reduce((sum, sku) => sum + Number(sku.stock || 0), 0)
        : Number(v.stock || 0);

      const sellerPrice = Number(v.seller_price || 0);

      const markupPrice = +(
        sellerPrice +
        sellerPrice * (MARKUP_PERCENTAGE / 100)
      ).toFixed(2);

      const variantRes = await client.query(
        `INSERT INTO variants
        (product_id,name,seller_price,markup_price,stock,image_url,markup_percent)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
        RETURNING *`,
        [
          product.id,
          v.name,
          sellerPrice,
          markupPrice,
          variantStock,
          imageUrl,
          MARKUP_PERCENTAGE,
        ]
      );

      const variant = variantRes.rows[0];

      if (v.skus?.length) {
        for (const sku of v.skus) {
          await client.query(
            `INSERT INTO skus (variant_id,size,stock)
             VALUES ($1,$2,$3)`,
            [variant.id, sku.size, sku.stock]
          );
        }
      }

      productStockTotal += variantStock;

      uploadedVariants.push({
        ...variant,
        skus: v.skus || [],
      });
    }

    await client.query(
      `UPDATE products SET stock=$1 WHERE id=$2`,
      [productStockTotal, product.id]
    );

    await client.query("COMMIT");

    res.json({
      ...product,
      stock: productStockTotal,
      variants: uploadedVariants,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Product creation error:", err);
    res.status(500).json({ error: "Failed to create product" });
  } finally {
    client.release();
  }
});

/* =========================================================
   GET STORE PRODUCTS (OPTIMIZED)
   GET /api/stores/:storeId/products
========================================================= */
router.get("/:storeId/products", async (req, res) => {
  try {
    const { storeId } = req.params;

    /* 1️⃣ Products */
    const productsRes = await pool.query(
      `SELECT * FROM products
       WHERE store_id=$1
       ORDER BY id DESC`,
      [storeId]
    );

    const products = productsRes.rows;

    if (!products.length) return res.json([]);

    const productIds = products.map((p) => p.id);

    /* 2️⃣ Variants */
    const variantsRes = await pool.query(
      `SELECT *
       FROM variants
       WHERE product_id = ANY($1::int[])
       ORDER BY id ASC`,
      [productIds]
    );

    const variants = variantsRes.rows;

    const variantIds = variants.map((v) => v.id);

    /* 3️⃣ SKUs */
    let skus = [];

    if (variantIds.length) {
      const skusRes = await pool.query(
        `SELECT variant_id,size,stock
         FROM skus
         WHERE variant_id = ANY($1::int[])
         ORDER BY id ASC`,
        [variantIds]
      );

      skus = skusRes.rows;
    }

    /* Build SKU map */
    const skuMap = {};

    for (const sku of skus) {
      if (!skuMap[sku.variant_id]) skuMap[sku.variant_id] = [];

      skuMap[sku.variant_id].push({
        size: sku.size,
        stock: sku.stock,
      });
    }

    /* Build Variant map */
    const variantMap = {};

    for (const v of variants) {
      const variantObj = {
        id: v.id,
        name: v.name,
        seller_price: v.seller_price,
        markup_price: v.markup_price,
        stock: v.stock,
        image: v.image_url || null,
        skus: skuMap[v.id] || [],
        markup_percentage: v.markup_percent,
      };

      if (!variantMap[v.product_id]) variantMap[v.product_id] = [];

      variantMap[v.product_id].push(variantObj);
    }

    /* Build final response */
    const response = products.map((p) => {
      const variants = variantMap[p.id] || [];

      const mainImages = p.main_image ? [p.main_image] : [];
      const variantImages = variants.map((v) => v.image).filter(Boolean);

      const firstVariant = variants[0];

      const base_price = firstVariant?.seller_price || 0;
      const markup_price = firstVariant?.markup_price || 0;
      const markup_percentage =
        firstVariant?.markup_percentage || MARKUP_PERCENTAGE;

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        stock: p.stock,
        base_price,
        markup_price,
        markup_percentage,
        images: [...mainImages, ...variantImages],
        variants,
      };
    });

    res.json(response);
  } catch (err) {
    console.error("GET products error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================================================
   UPDATE PRODUCT
========================================================= */
router.put("/:storeId/products/:productId", upload.array("images"), async (req, res) => {
  const client = await pool.connect();

  try {
    const { storeId, productId } = req.params;
    const { name, description, category, variants } = req.body;

    if (!name || !variants)
      return res.status(400).json({ error: "Name and variants required" });

    const parsedVariants = JSON.parse(variants);

    await client.query("BEGIN");

    await client.query(
      `UPDATE products
       SET name=$1,description=$2,category=$3
       WHERE id=$4 AND store_id=$5`,
      [name, description, category, productId, storeId]
    );

    const existingVariantsRes = await client.query(
      `SELECT * FROM variants WHERE product_id=$1`,
      [productId]
    );

    const existingVariants = existingVariantsRes.rows;

    const parsedVariantNames = parsedVariants.map((v) => v.name);

    for (const ev of existingVariants) {
      if (!parsedVariantNames.includes(ev.name)) {
        await client.query(`DELETE FROM skus WHERE variant_id=$1`, [ev.id]);
        await client.query(`DELETE FROM variants WHERE id=$1`, [ev.id]);
      }
    }

    let totalStock = 0;

    for (let i = 0; i < parsedVariants.length; i++) {
      const v = parsedVariants[i];

      let existingVariant = existingVariants.find(
        (ev) => ev.name === v.name
      );

      let imageUrl = existingVariant?.image_url || null;

      if (req.files && req.files[i]) {
        imageUrl = await uploadFileToBucket(
          req.files[i],
          buckets.storeProducts
        );
      }

      const variantStock = v.skus?.length
        ? v.skus.reduce((sum, sku) => sum + Number(sku.stock || 0), 0)
        : Number(v.stock || 0);

      totalStock += variantStock;

      const sellerPrice = Number(v.seller_price || 0);

      const markupPrice = +(
        sellerPrice +
        sellerPrice * (MARKUP_PERCENTAGE / 100)
      ).toFixed(2);

      let variantId;

      if (existingVariant) {
        await client.query(
          `UPDATE variants
           SET seller_price=$1,markup_price=$2,stock=$3,image_url=$4
           WHERE id=$5`,
          [sellerPrice, markupPrice, variantStock, imageUrl, existingVariant.id]
        );

        variantId = existingVariant.id;

        await client.query(`DELETE FROM skus WHERE variant_id=$1`, [variantId]);
      } else {
        const variantRes = await client.query(
          `INSERT INTO variants
          (product_id,name,seller_price,markup_price,stock,image_url,markup_percent)
          VALUES ($1,$2,$3,$4,$5,$6,$7)
          RETURNING id`,
          [
            productId,
            v.name,
            sellerPrice,
            markupPrice,
            variantStock,
            imageUrl,
            MARKUP_PERCENTAGE,
          ]
        );

        variantId = variantRes.rows[0].id;
      }

      if (v.skus?.length) {
        for (const sku of v.skus) {
          await client.query(
            `INSERT INTO skus (variant_id,size,stock)
             VALUES ($1,$2,$3)`,
            [variantId, sku.size, sku.stock]
          );
        }
      }
    }

    await client.query(
      `UPDATE products SET stock=$1 WHERE id=$2`,
      [totalStock, productId]
    );

    await client.query("COMMIT");

    res.json({ message: "Product updated successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Update product error:", err);
    res.status(500).json({ error: "Failed to update product" });
  } finally {
    client.release();
  }
});

/* =========================================================
   DELETE PRODUCT
========================================================= */
router.delete("/:storeId/products/:productId", async (req, res) => {
  const client = await pool.connect();

  try {
    const { storeId, productId } = req.params;

    const variantsRes = await client.query(
      `SELECT id FROM variants WHERE product_id=$1`,
      [productId]
    );

    for (const v of variantsRes.rows) {
      await client.query(`DELETE FROM skus WHERE variant_id=$1`, [v.id]);
    }

    await client.query(`DELETE FROM variants WHERE product_id=$1`, [productId]);

    await client.query(
      `DELETE FROM products WHERE id=$1 AND store_id=$2`,
      [productId, storeId]
    );

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  } finally {
    client.release();
  }
});

module.exports = router;

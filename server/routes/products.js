const express = require("express");
const router = express.Router();
const multer = require("multer");

const pool = require("../db");
const { uploadFileToBucket, buckets } = require("../GCS");

const {
  MARKUP_PERCENTAGE,
  AFFILIATE_MARKUP,
  getMarkupPrice,
  getFinalPrice,
} = require("../config/pricing");

require("dotenv").config();

/* =========================================================
   MULTER
========================================================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

/* =========================================================
   SAFE UPLOAD
========================================================= */
async function uploadImage(file) {
  if (!file?.buffer) return null;
  return uploadFileToBucket(file, buckets.storeProducts);
}

/* =========================================================
   CREATE PRODUCT
   POST /api/stores/:storeId/products
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
        return res.status(400).json({ error: "Name and variants required" });
      }

      const parsedVariants = JSON.parse(variants);
      const files = req.files || [];

      await client.query("BEGIN");

      const productRes = await client.query(
        `INSERT INTO products (store_id,name,description,category,stock)
         VALUES ($1,$2,$3,$4,0)
         RETURNING *`,
        [storeId, name, description || "", category || null]
      );

      const product = productRes.rows[0];

      let totalStock = 0;
      const uploadedVariants = [];

      /* =========================================================
         MAIN FIX: SAFE IMAGE MATCHING
         (each variant gets its own image if provided)
      ========================================================= */
      for (let i = 0; i < parsedVariants.length; i++) {
        const v = parsedVariants[i];

        const file = files[i]; // safe indexed mapping

        const imageUrl = file ? await uploadImage(file) : null;

        const variantStock =
          Array.isArray(v.skus) && v.skus.length
            ? v.skus.reduce((sum, s) => sum + Number(s.stock || 0), 0)
            : Number(v.stock || 0);

        const sellerPrice = Number(v.seller_price || 0);
        const markupPrice = getMarkupPrice(sellerPrice);
        const finalPrice = getFinalPrice(markupPrice);

        const variantRes = await client.query(
          `INSERT INTO variants
          (
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
          RETURNING *`,
          [
            product.id,
            v.name || "",
            sellerPrice,
            markupPrice,
            finalPrice,
            variantStock,
            imageUrl,
            MARKUP_PERCENTAGE,
            AFFILIATE_MARKUP,
          ]
        );

        const variant = variantRes.rows[0];

        /* =========================================================
           SKUS
        ========================================================= */
        if (Array.isArray(v.skus) && v.skus.length) {
          for (const sku of v.skus) {
            await client.query(
              `INSERT INTO skus (variant_id,size,stock)
               VALUES ($1,$2,$3)`,
              [variant.id, sku.size || "", Number(sku.stock || 0)]
            );
          }
        }

        totalStock += variantStock;

        uploadedVariants.push({
          id: variant.id,
          name: variant.name,
          seller_price: sellerPrice,
          markup_price: markupPrice,
          price: finalPrice,
          stock: variantStock,
          image: imageUrl,
          skus: v.skus || [],
        });
      }

      /* =========================================================
         UPDATE PRODUCT STOCK
      ========================================================= */
      await client.query(
        `UPDATE products SET stock=$1 WHERE id=$2`,
        [totalStock, product.id]
      );

      await client.query("COMMIT");

      res.json({
        id: product.id,
        store_id: product.store_id,
        name,
        description,
        category,
        stock: totalStock,
        images: uploadedVariants.map((v) => v.image).filter(Boolean),
        variants: uploadedVariants,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("CREATE PRODUCT ERROR:", err);
      res.status(500).json({ error: "Failed to create product" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   GET PRODUCTS
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
      `SELECT * FROM variants WHERE product_id = ANY($1::int[])`,
      [productIds]
    );

    const variants = variantsRes.rows;

    const variantMap = {};

    for (const v of variants) {
      if (!variantMap[v.product_id]) variantMap[v.product_id] = [];

      variantMap[v.product_id].push({
        id: v.id,
        name: v.name,
        seller_price: Number(v.seller_price || 0),
        markup_price: Number(v.markup_price || 0),
        price: Number(v.final_price || 0),
        stock: Number(v.stock || 0),
        image: v.image_url || null,
      });
    }

    const response = products.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      category: p.category,
      stock: Number(p.stock || 0),
      images: (variantMap[p.id] || [])
        .map((v) => v.image)
        .filter(Boolean),
      variants: variantMap[p.id] || [],
    }));

    res.json(response);
  } catch (err) {
    console.error("GET PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================================================
   UPDATE PRODUCT (same upload logic fixed)
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
      const files = req.files || [];

      await client.query("BEGIN");

      await client.query(
        `UPDATE products SET name=$1,description=$2,category=$3
         WHERE id=$4 AND store_id=$5`,
        [name, description, category, productId, storeId]
      );

      const existingRes = await client.query(
        `SELECT * FROM variants WHERE product_id=$1`,
        [productId]
      );

      const existing = existingRes.rows;

      let totalStock = 0;

      for (let i = 0; i < parsedVariants.length; i++) {
        const v = parsedVariants[i];
        const file = files[i];

        let imageUrl =
          existing.find((e) => e.name === v.name)?.image_url || null;

        if (file) imageUrl = await uploadImage(file);

        const sellerPrice = Number(v.seller_price || 0);
        const markupPrice = getMarkupPrice(sellerPrice);
        const finalPrice = getFinalPrice(markupPrice);

        const stock = Array.isArray(v.skus)
          ? v.skus.reduce((a, b) => a + Number(b.stock || 0), 0)
          : Number(v.stock || 0);

        totalStock += stock;

        let variantId;

        const found = existing.find((e) => e.name === v.name);

        if (found) {
          await client.query(
            `UPDATE variants
             SET seller_price=$1,markup_price=$2,final_price=$3,stock=$4,image_url=$5
             WHERE id=$6`,
            [sellerPrice, markupPrice, finalPrice, stock, imageUrl, found.id]
          );

          variantId = found.id;

          await client.query(`DELETE FROM skus WHERE variant_id=$1`, [
            variantId,
          ]);
        } else {
          const r = await client.query(
            `INSERT INTO variants
             (product_id,name,seller_price,markup_price,final_price,stock,image_url)
             VALUES ($1,$2,$3,$4,$5,$6,$7)
             RETURNING id`,
            [
              productId,
              v.name,
              sellerPrice,
              markupPrice,
              finalPrice,
              stock,
              imageUrl,
            ]
          );

          variantId = r.rows[0].id;
        }

        if (Array.isArray(v.skus)) {
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

      res.json({ message: "Updated" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(err);
      res.status(500).json({ error: "Update failed" });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   DELETE PRODUCT
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

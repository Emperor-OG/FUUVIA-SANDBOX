const express = require("express");
const router = express.Router();
const multer = require("multer");
const pool = require("../db");
const { uploadFileToBucket, buckets } = require("../GCS");
const {
  AFFILIATE_MARKUP,
  calculateFinalPrice,
  DEFAULT_MARKUP_PERCENTAGE,
} = require("../config/pricing");

require("dotenv").config();

const storage = multer.memoryStorage();
const upload = multer({ storage });

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
      const { name, description, category_id, variants } = req.body;

      if (!name || !variants || !category_id) {
        return res.status(400).json({
          error: "Name, category_id and variants required",
        });
      }

      const parsedVariants = JSON.parse(variants);

      await client.query("BEGIN");

      const productRes = await client.query(
        `INSERT INTO products (store_id, name, description, category_id, stock)
         VALUES ($1,$2,$3,$4,0)
         RETURNING *`,
        [storeId, name, description, category_id]
      );

      const product = productRes.rows[0];

      // GET CATEGORY MARKUP (SAFE)
      const categoryRes = await client.query(
        `SELECT markup_percent FROM categories WHERE id=$1`,
        [category_id]
      );

      const categoryMarkup =
        categoryRes.rows[0]?.markup_percent ?? null;

      let totalStock = 0;
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

        const sellerPrice = Number(v.seller_price || 0);

        const finalPrice = calculateFinalPrice({
          sellerPrice,
          categoryMarkupPercent: categoryMarkup,
        });

        const variantStock = Array.isArray(v.skus) && v.skus.length
          ? v.skus.reduce(
              (sum, sku) => sum + Number(sku.stock || 0),
              0
            )
          : Number(v.stock || 0);

        const variantRes = await client.query(
          `INSERT INTO variants
           (product_id,name,seller_price,stock,image_url,final_price)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING *`,
          [
            product.id,
            v.name,
            sellerPrice,
            variantStock,
            imageUrl,
            finalPrice,
          ]
        );

        const variant = variantRes.rows[0];

        if (Array.isArray(v.skus)) {
          for (const sku of v.skus) {
            await client.query(
              `INSERT INTO skus (variant_id,size,stock)
               VALUES ($1,$2,$3)`,
              [variant.id, sku.size, sku.stock]
            );
          }
        }

        totalStock += variantStock;

        uploadedVariants.push({
          id: variant.id,
          name: variant.name,
          seller_price: sellerPrice,
          price: finalPrice,
          stock: variantStock,
          image: imageUrl,
          skus: v.skus || [],
        });
      }

      await client.query(
        `UPDATE products SET stock=$1 WHERE id=$2`,
        [totalStock, product.id]
      );

      await client.query("COMMIT");

      res.json({
        ...product,
        stock: totalStock,
        affiliate_markup: AFFILIATE_MARKUP,
        variants: uploadedVariants,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("CREATE product error:", err);
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
      `SELECT v.*, c.markup_percent
       FROM variants v
       JOIN products p ON v.product_id = p.id
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE v.product_id = ANY($1::int[])
       ORDER BY v.id ASC`,
      [productIds]
    );

    const grouped = {};

    for (const v of variantsRes.rows) {
      const finalPrice = calculateFinalPrice({
        sellerPrice: v.seller_price,
        categoryMarkupPercent: v.markup_percent,
      });

      const obj = {
        id: v.id,
        name: v.name,
        seller_price: Number(v.seller_price || 0),
        price: finalPrice,
        stock: Number(v.stock || 0),
        image: v.image_url,
      };

      if (!grouped[v.product_id]) grouped[v.product_id] = [];
      grouped[v.product_id].push(obj);
    }

    const response = products.map((p) => {
      const variants = grouped[p.id] || [];

      return {
        id: p.id,
        name: p.name,
        description: p.description,
        category_id: p.category_id,
        stock: Number(p.stock || 0),
        price: variants[0]?.price || 0,
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
router.put(
  "/:storeId/products/:productId",
  upload.array("images"),
  async (req, res) => {
    const client = await pool.connect();

    try {
      const { storeId, productId } = req.params;
      const { name, description, category_id, variants } = req.body;

      const parsedVariants = JSON.parse(variants);

      await client.query("BEGIN");

      await client.query(
        `UPDATE products
         SET name=$1,description=$2,category_id=$3
         WHERE id=$4 AND store_id=$5`,
        [name, description, category_id, productId, storeId]
      );

      const categoryRes = await client.query(
        `SELECT markup_percent FROM categories WHERE id=$1`,
        [category_id]
      );

      const categoryMarkup =
        categoryRes.rows[0]?.markup_percent ?? null;

      const existing = await client.query(
        `SELECT * FROM variants WHERE product_id=$1`,
        [productId]
      );

      let totalStock = 0;

      for (let i = 0; i < parsedVariants.length; i++) {
        const v = parsedVariants[i];

        const sellerPrice = Number(v.seller_price || 0);

        const finalPrice = calculateFinalPrice({
          sellerPrice,
          categoryMarkupPercent: categoryMarkup,
        });

        const stock = Number(v.stock || 0);

        totalStock += stock;

        const match = existing.rows.find(
          (e) => e.name === v.name
        );

        if (match) {
          await client.query(
            `UPDATE variants
             SET seller_price=$1,stock=$2,image_url=$3,final_price=$4
             WHERE id=$5`,
            [
              sellerPrice,
              stock,
              match.image_url,
              finalPrice,
              match.id,
            ]
          );
        }
      }

      await client.query(
        `UPDATE products SET stock=$1 WHERE id=$2`,
        [totalStock, productId]
      );

      await client.query("COMMIT");

      res.json({ message: "Updated successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("UPDATE product error:", err);
      res.status(500).json({ error: "Failed to update product" });
    } finally {
      client.release();
    }
  }
);

module.exports = router;

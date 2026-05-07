const express = require("express");
const router = express.Router();
const multer = require("multer");

const pool = require("../db");

const {
  uploadFileToBucket,
  buckets,
} = require("../GCS");

const {
  calculatePricing,
  AFFILIATE_MARKUP_PERCENT,
} = require("../config/pricing");

require("dotenv").config();

/* =========================================================
   MULTER
========================================================= */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024,
  },
});

/* =========================================================
   SAFE IMAGE UPLOAD
========================================================= */
async function safelyUploadImage(file) {
  try {
    if (
      !file ||
      !file.buffer ||
      !file.originalname
    ) {
      return null;
    }

    const safeFile = {
      ...file,
      buffer: Buffer.from(file.buffer),
    };

    const imageUrl =
      await uploadFileToBucket(
        safeFile,
        buckets.storeProducts
      );

    return imageUrl;
  } catch (err) {
    console.error(
      "Image upload failed:",
      err
    );

    return null;
  }
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

      const {
        name,
        description,
        category,
        variants,
      } = req.body;

      if (!name || !variants) {
        return res.status(400).json({
          error:
            "Name and variants required",
        });
      }

      let parsedVariants = [];

      try {
        parsedVariants =
          JSON.parse(variants);
      } catch (err) {
        return res.status(400).json({
          error:
            "Invalid variants JSON",
        });
      }

      await client.query("BEGIN");

      const productRes =
        await client.query(
          `
          INSERT INTO products
          (
            store_id,
            name,
            description,
            category,
            stock
          )
          VALUES ($1,$2,$3,$4,0)
          RETURNING *
          `,
          [
            storeId,
            name,
            description || "",
            category || null,
          ]
        );

      const product =
        productRes.rows[0];

      let productStockTotal = 0;

      const uploadedVariants = [];

      for (
        let i = 0;
        i < parsedVariants.length;
        i++
      ) {
        const v = parsedVariants[i];

        /* =========================================================
           IMAGE
        ========================================================= */
        let imageUrl = null;

        if (
          req.files &&
          req.files[i]
        ) {
          imageUrl =
            await safelyUploadImage(
              req.files[i]
            );
        }

        /* =========================================================
           STOCK
        ========================================================= */
        const variantStock =
          Array.isArray(v.skus) &&
          v.skus.length
            ? v.skus.reduce(
                (sum, sku) =>
                  sum +
                  Number(
                    sku.stock || 0
                  ),
                0
              )
            : Number(v.stock || 0);

        /* =========================================================
           PRICING
        ========================================================= */
        const pricing =
          await calculatePricing({
            client,
            sellerPrice:
              v.seller_price,
            category,
          });

        /* =========================================================
           INSERT VARIANT
        ========================================================= */
        const variantRes =
          await client.query(
            `
            INSERT INTO variants
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
            VALUES
            (
              $1,$2,$3,$4,$5,$6,$7,$8,$9
            )
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

        const variant =
          variantRes.rows[0];

        /* =========================================================
           INSERT SKUS
        ========================================================= */
        if (
          Array.isArray(v.skus) &&
          v.skus.length
        ) {
          for (const sku of v.skus) {
            await client.query(
              `
              INSERT INTO skus
              (
                variant_id,
                size,
                stock
              )
              VALUES ($1,$2,$3)
              `,
              [
                variant.id,
                sku.size || "",
                Number(
                  sku.stock || 0
                ),
              ]
            );
          }
        }

        productStockTotal +=
          variantStock;

        uploadedVariants.push({
          id: variant.id,

          name: variant.name,

          seller_price: Number(
            variant.seller_price || 0
          ),

          markup_price: Number(
            variant.markup_price || 0
          ),

          price: Number(
            variant.final_price || 0
          ),

          affiliate_markup_percentage:
            Number(
              variant.affiliate_markup_percent ||
                0
            ),

          stock: Number(
            variant.stock || 0
          ),

          image:
            variant.image_url ||
            null,

          markup_percentage:
            Number(
              variant.markup_percent ||
                0
            ),

          skus: Array.isArray(
            v.skus
          )
            ? v.skus
            : [],
        });
      }

      /* =========================================================
         UPDATE PRODUCT STOCK
      ========================================================= */
      await client.query(
        `
        UPDATE products
        SET stock=$1
        WHERE id=$2
        `,
        [
          productStockTotal,
          product.id,
        ]
      );

      await client.query("COMMIT");

      const firstVariant =
        uploadedVariants[0] || null;

      res.json({
        id: product.id,

        store_id:
          product.store_id,

        name: product.name,

        description:
          product.description,

        category:
          product.category,

        stock: productStockTotal,

        base_price:
          firstVariant
            ?.seller_price || 0,

        markup_price:
          firstVariant
            ?.markup_price || 0,

        price:
          firstVariant?.price || 0,

        affiliate_markup_percentage:
          firstVariant?.affiliate_markup_percentage ||
          AFFILIATE_MARKUP_PERCENT,

        markup_percentage:
          firstVariant?.markup_percentage ||
          0,

        images: uploadedVariants
          .map((v) => v.image)
          .filter(Boolean),

        variants: uploadedVariants,
      });
    } catch (err) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Product creation error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to create product",
        details: err.message,
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   GET STORE PRODUCTS
========================================================= */
router.get(
  "/:storeId/products",
  async (req, res) => {
    try {
      const { storeId } =
        req.params;

      const productsRes =
        await pool.query(
          `
          SELECT *
          FROM products
          WHERE store_id=$1
          ORDER BY id DESC
          `,
          [storeId]
        );

      const products =
        productsRes.rows;

      if (!products.length) {
        return res.json([]);
      }

      const productIds =
        products.map((p) => p.id);

      const variantsRes =
        await pool.query(
          `
          SELECT *
          FROM variants
          WHERE product_id = ANY($1::int[])
          ORDER BY id ASC
          `,
          [productIds]
        );

      const variants =
        variantsRes.rows;

      const variantIds =
        variants.map((v) => v.id);

      let skus = [];

      if (variantIds.length) {
        const skusRes =
          await pool.query(
            `
            SELECT
              variant_id,
              size,
              stock
            FROM skus
            WHERE variant_id = ANY($1::int[])
            ORDER BY id ASC
            `,
            [variantIds]
          );

        skus = skusRes.rows;
      }

      const skuMap = {};

      for (const sku of skus) {
        if (
          !skuMap[sku.variant_id]
        ) {
          skuMap[sku.variant_id] =
            [];
        }

        skuMap[
          sku.variant_id
        ].push({
          size: sku.size,

          stock: Number(
            sku.stock || 0
          ),
        });
      }

      const variantMap = {};

      for (const v of variants) {
        const variantObj = {
          id: v.id,

          name: v.name,

          seller_price: Number(
            v.seller_price || 0
          ),

          markup_price: Number(
            v.markup_price || 0
          ),

          price: Number(
            v.final_price || 0
          ),

          affiliate_markup_percentage:
            Number(
              v.affiliate_markup_percent ||
                0
            ),

          stock: Number(
            v.stock || 0
          ),

          image:
            v.image_url || null,

          skus:
            skuMap[v.id] || [],

          markup_percentage:
            Number(
              v.markup_percent ||
                0
            ),
        };

        if (
          !variantMap[v.product_id]
        ) {
          variantMap[
            v.product_id
          ] = [];
        }

        variantMap[
          v.product_id
        ].push(variantObj);
      }

      const response =
        products.map((p) => {
          const productVariants =
            variantMap[p.id] ||
            [];

          const mainImages =
            p.main_image
              ? [p.main_image]
              : [];

          const variantImages =
            productVariants
              .map((v) => v.image)
              .filter(Boolean);

          const firstVariant =
            productVariants[0];

          return {
            id: p.id,

            name: p.name,

            description:
              p.description,

            category:
              p.category,

            stock: Number(
              p.stock || 0
            ),

            base_price:
              firstVariant
                ?.seller_price ||
              0,

            markup_price:
              firstVariant
                ?.markup_price ||
              0,

            price:
              firstVariant?.price ||
              0,

            affiliate_markup_percentage:
              firstVariant?.affiliate_markup_percentage ||
              AFFILIATE_MARKUP_PERCENT,

            markup_percentage:
              firstVariant?.markup_percentage ||
              0,

            images: [
              ...mainImages,
              ...variantImages,
            ],

            variants:
              productVariants,
          };
        });

      res.json(response);
    } catch (err) {
      console.error(
        "GET products error:",
        err
      );

      res.status(500).json({
        error: "Server error",
      });
    }
  }
);

/* =========================================================
   UPDATE PRODUCT
========================================================= */
router.put(
  "/:storeId/products/:productId",
  upload.array("images"),
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        storeId,
        productId,
      } = req.params;

      const {
        name,
        description,
        category,
        variants,
      } = req.body;

      if (!name || !variants) {
        return res.status(400).json({
          error:
            "Name and variants required",
        });
      }

      const parsedVariants =
        JSON.parse(variants);

      await client.query("BEGIN");

      await client.query(
        `
        UPDATE products
        SET
          name=$1,
          description=$2,
          category=$3
        WHERE id=$4
        AND store_id=$5
        `,
        [
          name,
          description,
          category,
          productId,
          storeId,
        ]
      );

      const existingVariantsRes =
        await client.query(
          `
          SELECT *
          FROM variants
          WHERE product_id=$1
          `,
          [productId]
        );

      const existingVariants =
        existingVariantsRes.rows;

      const parsedVariantNames =
        parsedVariants.map(
          (v) => v.name
        );

      for (const ev of existingVariants) {
        if (
          !parsedVariantNames.includes(
            ev.name
          )
        ) {
          await client.query(
            `
            DELETE FROM skus
            WHERE variant_id=$1
            `,
            [ev.id]
          );

          await client.query(
            `
            DELETE FROM variants
            WHERE id=$1
            `,
            [ev.id]
          );
        }
      }

      let totalStock = 0;

      for (
        let i = 0;
        i < parsedVariants.length;
        i++
      ) {
        const v =
          parsedVariants[i];

        const existingVariant =
          existingVariants.find(
            (ev) =>
              ev.name === v.name
          );

        let imageUrl =
          existingVariant?.image_url ||
          null;

        if (
          req.files &&
          req.files[i]
        ) {
          imageUrl =
            await safelyUploadImage(
              req.files[i]
            );
        }

        const variantStock =
          Array.isArray(v.skus) &&
          v.skus.length
            ? v.skus.reduce(
                (sum, sku) =>
                  sum +
                  Number(
                    sku.stock || 0
                  ),
                0
              )
            : Number(v.stock || 0);

        totalStock +=
          variantStock;

        const pricing =
          await calculatePricing({
            client,
            sellerPrice:
              v.seller_price,
            category,
          });

        let variantId;

        if (existingVariant) {
          await client.query(
            `
            UPDATE variants
            SET
              seller_price=$1,
              markup_price=$2,
              final_price=$3,
              stock=$4,
              image_url=$5,
              markup_percent=$6,
              affiliate_markup_percent=$7
            WHERE id=$8
            `,
            [
              pricing.seller_price,
              pricing.markup_price,
              pricing.final_price,
              variantStock,
              imageUrl,
              pricing.markup_percentage,
              pricing.affiliate_markup_percentage,
              existingVariant.id,
            ]
          );

          variantId =
            existingVariant.id;

          await client.query(
            `
            DELETE FROM skus
            WHERE variant_id=$1
            `,
            [variantId]
          );
        } else {
          const variantRes =
            await client.query(
              `
              INSERT INTO variants
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
              VALUES
              (
                $1,$2,$3,$4,$5,$6,$7,$8,$9
              )
              RETURNING id
              `,
              [
                productId,
                v.name,
                pricing.seller_price,
                pricing.markup_price,
                pricing.final_price,
                variantStock,
                imageUrl,
                pricing.markup_percentage,
                pricing.affiliate_markup_percentage,
              ]
            );

          variantId =
            variantRes.rows[0].id;
        }

        if (
          Array.isArray(v.skus) &&
          v.skus.length
        ) {
          for (const sku of v.skus) {
            await client.query(
              `
              INSERT INTO skus
              (
                variant_id,
                size,
                stock
              )
              VALUES ($1,$2,$3)
              `,
              [
                variantId,
                sku.size,
                sku.stock,
              ]
            );
          }
        }
      }

      await client.query(
        `
        UPDATE products
        SET stock=$1
        WHERE id=$2
        `,
        [totalStock, productId]
      );

      await client.query("COMMIT");

      res.json({
        message:
          "Product updated successfully",
      });
    } catch (err) {
      await client.query(
        "ROLLBACK"
      );

      console.error(
        "Update product error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to update product",
      });
    } finally {
      client.release();
    }
  }
);

/* =========================================================
   DELETE PRODUCT
========================================================= */
router.delete(
  "/:storeId/products/:productId",
  async (req, res) => {
    const client =
      await pool.connect();

    try {
      const {
        storeId,
        productId,
      } = req.params;

      const variantsRes =
        await client.query(
          `
          SELECT id
          FROM variants
          WHERE product_id=$1
          `,
          [productId]
        );

      for (const v of variantsRes.rows) {
        await client.query(
          `
          DELETE FROM skus
          WHERE variant_id=$1
          `,
          [v.id]
        );
      }

      await client.query(
        `
        DELETE FROM variants
        WHERE product_id=$1
        `,
        [productId]
      );

      await client.query(
        `
        DELETE FROM products
        WHERE id=$1
        AND store_id=$2
        `,
        [productId, storeId]
      );

      res.json({
        message:
          "Product deleted successfully",
      });
    } catch (err) {
      console.error(
        "Delete product error:",
        err
      );

      res.status(500).json({
        error:
          "Failed to delete product",
      });
    } finally {
      client.release();
    }
  }
);

module.exports = router;

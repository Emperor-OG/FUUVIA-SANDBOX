const express = require("express");
const router = express.Router();
const pool = require("../db");
const crypto = require("crypto");
const {
  queueCustomerOrderReceived,
  queueSellerNewOrder,
  queueAdminOrderAlert,
} = require("../services/notificationService");

// -------------------------
// Helpers
// -------------------------
function getOrderIdFromMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== "object") return null;

  if (metadata.order_id) return metadata.order_id;

  if (Array.isArray(metadata.custom_fields)) {
    const field = metadata.custom_fields.find(
      (f) => f?.variable_name === "order_id"
    );
    if (field?.value) return field.value;
  }

  return null;
}

function normalizeItems(items = []) {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      product_id: item.product_id ?? null,
      variant_id: item.variant_id ?? item.id ?? null,
      sku_id: item.sku_id ?? null,
      name: item.name ?? "",
      variant: item.variant ?? "",
      size: item.size ?? null,
      price: Number(item.price) || 0,
      quantity: Math.max(1, Number(item.quantity) || Number(item.qty) || 1),
      image: item.image ?? "",
    }))
    .filter((item) => item.variant_id);
}

function buildItemsSummary(items = []) {
  if (!Array.isArray(items) || !items.length) return "No items";

  return items
    .map((item) => {
      const name = item?.name || "Item";
      const qty = Number(item?.quantity || item?.qty || 1);
      return `${name} x${qty}`;
    })
    .join(", ");
}

async function variantHasSkus(client, variantId) {
  const res = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM skus
        WHERE variant_id = $1
      ) AS has_skus
    `,
    [variantId]
  );

  return res.rows[0]?.has_skus === true;
}

async function getVariantRow(client, variantId) {
  const res = await client.query(
    `
      SELECT id, product_id, stock
      FROM variants
      WHERE id = $1
      LIMIT 1
    `,
    [variantId]
  );

  return res.rows[0] || null;
}

async function syncVariantStockFromSkus(client, variantId) {
  const res = await client.query(
    `
      UPDATE variants v
      SET stock = COALESCE((
        SELECT SUM(s.stock)
        FROM skus s
        WHERE s.variant_id = v.id
      ), 0)
      WHERE v.id = $1
      RETURNING v.id, v.product_id, v.stock
    `,
    [variantId]
  );

  return res.rows[0] || null;
}

async function syncProductStockFromVariants(client, productId) {
  const res = await client.query(
    `
      UPDATE products p
      SET stock = COALESCE((
        SELECT SUM(v.stock)
        FROM variants v
        WHERE v.product_id = p.id
      ), 0)
      WHERE p.id = $1
      RETURNING p.id, p.stock
    `,
    [productId]
  );

  return res.rows[0] || null;
}

async function syncHierarchyAfterPurchase(client, items = []) {
  const variantIds = [
    ...new Set(
      (items || [])
        .map((item) => Number(item.variant_id))
        .filter(Boolean)
    ),
  ];

  const syncedVariants = [];
  const productIds = new Set();

  for (const variantId of variantIds) {
    const hasSkus = await variantHasSkus(client, variantId);

    let variantRow;
    if (hasSkus) {
      variantRow = await syncVariantStockFromSkus(client, variantId);
    } else {
      variantRow = await getVariantRow(client, variantId);
    }

    if (variantRow) {
      syncedVariants.push({
        id: variantRow.id,
        product_id: variantRow.product_id,
        stock: Number(variantRow.stock) || 0,
        source: hasSkus ? "sku_sum" : "variant_direct",
      });

      if (variantRow.product_id) {
        productIds.add(Number(variantRow.product_id));
      }
    }
  }

  const syncedProducts = [];
  for (const productId of productIds) {
    const productRow = await syncProductStockFromVariants(client, productId);
    if (productRow) {
      syncedProducts.push({
        id: productRow.id,
        stock: Number(productRow.stock) || 0,
      });
    }
  }

  return {
    syncedVariants,
    syncedProducts,
  };
}

async function deductStockForItem(client, item) {
  const hasSkus = await variantHasSkus(client, item.variant_id);

  if (hasSkus && !item.sku_id) {
    throw new Error(`Variant ${item.variant_id} requires a SKU`);
  }

  if (!hasSkus && item.sku_id) {
    throw new Error(`Variant ${item.variant_id} does not use SKUs`);
  }

  if (item.sku_id) {
    const skuRes = await client.query(
      `
        UPDATE skus
        SET stock = stock - $1
        WHERE id = $2
          AND variant_id = $3
          AND stock >= $1
        RETURNING id, variant_id, stock
      `,
      [item.quantity, item.sku_id, item.variant_id]
    );

    if (!skuRes.rows.length) {
      throw new Error(
        `Insufficient stock for SKU ${item.sku_id} on variant ${item.variant_id}`
      );
    }

    return {
      stock_source: "sku",
      stock_id: skuRes.rows[0].id,
      remaining_stock: skuRes.rows[0].stock,
    };
  }

  const variantRes = await client.query(
    `
      UPDATE variants
      SET stock = stock - $1
      WHERE id = $2
        AND stock >= $1
      RETURNING id, stock
    `,
    [item.quantity, item.variant_id]
  );

  if (!variantRes.rows.length) {
    throw new Error(`Insufficient stock for variant ${item.variant_id}`);
  }

  return {
    stock_source: "variant",
    stock_id: variantRes.rows[0].id,
    remaining_stock: variantRes.rows[0].stock,
  };
}

async function markAffiliateCompleted(client, orderId) {
  const result = await client.query(
    `
      UPDATE affiliate_earnings
      SET
        order_status = 'pending',
        earning_status = 'completed',
        completed_at = NOW(),
        eligible_for_payout_at = NOW() + INTERVAL '5 days',
        updated_at = NOW()
      WHERE order_id = $1
      RETURNING *
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

async function markAffiliateReversed(client, orderId) {
  const result = await client.query(
    `
      UPDATE affiliate_earnings
      SET
        order_status = 'cancelled',
        earning_status = 'reversed',
        updated_at = NOW()
      WHERE order_id = $1
      RETURNING *
    `,
    [orderId]
  );

  return result.rows[0] || null;
}

// -------------------------
// Paystack Webhook
// -------------------------
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const secret = process.env.PAYSTACK_SECRET_KEY;

    if (!secret) {
      console.error("🚨 PAYSTACK_SECRET_KEY is missing");
      return res.sendStatus(500);
    }

    const client = await pool.connect();

    try {
      const signature = req.headers["x-paystack-signature"];

      if (!signature) {
        console.warn("❌ Missing Paystack signature");
        client.release();
        return res.sendStatus(401);
      }

      const hash = crypto
        .createHmac("sha512", secret)
        .update(req.body)
        .digest("hex");

      if (hash !== signature) {
        console.warn("❌ Invalid Paystack signature");
        client.release();
        return res.sendStatus(401);
      }

      const payload = JSON.parse(req.body.toString("utf8"));
      const eventName = payload.event;
      const eventData = payload.data || {};
      const reference = eventData.reference || null;
      const metadata = eventData.metadata || {};

      const rawOrderIdFromMetadata = getOrderIdFromMetadata(metadata);
      const orderIdFromMetadata = rawOrderIdFromMetadata
        ? Number(rawOrderIdFromMetadata)
        : null;

      if (
        rawOrderIdFromMetadata !== null &&
        !Number.isInteger(orderIdFromMetadata)
      ) {
        console.warn("⚠️ Invalid metadata order_id:", rawOrderIdFromMetadata);
      }

      console.log("📩 Paystack webhook received:", {
        event: eventName,
        reference,
        orderId: rawOrderIdFromMetadata,
        status: eventData.status || null,
      });

      if (!reference) {
        console.warn("⚠️ Webhook missing reference:", JSON.stringify(payload));
        client.release();
        return res.sendStatus(200);
      }

      if (eventName !== "charge.success" && eventName !== "charge.failed") {
        console.log("ℹ️ Ignored Paystack event:", eventName);
        client.release();
        return res.sendStatus(200);
      }

      await client.query("BEGIN");

      const orderRes = await client.query(
        `
          SELECT
            o.id,
            o.reference,
            o.store_id,
            o.customer_name,
            o.customer_email,
            o.items,
            o.total_amount,
            o.payment_status,
            o.order_status,
            o.affiliate_id,
            o.affiliate_code,
            o.affiliate_amount,
            o.affiliate_status,
            s.store_name,
            s.email AS store_email
          FROM orders o
          JOIN stores s ON o.store_id = s.id
          WHERE o.reference = $1
             OR o.id = COALESCE($2::int, -1)
          ORDER BY CASE WHEN o.reference = $1 THEN 0 ELSE 1 END
          LIMIT 1
          FOR UPDATE
        `,
        [
          reference,
          Number.isInteger(orderIdFromMetadata) ? orderIdFromMetadata : null,
        ]
      );

      if (!orderRes.rows.length) {
        await client.query("ROLLBACK");
        client.release();
        console.warn("⚠️ Order not found for webhook:", {
          reference,
          orderId: rawOrderIdFromMetadata,
          event: eventName,
        });
        return res.sendStatus(200);
      }

      const order = orderRes.rows[0];
      const orderId = order.id;

      if (eventName === "charge.success") {
        console.log("✅ Payment confirmed:", reference);

        if (String(order.payment_status || "").toLowerCase() === "paid") {
          await client.query("COMMIT");
          client.release();
          console.log(`ℹ️ Order ${orderId} already processed as paid.`);
          return res.sendStatus(200);
        }

        const parsedItems =
          typeof order.items === "string" ? JSON.parse(order.items) : order.items;

        const normalizedItems = normalizeItems(parsedItems);

        if (!normalizedItems.length) {
          throw new Error(`Order ${orderId} has no valid items`);
        }

        const deductionResults = [];
        for (const item of normalizedItems) {
          const result = await deductStockForItem(client, item);
          deductionResults.push({
            product_id: item.product_id,
            variant_id: item.variant_id,
            sku_id: item.sku_id,
            quantity: item.quantity,
            ...result,
          });
        }

        const hierarchySync = await syncHierarchyAfterPurchase(
          client,
          normalizedItems
        );

        const update = await client.query(
          `
            UPDATE orders
            SET payment_status = 'paid',
                order_status = 'pending',
                settled = true,
                paid_at = NOW(),
                affiliate_status = CASE
                  WHEN affiliate_id IS NOT NULL THEN 'completed'
                  ELSE affiliate_status
                END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, reference, payment_status, order_status, paid_at, updated_at, affiliate_status
          `,
          [orderId]
        );

        let affiliateUpdate = null;
        if (order.affiliate_id) {
          affiliateUpdate = await markAffiliateCompleted(client, orderId);
        }

        await client.query("COMMIT");
        client.release();

        const customerAlerted = Boolean(order.customer_email);
        const sellerAlerted = Boolean(order.store_email);

        const notificationOrder = {
          id: order.id,
          reference: order.reference,
          store_id: order.store_id,
          store_name: order.store_name,
          customer_name: order.customer_name,
          customer_email: order.customer_email,
          seller_email: order.store_email,
          items: parsedItems,
          total_amount: order.total_amount,
          payment_status: "paid",
          status: "pending",
          order_status: "pending",
          customerAlerted,
          sellerAlerted,
          summary: `Order #${order.id} received. Customer ${
            customerAlerted ? "alert queued" : "email missing"
          }. Seller ${sellerAlerted ? "alert queued" : "email missing"}.`,
          itemSummary: buildItemsSummary(parsedItems),
        };

        if (customerAlerted) {
          await queueCustomerOrderReceived(notificationOrder);
        }

        if (sellerAlerted) {
          await queueSellerNewOrder(notificationOrder, {
            email: order.store_email,
            store_name: order.store_name,
          });
        }

        await queueAdminOrderAlert(notificationOrder, "received");

        console.log(
          "📦 Order activated, stock deducted, hierarchy synced, notifications queued:",
          {
            order: update.rows[0],
            affiliateUpdate,
            deductions: deductionResults,
            hierarchySync,
            customerAlerted,
            sellerAlerted,
            customerEmail: order.customer_email || null,
            sellerEmail: order.store_email || null,
          }
        );

        return res.sendStatus(200);
      }

      if (eventName === "charge.failed") {
        console.log("❌ Payment failed:", reference);

        if (String(order.payment_status || "").toLowerCase() === "paid") {
          await client.query("COMMIT");
          client.release();
          console.log(
            `ℹ️ Ignored failed event for already paid order ${orderId}.`
          );
          return res.sendStatus(200);
        }

        const update = await client.query(
          `
            UPDATE orders
            SET payment_status = 'failed',
                order_status = 'cancelled',
                affiliate_status = CASE
                  WHEN affiliate_id IS NOT NULL THEN 'reversed'
                  ELSE affiliate_status
                END,
                updated_at = NOW()
            WHERE id = $1
            RETURNING id, reference, payment_status, order_status, affiliate_status, updated_at
          `,
          [orderId]
        );

        let affiliateUpdate = null;
        if (order.affiliate_id) {
          affiliateUpdate = await markAffiliateReversed(client, orderId);
        }

        await client.query("COMMIT");
        client.release();

        console.log("🧾 Failed order updated:", {
          order: update.rows[0],
          affiliateUpdate,
        });

        return res.sendStatus(200);
      }

      await client.query("COMMIT");
      client.release();
      return res.sendStatus(200);
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackErr) {
        console.error("🚨 Rollback error:", rollbackErr);
      }

      client.release();
      console.error("🚨 Webhook processing error:", err);
      return res.sendStatus(500);
    }
  }
);

module.exports = router;

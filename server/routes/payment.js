const express = require("express");
const router = express.Router();
const pool = require("../db");
const fetch = require("node-fetch");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PLATFORM_PERCENTAGE = parseFloat(process.env.PLATFORM_PERCENTAGE) || 10;
const FRONTEND_URL = process.env.FRONTEND_URL;

// ------------------------
// Auth Middleware
// ------------------------
function verifyUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  next();
}

// ------------------------
// Helpers
// ------------------------
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

function getSafeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

// ------------------------
// Initiate Payment
// ------------------------
router.post("/initiate", verifyUser, async (req, res) => {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ error: "Paystack secret key is missing" });
    }

    if (!FRONTEND_URL) {
      return res.status(500).json({ error: "FRONTEND_URL is missing" });
    }

    const {
      items,
      total,
      locationPrice = 0,
      type,
      locationId,
      address = {},
      customerEmail,
      customerPhone,
      customerName,
      storeId,
    } = req.body;

    const normalizedItems = normalizeItems(items);

    if (!normalizedItems.length) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    if (!storeId) {
      return res.status(400).json({ error: "Store ID required" });
    }

    if (!customerEmail) {
      return res.status(400).json({ error: "Customer email is required" });
    }

    const numericTotal = getSafeNumber(total, 0);
    if (numericTotal <= 0) {
      return res.status(400).json({ error: "Invalid total" });
    }

    // ------------------------
    // Fetch Store Subaccount
    // ------------------------
    const storeRes = await pool.query(
      `
        SELECT id, subaccount_code
        FROM stores
        WHERE id = $1
        LIMIT 1
      `,
      [storeId]
    );

    if (!storeRes.rows.length) {
      return res.status(404).json({ error: "Store not found" });
    }

    const merchantSubaccount = storeRes.rows[0].subaccount_code;

    if (!merchantSubaccount) {
      return res
        .status(400)
        .json({ error: "Store not onboarded for payments" });
    }

    // ------------------------
    // Calculate Totals
    // ------------------------
    const cartTotal = normalizedItems.reduce(
      (sum, item) => sum + Number(item.price) * Number(item.quantity),
      0
    );

    const safeLocationPrice = getSafeNumber(locationPrice, 0);
    const amountInKobo = Math.round(numericTotal * 100);
    const fuuviaCommission = numericTotal * (PLATFORM_PERCENTAGE / 100);

    const expectedTotal = Number((cartTotal + safeLocationPrice).toFixed(2));
    const roundedInputTotal = Number(numericTotal.toFixed(2));

    if (Math.abs(expectedTotal - roundedInputTotal) > 0.01) {
      return res.status(400).json({
        error: "Total does not match cart total plus delivery fee",
        expected_total: expectedTotal,
        received_total: roundedInputTotal,
      });
    }

    // ------------------------
    // Create Order Record
    // ------------------------
    const orderRes = await pool.query(
      `
        INSERT INTO orders (
          store_id,
          subaccount_code,
          customer_name,
          customer_email,
          customer_phone,
          user_email,
          user_google_id,
          type,
          location_id,
          street,
          unit,
          building,
          notes,
          city,
          suburb,
          province,
          postal_code,
          items,
          cart_total,
          location_fee,
          total_amount,
          fuuvia_commission,
          payment_status,
          order_status,
          settled
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,$13,$14,$15,$16,$17,
          $18,$19,$20,$21,$22,
          'pending','pending',false
        )
        RETURNING id
      `,
      [
        storeId,
        merchantSubaccount,
        customerName || null,
        customerEmail,
        customerPhone || null,
        req.user.email || null,
        req.user.google_id || null,
        type || null,
        locationId || null,
        address.street || null,
        address.unit || null,
        address.building || null,
        address.notes || "",
        address.city || null,
        address.suburb || null,
        address.province || null,
        address.postal_code || null,
        JSON.stringify(normalizedItems),
        cartTotal,
        safeLocationPrice,
        numericTotal,
        Number(fuuviaCommission.toFixed(2)),
      ]
    );

    const orderId = orderRes.rows[0].id;
    const reference = `ORD-${orderId}-STR-${storeId}-${Date.now()}`;

    await pool.query(
      `
        UPDATE orders
        SET reference = $1
        WHERE id = $2
      `,
      [reference, orderId]
    );

    // ------------------------
    // Paystack Payload
    // ------------------------
    const paystackPayload = {
      email: customerEmail,
      amount: amountInKobo,
      currency: "ZAR",
      reference,
      subaccount: merchantSubaccount,
      bearer: "account",
      callback_url: `${FRONTEND_URL}/payment-success?reference=${encodeURIComponent(
        reference
      )}`,
      metadata: {
        order_id: orderId,
        store_id: storeId,
      },
    };

    console.log("💳 Initializing Paystack payment:", {
      orderId,
      reference,
      storeId,
      total: numericTotal,
      cartTotal,
      locationFee: safeLocationPrice,
      fuuviaCommission: Number(fuuviaCommission.toFixed(2)),
    });

    const paystackRes = await fetch(
      "https://api.paystack.co/transaction/initialize",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(paystackPayload),
      }
    );

    let data;
    try {
      data = await paystackRes.json();
    } catch (parseErr) {
      console.error("🚨 Failed to parse Paystack init response:", parseErr);

      await pool.query(
        `
          UPDATE orders
          SET payment_status = 'failed',
              order_status = 'cancelled'
          WHERE id = $1
        `,
        [orderId]
      );

      return res.status(500).json({
        error: "Invalid response from Paystack",
      });
    }

    if (!paystackRes.ok || !data.status) {
      console.error("🚨 Paystack init failed:", data);

      await pool.query(
        `
          UPDATE orders
          SET payment_status = 'failed',
              order_status = 'cancelled'
          WHERE id = $1
        `,
        [orderId]
      );

      return res.status(500).json({
        error: data.message || "Paystack initialization failed",
      });
    }

    return res.json({
      authorization_url: data.data.authorization_url,
      access_code: data.data.access_code,
      reference,
      order_id: orderId,
    });
  } catch (err) {
    console.error("🚨 Payment initiation error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ------------------------
// Verify Payment by Reference
// This route does NOT deduct stock.
// Stock deduction should happen ONLY in paystackWebhook.js
// ------------------------
router.get("/verify/:reference", verifyUser, async (req, res) => {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      return res.status(500).json({ error: "Paystack secret key is missing" });
    }

    const { reference } = req.params;

    if (!reference) {
      return res.status(400).json({ error: "Reference is required" });
    }

    const orderRes = await pool.query(
      `
        SELECT id, reference, payment_status, order_status, settled
        FROM orders
        WHERE reference = $1
        LIMIT 1
      `,
      [reference]
    );

    if (!orderRes.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const paystackRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(
        reference
      )}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let data;
    try {
      data = await paystackRes.json();
    } catch (parseErr) {
      console.error("🚨 Failed to parse Paystack verify response:", parseErr);
      return res.status(500).json({ error: "Invalid response from Paystack" });
    }

    if (!paystackRes.ok || !data.status) {
      console.error("🚨 Paystack verify failed:", data);
      return res.status(500).json({
        error: data.message || "Paystack verification failed",
      });
    }

    return res.json({
      success: true,
      reference,
      paystack_status: data.data?.status || null,
      order: orderRes.rows[0],
      paystack: data.data,
    });
  } catch (err) {
    console.error("🚨 Payment verification error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;

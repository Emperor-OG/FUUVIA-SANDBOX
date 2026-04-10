const express = require("express");
const router = express.Router();
const pool = require("../db");
const {
  queueCustomerOrderDispatched,
  queueCustomerOrderCompleted,
  queueAdminOrderAlert,
} = require("../services/notificationService");

// -----------------------------------------------------
// Helpers
// -----------------------------------------------------
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "User not authenticated" });
  }
  next();
}

function isPositiveInteger(value) {
  return /^\d+$/.test(String(value));
}

const ALLOWED_ORDER_STATUSES = [
  "pending",
  "processing",
  "dispatch",
  "completed",
  "cancelled",
];

// -----------------------------------------------------
// GET ORDERS FOR LOGGED-IN USER (Past Orders)
// -----------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const userEmail = req.user?.email ?? null;
    const userGoogleId = req.user?.google_id ?? null;

    console.log("Fetching orders for:", { userEmail, userGoogleId });

    if (!userEmail && !userGoogleId) {
      return res.status(401).json({ error: "User not authenticated" });
    }

    const whereClauses = [];
    const params = [];
    let idx = 1;

    if (userEmail) {
      whereClauses.push(`o.user_email = $${idx}::text`);
      params.push(userEmail);
      idx++;
    }

    if (userGoogleId) {
      whereClauses.push(`o.user_google_id = $${idx}::text`);
      params.push(userGoogleId);
      idx++;
    }

    const ordersQuery = `
      SELECT 
        o.id,
        o.reference,
        o.store_id,
        o.subaccount_code,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.user_email,
        o.user_google_id,
        o.type,
        o.location_id,
        o.street,
        o.unit,
        o.building,
        o.notes,
        o.city,
        o.suburb,
        o.province,
        o.postal_code,
        o.items,
        o.cart_total,
        o.location_fee,
        o.total_amount,
        o.fuuvia_commission,
        o.payment_status,
        o.order_status,
        o.settled,
        o.paid_at,
        o.created_at,
        o.updated_at,
        s.store_name
      FROM orders o
      JOIN stores s ON o.store_id = s.id
      WHERE ${whereClauses.join(" OR ")}
      ORDER BY o.created_at DESC
    `;

    const { rows } = await pool.query(ordersQuery, params);

    return res.json({ success: true, orders: rows });
  } catch (err) {
    console.error("Error fetching past orders:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------------------------------
// GET ORDERS FOR A STORE (Store Admin Dashboard)
// -----------------------------------------------------
router.get("/store/:storeId", async (req, res) => {
  try {
    const { storeId } = req.params;

    if (!isPositiveInteger(storeId)) {
      return res.status(400).json({ error: "Invalid store ID" });
    }

    const query = `
      SELECT
        id,
        reference,
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
        settled,
        paid_at,
        created_at,
        updated_at
      FROM orders
      WHERE store_id = $1
      ORDER BY created_at DESC
    `;

    const { rows } = await pool.query(query, [storeId]);

    return res.json({ success: true, orders: rows });
  } catch (err) {
    console.error("Error fetching store orders:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// -----------------------------------------------------
// UPDATE ORDER STATUS
// pending → processing → dispatch → completed
// -----------------------------------------------------
router.put("/update-status/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { order_status } = req.body;

    if (!isPositiveInteger(id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const normalizedStatus = String(order_status || "")
      .trim()
      .toLowerCase();

    if (!ALLOWED_ORDER_STATUSES.includes(normalizedStatus)) {
      return res.status(400).json({
        error: "Invalid order status",
        allowed_statuses: ALLOWED_ORDER_STATUSES,
      });
    }

    const existingRes = await pool.query(
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
          s.store_name
        FROM orders o
        JOIN stores s ON o.store_id = s.id
        WHERE o.id = $1
        LIMIT 1
      `,
      [id]
    );

    if (!existingRes.rows.length) {
      return res.status(404).json({ error: "Order not found" });
    }

    const order = existingRes.rows[0];
    const currentStatus = String(order.order_status || "").toLowerCase();
    const paymentStatus = String(order.payment_status || "").toLowerCase();

    if (paymentStatus !== "paid") {
      return res.status(400).json({
        error: "Only paid orders can move through fulfilment stages",
      });
    }

    const validTransitions = {
      pending: ["processing"],
      processing: ["dispatch"],
      dispatch: ["completed"],
      completed: [],
      cancelled: [],
    };

    const allowedNext = validTransitions[currentStatus] || [];

    if (!allowedNext.includes(normalizedStatus)) {
      return res.status(400).json({
        error: `Invalid status transition from '${currentStatus}' to '${normalizedStatus}'`,
        allowed_next_statuses: allowedNext,
      });
    }

    const updateRes = await pool.query(
      `
        UPDATE orders
        SET order_status = $1,
            updated_at = NOW()
        WHERE id = $2
        RETURNING id, payment_status, order_status, updated_at
      `,
      [normalizedStatus, id]
    );

    const notificationOrder = {
      id: order.id,
      reference: order.reference,
      store_id: order.store_id,
      store_name: order.store_name,
      customer_name: order.customer_name,
      customer_email: order.customer_email,
      items: order.items,
      total_amount: order.total_amount,
      payment_status: paymentStatus,
      status: normalizedStatus,
      order_status: normalizedStatus,
    };

    if (normalizedStatus === "dispatch" && order.customer_email) {
      await queueCustomerOrderDispatched(notificationOrder);
      await queueAdminOrderAlert(notificationOrder, "dispatched");
    }

    if (normalizedStatus === "completed" && order.customer_email) {
      await queueCustomerOrderCompleted(notificationOrder);
      await queueAdminOrderAlert(notificationOrder, "completed");
    }

    return res.json({
      success: true,
      message: "Order status updated",
      order: updateRes.rows[0],
    });
  } catch (err) {
    console.error("Error updating order status:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;

const pool = require("../db");

/**
 * Generic queue function (internal use)
 */
async function queueEmail({
  type,
  recipientEmail,
  subject,
  payload = {},
  relatedOrderId = null,
  relatedStoreId = null,
  notificationKey = null,
}) {
  try {
    await pool.query(
      `
      insert into email_notifications
      (type, recipient_email, subject, payload, related_order_id, related_store_id, notification_key)
      values ($1, $2, $3, $4, $5, $6, $7)
      on conflict do nothing
      `,
      [
        type,
        recipientEmail,
        subject,
        payload,
        relatedOrderId,
        relatedStoreId,
        notificationKey,
      ]
    );
  } catch (err) {
    console.error("❌ Failed to queue email:", err);
  }
}

/**
 * CUSTOMER: Order received
 */
async function queueCustomerOrderReceived(order) {
  const key = `order_${order.id}_customer_received`;

  await queueEmail({
    type: "customer_order_received",
    recipientEmail: order.customer_email,
    subject: `We’ve received your FUUVIA order #${order.id}`,
    payload: {
      customerName: order.customer_name,
      orderId: order.id,
      storeName: order.store_name,
      total: order.total_amount,
      items: order.items,
    },
    relatedOrderId: order.id,
    relatedStoreId: order.store_id,
    notificationKey: key,
  });
}

/**
 * CUSTOMER: Order dispatched
 */
async function queueCustomerOrderDispatched(order) {
  const key = `order_${order.id}_customer_dispatched`;

  await queueEmail({
    type: "customer_order_dispatched",
    recipientEmail: order.customer_email,
    subject: `Your FUUVIA order #${order.id} has been dispatched`,
    payload: {
      customerName: order.customer_name,
      orderId: order.id,
      storeName: order.store_name,
      items: order.items,
    },
    relatedOrderId: order.id,
    relatedStoreId: order.store_id,
    notificationKey: key,
  });
}

/**
 * CUSTOMER: Order completed
 */
async function queueCustomerOrderCompleted(order) {
  const key = `order_${order.id}_customer_completed`;

  await queueEmail({
    type: "customer_order_completed",
    recipientEmail: order.customer_email,
    subject: `Your FUUVIA order #${order.id} has been completed`,
    payload: {
      customerName: order.customer_name,
      orderId: order.id,
      storeName: order.store_name,
      items: order.items,
    },
    relatedOrderId: order.id,
    relatedStoreId: order.store_id,
    notificationKey: key,
  });
}

/**
 * SELLER: New order
 */
async function queueSellerNewOrder(order, store) {
  const recipientEmail = store?.email;

  if (!recipientEmail) return;

  const key = `order_${order.id}_seller_new`;

  await queueEmail({
    type: "seller_new_order",
    recipientEmail,
    subject: `New paid order #${order.id}`,
    payload: {
      storeName: store.store_name || order.store_name,
      orderId: order.id,
      customerName: order.customer_name,
      total: order.total_amount,
      items: order.items,
    },
    relatedOrderId: order.id,
    relatedStoreId: order.store_id,
    notificationKey: key,
  });
}

/**
 * ADMIN: Platform alert
 */
async function queueAdminOrderAlert(order, eventType) {
  const adminEmail = process.env.ORDER_ALERT_EMAIL;

  if (!adminEmail) return;

  const key = `order_${order.id}_admin_${eventType}`;

  await queueEmail({
    type: "admin_order_alert",
    recipientEmail: adminEmail,
    subject: `FUUVIA alert: order #${order.id} ${eventType}`,
    payload: {
      orderId: order.id,
      customerName: order.customer_name,
      storeName: order.store_name,
      total: order.total_amount,
      status: order.status || order.order_status,
      paymentStatus: order.payment_status,
      eventType,
      items: order.items,

      // pass through enriched monitoring fields
      customerAlerted: Boolean(order.customerAlerted),
      sellerAlerted: Boolean(order.sellerAlerted),
      customer_email: order.customer_email || null,
      seller_email: order.seller_email || null,
      itemSummary: order.itemSummary || null,
      summary: order.summary || null,
    },
    relatedOrderId: order.id,
    relatedStoreId: order.store_id,
    notificationKey: key,
  });
}

module.exports = {
  queueCustomerOrderReceived,
  queueCustomerOrderDispatched,
  queueCustomerOrderCompleted,
  queueSellerNewOrder,
  queueAdminOrderAlert,
};

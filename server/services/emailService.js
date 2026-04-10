const nodemailer = require("nodemailer");

const SMTP_HOST = process.env.SMTP_HOST || "mail.privateemail.com";
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || "true") === "true";

const NO_REPLY_EMAIL = process.env.NO_REPLY_EMAIL;
const NO_REPLY_PASSWORD = process.env.NO_REPLY_PASSWORD;

const ORDERS_EMAIL = process.env.ORDERS_EMAIL;
const ORDERS_PASSWORD = process.env.ORDERS_PASSWORD;

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL;
const SUPPORT_PASSWORD = process.env.SUPPORT_PASSWORD;

let noReplyTransporter;
let ordersTransporter;
let supportTransporter;

function createTransporter(user, pass) {
  if (!user || !pass) {
    throw new Error(`Missing SMTP credentials for ${user || "unknown mailbox"}`);
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user,
      pass,
    },
  });
}

function getNoReplyTransporter() {
  if (!noReplyTransporter) {
    noReplyTransporter = createTransporter(NO_REPLY_EMAIL, NO_REPLY_PASSWORD);
  }
  return noReplyTransporter;
}

function getOrdersTransporter() {
  if (!ordersTransporter) {
    ordersTransporter = createTransporter(ORDERS_EMAIL, ORDERS_PASSWORD);
  }
  return ordersTransporter;
}

function getSupportTransporter() {
  if (!supportTransporter) {
    supportTransporter = createTransporter(SUPPORT_EMAIL, SUPPORT_PASSWORD);
  }
  return supportTransporter;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatCurrency(value) {
  const amount = Number(value || 0);
  return `R${amount.toFixed(2)}`;
}

function formatItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return "<li>Items will appear here.</li>";
  }

  return items
    .map((item) => {
      const name = escapeHtml(
        item?.name || item?.product_name || item?.title || "Item"
      );
      const qty = Number(item?.quantity || item?.qty || 1);
      const price = item?.price ?? item?.amount ?? item?.unit_price ?? null;

      const priceText = price !== null ? ` — ${formatCurrency(price)}` : "";
      return `<li>${name} × ${qty}${priceText}</li>`;
    })
    .join("");
}

function buildLayout({ heading, intro, bodyHtml, footerNote = "" }) {
  return `
    <div style="margin:0;padding:0;background:#f6f7fb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
      <div style="max-width:640px;margin:0 auto;padding:24px;">
        <div style="border-radius:18px;overflow:hidden;background:#ffffff;box-shadow:0 10px 30px rgba(0,0,0,0.08);">
          <div style="padding:24px 28px;background:linear-gradient(135deg,#487bff 0%,#8f68ff 55%,#fc72ff 100%);color:#ffffff;">
            <div style="font-size:24px;font-weight:700;letter-spacing:0.4px;">FUUVIA</div>
            <div style="margin-top:8px;font-size:20px;font-weight:700;">${escapeHtml(
              heading
            )}</div>
          </div>

          <div style="padding:28px;">
            <p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;">${intro}</p>
            ${bodyHtml}
            ${
              footerNote
                ? `<p style="margin:24px 0 0 0;font-size:13px;line-height:1.6;color:#6b7280;">${footerNote}</p>`
                : ""
            }
          </div>
        </div>
      </div>
    </div>
  `;
}

function buildTextList(items) {
  if (!Array.isArray(items) || items.length === 0) return "- Items unavailable";

  return items
    .map((item) => {
      const name = item?.name || item?.product_name || item?.title || "Item";
      const qty = Number(item?.quantity || item?.qty || 1);
      return `- ${name} x ${qty}`;
    })
    .join("\n");
}

function yesNo(value) {
  return value ? "Yes" : "No";
}

function buildEmailContent(type, payload = {}) {
  const customerName = escapeHtml(payload.customerName || "Customer");
  const storeName = escapeHtml(payload.storeName || "Store");
  const orderId = escapeHtml(payload.orderId || "");
  const total = payload.total != null ? formatCurrency(payload.total) : null;
  const itemsHtml = formatItems(payload.items);
  const itemsText = buildTextList(payload.items);

  switch (type) {
    case "customer_order_received": {
      const html = buildLayout({
        heading: "We’ve received your order",
        intro: `Hi ${customerName}, thanks for shopping on FUUVIA. We’ve successfully received your order and the seller has been notified.`,
        bodyHtml: `
          <div style="font-size:15px;line-height:1.7;">
            <p><strong>Order number:</strong> #${orderId}</p>
            <p><strong>Store:</strong> ${storeName}</p>
            ${total ? `<p><strong>Total paid:</strong> ${escapeHtml(total)}</p>` : ""}
            <p style="margin:18px 0 8px 0;"><strong>Items</strong></p>
            <ul style="margin:0 0 0 18px;padding:0;line-height:1.8;">${itemsHtml}</ul>
          </div>
        `,
        footerNote:
          "This is an automated order notification sent by FUUVIA.",
      });

      const text = `FUUVIA

We’ve received your order.

Order number: #${payload.orderId}
Store: ${payload.storeName}
${total ? `Total paid: ${total}\n` : ""}Items:
${itemsText}

This is an automated order notification sent by FUUVIA.`;

      return { html, text, mailbox: "no_reply" };
    }

    case "customer_order_dispatched": {
      const html = buildLayout({
        heading: "Your order has been dispatched",
        intro: `Hi ${customerName}, your order from ${storeName} has been dispatched and is on its way.`,
        bodyHtml: `
          <div style="font-size:15px;line-height:1.7;">
            <p><strong>Order number:</strong> #${orderId}</p>
            <p><strong>Store:</strong> ${storeName}</p>
            <p style="margin:18px 0 8px 0;"><strong>Items</strong></p>
            <ul style="margin:0 0 0 18px;padding:0;line-height:1.8;">${itemsHtml}</ul>
          </div>
        `,
        footerNote:
          "This is an automated dispatch notification sent by FUUVIA.",
      });

      const text = `FUUVIA

Your order has been dispatched.

Order number: #${payload.orderId}
Store: ${payload.storeName}

Items:
${itemsText}

This is an automated dispatch notification sent by FUUVIA.`;

      return { html, text, mailbox: "no_reply" };
    }

    case "customer_order_completed": {
      const html = buildLayout({
        heading: "Your order has been completed",
        intro: `Hi ${customerName}, your order from ${storeName} has been marked as completed.`,
        bodyHtml: `
          <div style="font-size:15px;line-height:1.7;">
            <p><strong>Order number:</strong> #${orderId}</p>
            <p><strong>Store:</strong> ${storeName}</p>
            <p style="margin:18px 0 8px 0;"><strong>Items</strong></p>
            <ul style="margin:0 0 0 18px;padding:0;line-height:1.8;">${itemsHtml}</ul>
          </div>
        `,
        footerNote:
          "This is an automated completion notification sent by FUUVIA.",
      });

      const text = `FUUVIA

Your order has been completed.

Order number: #${payload.orderId}
Store: ${payload.storeName}

Items:
${itemsText}

This is an automated completion notification sent by FUUVIA.`;

      return { html, text, mailbox: "no_reply" };
    }

    case "seller_new_order": {
      const html = buildLayout({
        heading: "New paid order received",
        intro: `A new paid order has been placed for ${storeName}.`,
        bodyHtml: `
          <div style="font-size:15px;line-height:1.7;">
            <p><strong>Order number:</strong> #${orderId}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            ${total ? `<p><strong>Total:</strong> ${escapeHtml(total)}</p>` : ""}
            <p style="margin:18px 0 8px 0;"><strong>Items</strong></p>
            <ul style="margin:0 0 0 18px;padding:0;line-height:1.8;">${itemsHtml}</ul>
          </div>
        `,
        footerNote:
          "Please begin processing this order in your FUUVIA seller dashboard.",
      });

      const text = `FUUVIA

New paid order received.

Order number: #${payload.orderId}
Customer: ${payload.customerName}
Store: ${payload.storeName}
${total ? `Total: ${total}\n` : ""}Items:
${itemsText}

Please begin processing this order in your FUUVIA seller dashboard.`;

      return { html, text, mailbox: "orders" };
    }

    case "admin_order_alert": {
      const eventType = escapeHtml(payload.eventType || "updated");
      const customerAlerted = yesNo(payload.customerAlerted);
      const sellerAlerted = yesNo(payload.sellerAlerted);
      const customerEmail = escapeHtml(payload.customer_email || "-");
      const sellerEmail = escapeHtml(payload.seller_email || "-");
      const summary = escapeHtml(payload.summary || "-");
      const itemSummary = escapeHtml(payload.itemSummary || "-");

      const html = buildLayout({
        heading: "Platform order alert",
        intro: `A FUUVIA order event has occurred and this alert was sent for visibility.`,
        bodyHtml: `
          <div style="font-size:15px;line-height:1.7;">
            <p><strong>Event:</strong> ${eventType}</p>
            <p><strong>Order number:</strong> #${orderId}</p>
            <p><strong>Customer:</strong> ${customerName}</p>
            <p><strong>Store:</strong> ${storeName}</p>
            ${total ? `<p><strong>Total:</strong> ${escapeHtml(total)}</p>` : ""}
            <p><strong>Order status:</strong> ${escapeHtml(payload.status || "-")}</p>
            <p><strong>Payment status:</strong> ${escapeHtml(
              payload.paymentStatus || "-"
            )}</p>

            <div style="margin-top:18px;padding:14px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;">
              <p style="margin:0 0 10px 0;"><strong>Notification summary</strong></p>
              <p style="margin:0 0 8px 0;"><strong>Customer alerted:</strong> ${customerAlerted}</p>
              <p style="margin:0 0 8px 0;"><strong>Seller alerted:</strong> ${sellerAlerted}</p>
              <p style="margin:0 0 8px 0;"><strong>Customer email:</strong> ${customerEmail}</p>
              <p style="margin:0 0 8px 0;"><strong>Seller email:</strong> ${sellerEmail}</p>
              <p style="margin:0 0 8px 0;"><strong>Items summary:</strong> ${itemSummary}</p>
              <p style="margin:0;"><strong>Summary:</strong> ${summary}</p>
            </div>
          </div>
        `,
        footerNote: "This is an internal FUUVIA monitoring alert.",
      });

      const text = `FUUVIA

Platform order alert.

Event: ${payload.eventType}
Order number: #${payload.orderId}
Customer: ${payload.customerName}
Store: ${payload.storeName}
${total ? `Total: ${total}` : ""}
Order status: ${payload.status || "-"}
Payment status: ${payload.paymentStatus || "-"}

Notification summary
Customer alerted: ${customerAlerted}
Seller alerted: ${sellerAlerted}
Customer email: ${payload.customer_email || "-"}
Seller email: ${payload.seller_email || "-"}
Items summary: ${payload.itemSummary || "-"}
Summary: ${payload.summary || "-"}

This is an internal FUUVIA monitoring alert.`;

      return { html, text, mailbox: "orders" };
    }

    default: {
      const html = buildLayout({
        heading: "Notification",
        intro: "A notification was triggered.",
        bodyHtml: `<pre style="white-space:pre-wrap;font-size:13px;">${escapeHtml(
          JSON.stringify(payload, null, 2)
        )}</pre>`,
      });

      const text = `Notification triggered.\n\n${JSON.stringify(
        payload,
        null,
        2
      )}`;

      return { html, text, mailbox: "orders" };
    }
  }
}

function pickTransporter(mailbox) {
  switch (mailbox) {
    case "no_reply":
      return {
        transporter: getNoReplyTransporter(),
        from: `FUUVIA <${NO_REPLY_EMAIL}>`,
        replyTo: SUPPORT_EMAIL || ORDERS_EMAIL || NO_REPLY_EMAIL,
      };

    case "support":
      return {
        transporter: getSupportTransporter(),
        from: `FUUVIA Support <${SUPPORT_EMAIL}>`,
        replyTo: SUPPORT_EMAIL,
      };

    case "orders":
    default:
      return {
        transporter: getOrdersTransporter(),
        from: `FUUVIA Orders <${ORDERS_EMAIL}>`,
        replyTo: ORDERS_EMAIL,
      };
  }
}

async function verifyEmailTransporters() {
  const checks = [];

  if (NO_REPLY_EMAIL && NO_REPLY_PASSWORD) {
    checks.push(getNoReplyTransporter().verify());
  }

  if (ORDERS_EMAIL && ORDERS_PASSWORD) {
    checks.push(getOrdersTransporter().verify());
  }

  if (SUPPORT_EMAIL && SUPPORT_PASSWORD) {
    checks.push(getSupportTransporter().verify());
  }

  await Promise.all(checks);
  console.log("✅ Email SMTP transporters verified");
}

async function sendNotificationEmail({ type, to, subject, payload = {} }) {
  if (!to) {
    throw new Error(`Missing recipient for notification type "${type}"`);
  }

  const { html, text, mailbox } = buildEmailContent(type, payload);
  const { transporter, from, replyTo } = pickTransporter(mailbox);

  const info = await transporter.sendMail({
    from,
    to,
    subject,
    html,
    text,
    replyTo,
  });

  return info;
}

module.exports = {
  sendNotificationEmail,
  verifyEmailTransporters,
};

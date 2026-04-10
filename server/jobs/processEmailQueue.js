const pool = require("../db");
const { sendNotificationEmail } = require("../services/emailService");

const MAX_ATTEMPTS = 5;

function getNextAttemptDelayMinutes(attempts) {
  if (attempts <= 1) return 5;
  if (attempts === 2) return 15;
  if (attempts === 3) return 30;
  if (attempts === 4) return 60;
  return 180;
}

async function claimPendingEmails(limit = 20) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
      select id
      from email_notifications
      where status in ('pending', 'failed')
        and attempts < $1
        and next_attempt_at <= now()
      order by created_at asc
      limit $2
      for update skip locked
      `,
      [MAX_ATTEMPTS, limit]
    );

    if (!rows.length) {
      await client.query("COMMIT");
      return [];
    }

    const ids = rows.map((row) => row.id);

    const claimed = await client.query(
      `
      update email_notifications
      set status = 'processing'
      where id = any($1::bigint[])
      returning *
      `,
      [ids]
    );

    await client.query("COMMIT");
    return claimed.rows;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}
    throw err;
  } finally {
    client.release();
  }
}

async function processEmailQueue(limit = 20) {
  const rows = await claimPendingEmails(limit);

  if (!rows.length) {
    return { processed: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await sendNotificationEmail({
        type: row.type,
        to: row.recipient_email,
        subject: row.subject,
        payload: row.payload || {},
      });

      await pool.query(
        `
        update email_notifications
        set status = 'sent',
            processed_at = now(),
            attempts = attempts + 1,
            last_error = null
        where id = $1
        `,
        [row.id]
      );

      sent += 1;
    } catch (err) {
      const nextAttempts = Number(row.attempts || 0) + 1;
      const delayMinutes = getNextAttemptDelayMinutes(nextAttempts);
      const finalFailure = nextAttempts >= MAX_ATTEMPTS;

      await pool.query(
        `
        update email_notifications
        set status = $2,
            attempts = attempts + 1,
            last_error = $3,
            next_attempt_at = now() + ($4 || ' minutes')::interval
        where id = $1
        `,
        [
          row.id,
          finalFailure ? "failed" : "pending",
          err.message || "Unknown email sending error",
          String(delayMinutes),
        ]
      );

      failed += 1;
      console.error(
        `❌ Email send failed for notification ${row.id}:`,
        err.message
      );
    }
  }

  return {
    processed: rows.length,
    sent,
    failed,
  };
}

module.exports = { processEmailQueue };

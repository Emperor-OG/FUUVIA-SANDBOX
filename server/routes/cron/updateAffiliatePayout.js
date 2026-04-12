const pool = require("../../db");

function startAffiliatePayoutJob() {
  console.log("🟢 Affiliate payout cron started");

  setInterval(async () => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `
        UPDATE affiliate_earnings
        SET
          earning_status = 'ready_for_payout',
          updated_at = NOW()
        WHERE earning_status = 'completed'
          AND eligible_for_payout_at IS NOT NULL
          AND eligible_for_payout_at <= NOW()
        RETURNING order_id
        `
      );

      const updatedRows = result.rows;

      if (updatedRows.length > 0) {
        const orderIds = updatedRows.map((r) => r.order_id);

        await client.query(
          `
          UPDATE orders
          SET affiliate_status = 'ready_for_payout',
              updated_at = NOW()
          WHERE id = ANY($1::int[])
          `,
          [orderIds]
        );

        console.log(
          `💸 Affiliate payouts unlocked: ${updatedRows.length}`
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Affiliate payout cron error:", err);
    } finally {
      client.release();
    }
  }, 60000); // every 60 seconds
}

module.exports = {
  startAffiliatePayoutJob,
};

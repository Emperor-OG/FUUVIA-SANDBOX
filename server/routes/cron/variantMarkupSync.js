const cron = require("node-cron");
const pool = require("../../db");
require("dotenv").config();

const MARKUP = parseFloat(process.env.MARKUP_PERCENTAGE || 12);

// Helper to round to 2 decimals for currency
function round2(num) {
  return Math.round((Number(num) + Number.EPSILON) * 100) / 100;
}

async function syncVariantMarkup() {
  const client = await pool.connect();

  try {
    console.log("🔄 Running variant markup sync...");

    await client.query("BEGIN");

    // Get all variants
    const { rows: variants } = await client.query(`
      SELECT id, seller_price, markup_percent, markup_price
      FROM variants
    `);

    let updatedCount = 0;

    for (const variant of variants) {
      const sellerPrice = Number(variant.seller_price || 0);

      if (Number.isNaN(sellerPrice)) {
        console.warn(`⚠️ Skipping variant ${variant.id}: invalid seller_price`);
        continue;
      }

      const newMarkupPercent = MARKUP;
      const newMarkupPrice = round2(sellerPrice * (1 + MARKUP / 100));

      const currentMarkupPercent = Number(variant.markup_percent || 0);
      const currentMarkupPrice = round2(Number(variant.markup_price || 0));

      const needsUpdate =
        currentMarkupPercent !== newMarkupPercent ||
        currentMarkupPrice !== newMarkupPrice;

      if (!needsUpdate) continue;

      await client.query(
        `
        UPDATE variants
        SET
          markup_percent = $1,
          markup_price = $2
        WHERE id = $3
        `,
        [newMarkupPercent, newMarkupPrice, variant.id]
      );

      updatedCount++;
    }

    await client.query("COMMIT");

    console.log(`✅ Variant markup sync complete. Updated ${updatedCount} variant(s).`);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Variant markup sync failed:", error);
  } finally {
    client.release();
  }
}

// Run on startup
syncVariantMarkup();

// Run every day at 02:00
cron.schedule("0 2 * * *", async () => {
  await syncVariantMarkup();
});

module.exports = syncVariantMarkup;

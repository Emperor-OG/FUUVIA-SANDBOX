const cron = require("node-cron");
const pool = require("../../db");
const fetch = require("node-fetch");

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const PLATFORM_PERCENTAGE = parseFloat(process.env.PLATFORM_PERCENTAGE) || 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

const headers = {
  Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
  "Content-Type": "application/json",
};

// ===========================================================
// Utility: Paystack Request Wrapper (FORCE ERROR VISIBILITY)
// ===========================================================
async function paystackRequest(url, method = "GET", body = null) {
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });

  const data = await res.json();

  if (!data.status) {
    console.error("❌ Paystack Error:", data);
    throw new Error(data.message || "Paystack request failed");
  }

  return data.data;
}

// ===========================================================
// Create Paystack Subaccount
// ===========================================================
async function createSubaccount(store) {
  console.log(`➡️ Creating subaccount for Store ${store.id}`);

  const sub = await paystackRequest(
    "https://api.paystack.co/subaccount",
    "POST",
    {
      business_name: store.store_name,
      settlement_bank: store.branch_code,
      account_number: store.account_number,
      percentage_charge: PLATFORM_PERCENTAGE, // YOUR CUT
      description: `FUUVIA Split for Store ${store.id}`,
    }
  );

  return sub.subaccount_code;
}

// ===========================================================
// Create Transfer Recipient (South Africa MUST use 'basa')
// ===========================================================
async function createRecipient(store) {
  console.log(`➡️ Creating recipient for Store ${store.id}`);

  const rec = await paystackRequest(
    "https://api.paystack.co/transferrecipient",
    "POST",
    {
      type: "basa", // ✅ SOUTH AFRICA
      name: store.account_holder,
      account_number: store.account_number,
      bank_code: store.branch_code,
      currency: "ZAR",
    }
  );

  return rec.recipient_code;
}

// ===========================================================
// Verify Subaccount Exists On Paystack
// ===========================================================
async function verifySubaccount(code) {
  return await paystackRequest(
    `https://api.paystack.co/subaccount/${code}`,
    "GET"
  );
}

// ===========================================================
// MAIN SYNC LOGIC
// ===========================================================
async function syncStores() {
  console.log("🔄 Running FUUVIA Paystack Sync...");

  const { rows: stores } = await pool.query(`SELECT * FROM stores`);

  for (const store of stores) {
    try {
      let subCode = store.subaccount_code;

      // ===================================================
      // If DB has code — confirm it still exists on Paystack
      // ===================================================
      if (subCode) {
        try {
          await verifySubaccount(subCode);
          console.log(`✅ Store ${store.id} already valid`);
          continue;
        } catch {
          console.warn(`⚠️ Store ${store.id} missing on Paystack — recreating`);
          subCode = null;
        }
      }

      // ===================================================
      // CREATE NEW PAYSTACK RECORDS
      // ===================================================
      const newSub = await createSubaccount(store);
      const newRec = await createRecipient(store);

      await pool.query(
        `UPDATE stores SET
          subaccount_code = $1,
          recipient_code = $2,
          onboarding_status = 'verified',
          subaccount_verified = true,
          verification_attempts = 0,
          last_verified_at = NOW()
        WHERE id = $3`,
        [newSub, newRec, store.id]
      );

      console.log(`🎉 Store ${store.id} fully onboarded`);
    } catch (err) {
      console.error(`❌ Store ${store.id} FAILED:`, err.message);

      await pool.query(
        `UPDATE stores SET verification_attempts = verification_attempts + 1 WHERE id = $1`,
        [store.id]
      );
    }
  }

  console.log("✅ Paystack Sync Complete\n");
}

// Run immediately on boot
syncStores();

// Run every 10 minutes (during launch phase)
cron.schedule("*/10 * * * *", syncStores);

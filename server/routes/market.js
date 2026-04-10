const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const fetch = require("node-fetch");
const { buckets, uploadFileToBucket } = require("../GCS");

// ------------------------
// Multer setup (Memory Storage for GCS Uploads)
// ------------------------
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

const uploadFields = upload.fields([
  { name: "banner", maxCount: 1 },
  { name: "logo", maxCount: 1 },
  { name: "compliance", maxCount: 1 },
  { name: "poa", maxCount: 1 },
  { name: "proofOfResidence", maxCount: 1 },
]);

// ------------------------
// Helpers
// ------------------------
function getUserEmail(req) {
  return (
    req.user?.email?.trim().toLowerCase() ||
    req.session?.user?.email?.trim().toLowerCase() ||
    null
  );
}

function requireAuth(req, res, next) {
  const userEmail = getUserEmail(req);

  if (!userEmail) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  req.userEmail = userEmail;
  next();
}

// ------------------------
// Paystack Helpers
// ------------------------
async function createPaystackSubaccount(store) {
  const platformPercentage =
    parseFloat(process.env.PLATFORM_PERCENTAGE) || 10;

  const response = await fetch("https://api.paystack.co/subaccount", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      business_name: store.storeName,
      settlement_bank: store.branchCode,
      account_number: store.accountNumber,
      percentage_charge: platformPercentage,
    }),
  });

  const data = await response.json();

  if (!data.status) {
    throw new Error(data.message || "Failed to create Paystack subaccount");
  }

  return data.data.subaccount_code;
}

async function createPaystackTransferRecipient(store) {
  const response = await fetch("https://api.paystack.co/transferrecipient", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "nuban",
      name: store.accountHolder,
      account_number: store.accountNumber,
      bank_code: store.branchCode,
      currency: "ZAR",
    }),
  });

  const data = await response.json();

  if (!data.status) {
    throw new Error(
      data.message || "Failed to create Paystack transfer recipient"
    );
  }

  return data.data.recipient_code;
}

// ------------------------
// POST /api/stores - Create Store
// Protected: sign-in required
// ------------------------
router.post("/", requireAuth, uploadFields, async (req, res) => {
  try {
    const userEmail = req.userEmail;

    const {
      storeName,
      storeOwner,
      cellNumber,
      secondaryNumber,
      email,
      country,
      street,
      suburb,
      province,
      city,
      postalCode,
      description,
      bankName,
      branchCode,
      accountHolder,
      accountNumber,
      accountType,
    } = req.body;

    if (
      !storeName ||
      !storeOwner ||
      !cellNumber ||
      !email ||
      !country ||
      !street ||
      !province ||
      !city ||
      !postalCode ||
      !description ||
      !bankName ||
      !branchCode ||
      !accountHolder ||
      !accountNumber ||
      !accountType
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required store fields",
      });
    }

    // ------------------------
    // Upload files to GCS
    // ------------------------
    const bannerUrl = req.files?.banner?.[0]
      ? await uploadFileToBucket(req.files.banner[0], buckets.storeBanners)
      : null;

    const logoUrl = req.files?.logo?.[0]
      ? await uploadFileToBucket(req.files.logo[0], buckets.storeLogos)
      : null;

    const complianceUrl = req.files?.compliance?.[0]
      ? await uploadFileToBucket(req.files.compliance[0], buckets.storeDocuments)
      : null;

    const poaUrl = req.files?.poa?.[0]
      ? await uploadFileToBucket(req.files.poa[0], buckets.storePOA)
      : null;

    const proofOfResidenceUrl = req.files?.proofOfResidence?.[0]
      ? await uploadFileToBucket(
          req.files.proofOfResidence[0],
          buckets.proofOfResidence
        )
      : null;

    // ------------------------
    // Insert store without Paystack codes
    // ------------------------
    const result = await pool.query(
      `INSERT INTO stores (
        store_name, store_owner, cell_number, secondary_number, email, country,
        street, suburb, province, city, postal_code, description,
        bank_name, branch_code, account_holder, account_number, account_type,
        banner_url, logo_url, compliance_url, poa_url, proof_of_residence_url,
        admin1
      ) VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,$11,$12,
        $13,$14,$15,$16,$17,
        $18,$19,$20,$21,$22,
        $23
      )
      RETURNING *`,
      [
        storeName,
        storeOwner,
        cellNumber,
        secondaryNumber || null,
        email,
        country,
        street,
        suburb || null,
        province,
        city,
        postalCode,
        description,
        bankName,
        branchCode,
        accountHolder,
        accountNumber,
        accountType,
        bannerUrl,
        logoUrl,
        complianceUrl,
        poaUrl,
        proofOfResidenceUrl,
        userEmail,
      ]
    );

    const store = result.rows[0];

    // ------------------------
    // Create Paystack Subaccount
    // ------------------------
    const subaccountCode = await createPaystackSubaccount({
      storeName,
      branchCode,
      accountNumber,
    });

    // ------------------------
    // Create Paystack Transfer Recipient
    // ------------------------
    const recipientCode = await createPaystackTransferRecipient({
      accountHolder,
      accountNumber,
      branchCode,
    });

    // ------------------------
    // Update store with Paystack codes
    // ------------------------
    const updatedStore = await pool.query(
      `UPDATE stores
       SET subaccount_code = $1, recipient_code = $2
       WHERE id = $3
       RETURNING *`,
      [subaccountCode, recipientCode, store.id]
    );

    return res.json({ success: true, store: updatedStore.rows[0] });
  } catch (err) {
    console.error("❌ Error creating store:", err.message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ------------------------
// GET /api/stores - Fetch all stores
// Public: free browsing
// ------------------------
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM stores ORDER BY id ASC");
    return res.json({ success: true, stores: result.rows });
  } catch (err) {
    console.error("❌ Error fetching stores:", err.message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ------------------------
// GET /api/stores/my - Fetch stores for logged-in user
// Protected
// ------------------------
router.get("/my", requireAuth, async (req, res) => {
  try {
    const userEmail = req.userEmail;

    const result = await pool.query(
      `SELECT * FROM stores
       WHERE LOWER(COALESCE(admin1, '')) = $1
          OR LOWER(COALESCE(admin2, '')) = $1
          OR LOWER(COALESCE(admin3, '')) = $1
          OR LOWER(COALESCE(admin4, '')) = $1
          OR LOWER(COALESCE(admin5, '')) = $1
          OR LOWER(COALESCE(admin6, '')) = $1
          OR LOWER(COALESCE(admin7, '')) = $1
          OR LOWER(COALESCE(admin8, '')) = $1
          OR LOWER(COALESCE(admin9, '')) = $1
          OR LOWER(COALESCE(admin10, '')) = $1
       ORDER BY id ASC`,
      [userEmail]
    );

    return res.json({ success: true, stores: result.rows });
  } catch (err) {
    console.error("❌ Error fetching user stores:", err.message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;

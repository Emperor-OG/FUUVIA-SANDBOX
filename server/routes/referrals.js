const express = require("express");
const pool = require("../db");

const router = express.Router();

const REF_COOKIE_NAME = "fuuvia_affiliate_ref";
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 30; // 30 days

function getFrontendRedirectBase() {
  if (process.env.NODE_ENV === "production") {
    return process.env.ORIGIN || "https://www.fuuvia.com";
  }
  return "http://localhost:5173";
}

router.get("/REF/:code", async (req, res) => {
  try {
    const rawCode = req.params.code || "";
    const referralCode = rawCode.trim().toUpperCase();

    if (!referralCode) {
      return res.redirect(getFrontendRedirectBase());
    }

    const affiliateRes = await pool.query(
      `
      SELECT id, full_name, referral_code, status
      FROM affiliates
      WHERE referral_code = $1
      LIMIT 1
      `,
      [referralCode]
    );

    const affiliate = affiliateRes.rows[0];

    if (!affiliate || affiliate.status !== "active") {
      return res.redirect(getFrontendRedirectBase());
    }

    res.cookie(
      REF_COOKIE_NAME,
      JSON.stringify({
        code: affiliate.referral_code,
        affiliate_id: affiliate.id,
        full_name: affiliate.full_name,
        captured_at: new Date().toISOString(),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        maxAge: COOKIE_MAX_AGE,
        path: "/",
      }
    );

    return res.redirect(getFrontendRedirectBase());
  } catch (error) {
    console.error("Referral capture error:", error);
    return res.redirect(getFrontendRedirectBase());
  }
});

module.exports = router;

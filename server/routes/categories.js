const express = require("express");
const router = express.Router();
const pool = require("../db");

/* =========================================================
   GET ALL CATEGORIES
========================================================= */
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `
      SELECT id, name, slug, markup_percent, icon
      FROM categories
      ORDER BY name ASC
      `
    );

    res.json(result.rows);
  } catch (err) {
    console.error("GET categories error:", err);

    res.status(500).json({
      error: "Failed to fetch categories",
    });
  }
});

module.exports = router;

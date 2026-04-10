// routes/search.js
const express = require("express");
const router = express.Router();
const db = require("../db"); // PostgreSQL client

router.get("/search-users", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);

  try {
    const result = await db.query(
      `SELECT google_id, display_name, profile_pic
       FROM users
       WHERE display_name ILIKE $1
       LIMIT 10`,
      [`%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router;
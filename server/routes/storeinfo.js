const express = require("express");
const router = express.Router();
const pool = require("../db");
const multer = require("multer");
const { buckets, uploadFileToBucket, deleteFileFromBucket } = require("../GCS");

const upload = multer({ storage: multer.memoryStorage() });

/* ============================================
   GET — Fetch single store info + schedule
============================================ */
router.get("/storefront/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT s.*, 
              sc.monday_open, sc.monday_close,
              sc.tuesday_open, sc.tuesday_close,
              sc.wednesday_open, sc.wednesday_close,
              sc.thursday_open, sc.thursday_close,
              sc.friday_open, sc.friday_close,
              sc.saturday_open, sc.saturday_close,
              sc.sunday_open, sc.sunday_close
       FROM stores s
       LEFT JOIN store_schedule sc ON sc.store_id = s.id
       WHERE s.id = $1`,
      [id]
    );

    if (!result.rows.length)
      return res.status(404).json({ error: "Store not found" });

    const store = result.rows[0];

    for (let i = 1; i <= 10; i++) {
      store[`admin${i}`] = store[`admin${i}`] || "";
      if (Array.isArray(store[`admin${i}`]))
        store[`admin${i}`] = store[`admin${i}`][0];
    }

    res.json({ store });
  } catch (err) {
    console.error("❌ Error fetching store:", err);
    res.status(500).json({ error: "Database error" });
  }
});

/* ============================================
   PUT — Update store info + schedule
============================================ */
router.put(
  "/storefront/:id",
  upload.fields([
    { name: "bannerFile", maxCount: 1 },
    { name: "logoFile", maxCount: 1 },
  ]),
  async (req, res) => {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const data = req.body;
      const files = req.files;

      await client.query("BEGIN");

      // ---------- Banner Upload ----------
      if (files?.bannerFile?.[0]) {
        const old = await client.query("SELECT banner_url FROM stores WHERE id=$1", [id]);
        if (old.rows[0]?.banner_url)
          await deleteFileFromBucket(buckets.storeBanners, old.rows[0].banner_url);

        const bannerUrl = await uploadFileToBucket(files.bannerFile[0], buckets.storeBanners);
        data.banner_url = bannerUrl;
      }

      // ---------- Logo Upload ----------
      if (files?.logoFile?.[0]) {
        const old = await client.query("SELECT logo_url FROM stores WHERE id=$1", [id]);
        if (old.rows[0]?.logo_url)
          await deleteFileFromBucket(buckets.storeLogos, old.rows[0].logo_url);

        const logoUrl = await uploadFileToBucket(files.logoFile[0], buckets.storeLogos);
        data.logo_url = logoUrl;
      }

      // ---------- Update Stores Table ----------
      const storeFields = [
        "store_name", "store_owner", "cell_number", "secondary_number",
        "email", "country", "province", "cities", "description",
        "bank_name", "account_holder", "account_number", "account_type",
        "banner_url", "logo_url", "is_open"
      ];

      const updates = [];
      const values = [];
      let idx = 1;

      storeFields.forEach(f => {
        if (data[f] !== undefined) {
          updates.push(`${f}=$${idx++}`);
          values.push(data[f]);
        }
      });

      for (let i = 2; i <= 10; i++) {
        let val = data[`admin${i}`];
        if (Array.isArray(val)) val = val[0];
        updates.push(`admin${i}=$${idx++}`);
        values.push(val || "");
      }

      values.push(id);
      await client.query(`UPDATE stores SET ${updates.join(", ")} WHERE id=$${idx}`, values);

      // ---------- Update Store Schedule ----------
      const scheduleFields = [
        "monday_open","monday_close","tuesday_open","tuesday_close",
        "wednesday_open","wednesday_close","thursday_open","thursday_close",
        "friday_open","friday_close","saturday_open","saturday_close",
        "sunday_open","sunday_close"
      ];

      const sUpdates = [];
      const sValues = [];
      let sIdx = 1;

      scheduleFields.forEach(f => {
        const val = data[f] === "" ? null : data[f];
        sUpdates.push(`${f}=$${sIdx++}`);
        sValues.push(val);
      });

      sValues.push(id);

      const exists = await client.query("SELECT 1 FROM store_schedule WHERE store_id=$1", [id]);

      if (exists.rows.length) {
        await client.query(`UPDATE store_schedule SET ${sUpdates.join(", ")} WHERE store_id=$${sIdx}`, sValues);
      } else {
        await client.query(
          `INSERT INTO store_schedule (store_id, ${scheduleFields.join(", ")})
           VALUES ($1, ${scheduleFields.map((_, i) => `$${i + 2}`).join(", ")})`,
          [id, ...scheduleFields.map(f => data[f] || null)]
        );
      }

      await client.query("COMMIT");
      res.json({ success: true, message: "✅ Store updated successfully" });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("❌ Error updating store:", err);
      res.status(500).json({ error: "Failed to update store" });
    } finally {
      client.release();
    }
  }
);

/* ============================================
   DELETE — Remove store + related assets
============================================ */
router.delete("/storefront/:id", async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const storeRes = await client.query("SELECT banner_url, logo_url FROM stores WHERE id=$1", [id]);
    if (!storeRes.rows.length) throw new Error("Store not found");
    const store = storeRes.rows[0];

    const productsRes = await client.query("SELECT images FROM products WHERE store_id=$1", [id]);
    const productImages = productsRes.rows.flatMap(r =>
      r.images ? r.images.split(",").map(s => s.trim()).filter(Boolean) : []
    );

    for (const url of productImages) {
      await deleteFileFromBucket(buckets.storeProducts, url);
    }
    if (store.banner_url) await deleteFileFromBucket(buckets.storeBanners, store.banner_url);
    if (store.logo_url) await deleteFileFromBucket(buckets.storeLogos, store.logo_url);

    await client.query("DELETE FROM products WHERE store_id=$1", [id]);
    await client.query("DELETE FROM delivery_locations WHERE store_id=$1", [id]);
    await client.query("DELETE FROM dropoff_locations WHERE store_id=$1", [id]);
    await client.query("DELETE FROM store_schedule WHERE store_id=$1", [id]);
    await client.query("DELETE FROM stores WHERE id=$1", [id]);

    await client.query("COMMIT");
    res.json({ success: true, message: "✅ Store deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Error deleting store:", err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;

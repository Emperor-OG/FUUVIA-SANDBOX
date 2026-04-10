const express = require("express");
const router = express.Router();
const pool = require("../db");

// =====================================================
// GET ALL PROVINCES + CITIES (used in Admin Modal)
// =====================================================
router.get("/provinces", async (req, res) => {
  try {
    const provinces = await pool.query(`
      SELECT id, name FROM provinces ORDER BY name
    `);

    const cities = await pool.query(`
      SELECT id, name, province_id FROM cities ORDER BY name
    `);

    const provinceMap = {};

    provinces.rows.forEach((p) => {
      provinceMap[p.id] = { ...p, cities: [] };
    });

    cities.rows.forEach((c) => {
      if (provinceMap[c.province_id]) {
        provinceMap[c.province_id].cities.push(c);
      }
    });

    res.json(Object.values(provinceMap));
  } catch (err) {
    console.error("Provinces fetch error:", err);
    res.status(500).json({ error: "Failed to fetch provinces" });
  }
});

// =====================================================
// GET STORE DELIVERY CONFIG (RESTORES ADMIN STATE)
// =====================================================
router.get("/:storeId/delivery_locations", async (req, res) => {
  const { storeId } = req.params;

  try {
    const [provinceRows, cityRows, storeRows] = await Promise.all([
      pool.query(
        `
        SELECT province_id, default_fee, default_estimated_time
        FROM store_delivery_provinces
        WHERE store_id=$1
      `,
        [storeId]
      ),

      pool.query(
        `
        SELECT city_id, override_fee, override_estimated_time
        FROM store_delivery_city_overrides
        WHERE store_id=$1
      `,
        [storeId]
      ),

      pool.query(
        `
        SELECT delivers_nationwide, nationwide_fee, nationwide_estimated_time
        FROM stores
        WHERE id=$1
      `,
        [storeId]
      ),
    ]);

    const selections = {};

    provinceRows.rows.forEach((prov) => {
      selections[prov.province_id] = {
        checked: true,
        fee: prov.default_fee,
        est: prov.default_estimated_time,
        cities: {},
      };
    });

    if (cityRows.rows.length) {
      const cityProvinceLookup = await pool.query(
        `SELECT id, province_id FROM cities`
      );

      const lookup = {};
      cityProvinceLookup.rows.forEach((c) => {
        lookup[c.id] = c.province_id;
      });

      cityRows.rows.forEach((city) => {
        const provinceId = lookup[city.city_id];
        if (!provinceId) return;

        if (!selections[provinceId]) {
          selections[provinceId] = {
            checked: false,
            fee: "",
            est: "",
            cities: {},
          };
        }

        selections[provinceId].cities[city.city_id] = {
          checked: true,
          fee: city.override_fee,
          est: city.override_estimated_time,
        };
      });
    }

    res.json({
      store:
        storeRows.rows[0] || {
          delivers_nationwide: false,
          nationwide_fee: null,
          nationwide_estimated_time: null,
        },
      selections,
    });
  } catch (err) {
    console.error("Delivery load error:", err);
    res.status(500).json({ error: "Failed to load delivery config" });
  }
});

// =====================================================
// SAVE DELIVERY CONFIG
// =====================================================
router.post("/:storeId/delivery/bulk", async (req, res) => {
  const { storeId } = req.params;
  const { nationwide, nationwideFee, nationwideEst, locations } = req.body;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ----------------------------------
    // Update nationwide settings
    // ----------------------------------
    await client.query(
      `
      UPDATE stores
      SET delivers_nationwide=$1,
          nationwide_fee=$2,
          nationwide_estimated_time=$3
      WHERE id=$4
    `,
      [
        nationwide,
        nationwide ? nationwideFee || 0 : null,
        nationwide ? nationwideEst || "" : null,
        storeId,
      ]
    );

    // ----------------------------------
    // Clear old delivery config
    // ----------------------------------
    await client.query(
      `DELETE FROM store_delivery_city_overrides WHERE store_id=$1`,
      [storeId]
    );

    await client.query(
      `DELETE FROM store_delivery_provinces WHERE store_id=$1`,
      [storeId]
    );

    // ----------------------------------
    // Insert new config
    // ----------------------------------
    if (!nationwide && locations && locations.length) {
      const provinceMap = {};

      for (const loc of locations) {
        const { province_id, city_id, fee, est } = loc;

        if (!provinceMap[province_id]) {
          provinceMap[province_id] = {
            fee: fee || 0,
            est: est || "",
          };
        }

        await client.query(
          `
          INSERT INTO store_delivery_city_overrides
          (store_id, city_id, override_fee, override_estimated_time)
          VALUES ($1,$2,$3,$4)
        `,
          [storeId, city_id, fee || 0, est || ""]
        );
      }

      for (const provinceId of Object.keys(provinceMap)) {
        const prov = provinceMap[provinceId];

        await client.query(
          `
          INSERT INTO store_delivery_provinces
          (store_id, province_id, default_fee, default_estimated_time)
          VALUES ($1,$2,$3,$4)
        `,
          [storeId, provinceId, prov.fee, prov.est]
        );
      }
    }

    await client.query("COMMIT");

    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Delivery save error:", err);
    res.status(500).json({ error: "Failed to save delivery config" });
  } finally {
    client.release();
  }
});

// =====================================================
// CHECKOUT DELIVERY OPTIONS (CUSTOMER SIDE)
// =====================================================
router.get("/:storeId/checkout-options", async (req, res) => {
  const { storeId } = req.params;

  try {
    const storeResult = await pool.query(
      `
      SELECT delivers_nationwide, nationwide_fee, nationwide_estimated_time
      FROM stores
      WHERE id=$1
    `,
      [storeId]
    );

    if (!storeResult.rows.length)
      return res.status(404).json({ error: "Store not found" });

    const store = storeResult.rows[0];

    // ----------------------------------
    // Nationwide delivery
    // ----------------------------------
    if (store.delivers_nationwide) {
      const [provinces, cities] = await Promise.all([
        pool.query(`SELECT id, name FROM provinces ORDER BY name`),
        pool.query(`SELECT id, name, province_id FROM cities ORDER BY name`),
      ]);

      return res.json({
        delivers_nationwide: true,
        nationwide_fee: Number(store.nationwide_fee) || 0,
        nationwide_estimated_time: store.nationwide_estimated_time || "",
        provinces: provinces.rows || [],
        cities: cities.rows || [],
      });
    }

    // ----------------------------------
    // Store specific cities
    // ----------------------------------
    const allowedCities = await pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.province_id,
        COALESCE(sdco.override_fee, sdp.default_fee) AS price,
        COALESCE(sdco.override_estimated_time, sdp.default_estimated_time) AS estimated_time
      FROM store_delivery_city_overrides sdco
      JOIN cities c ON c.id = sdco.city_id
      JOIN store_delivery_provinces sdp
        ON sdp.province_id = c.province_id
       AND sdp.store_id = $1
      WHERE sdco.store_id = $1
      ORDER BY c.name
    `,
      [storeId]
    );

    const provinces = await pool.query(
      `SELECT id, name FROM provinces ORDER BY name`
    );

    res.json({
      delivers_nationwide: false,
      nationwide_fee: null,
      nationwide_estimated_time: null,
      provinces: provinces.rows || [],
      cities: allowedCities.rows || [],
    });
  } catch (err) {
    console.error("Checkout delivery error:", err);
    res.status(500).json({ error: "Failed to load checkout delivery options" });
  }
});

module.exports = router;

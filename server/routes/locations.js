const express = require('express');
const router = express.Router();
const pool = require('../db');
require('dotenv').config();

// ===== DELIVERY LOCATIONS =====

// Add a delivery location
router.post('/:storeId/delivery', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { province, city, suburb, postal_code, price, estimated_time } = req.body;

    const result = await pool.query(
      `INSERT INTO delivery_locations
       (store_id, province, city, town, postal_code, price, estimated_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, province, city, town AS suburb, postal_code, price, estimated_time`,
      [storeId, province, city, suburb, postal_code, parseFloat(price), estimated_time]
    );

    res.json({ location: result.rows[0] });
  } catch (err) {
    console.error("❌ Error adding delivery location:", err);
    res.status(500).json({ error: "Failed to add delivery location" });
  }
});

// Update a delivery location
router.put('/:storeId/delivery/:locationId', async (req, res) => {
  try {
    const { storeId, locationId } = req.params;
    const { province, city, suburb, postal_code, price, estimated_time } = req.body;

    const result = await pool.query(
      `UPDATE delivery_locations
       SET province=$1, city=$2, town=$3, postal_code=$4, price=$5, estimated_time=$6
       WHERE id=$7 AND store_id=$8
       RETURNING id, province, city, town AS suburb, postal_code, price, estimated_time`,
      [province, city, suburb, postal_code, parseFloat(price), estimated_time, locationId, storeId]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Delivery location not found" });
    res.json({ location: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating delivery location:", err);
    res.status(500).json({ error: "Failed to update delivery location" });
  }
});

// Delete a delivery location
router.delete('/:storeId/delivery/:locationId', async (req, res) => {
  try {
    const { storeId, locationId } = req.params;
    const result = await pool.query(
      'DELETE FROM delivery_locations WHERE id=$1 AND store_id=$2 RETURNING id',
      [locationId, storeId]
    );

    if (!result.rows.length) return res.status(404).json({ error: "Delivery location not found" });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting delivery location:", err);
    res.status(500).json({ error: "Failed to delete delivery location" });
  }
});

// Get delivery locations for a store
router.get('/delivery_locations', async (req, res) => {
  const storeId = parseInt(req.query.store_id, 10);
  if (!storeId) return res.status(400).json({ error: "store_id required" });

  try {
    const result = await pool.query(
      `SELECT id, province, city, town AS suburb, postal_code, price, estimated_time
       FROM delivery_locations
       WHERE store_id=$1`,
      [storeId]
    );
    res.json({ locations: result.rows });
  } catch (err) {
    console.error("❌ Error fetching delivery locations:", err);
    res.status(500).json({ error: "Failed to load delivery locations" });
  }
});

// ===== DROP-OFF LOCATIONS =====

// Add a drop-off location
router.post('/:storeId/dropoff', async (req, res) => {
  try {
    const { storeId } = req.params;
    const { province, city, suburb, postal_code, street_address, price, notes } = req.body;

    const result = await pool.query(
      `INSERT INTO dropoff_locations
       (store_id, province, city, town, postal_code, street_address, price, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, province, city, town AS suburb, postal_code, street_address, price, notes`,
      [storeId, province, city, suburb, postal_code, street_address, parseFloat(price), notes]
    );

    res.status(201).json({ success: true, location: result.rows[0] });
  } catch (err) {
    console.error("❌ Error adding drop-off location:", err);
    res.status(500).json({ success: false, error: "Failed to add drop-off location" });
  }
});

// Update a drop-off location
router.put('/:storeId/dropoff/:locationId', async (req, res) => {
  try {
    const { storeId, locationId } = req.params;
    const { province, city, suburb, postal_code, street_address, price, notes } = req.body;

    const result = await pool.query(
      `UPDATE dropoff_locations
       SET province=$1, city=$2, town=$3, postal_code=$4, street_address=$5, price=$6, notes=$7
       WHERE id=$8 AND store_id=$9
       RETURNING id, province, city, town AS suburb, postal_code, street_address, price, notes`,
      [province, city, suburb, postal_code, street_address, parseFloat(price), notes, locationId, storeId]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Drop-off location not found' });
    res.json({ success: true, location: result.rows[0] });
  } catch (err) {
    console.error("❌ Error updating drop-off location:", err);
    res.status(500).json({ success: false, error: "Failed to update drop-off location" });
  }
});

// Delete a drop-off location
router.delete('/:storeId/dropoff/:locationId', async (req, res) => {
  try {
    const { storeId, locationId } = req.params;
    const result = await pool.query(
      'DELETE FROM dropoff_locations WHERE id=$1 AND store_id=$2 RETURNING id',
      [locationId, storeId]
    );

    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Drop-off location not found' });
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error deleting drop-off location:", err);
    res.status(500).json({ success: false, error: "Failed to delete drop-off location" });
  }
});

// Get drop-off locations for a store
router.get('/dropoff_locations', async (req, res) => {
  const storeId = parseInt(req.query.store_id, 10);
  if (!storeId) return res.status(400).json({ error: "store_id required" });

  try {
    const result = await pool.query(
      `SELECT id, province, city, town AS suburb, postal_code, street_address, price, notes
       FROM dropoff_locations
       WHERE store_id=$1`,
      [storeId]
    );
    res.json({ locations: result.rows });
  } catch (err) {
    console.error("❌ Error fetching drop-off locations:", err);
    res.status(500).json({ error: "Failed to load drop-off locations" });
  }
});

// ===== COMBINED DELIVERY + DROP-OFF LOCATIONS =====
router.get('/locations', async (req, res) => {
  const storeId = parseInt(req.query.store_id, 10);
  if (!storeId) return res.status(400).json({ error: "store_id required" });

  try {
    const [delivery, dropoff] = await Promise.all([
      pool.query(
        `SELECT id, province, city, town AS suburb, postal_code, price, estimated_time
         FROM delivery_locations WHERE store_id=$1`,
        [storeId]
      ),
      pool.query(
        `SELECT id, province, city, town AS suburb, postal_code, street_address, price, notes
         FROM dropoff_locations WHERE store_id=$1`,
        [storeId]
      )
    ]);

    res.json({
      delivery_locations: delivery.rows,
      dropoff_locations: dropoff.rows
    });
  } catch (err) {
    console.error("❌ Error fetching combined locations:", err);
    res.status(500).json({ error: "Failed to fetch locations" });
  }
});

module.exports = router;

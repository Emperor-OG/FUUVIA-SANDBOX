const cron = require("node-cron");
const pool = require("../../db");

/* ============================================
   HELPER — Get current SAST time (timezone safe)
============================================ */
function getSASTNow() {
  const now = new Date();

  // Convert to Africa/Johannesburg regardless of server timezone
  const parts = new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now);

  const map = {};
  parts.forEach(p => (map[p.type] = p.value));

  const dayMap = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3,
    Thu: 4, Fri: 5, Sat: 6,
  };

  return {
    day: dayMap[map.weekday],
    minutesNow: parseInt(map.hour) * 60 + parseInt(map.minute),
    display: `${map.weekday} ${map.hour}:${map.minute}`,
  };
}

/* ============================================
   HELPER — Determine if store should be open
   (supports overnight hours like 22:00–02:00)
============================================ */
function isStoreOpenNow(schedule, sast) {
  let openTime, closeTime;

  switch (sast.day) {
    case 0: openTime = schedule.sunday_open; closeTime = schedule.sunday_close; break;
    case 1: openTime = schedule.monday_open; closeTime = schedule.monday_close; break;
    case 2: openTime = schedule.tuesday_open; closeTime = schedule.tuesday_close; break;
    case 3: openTime = schedule.wednesday_open; closeTime = schedule.wednesday_close; break;
    case 4: openTime = schedule.thursday_open; closeTime = schedule.thursday_close; break;
    case 5: openTime = schedule.friday_open; closeTime = schedule.friday_close; break;
    case 6: openTime = schedule.saturday_open; closeTime = schedule.saturday_close; break;
  }

  if (!openTime || !closeTime) return false;

  const [openH, openM] = openTime.split(":").map(Number);
  const [closeH, closeM] = closeTime.split(":").map(Number);

  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;
  const now = sast.minutesNow;

  // Normal same-day schedule (09:00 → 18:00)
  if (closeMinutes >= openMinutes) {
    return now >= openMinutes && now <= closeMinutes;
  }

  // Overnight schedule (22:00 → 02:00)
  return now >= openMinutes || now <= closeMinutes;
}

/* ============================================
   CORE — Update all stores
============================================ */
async function updateStoreStatus() {
  const sast = getSASTNow();

  try {
    const storesRes = await pool.query("SELECT id FROM stores");

    for (const store of storesRes.rows) {
      const scheduleRes = await pool.query(
        "SELECT * FROM store_schedule WHERE store_id = $1",
        [store.id]
      );

      const schedule = scheduleRes.rows[0];
      if (!schedule) continue;

      const shouldBeOpen = isStoreOpenNow(schedule, sast);

      await pool.query(
        "UPDATE stores SET is_open = $1 WHERE id = $2",
        [shouldBeOpen, store.id]
      );
    }

    console.log(`✅ Store statuses updated (${sast.display} SAST)`);
  } catch (err) {
    console.error("❌ Error updating store status:", err);
  }
}

/* ============================================
   STARTER — Explicitly start cron (IMPORTANT)
============================================ */
function startUpdateStoreStatusJob() {
  console.log("⏰ Initialising store status cron...");

  cron.schedule("* * * * *", updateStoreStatus, {
    timezone: "Africa/Johannesburg",
  });

  console.log("✅ Cron running every minute (SAST locked)");
}

module.exports = {
  startUpdateStoreStatusJob,
  updateStoreStatus, // exported for manual triggering/testing if needed
};

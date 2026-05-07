const express = require("express");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const cors = require("cors");
const passport = require("passport");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const pool = require("./db");
const { verifyEmailTransporters } = require("./services/emailService");
const { processEmailQueue } = require("./jobs/processEmailQueue");

// -----------------------------------
// Load .env
// -----------------------------------
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

// -----------------------------------
// App init
// -----------------------------------
const app = express();
const isProd = process.env.NODE_ENV === "production";
const ORIGIN = isProd ? process.env.ORIGIN : "http://localhost:5173";

console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("PORT:", process.env.PORT || 8080);
console.log("ORIGIN:", ORIGIN);

app.set("trust proxy", 1);

// -----------------------------------
// Middleware
// -----------------------------------

// Use raw body for Paystack webhook ONLY
app.use((req, res, next) => {
  if (req.originalUrl === "/api/paystack/webhook") {
    return express.raw({ type: "application/json" })(req, res, next);
  }
  next();
});

// JSON & URL-encoded for all other routes
app.use((req, res, next) => {
  if (req.originalUrl === "/api/paystack/webhook") return next();
  return express.json({ limit: "10mb" })(req, res, next);
});

app.use((req, res, next) => {
  if (req.originalUrl === "/api/paystack/webhook") return next();
  return express.urlencoded({ extended: true, limit: "10mb" })(req, res, next);
});

// CORS
app.use(
  cors({
    origin: ORIGIN,
    credentials: true,
  })
);

// -----------------------------------
// Sessions
// -----------------------------------
app.use(
  session({
    store: new pgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "fallback_secret",
    resave: false,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    cookie: {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  })
);

// -----------------------------------
// Passport Setup
// -----------------------------------
try {
  require("./auth");
} catch (err) {
  console.error("Error loading auth:", err);
}

app.use(passport.initialize());
app.use(passport.session());

// -----------------------------------
// Auth Middleware
// -----------------------------------
function verifyUser(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      authenticated: false,
      error: "Not authenticated",
    });
  }
  next();
}

// -----------------------------------
// Debug Route
// -----------------------------------
app.get("/api/debug-user", (req, res) => {
  console.log("DEBUG REQ.USER:", req.user);
  res.json({
    authenticated: !!req.user,
    user: req.user || null,
  });
});

// -----------------------------------
// API Routes
// -----------------------------------
const userRoutes = require("./routes/user");
const marketRoutes = require("./routes/market");
const storeInfoRoutes = require("./routes/storeinfo");
const productRoutes = require("./routes/products");
const deliveryRoutes = require("./routes/delivery");
const locationsRoutes = require("./routes/locations");
const paymentRoutes = require("./routes/payment");
const ordersRouter = require("./routes/orders");
const paystackWebhookRouter = require("./routes/paystackWebhook");
const referralRoutes = require("./routes/referrals");
const categoriesRoutes = require("./routes/categories");

app.use("/api/user", userRoutes);
app.use("/api/stores", marketRoutes);
app.use("/api/stores", storeInfoRoutes);
app.use("/api/stores", productRoutes);
app.use("/api", deliveryRoutes);
app.use("/api", locationsRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/orders", verifyUser, ordersRouter);
app.use("/api/paystack", paystackWebhookRouter);
app.use("/", referralRoutes); //referral
app.use("/api/categories", categoriesRoutes);

// -----------------------------------
// Cron Jobs
// -----------------------------------
try {
  require("./routes/cron/createSubaccounts");
  require("./routes/cron/variantMarkupSync");

  const {
    startUpdateStoreStatusJob,
  } = require("./routes/cron/updateStoreStatus");

  const {
    startAffiliatePayoutJob,
  } = require("./routes/cron/updateAffiliatePayout"); // 👈 ADD THIS

  startUpdateStoreStatusJob();
  startAffiliatePayoutJob(); // 👈 START IT

} catch (err) {
  console.error("Error initializing cron jobs:", err);
}

// -----------------------------------
// Auth Routes (Google)
// -----------------------------------
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: `${ORIGIN}/login-failed`,
  }),
  (req, res) => {
    res.redirect(`${ORIGIN}/login-success`);
  }
);

app.get("/auth/logout", (req, res, next) => {
  if (!req.user) {
    return res.status(400).json({
      authenticated: false,
      message: "Not logged in",
    });
  }

  req.logout((err) => {
    if (err) return next(err);

    if (req.session) {
      req.session.destroy((sessionErr) => {
        if (sessionErr) {
          console.error("Error destroying session:", sessionErr);
        }

        res.clearCookie("connect.sid", {
          path: "/",
          httpOnly: true,
          secure: isProd,
          sameSite: isProd ? "none" : "lax",
        });

        return res.json({
          authenticated: false,
          message: "Logged out successfully",
        });
      });
    } else {
      return res.json({
        authenticated: false,
        message: "Logged out successfully",
      });
    }
  });
});

// Always return 200 so public pages can check auth without noisy 401s
app.get("/auth/user", (req, res) => {
  if (req.user) {
    return res.json({
      authenticated: true,
      user: req.user,
    });
  }

  return res.json({
    authenticated: false,
    user: null,
  });
});

// -----------------------------------
// Health Check
// -----------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", message: "Server running" });
});

// -----------------------------------
// Serve Frontend (in Production)
// -----------------------------------
if (isProd) {
  const clientPath = path.join(__dirname, "../client/dist");

  console.log("Resolved clientPath:", clientPath);
  console.log("clientPath exists:", fs.existsSync(clientPath));

  if (fs.existsSync(clientPath)) {
    app.use(express.static(clientPath));

    app.use((req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/auth")) {
        return next();
      }

      return res.sendFile(path.join(clientPath, "index.html"));
    });
  } else {
    console.warn("client/dist not found in production");
  }
}

// -----------------------------------
// Error Handling
// -----------------------------------
app.use((req, res) => res.status(404).json({ error: "Not found" }));

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

// -----------------------------------
// Start Server
// -----------------------------------
const PORT = process.env.PORT || 8080;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, async () => {
  console.log(
    `✅ Server running on ${HOST}:${PORT} (${isProd ? "Production" : "Dev"})`
  );
  console.log(`🌍 CORS Origin: ${ORIGIN}`);

  try {
    await verifyEmailTransporters();
  } catch (err) {
    console.error("❌ Email SMTP verification failed:", err.message);
  }

  setInterval(async () => {
    try {
      const result = await processEmailQueue(20);
      if (result.processed > 0) {
        console.log("📧 Email queue processed:", result);
      }
    } catch (err) {
      console.error("❌ Email queue worker error:", err.message);
    }
  }, 15000);
});

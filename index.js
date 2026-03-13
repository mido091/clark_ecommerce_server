// ── Imports ───────────────────────────────────────────────────────
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { errorHandler } from "./middlewares/error.js";
import { apiLimiter, csrfCheck } from "./middlewares/security.js";
import { sanitizeData } from "./middlewares/sanitizer.js";

// Load .env before anything else
dotenv.config();

// ── Route files ───────────────────────────────────────────────────
import userRoutes from "./routes/user.routes.js";
import categoryRoutes from "./routes/category.routes.js";
import productRoutes from "./routes/product.routes.js"; // fixed: dot not comma
import settingsRoutes from "./routes/settings.routes.js";
import ordersRoutes from "./routes/orders.routes.js";
import paymentsRoutes from "./routes/payments.routes.js";
import reviewsRoutes from "./routes/reviews.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import wishlistRoutes from "./routes/wishlist.routes.js";

// ── App ───────────────────────────────────────────────────────────
const app = express();

// ── CORS ──────────────────────────────────────────────────────────
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type", 
    "Authorization", 
    "X-Requested-With",
    "X-CSRF-Token" // Added for CSRF protection layer
  ],
  credentials: true,
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));
// Handle OPTIONS preflight for all routes explicitly
app.options("*", cors(corsOptions));

// ── Core middleware ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"], // Allow essential inline scripts
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"], // Allow Cloudinary
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply basic rate limiting to all API routes
app.use("/api", apiLimiter);

// Custom CSRF Protection layer
app.use("/api", csrfCheck);

// Global Sanitization Middleware
app.use("/api", sanitizeData);

// ── Routes ────────────────────────────────────────────────────────
const router = express.Router();

// Users (auth + profile management)
// Canonical prefix: /api/users
router.use("/users", userRoutes);

// Categories
// Canonical prefix: /api/categories
router.use("/categories", categoryRoutes);

// Products
// Canonical prefix: /api/products
router.use("/products", productRoutes);

// Orders
// Canonical prefix: /api/orders
router.use("/orders", ordersRoutes);

// Payments
// Canonical prefix: /api/payments
router.use("/payments", paymentsRoutes);

// Settings
// Canonical prefix: /api/settings
router.use("/settings", settingsRoutes);

// Reviews
// Canonical prefix: /api/reviews
router.use("/reviews", reviewsRoutes);

// Messages (Contact Us)
// Canonical prefix: /api/messages
router.use("/messages", messagesRoutes);

// Coupons
// Canonical prefix: /api/coupons
router.use("/coupons", couponRoutes);

// Wishlist
// Canonical prefix: /api/wishlist
router.use("/wishlist", wishlistRoutes);

// Mount all API routes under /api
app.use("/api", router);

// ── 404 ───────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── Global error handler ──────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────
// Fixed to 5001 — bypasses the orphaned process still on port 5000.
const PORT = 5001;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

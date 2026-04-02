/**
 * @file security.js (middleware)
 * @description Rate limiting and CSRF protection middleware.
 *
 * Exports three rate limiters and one CSRF check:
 *
 *  - apiLimiter    — Generic rate limit applied to all /api routes
 *                    Set high (10,000/15min) to not throttle legitimate usage or Lighthouse audits
 *
 *  - authLimiter   — Stricter limit for authentication routes (login, register)
 *                    100 attempts per hour to prevent brute-force attacks
 *
 *  - uploadLimiter — Rate limit for file upload endpoints
 *                    100 uploads per hour to prevent abuse
 *
 *  - csrfCheck     — Custom CSRF protection using the "Origin + custom header" technique
 *                    Browsers block setting X-Requested-With cross-origin,
 *                    so its presence proves the request came from our SPA
 */

import rateLimit from "express-rate-limit";

// ── Generic API Rate Limiter ─────────────────────────────────────────
/**
 * Applied to all /api/* routes as a baseline protection.
 * High limit (10,000) to prevent throttling legitimate traffic or automated audits.
 *
 * When exceeded: Returns 429 Too Many Requests with JSON error body
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute sliding window
  max: 10000,                 // Max requests per window per IP
  standardHeaders: true,      // Expose RateLimit-* headers to clients (RFC 6585)
  legacyHeaders: false,       // Don't expose X-RateLimit-* (deprecated)
  message: {
    success: false,
    message: "Too many requests from this IP, please try again after 15 minutes",
  },
});

// ── Auth Route Rate Limiter ──────────────────────────────────────────
/**
 * Applied only to login and register routes.
 * Prevents brute-force credential attacks.
 *
 * Limit: 100 attempts per hour per IP.
 * NOTE: Set at 100 (higher than typical) to support testing in development.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1-hour window
  max: 100,                   // 100 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many authentication attempts, please try again after an hour",
  },
});

// ── File Upload Rate Limiter ─────────────────────────────────────────
/**
 * Applied to image upload endpoints.
 * Prevents abuse of Cloudinary storage by limiting upload frequency.
 *
 * Limit: 100 uploads per hour per IP.
 */
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1-hour window
  max: 100,                   // 100 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Upload limit reached, please try again after an hour",
  },
});

// ── Custom CSRF Protection ───────────────────────────────────────────
/**
 * Stateless CSRF protection using the "custom request header" technique.
 *
 * How it works:
 *  - The frontend (axios.js) always sends the header: X-Requested-With: XMLHttpRequest
 *  - Browsers enforce the Same-Origin Policy on custom headers:
 *    A malicious site's form or link CANNOT set X-Requested-With cross-origin
 *  - Therefore, presence of this header is a reliable signal that the request
 *    originated from our own JavaScript application, not a cross-site attack
 *
 * This check:
 *  - Only runs on write operations (POST, PUT, PATCH, DELETE)
 *  - Skips GET and OPTIONS requests (safe, idempotent methods)
 *  - Returns 403 if X-Requested-With is missing on write operations
 *
 * NOTE: This does NOT protect against XSS — if an attacker injects JS into our
 * pages, they can set any header. A real CSRF token is required for tighter security.
 *
 * @param {object}   req  - Express request
 * @param {object}   res  - Express response
 * @param {Function} next - Express next
 */
export const csrfCheck = (req, res, next) => {
  const writeMethods = ["POST", "PUT", "PATCH", "DELETE"];
  
  // Skip non-write methods (GET, HEAD, OPTIONS are safe by definition)
  if (!writeMethods.includes(req.method)) return next();
  
  // Check for the required custom header (set by axios.js on all API requests)
  if (!req.headers["x-requested-with"]) {
    return res.status(403).json({
      success: false,
      message: "Security violation: Missing standard request header (CSRF protection)",
    });
  }
  
  next();
};

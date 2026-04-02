/**
 * @file auth.js (middleware)
 * @description JWT authentication and role-based authorization middleware.
 *
 * This module exports several middleware functions that protect API routes:
 *
 *  - verifyToken        — Validates JWT from cookie or Authorization header
 *  - verifyAdmin        — Restricts access to admin role only
 *  - verifyOwner        — Restricts access to owner role only (super-user)
 *  - verifyAdminOrOwner — Allows either admin OR owner (most common guard)
 *  - verifySelfOrAdmin  — Allows the user to access their own resource, OR an admin/owner
 *
 * Role Hierarchy:
 *  user < admin < owner
 *
 * Token Lookup Strategy:
 *  1. HttpOnly Cookie (primary — most secure, set by loginUser)
 *  2. Authorization: Bearer <token> header (fallback for API clients / mobile)
 */

import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

// ── verifyToken ────────────────────────────────────────────────────
/**
 * Validates the JWT from either:
 *  1. The HttpOnly cookie "token" (primary — set by login)
 *  2. The Authorization: Bearer <token> header (fallback)
 *
 * On success: Attaches the decoded JWT payload as `req.user` and calls next().
 * On failure: Responds with 401 Unauthorized.
 */
export const verifyToken = (req, res, next) => {
  // --- Step 1: Try HttpOnly cookie first (most secure, no JS access) ---
  let token = req.cookies?.token;

  // --- Step 2: Fall back to Authorization header (e.g., for mobile clients) ---
  if (!token) {
    const header = req.headers.authorization;
    if (header && header.startsWith("Bearer ")) {
      token = header.split(" ")[1];
    }
  }

  // No token found in either location — deny access
  if (!token) {
    return res
      .status(401)
      .json({ status: false, message: "Authentication required: No token provided" });
  }

  // Verify the token signature and expiry against the JWT_SECRET
  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .json({ status: false, message: "Invalid or expired token" });
    }
    // Attach decoded payload (id, name, email, role, etc.) to request for downstream use
    req.user = decoded;
    next();
  });
};

// ── verifyAdmin ────────────────────────────────────────────────────
/**
 * Authorization guard: Allows ONLY users with role === "admin".
 *
 * NOTE: This middleware does NOT allow the "owner" role.
 * If you want to allow both admin and owner, use `verifyAdminOrOwner`.
 *
 * Must be used AFTER `verifyToken` in the middleware chain.
 */
export const verifyAdmin = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ status: false, message: "Not authenticated" });
  }
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ status: false, message: "Access denied: admin only" });
  }
  next();
};

// ── verifyOwner ────────────────────────────────────────────────────
/**
 * Authorization guard: Allows ONLY users with role === "owner".
 * The "owner" is the platform super-user and has the highest authority.
 *
 * Used for routes like: user management, seeing financial data, site settings.
 * Must be used AFTER `verifyToken`.
 */
export const verifyOwner = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ status: false, message: "Not authenticated" });
  }
  if (req.user.role !== "owner") {
    return res
      .status(403)
      .json({ status: false, message: "Access denied: owner only" });
  }
  next();
};

// ── verifyAdminOrOwner ─────────────────────────────────────────────
/**
 * Authorization guard: Allows users with role === "admin" OR role === "owner".
 * This is the most common guard used on management API endpoints.
 *
 * Use cases: Creating products, updating orders, viewing messages, etc.
 * Must be used AFTER `verifyToken`.
 */
export const verifyAdminOrOwner = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ status: false, message: "Not authenticated" });
  }
  if (req.user.role !== "admin" && req.user.role !== "owner") {
    return res
      .status(403)
      .json({ status: false, message: "Access denied: admin or owner only" });
  }
  next();
};

// ── verifySelfOrAdmin ──────────────────────────────────────────────
/**
 * Authorization guard: Allows access when EITHER:
 *   a) The authenticated user is accessing their OWN resource (req.user.id === req.params.id), OR
 *   b) The authenticated user is an admin or owner
 *
 * Use cases:
 *  - GET  /users/:id  — Users can see their own profile; admins can see any
 *  - PUT  /users/:id  — Users can update their own profile; admins can update any
 *
 * Must be used AFTER `verifyToken`.
 */
export const verifySelfOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res
      .status(401)
      .json({ status: false, message: "Not authenticated" });
  }
  // Compare as strings to avoid type issues (params are always strings, JWT id might be number)
  const isSelf = String(req.user.id) === String(req.params.id);
  const isPrivileged = req.user.role === "admin" || req.user.role === "owner";
  if (!isSelf && !isPrivileged) {
    return res
      .status(403)
      .json({
        status: false,
        message: "Access denied: you can only access your own resource",
      });
  }
  next();
};

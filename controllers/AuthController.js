/**
 * @file AuthController.js
 * @description Authentication controller: registration, login, and logout.
 *
 * This controller handles the core identity operations:
 *  - registerUser — Creates a new user account with hashed password
 *  - loginUser    — Validates credentials and issues an HttpOnly JWT cookie
 *  - logoutUser   — Clears the session cookie to terminate the session
 *
 * Security design decisions:
 *  - Passwords are hashed using bcrypt with 12 salt rounds (higher = slower to brute-force)
 *  - JWT token is stored in an HttpOnly cookie (inaccessible to JavaScript — prevents XSS theft)
 *  - Cookie is Secure in production (HTTPS only) and SameSite=none for cross-site API support
 *  - Both email and phone uniqueness are validated before inserting
 *  - Zod schema validation (registerSchema / loginSchema) runs BEFORE DB queries
 *  - Email is normalized before storage/lookup (lowercase, remove dots in Gmail, etc.)
 *
 * JWT Payload (stored in cookie and decoded as req.user by auth middleware):
 *   { id, name, email, phone, role, image }
 */

import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { registerSchema, loginSchema } from "../validators/user.schema.js";
import validator from "validator";

// ── Shared Cookie Options ─────────────────────────────────────────────────────
/**
 * Options applied to both login (set cookie) and logout (clear cookie).
 * - httpOnly: true → JavaScript cannot read this cookie (prevents XSS token theft)
 * - secure: true in production → only sent over HTTPS
 * - sameSite: 'none' in production → allows cross-site requests (needed when API ≠ frontend domain)
 * - maxAge: 7 days (matches JWT expiry)
 */
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
};

// ── registerUser ───────────────────────────────────────────────────────────────
/**
 * POST /api/users/register
 *
 * Creates a new user account. Steps:
 *  1. Validate request body with Zod schema (name, email, phone, password)
 *  2. Sanitize name and normalize email
 *  3. Check for duplicate email
 *  4. Check for duplicate phone number
 *  5. Hash the password (bcrypt, 12 rounds)
 *  6. Insert the new user into the database
 *  7. Return 201 success (NO auto-login — user must log in separately)
 *
 * @route  POST /api/users/register
 * @access Public
 */
export const registerUser = async (req, res, next) => {
  try {
    // ── Step 1: Validate input ───────────────────────────────────────────
    // Zod safeParse returns { success, data } or { success, error }
    const validation = registerSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    let { name, email, password, phone } = validation.data;

    // ── Step 2: Sanitize and normalize ───────────────────────────────────
    name = validator.escape(name.trim());       // Escape HTML entities in name
    email = validator.normalizeEmail(email.trim()); // Lowercase, handle Gmail aliases

    // ── Step 3: Check duplicate email ────────────────────────────────────
    const [emailRows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (emailRows.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // ── Step 4: Check duplicate phone ────────────────────────────────────
    const [phoneRows] = await db.query("SELECT id FROM users WHERE phone = ?", [phone]);
    if (phoneRows.length > 0) {
      return res.status(400).json({ success: false, message: "Phone number already exists" });
    }

    // ── Step 5: Hash password ─────────────────────────────────────────────
    // 12 salt rounds = ~250ms hash time, significantly harder to brute-force than 10
    const hashedPassword = await bcrypt.hash(password, 12);

    // ── Step 6: Insert user ───────────────────────────────────────────────
    const role = "user"; // All new registrations start with the "user" role
    // Use a default avatar if no profile image was uploaded (req.file is set by Multer)
    const image = req.file?.path || "https://res.cloudinary.com/ddqlt5oqu/image/upload/v1764967019/default_pi1ur8.webp";

    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, phone, role, image) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, hashedPassword, phone, role, image]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({ success: false, message: "Registration failed" });
    }

    // ── Step 7: Return success (no auto-login, user must login separately) ──
    return res.status(201).json({ success: true, message: "User registered successfully" });
  } catch (error) {
    next(error); // Pass to global error handler
  }
};

// ── loginUser ──────────────────────────────────────────────────────────────────
/**
 * POST /api/users/login
 *
 * Authenticates a user with email + password. Steps:
 *  1. Validate request body with Zod schema
 *  2. Normalize the email
 *  3. Fetch user by email from DB
 *  4. Compare the provided password against the stored bcrypt hash
 *  5. Build a safe user object (exclude password_hash)
 *  6. Sign a JWT (7-day expiry) and set it as an HttpOnly cookie
 *  7. Return the public user object to allow the frontend to update its state
 *
 * @route  POST /api/users/login
 * @access Public
 */
export const loginUser = async (req, res, next) => {
  try {
    // ── Step 1: Validate input ───────────────────────────────────────────
    const validation = loginSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { email, password } = validation.data;
    const sanitizedEmail = validator.normalizeEmail(email.trim());

    // ── Step 3: Fetch user record ─────────────────────────────────────────
    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [sanitizedEmail]);
    if (rows.length === 0) {
      // Return generic message to prevent email enumeration attacks
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = rows[0];

    // ── Step 4: Verify password ───────────────────────────────────────────
    // bcrypt.compare handles the timing-safe comparison internally
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    // ── Step 5: Build safe user object (NEVER include password_hash) ─────
    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      image: user.image,
    };

    // ── Step 6: Sign JWT and set HttpOnly cookie ──────────────────────────
    // JWT payload = publicUser (available as req.user after verifyToken middleware)
    const token = jwt.sign(publicUser, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // HttpOnly cookie — JS cannot read it, preventing XSS-based token theft
    res.cookie("token", token, cookieOptions);

    // ── Step 7: Return user data to frontend ──────────────────────────────
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: publicUser,
      // Note: Token is strictly in the HttpOnly cookie, NOT in response body
    });
  } catch (error) {
    next(error);
  }
};

// ── logoutUser ─────────────────────────────────────────────────────────────────
/**
 * POST /api/users/logout
 *
 * Terminates the user's session by clearing the JWT cookie.
 * Sets the cookie to empty string with maxAge=0 and expires=past date,
 * which instructs the browser to immediately delete it.
 *
 * @route  POST /api/users/logout
 * @access Protected (requires verifyToken)
 */
export const logoutUser = (req, res) => {
  // Overwrite the existing cookie with an empty value and immediate expiry
  res.cookie("token", "", { ...cookieOptions, maxAge: 0, expires: new Date(0) });
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};

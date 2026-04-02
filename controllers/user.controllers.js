/**
 * @file user.controllers.js
 * @description User management controller for CRUD operations on user accounts.
 *
 * Note: Registration and Login are handled separately in AuthController.js
 *
 * Endpoints provided:
 *  - getCurrentUser — GET /users/me         — Returns the logged-in user's profile
 *  - getAllUsers    — GET /users             — Admin: paginated + searchable user list
 *  - getUserById   — GET /users/:id         — Self or Admin: fetch a user by ID
 *  - updateUser    — PUT /users/:id         — Self or Admin: update user profile
 *  - deleteUser    — DELETE /users/:id      — Admin only: delete a user account
 *
 * Role-Based Update Logic (updateUser):
 *  - Regular users can only update their own: name, email, phone, password, image
 *  - Admins can update any user's role EXCEPT escalating to "owner"
 *  - Only the "owner" role can assign the "owner" role to another user
 */

import db from "../config/db.js";
import bcrypt from "bcryptjs";

// ── getCurrentUser ─────────────────────────────────────────────────────────────
/**
 * GET /api/users/me
 *
 * Returns the profile of the currently authenticated user.
 * The user's ID is extracted from the JWT payload (req.user.id),
 * so the user can only ever see their own profile via this endpoint.
 *
 * @route  GET /api/users/me
 * @access Protected — requires verifyToken
 */
const getCurrentUser = async (req, res, next) => {
  try {
    // Fetch fresh data from DB (not from JWT to ensure up-to-date info)
    const [rows] = await db.query(
      "SELECT id, name, email, phone, role, image FROM users WHERE id = ?",
      [req.user.id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// ── getAllUsers ────────────────────────────────────────────────────────────────
/**
 * GET /api/users
 *
 * Admin-only endpoint that returns a paginated list of all users.
 * Supports optional search by name or email.
 *
 * Query params:
 *  - page   {number} Page number (default: 1)
 *  - limit  {number} Items per page (default: 15)
 *  - search {string} Optional: filter by name or email (LIKE search)
 *
 * Returns: { data, pagination: { total, page, limit, pages } }
 *
 * @route  GET /api/users
 * @access Protected — requires verifyToken + verifyAdminOrOwner
 */
const getAllUsers = async (req, res, next) => {
  try {
    // Parse pagination parameters with sensible defaults
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    // Dynamically build WHERE clause only if search is provided
    let whereClause = "";
    let queryParams = [];

    if (search) {
      whereClause = "WHERE name LIKE ? OR email LIKE ?";
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    // Count total records for pagination metadata
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams,
    );

    // Fetch the paginated page of users (password_hash excluded intentionally)
    const [rows] = await db.query(
      `SELECT id, name, email, phone, role, image, created_at FROM users ${whereClause} ORDER BY id DESC LIMIT ? OFFSET ?`,
      [...queryParams, limit, offset],
    );

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── getUserById ────────────────────────────────────────────────────────────────
/**
 * GET /api/users/:id
 *
 * Fetches a single user by their database ID.
 * Protected by verifySelfOrAdmin — a user can only access their own ID,
 * unless they are an admin or owner.
 *
 * @route  GET /api/users/:id
 * @access Protected — requires verifyToken + verifySelfOrAdmin
 */
const getUserById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await db.query(
      "SELECT id, name, email, phone, role, image FROM users WHERE id = ?",
      [id],
    );
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user: rows[0],
    });
  } catch (error) {
    next(error);
  }
};

// ── updateUser ─────────────────────────────────────────────────────────────────
/**
 * PUT /api/users/:id
 *
 * Updates a user's profile. Supports partial updates (fields default to existing values).
 *
 * Fields accepted: name, username (alias for name), email, phone, password, role, image (file)
 *
 * Role Change Rules:
 *  - Regular users: CANNOT change role at all
 *  - Admin:         CAN change role to "user" or "admin", but NOT to "owner"
 *  - Owner:         CAN assign ANY role including "owner"
 *
 * Password Change:
 *  - If "password" is provided, it must be at least 8 characters
 *  - The new password is hashed with bcrypt (10 rounds)
 *  - If no password given, the existing hash is preserved
 *
 * Image Upload:
 *  - If a file upload (req.file) is present, it becomes the new avatar
 *  - Otherwise, the existing image URL is preserved
 *
 * @route  PUT /api/users/:id
 * @access Protected — requires verifyToken + verifySelfOrAdmin
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch current user record to use as defaults for any unspecified fields
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const currentUser = rows[0];

    // Accept both "name" and "username" from frontend for compatibility with different forms
    const { name, username, email, phone, password, role } = req.body || {};
    const finalName = name || username || currentUser.name;
    const finalEmail = email || currentUser.email;
    const finalPhone = phone || currentUser.phone;

    // ── Role Protection ──────────────────────────────────────────────────────
    let finalRole = currentUser.role; // Default: preserve existing role

    if (role && role !== currentUser.role) {
      const requesterRole = req.user?.role;
      if (requesterRole === "owner") {
        // Owner has full authority — can assign any role
        finalRole = role;
      } else if (requesterRole === "admin" && role !== "owner") {
        // Admin can change roles but cannot elevate anyone to "owner"
        finalRole = role;
      } else {
        // Regular user or admin trying to escalate to owner — deny
        return res.status(403).json({
          success: false,
          message: "You do not have permission to change user roles",
        });
      }
    }

    // ── Password Handling ────────────────────────────────────────────────────
    let finalPasswordHash = currentUser.password_hash;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }
      // Always hash before storing — never store plaintext passwords
      finalPasswordHash = await bcrypt.hash(password, 10);
    }

    // ── Image Handling ───────────────────────────────────────────────────────
    // If a file was uploaded (via Multer), use the Cloudinary URL (req.file.path)
    // Otherwise, keep the existing image URL
    const finalImage = req.file?.path || currentUser.image;

    // ── Perform the Update ───────────────────────────────────────────────────
    const [result] = await db.query(
      "UPDATE users SET name = ?, email = ?, phone = ?, role = ?, password_hash = ?, image = ? WHERE id = ?",
      [
        finalName,
        finalEmail,
        finalPhone,
        finalRole,
        finalPasswordHash,
        finalImage,
        id,
      ],
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({ success: false, message: "Update failed" });
    }

    // Build and return the updated user object (without password_hash)
    const updatedUser = {
      id: Number(id),
      name: finalName,
      email: finalEmail,
      phone: finalPhone,
      role: finalRole,
      image: finalImage,
    };

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// ── deleteUser ─────────────────────────────────────────────────────────────────
/**
 * DELETE /api/users/:id
 *
 * Permanently deletes a user account.
 * Note: Any orders, reviews, or wishlist items referencing this user
 * are handled by the database's ON DELETE SET NULL / CASCADE constraints.
 *
 * @route  DELETE /api/users/:id
 * @access Protected — requires verifyToken + verifyAdminOrOwner
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Verify the user exists before attempting deletion
    const [rows] = await db.query("SELECT id FROM users WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const [result] = await db.query("DELETE FROM users WHERE id = ?", [id]);
    if (result.affectedRows === 0) {
      return res.status(500).json({ success: false, message: "Delete failed" });
    }

    return res
      .status(200)
      .json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    next(error);
  }
};

// ── Named exports ──────────────────────────────────────────────────────────────
export {
  getCurrentUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};

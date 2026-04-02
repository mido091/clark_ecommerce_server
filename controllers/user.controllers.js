import db from "../config/db.js";
import bcrypt from "bcryptjs";

// Public registration and login are handled in AuthController.js

const getCurrentUser = async (req, res, next) => {
  try {
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

// ── getAllUsers ────────────────────────────────────────────────────
// Protected: admin or owner only (enforced at route level)
const getAllUsers = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 15;
    const offset = (page - 1) * limit;
    const search = req.query.search || "";

    let whereClause = "";
    let queryParams = [];

    if (search) {
      whereClause = "WHERE name LIKE ? OR email LIKE ?";
      queryParams.push(`%${search}%`, `%${search}%`);
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      queryParams,
    );

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

// ── getUserById ────────────────────────────────────────────────────
// Protected: self or admin/owner (enforced at route level)
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

// ── updateUser ─────────────────────────────────────────────────────
// Protected: self or admin/owner (enforced at route level).
// - Regular users CAN update their own name, email, phone, password, image.
// - Regular users CANNOT change their role.
// - Admin/Owner CAN change roles (but admin cannot escalate to owner).
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Fetch current user record
    const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    const currentUser = rows[0];

    // Accept both "name" and "username" from frontend for compatibility
    const { name, username, email, phone, password, role } = req.body || {};
    const finalName = name || username || currentUser.name;
    const finalEmail = email || currentUser.email;
    const finalPhone = phone || currentUser.phone;

    // ── Role protection ──────────────────────────────────────────
    let finalRole = currentUser.role; // default: keep existing role
    if (role && role !== currentUser.role) {
      const requesterRole = req.user?.role;
      if (requesterRole === "owner") {
        // Owner can assign any role
        finalRole = role;
      } else if (requesterRole === "admin" && role !== "owner") {
        // Admin can change role only if not escalating to owner
        finalRole = role;
      } else {
        // Regular user or admin trying to set owner — silently ignore role change
        // (return error so it's visible to the caller)
        return res.status(403).json({
          success: false,
          message: "You do not have permission to change user roles",
        });
      }
    }

    // ── Password handling ────────────────────────────────────────
    let finalPasswordHash = currentUser.password_hash;
    if (password) {
      if (password.length < 8) {
        return res.status(400).json({
          success: false,
          message: "Password must be at least 8 characters",
        });
      }
      // Always hash — never store plaintext
      finalPasswordHash = await bcrypt.hash(password, 10);
    }

    // ── Image handling ───────────────────────────────────────────
    const finalImage = req.file?.path || currentUser.image;

    // ── Perform update ───────────────────────────────────────────
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

    // Return updated public user object (no password_hash)
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

// ── deleteUser ─────────────────────────────────────────────────────
// Protected: admin or owner only (enforced at route level)
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
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

// export
export {
  getCurrentUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};

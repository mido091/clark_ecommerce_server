import db from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { registerSchema, loginSchema } from "../validators/user.schema.js";
import validator from "validator";

// ── Cookie Options ────────────────────────────────────────────────
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// ── registerUser ───────────────────────────────────────────────────
export const registerUser = async (req, res, next) => {
  try {
    const validation = registerSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    let { name, email, password, phone } = validation.data;

    // Sanitize inputs
    name = validator.escape(name.trim());
    email = validator.normalizeEmail(email.trim());

    // Check for duplicate email
    const [emailRows] = await db.query("SELECT id FROM users WHERE email = ?", [email]);
    if (emailRows.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // Check for duplicate phone
    const [phoneRows] = await db.query("SELECT id FROM users WHERE phone = ?", [phone]);
    if (phoneRows.length > 0) {
      return res.status(400).json({ success: false, message: "Phone number already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 12); // Increased salt rounds for security

    const role = "user";
    const image = req.file?.path || "https://res.cloudinary.com/ddqlt5oqu/image/upload/v1764967019/default_pi1ur8.webp";

    const [result] = await db.query(
      "INSERT INTO users (name, email, password_hash, phone, role, image) VALUES (?, ?, ?, ?, ?, ?)",
      [name, email, hashedPassword, phone, role, image]
    );

    if (result.affectedRows === 0) {
      return res.status(500).json({ success: false, message: "Registration failed" });
    }

    return res.status(201).json({ success: true, message: "User registered successfully" });
  } catch (error) {
    next(error);
  }
};

// ── loginUser ──────────────────────────────────────────────────────
export const loginUser = async (req, res, next) => {
  try {
    const validation = loginSchema.safeParse(req.body || {});
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: validation.error.issues[0].message,
      });
    }

    const { email, password } = validation.data;
    const sanitizedEmail = validator.normalizeEmail(email.trim());

    const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [sanitizedEmail]);
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const user = rows[0];
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const publicUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      image: user.image,
    };

    const token = jwt.sign(publicUser, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Set JWT as HttpOnly cookie
    res.cookie("token", token, cookieOptions);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: publicUser,
      // Token is now strictly in HttpOnly cookie
    });
  } catch (error) {
    next(error);
  }
};

// ── logoutUser ─────────────────────────────────────────────────────
export const logoutUser = (req, res) => {
  res.cookie("token", "", { ...cookieOptions, maxAge: 0, expires: new Date(0) });
  return res.status(200).json({ success: true, message: "Logged out successfully" });
};

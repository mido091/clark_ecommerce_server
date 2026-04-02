import { Router } from "express";
import upload from "../middlewares/upload.js";
import {
  verifyToken,
  verifyAdminOrOwner,
  verifySelfOrAdmin,
} from "../middlewares/auth.js";
import {
  registerUser,
  loginUser,
  logoutUser,
} from "../controllers/AuthController.js";
import {
  getCurrentUser,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from "../controllers/user.controllers.js";
import { authLimiter } from "../middlewares/security.js";

const router = Router();

// ── Public ─────────────────────────────────────────────────────────
// Registration accepts an optional profile image
router.post("/register", authLimiter, upload.single("image"), registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/logout", logoutUser);
router.get("/me", verifyToken, getCurrentUser);

// ── Protected: self or admin/owner ─────────────────────────────────
// GET  /users/:id  — user can fetch their own profile; admins can fetch any
router.get("/:id", verifyToken, verifySelfOrAdmin, getUserById);

// PATCH /users/:id — user can update their own profile; admins can update any
router.patch(
  "/:id",
  verifyToken,
  verifySelfOrAdmin,
  upload.single("image"),
  updateUser,
);

// PUT   /users/:id — alias for PATCH (frontend ProfilePage.vue uses PUT)
router.put(
  "/:id",
  verifyToken,
  verifySelfOrAdmin,
  upload.single("image"),
  updateUser,
);

// ── Protected: admin or owner only ─────────────────────────────────
// GET  /users/    — list all users
router.get("/", verifyToken, verifyAdminOrOwner, getAllUsers);

// DELETE /users/:id — remove a user account
router.delete("/:id", verifyToken, verifyAdminOrOwner, deleteUser);

export default router;

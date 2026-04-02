import { Router } from "express";
import upload from "../middlewares/upload.js";
import { verifyToken, verifyAdminOrOwner } from "../middlewares/auth.js";
import {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
} from "../controllers/product.controllers.js";

const router = Router();

// ── Public ─────────────────────────────────────────────────────────
router.get("/", getAllProducts);
router.get("/:id", getProductById);

// ── Protected: admin or owner only ─────────────────────────────────
router.post(
  "/",
  verifyToken,
  verifyAdminOrOwner,
  upload.any(),
  createProduct,
);
router.patch(
  "/:id",
  verifyToken,
  verifyAdminOrOwner,
  upload.any(),
  updateProduct,
);
router.put(
  "/:id",
  verifyToken,
  verifyAdminOrOwner,
  upload.any(),
  updateProduct,
);
router.delete("/:id", verifyToken, verifyAdminOrOwner, deleteProduct);

export default router;

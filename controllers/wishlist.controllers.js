/**
 * @file wishlist.controllers.js
 * @description User wishlist management controller.
 *
 * The wishlist allows authenticated users to save products for later.
 * Each user has their own private wishlist stored in the `wishlist` table.
 *
 * Database schema:
 *  wishlist: { user_id (FK), product_id (FK), created_at }
 *  UNIQUE constraint on (user_id, product_id) — prevents duplicates
 *
 * Design notes:
 *  - addToWishlist uses INSERT IGNORE to silently skip duplicate inserts
 *    (avoids error when frontend calls add without checking first)
 *  - getWishlistIds provides a lightweight endpoint for the frontend
 *    to populate the "is saved" heart icon state without fetching full product data
 *
 * Endpoints:
 *  - addToWishlist       — POST   /wishlist          — Add a product to wishlist
 *  - getWishlist         — GET    /wishlist          — Full wishlist with product details
 *  - removeFromWishlist  — DELETE /wishlist/:productId — Remove a product
 *  - getWishlistIds      — GET    /wishlist/ids      — Lightweight: just the product IDs
 */

import db from "../config/db.js";

// ── addToWishlist ──────────────────────────────────────────────────────────────
/**
 * POST /api/wishlist
 *
 * Adds a product to the authenticated user's wishlist.
 * Uses INSERT IGNORE to gracefully handle duplicate additions without throwing an error.
 *
 * Body: { product_id }
 *
 * @route  POST /api/wishlist
 * @access Protected — Authenticated users only
 */
export const addToWishlist = async (req, res, next) => {
  try {
    const { product_id } = req.body;
    const user_id = req.user.id; // From JWT payload (set by verifyToken)

    if (!product_id) {
      return res.status(400).json({ success: false, message: "Product ID is required" });
    }

    // INSERT IGNORE: If a row with the same (user_id, product_id) already exists,
    // MySQL silently ignores the insert instead of throwing a UNIQUE constraint error
    await db.query(
      "INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)",
      [user_id, product_id]
    );

    return res.status(201).json({
      success: true,
      message: "Added to wishlist",
    });
  } catch (error) {
    next(error);
  }
};

// ── getWishlist ────────────────────────────────────────────────────────────────
/**
 * GET /api/wishlist
 *
 * Returns the full wishlist for the authenticated user, with complete product
 * details including the main product image and category names (bilingual).
 *
 * Products are ordered by when they were added (most recent first).
 *
 * @route  GET /api/wishlist
 * @access Protected — Authenticated users only
 */
export const getWishlist = async (req, res, next) => {
  try {
    const user_id = req.user.id;

    const [rows] = await db.query(
      `SELECT p.*, 
              (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id LIMIT 1) as main_image,
              c.name as category_name, c.name_ar as category_name_ar
       FROM wishlist w
       JOIN products p ON w.product_id = p.id
       JOIN categories c ON p.category_id = c.id
       WHERE w.user_id = ?
       ORDER BY w.created_at DESC`,
      [user_id]
    );

    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// ── removeFromWishlist ─────────────────────────────────────────────────────────
/**
 * DELETE /api/wishlist/:productId
 *
 * Removes a specific product from the authenticated user's wishlist.
 * Both user_id AND product_id are required in the WHERE clause to ensure
 * users can only remove items from their own wishlist.
 *
 * @route  DELETE /api/wishlist/:productId
 * @access Protected — Authenticated users only
 */
export const removeFromWishlist = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const user_id = req.user.id;

    await db.query(
      "DELETE FROM wishlist WHERE user_id = ? AND product_id = ?",
      [user_id, productId]
    );

    return res.status(200).json({
      success: true,
      message: "Removed from wishlist",
    });
  } catch (error) {
    next(error);
  }
};

// ── getWishlistIds ─────────────────────────────────────────────────────────────
/**
 * GET /api/wishlist/ids
 *
 * Returns only the product IDs in the user's wishlist (NO product data).
 * This is a lightweight endpoint used by the frontend wishlist store to
 * initialize the "is saved" state for heart icons on product cards without
 * fetching full product details.
 *
 * Called once on app mount (or user login) to populate the wishlistIds array
 * in the Pinia wishlist store.
 *
 * @route  GET /api/wishlist/ids
 * @access Protected — Authenticated users only
 */
export const getWishlistIds = async (req, res, next) => {
  try {
    const user_id = req.user.id;
    const [rows] = await db.query(
      "SELECT product_id FROM wishlist WHERE user_id = ?",
      [user_id]
    );
    return res.status(200).json({
      success: true,
      ids: rows.map(r => r.product_id) // Return only the IDs array
    });
  } catch (error) {
    next(error);
  }
};

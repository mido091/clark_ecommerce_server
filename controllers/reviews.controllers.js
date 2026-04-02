/**
 * @file reviews.controllers.js
 * @description Product reviews management controller.
 *
 * Reviews are tied to "verified purchases" — users can only review products
 * they have actually bought and received (or whose payment was verified).
 *
 * Review policies:
 *  - Only one review per user per product (enforced via UNIQUE DB constraint)
 *  - Reviews are instantly approved (is_approved = TRUE) by default
 *  - Admins can toggle visibility (approve/hide) without deleting
 *  - Rating must be an integer between 1 and 5
 *
 * Verified Purchase Check:
 *  User must have an order_item for the product where either:
 *    - payment_status = 'paid', OR
 *    - order status is one of: verified, out_for_delivery, shipped, delivered
 *
 * Endpoints:
 *  - createReview       — POST   /reviews                  — Authenticated user: submit review
 *  - getProductReviews  — GET    /reviews/product/:id      — Public: get approved reviews
 *  - getAllReviews       — GET    /reviews/admin            — Admin: manage all reviews
 *  - toggleVisibility   — PATCH  /reviews/:id/toggle       — Admin: toggle approved status
 *  - deleteReview       — DELETE /reviews/:id              — Admin: permanently delete
 */

import db from "../config/db.js";

// ── createReview ───────────────────────────────────────────────────────────────
/**
 * POST /api/reviews
 *
 * Submits a new product review with verified purchase enforcement.
 *
 * Steps:
 *  1. Validate rating range (1-5) and product_id
 *  2. Check the product exists
 *  3. Check the user has a verified purchase for this product
 *  4. Insert the review (auto-approved)
 *  5. Handle duplicate review attempts (ER_DUP_ENTRY)
 *
 * Body: { product_id, rating, comment? }
 *
 * @route  POST /api/reviews
 * @access Protected — Authenticated user (with verified purchase)
 */
export const createReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id, rating, comment } = req.body;

    // Validate required fields and rating bounds
    if (!product_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Product ID and rating (1-5) are required.",
      });
    }

    // Verify the target product exists in the database
    const [[product]] = await db.query("SELECT id FROM products WHERE id = ?", [
      product_id,
    ]);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    // ── Verified Purchase Check ────────────────────────────────────────────
    // The user must have an order item for this product where the order
    // has been paid or is in an advanced fulfilment stage
    const [[purchase]] = await db.query(
      `SELECT oi.id 
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.user_id = ? 
         AND oi.product_id = ?
         AND (
           o.payment_status = 'paid'
           OR o.status IN ('verified', 'out_for_delivery', 'shipped', 'delivered')
         )
       LIMIT 1`,
      [userId, product_id],
    );

    if (!purchase) {
      return res.status(403).json({
        success: false,
        message:
          "You can only review products you have purchased and received or verified.",
      });
    }

    // Insert review — auto-approved since only verified buyers can review
    const [result] = await db.query(
      "INSERT INTO reviews (user_id, product_id, rating, comment, is_approved) VALUES (?, ?, ?, ?, TRUE)",
      [userId, product_id, rating, comment || null],
    );

    res.status(201).json({
      success: true,
      data: {
        id: result.insertId,
        user_id: userId,
        product_id,
        rating,
        comment,
        is_approved: 1,
        created_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    // ER_DUP_ENTRY: MySQL UNIQUE constraint prevents duplicate reviews per user/product pair
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product.",
      });
    }
    next(error);
  }
};

// ── getProductReviews ──────────────────────────────────────────────────────────
/**
 * GET /api/reviews/product/:id
 *
 * Public endpoint that returns all APPROVED reviews for a specific product.
 * Also calculates and returns:
 *  - avg_rating   — Average rating across all approved reviews (1 decimal place)
 *  - total        — Total count of approved reviews
 *  - distribution — Breakdown of reviews by star count {5: N, 4: N, 3: N, 2: N, 1: N}
 *
 * @route  GET /api/reviews/product/:id
 * @access Public
 */
export const getProductReviews = async (req, res, next) => {
  try {
    const productId = req.params.id;

    // Fetch all approved reviews with reviewer's name and avatar
    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.name as user_name, u.image as user_avatar
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ? AND r.is_approved = TRUE
       ORDER BY r.created_at DESC`,
      [productId],
    );

    // ── Calculate rating distribution in JavaScript (avoids an extra SQL query) ──
    const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let totalRating = 0;
    for (const r of reviews) {
      distribution[r.rating] = (distribution[r.rating] || 0) + 1;
      totalRating += r.rating;
    }

    res.status(200).json({
      success: true,
      data: {
        reviews,
        total: reviews.length,
        // Round to 1 decimal place (e.g., 4.3 stars)
        avg_rating:
          reviews.length > 0 ? +(totalRating / reviews.length).toFixed(1) : 0,
        distribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── getAllReviews ──────────────────────────────────────────────────────────────
/**
 * GET /api/reviews/admin
 *
 * Admin endpoint to view and manage all reviews (approved + unapproved).
 * Supports filtering by approval status.
 *
 * Query params:
 *  - page    {number} Page number (default: 1)
 *  - limit   {number} Items per page (default: 20)
 *  - status  {string} Filter: "pending" | "approved" | (omit for all)
 *
 * Returns reviews joined with user name/email and product names.
 *
 * @route  GET /api/reviews/admin
 * @access Protected — Admin or Owner only
 */
export const getAllReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const filter = req.query.status; // 'pending' | 'approved' | undefined (all)

    // Build WHERE clause based on optional filter
    let whereSql = "1=1"; // Always-true base to allow dynamic AND appending
    const params = [];
    if (filter === "pending") {
      whereSql += " AND r.is_approved = FALSE";
    } else if (filter === "approved") {
      whereSql += " AND r.is_approved = TRUE";
    }

    // Count total matching reviews for pagination
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM reviews r WHERE ${whereSql}`,
      params,
    );

    // Fetch paginated reviews with joined user and product info
    const [reviews] = await db.query(
      `SELECT r.*, u.name as user_name, u.email as user_email,
              p.name as product_name, p.name_ar as product_name_ar
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       LEFT JOIN products p ON r.product_id = p.id
       WHERE ${whereSql}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );

    res.status(200).json({
      success: true,
      data: reviews,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ── toggleVisibility ───────────────────────────────────────────────────────────
/**
 * PATCH /api/reviews/:id/toggle
 *
 * Flips the is_approved flag of a review (approved ↔ hidden).
 * Approved reviews are visible to the public; hidden ones are not.
 * Returns the new approval state after the update.
 *
 * @route  PATCH /api/reviews/:id/toggle
 * @access Protected — Admin or Owner only
 */
export const toggleVisibility = async (req, res, next) => {
  try {
    // Use MySQL's NOT operator to flip the boolean in a single query
    const [result] = await db.query(
      "UPDATE reviews SET is_approved = NOT is_approved WHERE id = ?",
      [req.params.id],
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }

    // Fetch the updated value to return the new state to the frontend
    const [[updated]] = await db.query(
      "SELECT is_approved FROM reviews WHERE id = ?",
      [req.params.id],
    );
    res.status(200).json({
      success: true,
      message: "Visibility updated.",
      is_approved: updated.is_approved,
    });
  } catch (error) {
    next(error);
  }
};

// ── deleteReview ───────────────────────────────────────────────────────────────
/**
 * DELETE /api/reviews/:id
 *
 * Permanently deletes a review. This is irreversible.
 * For a softer approach, use toggleVisibility to hide instead.
 *
 * @route  DELETE /api/reviews/:id
 * @access Protected — Admin or Owner only
 */
export const deleteReview = async (req, res, next) => {
  try {
    const [result] = await db.query("DELETE FROM reviews WHERE id = ?", [
      req.params.id,
    ]);
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }
    res.status(200).json({ success: true, message: "Review deleted." });
  } catch (error) {
    next(error);
  }
};

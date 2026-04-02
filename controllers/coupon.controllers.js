/**
 * @file coupon.controllers.js
 * @description Coupon management controller for discount codes.
 *
 * This module manages promotional discount coupons for the store.
 *
 * Coupon Types:
 *  - "percentage" — Discount as a percentage of order subtotal (e.g., 10%)
 *  - "fixed"      — Flat discount amount subtracted from subtotal (e.g., 50 EGP)
 *
 * Validation Rules (validateCoupon):
 *  1. Coupon code must exist and be active (is_active = 1)
 *  2. Must not be expired (expiry_date < current date)
 *  3. Must not have exceeded its usage limit (used_count >= max_uses)
 *  4. Order subtotal must meet the minimum order amount threshold
 *
 * NOTE: The actual used_count increment happens in orders.controllers.js
 * during order creation (within the same transaction) to ensure atomicity.
 *
 * Endpoints:
 *  - getAllCoupons   — GET    /coupons          — Admin: list all coupons
 *  - createCoupon   — POST   /coupons          — Admin: create a new coupon
 *  - updateCoupon   — PATCH  /coupons/:id      — Admin: update coupon fields
 *  - deleteCoupon   — DELETE /coupons/:id      — Admin: delete a coupon
 *  - validateCoupon — POST   /coupons/validate — Public: validate + calculate discount
 */

import db from "../config/db.js";

// ── getAllCoupons ──────────────────────────────────────────────────────────────
/**
 * GET /api/coupons
 * Admin/Owner only — returns all coupons ordered by creation date (newest first).
 *
 * @route  GET /api/coupons
 * @access Protected — Admin or Owner only
 */
export const getAllCoupons = async (req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM coupons ORDER BY created_at DESC");
    res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// ── createCoupon ───────────────────────────────────────────────────────────────
/**
 * POST /api/coupons
 * Creates a new coupon. The code is stored in UPPERCASE for case-insensitive matching.
 *
 * Required body fields: { code, discount_type, discount_value }
 * Optional fields: { min_order_amount, expiry_date, max_uses }
 *
 * Returns the new coupon's ID on success.
 * Returns 400 if a coupon with the same code already exists (ER_DUP_ENTRY).
 *
 * @route  POST /api/coupons
 * @access Protected — Admin or Owner only
 */
export const createCoupon = async (req, res, next) => {
  try {
    const {
      code,
      discount_type,
      discount_value,
      min_order_amount,
      expiry_date,
      max_uses,
    } = req.body;

    // Validate required fields
    if (!code || !discount_type || !discount_value) {
      return res.status(400).json({ success: false, message: "Required fields missing" });
    }

    const [result] = await db.query(
      "INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, expiry_date, max_uses) VALUES (?, ?, ?, ?, ?, ?)",
      [
        code.toUpperCase(),           // Normalize code to uppercase for consistent matching
        discount_type,
        discount_value,
        min_order_amount || 0,        // Default: no minimum order amount
        expiry_date || null,          // Default: no expiry date
        max_uses || null              // Default: unlimited uses
      ]
    );

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      id: result.insertId,
    });
  } catch (error) {
    // ER_DUP_ENTRY: MySQL throws this when the UNIQUE constraint on 'code' is violated
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: "Coupon code already exists" });
    }
    next(error);
  }
};

// ── updateCoupon ───────────────────────────────────────────────────────────────
/**
 * PATCH /api/coupons/:id
 * Dynamically updates any fields of a coupon.
 * Only the fields included in the request body are updated.
 *
 * Uses a dynamic SET clause built from request body keys to support partial updates.
 * WARNING: No field whitelist here — any DB column name can be targeted.
 * The route should be protected by admin/owner authorization.
 *
 * @route  PATCH /api/coupons/:id
 * @access Protected — Admin or Owner only
 */
export const updateCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = req.body;
    
    // Reject empty update requests
    if (Object.keys(fields).length === 0) {
       return res.status(400).json({ success: false, message: "No fields to update" });
    }

    // Build SET clause dynamically: { code: 'SAVE10', is_active: 1 } → "code = ?, is_active = ?"
    const sets = Object.keys(fields).map(key => `${key} = ?`).join(", ");
    const values = Object.values(fields);

    await db.query(`UPDATE coupons SET ${sets} WHERE id = ?`, [...values, id]);

    res.status(200).json({
      success: true,
      message: "Coupon updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ── deleteCoupon ───────────────────────────────────────────────────────────────
/**
 * DELETE /api/coupons/:id
 * Permanently deletes a coupon.
 * NOTE: This does not affect any past orders that used this coupon.
 * The coupon_code field in orders is stored as a string copy.
 *
 * @route  DELETE /api/coupons/:id
 * @access Protected — Admin or Owner only
 */
export const deleteCoupon = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM coupons WHERE id = ?", [id]);
    res.status(200).json({
      success: true,
      message: "Coupon deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ── validateCoupon ─────────────────────────────────────────────────────────────
/**
 * POST /api/coupons/validate
 * Public endpoint used by the checkout page to validate a coupon code.
 *
 * Checks:
 *  1. Code exists and is active
 *  2. Not expired (expiry_date)
 *  3. Usage limit not reached (max_uses vs used_count)
 *  4. Subtotal meets minimum order amount (min_order_amount)
 *
 * Calculates and returns:
 *  - discount_type    — "percentage" or "fixed"
 *  - discount_value   — The configured discount value
 *  - discount_amount  — The actual calculated discount for this specific subtotal
 *
 * NOTE: This endpoint does NOT increment used_count.
 * The count is incremented atomically inside createOrder (orders.controllers.js).
 *
 * @route  POST /api/coupons/validate
 * @access Public
 */
export const validateCoupon = async (req, res, next) => {
  try {
    const { code, subtotal } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, message: "Coupon code is required" });
    }

    // Look up the coupon by code (case-insensitive via UPPERCASE normalization)
    const [rows] = await db.query(
      "SELECT * FROM coupons WHERE code = ? AND is_active = 1",
      [code.toUpperCase()]
    );
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Invalid or inactive coupon code" });
    }

    const coupon = rows[0];

    // Check if coupon has expired
    if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) {
      return res.status(400).json({ success: false, message: "Coupon has expired" });
    }

    // Check if usage limit has been reached
    if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
      return res.status(400).json({ success: false, message: "Coupon usage limit reached" });
    }

    // Check if subtotal meets the minimum order amount requirement
    if (subtotal < coupon.min_order_amount) {
      return res.status(400).json({ 
        success: false, 
        message: `Minimum order amount of ${coupon.min_order_amount} required to use this coupon` 
      });
    }

    // Calculate the actual discount amount based on coupon type
    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      // Percentage: e.g., 10% of 500 EGP = 50 EGP
      discount = (subtotal * coupon.discount_value) / 100;
    } else {
      // Fixed: e.g., 50 EGP off (capped at subtotal so discount can't exceed order total)
      discount = Math.min(coupon.discount_value, subtotal);
    }

    res.status(200).json({
      success: true,
      message: "Coupon applied successfully",
      data: {
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: discount,  // Actual money saved for THIS specific order
      }
    });
  } catch (error) {
    next(error);
  }
};

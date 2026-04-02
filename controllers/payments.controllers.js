/**
 * @file payments.controllers.js
 * @description Payment verification controller for manual payment methods.
 *
 * The store uses manual payment flows (no real-time payment gateway):
 *   1. Customer places order and submits a receipt screenshot
 *   2. Admin reviews the receipt and either marks it as "paid" or "rejected"
 *
 * Payment Methods:
 *  - "cod"       — Cash on Delivery: no upfront payment needed, payment_status = "unpaid"
 *  - "wallet"    — Electronic wallet (Vodafone Cash, etc.): requires receipt screenshot
 *  - "instapay"  — InstaPay transfer: requires receipt screenshot
 *
 * Payment Status Flow:
 *  pending_verification → paid       (admin accepts)
 *  pending_verification → rejected   (admin rejects, order is cancelled, stock restored)
 *
 * Stock atomicity:
 *  When a payment is rejected, stock is restored via restoreOrderItemStock()
 *  inside the same DB transaction to prevent inconsistencies.
 *
 * Endpoints:
 *  - getPendingPayments — GET  /payments/admin/pending — Admin: payments awaiting review
 *  - uploadProof        — POST /payments/proof         — User: upload receipt for COD upgrade
 *  - verifyPayment      — PUT  /payments/:id/verify    — Admin: accept or reject payment
 */

import db from "../config/db.js";
import { restoreOrderItemStock } from "../utils/variantStock.js";

// ── getPendingPayments ─────────────────────────────────────────────────────────
/**
 * GET /api/payments/admin/pending
 *
 * Returns a paginated list of orders that require payment verification.
 * These are orders with payment_status = 'pending' or 'pending_verification'.
 *
 * Query params:
 *  - page  {number} Page number (default: 1)
 *  - limit {number} Items per page (default: 10)
 *
 * @route  GET /api/payments/admin/pending
 * @access Protected — Admin or Owner only
 */
export const getPendingPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Match both initial pending state and after-receipt pending verification
    const statusCondition =
      "payment_status IN ('pending', 'pending_verification')";

    // Count total pending payments for pagination
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM orders WHERE ${statusCondition}`,
    );

    // Fetch paginated pending payments with user info joined
    const query = `
      SELECT o.id, o.status, o.payment_status, o.total_price, o.created_at,
             o.transaction_id, o.payment_receipt_url,
             u.name, u.email
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      WHERE ${statusCondition}
      ORDER BY o.created_at DESC
      LIMIT ? OFFSET ?
    `;
    const [payments] = await db.query(query, [limit, offset]);

    res.status(200).json({
      success: true,
      message: "Pending payments retrieved successfully",
      data: payments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── uploadProof ────────────────────────────────────────────────────────────────
/**
 * POST /api/payments/proof
 *
 * Allows a user to upload a payment receipt for an existing COD order.
 * This upgrades the order from "unpaid" to "pending_verification".
 *
 * Required body: { order_id, amount, reference? }
 * Required file: receipt screenshot (processed by Multer → Cloudinary)
 *
 * Validation:
 *  - Order must belong to the authenticated user (prevents accessing others' orders)
 *  - Order must be in "unpaid" state (can't re-upload for already verified orders)
 *
 * @route  POST /api/payments/proof
 * @access Protected — Authenticated users only
 */
export const uploadProof = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { order_id, amount, reference } = req.body;
    const screenshotUrl = req.file?.path; // Cloudinary URL set by Multer

    if (!order_id || !amount || !screenshotUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Verify the order belongs to this user and is still unpaid
    // (prevents users from submitting proof for other users' orders)
    const [[order]] = await db.query(
      "SELECT id FROM orders WHERE id = ? AND user_id = ? AND payment_status = 'unpaid'",
      [order_id, userId],
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found or already verified",
      });
    }

    // Update order with receipt URL and set status to pending_verification
    await db.query(
      "UPDATE orders SET payment_status = 'pending_verification', payment_receipt_url = ?, transaction_id = ? WHERE id = ?",
      [screenshotUrl, reference || null, order_id],
    );

    res
      .status(200)
      .json({ success: true, message: "Payment proof uploaded successfully" });
  } catch (error) {
    next(error);
  }
};

// ── verifyPayment ──────────────────────────────────────────────────────────────
/**
 * PUT /api/payments/:id/verify
 *
 * Admin action to confirm or reject a payment after reviewing the receipt.
 * Uses a DB transaction to ensure atomicity between payment status update and stock changes.
 *
 * Accepted status values:
 *  - "paid"     — Payment confirmed: order advances to "confirmed" status
 *  - "rejected" — Payment rejected: order is cancelled and inventory is restored
 *
 * When "rejected":
 *  1. Order status → "cancelled", payment_status → "rejected"
 *  2. If stock was previously reserved (inventory_reserved = 1),
 *     restoreOrderItemStock() adds the quantities back to product/variant stock
 *  3. inventory_reserved is set to 0 to prevent double-restoration
 *
 * Body: { status: "paid" | "rejected", rejection_reason? }
 *
 * @route  PUT /api/payments/:id/verify
 * @access Protected — Admin or Owner only
 */
export const verifyPayment = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const orderId = req.params.id;
    const { status, rejection_reason } = req.body;

    // Only "paid" and "rejected" are valid actions for this endpoint
    if (!["paid", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    // Begin transaction — payment status update + stock restore must be atomic
    await connection.beginTransaction();

    // Lock the order row to prevent race conditions with concurrent requests
    const [[existingOrder]] = await connection.query(
      "SELECT status, payment_status, inventory_reserved FROM orders WHERE id = ? FOR UPDATE",
      [orderId],
    );

    if (!existingOrder) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (status === "paid") {
      // Payment accepted: mark as paid and advance order to "confirmed" stage
      await connection.query(
        "UPDATE orders SET payment_status = 'paid', status = 'confirmed', rejection_reason = NULL WHERE id = ?",
        [orderId],
      );
    } else if (status === "rejected") {
      const hasReservedInventory = Boolean(
        Number(existingOrder.inventory_reserved || 0),
      );

      // Step 1: Cancel the order and mark payment as rejected
      await connection.query(
        "UPDATE orders SET payment_status = 'rejected', status = 'cancelled', rejection_reason = ?, inventory_reserved = 0 WHERE id = ?",
        [rejection_reason || "Payment could not be verified.", orderId],
      );

      // Step 2: Restore product/variant stock if it was previously reserved
      // (Only needed if inventory was deducted — avoids double-restoration on re-rejection)
      if (hasReservedInventory) {
        await restoreOrderItemStock(connection, orderId);
      }
    }

    await connection.commit();
    res.status(200).json({
      success: true,
      message: `Payment successfully marked as ${status}`,
    });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release(); // Always return the connection to the pool
  }
};

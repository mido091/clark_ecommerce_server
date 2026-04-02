import db from "../config/db.js";
import { restoreOrderItemStock } from "../utils/variantStock.js";

// ── GET /api/payments/admin/pending (Admin/Owner) ───────────────────
export const getPendingPayments = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // A payment is "pending" if payment_status is 'pending' or 'pending_verification'
    const statusCondition =
      "payment_status IN ('pending', 'pending_verification')";

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM orders WHERE ${statusCondition}`,
    );

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

// ── POST /api/payments/proof (User Uploads Receipt) ─────────────────
export const uploadProof = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { order_id, amount, reference } = req.body;
    const screenshotUrl = req.file?.path;

    if (!order_id || !amount || !screenshotUrl) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    // Verify order belongs to user and is unpaid
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

// ── PUT /api/payments/:id/verify (Admin Accepts/Rejects) ────────────
export const verifyPayment = async (req, res, next) => {
  const connection = await db.getConnection();
  try {
    const orderId = req.params.id;
    const { status, rejection_reason } = req.body;

    if (!["paid", "rejected"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    // Start transaction to safely deduplicate stock if paid
    await connection.beginTransaction();

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
      // Mark payment paid, advance order to 'confirmed'
      await connection.query(
        "UPDATE orders SET payment_status = 'paid', status = 'confirmed', rejection_reason = NULL WHERE id = ?",
        [orderId],
      );
    } else if (status === "rejected") {
      const hasReservedInventory = Boolean(
        Number(existingOrder.inventory_reserved || 0),
      );

      // 1. Cancel the order AND reject the payment atomically
      await connection.query(
        "UPDATE orders SET payment_status = 'rejected', status = 'cancelled', rejection_reason = ?, inventory_reserved = 0 WHERE id = ?",
        [rejection_reason || "Payment could not be verified.", orderId],
      );

      // 2. Restore stock for any order that still had reserved inventory
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
    connection.release();
  }
};

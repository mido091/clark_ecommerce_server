/**
 * @file messages.controllers.js
 * @description Contact Us message management controller.
 *
 * Handles contact form submissions from the public "Contact Us" page
 * and provides admin tools to manage received messages.
 *
 * Message Statuses:
 *  - "unread"   — Default status for new messages
 *  - "read"     — Admin has viewed the message
 *  - "archived" — Admin has archived the message (soft deletion)
 *
 * Endpoints:
 *  - getMessages          — GET    /messages         — Admin: paginated message list
 *  - createMessage        — POST   /messages         — Public: submit a contact form
 *  - updateMessageStatus  — PUT    /messages/:id/status — Admin: mark read/unread/archived
 *  - deleteMessage        — DELETE /messages/:id     — Admin: permanently delete a message
 */

import db from "../config/db.js";

// ── getMessages ────────────────────────────────────────────────────────────────
/**
 * GET /api/messages
 *
 * Admin-only endpoint to view all contact messages with pagination.
 * Messages are ordered by creation date (newest first).
 *
 * Query params:
 *  - page  {number} Page number (default: 1)
 *  - limit {number} Items per page (default: 10)
 *
 * @route  GET /api/messages
 * @access Protected — Admin or Owner only
 */
export const getMessages = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // Fetch the paginated messages
    const [rows] = await db.query(
      "SELECT * FROM contact_messages ORDER BY created_at DESC LIMIT ? OFFSET ?",
      [limit, offset],
    );

    // Get total count for pagination metadata
    const [[{ total }]] = await db.query(
      "SELECT COUNT(*) as total FROM contact_messages",
    );

    res.status(200).json({
      success: true,
      data: rows,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── createMessage ──────────────────────────────────────────────────────────────
/**
 * POST /api/messages
 *
 * Public endpoint to submit a contact form message.
 * All four fields are required — no partial submissions allowed.
 *
 * Body: { name, email, subject, message }
 *
 * NOTE: No authentication required. Messages are stored with "unread" status by default
 * (set by the DB default constraint on the status column).
 *
 * @route  POST /api/messages
 * @access Public
 */
export const createMessage = async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validate all required fields
    if (!name || !email || !subject || !message) {
      return res
        .status(400)
        .json({ success: false, message: "All fields are required" });
    }

    await db.query(
      "INSERT INTO contact_messages (name, email, subject, message) VALUES (?, ?, ?, ?)",
      [name, email, subject, message],
    );

    res
      .status(201)
      .json({ success: true, message: "Message sent successfully" });
  } catch (error) {
    next(error);
  }
};

// ── updateMessageStatus ────────────────────────────────────────────────────────
/**
 * PUT /api/messages/:id/status
 *
 * Admin endpoint to change the status of a message.
 * This allows admins to track which messages have been handled.
 *
 * Status values:
 *  - "read"     — Admin has read the message
 *  - "unread"   — Mark back as unread (e.g., if follow-up is needed)
 *  - "archived" — Move to archive (hides from default view)
 *
 * Body: { status }
 *
 * @route  PUT /api/messages/:id/status
 * @access Protected — Admin or Owner only
 */
export const updateMessageStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate that only allowed status values are accepted
    if (!["read", "unread", "archived"].includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid status" });
    }

    await db.query("UPDATE contact_messages SET status = ? WHERE id = ?", [
      status,
      id,
    ]);

    res.status(200).json({ success: true, message: "Message status updated" });
  } catch (error) {
    next(error);
  }
};

// ── deleteMessage ──────────────────────────────────────────────────────────────
/**
 * DELETE /api/messages/:id
 *
 * Permanently deletes a contact message. This is irreversible.
 * For soft deletion, use updateMessageStatus to set status to "archived".
 *
 * @route  DELETE /api/messages/:id
 * @access Protected — Admin or Owner only
 */
export const deleteMessage = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query("DELETE FROM contact_messages WHERE id = ?", [id]);
    res.status(200).json({ success: true, message: "Message deleted" });
  } catch (error) {
    next(error);
  }
};

/**
 * @file dashboard.controllers.js
 * @description Admin dashboard statistics controller.
 *
 * Provides a single aggregate endpoint that runs multiple queries in parallel
 * using Promise.all — minimizing response time by avoiding sequential DB calls.
 *
 * Statistics returned:
 *  - total_orders        — Total number of orders ever placed
 *  - delivered_revenue   — Sum of total_price for delivered orders only
 *  - delivered_net_profit — Sum of net profit from delivered order items
 *  - pending_payments    — Count of orders awaiting payment verification
 *  - total_products      — Total product count
 *  - total_users         — Total user count (only visible to the "owner" role)
 *  - recent_orders       — Last 10 orders (for the dashboard activity feed)
 *
 * Role-Based Data Visibility:
 *  - total_users is returned as null for admins (only owner sees user count)
 *  - Net profit data is calculated from order_items.unit_net_profit (snapshot at order time)
 *    falling back to products.net_profit if the snapshot is missing
 */

import db from "../config/db.js";
import { ensureFinancialColumns } from "../utils/financialSchema.js";

// ── getDashboardStats ──────────────────────────────────────────────────────────
/**
 * GET /api/dashboard
 *
 * Fetches all dashboard KPIs in a single request using parallel queries.
 * All 7 queries are fired concurrently via Promise.all for minimal latency.
 *
 * Revenue vs Net Profit:
 *  - Revenue = what was charged to customers (total_price on delivered orders)
 *  - Net Profit = revenue minus costs (unit_net_profit stored per order item at time of order)
 *
 * @route  GET /api/dashboard
 * @access Protected — Admin or Owner only (verifyAdminOrOwner at route level)
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    // Ensure the net_profit and unit_net_profit columns exist before querying
    // (added by ensureFinancialColumns if missing — schema migration guard)
    await ensureFinancialColumns();

    // Only the "owner" gets to see the total user count
    const isOwner = req.user?.role === "owner";

    // ── Run all queries in parallel for better performance ──────────────────
    const [
      [orderCountRows],    // Total orders ever placed
      [revenueRows],       // Total revenue from delivered orders
      [netProfitRows],     // Net profit from delivered orders
      [pendingPaymentRows],// Orders waiting for payment verification
      [productRows],       // Total product count
      [recentOrders],      // 10 most recent orders (for activity feed)
      [userRows],          // Total user count (owner-only)
    ] = await Promise.all([
      db.query("SELECT COUNT(*) AS total_orders FROM orders"),

      // Only count revenue from fully delivered orders
      db.query(`
        SELECT COALESCE(SUM(total_price), 0) AS delivered_revenue
        FROM orders
        WHERE status = 'delivered'
      `),

      // Net profit = sum of (unit_net_profit × quantity) for each delivered order item
      // COALESCE chain: use snapshot value → fallback to current product price → default 0
      db.query(`
        SELECT COALESCE(
          SUM(COALESCE(oi.unit_net_profit, p.net_profit, 0) * oi.quantity),
          0
        ) AS delivered_net_profit
        FROM order_items oi
        INNER JOIN orders o ON o.id = oi.order_id
        LEFT JOIN products p ON p.id = oi.product_id
        WHERE o.status = 'delivered'
      `),

      // Count orders where payment hasn't been confirmed yet
      db.query(`
        SELECT COUNT(*) AS pending_payments
        FROM orders
        WHERE payment_status IN ('pending', 'pending_verification')
      `),

      db.query("SELECT COUNT(*) AS total_products FROM products"),

      // Recent 10 orders with user info for the activity table
      db.query(`
        SELECT
          o.id,
          o.status,
          o.payment_status,
          o.total_price,
          o.created_at,
          u.name,
          u.email
        FROM orders o
        LEFT JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC
        LIMIT 10
      `),

      // User count only for owner — otherwise return a placeholder promise
      isOwner
        ? db.query("SELECT COUNT(*) AS total_users FROM users")
        : Promise.resolve([[{ total_users: null }]]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total_orders: Number(orderCountRows[0]?.total_orders || 0),
        delivered_revenue: Number(revenueRows[0]?.delivered_revenue || 0),
        delivered_net_profit: Number(netProfitRows[0]?.delivered_net_profit || 0),
        pending_payments: Number(pendingPaymentRows[0]?.pending_payments || 0),
        total_products: Number(productRows[0]?.total_products || 0),
        // null = user is an admin (not owner), undefined values become null in JSON
        total_users:
          userRows[0]?.total_users === null
            ? null
            : Number(userRows[0]?.total_users || 0),
        recent_orders: recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};

import db from "../config/db.js";
import { ensureFinancialColumns } from "../utils/financialSchema.js";

export const getDashboardStats = async (req, res, next) => {
  try {
    await ensureFinancialColumns();

    const isOwner = req.user?.role === "owner";

    const [
      [orderCountRows],
      [revenueRows],
      [netProfitRows],
      [pendingPaymentRows],
      [productRows],
      [recentOrders],
      [userRows],
    ] = await Promise.all([
      db.query("SELECT COUNT(*) AS total_orders FROM orders"),
      db.query(`
        SELECT COALESCE(SUM(total_price), 0) AS delivered_revenue
        FROM orders
        WHERE status = 'delivered'
      `),
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
      db.query(`
        SELECT COUNT(*) AS pending_payments
        FROM orders
        WHERE payment_status IN ('pending', 'pending_verification')
      `),
      db.query("SELECT COUNT(*) AS total_products FROM products"),
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
      isOwner
        ? db.query("SELECT COUNT(*) AS total_users FROM users")
        : Promise.resolve([[{ total_users: null }]]),
    ]);

    res.status(200).json({
      success: true,
      data: {
        total_orders: Number(orderCountRows[0]?.total_orders || 0),
        delivered_revenue: Number(revenueRows[0]?.delivered_revenue || 0),
        delivered_net_profit: Number(
          netProfitRows[0]?.delivered_net_profit || 0,
        ),
        pending_payments: Number(pendingPaymentRows[0]?.pending_payments || 0),
        total_products: Number(productRows[0]?.total_products || 0),
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

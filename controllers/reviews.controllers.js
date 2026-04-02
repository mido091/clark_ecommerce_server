import db from "../config/db.js";

// ── POST /api/reviews ──────────────────────────────────────────────
export const createReview = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { product_id, rating, comment } = req.body;

    if (!product_id || !rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Product ID and rating (1-5) are required.",
      });
    }

    // Check product exists
    const [[product]] = await db.query("SELECT id FROM products WHERE id = ?", [
      product_id,
    ]);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found." });
    }

    // Verified Purchase Check
    // The user must have an order containing this product where the order is paid/verified or delivered.
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

    // Insert as instantly approved
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
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this product.",
      });
    }
    next(error);
  }
};

// ── GET /api/reviews/product/:id (Approved reviews for a product) ──
export const getProductReviews = async (req, res, next) => {
  try {
    const productId = req.params.id;

    const [reviews] = await db.query(
      `SELECT r.id, r.rating, r.comment, r.created_at,
              u.name as user_name, u.image as user_avatar
       FROM reviews r
       LEFT JOIN users u ON r.user_id = u.id
       WHERE r.product_id = ? AND r.is_approved = TRUE
       ORDER BY r.created_at DESC`,
      [productId],
    );

    // Calculate star distribution
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
        avg_rating:
          reviews.length > 0 ? +(totalRating / reviews.length).toFixed(1) : 0,
        distribution,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ── GET /api/reviews/admin (All reviews — admin only) ──────────────
export const getAllReviews = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const filter = req.query.status; // 'pending' | 'approved' | undefined

    let whereSql = "1=1";
    const params = [];
    if (filter === "pending") {
      whereSql += " AND r.is_approved = FALSE";
    } else if (filter === "approved") {
      whereSql += " AND r.is_approved = TRUE";
    }

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM reviews r WHERE ${whereSql}`,
      params,
    );

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

// ── PATCH /api/reviews/:id/toggle (Admin) ─────────────────────────
export const toggleVisibility = async (req, res, next) => {
  try {
    const [result] = await db.query(
      "UPDATE reviews SET is_approved = NOT is_approved WHERE id = ?",
      [req.params.id],
    );
    if (result.affectedRows === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found." });
    }
    // Fetch updated status to return
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

// ── DELETE /api/reviews/:id (Admin) ────────────────────────────────
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

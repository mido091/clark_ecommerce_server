import db from "../config/db.js";
import slugify from "slugify";
import { normalizeArabic, expandQuery, sanitizeSearch } from "../utils/searchHelper.js";
// create product
const createProduct = async (req, res, next) => {
  try {
    let {
      name,
      name_ar,
      category_id,
      price,
      old_price,
      description,
      description_ar,
      specs_en,
      specs_ar,
      stock,
      is_active,
    } = req.body || {};
    //check if name and slug are required
    if (!name || !category_id || !price || !description || !stock) {
      return res.status(400).json({ message: "All fields are required" });
    }
    is_active = is_active !== undefined ? is_active : true;
    price = parseFloat(price);
    old_price = old_price ? parseFloat(old_price) : null;
    stock = parseInt(stock);

    if (isNaN(price) || isNaN(stock)) {
      return res
        .status(400)
        .json({ message: "Price and stock must be numbers" });
    }

    if (old_price !== null && old_price <= price) {
      return res
        .status(400)
        .json({ message: "Original price must be higher than current price" });
    }
    const slug = slugify(name, { lower: true, strict: true });
    //check if product already exists
    const [rows] = await db.query("SELECT * FROM products WHERE name = ?", [
      name,
    ]);
    if (rows.length > 0) {
      return res.status(400).json({ message: "Product already exists" });
    }
    //insert product
    const [result] = await db.query(
      "INSERT INTO products (name, name_ar, category_id, price, old_price, slug, description, description_ar, specs_en, specs_ar, stock, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        name,
        name_ar,
        category_id,
        price,
        old_price,
        slug,
        description,
        description_ar || null,
        specs_en || null,
        specs_ar || null,
        stock,
        is_active,
      ],
    );
    if (result.affectedRows === 0) {
      return res.status(400).json({ message: "Product not created" });
    }
    const product_id = result.insertId;
    //image upload
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Image is required" });
    }
    const image_url = req.files.map((file, index) => {
      return db.query(
        "INSERT INTO product_images (product_id, image_url, is_main) VALUES (?, ?, ?)",
        [product_id, file.path, index === 0 ? 1 : 0],
      );
    });
    await Promise.all(image_url);
    //if success
    res.status(201).json({ message: "Product created successfully" });
  } catch (error) {
    next(error);
  }
};

//get all products
const getAllProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const name = req.query.name || "";
    const category_id = req.query.category_id || "";
    const min_price = req.query.min_price || "";
    const max_price = req.query.max_price || "";

    let whereConditions = [];
    let queryParams = [];

    if (name) {
      const sanitized = sanitizeSearch(name);
      const expandedTerms = expandQuery(name);
      
      const searchParts = [];
      expandedTerms.forEach(term => {
        searchParts.push("(products.name LIKE ? OR products.name_ar LIKE ? OR products.description LIKE ? OR products.description_ar LIKE ?)");
        const likeTerm = `%${term}%`;
        queryParams.push(likeTerm, likeTerm, likeTerm, likeTerm);
      });
      
      whereConditions.push(`(${searchParts.join(" OR ")})`);
    }

    if (category_id) {
      whereConditions.push("products.category_id = ?");
      queryParams.push(category_id);
    }

    if (min_price) {
      whereConditions.push("products.price >= ?");
      queryParams.push(parseFloat(min_price));
    }

    if (max_price) {
      whereConditions.push("products.price <= ?");
      queryParams.push(parseFloat(max_price));
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : "";

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM products ${whereClause}`,
      queryParams,
    );

    const [rows] = await db.query(
      `
      SELECT 
        products.*, 
        categories.name as category_name,
        categories.name_ar as category_name_ar,
        GROUP_CONCAT(product_images.image_url ORDER BY product_images.is_main DESC, product_images.id ASC) AS images
      FROM products
      LEFT JOIN product_images ON products.id = product_images.product_id
      LEFT JOIN categories ON products.category_id = categories.id
      ${whereClause}
      GROUP BY products.id
      ORDER BY products.id DESC
      LIMIT ? OFFSET ?
    `,
      [...queryParams, limit, offset],
    );

    const products = rows.map((product) => {
      const imageArray = product.images ? product.images.split(",") : [];
      return {
        ...product,
        images: imageArray,
        main_image: imageArray.length > 0 ? imageArray[0] : null,
      };
    });

    res.status(200).json({
      success: true,
      message: "Products fetched successfully",
      data: products,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};
//get product by id
const getProductById = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!id) {
      return res.status(400).json({ message: "Product not found" });
    }

    // Main product query with category name
    const [rows] = await db.query(
      `SELECT products.*, 
              categories.name as category_name,
              categories.name_ar as category_name_ar,
              GROUP_CONCAT(product_images.image_url ORDER BY product_images.is_main DESC, product_images.id ASC) AS images
       FROM products
       LEFT JOIN product_images ON products.id = product_images.product_id
       LEFT JOIN categories ON products.category_id = categories.id
       WHERE products.id = ?
       GROUP BY products.id`,
      [id],
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    const product = {
      ...rows[0],
      images: rows[0].images ? rows[0].images.split(",") : [],
    };

    // Avg rating & review count (approved only)
    const [[ratingData]] = await db.query(
      `SELECT COALESCE(AVG(rating), 0) as avg_rating, COUNT(*) as review_count
       FROM reviews WHERE product_id = ? AND is_approved = TRUE`,
      [id],
    );
    product.avg_rating = +Number(ratingData.avg_rating).toFixed(1);
    product.review_count = ratingData.review_count;

    // Related products (same category, exclude self, limit 5)
    const [related] = await db.query(
      `SELECT p.id, p.name, p.name_ar, p.price, p.stock,
              (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id LIMIT 1) as main_image
       FROM products p
       WHERE p.category_id = ? AND p.id != ? AND p.is_active = 1
       ORDER BY RAND()
       LIMIT 5`,
      [product.category_id, id],
    );
    product.related_products = related;

    res.status(200).json({
      success: true,
      message: "Product fetched successfully",
      data: product,
    });
  } catch (error) {
    next(error);
  }
};
//update product
const updateProduct = async (req, res, next) => {
  const connection = await db.getConnection(); // Use a dedicated connection for the transaction
  try {
    const { id } = req.params;
    let {
      name,
      name_ar,
      category_id,
      price,
      old_price,
      description,
      description_ar,
      specs_en,
      specs_ar,
      stock,
      is_active,
    } = req.body || {};

    // 1. Check if product exists before updating
    const [rows] = await connection.query(
      "SELECT * FROM products WHERE id = ?",
      [id],
    );
    if (rows.length === 0) {
      await connection.release();
      return res.status(404).json({ message: "Product not found" });
    }

    // 2. Start Transaction
    await connection.beginTransaction();

    // 3. Prepare data and handle Falsy values
    name = name || rows[0].name;
    name_ar = name_ar || rows[0].name_ar;
    price = price !== undefined ? parseFloat(price) : rows[0].price;
    old_price = old_price !== undefined ? (old_price ? parseFloat(old_price) : null) : rows[0].old_price;
    stock = stock !== undefined ? parseInt(stock) : rows[0].stock;

    if (old_price !== null && old_price <= price) {
      return res
        .status(400)
        .json({ message: "Original price must be higher than current price" });
    }

    is_active = is_active !== undefined ? is_active : rows[0].is_active;
    category_id = category_id || rows[0].category_id;
    const slug = name
      ? slugify(name, { lower: true, strict: true })
      : rows[0].slug;

    await connection.query(
      "UPDATE products SET name = ?, name_ar = ?, slug = ?, category_id = ?, price = ?, old_price = ?, description = ?, description_ar = ?, specs_en = ?, specs_ar = ?, stock = ?, is_active = ? WHERE id = ?",
      [
        name,
        name_ar,
        slug,
        category_id,
        price,
        old_price,
        description || rows[0].description,
        description_ar !== undefined ? description_ar : rows[0].description_ar,
        specs_en !== undefined ? specs_en : rows[0].specs_en,
        specs_ar !== undefined ? specs_ar : rows[0].specs_ar,
        stock,
        is_active,
        id,
      ],
    );

    // 5. Handle Image Updates (If new images are uploaded)
    if (req.files && req.files.length > 0) {
      // Step A: Fetch and delete old images from database
      // Note: For a full production app, you would also delete the files from Cloudinary here
      await connection.query(
        "DELETE FROM product_images WHERE product_id = ?",
        [id],
      );

      // Step B: Insert new image URLs
      const imageQueries = req.files.map((file, index) => {
        return connection.query(
          "INSERT INTO product_images (product_id, image_url, is_main) VALUES (?, ?, ?)",
          [id, file.path, index === 0 ? 1 : 0],
        );
      });
      await Promise.all(imageQueries);
    }

    // 6. Commit Transaction
    await connection.commit();
    res
      .status(200)
      .json({ status: true, message: "Product updated successfully" });
  } catch (error) {
    // Rollback changes if any step fails
    await connection.rollback();
    next(error);
  } finally {
    // Release the connection back to the pool
    connection.release();
  }
};
//delete product
const deleteProduct = async (req, res, next) => {
  const connection = await db.getConnection(); // مخصص للـ Transaction
  try {
    const id = req.params.id;

    // 1. التأكد من وجود المنتج
    const [rows] = await connection.query(
      "SELECT * FROM products WHERE id = ?",
      [id],
    );
    if (rows.length === 0) {
      await connection.release();
      return res.status(404).json({ message: "Product not found" });
    }

    // 2. بدء العملية
    await connection.beginTransaction();

    // 3. مسح الصور من جدول product_images أولاً (الارتباط)
    await connection.query("DELETE FROM product_images WHERE product_id = ?", [
      id,
    ]);

    // 4. مسح المنتج نفسه من جدول products
    const [result] = await connection.query(
      "DELETE FROM products WHERE id = ?",
      [id],
    );

    if (result.affectedRows === 0) {
      throw new Error("Failed to delete product from database");
    }

    // 5. تثبيت العملية
    await connection.commit();
    res.status(200).json({
      status: true,
      message: "Product and its images deleted successfully",
    });
  } catch (error) {
    // لو حصلت مشكلة في أي خطوة، الغِ المسح
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};
//export
export {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  deleteProduct,
};

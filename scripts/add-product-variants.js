import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import {
  DEFAULT_EGYPT_GOVERNORATES,
  normalizeGovernorates,
} from "../utils/egyptGovernorates.js";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value || `${value}`.trim() === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return `${value}`.trim();
}

function resolveSslConfig() {
  const rawValue = `${process.env.DB_ATTR_SSL_CA || "isrgrootx1.pem"}`.trim();

  if (!rawValue) {
    return undefined;
  }

  if (rawValue.startsWith("-----BEGIN CERTIFICATE-----")) {
    return {
      ca: rawValue,
      rejectUnauthorized: false,
    };
  }

  const certificatePath = path.isAbsolute(rawValue)
    ? rawValue
    : path.join(process.cwd(), rawValue);

  if (!fs.existsSync(certificatePath)) {
    console.warn("SSL CA file not found; continuing with relaxed TLS settings.", {
      certificatePath,
    });
    return {
      rejectUnauthorized: false,
    };
  }

  return {
    ca: fs.readFileSync(certificatePath, "utf8"),
    rejectUnauthorized: false,
  };
}

const db = await mysql.createConnection({
  host: required("DB_HOST"),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  database: required("DB_NAME"),
  port: Number(process.env.DB_PORT || 3306),
  ssl: resolveSslConfig(),
});

async function tableExists(tableName) {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_name = ?
    `,
    [tableName],
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function columnExists(tableName, columnName) {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND column_name = ?
    `,
    [tableName, columnName],
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function indexExists(tableName, indexName) {
  const [rows] = await db.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = ?
        AND index_name = ?
    `,
    [tableName, indexName],
  );

  return Number(rows[0]?.total || 0) > 0;
}

async function getOrdersStatusColumnType() {
  const [rows] = await db.query(
    `
      SELECT COLUMN_TYPE
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'orders'
        AND column_name = 'status'
    `,
  );

  return rows[0]?.COLUMN_TYPE || "";
}

async function run() {
  try {
    if (!(await columnExists("products", "size_mode"))) {
      await db.query(`
        ALTER TABLE products
        ADD COLUMN size_mode ENUM('none','alpha','numeric') NOT NULL DEFAULT 'none'
        AFTER stock
      `);
      console.log("Added products.size_mode");
    }

    if (!(await tableExists("product_colors"))) {
      await db.query(`
        CREATE TABLE product_colors (
          id INT NOT NULL AUTO_INCREMENT,
          product_id INT NOT NULL,
          name VARCHAR(80) NOT NULL,
          value VARCHAR(20) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_product_colors_product (product_id),
          CONSTRAINT fk_product_colors_product
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
        )
      `);
      console.log("Created product_colors");
    }

    if (!(await tableExists("product_color_images"))) {
      await db.query(`
        CREATE TABLE product_color_images (
          id INT NOT NULL AUTO_INCREMENT,
          product_color_id INT NOT NULL,
          image_url VARCHAR(255) NOT NULL,
          sort_order INT NOT NULL DEFAULT 0,
          is_main TINYINT(1) DEFAULT 0,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_product_color_images_color (product_color_id),
          CONSTRAINT fk_product_color_images_color
            FOREIGN KEY (product_color_id) REFERENCES product_colors(id) ON DELETE CASCADE
        )
      `);
      console.log("Created product_color_images");
    }

    if (!(await tableExists("product_variants"))) {
      await db.query(`
        CREATE TABLE product_variants (
          id INT NOT NULL AUTO_INCREMENT,
          product_id INT NOT NULL,
          product_color_id INT DEFAULT NULL,
          size_value VARCHAR(20) DEFAULT NULL,
          stock INT NOT NULL DEFAULT 0,
          created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_product_variants_product (product_id),
          KEY idx_product_variants_color (product_color_id),
          CONSTRAINT fk_product_variants_product
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
          CONSTRAINT fk_product_variants_color
            FOREIGN KEY (product_color_id) REFERENCES product_colors(id) ON DELETE CASCADE
        )
      `);
      console.log("Created product_variants");
    }

    if (!(await indexExists("product_variants", "idx_product_variants_combo"))) {
      await db.query(`
        CREATE UNIQUE INDEX idx_product_variants_combo
        ON product_variants (product_id, product_color_id, size_value)
      `);
      console.log("Created product_variants combo index");
    }

    const orderItemColumns = [
      {
        name: "variant_id",
        sql: "ALTER TABLE order_items ADD COLUMN variant_id INT DEFAULT NULL AFTER product_id",
      },
      {
        name: "selected_size",
        sql: "ALTER TABLE order_items ADD COLUMN selected_size VARCHAR(20) DEFAULT NULL AFTER quantity",
      },
      {
        name: "selected_color_name",
        sql: "ALTER TABLE order_items ADD COLUMN selected_color_name VARCHAR(80) DEFAULT NULL AFTER selected_size",
      },
      {
        name: "selected_color_value",
        sql: "ALTER TABLE order_items ADD COLUMN selected_color_value VARCHAR(20) DEFAULT NULL AFTER selected_color_name",
      },
      {
        name: "selected_image_url",
        sql: "ALTER TABLE order_items ADD COLUMN selected_image_url VARCHAR(255) DEFAULT NULL AFTER selected_color_value",
      },
    ];

    for (const column of orderItemColumns) {
      if (!(await columnExists("order_items", column.name))) {
        await db.query(column.sql);
        console.log(`Added order_items.${column.name}`);
      }
    }

    if (!(await indexExists("order_items", "idx_order_items_variant"))) {
      await db.query(`
        CREATE INDEX idx_order_items_variant
        ON order_items (variant_id)
      `);
      console.log("Created order_items variant index");
    }

    const settingsColumns = [
      {
        name: "shipping_governorates",
        sql: "ALTER TABLE site_settings ADD COLUMN shipping_governorates JSON NULL AFTER favicon_url",
      },
    ];

    for (const column of settingsColumns) {
      if (!(await columnExists("site_settings", column.name))) {
        await db.query(column.sql);
        console.log(`Added site_settings.${column.name}`);
      }
    }

    const orderColumns = [
      {
        name: "shipping_full_name",
        sql: "ALTER TABLE orders ADD COLUMN shipping_full_name VARCHAR(120) DEFAULT NULL AFTER transaction_id",
      },
      {
        name: "shipping_governorate",
        sql: "ALTER TABLE orders ADD COLUMN shipping_governorate VARCHAR(120) DEFAULT NULL AFTER shipping_full_name",
      },
      {
        name: "shipping_fee",
        sql: "ALTER TABLE orders ADD COLUMN shipping_fee DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER shipping_governorate",
      },
      {
        name: "items_total",
        sql: "ALTER TABLE orders ADD COLUMN items_total DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER shipping_fee",
      },
      {
        name: "discount_amount",
        sql: "ALTER TABLE orders ADD COLUMN discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER items_total",
      },
      {
        name: "return_reason",
        sql: "ALTER TABLE orders ADD COLUMN return_reason TEXT NULL AFTER rejection_reason",
      },
      {
        name: "inventory_reserved",
        sql: "ALTER TABLE orders ADD COLUMN inventory_reserved TINYINT(1) NOT NULL DEFAULT 0 AFTER return_reason",
      },
    ];

    for (const column of orderColumns) {
      if (!(await columnExists("orders", column.name))) {
        await db.query(column.sql);
        console.log(`Added orders.${column.name}`);
      }
    }

    const statusColumnType = await getOrdersStatusColumnType();
    if (statusColumnType && !statusColumnType.includes("'returned'")) {
      await db.query(`
        ALTER TABLE orders
        MODIFY COLUMN status ENUM(
          'pending',
          'confirmed',
          'verified',
          'out_for_delivery',
          'shipped',
          'delivered',
          'cancelled',
          'rejected',
          'returned',
          'problem'
        ) DEFAULT 'pending'
      `);
      console.log("Extended orders.status enum with returned");
    }

    if (await columnExists("orders", "inventory_reserved")) {
      await db.query(`
        UPDATE orders
        SET inventory_reserved = CASE
          WHEN status IN ('cancelled', 'rejected', 'returned') THEN 0
          ELSE 1
        END
      `);
      console.log("Normalized orders.inventory_reserved values");
    }

    const [settingsRows] = await db.query(
      "SELECT id, shipping_governorates FROM site_settings LIMIT 1",
    );
    const currentGovernorates = normalizeGovernorates(
      settingsRows[0]?.shipping_governorates,
    );
    const shouldRefreshGovernorates =
      !settingsRows.length ||
      currentGovernorates.every((item) => Number(item.value || 0) === 0);

    if (!settingsRows.length) {
      await db.query(
        `
          INSERT INTO site_settings (id, shipping_governorates)
          VALUES (1, ?)
          ON DUPLICATE KEY UPDATE shipping_governorates = VALUES(shipping_governorates)
        `,
        [JSON.stringify(DEFAULT_EGYPT_GOVERNORATES)],
      );
    } else if (shouldRefreshGovernorates) {
      await db.query(
        "UPDATE site_settings SET shipping_governorates = ? WHERE id = ?",
        [JSON.stringify(DEFAULT_EGYPT_GOVERNORATES), settingsRows[0].id],
      );
    }
    console.log("Ensured default Egypt governorates in site_settings");

    console.log("Product variants migration completed.");
  } catch (error) {
    console.error("Failed to apply product variants migration:", error);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

await run();

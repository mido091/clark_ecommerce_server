import db from "../config/db.js";

async function fixSchema() {
  try {
    console.log("🔄 Starting Schema Fix...");

    // 1. Ensure categories has 'icon' and 'image_url'
    console.log("Checking categories table...");
    const [catCols] = await db.query("SHOW COLUMNS FROM categories");
    const catFields = catCols.map(c => c.Field);
    
    if (!catFields.includes("icon")) {
      console.log("Adding 'icon' to categories...");
      await db.query("ALTER TABLE categories ADD COLUMN icon VARCHAR(50) DEFAULT 'package'");
    }
    
    if (!catFields.includes("name_ar")) {
      console.log("Adding 'name_ar' to categories...");
      await db.query("ALTER TABLE categories ADD COLUMN name_ar VARCHAR(255) DEFAULT ''");
    }

    // 2. Ensure site_settings exists and has all columns
    console.log("Ensuring site_settings table exists...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        site_name VARCHAR(255) DEFAULT 'E-Commerce',
        logo_url VARCHAR(255) DEFAULT '',
        footer_logo_url VARCHAR(255) DEFAULT '',
        favicon_url VARCHAR(255) DEFAULT '',
        currency_code VARCHAR(10) DEFAULT 'EGP',
        contact_email VARCHAR(255) DEFAULT '',
        whatsapp_number VARCHAR(50) DEFAULT '',
        google_analytics_id VARCHAR(50) DEFAULT '',
        google_ads_client_id VARCHAR(50) DEFAULT '',
        header_scripts TEXT,
        footer_scripts TEXT,
        social_facebook VARCHAR(255) DEFAULT '',
        social_x VARCHAR(255) DEFAULT '',
        social_whatsapp VARCHAR(255) DEFAULT '',
        social_telegram VARCHAR(255) DEFAULT '',
        social_gmail VARCHAR(255) DEFAULT '',
        wallet_number VARCHAR(255) DEFAULT '',
        instapay_handle VARCHAR(255) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // 3. Ensure product_images exists (for seedProducts.js)
    console.log("Ensuring product_images table exists...");
    await db.query(`
      CREATE TABLE IF NOT EXISTS product_images (
        id INT AUTO_INCREMENT PRIMARY KEY,
        product_id INT NOT NULL,
        image_url VARCHAR(255) NOT NULL,
        is_main BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
      )
    `);

    console.log("✅ Schema Fix Complete!");
  } catch (err) {
    console.error("❌ Schema Fix Failed:", err.message);
  } finally {
    process.exit(0);
  }
}

fixSchema();

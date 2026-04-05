/**
 * Migration: add hero_image_url column to site_settings
 * Run: node migrate_hero.js (from server/ directory)
 */
import db from './config/db.js';

try {
  await db.query(`ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS hero_image_url TEXT NULL`);
  console.log('✅ hero_image_url column added (or already exists).');
} catch (e) {
  console.error('❌ Migration failed:', e.message);
}
process.exit(0);

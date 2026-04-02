import db from "../config/db.js";
import { v2 as cloudinary } from "cloudinary";
import { normalizeGovernorates } from "../utils/egyptGovernorates.js";
import { decodeHtmlEntities } from "../utils/html.js";

function normalizeCurrencyCode(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized || normalized === "USD") {
    return "EGP";
  }
  return normalized;
}

function normalizeSettingsAssets(row = {}) {
  return {
    ...row,
    currency_code: normalizeCurrencyCode(row.currency_code),
    logo_url: decodeHtmlEntities(row.logo_url || ""),
    footer_logo_url: decodeHtmlEntities(row.footer_logo_url || ""),
    favicon_url: decodeHtmlEntities(row.favicon_url || ""),
  };
}

function buildSettingsPayload(source = {}, old = {}) {
  return {
    site_name: source.site_name?.trim() || old.site_name || "",
    currency_code: normalizeCurrencyCode(
      source.currency_code || old.currency_code,
    ),
    contact_email: source.contact_email?.trim() || old.contact_email || "",
    whatsapp_number: source.whatsapp_number?.trim() || old.whatsapp_number || "",
    google_analytics_id:
      source.google_analytics_id?.trim() || old.google_analytics_id || "",
    google_ads_client_id:
      source.google_ads_client_id?.trim() || old.google_ads_client_id || "",
    header_scripts: source.header_scripts ?? old.header_scripts ?? "",
    footer_scripts: source.footer_scripts ?? old.footer_scripts ?? "",
    social_facebook: source.social_facebook?.trim() || old.social_facebook || "",
    social_x: source.social_x?.trim() || old.social_x || "",
    social_whatsapp: source.social_whatsapp?.trim() || old.social_whatsapp || "",
    social_telegram: source.social_telegram?.trim() || old.social_telegram || "",
    social_gmail: source.social_gmail?.trim() || old.social_gmail || "",
    wallet_number: source.wallet_number?.trim() || old.wallet_number || "",
    instapay_handle: source.instapay_handle?.trim() || old.instapay_handle || "",
    shipping_governorates: JSON.stringify(
      normalizeGovernorates(
        source.shipping_governorates ?? old.shipping_governorates,
      ),
    ),
  };
}

function resolveAsset(req, old, fieldName, dbField, bodyField) {
  if (req.files?.[fieldName]?.[0]?.path) {
    return req.files[fieldName][0].path;
  }
  if (req.body?.[bodyField]?.trim()) {
    return decodeHtmlEntities(req.body[bodyField].trim());
  }
  return decodeHtmlEntities(old[dbField] || "");
}

async function cleanupCloudinary(newPath, oldUrl) {
  if (!newPath || !oldUrl || !oldUrl.includes("cloudinary.com")) return;

  try {
    const parts = oldUrl.split("/");
    const filenameWithExt = parts.pop();
    const folder = parts.pop();
    const filename = filenameWithExt.split(".")[0];
    const publicId = `${folder}/${filename}`;
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn("[settings] Cloudinary cleanup failed:", error.message);
  }
}

const getSettings = async (_req, res, next) => {
  try {
    const [rows] = await db.query("SELECT * FROM site_settings LIMIT 1");
    const settings = normalizeSettingsAssets(rows[0] || {});
    settings.shipping_governorates = normalizeGovernorates(
      settings.shipping_governorates,
    );

    res.status(200).json({
      success: true,
      message: "Settings fetched successfully",
      data: settings,
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const [existingRows] = await db.query("SELECT * FROM site_settings LIMIT 1");
    const old = normalizeSettingsAssets(existingRows[0] || {});

    const merged = buildSettingsPayload(req.body || {}, old);
    merged.logo_url = resolveAsset(req, old, "logo", "logo_url", "logo_url");
    merged.footer_logo_url = resolveAsset(
      req,
      old,
      "footer_logo",
      "footer_logo_url",
      "footer_logo_url",
    );
    merged.favicon_url = resolveAsset(
      req,
      old,
      "favicon",
      "favicon_url",
      "favicon_url",
    );

    await cleanupCloudinary(req.files?.logo?.[0]?.path, old.logo_url);
    await cleanupCloudinary(
      req.files?.footer_logo?.[0]?.path,
      old.footer_logo_url,
    );
    await cleanupCloudinary(req.files?.favicon?.[0]?.path, old.favicon_url);

    const cols = Object.keys(merged);
    const vals = Object.values(merged);

    if (!old.id) {
      const colList = cols.join(", ");
      const placeholders = cols.map(() => "?").join(", ");
      await db.query(
        `INSERT INTO site_settings (${colList}) VALUES (${placeholders})`,
        vals,
      );
    } else {
      const setClause = cols.map((column) => `${column} = ?`).join(", ");
      await db.query(
        `UPDATE site_settings SET ${setClause} WHERE id = ?`,
        [...vals, old.id],
      );
    }

    const [rows] = await db.query("SELECT * FROM site_settings LIMIT 1");
    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: {
        ...normalizeSettingsAssets(rows[0] || {}),
        shipping_governorates: normalizeGovernorates(
          rows[0]?.shipping_governorates,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateShippingSettings = async (req, res, next) => {
  try {
    const [existingRows] = await db.query("SELECT * FROM site_settings LIMIT 1");
    const old = normalizeSettingsAssets(existingRows[0] || {});
    const shippingGovernorates = JSON.stringify(
      normalizeGovernorates(req.body.shipping_governorates),
    );

    if (!old.id) {
      await db.query(
        "INSERT INTO site_settings (id, shipping_governorates) VALUES (1, ?)",
        [shippingGovernorates],
      );
    } else {
      await db.query(
        "UPDATE site_settings SET shipping_governorates = ? WHERE id = ?",
        [shippingGovernorates, old.id],
      );
    }

    const [rows] = await db.query("SELECT * FROM site_settings LIMIT 1");
    return res.status(200).json({
      success: true,
      message: "Shipping settings updated successfully",
      data: {
        ...normalizeSettingsAssets(rows[0] || {}),
        shipping_governorates: normalizeGovernorates(
          rows[0]?.shipping_governorates,
        ),
      },
    });
  } catch (error) {
    next(error);
  }
};

export { getSettings, updateSettings, updateShippingSettings };

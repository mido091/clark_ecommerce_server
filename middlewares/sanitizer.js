/**
 * @file sanitizer.js (middleware)
 * @description Global input sanitization middleware to prevent XSS attacks.
 *
 * Applied to all /api routes BEFORE they reach any controller.
 * Recursively escapes HTML entities in all string values found in:
 *   - req.body   (JSON and form data)
 *   - req.query  (URL query parameters)
 *   - req.params (URL path parameters)
 *
 * Whitelist:
 *   Certain fields are intentionally skipped because they store raw HTML
 *   (e.g., header_scripts, description). These are trusted admin-only fields
 *   that must preserve their HTML content.
 *
 * Notes:
 *   - Uses the `validator` library's escape() — converts <, >, &, ", ' to HTML entities
 *   - Plain objects and arrays are recursively traversed
 *   - Non-plain objects (Buffer, Date, etc.) are passed through unchanged
 *   - If sanitization fails for any reason, the middleware calls next() anyway
 *     to avoid breaking the app at the cost of slightly reduced safety
 */

import validator from "validator";

/**
 * Express middleware: sanitizes all string properties in req.body, req.query, and req.params.
 *
 * @param {object}   req  - Express request
 * @param {object}   res  - Express response
 * @param {Function} next - Express next
 */
export const sanitizeData = (req, res, next) => {
  try {
    /**
     * Fields that should NOT be escaped because they contain safe HTML/scripts
     * controlled exclusively by admins (never from user input).
     * - header_scripts / footer_scripts: Google Analytics/Ads snippets
     * - description / description_ar: Rich product descriptions (may contain HTML)
     * - specs_en / specs_ar: Product specification HTML
     * - google_analytics_id / google_ads_client_id: Tracking IDs with hyphens
     */
    const whitelist = [
      "header_scripts",
      "footer_scripts",
      "description",
      "description_ar",
      "specs_en",
      "specs_ar",
      "google_analytics_id",
      "google_ads_client_id"
    ];

    /**
     * Recursively sanitizes a single value.
     *
     * @param {*}      data - The value to sanitize (any type)
     * @param {string} key  - The object key associated with this value (for whitelist check)
     * @returns {*} Sanitized value of the same type
     */
    const sanitize = (data, key = null) => {
      // Step 1: Skip whitelisted keys (admin-trusted HTML fields)
      if (key && whitelist.includes(key)) {
        return data;
      }

      // Step 2: Strings — trim whitespace and escape HTML entities
      if (typeof data === "string") {
        return validator.escape(data.trim());
      }

      // Step 3: Arrays — recurse over each element
      if (Array.isArray(data)) {
        return data.map((item) => sanitize(item));
      }

      // Step 4: Plain objects — recurse over each own property
      // Non-plain objects (Buffer, Date, Multer file objects) are passed through
      if (typeof data === "object" && data !== null) {
        if (data.constructor && data.constructor.name !== "Object" && data.constructor.name !== "Array") {
          return data; // Not a plain object — skip sanitization
        }

        const sanitizedObj = {};
        for (const k in data) {
          if (Object.prototype.hasOwnProperty.call(data, k)) {
            sanitizedObj[k] = sanitize(data[k], k); // Pass key for whitelist check
          }
        }
        return sanitizedObj;
      }

      // Step 5: Numbers, booleans, null, undefined — return as-is
      return data;
    };

    // Apply sanitization to request body, query string, and URL params
    if (req.body && Object.keys(req.body).length > 0) {
      const sanitizedBody = sanitize(req.body);
      Object.assign(req.body, sanitizedBody);  // Mutate in-place (avoids reference issues)
    }
    if (req.query && Object.keys(req.query).length > 0) {
      const sanitizedQuery = sanitize(req.query);
      // NOTE: Object.assign is used because re-assigning req.query is blocked by Vercel
      Object.assign(req.query, sanitizedQuery);
    }
    if (req.params && Object.keys(req.params).length > 0) {
      const sanitizedParams = sanitize(req.params);
      Object.assign(req.params, sanitizedParams);
    }

    next();
  } catch (error) {
    // Sanitization failed unexpectedly (shouldn't happen, but we fail open
    // because a broken sanitizer should not take the app offline)
    console.error("Sanitization Error:", error);
    next();
  }
};

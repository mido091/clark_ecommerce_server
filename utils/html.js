/**
 * @file html.js
 * @description HTML entity decoding utility.
 *
 * This utility solves a specific problem: When rich text (containing HTML) is
 * passed through the sanitizeData middleware (sanitizer.js), the validator.escape()
 * function converts characters like "/" into HTML entities like "&amp;#x2F;".
 *
 * For fields that store URLs (logo_url, favicon_url) or scripts containing HTML,
 * these entities would corrupt the stored values. This function reverses that encoding.
 *
 * Iterative decoding:
 *  The while loop handles double-encoded entities (e.g., &amp;amp; → &amp; → &)
 *  which can happen when data passes through multiple encoding layers.
 *
 * Supported conversions:
 *  &amp;#x2F; → /   (hex encoded forward slash — common in URLs)
 *  &amp;     → &
 *  &#xHH;   → (character from hex code)
 *  &#DDD;   → (character from decimal code)
 *  &quot;   → "
 *  &#39;    → '
 *  &lt;     → <
 *  &gt;     → >
 */

/**
 * Recursively decodes HTML entities in a string until no more encoded sequences remain.
 *
 * @param {string} value - The string that may contain HTML entities
 * @returns {string} The decoded string, or the original value if it's not a string
 *
 * @example
 * decodeHtmlEntities("settings_logos&amp;#x2F;logo_abc.png")
 * // → "settings_logos/logo_abc.png"
 */
export function decodeHtmlEntities(value) {
  // Return non-string values (null, undefined, numbers) unchanged
  if (typeof value !== "string" || !value) return value;

  let result = value;
  let previous = null;

  // Iteratively decode until the string stabilizes (handles double-encoding)
  while (result !== previous) {
    previous = result;
    result = result
      // Handle double-escaped slash: &amp;#x2F; → /
      .replace(/&amp;#x2F;/gi, "/")
      // Handle &amp; entity
      .replace(/&amp;/g, "&")
      // Handle hex entities: &#x2F; → / (char from hex code point)
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      // Handle decimal entities: &#47; → / (char from decimal code point)
      .replace(/&#([0-9]+);/g, (_match, dec) =>
        String.fromCharCode(parseInt(dec, 10)),
      )
      // Standard named entities
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  return result;
}

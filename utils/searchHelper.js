/**
 * @file searchHelper.js
 * @description Arabic/English bilingual search expansion utility.
 *
 * This module powers the product search functionality by handling two challenges:
 *  1. Arabic text normalization — removes diacritics and normalizes variant letter forms
 *     so that "ساعة" and "ساعه" both match the same products
 *  2. Cross-language keyword expansion — maps Arabic search terms to their English
 *     equivalents so users can find products regardless of which language they type in
 *
 * How search works in product.controllers.js:
 *  1. User types a query (Arabic or English)
 *  2. expandQuery() returns an array of equivalent terms
 *  3. Each term generates a LIKE %term% clause
 *  4. All terms within one word are OR'd (any match counts)
 *  5. Different words are AND'd (all words must match somehow)
 *
 * @example
 * expandQuery("ساعه")
 * // Returns: ["ساعه", "ساعه", "watch", "clock", "ساعه"] (normalized + English equivalents)
 */

/**
 * Bilingual keyword dictionary: Arabic search terms → [English equivalents]
 * Add more entries here to expand cross-language search coverage.
 *
 * @type {Object.<string, string[]>}
 */
const bilingualDictionary = {
  "ساعه": ["watch", "clock"],
  "ساعة": ["watch", "clock"],
  "هاتف": ["phone", "mobile"],
  "جوال": ["phone", "mobile", "galaxy", "iphone"],
  "موبايل": ["phone", "mobile"],
  "حاسوب": ["computer", "laptop"],
  "لابتوب": ["laptop", "computer"],
  "ملابس": ["clothing", "fashion", "clothes"],
  "أزياء": ["fashion", "clothing"],
  "حذاء": ["shoe", "sneaker", "footwear"],
  "عطر": ["perfume", "fragrance", "scent"],
  "شاحن": ["charger", "power"],
  "سماعه": ["headphone", "earphone", "audio"],
  "سماعة": ["headphone", "earphone", "audio"],
  "نظارة": ["glasses", "sunglasses", "eyewear"],
  "حقيبة": ["bag", "backpack", "handbag"],
  "تلفاز": ["tv", "television", "screen"],
  "شاشة": ["screen", "monitor", "display"],
};

/**
 * Normalizes an Arabic string to improve fuzzy matching.
 *
 * Transformations applied:
 *  - أ إ آ → ا   (normalize Alef with Hamza variants)
 *  - ة → ه       (normalize Taa Marbuta → Haa, e.g., "ساعة" = "ساعه")
 *  - ى → ي       (normalize Alef Maqsura → Yaa)
 *  - Remove diacritics (Tashkeel: Fatha, Kasra, Damma, Sukun, etc.)
 *
 * @param {string} text - Arabic (or mixed) text to normalize
 * @returns {string} Normalized lowercase text
 */
export const normalizeArabic = (text) => {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا")                      // Normalize Alef variants
    .replace(/ة/g, "ه")                           // Taa Marbuta → Haa
    .replace(/ى/g, "ي")                           // Alef Maqsura → Yaa
    .replace(/[\u064B-\u0652]/g, "")             // Remove all diacritics (Tashkeel range)
    .trim()
    .toLowerCase();
};

/**
 * Expands a search query into a set of equivalent search terms.
 *
 * The expansion includes:
 *  - The original query (preserved as-is)
 *  - The normalized Arabic version (removes diacritics, normalizes letters)
 *  - English equivalents from the bilingual dictionary (if any Arabic terms match)
 *
 * Returns a unique array (Set) to avoid duplicate LIKE clauses.
 *
 * @param {string} query - The raw user search input (Arabic or English)
 * @returns {string[]} Array of equivalent search terms to match against
 */
export const expandQuery = (query) => {
  const normalized = normalizeArabic(query);
  const words = normalized.split(/\s+/);

  // Start with both the raw and normalized form of the query
  let terms = new Set([query, normalized]);

  // Check each word against the bilingual dictionary
  words.forEach(word => {
    if (bilingualDictionary[word]) {
      bilingualDictionary[word].forEach(t => terms.add(t));
    }
  });

  return Array.from(terms);
};

/**
 * Sanitizes a search query for safe use in SQL LIKE clauses.
 *
 * Removes SQL LIKE wildcards (% and _) that users might type
 * to prevent unintended wildcard matches.
 *
 * @param {string} query - Raw user search input
 * @returns {string} Sanitized query safe for LIKE comparison
 *
 * @example
 * sanitizeSearch("shoes_%")  // → "shoes"
 */
export const sanitizeSearch = (query) => {
  return query.replace(/[%_]/g, "").trim();
};

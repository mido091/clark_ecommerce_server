/**
 * Search Helper Utility
 * Handles Arabic normalization and cross-language keyword mapping.
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
 * Normalizes Arabic text to improve search matching.
 * @param {string} text 
 * @returns {string}
 */
export const normalizeArabic = (text) => {
  if (!text) return "";
  return text
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[\u064B-\u0652]/g, "") // Remove diacritics (Tashkeel)
    .trim()
    .toLowerCase();
};

/**
 * Expands a search query into multiple related terms based on a bilingual dictionary.
 * @param {string} query 
 * @returns {string[]}
 */
export const expandQuery = (query) => {
  const normalized = normalizeArabic(query);
  const words = normalized.split(/\s+/);
  let terms = new Set([query, normalized]);

  words.forEach(word => {
    // Check dictionary
    if (bilingualDictionary[word]) {
      bilingualDictionary[word].forEach(t => terms.add(t));
    }
  });

  return Array.from(terms);
};

/**
 * Sanitizes search input by removing special SQL characters and extra whitespace.
 * @param {string} query 
 * @returns {string}
 */
export const sanitizeSearch = (query) => {
  return query.replace(/[%_]/g, "").trim();
};

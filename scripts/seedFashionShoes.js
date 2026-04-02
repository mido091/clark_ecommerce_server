import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import slugify from "slugify";
import { v2 as cloudinary } from "cloudinary";
import db from "../config/db.js";
import { ensureFinancialColumns } from "../utils/financialSchema.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const CLIENT_PUBLIC_DIR = path.resolve(__dirname, "../../client/public");
const ASSET_ROOT = path.join(CLIENT_PUBLIC_DIR, "seed-products");

cloudinary.config({
  cloud_name: process.env.CLD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
  secure: true,
});

const CATEGORY_DEFS = [
  {
    slug: "fashion",
    name: "Fashion",
    name_ar: "الملابس",
    icon: "shirt",
    image_url: "/seed-products/categories/fashion.svg",
  },
  {
    slug: "shoes",
    name: "Shoes",
    name_ar: "الأحذية",
    icon: "package",
    image_url: "/seed-products/categories/shoes.svg",
  },
];

const palette = {
  red: { name: "أحمر", value: "#C94A41", accent: "#F5D3CF" },
  black: { name: "أسود", value: "#23252B", accent: "#D7D9E0" },
  white: { name: "أبيض", value: "#F3F0EA", accent: "#D7CBB7" },
  navy: { name: "كحلي", value: "#273B64", accent: "#D3DBF0" },
  olive: { name: "زيتي", value: "#687345", accent: "#DEE2CF" },
  beige: { name: "بيج", value: "#D6B88E", accent: "#F6E8D1" },
  blue: { name: "أزرق", value: "#3F78C6", accent: "#D5E5FA" },
  grey: { name: "رمادي", value: "#8A8F99", accent: "#ECEEF2" },
  brown: { name: "بني", value: "#7A563C", accent: "#E7D4C6" },
  green: { name: "أخضر", value: "#2C7A5B", accent: "#D2EEE0" },
  burgundy: { name: "عنابي", value: "#7E3148", accent: "#F0D4DC" },
  sand: { name: "رملي", value: "#D0B183", accent: "#F7EBD7" },
};

const alphaSizes = ["S", "M", "L", "XL"];
const numericSizes = ["40", "41", "42", "43", "44"];

const products = [
  {
    slug: "oversized-cotton-tee",
    category: "fashion",
    type: "tee",
    name: "Oversized Cotton Tee",
    name_ar: "تيشيرت قطن أوفرسايز",
    description: "Relaxed heavyweight t-shirt with a clean streetwear silhouette and soft cotton finish.",
    description_ar: "تيشيرت قطن ثقيل بقصة مريحة وعصرية مناسب للاستخدام اليومي بطابع ستريت وير.",
    price: 690,
    old_price: 820,
    net_profit: 170,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["red", "black", "white"],
  },
  {
    slug: "essential-polo-shirt",
    category: "fashion",
    type: "polo",
    name: "Essential Polo Shirt",
    name_ar: "قميص بولو أساسي",
    description: "Smart casual polo with structured collar and breathable pique fabric.",
    description_ar: "بولو كاجوال أنيق بياقة ثابتة وخامة بيكيه مريحة للارتداء اليومي.",
    price: 760,
    old_price: 920,
    net_profit: 190,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["navy", "white", "olive"],
  },
  {
    slug: "relaxed-linen-shirt",
    category: "fashion",
    type: "shirt",
    name: "Relaxed Linen Shirt",
    name_ar: "قميص كتان مريح",
    description: "Lightweight linen shirt with airy construction for warm weather layering.",
    description_ar: "قميص كتان خفيف وعملي مناسب للصيف والإطلالات اليومية الهادئة.",
    price: 980,
    old_price: 1140,
    net_profit: 240,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["beige", "blue", "white"],
  },
  {
    slug: "zip-hoodie-core",
    category: "fashion",
    type: "hoodie",
    name: "Zip Hoodie Core",
    name_ar: "هودي بسحاب",
    description: "Fleece zip hoodie with roomy hood and ribbed finish for everyday comfort.",
    description_ar: "هودي عملي مبطن من الداخل مع سحاب وغطاء رأس واسع لراحة يومية.",
    price: 1150,
    old_price: 1390,
    net_profit: 280,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["grey", "black", "green"],
  },
  {
    slug: "crewneck-sweatshirt",
    category: "fashion",
    type: "sweatshirt",
    name: "Crewneck Sweatshirt",
    name_ar: "سويت شيرت ياقة دائرية",
    description: "Clean crewneck sweatshirt with brushed interior and versatile fit.",
    description_ar: "سويت شيرت بسيط ببطانة ناعمة من الداخل وقصة مناسبة للاستخدام اليومي.",
    price: 890,
    old_price: 1040,
    net_profit: 220,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["burgundy", "grey", "navy"],
  },
  {
    slug: "straight-fit-jeans",
    category: "fashion",
    type: "jeans",
    name: "Straight Fit Jeans",
    name_ar: "جينز ستريت فيت",
    description: "Classic straight fit denim with subtle wash and reliable daily wear feel.",
    description_ar: "بنطلون جينز بقصة مستقيمة وغسلة عملية مناسبة للارتداء اليومي.",
    price: 1240,
    old_price: 1490,
    net_profit: 310,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["blue", "black", "grey"],
  },
  {
    slug: "cargo-joggers",
    category: "fashion",
    type: "joggers",
    name: "Cargo Joggers",
    name_ar: "بنطلون كارغو جوجر",
    description: "Utility-inspired joggers with side pockets and tapered ankle shape.",
    description_ar: "جوجر عملي بجيوب جانبية وتفاصيل كارغو لإطلالة رياضية عصرية.",
    price: 990,
    old_price: 1190,
    net_profit: 250,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["olive", "black", "sand"],
  },
  {
    slug: "denim-jacket-classic",
    category: "fashion",
    type: "jacket",
    name: "Classic Denim Jacket",
    name_ar: "جاكيت جينز كلاسيك",
    description: "Layering staple with structured seams and timeless denim look.",
    description_ar: "جاكيت جينز أساسي بتفاصيل كلاسيكية مناسب فوق التيشيرت أو القميص.",
    price: 1490,
    old_price: 1750,
    net_profit: 360,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["blue", "black", "white"],
  },
  {
    slug: "knit-cardigan-soft",
    category: "fashion",
    type: "cardigan",
    name: "Soft Knit Cardigan",
    name_ar: "كارديجان ناعم",
    description: "Button cardigan with soft knit texture and polished casual mood.",
    description_ar: "كارديجان ناعم بأزرار وخامة مريحة لإطلالة هادئة وأنيقة.",
    price: 1080,
    old_price: 1260,
    net_profit: 260,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["beige", "brown", "olive"],
  },
  {
    slug: "lightweight-puffer-vest",
    category: "fashion",
    type: "vest",
    name: "Lightweight Puffer Vest",
    name_ar: "فيست مبطن خفيف",
    description: "Quilted puffer vest that adds warmth without heavy bulk.",
    description_ar: "فيست مبطن وخفيف يوفر دفئًا عمليًا بدون وزن زائد.",
    price: 1320,
    old_price: 1540,
    net_profit: 320,
    size_mode: "alpha",
    sizes: alphaSizes,
    colors: ["black", "navy", "sand"],
  },
  {
    slug: "running-sneakers-airflow",
    category: "shoes",
    type: "sneaker",
    name: "Airflow Running Sneakers",
    name_ar: "حذاء جري إيرفلو",
    description: "Breathable running sneaker with cushioned sole and sporty profile.",
    description_ar: "حذاء جري خفيف بتهوية ممتازة ونعل مريح للحركة اليومية والتمرين.",
    price: 1890,
    old_price: 2290,
    net_profit: 470,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["red", "black", "white"],
  },
  {
    slug: "retro-court-sneakers",
    category: "shoes",
    type: "court",
    name: "Retro Court Sneakers",
    name_ar: "سنيكرز ريترو كورت",
    description: "Court-inspired sneaker with contrast panels and clean vintage attitude.",
    description_ar: "سنيكرز بطابع كلاسيكي مستوحى من ملاعب التنس مع تفاصيل متباينة.",
    price: 1760,
    old_price: 2090,
    net_profit: 430,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["white", "blue", "green"],
  },
  {
    slug: "slip-on-canvas-shoes",
    category: "shoes",
    type: "canvas",
    name: "Slip-On Canvas Shoes",
    name_ar: "حذاء كانفاس سليب أون",
    description: "Easy slip-on canvas pair with lightweight comfort and casual finish.",
    description_ar: "حذاء كانفاس خفيف وسهل الارتداء مناسب للخروجات اليومية السريعة.",
    price: 980,
    old_price: 1160,
    net_profit: 240,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["black", "sand", "navy"],
  },
  {
    slug: "leather-loafers-premium",
    category: "shoes",
    type: "loafer",
    name: "Premium Leather Loafers",
    name_ar: "لوفر جلد فاخر",
    description: "Refined loafer with sleek upper and polished sole for smart styling.",
    description_ar: "لوفر جلد أنيق بتصميم نظيف مناسب للإطلالات الرسمية والكاجوال الراقية.",
    price: 2140,
    old_price: 2490,
    net_profit: 540,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["brown", "black", "beige"],
  },
  {
    slug: "trail-hiker-boots",
    category: "shoes",
    type: "boot",
    name: "Trail Hiker Boots",
    name_ar: "بوت تريل هايكر",
    description: "Outdoor-ready boot with rugged outsole and supportive collar.",
    description_ar: "بوت عملي بنعل متين ورقبة داعمة مناسب للمشي والاستخدام الخشن.",
    price: 2580,
    old_price: 2990,
    net_profit: 650,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["brown", "olive", "black"],
  },
  {
    slug: "chunky-lifestyle-sneakers",
    category: "shoes",
    type: "chunky",
    name: "Chunky Lifestyle Sneakers",
    name_ar: "سنيكرز تشانكي لايف ستايل",
    description: "Bold lifestyle sneaker with thick sole and modern streetwear proportions.",
    description_ar: "سنيكرز بتصميم تشانكي ونعل سميك لإطلالة ستريت وير واضحة.",
    price: 1980,
    old_price: 2360,
    net_profit: 490,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["white", "grey", "navy"],
  },
  {
    slug: "minimal-white-sneakers",
    category: "shoes",
    type: "minimal",
    name: "Minimal Leather Sneakers",
    name_ar: "سنيكرز جلد مينيمال",
    description: "Clean minimal sneaker for versatile looks from office casual to weekends.",
    description_ar: "سنيكرز جلد بسيط وسهل التنسيق من اللبس العملي إلى الكاجوال اليومي.",
    price: 2050,
    old_price: 2390,
    net_profit: 510,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["white", "black", "sand"],
  },
  {
    slug: "suede-desert-boots",
    category: "shoes",
    type: "desert",
    name: "Suede Desert Boots",
    name_ar: "بوت سويت دزرت",
    description: "Soft suede desert boot with understated shape and everyday flexibility.",
    description_ar: "بوت سويت ناعم بتصميم هادئ يناسب الاستخدام اليومي والإطلالات الذكية.",
    price: 2260,
    old_price: 2620,
    net_profit: 560,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["sand", "brown", "olive"],
  },
  {
    slug: "training-shoes-flex",
    category: "shoes",
    type: "trainer",
    name: "Flex Training Shoes",
    name_ar: "حذاء تدريب فليكس",
    description: "Stable training shoe with dynamic sole and breathable upper.",
    description_ar: "حذاء تدريب ثابت ومريح بسطح علوي جيد التهوية ونعل مرن.",
    price: 1670,
    old_price: 1980,
    net_profit: 410,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["blue", "black", "red"],
  },
  {
    slug: "casual-comfort-sandals",
    category: "shoes",
    type: "sandal",
    name: "Casual Comfort Sandals",
    name_ar: "صندل كاجوال مريح",
    description: "Double-strap sandal with cushioned base for relaxed summer wear.",
    description_ar: "صندل مريح بحزامين وقاعدة مبطنة مناسب للصيف والخروجات اليومية.",
    price: 880,
    old_price: 1040,
    net_profit: 210,
    size_mode: "numeric",
    sizes: numericSizes,
    colors: ["black", "brown", "sand"],
  },
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function hexToRgb(hex) {
  const clean = String(hex).replace("#", "");
  const full = clean.length === 3
    ? clean.split("").map((char) => `${char}${char}`).join("")
    : clean;
  const num = Number.parseInt(full, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function garmentShape(type, color, accent, view) {
  const shadow = rgba(color, 0.18);
  if (type === "tee" || type === "polo") {
    const collar = type === "polo"
      ? `<path d="M220 108 L256 138 L292 108 L302 144 L274 164 L256 152 L238 164 L210 144 Z" fill="${accent}" opacity="0.95" />`
      : `<path d="M230 122 Q256 94 282 122 Q273 140 256 140 Q239 140 230 122 Z" fill="${accent}" opacity="0.9" />`;
    return `
      <ellipse cx="256" cy="430" rx="120" ry="18" fill="${shadow}" />
      <path d="M164 154 L208 112 L228 136 L228 182 L284 182 L284 136 L304 112 L348 154 L326 214 L302 204 L302 388 L210 388 L210 204 L186 214 Z" fill="${color}" />
      ${collar}
      <path d="M210 204 L302 204" stroke="${accent}" stroke-width="8" opacity="0.55" />
      ${view === "detail" ? `<path d="M222 230 L290 230 M222 254 L290 254 M222 278 L290 278" stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.42" />` : ""}
    `;
  }

  if (type === "shirt" || type === "cardigan" || type === "jacket" || type === "vest" || type === "hoodie" || type === "sweatshirt") {
    const hasSleeves = type !== "vest";
    const body = hasSleeves
      ? `<path d="M164 154 L212 110 L236 150 L236 194 L276 194 L276 150 L300 110 L348 154 L326 220 L300 208 L300 392 L212 392 L212 208 L186 220 Z" fill="${color}" />`
      : `<path d="M200 118 L236 152 L236 392 L276 392 L276 152 L312 118 L332 160 L304 392 L208 392 L180 160 Z" fill="${color}" />`;
    const front = type === "cardigan" || type === "jacket" || type === "vest"
      ? `<path d="M252 150 L252 394" stroke="${accent}" stroke-width="10" />
         <circle cx="252" cy="212" r="5" fill="${rgba(accent, 0.85)}" />
         <circle cx="252" cy="246" r="5" fill="${rgba(accent, 0.85)}" />
         <circle cx="252" cy="280" r="5" fill="${rgba(accent, 0.85)}" />`
      : "";
    const hood = type === "hoodie"
      ? `<path d="M212 136 Q256 74 300 136 L288 194 L224 194 Z" fill="${rgba(accent, 0.92)}" />`
      : "";
    const pockets = type === "hoodie" || type === "jacket"
      ? `<path d="M208 272 Q252 310 296 272" stroke="${accent}" stroke-width="10" stroke-linecap="round" opacity="0.45" />`
      : "";
    return `
      <ellipse cx="256" cy="430" rx="128" ry="18" fill="${shadow}" />
      ${body}
      ${hood}
      ${front}
      ${pockets}
      <path d="M222 196 L290 196" stroke="${accent}" stroke-width="8" opacity="0.48" />
      ${view === "detail" ? `<rect x="208" y="214" width="96" height="150" rx="18" fill="${rgba(accent, 0.12)}" />` : ""}
    `;
  }

  if (type === "jeans" || type === "joggers") {
    const cuff = type === "joggers"
      ? `<rect x="202" y="388" width="34" height="18" rx="8" fill="${accent}" opacity="0.45" />
         <rect x="276" y="388" width="34" height="18" rx="8" fill="${accent}" opacity="0.45" />`
      : "";
    return `
      <ellipse cx="256" cy="430" rx="118" ry="18" fill="${shadow}" />
      <path d="M202 116 L310 116 L324 214 L298 404 L260 404 L252 278 L244 404 L206 404 L188 214 Z" fill="${color}" />
      <path d="M244 116 L252 278 L260 116" stroke="${accent}" stroke-width="8" opacity="0.48" />
      <path d="M206 154 L244 154 M268 154 L306 154" stroke="${accent}" stroke-width="7" opacity="0.4" />
      ${cuff}
      ${view === "detail" ? `<path d="M214 212 L238 304 M298 212 L274 304" stroke="${accent}" stroke-width="6" opacity="0.4" />` : ""}
    `;
  }

  return "";
}

function shoeShape(type, color, accent, view) {
  const shadow = rgba(color, 0.16);
  if (view === "top") {
    return `
      <ellipse cx="256" cy="430" rx="110" ry="16" fill="${shadow}" />
      <path d="M178 284 C196 208, 320 198, 340 284 C344 304, 332 334, 314 352 L286 380 L224 380 L196 352 C180 334, 170 306, 178 284 Z" fill="${color}" />
      <path d="M224 244 L288 244 L300 334 L212 334 Z" fill="${accent}" opacity="0.34" />
      <path d="M232 258 L280 258 M228 280 L284 280 M224 302 L288 302" stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.85" />
      <path d="M224 380 L288 380" stroke="#EDE9E0" stroke-width="14" stroke-linecap="round" />
    `;
  }

  const sole = `<path d="M150 334 Q188 374 246 374 L334 374 Q348 374 350 362 Q350 348 338 344 L314 338 Q284 332 258 314 L220 286 Q198 270 168 270 Q146 270 136 288 Q126 306 150 334 Z" fill="#F4EFE7" />`;
  const upper = type === "boot"
    ? `<path d="M154 324 L160 230 Q162 190 198 182 L246 176 Q286 174 298 204 L302 250 L316 262 Q344 286 336 334 L240 334 Q202 334 154 324 Z" fill="${color}" />`
    : type === "sandal"
      ? `<path d="M152 332 Q188 350 242 350 L316 350 Q334 350 334 336 Q334 324 316 320 L262 306 Q230 298 202 280 Q174 264 152 272 Q130 280 132 300 Q134 320 152 332 Z" fill="#E7D9C9" />
         <path d="M174 284 L238 284 Q256 284 280 294" stroke="${color}" stroke-width="22" stroke-linecap="round" />
         <path d="M186 314 L264 314" stroke="${accent}" stroke-width="18" stroke-linecap="round" />`
      : `<path d="M150 332 L188 260 Q202 232 238 230 L284 228 Q314 228 330 254 L350 288 Q360 308 336 336 L240 336 Q198 336 150 332 Z" fill="${color}" />`;
  const detailing = type === "loafer" || type === "desert"
    ? `<path d="M186 278 Q228 260 298 274" stroke="${accent}" stroke-width="8" opacity="0.65" />
       <path d="M194 304 Q242 286 314 304" stroke="${accent}" stroke-width="6" opacity="0.45" />`
    : `<path d="M190 270 L274 270 M182 290 L286 290 M176 310 L296 310" stroke="${accent}" stroke-width="6" stroke-linecap="round" opacity="0.72" />`;
  return `
    <ellipse cx="252" cy="426" rx="116" ry="16" fill="${shadow}" />
    ${upper}
    ${sole}
    ${detailing}
    <path d="M164 340 Q216 360 330 350" stroke="${rgba("#23252B", 0.18)}" stroke-width="6" stroke-linecap="round" />
  `;
}

function renderProductSvg(product, colorInfo, view) {
  const shortLabel = escapeXml(product.name.toUpperCase().slice(0, 18));
  const colorLabel = escapeXml(colorInfo.name);
  const artwork = product.category === "fashion"
    ? garmentShape(product.type, colorInfo.value, colorInfo.accent, view)
    : shoeShape(product.type, colorInfo.value, colorInfo.accent, view);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="768" height="768" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="40" fill="#F7F2EA" />
  <rect x="24" y="24" width="464" height="464" rx="30" fill="${colorInfo.accent}" opacity="0.42" />
  <circle cx="410" cy="104" r="52" fill="${colorInfo.value}" opacity="0.16" />
  <circle cx="108" cy="126" r="36" fill="${colorInfo.value}" opacity="0.12" />
  ${artwork}
  <rect x="48" y="48" width="144" height="34" rx="17" fill="#FFFFFF" opacity="0.92" />
  <text x="120" y="70" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="#5B4636">${view === "detail" ? "DETAIL VIEW" : "COLOR VIEW"}</text>
  <text x="256" y="458" text-anchor="middle" font-size="26" font-family="Arial, sans-serif" letter-spacing="2" fill="#4B3728">${shortLabel}</text>
  <text x="256" y="486" text-anchor="middle" font-size="22" font-family="Arial, sans-serif" fill="${colorInfo.value}">${colorLabel}</text>
</svg>`;
}

function renderCategorySvg(label, colorA, colorB) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="800" viewBox="0 0 1200 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="800" rx="48" fill="#F6F1E8"/>
  <rect x="52" y="52" width="1096" height="696" rx="40" fill="${colorA}" opacity="0.14"/>
  <circle cx="934" cy="188" r="132" fill="${colorB}" opacity="0.18"/>
  <circle cx="236" cy="602" r="118" fill="${colorB}" opacity="0.12"/>
  <text x="600" y="420" text-anchor="middle" font-size="112" font-family="Arial, sans-serif" fill="#6B4F36">${escapeXml(label)}</text>
</svg>`;
}

function stockForVariant(productIndex, colorIndex, sizeIndex) {
  return 4 + ((productIndex + 2) * (colorIndex + 3) + sizeIndex) % 7;
}

function buildImageUrls(product, colorKey) {
  return [
    path.join(ASSET_ROOT, product.slug, `${colorKey}-primary.svg`),
    path.join(ASSET_ROOT, product.slug, `${colorKey}-detail.svg`),
  ];
}

async function uploadAsset(localPath, publicId) {
  const result = await cloudinary.uploader.upload(localPath, {
    folder: "seed_products",
    public_id: publicId,
    resource_type: "image",
    overwrite: true,
    invalidate: true,
  });

  return result.secure_url;
}

function writeAssets() {
  ensureDir(ASSET_ROOT);
  ensureDir(path.join(ASSET_ROOT, "categories"));

  fs.writeFileSync(
    path.join(ASSET_ROOT, "categories", "fashion.svg"),
    renderCategorySvg("Fashion", "#C94A41", "#273B64"),
  );
  fs.writeFileSync(
    path.join(ASSET_ROOT, "categories", "shoes.svg"),
    renderCategorySvg("Shoes", "#7A563C", "#2C7A5B"),
  );

  for (const product of products) {
    const productDir = path.join(ASSET_ROOT, product.slug);
    ensureDir(productDir);

    for (const colorKey of product.colors) {
      const colorInfo = palette[colorKey];
      fs.writeFileSync(
        path.join(productDir, `${colorKey}-primary.svg`),
        renderProductSvg(product, colorInfo, "primary"),
      );
      fs.writeFileSync(
        path.join(productDir, `${colorKey}-detail.svg`),
        renderProductSvg(product, colorInfo, product.category === "fashion" ? "detail" : "top"),
      );
    }
  }
}

async function ensureCategory(connection, categoryDef) {
  const categoryAssetPath = path.join(
    ASSET_ROOT,
    "categories",
    `${categoryDef.slug}.svg`,
  );
  const categoryImageUrl = await uploadAsset(
    categoryAssetPath,
    `category-${categoryDef.slug}`,
  );

  const [existing] = await connection.query(
    "SELECT id FROM categories WHERE slug = ? LIMIT 1",
    [categoryDef.slug],
  );

  if (existing.length) {
    const categoryId = existing[0].id;
    await connection.query(
      `
        UPDATE categories
        SET name = ?, name_ar = ?, icon = ?, image_url = ?, is_active = 1
        WHERE id = ?
      `,
      [
        categoryDef.name,
        categoryDef.name_ar,
        categoryDef.icon,
        categoryImageUrl,
        categoryId,
      ],
    );
    return categoryId;
  }

  const [result] = await connection.query(
    `
      INSERT INTO categories (name, slug, name_ar, icon, image_url, is_active, sort_order)
      VALUES (?, ?, ?, ?, ?, 1, 0)
    `,
    [
      categoryDef.name,
      categoryDef.slug,
        categoryDef.name_ar,
        categoryDef.icon,
        categoryImageUrl,
      ],
    );
  return result.insertId;
}

async function upsertProduct(connection, categoryIds, product, productIndex) {
  const totalStock = product.colors.reduce(
    (sum, _colorKey, colorIndex) =>
      sum +
      product.sizes.reduce(
        (sizeSum, _size, sizeIndex) =>
          sizeSum + stockForVariant(productIndex, colorIndex, sizeIndex),
        0,
      ),
    0,
  );

  const [existingRows] = await connection.query(
    "SELECT id FROM products WHERE slug = ? LIMIT 1",
    [product.slug],
  );

  let productId = existingRows[0]?.id || null;

  if (productId) {
    await connection.query(
      `
        UPDATE products
        SET category_id = ?, name = ?, name_ar = ?, description = ?, description_ar = ?,
            price = ?, net_profit = ?, old_price = ?, stock = ?, size_mode = ?, is_active = 1
        WHERE id = ?
      `,
      [
        categoryIds[product.category],
        product.name,
        product.name_ar,
        product.description,
        product.description_ar,
        product.price,
        product.net_profit,
        product.old_price,
        totalStock,
        product.size_mode,
        productId,
      ],
    );
  } else {
    const [insertResult] = await connection.query(
      `
        INSERT INTO products (
          category_id, name, name_ar, slug, description, description_ar,
          price, net_profit, old_price, stock, size_mode, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        categoryIds[product.category],
        product.name,
        product.name_ar,
        product.slug,
        product.description,
        product.description_ar,
        product.price,
        product.net_profit,
        product.old_price,
        totalStock,
        product.size_mode,
      ],
    );
    productId = insertResult.insertId;
  }

  await connection.query("DELETE FROM product_images WHERE product_id = ?", [productId]);
  await connection.query("DELETE FROM product_variants WHERE product_id = ?", [productId]);
  await connection.query("DELETE FROM product_colors WHERE product_id = ?", [productId]);

  for (const [colorIndex, colorKey] of product.colors.entries()) {
    const colorInfo = palette[colorKey];
    const [colorResult] = await connection.query(
      `
        INSERT INTO product_colors (product_id, name, value, sort_order)
        VALUES (?, ?, ?, ?)
      `,
      [productId, colorInfo.name, colorInfo.value, colorIndex],
    );

    const productColorId = colorResult.insertId;
    const localImagePaths = buildImageUrls(product, colorKey);
    for (const [imageIndex, localImagePath] of localImagePaths.entries()) {
      const imageUrl = await uploadAsset(
        localImagePath,
        `${product.slug}-${colorKey}-${imageIndex === 0 ? "primary" : "detail"}`,
      );
      await connection.query(
        `
          INSERT INTO product_color_images (product_color_id, image_url, sort_order, is_main)
          VALUES (?, ?, ?, ?)
        `,
        [productColorId, imageUrl, imageIndex, imageIndex === 0 ? 1 : 0],
      );
    }

    for (const [sizeIndex, sizeValue] of product.sizes.entries()) {
      await connection.query(
        `
          INSERT INTO product_variants (product_id, product_color_id, size_value, stock)
          VALUES (?, ?, ?, ?)
        `,
        [
          productId,
          productColorId,
          String(sizeValue),
          stockForVariant(productIndex, colorIndex, sizeIndex),
        ],
      );
    }
  }
}

async function seedFashionShoes() {
  writeAssets();

  const connection = await db.getConnection();
  try {
    await ensureFinancialColumns(connection);
    await connection.beginTransaction();

    const categoryIds = {};
    for (const categoryDef of CATEGORY_DEFS) {
      categoryIds[categoryDef.slug] = await ensureCategory(connection, categoryDef);
    }

    for (const [productIndex, product] of products.entries()) {
      await upsertProduct(connection, categoryIds, product, productIndex);
    }

    await connection.commit();
    console.log(`Seeded ${products.length} fashion and shoes products successfully.`);
    console.log(`Assets written to: ${ASSET_ROOT}`);
  } catch (error) {
    await connection.rollback();
    console.error("Failed to seed fashion products:", error);
    process.exitCode = 1;
  } finally {
    connection.release();
    await db.end();
  }
}

seedFashionShoes();

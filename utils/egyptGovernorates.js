import { decodeHtmlEntities } from "./html.js";

export const DEFAULT_EGYPT_GOVERNORATES = [
  { key: "Cairo / القاهرة", value: 0, is_active: true },
  { key: "Giza / الجيزة", value: 0, is_active: true },
  { key: "Alexandria / الإسكندرية", value: 0, is_active: true },
  { key: "Dakahlia / الدقهلية", value: 0, is_active: true },
  { key: "Red Sea / البحر الأحمر", value: 0, is_active: true },
  { key: "Beheira / البحيرة", value: 0, is_active: true },
  { key: "Faiyum / الفيوم", value: 0, is_active: true },
  { key: "Gharbia / الغربية", value: 0, is_active: true },
  { key: "Ismailia / الإسماعيلية", value: 0, is_active: true },
  { key: "Monufia / المنوفية", value: 0, is_active: true },
  { key: "Minya / المنيا", value: 0, is_active: true },
  { key: "Qalyubia / القليوبية", value: 0, is_active: true },
  { key: "New Valley / الوادي الجديد", value: 0, is_active: true },
  { key: "Suez / السويس", value: 0, is_active: true },
  { key: "Aswan / أسوان", value: 0, is_active: true },
  { key: "Asyut / أسيوط", value: 0, is_active: true },
  { key: "Beni Suef / بني سويف", value: 0, is_active: true },
  { key: "Port Said / بورسعيد", value: 0, is_active: true },
  { key: "Damietta / دمياط", value: 0, is_active: true },
  { key: "Sharqia / الشرقية", value: 0, is_active: true },
  { key: "South Sinai / جنوب سيناء", value: 0, is_active: true },
  { key: "Kafr El Sheikh / كفر الشيخ", value: 0, is_active: true },
  { key: "Matrouh / مطروح", value: 0, is_active: true },
  { key: "Luxor / الأقصر", value: 0, is_active: true },
  { key: "Qena / قنا", value: 0, is_active: true },
  { key: "North Sinai / شمال سيناء", value: 0, is_active: true },
  { key: "Sohag / سوهاج", value: 0, is_active: true },
];

export function normalizeGovernorates(value) {
  let rawList = value;

  if (typeof rawList === "string") {
    try {
      rawList = JSON.parse(rawList);
    } catch {
      rawList = [];
    }
  }

  if (!Array.isArray(rawList) || rawList.length === 0) {
    return DEFAULT_EGYPT_GOVERNORATES.map((item) => ({ ...item }));
  }

  return rawList
    .map((item) => ({
      key: decodeHtmlEntities(String(item?.key || "").trim()),
      value: Number(item?.value || 0),
      is_active: item?.is_active !== false,
    }))
    .filter((item) => item.key)
    .map((item) => ({
      ...item,
      value: Number.isFinite(item.value) && item.value >= 0 ? item.value : 0,
    }));
}

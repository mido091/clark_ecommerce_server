export function decodeHtmlEntities(value) {
  if (typeof value !== "string" || !value) return value;

  let result = value;
  let previous = null;

  while (result !== previous) {
    previous = result;
    result = result
      .replace(/&amp;#x2F;/gi, "/")
      .replace(/&amp;/g, "&")
      .replace(/&#x([0-9a-f]+);/gi, (_match, hex) =>
        String.fromCharCode(parseInt(hex, 16)),
      )
      .replace(/&#([0-9]+);/g, (_match, dec) =>
        String.fromCharCode(parseInt(dec, 10)),
      )
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
  }

  return result;
}

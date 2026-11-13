/**
 * Parse Vietnamese rental price strings into integer VND.
 * Examples:
 *   "3tr5" -> 3500000
 *   "3,5 tr" -> 3500000
 *   "3.5 triệu" -> 3500000
 *   "4tr" -> 4000000
 *   "3500k" -> 3500000
 *   "3500000" -> 3500000
 *   "3.500.000" -> 3500000
 *   "3,5" -> 3500000 (when small number < 100)
 */
export function parsePrice(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 0) return 0;
    if (raw < 100) return Math.round(raw * 1_000_000);
    if (raw < 100_000) return Math.round(raw * 1_000);
    return Math.round(raw);
  }

  let text = String(raw).trim().toLowerCase();
  if (!text || /^-/.test(text)) return 0;

  // Strip currency words/symbols
  text = text.replace(/đồng|vnd|vnđ|đ|\/tháng|\/th|tháng/g, '').trim();
  if (!text || /^-/.test(text)) return 0;

  // Pattern like "3 triệu rưỡi"
  const ruoiMatch = text.match(/(\d+)\s*(?:tr|triệu|trieu)\s*(?:rưỡi|ruoi)/);
  if (ruoiMatch) {
    const millions = parseInt(ruoiMatch[1], 10);
    return Math.round((millions + 0.5) * 1_000_000);
  }

  // Pattern like "3tr5" or "3m5" or "3 triệu 5"
  const trSplitMatch = text.match(/(\d+)\s*(?:tr|triệu|trieu|m(?!2|²))\s*(\d+)/);
  if (trSplitMatch) {
    const millions = parseInt(trSplitMatch[1], 10);
    const fracStr = trSplitMatch[2];
    const divisor = Math.pow(10, fracStr.length);
    const decimal = parseInt(fracStr, 10) / divisor;
    return Math.round((millions + decimal) * 1_000_000);
  }

  // Pattern like "3.5tr", "3,5 triệu", "4tr"
  const trMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu|m(?!2|²))/);
  if (trMatch) {
    const num = parseFloat(trMatch[1].replace(',', '.'));
    return Number.isFinite(num) ? Math.round(num * 1_000_000) : 0;
  }

  // Pattern like "3500k" or "3.500k"
  const kMatch = text.match(/(\d+(?:[.,]\d+)?)\s*k/);
  if (kMatch) {
    const cleaned = kMatch[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? Math.round(num * 1_000) : 0;
  }

  // Formatted numbers like "3.500.000", "3,500,000", or thousands like "4.000", "6.400"
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) {
    const parsed = parseInt(text.replace(/[.,]/g, ''), 10) || 0;
    if (parsed > 0 && parsed < 100_000) {
      return parsed * 1_000;
    }
    return parsed;
  }

  // Plain number or decimal like "3.5" / "3,5" / "3500" / "3500000"
  const plain = parseFloat(text.replace(',', '.'));
  if (!Number.isFinite(plain) || plain <= 0) return 0;
  if (plain < 100) return Math.round(plain * 1_000_000);
  if (plain < 100_000) return Math.round(plain * 1_000);
  return Math.round(plain);
}

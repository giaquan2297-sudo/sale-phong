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
 *   "3.5 - 4tr" -> 3500000 (extracts min price)
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

  // Ignore Vietnamese phone numbers (e.g. "0865599604", "0982379505")
  if (/^0\d{8,10}$/.test(text.replace(/[\s.-]/g, ''))) return 0;

  // Handle range prices like "3.5tr - 4tr", "3.5 - 4tr", "3500k - 4000k"
  if (/[-~–—]/.test(text)) {
    const parts = text.split(/[-~–—]/);
    if (parts[0] && parts[0].trim()) {
      const minPart = parts[0].trim();
      // If minPart has no units (e.g. "3.5" in "3.5 - 4tr"), inherit unit from second part
      const unitMatch = parts[1]?.match(/(?:tr|triệu|trieu|k|m(?!2|²))/);
      const toParse = unitMatch && !/(?:tr|triệu|trieu|k|m)/.test(minPart)
        ? `${minPart}${unitMatch[0]}`
        : minPart;
      const parsedMin = parsePrice(toParse);
      if (parsedMin > 0) return parsedMin;
    }
  }

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

/**
 * Parse Vietnamese deposit strings into integer VND.
 * Handles month-based notations:
 *   "Cọc 1 tháng" / "1 tháng" / "1th" -> 1 * roomPrice
 *   "Cọc 2 tháng" / "2 tháng" -> 2 * roomPrice
 *   "Cọc 50%" / "nửa tháng" / "0.5 tháng" -> 0.5 * roomPrice
 *   Or fallback to numerical parsePrice ("3.5tr", "3000000")
 */
export function parseDeposit(raw, roomPrice = 0) {
  if (raw === null || raw === undefined) return roomPrice > 0 ? roomPrice : 0;
  const str = String(raw).trim().toLowerCase();
  if (!str) return roomPrice > 0 ? roomPrice : 0;

  // Month-based deposit notation
  if (/^(?:cọc\s*)?1\s*(?:tháng|th|t)\b/i.test(str) || str === '1 tháng' || str === '1th') {
    return roomPrice > 0 ? roomPrice : 0;
  }
  if (/^(?:cọc\s*)?2\s*(?:tháng|th|t)\b/i.test(str) || str === '2 tháng') {
    return roomPrice > 0 ? roomPrice * 2 : 0;
  }
  if (/^(?:cọc\s*)?3\s*(?:tháng|th|t)\b/i.test(str)) {
    return roomPrice > 0 ? roomPrice * 3 : 0;
  }
  if (str.includes('50%') || str.includes('nửa tháng') || str.includes('0.5 tháng') || str.includes('nua thang')) {
    return roomPrice > 0 ? Math.round(roomPrice * 0.5) : 0;
  }

  const parsed = parsePrice(raw);
  return parsed > 0 ? parsed : (roomPrice > 0 ? roomPrice : 0);
}

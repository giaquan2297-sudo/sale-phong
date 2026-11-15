export const ALLOWED_ROOM_STATUSES = ['trong', 'sap_trong', 'da_coc', 'da_thue'];
export const ALLOWED_CUSTOMER_STATUSES = [
  'chua_cham',
  'da_cham',
  'da_chot',
  'dang_tim',
  'da_thue',
  'tam_ngung',
  'huy',
];
export const ALLOWED_CUSTOMER_URGENCIES = ['gap', 'binh_thuong', 'hen_truoc'];
export const ALLOWED_CUSTOMER_SOURCES = ['manual', 'web_form'];
export const ALLOWED_COMMISSION_STATUSES = ['cho_thu', 'da_thu', 'thu_mot_phan'];

export function safeTrim(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Parse a strict positive safe integer ID (accepts positive integer or digit-only string).
 * Returns null for malformed values like "abc", "1abc", "-1", "0", "1.5".
 */
export function parsePositiveIntId(raw) {
  if (typeof raw === 'number') {
    return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    const num = Number(trimmed);
    return Number.isSafeInteger(num) && num > 0 ? num : null;
  }
  return null;
}

/**
 * Parse an optional non-negative integer field (e.g., price, deposit, budget).
 */
export function parseOptionalNonNegativeInt(raw, defaultValue = 0) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: defaultValue };
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) {
    return { ok: false, value: defaultValue };
  }
  return { ok: true, value: Math.round(num) };
}

/**
 * Parse an optional non-negative float field (e.g., area_m2).
 */
export function parseOptionalNonNegativeFloat(raw, defaultValue = null) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: defaultValue };
  }
  const num = Number(raw);
  if (!Number.isFinite(num) || num < 0) {
    return { ok: false, value: defaultValue };
  }
  return { ok: true, value: num };
}

/**
 * Parse a positive integer setting/parameter >= 1.
 */
export function parsePositiveInt(raw) {
  return parsePositiveIntId(raw);
}

/**
 * Naturally parses Vietnamese currency / rental budget strings or numbers into integer VND.
 * Examples: '3tr', '3tr5', '4tr2', '3.5tr', '3,5tr', '3500k', '4m', '3.5' (< 100 interpreted as millions), '3000000'.
 * Returns { ok: true, value: number } or { ok: false, value: defaultValue }.
 */
export function parseVietnameseCurrency(raw, defaultValue = null) {
  if (raw === undefined || raw === null || raw === '') {
    return { ok: true, value: defaultValue };
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw < 0) {
      return { ok: false, value: defaultValue };
    }
    if (raw === 0) return { ok: true, value: 0 };
    if (raw < 100) return { ok: true, value: Math.round(raw * 1_000_000) };
    if (raw < 100_000) return { ok: true, value: Math.round(raw * 1_000) };
    return { ok: true, value: Math.round(raw) };
  }

  if (typeof raw !== 'string') {
    return { ok: false, value: defaultValue };
  }

  let text = raw.trim().toLowerCase();
  if (text === '') {
    return { ok: true, value: defaultValue };
  }

  if (/^-/.test(text)) {
    return { ok: false, value: defaultValue };
  }

  // Strip currency / period words and symbols
  text = text.replace(/đồng|vnd|vnđ|đ|\/tháng|\/th|tháng/g, '').trim();
  if (!text || /^-/.test(text)) {
    return { ok: false, value: defaultValue };
  }

  // Pattern like "3 triệu rưỡi", "3tr rưỡi"
  const ruoiMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu)?\s*(?:rưỡi|ruoi)$/);
  if (ruoiMatch) {
    const millions = parseFloat(ruoiMatch[1].replace(',', '.'));
    if (Number.isFinite(millions) && millions >= 0) {
      return { ok: true, value: Math.round((millions + 0.5) * 1_000_000) };
    }
  }

  // Pattern like "3tr5" or "3m5" or "3 triệu 5" or "4tr2" or "3tr5k" or "3tr500k"
  const trSplitMatch = text.match(/^(\d+)\s*(?:tr|triệu|trieu|m)\s*(\d+)\s*k?$/);
  if (trSplitMatch) {
    const millions = parseInt(trSplitMatch[1], 10);
    const fracStr = trSplitMatch[2];
    const divisor = Math.pow(10, fracStr.length);
    const decimal = parseInt(fracStr, 10) / divisor;
    return { ok: true, value: Math.round((millions + decimal) * 1_000_000) };
  }

  // Pattern like "3.5tr", "3,5 triệu", "4tr", "4m"
  const trMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|trieu|m)$/);
  if (trMatch) {
    const num = parseFloat(trMatch[1].replace(',', '.'));
    if (Number.isFinite(num) && num >= 0) {
      return { ok: true, value: Math.round(num * 1_000_000) };
    }
  }

  // Pattern like "3500k" or "3.500k"
  const kMatch = text.match(/^(\d+(?:[.,]\d+)?)\s*k$/);
  if (kMatch) {
    const cleaned = kMatch[1].replace(/\.(?=\d{3}\b)/g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    if (Number.isFinite(num) && num >= 0) {
      return { ok: true, value: Math.round(num * 1_000) };
    }
  }

  // Formatted numbers like "3.500.000", "3,500,000", or thousands like "4.000", "6.400"
  if (/^\d{1,3}([.,]\d{3})+$/.test(text)) {
    const parsed = parseInt(text.replace(/[.,]/g, ''), 10) || 0;
    if (parsed > 0 && parsed < 100_000) {
      return { ok: true, value: parsed * 1_000 };
    }
    return { ok: true, value: parsed };
  }

  // Plain number or decimal like "3.5" / "3,5" / "3500" / "3000000" / "0"
  if (/^\d+([.,]\d+)?$/.test(text)) {
    const plain = parseFloat(text.replace(',', '.'));
    if (Number.isFinite(plain) && plain >= 0) {
      if (plain === 0) return { ok: true, value: 0 };
      if (plain < 100) return { ok: true, value: Math.round(plain * 1_000_000) };
      if (plain < 100_000) return { ok: true, value: Math.round(plain * 1_000) };
      return { ok: true, value: Math.round(plain) };
    }
  }

  return { ok: false, value: defaultValue };
}

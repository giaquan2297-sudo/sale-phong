export const ALLOWED_ROOM_STATUSES = ['trong', 'sap_trong', 'da_coc', 'da_thue'];
export const ALLOWED_CUSTOMER_STATUSES = [
  'chua_cham',
  'da_cham',
  'da_chot',
  'dang_tim',
  'da_thue',
  'tam_ngung',
];
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

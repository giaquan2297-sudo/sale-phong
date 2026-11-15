/**
 * Format integer VND as concise Vietnamese rental format, e.g. 3500000 -> "3,5 tr".
 */
export function formatPrice(vnd) {
  const num = Number(vnd);
  if (!Number.isFinite(num) || num <= 0) return 'Thoả thuận';
  if (num < 1_000_000) {
    return `${Math.round(num / 1000)}k`;
  }
  const millions = num / 1_000_000;
  const formatted = Number.isInteger(millions)
    ? String(millions)
    : millions.toFixed(2).replace(/0+$/, '').replace(/\.$/, '').replace('.', ',');
  return `${formatted} tr`;
}

export function formatBytes(bytes) {
  const b = Number(bytes) || 0;
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatVND(vnd) {
  const num = Number(vnd) || 0;
  return `${num.toLocaleString('vi-VN')} đ`;
}

export function formatDateOnly(value) {
  if (!value) return '—';
  const parts = String(value).split('T')[0].split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return String(value);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return String(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function daysAgoText(value) {
  if (!value) return '';
  const normalized = String(value).includes('T') ? value : String(value).replace(' ', 'T');
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return '';
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

/**
 * Naturally parse Vietnamese currency strings e.g. '3tr', '3tr5', '4tr2', '3.5tr', '3,5tr', '3500k', '4m', '3.5' (<100 = millions), '3000000'.
 * Returns integer VND value or null if invalid.
 */
export function parseVietnameseCurrency(raw) {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    if (raw < 100) return Math.round(raw * 1_000_000);
    return Math.round(raw);
  }
  let s = String(raw).trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/(đ|vnd|dong|đồng)/g, '').trim();
  s = s.replace(/\s+/g, '');
  if (!s) return null;

  // Pattern: 3tr, 3tr5, 4tr2, 3.5tr, 3,5tr, 4m, 4m2, 3 triệu, 3 củ
  const trMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*(?:tr(?:iệu|ieu)?|m|củ|cu)\s*(\d+)?$/);
  if (trMatch) {
    const base = parseFloat(trMatch[1].replace(',', '.'));
    if (!Number.isFinite(base)) return null;
    if (trMatch[2]) {
      const frac = parseInt(trMatch[2], 10) / Math.pow(10, trMatch[2].length);
      return Math.round((base + frac) * 1_000_000);
    }
    return Math.round(base * 1_000_000);
  }

  // Pattern: 3500k, 500k, 3k5
  const kMatch = s.match(/^(\d+(?:[.,]\d+)?)\s*k\s*(\d+)?$/);
  if (kMatch) {
    const base = parseFloat(kMatch[1].replace(',', '.'));
    if (!Number.isFinite(base)) return null;
    if (kMatch[2]) {
      const frac = parseInt(kMatch[2], 10) / Math.pow(10, kMatch[2].length);
      return Math.round((base + frac) * 1000);
    }
    return Math.round(base * 1000);
  }

  // Standard numbers with thousand separators: 3.000.000, 3,000,000
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) {
    const clean = s.replace(/[.,]/g, '');
    const val = parseInt(clean, 10);
    return Number.isFinite(val) && val > 0 ? val : null;
  }

  // Decimal number or plain integer: e.g. 3.5, 3,5, 4, 3000000
  const normalized = s.replace(',', '.');
  if (/^\d+(?:\.\d+)?$/.test(normalized)) {
    const val = parseFloat(normalized);
    if (!Number.isFinite(val) || val <= 0) return null;
    if (val < 100) {
      return Math.round(val * 1_000_000);
    }
    return Math.round(val);
  }

  return null;
}

/**
 * Format Vietnamese budget live preview, e.g. '≈ 3.500.000 đ'
 */
export function formatVietnameseBudgetPreview(raw) {
  const val = parseVietnameseCurrency(raw);
  if (!val || val <= 0) return '';
  return `≈ ${val.toLocaleString('vi-VN')} đ`;
}


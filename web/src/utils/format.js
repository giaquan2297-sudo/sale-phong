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

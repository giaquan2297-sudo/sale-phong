// Strategy 1: Universal Sheet Ingestion & Normalization Utilities for Cloudflare Edge

export const FIELD_SYNONYMS = {
  code: ['mã phòng', 'ma phong', 'số phòng', 'so phong', 'phòng', 'phong', 'p', 'căn', 'can', 'mã căn', 'ma can', 'mã p', 'ma p', 'tên phòng', 'stt'],
  address: ['địa chỉ', 'dia chi', 'đ/c', 'dc', 'vị trí', 'vi tri', 'toà nhà', 'toa nha', 'ngõ', 'ngo', 'số nhà', 'so nha', 'nhà', 'nha', 'địa chỉ toà nhà'],
  street: ['đường', 'duong', 'phố', 'pho', 'ngõ', 'ngo', 'ngách', 'ngach', 'tên đường', 'khu vực', 'khu vuc'],
  district: ['quận', 'quan', 'huyện', 'huyen', 'quận/huyện', 'khu vực', 'khu vuc'],
  price: ['giá', 'gia', 'giá thuê', 'gia thue', 'giá phòng', 'gia phong', 'giá net', 'gia net', 'tiền phòng', 'tien phong', 'mức giá', 'muc gia', 'price'],
  deposit: ['cọc', 'coc', 'tiền cọc', 'tien coc', 'đặt cọc', 'dat coc', 'deposit'],
  area: ['diện tích', 'dien tich', 'dt', 'm2', 'm²', 'diện tích (m2)', 's'],
  room_type: ['loại phòng', 'loai phong', 'kiểu phòng', 'kieu phong', 'kết cấu', 'ket cau', 'loại căn', 'loai can', 'loại hình', 'mô hình'],
  status: ['trạng thái', 'trang thai', 'tình trạng', 'tinh trang', 'hiện trạng', 'hien trang', 'tt', 'status', 'tình trạng phòng', 'còn/hết'],
  available_from: ['ngày vào', 'ngay vao', 'vào ở', 'vao o', 'thời gian vào', 'thoi gian vao', 'ở ngay', 'o ngay', 'dự kiến trống', 'du kien trong', 'hạn hợp đồng', 'ngày trống'],
  description: ['mô tả', 'mo ta', 'chi tiết', 'chi tiet', 'thông tin thêm', 'thong tin', 'ghi chú chung', 'ghi chu chung', 'đặc điểm', 'dac diem'],
  private_note: ['ghi chú riêng', 'ghi chu rieng', 'ghi chú', 'ghi chu', 'note', 'hoa hồng', 'hoa hong', 'hh', 'phí môi giới', 'liên hệ', 'sđt', 'sdt', 'chủ nhà'],
  amenities: ['nội thất', 'noi that', 'tiện ích', 'tien ich', 'đồ đạc', 'do dac', 'trang thiết bị', 'tiện nghi', 'dịch vụ'],
  electric_price: ['giá điện', 'gia dien', 'tiền điện', 'tien dien', 'điện', 'dien', 'số điện'],
  water_price: ['giá nước', 'gia nuoc', 'tiền nước', 'tien nuoc', 'nước', 'nuoc', 'khối nước'],
  images: ['ảnh', 'anh', 'hình ảnh', 'hinh anh', 'link ảnh', 'link anh', 'drive', 'link drive', 'ảnh phòng', 'hình', 'photo', 'photos'],
};

export const DISTRICTS = [
  'Cầu Giấy', 'Đống Đa', 'Thanh Xuân', 'Hai Bà Trưng', 'Ba Đình',
  'Tây Hồ', 'Hoàng Mai', 'Nam Từ Liêm', 'Bắc Từ Liêm', 'Hà Đông',
  'Long Biên', 'Hoàn Kiếm', 'Thanh Trì', 'Gia Lâm', 'Hoài Đức',
];

export function cleanNormalizeText(text) {
  return String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function detectDistrict(text) {
  if (!text) return '';
  const clean = cleanNormalizeText(text);
  for (const d of DISTRICTS) {
    const cleanD = cleanNormalizeText(d);
    if (clean.includes(cleanD)) {
      return d;
    }
  }
  return '';
}

export function parsePrice(raw) {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === 'number') {
    if (raw <= 0) return 0;
    if (raw < 100) return Math.round(raw * 1000000);
    return Math.round(raw);
  }
  const str = String(raw).trim().toLowerCase();
  if (!str) return 0;

  // Handle ranges like "3.5 - 4tr" -> pick lower bound
  const rangeMatch = str.match(/^([\d.,]+)\s*[-–~to]\s*([\d.,]+)\s*(?:tr|trieu|triệu|k|m)?/i);
  if (rangeMatch) {
    return parsePrice(rangeMatch[1] + (str.includes('k') ? 'k' : 'tr'));
  }

  // Handle "X triệu Y" / "XtrY"
  const complexMatch = str.match(/^(\d+)(?:tr|triệu|\.)\s*(\d+)(?:k|tr|)?$/i);
  if (complexMatch) {
    const main = parseInt(complexMatch[1], 10);
    let sub = parseInt(complexMatch[2], 10);
    if (sub < 10) sub *= 100000;
    else if (sub < 100) sub *= 10000;
    else if (sub < 1000) sub *= 1000;
    return main * 1000000 + sub;
  }

  const cleanNum = str.replace(/[^\d.,]/g, '').replace(',', '.');
  const num = parseFloat(cleanNum);
  if (isNaN(num) || num <= 0) return 0;

  if (/tr|triệu|trieu|m\b/i.test(str)) {
    return Math.round(num * 1000000);
  }
  if (/\bk\b/i.test(str)) {
    return Math.round(num * 1000);
  }
  if (num < 100) {
    return Math.round(num * 1000000);
  }
  return Math.round(num);
}

export function parseDeposit(raw, roomPrice = 0) {
  if (!raw) return roomPrice > 0 ? roomPrice : 0;
  if (typeof raw === 'number') {
    if (raw <= 0) return roomPrice;
    if (raw <= 10 && roomPrice > 0) return Math.round(raw * roomPrice);
    if (raw < 100) return Math.round(raw * 1000000);
    return Math.round(raw);
  }
  const str = String(raw).trim().toLowerCase();
  if (!str) return roomPrice;

  const percentMatch = str.match(/(\d+)\s*%/);
  if (percentMatch && roomPrice > 0) {
    return Math.round((parseFloat(percentMatch[1]) / 100) * roomPrice);
  }

  const monthMatch = str.match(/(?:cọc|coc)?\s*(\d+(?:[.,]\d+)?)\s*(?:tháng|thang|t)/i);
  if (monthMatch && roomPrice > 0) {
    const months = parseFloat(monthMatch[1].replace(',', '.'));
    if (!isNaN(months) && months > 0) {
      return Math.round(months * roomPrice);
    }
  }

  const parsed = parsePrice(raw);
  return parsed > 0 ? parsed : roomPrice;
}

export function parseAreaM2(rawArea) {
  if (!rawArea) return null;
  const str = String(rawArea).trim().toLowerCase().replace(/m2|m²|mét|met/gi, '');
  if (str.includes('+')) {
    const parts = str.split('+');
    let total = 0;
    for (const p of parts) {
      const num = parseFloat(p.replace(',', '.').replace(/[^\d.]/g, ''));
      if (Number.isFinite(num)) total += num;
    }
    return total > 0 ? Math.round(total * 10) / 10 : null;
  }
  const clean = str.replace(',', '.').replace(/[^\d.]/g, '');
  const num = parseFloat(clean);
  return Number.isFinite(num) && num > 0 ? num : null;
}

const UTILITY_SYNONYMS = [
  { match: /(?:^|[^\p{L}\p{N}])(?:dh|đh|dieu hoa|điều hoà|điều hòa|ac)(?:$|[^\p{L}\p{N}])/iu, label: 'Điều hoà' },
  { match: /(?:^|[^\p{L}\p{N}])(?:nl|nong lanh|nóng lạnh|bình nóng lạnh)(?:$|[^\p{L}\p{N}])/iu, label: 'Nóng lạnh' },
  { match: /(?:^|[^\p{L}\p{N}])(?:tl|tu lanh|tủ lạnh)(?:$|[^\p{L}\p{N}])/iu, label: 'Tủ lạnh' },
  { match: /(?:^|[^\p{L}\p{N}])(?:mg|may giat|máy giặt)(?:$|[^\p{L}\p{N}])/iu, label: 'Máy giặt' },
  { match: /(?:^|[^\p{L}\p{N}])(?:g|giuong|giường)(?:$|[^\p{L}\p{N}])/iu, label: 'Giường' },
  { match: /(?:^|[^\p{L}\p{N}])(?:t|tu|tủ|tu quan ao|tủ quần áo)(?:$|[^\p{L}\p{N}])/iu, label: 'Tủ quần áo' },
  { match: /(?:^|[^\p{L}\p{N}])(?:bc|ban cong|ban công)(?:$|[^\p{L}\p{N}])/iu, label: 'Ban công' },
  { match: /(?:^|[^\p{L}\p{N}])(?:cs|cua so|cửa sổ)(?:$|[^\p{L}\p{N}])/iu, label: 'Cửa sổ' },
  { match: /(?:^|[^\p{L}\p{N}])(?:bep|bếp|ke bep|kệ bếp|tu bep|tủ bếp)(?:$|[^\p{L}\p{N}])/iu, label: 'Kệ bếp' },
  { match: /(?:^|[^\p{L}\p{N}])(?:tm|thang may|thang máy)(?:$|[^\p{L}\p{N}])/iu, label: 'Thang máy' },
  { match: /(?:^|[^\p{L}\p{N}])(?:gx|gac xep|gác xép|gac lung|gác lửng)(?:$|[^\p{L}\p{N}])/iu, label: 'Gác xép' },
  { match: /(?:^|[^\p{L}\p{N}])(?:full|full do|full đồ|full noi that|full nội thất)(?:$|[^\p{L}\p{N}])/iu, label: 'Full nội thất' },
];

export function extractUtilitiesAndAmenities(text, existingAmenities = '') {
  const detected = new Set();
  if (existingAmenities) {
    existingAmenities.split(/[,;\n+]+/).forEach((item) => {
      const trimmed = item.trim();
      if (trimmed) detected.add(trimmed);
    });
  }
  const clean = String(text || '').trim();
  if (!clean) return Array.from(detected).join(', ');

  for (const { match, label } of UTILITY_SYNONYMS) {
    if (match.test(clean)) {
      detected.add(label);
    }
  }

  if (detected.size === 0) {
    clean.split(/[,;\n+]+/).forEach((part) => {
      const p = part.trim();
      if (p.length >= 2 && p.length <= 40) detected.add(p);
    });
  }

  return Array.from(detected).join(', ');
}

export function normalizeStatus(rawValue, statusRules = {}) {
  const text = String(rawValue || '').trim().toLowerCase();
  if (!text) return 'trong';

  for (const [pattern, targetStatus] of Object.entries(statusRules)) {
    if (pattern && text.includes(pattern.toLowerCase())) {
      return targetStatus;
    }
  }

  if (/(?:\d{1,2}\/\d{1,2}|trống từ|ra ngày|hết hạn|cuối tháng|đầu tháng|chuẩn bị ra|sắp ra|ở đến)/i.test(text)) {
    return 'sap_trong';
  }
  if (text.includes('đã thuê') || text.includes('da thue') || text.includes('đang ở') || text.includes('dang o') || text.includes('hết') || text.includes('full')) {
    return 'da_thue';
  }
  if (text.includes('cọc') || text.includes('coc')) {
    return 'da_coc';
  }
  if (text.includes('ct') || text.includes('chuẩn bị') || text.includes('chuan bi') || text.includes('sắp') || text.includes('sap') || text.includes('chờ') || text.includes('cho')) {
    return 'sap_trong';
  }
  return 'trong';
}

export function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  const text = String(csvText || '').replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export async function fetchPublicSheetRows(spreadsheetId, sheetName = 'Sheet1') {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const resp = await fetch(url, { redirect: 'follow' });
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  const body = await resp.text();

  if (!resp.ok || contentType.includes('text/html') || body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html')) {
    throw new Error('Google Sheet đang ở chế độ riêng tư. Vui lòng bật chia sẻ "Bất kỳ ai có đường liên kết đều xem được".');
  }

  return parseCsvRows(body);
}

export function detectHeaderRow(rows) {
  if (!rows || rows.length === 0) return 1;
  const maxScan = Math.min(rows.length, 10);
  let bestRowIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;
    let score = 0;
    const nonEmpty = row.filter((c) => String(c || '').trim().length > 0).length;
    if (nonEmpty < 2) continue;

    for (const cell of row) {
      const clean = cleanNormalizeText(cell);
      if (!clean) continue;
      for (const synonyms of Object.values(FIELD_SYNONYMS)) {
        if (synonyms.some((syn) => clean === syn || clean.includes(syn))) {
          score += 2;
        }
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = i;
    }
  }

  return bestScore >= 2 ? bestRowIndex + 1 : 1;
}

export function detectColumnMap(headers, sampleRows = []) {
  const map = {};
  if (!headers || headers.length === 0) return map;

  const headerIndices = headers.map((h, idx) => ({
    name: String(h || '').trim(),
    clean: cleanNormalizeText(h),
    index: idx,
  }));

  for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
    let matchedIndex = -1;
    let bestScore = 0;

    for (const h of headerIndices) {
      if (!h.clean) continue;
      for (const syn of synonyms) {
        if (h.clean === syn) {
          if (bestScore < 3) {
            bestScore = 3;
            matchedIndex = h.index;
          }
        } else if (h.clean.includes(syn) || syn.includes(h.clean)) {
          if (bestScore < 2) {
            bestScore = 2;
            matchedIndex = h.index;
          }
        }
      }
    }

    if (matchedIndex !== -1) {
      map[field] = headers[matchedIndex];
    }
  }

  return map;
}

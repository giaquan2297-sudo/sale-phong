import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { google } from 'googleapis';
import { GOOGLE_KEY_PATH } from '../db.js';
import { getGoogleAuthStatus, extractSpreadsheetId, parseCsvRows } from './sheetSync.js';

const execFileAsync = promisify(execFile);

let testInspectOptions = null;

export function setTestInspectOptions(opts) {
  testInspectOptions = opts;
}

export function resetTestInspectOptions() {
  testInspectOptions = null;
}

export const HEADER_KEYWORDS = [
  'mã phòng',
  'phòng',
  'mã căn',
  'số phòng',
  'căn',
  'stt',
  'địa chỉ',
  'tòa nhà',
  'đường',
  'khu vực',
  'tên tòa',
  'phố',
  'giá',
  'giá thuê',
  'giá phòng',
  'giá cho thuê',
  'trạng thái',
  'tình trạng',
  'hiện trạng',
  'diện tích',
  'dt',
  'm2',
  'nội thất',
  'tiện ích',
  'đồ',
  'ảnh',
  'link ảnh',
  'video',
  'cọc',
  'tiền cọc',
  'điện',
  'nước',
  'ngày trống',
  'thời gian vào',
  'ở luôn',
  'loại phòng',
];

export const FIELD_SYNONYMS = {
  code: ['mã phòng', 'phòng', 'mã căn', 'số phòng', 'căn', 'stt', 'mã'],
  street: ['đường', 'tòa nhà', 'địa chỉ', 'khu vực', 'tên tòa', 'phố', 'vị trí'],
  address: ['số nhà', 'địa chỉ cụ thể', 'ngõ', 'ngách'],
  district: ['quận', 'huyện', 'khu vực'],
  price: ['giá', 'giá thuê', 'giá phòng', 'giá cho thuê', 'giá ký hd', 'giá chốt'],
  deposit: ['cọc', 'tiền cọc', 'đặt cọc'],
  area_m2: ['diện tích', 'dt', 'm2', 'diện tich'],
  room_type: ['loại phòng', 'phân loại', 'loại căn', 'dạng phòng', 'loại'],
  amenities: ['nội thất', 'tiện ích', 'đồ', 'trang thiết bị', 'thiết bị nội thất', 'thiết bị'],
  electric_price: ['điện', 'giá điện', 'tiền điện'],
  water_price: ['nước', 'giá nước', 'tiền nước'],
  status: ['trạng thái', 'tình trạng', 'hiện trạng'],
  available_from: ['ngày trống', 'thời gian vào', 'ở luôn', 'hạn hợp đồng', 'trống từ'],
  description: ['mô tả', 'dịch vụ', 'ghi chú', 'thông tin tòa', 'ql nhà', 'quản lý', 'ql'],
  images: ['ảnh + video', 'ảnh+video', 'link ảnh', 'ảnh', 'ảnh phòng', 'drive', 'video', 'tiktok'],
};

function makeDistrictRegex(patterns) {
  const inner = patterns.join('|');
  return new RegExp(`(?:^|[^\\p{L}\\p{N}])(${inner})(?=[^\\p{L}\\p{N}]|$)`, 'iu');
}

export const DISTRICT_PATTERNS = [
  { district: 'Cầu Giấy', regex: makeDistrictRegex(['cầu giấy', 'cau giay', 'cg', 'trần duy hưng', 'trung hòa', 'dịch vọng', 'mai dịch', 'nghĩa tân', 'nghĩa đô', 'quan hoa', 'yên hòa']) },
  { district: 'Thanh Xuân', regex: makeDistrictRegex(['thanh xuân', 'thanh xuan', 'tx', 'khương đình', 'khương trung', 'nhân chính', 'nguyễn trãi']) },
  { district: 'Đống Đa', regex: makeDistrictRegex(['đống đa', 'dong da', 'đđ', 'dd', 'chùa láng', 'thái hà', 'xã đàn', 'hào nam']) },
  { district: 'Hai Bà Trưng', regex: makeDistrictRegex(['hai bà trưng', 'hai ba trung', 'hbt', 'bách khoa', 'minh khai', 'trương định']) },
  { district: 'Ba Đình', regex: makeDistrictRegex(['ba đình', 'ba dinh', 'bđ', 'bd', 'đội cấn', 'kim mã', 'giảng võ']) },
  { district: 'Hoàng Mai', regex: makeDistrictRegex(['hoàng mai', 'hoang mai', 'hm', 'định công', 'linh đàm', 'giáp bát']) },
  { district: 'Nam Từ Liêm', regex: makeDistrictRegex(['nam từ liêm', 'nam tu liem', 'ntl', 'mỹ đình', 'mễ trì', 'trung văn', 'đại mỗ', 'tây mỗ']) },
  { district: 'Bắc Từ Liêm', regex: makeDistrictRegex(['bắc từ liêm', 'bac tu liem', 'btl', 'cổ nhuế', 'nhổn', 'xuân đỉnh']) },
  { district: 'Tây Hồ', regex: makeDistrictRegex(['tây hồ', 'tay ho', 'th', 'lạc long quân', 'xuân la']) },
  { district: 'Hà Đông', regex: makeDistrictRegex(['hà đông', 'ha dong', 'hđ', 'hd', 'đô nghĩa', 'do nghia', 'văn quán', 'mỗ lao', 'la khê']) },
  { district: 'Long Biên', regex: makeDistrictRegex(['long biên', 'long bien', 'lb']) },
  { district: 'Hoàn Kiếm', regex: makeDistrictRegex(['hoàn kiếm', 'hoan kiem', 'hk']) },
  { district: 'Gia Lâm', regex: makeDistrictRegex(['gia lâm', 'gia lam', 'gl']) },
  { district: 'Hoài Đức', regex: makeDistrictRegex(['hoài đức', 'hoai duc']) },
  { district: 'Thanh Trì', regex: makeDistrictRegex(['thanh trì', 'thanh tri', 'tân triều', 'tan trieu', 'triều khúc', 'trieu khuc', 'yên xá', 'yen xa']) },
];

export function cleanNormalizeText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .normalize('NFC')
    .replace(/[\(\)\[\]\{\}\/\\,\.\-_:;!?'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detects header row by scanning first 20 rows to find the row with the most rental keywords.
 * Returns 1-based row index (1, 2, ...).
 */
export function detectHeaderRow(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return 1;

  const maxScan = Math.min(20, rows.length);
  let bestRowIdx = 0;
  let bestScore = 0;

  for (let r = 0; r < maxScan; r++) {
    const row = rows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    let score = 0;
    let matchedKwCount = 0;
    for (const cell of row) {
      const cellText = cleanNormalizeText(cell);
      if (!cellText) continue;

      for (const kw of HEADER_KEYWORDS) {
        const normKw = cleanNormalizeText(kw);
        if (cellText === normKw) {
          score += 4;
          matchedKwCount += 1;
        } else if (cellText.startsWith(normKw + ' ') || cellText.endsWith(' ' + normKw) || cellText.includes(' ' + normKw + ' ')) {
          score += 2;
          matchedKwCount += 1;
        } else if (cellText.includes(normKw) || normKw.includes(cellText)) {
          score += 1;
        }
      }
    }

    // Boost score if multiple distinct column headers are present on this row
    if (matchedKwCount >= 3) {
      score += matchedKwCount * 3;
    }

    if (score > bestScore) {
      bestScore = score;
      bestRowIdx = r;
    }
  }

  return bestScore > 0 ? bestRowIdx + 1 : 1;
}

/**
 * Intelligently generates column_map from header row strings.
 */
export function detectColumnMap(headers = []) {
  const columnMap = {};
  if (!Array.isArray(headers) || headers.length === 0) return columnMap;

  const candidates = [];

  headers.forEach((header, colIndex) => {
    const headerStr = String(header || '').trim();
    if (!headerStr) return;
    const normHeader = cleanNormalizeText(headerStr);
    if (!normHeader) return;

    for (const [field, synonyms] of Object.entries(FIELD_SYNONYMS)) {
      synonyms.forEach((syn, synIndex) => {
        const normSyn = cleanNormalizeText(syn);
        let score = 0;

        if (normHeader === normSyn) {
          score = 1000 - synIndex * 10;
        } else if (
          normHeader.startsWith(normSyn + ' ') ||
          normHeader.endsWith(' ' + normSyn) ||
          normHeader.includes(' ' + normSyn + ' ')
        ) {
          score = 800 - synIndex * 10 - Math.min(50, normHeader.length - normSyn.length);
        } else if (normHeader.startsWith(normSyn)) {
          score = 700 - synIndex * 10 - Math.min(50, normHeader.length - normSyn.length);
        } else if (normHeader.includes(normSyn)) {
          score = 550 - synIndex * 10 - Math.min(80, normHeader.length - normSyn.length);
        } else if (normSyn.includes(normHeader) && normHeader.length >= 3) {
          score = 400 - synIndex * 10;
        }

        if (score > 0) {
          candidates.push({ field, header: headerStr, colIndex, score, synIndex });
        }
      });
    }
  });

  candidates.sort((a, b) => b.score - a.score);

  const mappedFields = new Set();
  const claimedHeaders = new Set();

  for (const cand of candidates) {
    if (!mappedFields.has(cand.field) && !claimedHeaders.has(cand.header)) {
      columnMap[cand.field] = cand.header;
      mappedFields.add(cand.field);
      claimedHeaders.add(cand.header);
    }
  }

  // Address / street fallback: if headers has "Địa chỉ" and it was claimed by street,
  // but address is unmapped and there is another street column (e.g. "Tòa nhà" or "Đường"),
  // give "Địa chỉ" to address.
  if (!columnMap.address) {
    const diaChiHeader = headers.find((h) => cleanNormalizeText(h) === 'địa chỉ' || cleanNormalizeText(h) === 'địa chỉ cụ thể');
    if (diaChiHeader && columnMap.street && columnMap.street !== diaChiHeader) {
      columnMap.address = diaChiHeader;
    }
  }

  return columnMap;
}

/**
 * Detects district from sheet title or sample rows.
 */
export function detectDistrict(title = '', sampleRows = [], headers = [], columnMap = {}, selectedTab = '') {
  // 1. Check selectedTab first (most specific to current sheet/tab)
  if (selectedTab) {
    for (const pat of DISTRICT_PATTERNS) {
      if (pat.regex.test(selectedTab)) {
        return pat.district;
      }
    }
  }

  // 2. Check title
  const titleClean = String(title || '');
  for (const pat of DISTRICT_PATTERNS) {
    if (pat.regex.test(titleClean)) {
      return pat.district;
    }
  }

  // 3. Check sample rows
  const counts = new Map();
  DISTRICT_PATTERNS.forEach((p) => counts.set(p.district, 0));

  const rowsToCheck = Array.isArray(sampleRows) ? sampleRows.slice(0, 20) : [];
  for (const row of rowsToCheck) {
    let rowText = '';
    if (Array.isArray(row)) {
      rowText = row.join(' ');
    } else if (row && typeof row === 'object') {
      rowText = Object.values(row).join(' ');
    }
    if (!rowText) continue;

    for (const pat of DISTRICT_PATTERNS) {
      if (pat.regex.test(rowText)) {
        counts.set(pat.district, (counts.get(pat.district) || 0) + 1);
      }
    }
  }

  let bestDistrict = '';
  let maxCount = 0;
  for (const [district, count] of counts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      bestDistrict = district;
    }
  }

  return maxCount > 0 ? bestDistrict : '';
}

async function tryFetchPublicHtmlMetadata(spreadsheetId) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/htmlview`;
    const resp = await fetch(url, { redirect: 'follow' });
    if (!resp.ok) return null;
    const html = await resp.text();

    let title = '';
    const titleMatch = html.match(/<title>([^<]+?)(?:\s*-\s*Google\s*(?:Sheets|Trang tính))?<\/title>/i) ||
      html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
    }

    const tabs = [];
    const tabRegex = /<li id="sheet-button-[^"]*"[^>]*><a[^>]*>([^<]+)<\/a>/gi;
    let m;
    while ((m = tabRegex.exec(html)) !== null) {
      const tabTitle = m[1].trim();
      if (tabTitle && !tabs.includes(tabTitle)) {
        tabs.push(tabTitle);
      }
    }

    return { title, tabs };
  } catch {
    return null;
  }
}

async function tryGsheetsCliInfo(spreadsheetId) {
  try {
    const { stdout } = await execFileAsync('gsheets', ['readonly', 'info', spreadsheetId, '--json'], {
      timeout: 3500,
    });
    const parsed = JSON.parse(stdout);
    const title = parsed?.properties?.title || '';
    const tabs = (parsed?.sheets || [])
      .map((s) => s.properties?.title)
      .filter(Boolean);
    return { title, tabs };
  } catch {
    return null;
  }
}

export async function tryGsheetsCliRead(spreadsheetId, sheetName) {
  try {
    const range = sheetName ? `'${sheetName.replace(/'/g, "''")}'!A1:ZZ500` : 'A1:ZZ500';
    const { stdout } = await execFileAsync('gsheets', ['readonly', 'read-links', spreadsheetId, range, '--json'], {
      timeout: 10000,
    });
    const parsed = JSON.parse(stdout);
    if (Array.isArray(parsed?.values)) {
      return parsed.values;
    }
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fallback to regular read
    try {
      const range = sheetName ? `'${sheetName.replace(/'/g, "''")}'!A1:ZZ500` : 'A1:ZZ500';
      const { stdout } = await execFileAsync('gsheets', ['readonly', 'read', spreadsheetId, range, '--json'], {
        timeout: 10000,
      });
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed?.values)) return parsed.values;
      if (Array.isArray(parsed)) return parsed;
    } catch {}
  }
  return null;
}

async function fetchPublicSheetCsv(spreadsheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const resp = await fetch(url, { redirect: 'follow' });
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  const body = await resp.text();

  if (
    !resp.ok ||
    contentType.includes('text/html') ||
    body.trimStart().startsWith('<!DOCTYPE') ||
    body.trimStart().startsWith('<html')
  ) {
    const err = new Error(
      'Google Sheet đang ở chế độ riêng tư hoặc link không hợp lệ. Hãy bật chia sẻ "Bất kỳ ai có đường liên kết đều xem được" hoặc tải lên file google-key.json.'
    );
    err.status = 400;
    throw err;
  }

  return parseCsvRows(body);
}

/**
 * Inspect a Google Sheet URL or spreadsheet ID:
 * - Extracts spreadsheet ID.
 * - Discovers title and sheet tabs.
 * - Detects header row.
 * - Intelligently generates column_map.
 * - Detects district.
 * - Returns preview structure.
 */
export async function inspectSpreadsheet(urlOrId, options = {}) {
  const opts = { ...(testInspectOptions || {}), ...options };

  const spreadsheetId = extractSpreadsheetId(urlOrId);
  if (!spreadsheetId) {
    const err = new Error('Cần nhập Spreadsheet ID hoặc link Google Sheet hợp lệ');
    err.status = 400;
    throw err;
  }

  let title = opts.title || '';
  let tabs = Array.isArray(opts.tabs) && opts.tabs.length > 0 ? [...opts.tabs] : [];
  let rows = opts.rows || null;

  let sheetsClient = opts.sheetsClient || null;
  const authStatus = getGoogleAuthStatus();

  if (!sheetsClient && authStatus.configured) {
    try {
      const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      sheetsClient = google.sheets({ version: 'v4', auth });
    } catch {
      sheetsClient = null;
    }
  }

  // 1. Fetch metadata (title, tabs) if not supplied
  if (!title || tabs.length === 0) {
    if (opts.metadataFn) {
      try {
        const meta = await opts.metadataFn(spreadsheetId);
        if (meta?.title && !title) title = meta.title;
        if (Array.isArray(meta?.tabs) && tabs.length === 0) tabs = meta.tabs;
      } catch {
        // Fall back
      }
    }

    if ((!title || tabs.length === 0) && sheetsClient) {
      try {
        const meta = await sheetsClient.spreadsheets.get({
          spreadsheetId,
          fields: 'properties.title,sheets.properties.title',
        });
        if (!title) title = meta.data?.properties?.title || '';
        if (tabs.length === 0) {
          tabs = (meta.data?.sheets || [])
            .map((s) => s.properties?.title)
            .filter(Boolean);
        }
      } catch {
        // Fall back to gsheets CLI or public
      }
    }

    if (!title || tabs.length === 0) {
      const cliMeta = await tryGsheetsCliInfo(spreadsheetId);
      if (cliMeta) {
        if (!title && cliMeta.title) title = cliMeta.title;
        if (tabs.length === 0 && cliMeta.tabs.length > 0) tabs = cliMeta.tabs;
      }
    }

    if (!title || tabs.length === 0) {
      const htmlMeta = await tryFetchPublicHtmlMetadata(spreadsheetId);
      if (htmlMeta) {
        if (!title && htmlMeta.title) title = htmlMeta.title;
        if (tabs.length === 0 && htmlMeta.tabs.length > 0) tabs = htmlMeta.tabs;
      }
    }
  }

  if (tabs.length === 0) {
    tabs = [opts.sheetName || opts.sheet_name || 'Sheet1'];
  }
  if (!title) {
    title = `Bảng hàng ${spreadsheetId.slice(0, 8)}`;
  }

  const requestedTab = opts.sheetName || opts.sheet_name || null;
  const selectedTab = requestedTab || tabs[0] || 'Sheet1';

  // 2. Fetch rows for selectedTab if not supplied
  if (!rows) {
    if (opts.fetchPublicFn) {
      rows = await opts.fetchPublicFn(spreadsheetId, selectedTab);
    } else if (sheetsClient) {
      try {
        const resp = await sheetsClient.spreadsheets.get({
          spreadsheetId,
          ranges: [`'${selectedTab.replace(/'/g, "''")}'!A1:ZZ500`],
          fields: 'sheets(data(rowData(values(hyperlink,formattedValue,textFormatRuns(format(link(uri))))))))',
        });
        const rowData = resp.data?.sheets?.[0]?.data?.[0]?.rowData || [];
        rows = rowData.map((r) =>
          (r.values || []).map((cell) => {
            const link =
              cell.hyperlink ||
              cell.textFormatRuns?.find((run) => run.format?.link?.uri)?.format?.link?.uri;
            return link || cell.formattedValue || '';
          })
        );
      } catch {
        try {
          const resp = await sheetsClient.spreadsheets.values.get({
            spreadsheetId,
            range: `'${selectedTab.replace(/'/g, "''")}'!A1:ZZ100`,
          });
          rows = resp.data?.values || [];
        } catch {
          // Fall back to gsheets CLI or gviz CSV
        }
      }
    }

    if (!rows) {
      rows = await tryGsheetsCliRead(spreadsheetId, selectedTab);
    }

    if (!rows) {
      rows = await fetchPublicSheetCsv(spreadsheetId, selectedTab);
    }
  }

  if (!Array.isArray(rows)) {
    rows = [];
  }

  // 3. Detect header row
  const headerRow = detectHeaderRow(rows);
  const headerRowIndex = Math.max(0, headerRow - 1);
  const headers = (rows[headerRowIndex] || []).map((h) => String(h || '').trim());
  const dataRows = rows.slice(headerRowIndex + 1);

  // 4. Generate column_map
  const columnMap = detectColumnMap(headers);

  // 5. Sample rows
  const nonEmptyDataRows = dataRows.filter((r) => Array.isArray(r) && r.some((c) => String(c || '').trim()));
  const sampleRows = nonEmptyDataRows.slice(0, 6).map((row) => {
    const obj = {};
    headers.forEach((h, idx) => {
      const colName = h || `Cột ${idx + 1}`;
      obj[colName] = row[idx] !== undefined ? String(row[idx]).trim() : '';
    });
    return obj;
  });

  // 6. Detect district
  const suggestedDistrict = detectDistrict(title, sampleRows, headers, columnMap, selectedTab);

  return {
    spreadsheetId,
    title,
    tabs,
    selectedTab,
    headerRow,
    columnMap,
    sampleRows,
    suggestedDistrict,
  };
}

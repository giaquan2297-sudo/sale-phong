import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import db, { GOOGLE_KEY_PATH, IMAGES_DIR, getAllSettings } from '../db.js';
import { parsePrice } from './parsePrice.js';
import { broadcastEvent } from './sse.js';
import {
  detectHeaderRow,
  detectColumnMap,
  detectDistrict,
  HEADER_KEYWORDS,
  cleanNormalizeText,
  tryGsheetsCliRead,
} from './autoDetectSheet.js';
import {
  extractDriveFolderId,
  extractDriveFileId,
  downloadAndSaveRoomPhotos,
  downloadDriveImageBuffer,
} from './drivePhotoResolver.js';

let syncTimer = null;
let isSyncRunning = false;

const GOOGLE_KEY_INSTRUCTIONS = [
  'Tạo Service Account trên Google Cloud Console và bật Google Sheets API.',
  'Tạo khóa JSON (Keys -> Add Key -> Create new key -> JSON) và lưu thành file data/google-key.json.',
  'Chia sẻ (Share) Google Sheet của chủ nhà cho email Service Account (client_email trong file JSON) với quyền Xem (Viewer).',
  'Khởi động lại server hoặc bấm Đồng bộ ngay trên trang Google Sheets.',
];

export function getGoogleAuthStatus() {
  const exists = fs.existsSync(GOOGLE_KEY_PATH);
  if (!exists) {
    return {
      configured: false,
      exists: false,
      serviceAccountEmail: null,
      keyPath: GOOGLE_KEY_PATH,
      message: 'Chưa có file data/google-key.json. Đặt file Service Account JSON vào đúng đường dẫn để bật đồng bộ Google Sheets.',
      instructions: GOOGLE_KEY_INSTRUCTIONS,
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(GOOGLE_KEY_PATH, 'utf8'));
    const valid = Boolean(raw.client_email && raw.private_key);
    if (!valid) {
      return {
        configured: false,
        exists: true,
        serviceAccountEmail: raw.client_email || null,
        projectId: raw.project_id || null,
        keyPath: GOOGLE_KEY_PATH,
        error: 'File google-key.json thiếu client_email hoặc private_key hợp lệ.',
        message: 'File data/google-key.json chưa hợp lệ (thiếu client_email hoặc private_key).',
        instructions: GOOGLE_KEY_INSTRUCTIONS,
      };
    }
    return {
      configured: true,
      exists: true,
      serviceAccountEmail: raw.client_email,
      projectId: raw.project_id || null,
      keyPath: GOOGLE_KEY_PATH,
      message: 'Đã kết nối Google Service Account hợp lệ.',
      instructions: [],
    };
  } catch (err) {
    return {
      configured: false,
      exists: true,
      serviceAccountEmail: null,
      error: `File google-key.json không hợp lệ: ${err.message}`,
      message: 'File data/google-key.json không phải JSON hợp lệ.',
      instructions: GOOGLE_KEY_INSTRUCTIONS,
      keyPath: GOOGLE_KEY_PATH,
    };
  }
}

export function extractSpreadsheetId(input) {
  if (!input) return '';
  const trimmed = String(input).trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : trimmed;
}

function columnLetterToIndex(letter) {
  const clean = letter.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(clean)) return -1;
  let index = 0;
  for (let i = 0; i < clean.length; i++) {
    index = index * 26 + (clean.charCodeAt(i) - 64);
  }
  return index - 1;
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

function normalizeStatus(rawValue, statusRules = {}) {
  const text = String(rawValue || '').trim().toLowerCase();
  if (!text) return 'trong';

  for (const [pattern, targetStatus] of Object.entries(statusRules)) {
    if (pattern && text.includes(pattern.toLowerCase())) {
      return targetStatus;
    }
  }

  if (
    text.includes('đã thuê') ||
    text.includes('da thue') ||
    text.includes('đang ở') ||
    text.includes('dang o') ||
    text.includes('hết') ||
    text.includes('full')
  ) {
    return 'da_thue';
  }
  if (text.includes('cọc') || text.includes('coc')) {
    return 'da_coc';
  }
  if (
    text.includes('ct') ||
    text.includes('chuẩn bị') ||
    text.includes('chuan bi') ||
    text.includes('sắp') ||
    text.includes('sap') ||
    text.includes('chờ') ||
    text.includes('cho')
  ) {
    return 'sap_trong';
  }
  return 'trong';
}

function normalizeDriveImageUrl(url) {
  const trimmed = url.trim();
  if (!trimmed) return '';
  const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) {
    return `https://drive.google.com/uc?export=view&id=${fileMatch[1]}`;
  }
  const openMatch = trimmed.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (openMatch) {
    return `https://drive.google.com/uc?export=view&id=${openMatch[1]}`;
  }
  return trimmed;
}

function extractImageUrls(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\n,;]+/)
    .map((part) => normalizeDriveImageUrl(part))
    .filter((u) => /^https?:\/\//i.test(u));
}

function resolveCellValue(row, headers, mappingValue) {
  if (!mappingValue) return '';
  const key = String(mappingValue).trim();
  if (!key) return '';

  // Direct column letter like "A", "B", "AA" when prefixed or exact single/double uppercase letters not in headers
  const headerIndex = headers.findIndex(
    (h) => h.trim().toLowerCase() === key.toLowerCase()
  );
  if (headerIndex !== -1) {
    return row[headerIndex] ?? '';
  }

  const colIdx = columnLetterToIndex(key);
  if (colIdx >= 0 && colIdx < row.length) {
    return row[colIdx] ?? '';
  }
  return '';
}

export function saveGoogleServiceAccountKey(rawInput) {
  let parsed;
  if (typeof rawInput === 'string') {
    try {
      parsed = JSON.parse(rawInput);
    } catch {
      const err = new Error('Nội dung không phải JSON hợp lệ');
      err.status = 400;
      throw err;
    }
  } else if (rawInput && typeof rawInput === 'object' && !Array.isArray(rawInput)) {
    parsed = rawInput;
  } else {
    const err = new Error('Dữ liệu khoá Service Account không hợp lệ');
    err.status = 400;
    throw err;
  }

  if (!parsed.client_email || !parsed.private_key) {
    const err = new Error('File JSON thiếu trường client_email hoặc private_key của Google Service Account');
    err.status = 400;
    throw err;
  }

  fs.mkdirSync(path.dirname(GOOGLE_KEY_PATH), { recursive: true });
  fs.writeFileSync(GOOGLE_KEY_PATH, JSON.stringify(parsed, null, 2), { encoding: 'utf8', mode: 0o600 });
  startSyncScheduler();
  return getGoogleAuthStatus();
}

export function deleteGoogleServiceAccountKey() {
  if (fs.existsSync(GOOGLE_KEY_PATH)) {
    fs.rmSync(GOOGLE_KEY_PATH, { force: true });
  }
  startSyncScheduler();
  return getGoogleAuthStatus();
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

async function fetchPublicSheetRows(spreadsheetId, sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
    spreadsheetId
  )}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

  const resp = await fetch(url, { redirect: 'follow' });
  const contentType = (resp.headers.get('content-type') || '').toLowerCase();
  const body = await resp.text();

  if (!resp.ok || contentType.includes('text/html') || body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html')) {
    const err = new Error(
      'Google Sheet đang ở chế độ riêng tư. Hãy bật chia sẻ "Bất kỳ ai có đường liên kết đều xem được" hoặc tải lên file google-key.json.'
    );
    err.status = 400;
    throw err;
  }

  return parseCsvRows(body);
}

let testSyncOptions = null;

export function setTestSyncOptions(opts) {
  testSyncOptions = opts;
}

export function resetTestSyncOptions() {
  testSyncOptions = null;
}

export async function syncSheetSource(sourceId, options = {}) {
  const effectiveOpts = { ...(testSyncOptions || {}), ...options };
  const source = db.prepare('SELECT * FROM sheet_sources WHERE id = ?').get(sourceId);
  if (!source) {
    const notFoundErr = new Error('Không tìm thấy cấu hình Google Sheet');
    notFoundErr.status = 404;
    throw notFoundErr;
  }

  let sheetsApi = effectiveOpts.sheetsClient || null;
  let usePublicCsv = false;

  if (!sheetsApi) {
    const authStatus = getGoogleAuthStatus();
    if (authStatus.configured) {
      const auth = new google.auth.GoogleAuth({
        keyFile: GOOGLE_KEY_PATH,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
      sheetsApi = google.sheets({ version: 'v4', auth });
    } else {
      usePublicCsv = true;
    }
  }

  const logResult = db
    .prepare('INSERT INTO sync_logs (sheet_source_id, started_at) VALUES (?, datetime(\'now\', \'localtime\'))')
    .run(source.id);
  const logId = logResult.lastInsertRowid;

  let added = 0;
  let updated = 0;
  let removed = 0;

  try {
    const spreadsheetId = extractSpreadsheetId(source.spreadsheet_id);
    const sheetName = source.sheet_name || 'Sheet1';

    let rows;
    if (effectiveOpts.fetchPublicFn) {
      rows = await effectiveOpts.fetchPublicFn(spreadsheetId, sheetName);
    } else if (effectiveOpts.rows) {
      rows = effectiveOpts.rows;
    } else if (usePublicCsv) {
      rows = await tryGsheetsCliRead(spreadsheetId, sheetName);
      if (!rows) {
        rows = await fetchPublicSheetRows(spreadsheetId, sheetName);
      }
    } else {
      try {
        const resp = await sheetsApi.spreadsheets.get({
          spreadsheetId,
          ranges: [`'${sheetName.replace(/'/g, "''")}'!A1:ZZ500`],
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
        const response = await sheetsApi.spreadsheets.values.get({
          spreadsheetId,
          range: `'${sheetName.replace(/'/g, "''")}'`,
        });
        rows = response.data.values || [];
      }
    }
    const configuredRow = Math.max(0, (parseInt(source.header_row, 10) || 1) - 1);
    let activeHeaders = (rows[configuredRow] || []).map((h) => String(h || '').trim());

    let columnMap = {};
    let statusRules = {};
    try {
      columnMap = JSON.parse(source.column_map || '{}');
    } catch {
      columnMap = {};
    }
    try {
      statusRules = JSON.parse(source.status_rules || '{}');
    } catch {
      statusRules = {};
    }

    let activeColumnMap = { ...columnMap };
    if (Object.keys(activeColumnMap).length === 0 && activeHeaders.length > 0) {
      activeColumnMap = detectColumnMap(activeHeaders);
    }

    // Auto-detect header row if configured row has no columns mapped
    if (Object.keys(activeColumnMap).length === 0) {
      const bestHeaderIdx = detectHeaderRow(rows) - 1;
      if (bestHeaderIdx >= 0) {
        activeHeaders = (rows[bestHeaderIdx] || []).map((h) => String(h || '').trim());
        activeColumnMap = detectColumnMap(activeHeaders);
      }
    }

    let currentBuilding = { name: '', address: '', mapLink: '' };
    const seenRowKeys = new Set();
    const selectExisting = db.prepare(
      'SELECT * FROM rooms WHERE sheet_source_id = ? AND sheet_row_key = ?'
    );
    const insertRoom = db.prepare(`
      INSERT INTO rooms (
        landlord_id, code, address, street, district, price, deposit, area_m2,
        room_type, amenities, electric_price, water_price, status, available_from,
        description, private_note, source, sheet_source_id, sheet_row_key,
        created_at, updated_at, status_changed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, 'sheet', ?, ?,
        datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime')
      )
    `);
    const updateRoom = db.prepare(`
      UPDATE rooms SET
        landlord_id = ?,
        code = ?,
        address = ?,
        street = ?,
        district = ?,
        price = ?,
        deposit = ?,
        area_m2 = ?,
        room_type = ?,
        amenities = ?,
        electric_price = ?,
        water_price = ?,
        status = ?,
        available_from = ?,
        description = ?,
        private_note = CASE WHEN (private_note IS NULL OR private_note = '') AND ? != '' THEN ? ELSE private_note END,
        updated_at = datetime('now', 'localtime'),
        status_changed_at = CASE WHEN status != ? THEN datetime('now', 'localtime') ELSE status_changed_at END
      WHERE id = ?
    `);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.every((cell) => !String(cell || '').trim())) continue;

      const rowNumber = i + 1;
      const col0 = String(row[0] || '').trim();

      // Skip separator or FINISH rows
      if (col0 === '3' || row.some((c) => String(c).trim().toUpperCase() === 'FINISH')) {
        continue;
      }

      // 1. Column Header Row detection (repeating headers like "KHU VỰC", "PHÒNG", "GIÁ"...)
      const matchingKwCount = row.filter((c) => {
        const norm = cleanNormalizeText(c);
        return norm && HEADER_KEYWORDS.some((kw) => cleanNormalizeText(kw) === norm);
      }).length;

      const isColHeader = col0 === '2' || (col0 !== '4' && col0 !== '0' && matchingKwCount >= 3);
      if (isColHeader) {
        activeHeaders = row.map((h) => String(h || '').trim());
        activeColumnMap = { ...columnMap, ...detectColumnMap(activeHeaders) };
        continue;
      }

      // 2. Building Header Row detection (e.g. "NHÀ A4", "SỐ 7 NGÕ 20 TÂN TRIỀU", "VỊ TRÍ")
      const isBuildingRow =
        col0 === '4' ||
        (!isColHeader &&
          col0 !== '0' &&
          col0 !== '2' &&
          !row.some((c) => /^(?:trống|đang ở|đã thuê|cọc)/i.test(String(c).trim())) &&
          (row.some((c) => {
            const norm = cleanNormalizeText(c);
            if (!norm || norm === 'nhà cũ' || norm === 'nhà mới') return false;
            return /^(?:nhà|tòa|toà|ccmn|chung cư)\s+[a-z0-9]+/i.test(String(c).trim());
          }) ||
            row.some((c) => /^(?:số|ngõ|ngách|đường|phố|liền kề|kđt|lk)(?:\s+|:|$|[0-9])/i.test(String(c).trim()))));

      if (isBuildingRow) {
        const bNameCell = row.find((c) => {
          const norm = cleanNormalizeText(c);
          if (!norm || norm === 'nhà cũ' || norm === 'nhà mới') return false;
          return /^(?:nhà|tòa|toà|ccmn|chung cư)\s+[a-z0-9]+/i.test(String(c).trim());
        });
        const bAddrCell = row.find((c) =>
          /^(?:số|ngõ|ngách|đường|phố|liền kề|kđt|lk)(?:\s+|:|$|[0-9])/i.test(String(c).trim())
        );
        const bMapCell =
          row.find((c) => /https?:\/\/|maps\.google|goo\.gl/i.test(String(c).trim())) ||
          (row[14] && row[14] !== 'Link map' && !/^\d+$/.test(row[14]) ? row[14] : '');

        currentBuilding = {
          name: (bNameCell || row[4] || currentBuilding.name || '').trim(),
          address: (bAddrCell || row[7] || currentBuilding.address || '').trim(),
          mapLink: (bMapCell || '').trim(),
        };
        continue;
      }

      // Skip promotional banners or info rows before first header
      if (!activeHeaders.length || (matchingKwCount >= 2 && !row.some((c) => /^(?:trống|đang ở|ct\s*trống)/i.test(String(c).trim())))) {
        const rowStr = row.join(' ').toLowerCase();
        if (rowStr.includes('khuyến mãi') || rowStr.includes('giá dịch vụ') || rowStr.includes('tặng khách')) {
          continue;
        }
      }

      // 3. Room Data Row
      const rawCode = String(
        resolveCellValue(row, activeHeaders, activeColumnMap.code) || (col0 === '0' ? row[4] : '') || ''
      ).trim();
      let rawAddress = String(resolveCellValue(row, activeHeaders, activeColumnMap.address) || '').trim();
      let rawStreet = String(resolveCellValue(row, activeHeaders, activeColumnMap.street) || '').trim();

      if (!rawAddress && currentBuilding.address) {
        rawAddress = currentBuilding.address;
      }
      if (!rawStreet) {
        rawStreet = currentBuilding.name
          ? (rawAddress ? `${currentBuilding.name} - ${rawAddress}` : currentBuilding.name)
          : (rawAddress || currentBuilding.name || '');
      }

      let rawDistrict = String(
        resolveCellValue(row, activeHeaders, activeColumnMap.district) || (col0 === '0' ? row[3] : '') || ''
      ).trim();

      const rawPrice = resolveCellValue(row, activeHeaders, activeColumnMap.price) || (col0 === '0' ? row[7] : '');
      const rawDeposit = resolveCellValue(row, activeHeaders, activeColumnMap.deposit) || (col0 === '0' ? row[5] : '');
      const rawArea = resolveCellValue(row, activeHeaders, activeColumnMap.area_m2) || (col0 === '0' ? row[8] : '');
      const rawType =
        String(resolveCellValue(row, activeHeaders, activeColumnMap.room_type) || (col0 === '0' ? row[9] : '') || '').trim() ||
        'Khép kín';
      const rawAmenities = String(
        resolveCellValue(row, activeHeaders, activeColumnMap.amenities) || (col0 === '0' ? row[13] : '') || ''
      ).trim();
      const rawElectric = String(
        resolveCellValue(row, activeHeaders, activeColumnMap.electric_price) || ''
      ).trim();
      const rawWater = String(resolveCellValue(row, activeHeaders, activeColumnMap.water_price) || '').trim();
      const rawStatus = resolveCellValue(row, activeHeaders, activeColumnMap.status) || (col0 === '0' ? row[10] : '');
      const rawAvailableFrom = String(
        resolveCellValue(row, activeHeaders, activeColumnMap.available_from) || ''
      ).trim();
      let rawDesc = String(resolveCellValue(row, activeHeaders, activeColumnMap.description) || '').trim();
      if (!rawDesc && currentBuilding.name) {
        rawDesc = `Tòa: ${currentBuilding.name}`;
      }
      let rawImages = resolveCellValue(row, activeHeaders, activeColumnMap.images);
      if (!rawImages || (!extractDriveFolderId(rawImages) && !extractDriveFileId(rawImages))) {
        if (col0 === '0' && row[11]) {
          rawImages = row[11];
        }
      }

      const price = parsePrice(rawPrice);
      if (!rawCode && !rawStreet && !rawAddress && price <= 0) continue;
      if (rawCode.toLowerCase() === 'phòng' || rawCode.toLowerCase() === 'mã phòng') continue;

      // Inferred District
      const inferredDistrict =
        detectDistrict('', [[rawDistrict, rawStreet, rawAddress]], [], {}, '') ||
        source.default_district ||
        '';
      const district = inferredDistrict || rawDistrict || source.default_district || '';

      // Manager / Private Note
      let managerInfo = '';
      if (col0 === '0' && row[14]) {
        const m = String(row[14]).trim();
        if (m && !/^\d+$/.test(m) && m !== 'Link map') {
          managerInfo = m;
        }
      }
      let privateNote = '';
      if (managerInfo) {
        privateNote = `QL: ${managerInfo.replace(/\n+/g, ' - ')}`;
      }
      if (currentBuilding.mapLink) {
        privateNote = privateNote
          ? `${privateNote} | Vị trí: ${currentBuilding.mapLink}`
          : `Vị trí: ${currentBuilding.mapLink}`;
      }

      const buildingPart = (currentBuilding.name || rawAddress || rawStreet).toLowerCase().trim();
      let sheetRowKey = rawCode
        ? (buildingPart ? `${buildingPart}::${rawCode}` : rawCode)
        : `${buildingPart || 'row'}_${rowNumber}`;
      if (seenRowKeys.has(sheetRowKey)) {
        sheetRowKey = `${sheetRowKey}#${rowNumber}`;
      }
      seenRowKeys.add(sheetRowKey);

      const deposit = parsePrice(rawDeposit) || price;
      const areaM2 = parseAreaM2(rawArea);
      const status = normalizeStatus(rawStatus, statusRules);

      const existing = selectExisting.get(source.id, sheetRowKey);
      let roomId;

      if (!existing) {
        const res = insertRoom.run(
          source.landlord_id || null,
          rawCode || `SHEET-${rowNumber}`,
          rawAddress,
          rawStreet,
          district,
          price,
          deposit,
          areaM2,
          rawType,
          rawAmenities,
          rawElectric,
          rawWater,
          status,
          rawAvailableFrom,
          rawDesc,
          privateNote,
          source.id,
          sheetRowKey
        );
        roomId = res.lastInsertRowid;
        added += 1;
      } else {
        roomId = existing.id;
        updateRoom.run(
          source.landlord_id || existing.landlord_id,
          rawCode || existing.code,
          rawAddress || existing.address,
          rawStreet || existing.street,
          district || existing.district,
          price || existing.price,
          deposit || existing.deposit,
          areaM2 ?? existing.area_m2,
          rawType || existing.room_type,
          rawAmenities,
          rawElectric,
          rawWater,
          status,
          rawAvailableFrom,
          rawDesc,
          privateNote,
          privateNote,
          status,
          existing.id
        );
        updated += 1;
      }

      // Sync Google Drive real photos or generic remote URLs
      const driveFolderId = extractDriveFolderId(rawImages);
      const driveFileId = extractDriveFileId(rawImages);
      if (driveFolderId || driveFileId) {
        try {
          // Clear out previous generic placeholder photos for this room
          const existingPlaceholders = db
            .prepare("SELECT id, filename FROM images WHERE room_id = ? AND (filename LIKE 'room_%' OR filename = '')")
            .all(roomId);
          if (existingPlaceholders.length > 0) {
            const roomDir = path.join(IMAGES_DIR, String(roomId));
            for (const ph of existingPlaceholders) {
              if (ph.filename) {
                const phPath = path.join(roomDir, ph.filename);
                if (fs.existsSync(phPath)) fs.rmSync(phPath, { force: true });
              }
            }
            db.prepare("DELETE FROM images WHERE room_id = ? AND (filename LIKE 'room_%' OR filename = '')").run(roomId);
          }

          // Check if room already has real photos
          const realPhotoCount = db
            .prepare("SELECT COUNT(*) AS c FROM images WHERE room_id = ? AND filename LIKE 'real-%'")
            .get(roomId).c;

          if (realPhotoCount === 0) {
            await downloadAndSaveRoomPhotos(roomId, rawImages, { maxPhotos: 8 });
          }
        } catch (err) {
          console.warn(`Could not sync Drive photos for room ${roomId}:`, err.message);
        }
      } else {
        const remoteUrls = extractImageUrls(rawImages);
        if (remoteUrls.length > 0) {
          const existingRemotes = db
            .prepare("SELECT id, remote_url FROM images WHERE room_id = ? AND filename = ''")
            .all(roomId);
          const existingSet = new Set(existingRemotes.map((r) => r.remote_url));
          const hasAnyImage = db
            .prepare('SELECT COUNT(*) AS c FROM images WHERE room_id = ?')
            .get(roomId).c;

          const insertRemoteImg = db.prepare(`
            INSERT INTO images (room_id, filename, remote_url, size, width, height, is_cover, sort_order)
            VALUES (?, '', ?, 0, 0, 0, ?, ?)
          `);

          remoteUrls.forEach((url, idx) => {
            if (!existingSet.has(url)) {
              const isCover = hasAnyImage === 0 && idx === 0 ? 1 : 0;
              insertRemoteImg.run(roomId, url, isCover, idx);
            }
          });
        }
      }
    }

    // Any previously synced active room missing from the sheet is marked da_thue
    const previousRooms = db
      .prepare(
        "SELECT id, sheet_row_key FROM rooms WHERE sheet_source_id = ? AND status != 'da_thue'"
      )
      .all(source.id);

    const markRented = db.prepare(`
      UPDATE rooms
      SET status = 'da_thue',
          updated_at = datetime('now', 'localtime'),
          status_changed_at = datetime('now', 'localtime')
      WHERE id = ?
    `);

    for (const prev of previousRooms) {
      if (!seenRowKeys.has(prev.sheet_row_key)) {
        markRented.run(prev.id);
        removed += 1;
      }
    }

    db.prepare(
      "UPDATE sheet_sources SET last_synced_at = datetime('now', 'localtime'), last_error = '' WHERE id = ?"
    ).run(source.id);

    db.prepare(
      "UPDATE sync_logs SET finished_at = datetime('now', 'localtime'), added = ?, updated = ?, removed = ?, error = '' WHERE id = ?"
    ).run(added, updated, removed, logId);

    broadcastEvent('sheet_synced', {
      sheetSourceId: source.id,
      added,
      updated,
      removed,
    });

    return { added, updated, removed };
  } catch (err) {
    const errMsg = err?.message || 'Lỗi không xác định khi đồng bộ Google Sheet';
    db.prepare('UPDATE sheet_sources SET last_error = ? WHERE id = ?').run(errMsg, source.id);
    db.prepare(
      "UPDATE sync_logs SET finished_at = datetime('now', 'localtime'), added = ?, updated = ?, removed = ?, error = ? WHERE id = ?"
    ).run(added, updated, removed, errMsg, logId);

    broadcastEvent('sheet_sync_error', {
      sheetSourceId: source.id,
      error: errMsg,
    });

    throw err;
  }
}

export async function syncAllEnabledSheets() {
  if (isSyncRunning) return { skipped: true };
  isSyncRunning = true;
  try {
    const sources = db.prepare('SELECT id FROM sheet_sources WHERE enabled = 1').all();
    const results = [];
    for (const s of sources) {
      try {
        const res = await syncSheetSource(s.id);
        results.push({ id: s.id, ok: true, ...res });
      } catch (err) {
        results.push({ id: s.id, ok: false, error: err.message });
      }
    }
    return { skipped: false, results };
  } finally {
    isSyncRunning = false;
  }
}

/**
 * Download remote_url images into data/images/<roomId>/ on demand
 * when user wants to open folder and drag-and-drop into Zalo PC.
 */
export async function ensureRoomImagesLocal(roomId) {
  const remoteImages = db
    .prepare("SELECT * FROM images WHERE room_id = ? AND filename = '' AND remote_url != ''")
    .all(roomId);

  if (remoteImages.length === 0) return { downloaded: 0 };

  const roomDir = path.join(IMAGES_DIR, String(roomId));
  fs.mkdirSync(roomDir, { recursive: true });

  let downloaded = 0;
  for (const img of remoteImages) {
    try {
      const driveFileId = extractDriveFileId(img.remote_url);
      if (driveFileId) {
        const dl = await downloadDriveImageBuffer(driveFileId, { name: 'photo' });
        if (dl && dl.buffer) {
          const ext = dl.ext || '.jpg';
          const filename = `real-${driveFileId}${ext}`;
          fs.writeFileSync(path.join(roomDir, filename), dl.buffer);
          db.prepare('UPDATE images SET filename = ?, size = ? WHERE id = ?').run(
            filename,
            dl.buffer.length,
            img.id
          );
          downloaded += 1;
          continue;
        }
      }

      const response = await fetch(img.remote_url);
      if (!response.ok) continue;
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) continue;

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const ext = contentType.includes('png') ? 'png' : 'jpg';
      const filename = `sheet-${img.id}-${Date.now()}.${ext}`;
      fs.writeFileSync(path.join(roomDir, filename), buffer);

      db.prepare('UPDATE images SET filename = ?, size = ? WHERE id = ?').run(
        filename,
        buffer.length,
        img.id
      );
      downloaded += 1;
    } catch {
      // Skip failed remote downloads gracefully
    }
  }

  return { downloaded };
}

export function startSyncScheduler() {
  stopSyncScheduler();
  const settings = getAllSettings();
  const minutes = Math.max(1, parseInt(settings.sync_interval_minutes || '3', 10) || 3);

  syncTimer = setInterval(() => {
    const enabledCount = db
      .prepare('SELECT COUNT(*) AS count FROM sheet_sources WHERE enabled = 1')
      .get().count;
    if (enabledCount > 0) {
      syncAllEnabledSheets().catch(() => {});
    }
  }, minutes * 60 * 1000);
}

export function stopSyncScheduler() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
  }
}

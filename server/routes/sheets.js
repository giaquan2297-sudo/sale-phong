import { Router } from 'express';
import multer from 'multer';
import db from '../db.js';
import {
  deleteGoogleServiceAccountKey,
  extractSpreadsheetId,
  getGoogleAuthStatus,
  saveGoogleServiceAccountKey,
  syncAllEnabledSheets,
  syncSheetSource,
} from '../services/sheetSync.js';
import { inspectSpreadsheet } from '../services/autoDetectSheet.js';
import { broadcastEvent } from '../services/sse.js';
import { isPlainObject, parsePositiveInt, parsePositiveIntId, safeTrim } from '../utils/validation.js';

const router = Router();
const uploadMemory = multer({
  limits: { fileSize: 1024 * 1024 },
});

function parseJsonObjectField(raw, defaultObj = {}) {
  if (raw === undefined) return { ok: true, value: JSON.stringify(defaultObj) };
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw || '{}');
      if (!isPlainObject(parsed)) return { ok: false };
      return { ok: true, value: JSON.stringify(parsed) };
    } catch {
      return { ok: false };
    }
  }
  if (isPlainObject(raw)) {
    return { ok: true, value: JSON.stringify(raw) };
  }
  return { ok: false };
}

router.get('/', (req, res) => {
  const sources = db
    .prepare(
      `
      SELECT
        s.*,
        l.name AS landlord_name,
        (SELECT COUNT(*) FROM rooms r WHERE r.sheet_source_id = s.id) AS room_count
      FROM sheet_sources s
      LEFT JOIN landlords l ON l.id = s.landlord_id
      ORDER BY s.id DESC
    `
    )
    .all();

  const logs = db
    .prepare(
      `
      SELECT sl.*, ss.name AS source_name, ss.sheet_name
      FROM sync_logs sl
      JOIN sheet_sources ss ON ss.id = sl.sheet_source_id
      ORDER BY sl.id DESC
      LIMIT 40
    `
    )
    .all();

  res.json({
    auth: getGoogleAuthStatus(),
    sources,
    logs,
  });
});

router.post('/google-key', uploadMemory.single('file'), (req, res, next) => {
  try {
    let rawKey = null;
    if (req.file?.buffer) {
      rawKey = req.file.buffer.toString('utf8');
    } else if (req.body?.json !== undefined) {
      rawKey = req.body.json;
    } else if (req.body?.client_email && req.body?.private_key) {
      rawKey = req.body;
    }

    if (!rawKey) {
      return res.status(400).json({ error: 'Vui lòng tải file JSON hoặc dán nội dung google-key.json' });
    }

    const auth = saveGoogleServiceAccountKey(rawKey);
    res.json({ ok: true, auth });
  } catch (err) {
    next(err);
  }
});

router.delete('/google-key', (req, res) => {
  const auth = deleteGoogleServiceAccountKey();
  res.json({ ok: true, auth });
});

router.post('/inspect', async (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const b = req.body || {};
  const url = safeTrim(b.url || b.spreadsheet_id);
  if (!url) {
    return res.status(400).json({ error: 'Vui lòng nhập link Google Sheet hoặc Spreadsheet ID' });
  }

  try {
    const sheetName = safeTrim(b.sheet_name || b.sheetName);
    const result = await inspectSpreadsheet(url, {
      sheetName,
      ...(b.mock_options || {}),
    });
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Không thể đọc dữ liệu Google Sheet' });
  }
});

router.post('/quick-add', async (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const b = req.body || {};
  const url = safeTrim(b.url || b.spreadsheet_id);
  if (!url) {
    return res.status(400).json({ error: 'Vui lòng nhập link Google Sheet hoặc Spreadsheet ID' });
  }

  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'Spreadsheet ID không hợp lệ' });
  }

  try {
    let landlordId = null;
    if (b.landlord_id !== undefined && b.landlord_id !== null && b.landlord_id !== '') {
      landlordId = parsePositiveIntId(b.landlord_id);
      if (!landlordId) {
        return res.status(400).json({ error: 'ID chủ nhà không hợp lệ' });
      }
      const foundLandlord = db.prepare('SELECT id FROM landlords WHERE id = ?').get(landlordId);
      if (!foundLandlord) {
        return res.status(400).json({ error: 'Chủ nhà không tồn tại' });
      }
    } else if (b.landlord_name !== undefined && b.landlord_name !== null && safeTrim(b.landlord_name)) {
      const cleanLandlordName = safeTrim(b.landlord_name);
      const existing = db
        .prepare('SELECT id FROM landlords WHERE LOWER(TRIM(name)) = LOWER(?)')
        .get(cleanLandlordName);
      if (existing) {
        landlordId = existing.id;
      } else {
        const ins = db
          .prepare(
            `INSERT INTO landlords (name, phone, zalo, note, created_at, updated_at)
             VALUES (?, '', '', '', datetime('now', 'localtime'), datetime('now', 'localtime'))`
          )
          .run(cleanLandlordName);
        landlordId = ins.lastInsertRowid;
        broadcastEvent('landlords_changed', { action: 'created', landlordId });
      }
    }

    const columnMapProvided =
      b.column_map !== undefined &&
      b.column_map !== null &&
      ((isPlainObject(b.column_map) && Object.keys(b.column_map).length > 0) ||
        (typeof b.column_map === 'string' && b.column_map.trim().length > 2));

    let detected = null;
    const headerRowProvided = b.header_row !== undefined && b.header_row !== '' && b.header_row !== null;
    if (!columnMapProvided || !safeTrim(b.name) || !safeTrim(b.default_district) || !headerRowProvided) {
      try {
        detected = await inspectSpreadsheet(url, {
          sheetName: safeTrim(b.sheet_name),
          ...(b.mock_options || {}),
        });
      } catch (inspectErr) {
        if (!columnMapProvided) {
          throw inspectErr;
        }
      }
    }

    let columnMapVal = {};
    if (columnMapProvided) {
      const resMap = parseJsonObjectField(b.column_map, {});
      if (!resMap.ok) {
        return res.status(400).json({ error: 'column_map phải là JSON object hợp lệ' });
      }
      columnMapVal = JSON.parse(resMap.value);
    } else if (detected?.columnMap) {
      columnMapVal = detected.columnMap;
    }

    const name = safeTrim(b.name) || detected?.title || `Bảng hàng ${spreadsheetId.slice(0, 8)}`;
    const sheetName = safeTrim(b.sheet_name) || detected?.selectedTab || 'Sheet1';

    let headerRow = 1;
    if (b.header_row !== undefined && b.header_row !== '' && b.header_row !== null) {
      headerRow = parsePositiveInt(b.header_row);
      if (!headerRow) {
        return res.status(400).json({ error: 'header_row phải là số nguyên dương' });
      }
    } else if (detected?.headerRow) {
      headerRow = detected.headerRow;
    }

    const defaultDistrict = safeTrim(b.default_district) || detected?.suggestedDistrict || '';

    const statusRulesRes = parseJsonObjectField(b.status_rules, {});
    if (!statusRulesRes.ok) {
      return res.status(400).json({ error: 'status_rules phải là JSON object hợp lệ' });
    }

    const insertResult = db
      .prepare(
        `
        INSERT INTO sheet_sources (
          landlord_id, name, spreadsheet_id, sheet_name, header_row,
          column_map, status_rules, default_district, enabled
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `
      )
      .run(
        landlordId,
        name,
        spreadsheetId,
        sheetName,
        headerRow,
        JSON.stringify(columnMapVal),
        statusRulesRes.value,
        defaultDistrict
      );

    const sourceId = insertResult.lastInsertRowid;
    const source = db.prepare('SELECT * FROM sheet_sources WHERE id = ?').get(sourceId);

    let syncResult;
    try {
      syncResult = await syncSheetSource(sourceId, b.mock_options || {});
    } catch (syncErr) {
      return res.status(syncErr.status || 400).json({
        ok: false,
        error: `Đã lưu cấu hình bảng hàng nhưng đồng bộ thất bại: ${syncErr.message}`,
        source,
      });
    }

    const message = `Đã thêm bảng hàng và đồng bộ thành công ${syncResult.added} phòng mới${
      syncResult.updated > 0 ? `, cập nhật ${syncResult.updated} phòng` : ''
    }!`;

    res.status(201).json({
      ok: true,
      source,
      syncResult,
      message,
    });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message || 'Lỗi khi thêm nhanh bảng hàng' });
  }
});

router.post('/', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const b = req.body || {};
  const spreadsheetId = extractSpreadsheetId(b.spreadsheet_id);
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'Cần nhập Spreadsheet ID hoặc link Google Sheet' });
  }

  let landlordId = null;
  if (b.landlord_id !== undefined && b.landlord_id !== null && b.landlord_id !== '') {
    landlordId = parsePositiveIntId(b.landlord_id);
    if (!landlordId) {
      return res.status(400).json({ error: 'ID chủ nhà không hợp lệ' });
    }
    if (!db.prepare('SELECT id FROM landlords WHERE id = ?').get(landlordId)) {
      return res.status(400).json({ error: 'Chủ nhà không tồn tại' });
    }
  }

  let headerRow = 1;
  if (b.header_row !== undefined && b.header_row !== '' && b.header_row !== null) {
    headerRow = parsePositiveInt(b.header_row);
    if (!headerRow) {
      return res.status(400).json({ error: 'header_row phải là số nguyên dương' });
    }
  }

  const columnMapRes = parseJsonObjectField(b.column_map, {});
  if (!columnMapRes.ok) {
    return res.status(400).json({ error: 'column_map phải là JSON object hợp lệ' });
  }

  const statusRulesRes = parseJsonObjectField(b.status_rules, {});
  if (!statusRulesRes.ok) {
    return res.status(400).json({ error: 'status_rules phải là JSON object hợp lệ' });
  }

  const result = db
    .prepare(
      `
      INSERT INTO sheet_sources (
        landlord_id, name, spreadsheet_id, sheet_name, header_row,
        column_map, status_rules, default_district, enabled
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    )
    .run(
      landlordId,
      safeTrim(b.name),
      spreadsheetId,
      safeTrim(b.sheet_name) || 'Sheet1',
      headerRow,
      columnMapRes.value,
      statusRulesRes.value,
      safeTrim(b.default_district),
      b.enabled === false || b.enabled === 0 ? 0 : 1
    );

  const created = db.prepare('SELECT * FROM sheet_sources WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID cấu hình sheet không hợp lệ' });
  }
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const existing = db.prepare('SELECT * FROM sheet_sources WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy nguồn Google Sheet' });
  }

  const b = req.body || {};
  const spreadsheetId =
    b.spreadsheet_id !== undefined
      ? extractSpreadsheetId(b.spreadsheet_id)
      : existing.spreadsheet_id;
  if (!spreadsheetId) {
    return res.status(400).json({ error: 'Spreadsheet ID không được để trống' });
  }

  let landlordId = existing.landlord_id;
  if (b.landlord_id !== undefined) {
    if (b.landlord_id === '' || b.landlord_id === null) {
      landlordId = null;
    } else {
      landlordId = parsePositiveIntId(b.landlord_id);
      if (!landlordId) {
        return res.status(400).json({ error: 'ID chủ nhà không hợp lệ' });
      }
      if (!db.prepare('SELECT id FROM landlords WHERE id = ?').get(landlordId)) {
        return res.status(400).json({ error: 'Chủ nhà không tồn tại' });
      }
    }
  }

  let headerRow = existing.header_row;
  if (b.header_row !== undefined && b.header_row !== '' && b.header_row !== null) {
    headerRow = parsePositiveInt(b.header_row);
    if (!headerRow) {
      return res.status(400).json({ error: 'header_row phải là số nguyên dương' });
    }
  }

  let columnMap = existing.column_map;
  if (b.column_map !== undefined) {
    const resMap = parseJsonObjectField(b.column_map, {});
    if (!resMap.ok) {
      return res.status(400).json({ error: 'column_map phải là JSON object hợp lệ' });
    }
    columnMap = resMap.value;
  }

  let statusRules = existing.status_rules;
  if (b.status_rules !== undefined) {
    const resRules = parseJsonObjectField(b.status_rules, {});
    if (!resRules.ok) {
      return res.status(400).json({ error: 'status_rules phải là JSON object hợp lệ' });
    }
    statusRules = resRules.value;
  }

  db.prepare(
    `
    UPDATE sheet_sources SET
      landlord_id = ?,
      name = ?,
      spreadsheet_id = ?,
      sheet_name = ?,
      header_row = ?,
      column_map = ?,
      status_rules = ?,
      default_district = ?,
      enabled = ?
    WHERE id = ?
  `
  ).run(
    landlordId,
    b.name !== undefined && b.name !== null ? safeTrim(b.name) : existing.name,
    spreadsheetId,
    b.sheet_name !== undefined && b.sheet_name !== null
      ? safeTrim(b.sheet_name) || 'Sheet1'
      : existing.sheet_name,
    headerRow,
    columnMap,
    statusRules,
    b.default_district !== undefined && b.default_district !== null
      ? safeTrim(b.default_district)
      : existing.default_district,
    b.enabled !== undefined ? (b.enabled ? 1 : 0) : existing.enabled,
    existing.id
  );

  const updated = db.prepare('SELECT * FROM sheet_sources WHERE id = ?').get(existing.id);
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID cấu hình sheet không hợp lệ' });
  }

  const existing = db.prepare('SELECT id FROM sheet_sources WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy nguồn Google Sheet' });
  }
  db.prepare('DELETE FROM sheet_sources WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

router.post('/sync-all', async (req, res) => {
  try {
    const result = await syncAllEnabledSheets();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/sync', async (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID cấu hình sheet không hợp lệ' });
  }

  try {
    const result = await syncSheetSource(id);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 400).json({ error: err.message });
  }
});

export default router;

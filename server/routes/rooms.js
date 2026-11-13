import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import db, { IMAGES_DIR } from '../db.js';
import { broadcastEvent } from '../services/sse.js';
import { openFolderInOS } from '../utils/openFolder.js';
import { ensureRoomImagesLocal } from '../services/sheetSync.js';
import {
  ALLOWED_ROOM_STATUSES,
  isPlainObject,
  parseOptionalNonNegativeFloat,
  parseOptionalNonNegativeInt,
  parsePositiveIntId,
  safeTrim,
} from '../utils/validation.js';

const router = Router();

const ROOM_SELECT_SQL = `
  SELECT
    r.*,
    l.name AS landlord_name,
    l.phone AS landlord_phone,
    l.zalo AS landlord_zalo
  FROM rooms r
  LEFT JOIN landlords l ON l.id = r.landlord_id
`;

function attachImagesToRooms(rooms) {
  if (rooms.length === 0) return [];
  const ids = rooms.map((r) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const images = db
    .prepare(
      `SELECT * FROM images WHERE room_id IN (${placeholders}) ORDER BY is_cover DESC, sort_order ASC, id ASC`
    )
    .all(...ids);

  const byRoom = new Map();
  for (const img of images) {
    const url = img.filename ? `/images/${img.room_id}/${img.filename}` : img.remote_url;
    const enriched = { ...img, url };
    if (!byRoom.has(img.room_id)) byRoom.set(img.room_id, []);
    byRoom.get(img.room_id).push(enriched);
  }

  return rooms.map((room) => {
    const roomImages = byRoom.get(room.id) || [];
    const cover = roomImages.find((i) => i.is_cover) || roomImages[0] || null;
    return {
      ...room,
      images: roomImages,
      cover_url: cover ? cover.url : null,
    };
  });
}

function validateLandlordId(rawLandlordId) {
  if (rawLandlordId === undefined || rawLandlordId === '' || rawLandlordId === null) {
    return { ok: true, value: null };
  }
  const parsed = parsePositiveIntId(rawLandlordId);
  if (!parsed) {
    return { ok: false, error: 'ID chủ nhà không hợp lệ' };
  }
  const landlord = db.prepare('SELECT id FROM landlords WHERE id = ?').get(parsed);
  if (!landlord) {
    return { ok: false, error: 'Chủ nhà không tồn tại' };
  }
  return { ok: true, value: parsed };
}

router.get('/', (req, res) => {
  const {
    district,
    status,
    room_type,
    source,
    landlord_id,
    min_price,
    max_price,
    search,
    sort = 'updated_desc',
  } = req.query;

  const conditions = [];
  const params = [];

  if (district) {
    conditions.push('r.district = ?');
    params.push(String(district));
  }
  if (status) {
    const statuses = String(status)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (statuses.length > 0) {
      conditions.push(`r.status IN (${statuses.map(() => '?').join(',')})`);
      params.push(...statuses);
    }
  }
  if (room_type) {
    conditions.push('r.room_type = ?');
    params.push(String(room_type));
  }
  if (source) {
    conditions.push('r.source = ?');
    params.push(String(source));
  }
  if (landlord_id !== undefined && landlord_id !== '') {
    const parsedLandlordId = parsePositiveIntId(landlord_id);
    if (!parsedLandlordId) {
      return res.status(400).json({ error: 'landlord_id không hợp lệ' });
    }
    conditions.push('r.landlord_id = ?');
    params.push(parsedLandlordId);
  }
  if (min_price !== undefined && min_price !== '') {
    const parsedMin = parseOptionalNonNegativeInt(min_price, 0);
    if (!parsedMin.ok) {
      return res.status(400).json({ error: 'Giá tối thiểu không hợp lệ' });
    }
    conditions.push('r.price >= ?');
    params.push(parsedMin.value);
  }
  if (max_price !== undefined && max_price !== '') {
    const parsedMax = parseOptionalNonNegativeInt(max_price, 0);
    if (!parsedMax.ok) {
      return res.status(400).json({ error: 'Giá tối đa không hợp lệ' });
    }
    conditions.push('r.price <= ?');
    params.push(parsedMax.value);
  }
  if (search && String(search).trim()) {
    const kw = `%${String(search).trim().toLowerCase()}%`;
    conditions.push(`(
      LOWER(r.code) LIKE ? OR
      LOWER(r.street) LIKE ? OR
      LOWER(r.address) LIKE ? OR
      LOWER(r.district) LIKE ? OR
      LOWER(r.description) LIKE ? OR
      LOWER(r.amenities) LIKE ? OR
      LOWER(r.private_note) LIKE ? OR
      LOWER(COALESCE(l.name, '')) LIKE ?
    )`);
    params.push(kw, kw, kw, kw, kw, kw, kw, kw);
  }

  let orderBy = 'r.updated_at DESC, r.id DESC';
  if (sort === 'price_asc') orderBy = 'r.price ASC, r.id DESC';
  else if (sort === 'price_desc') orderBy = 'r.price DESC, r.id DESC';
  else if (sort === 'newest') orderBy = 'r.created_at DESC, r.id DESC';

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = db
    .prepare(
      `
      ${ROOM_SELECT_SQL}
      ${whereClause}
      ORDER BY ${orderBy}
    `
    )
    .all(...params);

  res.json(attachImagesToRooms(rows));
});

router.patch('/bulk-status', (req, res) => {
  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const { ids, status } = req.body;
  if (!ALLOWED_ROOM_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Cần chọn ít nhất 1 phòng' });
  }

  const parsedIds = [];
  const seen = new Set();
  for (const rawId of ids) {
    const id = parsePositiveIntId(rawId);
    if (!id) {
      return res.status(400).json({ error: 'Danh sách ID phòng không hợp lệ' });
    }
    if (!seen.has(id)) {
      seen.add(id);
      parsedIds.push(id);
    }
  }

  const placeholders = parsedIds.map(() => '?').join(',');
  const existingRows = db
    .prepare(`SELECT id FROM rooms WHERE id IN (${placeholders})`)
    .all(...parsedIds);

  if (existingRows.length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy phòng nào để cập nhật' });
  }

  const existingIds = existingRows.map((r) => r.id);
  const existingPlaceholders = existingIds.map(() => '?').join(',');

  const result = db
    .prepare(
      `
      UPDATE rooms SET
        status = ?,
        updated_at = datetime('now', 'localtime'),
        status_changed_at = CASE WHEN status != ? THEN datetime('now', 'localtime') ELSE status_changed_at END
      WHERE id IN (${existingPlaceholders})
    `
    )
    .run(status, status, ...existingIds);

  broadcastEvent('rooms_changed', { action: 'bulk_status', roomIds: existingIds, status });
  res.json({
    ok: true,
    updated: result.changes,
    ids: existingIds,
    status,
  });
});

router.get('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID phòng không hợp lệ' });
  }

  const room = db.prepare(`${ROOM_SELECT_SQL} WHERE r.id = ?`).get(id);
  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }
  const [enriched] = attachImagesToRooms([room]);
  res.json(enriched);
});

router.post('/', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const b = req.body || {};
  const priceRes = parseOptionalNonNegativeInt(b.price, 0);
  if (!priceRes.ok) {
    return res.status(400).json({ error: 'Giá thuê không hợp lệ' });
  }

  const depositRes =
    b.deposit !== undefined && b.deposit !== '' && b.deposit !== null
      ? parseOptionalNonNegativeInt(b.deposit, priceRes.value)
      : { ok: true, value: priceRes.value };
  if (!depositRes.ok) {
    return res.status(400).json({ error: 'Tiền cọc không hợp lệ' });
  }

  const areaRes = parseOptionalNonNegativeFloat(b.area_m2, null);
  if (!areaRes.ok) {
    return res.status(400).json({ error: 'Diện tích không hợp lệ' });
  }

  const landlordRes = validateLandlordId(b.landlord_id);
  if (!landlordRes.ok) {
    return res.status(400).json({ error: landlordRes.error });
  }

  const status = b.status !== undefined && b.status !== '' ? String(b.status) : 'trong';
  if (!ALLOWED_ROOM_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  const result = db
    .prepare(
      `
      INSERT INTO rooms (
        landlord_id, code, address, street, district, price, deposit, area_m2,
        room_type, amenities, electric_price, water_price, status, available_from,
        description, private_note, source, created_at, updated_at, status_changed_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'), datetime('now', 'localtime')
      )
    `
    )
    .run(
      landlordRes.value,
      safeTrim(b.code),
      safeTrim(b.address),
      safeTrim(b.street),
      safeTrim(b.district),
      priceRes.value,
      depositRes.value,
      areaRes.value,
      safeTrim(b.room_type) || 'Khép kín',
      safeTrim(b.amenities),
      safeTrim(b.electric_price),
      safeTrim(b.water_price),
      status,
      safeTrim(b.available_from),
      safeTrim(b.description),
      safeTrim(b.private_note),
      safeTrim(b.source) || 'manual'
    );

  const created = db.prepare(`${ROOM_SELECT_SQL} WHERE r.id = ?`).get(result.lastInsertRowid);
  const [enriched] = attachImagesToRooms([created]);
  broadcastEvent('rooms_changed', { action: 'created', roomId: enriched.id });
  res.status(201).json(enriched);
});

router.put('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID phòng không hợp lệ' });
  }

  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const existing = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }

  const b = req.body || {};
  const priceRes =
    b.price !== undefined
      ? parseOptionalNonNegativeInt(b.price, existing.price)
      : { ok: true, value: existing.price };
  if (!priceRes.ok) {
    return res.status(400).json({ error: 'Giá thuê không hợp lệ' });
  }

  const depositRes =
    b.deposit !== undefined
      ? parseOptionalNonNegativeInt(b.deposit, existing.deposit)
      : { ok: true, value: existing.deposit };
  if (!depositRes.ok) {
    return res.status(400).json({ error: 'Tiền cọc không hợp lệ' });
  }

  const areaRes =
    b.area_m2 !== undefined
      ? parseOptionalNonNegativeFloat(b.area_m2, null)
      : { ok: true, value: existing.area_m2 };
  if (!areaRes.ok) {
    return res.status(400).json({ error: 'Diện tích không hợp lệ' });
  }

  let landlordId = existing.landlord_id;
  if (b.landlord_id !== undefined) {
    const landlordRes = validateLandlordId(b.landlord_id);
    if (!landlordRes.ok) {
      return res.status(400).json({ error: landlordRes.error });
    }
    landlordId = landlordRes.value;
  }

  const newStatus = b.status !== undefined ? String(b.status) : existing.status;
  if (!ALLOWED_ROOM_STATUSES.includes(newStatus)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  db.prepare(
    `
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
      private_note = ?,
      updated_at = datetime('now', 'localtime'),
      status_changed_at = CASE WHEN ? != status THEN datetime('now', 'localtime') ELSE status_changed_at END
    WHERE id = ?
  `
  ).run(
    landlordId,
    b.code !== undefined && b.code !== null ? safeTrim(b.code) : existing.code,
    b.address !== undefined && b.address !== null ? safeTrim(b.address) : existing.address,
    b.street !== undefined && b.street !== null ? safeTrim(b.street) : existing.street,
    b.district !== undefined && b.district !== null ? safeTrim(b.district) : existing.district,
    priceRes.value,
    depositRes.value,
    areaRes.value,
    b.room_type !== undefined && b.room_type !== null ? safeTrim(b.room_type) : existing.room_type,
    b.amenities !== undefined && b.amenities !== null ? safeTrim(b.amenities) : existing.amenities,
    b.electric_price !== undefined && b.electric_price !== null
      ? safeTrim(b.electric_price)
      : existing.electric_price,
    b.water_price !== undefined && b.water_price !== null
      ? safeTrim(b.water_price)
      : existing.water_price,
    newStatus,
    b.available_from !== undefined && b.available_from !== null
      ? safeTrim(b.available_from)
      : existing.available_from,
    b.description !== undefined && b.description !== null
      ? safeTrim(b.description)
      : existing.description,
    b.private_note !== undefined && b.private_note !== null
      ? safeTrim(b.private_note)
      : existing.private_note,
    newStatus,
    existing.id
  );

  const updated = db.prepare(`${ROOM_SELECT_SQL} WHERE r.id = ?`).get(existing.id);
  const [enriched] = attachImagesToRooms([updated]);
  broadcastEvent('rooms_changed', { action: 'updated', roomId: enriched.id });
  res.json(enriched);
});

router.patch('/:id/status', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID phòng không hợp lệ' });
  }
  if (!isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const { status } = req.body;
  if (!ALLOWED_ROOM_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
  }

  const existing = db.prepare('SELECT id, status FROM rooms WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }

  db.prepare(
    `
    UPDATE rooms SET
      status = ?,
      updated_at = datetime('now', 'localtime'),
      status_changed_at = CASE WHEN status != ? THEN datetime('now', 'localtime') ELSE status_changed_at END
    WHERE id = ?
  `
  ).run(status, status, existing.id);

  broadcastEvent('rooms_changed', { action: 'status', roomId: existing.id, status });
  res.json({ ok: true, id: existing.id, status });
});

router.delete('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID phòng không hợp lệ' });
  }

  const existing = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }

  db.prepare('DELETE FROM rooms WHERE id = ?').run(existing.id);
  const roomDir = path.join(IMAGES_DIR, String(existing.id));
  if (fs.existsSync(roomDir)) {
    fs.rmSync(roomDir, { recursive: true, force: true });
  }

  broadcastEvent('rooms_changed', { action: 'deleted', roomId: existing.id });
  res.json({ ok: true });
});

router.post('/:id/open-folder', async (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID phòng không hợp lệ' });
  }

  const existing = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }

  try {
    const dlResult = await ensureRoomImagesLocal(existing.id);
    const roomDir = path.join(IMAGES_DIR, String(existing.id));
    await openFolderInOS(roomDir);
    if (dlResult.downloaded > 0) {
      broadcastEvent('rooms_changed', { action: 'images_downloaded', roomId: existing.id });
    }
    res.json({ ok: true, folder: roomDir, downloaded: dlResult.downloaded });
  } catch (err) {
    res.status(500).json({ error: `Không thể mở thư mục ảnh: ${err.message}` });
  }
});

export default router;

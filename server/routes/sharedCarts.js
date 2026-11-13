import { Router } from 'express';
import crypto from 'node:crypto';
import db from '../db.js';
import { isPlainObject, parsePositiveIntId, safeTrim } from '../utils/validation.js';

const router = Router();

router.get('/carts', (req, res) => {
  const carts = db
    .prepare(
      `
      SELECT sc.*, c.name AS customer_name
      FROM shared_carts sc
      LEFT JOIN customers c ON c.id = sc.customer_id
      ORDER BY sc.created_at DESC, sc.id DESC
    `
    )
    .all();

  res.json(
    carts.map((cart) => {
      let roomIds = [];
      try {
        const parsed = JSON.parse(cart.room_ids || '[]');
        if (Array.isArray(parsed)) roomIds = parsed;
      } catch {
        roomIds = [];
      }
      return { ...cart, room_ids: roomIds };
    })
  );
});

router.post('/carts', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const { title = 'Danh sách phòng phù hợp', customer_id = null, room_ids = [], note = '' } =
    req.body || {};

  if (!Array.isArray(room_ids) || room_ids.length === 0) {
    return res.status(400).json({ error: 'Cần chọn ít nhất 1 phòng để tạo giỏ phòng' });
  }

  const normalizedIds = [];
  const seen = new Set();
  for (const rawId of room_ids) {
    const id = parsePositiveIntId(rawId);
    if (!id) {
      return res.status(400).json({ error: 'Danh sách ID phòng không hợp lệ' });
    }
    if (!seen.has(id)) {
      seen.add(id);
      normalizedIds.push(id);
    }
  }

  let customerId = null;
  if (customer_id !== null && customer_id !== undefined && customer_id !== '') {
    customerId = parsePositiveIntId(customer_id);
    if (!customerId) {
      return res.status(400).json({ error: 'ID khách hàng không hợp lệ' });
    }
    const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      return res.status(400).json({ error: 'Khách hàng không tồn tại' });
    }
  }

  const slug = crypto.randomBytes(4).toString('hex');
  const result = db
    .prepare(
      `
      INSERT INTO shared_carts (slug, title, customer_id, room_ids, note, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', 'localtime'))
    `
    )
    .run(
      slug,
      safeTrim(title) || 'Danh sách phòng phù hợp',
      customerId,
      JSON.stringify(normalizedIds),
      safeTrim(note)
    );

  const created = db.prepare('SELECT * FROM shared_carts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...created, room_ids: normalizedIds });
});

router.delete('/carts/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID giỏ phòng không hợp lệ' });
  }

  const existing = db.prepare('SELECT id FROM shared_carts WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy giỏ phòng' });
  }
  db.prepare('DELETE FROM shared_carts WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// Public tenant-safe endpoint: NEVER expose address (house number), private_note, or landlord info!
router.get('/public/carts/:slug', (req, res) => {
  const slug = safeTrim(req.params.slug);
  if (!/^[a-zA-Z0-9_-]{4,64}$/.test(slug)) {
    return res.status(404).json({ error: 'Link giỏ phòng không tồn tại hoặc đã bị xoá' });
  }

  const cart = db
    .prepare('SELECT id, slug, title, room_ids, note, created_at, expires_at FROM shared_carts WHERE slug = ?')
    .get(slug);

  if (!cart) {
    return res.status(404).json({ error: 'Link giỏ phòng không tồn tại hoặc đã bị xoá' });
  }

  if (cart.expires_at) {
    const expired = db
      .prepare("SELECT datetime(?) < datetime('now', 'localtime') AS is_expired")
      .get(cart.expires_at)?.is_expired;
    if (expired) {
      return res.status(404).json({ error: 'Link giỏ phòng đã hết hạn' });
    }
  }

  let roomIds = [];
  try {
    const parsed = JSON.parse(cart.room_ids || '[]');
    if (Array.isArray(parsed)) {
      roomIds = parsed.map((id) => parsePositiveIntId(id)).filter(Boolean);
    }
  } catch {
    roomIds = [];
  }

  let rooms = [];
  if (roomIds.length > 0) {
    const placeholders = roomIds.map(() => '?').join(',');
    const rawRooms = db
      .prepare(
        `
        SELECT
          id, code, street, district, price, deposit, area_m2,
          room_type, amenities, electric_price, water_price,
          status, available_from, description
        FROM rooms
        WHERE id IN (${placeholders})
      `
      )
      .all(...roomIds);

    const images = db
      .prepare(
        `SELECT id, room_id, filename, remote_url, is_cover, sort_order
         FROM images WHERE room_id IN (${placeholders})
         ORDER BY is_cover DESC, sort_order ASC, id ASC`
      )
      .all(...roomIds);

    const byRoom = new Map();
    for (const img of images) {
      const url = img.filename ? `/images/${img.room_id}/${img.filename}` : img.remote_url;
      if (!byRoom.has(img.room_id)) byRoom.set(img.room_id, []);
      byRoom.get(img.room_id).push({ id: img.id, url, is_cover: img.is_cover });
    }

    rooms = rawRooms.map((r) => ({
      ...r,
      images: byRoom.get(r.id) || [],
    }));
  }

  res.json({
    slug: cart.slug,
    title: cart.title,
    note: cart.note,
    created_at: cart.created_at,
    rooms,
  });
});

export default router;

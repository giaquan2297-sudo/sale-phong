import { Router } from 'express';
import db from '../db.js';
import { broadcastEvent } from '../services/sse.js';
import { isPlainObject, parsePositiveIntId, safeTrim } from '../utils/validation.js';

const router = Router();

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT
        l.*,
        COUNT(r.id) AS total_rooms,
        SUM(CASE WHEN r.status IN ('trong', 'sap_trong') THEN 1 ELSE 0 END) AS available_rooms
      FROM landlords l
      LEFT JOIN rooms r ON r.landlord_id = l.id
      GROUP BY l.id
      ORDER BY l.updated_at DESC, l.id DESC
    `
    )
    .all();
  res.json(rows);
});

router.post('/', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }
  const b = req.body || {};
  const name = safeTrim(b.name);
  if (!name) {
    return res.status(400).json({ error: 'Tên chủ nhà không được để trống' });
  }

  const result = db
    .prepare(
      `INSERT INTO landlords (name, phone, zalo, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))`
    )
    .run(name, safeTrim(b.phone), safeTrim(b.zalo), safeTrim(b.note));

  const created = db.prepare('SELECT * FROM landlords WHERE id = ?').get(result.lastInsertRowid);
  broadcastEvent('landlords_changed', { action: 'created', landlordId: created.id });
  res.status(201).json({ ...created, total_rooms: 0, available_rooms: 0 });
});

router.put('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID chủ nhà không hợp lệ' });
  }
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const existing = db.prepare('SELECT * FROM landlords WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy chủ nhà' });
  }

  const b = req.body || {};
  if (b.name !== undefined && !safeTrim(b.name)) {
    return res.status(400).json({ error: 'Tên chủ nhà không được để trống' });
  }

  db.prepare(
    `UPDATE landlords SET
      name = ?, phone = ?, zalo = ?, note = ?, updated_at = datetime('now', 'localtime')
     WHERE id = ?`
  ).run(
    b.name !== undefined ? safeTrim(b.name) : existing.name,
    b.phone !== undefined && b.phone !== null ? safeTrim(b.phone) : existing.phone,
    b.zalo !== undefined && b.zalo !== null ? safeTrim(b.zalo) : existing.zalo,
    b.note !== undefined && b.note !== null ? safeTrim(b.note) : existing.note,
    existing.id
  );

  const updated = db.prepare('SELECT * FROM landlords WHERE id = ?').get(existing.id);
  broadcastEvent('landlords_changed', { action: 'updated', landlordId: updated.id });
  res.json(updated);
});

router.delete('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID chủ nhà không hợp lệ' });
  }

  const existing = db.prepare('SELECT id FROM landlords WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy chủ nhà' });
  }

  db.prepare('DELETE FROM landlords WHERE id = ?').run(existing.id);
  broadcastEvent('landlords_changed', { action: 'deleted', landlordId: existing.id });
  res.json({ ok: true });
});

export default router;

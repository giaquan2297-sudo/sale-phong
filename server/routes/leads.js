import express from 'express';
import db from '../db.js';
import { broadcastEvent, broadcastSse } from '../services/sse.js';

const router = express.Router();

/**
 * POST /api/public/leads
 * Public endpoint for prospective tenants submitting interest
 * Body: { name, phone, move_in_date, budget, note, room_id, room_code, address, district }
 */
function handleCreateLead(req, res) {
  let { name, phone, move_in_date, budget, note, room_id, room_code, address, district } =
    req.body || {};

  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || '').trim();

  if (!cleanName) {
    return res.status(400).json({ error: 'Vui lòng cung cấp họ tên' });
  }

  if (!cleanPhone) {
    return res.status(400).json({ error: 'Vui lòng cung cấp số điện thoại hoặc Zalo' });
  }

  // If room_id is supplied, resolve room details if missing
  if (room_id) {
    const room = db
      .prepare('SELECT code, address, district, price FROM rooms WHERE id = ?')
      .get(Number(room_id));
    if (room) {
      if (!room_code) room_code = room.code;
      if (!address) address = room.address;
      if (!district) district = room.district;
      if (!budget && room.price) budget = room.price;
    }
  }

  const parsedBudget = budget ? parseInt(budget, 10) || null : null;
  const cleanDistrict = district ? String(district).trim() : '';
  const moveInDate = move_in_date ? String(move_in_date).trim() : 'Ngay';
  const cleanNote = note ? String(note).trim() : '';

  const needNote =
    `Khách quan tâm phòng ${room_code || ''} - ${address || ''}. Ngày vào: ${moveInDate}. ${cleanNote}`.trim();

  const stmt = db.prepare(`
    INSERT INTO customers (name, zalo_phone, status, budget_max, districts, need_note)
    VALUES (?, ?, 'chua_cham', ?, ?, ?)
  `);

  const result = stmt.run(cleanName, cleanPhone, parsedBudget, cleanDistrict, needNote);
  const customerId = Number(result.lastInsertRowid);

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);

  // Broadcast SSE events: custom lead event and standard customers_changed
  const broadcastFn = broadcastSse || broadcastEvent;
  broadcastFn('customer:lead_created', {
    customer,
    message: 'Khách hàng mới để lại thông tin!',
  });
  broadcastEvent('customers_changed', { action: 'created', customerId });

  return res.status(201).json({
    ok: true,
    customerId,
    customer,
    message: 'Đã nhận thông tin liên hệ thành công!',
  });
}

// Support both `/public/leads` (when mounted at `/api`) and `/leads` (when mounted at `/api/public`)
router.post('/public/leads', handleCreateLead);
router.post('/leads', handleCreateLead);

export default router;

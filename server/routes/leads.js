import express from 'express';
import db from '../db.js';
import { broadcastEvent, broadcastSse } from '../services/sse.js';
import { enrichCustomer, normalizeTargetDate } from '../utils/customerUtils.js';

const router = express.Router();

/**
 * POST /api/public/leads or POST /api/leads
 * Public endpoint for prospective tenants submitting interest
 * Body: { name, phone, zalo_phone, budget_min, budget_max, budget, districts, district, need_note, note, urgency, target_date, move_in_date, room_id, room_code, address }
 */
function handleCreateLead(req, res) {
  let {
    name,
    phone,
    zalo_phone,
    budget_min,
    budget_max,
    budget,
    districts,
    district,
    need_note,
    note,
    urgency,
    target_date,
    move_in_date,
    room_id,
    room_code,
    address,
  } = req.body || {};

  const cleanName = String(name || '').trim();
  const cleanPhone = String(phone || zalo_phone || '').trim();

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
      if (!district && !districts) district = room.district;
      if (!budget && !budget_max && room.price) budget = room.price;
    }
  }

  const parsedBudgetMin =
    budget_min !== undefined && budget_min !== null && budget_min !== ''
      ? parseInt(budget_min, 10) || null
      : null;

  const rawBudgetMax =
    budget_max !== undefined && budget_max !== null && budget_max !== '' ? budget_max : budget;
  const parsedBudgetMax =
    rawBudgetMax !== undefined && rawBudgetMax !== null && rawBudgetMax !== ''
      ? parseInt(rawBudgetMax, 10) || null
      : null;

  const cleanDistricts = String(districts || district || '').trim();

  const rawMoveInDate = move_in_date
    ? String(move_in_date).trim()
    : target_date
      ? String(target_date).trim()
      : 'Ngay';

  const cleanNote = note ? String(note).trim() : '';
  const cleanNeedNote = need_note ? String(need_note).trim() : '';

  let finalNeedNote;
  if (room_code || address) {
    const roomPart = `${room_code || ''}${room_code && address ? ' - ' : ''}${address || ''}`.trim();
    const noteText = [cleanNeedNote, cleanNote].filter(Boolean).join('. ');
    finalNeedNote = `Khách quan tâm phòng ${roomPart}. Ngày vào: ${rawMoveInDate}.${noteText ? ` ${noteText}` : ''}`.trim();
  } else if (cleanNeedNote || cleanNote) {
    finalNeedNote = [cleanNeedNote, cleanNote].filter(Boolean).join('. ');
  } else {
    finalNeedNote = `Khách quan tâm phòng. Ngày vào: ${rawMoveInDate}.`.trim();
  }

  const cleanUrgency = String(urgency || '').trim();
  const finalUrgency = ['gap', 'binh_thuong', 'hen_truoc'].includes(cleanUrgency)
    ? cleanUrgency
    : 'binh_thuong';

  const cleanTargetDate = normalizeTargetDate(target_date || move_in_date);

  const stmt = db.prepare(`
    INSERT INTO customers (
      name, zalo_phone, status, budget_min, budget_max, districts, need_note, urgency, target_date, source, created_at, updated_at
    ) VALUES (?, ?, 'chua_cham', ?, ?, ?, ?, ?, ?, 'web_form', datetime('now', 'localtime'), datetime('now', 'localtime'))
  `);

  const result = stmt.run(
    cleanName,
    cleanPhone,
    parsedBudgetMin,
    parsedBudgetMax,
    cleanDistricts,
    finalNeedNote,
    finalUrgency,
    cleanTargetDate
  );
  const customerId = Number(result.lastInsertRowid);

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  const enrichedCustomer = enrichCustomer(customer);

  // Broadcast SSE events: custom lead event and standard customers_changed
  const broadcastFn = broadcastSse || broadcastEvent;
  broadcastFn('customer:lead_created', {
    customer: enrichedCustomer,
    message: 'Khách hàng mới để lại thông tin!',
  });
  broadcastEvent('customers_changed', { action: 'created', customerId });

  return res.status(201).json({
    ok: true,
    customerId,
    customer: enrichedCustomer,
    message: 'Đã nhận thông tin liên hệ thành công!',
  });
}

// Support both `/public/leads` (when mounted at `/api`) and `/leads` (when mounted at `/api/public`)
router.post('/public/leads', handleCreateLead);
router.post('/leads', handleCreateLead);

export default router;

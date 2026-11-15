import { Router } from 'express';
import db from '../db.js';
import { broadcastEvent } from '../services/sse.js';
import {
  ALLOWED_COMMISSION_STATUSES,
  ALLOWED_CUSTOMER_STATUSES,
  isPlainObject,
  parseOptionalNonNegativeFloat,
  parseOptionalNonNegativeInt,
  parsePositiveIntId,
  parseVietnameseCurrency,
  safeTrim,
} from '../utils/validation.js';
import { enrichCustomer, normalizeTargetDate } from '../utils/customerUtils.js';

export { enrichCustomer, normalizeTargetDate };

const router = Router();

export function saveCustomerDeal(customerId, b, existingCustomer = null) {
  let dealRoomId = parsePositiveIntId(
    b.deal_room_id !== undefined
      ? b.deal_room_id
      : b.room_id !== undefined
        ? b.room_id
        : existingCustomer?.deal_room_id
  );
  let dealRoomCode = safeTrim(
    b.deal_room_code !== undefined
      ? b.deal_room_code
      : b.room_code !== undefined
        ? b.room_code
        : existingCustomer?.deal_room_code
  );
  let dealAddress = safeTrim(
    b.deal_address !== undefined
      ? b.deal_address
      : b.address !== undefined
        ? b.address
        : existingCustomer?.deal_address
  );
  let dealDistrict = safeTrim(
    b.deal_district !== undefined
      ? b.deal_district
      : b.district !== undefined
        ? b.district
        : existingCustomer?.deal_district
  );

  let dealPrice = 0;
  if (b.deal_price !== undefined || b.price !== undefined) {
    const priceRes = parseOptionalNonNegativeInt(b.deal_price ?? b.price, 0);
    dealPrice = priceRes.ok ? priceRes.value : 0;
  } else if (existingCustomer?.deal_price) {
    dealPrice = existingCustomer.deal_price;
  }

  // If dealRoomId is provided, lookup room details to autofill if missing
  if (dealRoomId) {
    const room = db
      .prepare('SELECT id, code, address, street, district, price FROM rooms WHERE id = ?')
      .get(dealRoomId);
    if (room) {
      if (!dealRoomCode) dealRoomCode = room.code || '';
      if (!dealAddress) dealAddress = room.address || room.street || '';
      if (!dealDistrict) dealDistrict = room.district || '';
      if (dealPrice === 0 && room.price > 0) dealPrice = room.price;
    }
  }

  let dealDate = safeTrim(b.deal_date !== undefined ? b.deal_date : existingCustomer?.deal_date);
  if (!dealDate) {
    dealDate = new Date().toLocaleDateString('en-CA');
  }

  const rateRes = parseOptionalNonNegativeFloat(b.commission_rate, 50);
  const commissionRate = rateRes.ok && rateRes.value !== null ? rateRes.value : 50;

  let dealCommission = null;
  if (b.deal_commission !== undefined || b.commission_amount !== undefined) {
    const commRes = parseOptionalNonNegativeInt(b.deal_commission ?? b.commission_amount, null);
    if (commRes.ok && commRes.value !== null) {
      dealCommission = commRes.value;
    }
  } else if (existingCustomer?.deal_commission && existingCustomer.deal_commission > 0) {
    dealCommission = existingCustomer.deal_commission;
  }

  if (dealCommission === null) {
    dealCommission = dealPrice > 0 ? Math.round(dealPrice * (commissionRate / 100)) : 0;
  }

  let dealCommissionStatus =
    safeTrim(
      b.deal_commission_status !== undefined
        ? b.deal_commission_status
        : b.commission_status !== undefined
          ? b.commission_status
          : existingCustomer?.deal_commission_status
    ) || 'cho_thu';
  if (!ALLOWED_COMMISSION_STATUSES.includes(dealCommissionStatus)) {
    dealCommissionStatus = 'cho_thu';
  }

  const rawRecv = b.commission_received;
  const recvRes = parseOptionalNonNegativeInt(rawRecv, 0);
  let commissionReceived = recvRes.ok ? recvRes.value : 0;

  if (dealCommissionStatus === 'da_thu' && commissionReceived === 0 && dealCommission > 0) {
    commissionReceived = dealCommission;
  }

  const moveInDate = safeTrim(
    b.move_in_date !== undefined ? b.move_in_date : existingCustomer?.move_in_date
  );
  const dealNote = safeTrim(b.deal_note !== undefined ? b.deal_note : b.note);

  // Update customer's deal columns
  db.prepare(
    `
    UPDATE customers SET
      deal_room_id = ?,
      deal_room_code = ?,
      deal_address = ?,
      deal_district = ?,
      deal_price = ?,
      deal_date = ?,
      deal_commission = ?,
      deal_commission_status = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `
  ).run(
    dealRoomId,
    dealRoomCode,
    dealAddress,
    dealDistrict,
    dealPrice,
    dealDate,
    dealCommission,
    dealCommissionStatus,
    customerId
  );

  // Upsert deals table
  const existingDeal = db
    .prepare('SELECT id FROM deals WHERE customer_id = ? ORDER BY id DESC LIMIT 1')
    .get(customerId);

  let dealId;
  if (existingDeal) {
    db.prepare(
      `
      UPDATE deals SET
        room_id = ?,
        room_code = ?,
        address = ?,
        district = ?,
        price = ?,
        commission_rate = ?,
        commission_amount = ?,
        deal_date = ?,
        move_in_date = ?,
        commission_status = ?,
        commission_received = ?,
        note = ?,
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `
    ).run(
      dealRoomId,
      dealRoomCode,
      dealAddress,
      dealDistrict,
      dealPrice,
      commissionRate,
      dealCommission,
      dealDate,
      moveInDate,
      dealCommissionStatus,
      commissionReceived,
      dealNote,
      existingDeal.id
    );
    dealId = existingDeal.id;
  } else {
    const res = db
      .prepare(
        `
      INSERT INTO deals (
        customer_id, room_id, room_code, address, district, price,
        commission_rate, commission_amount, deal_date, move_in_date,
        commission_status, commission_received, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `
      )
      .run(
        customerId,
        dealRoomId,
        dealRoomCode,
        dealAddress,
        dealDistrict,
        dealPrice,
        commissionRate,
        dealCommission,
        dealDate,
        moveInDate,
        dealCommissionStatus,
        commissionReceived,
        dealNote
      );
    dealId = res.lastInsertRowid;
  }

  // Optionally update room status if mark_room_rented is requested
  if (dealRoomId && b.mark_room_rented) {
    const targetStatus =
      typeof b.mark_room_rented === 'string' && ['da_coc', 'da_thue'].includes(b.mark_room_rented)
        ? b.mark_room_rented
        : 'da_thue';
    db.prepare(
      `UPDATE rooms SET status = ?, status_changed_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(targetStatus, dealRoomId);
    broadcastEvent('rooms_changed', { action: 'status_updated', roomId: dealRoomId, status: targetStatus });
  }

  broadcastEvent('deals_changed', { action: 'upserted', customerId, dealId });
  return dealId;
}

router.get('/customers', (req, res) => {
  const { status, q, urgency, source, needs_reminder } = req.query;
  let sql = `
    SELECT
      c.*,
      d.id AS deal_id,
      d.move_in_date AS deal_move_in_date,
      d.commission_received AS deal_commission_received,
      d.commission_rate AS deal_commission_rate,
      d.note AS deal_note,
      COUNT(DISTINCT s.id) AS send_count,
      MAX(s.sent_at) AS last_sent_at
    FROM customers c
    LEFT JOIN deals d ON d.customer_id = c.id
    LEFT JOIN sends s ON s.customer_id = c.id
  `;
  const conditions = [];
  const params = [];
  if (status && status !== 'all') {
    conditions.push('c.status = ?');
    params.push(status);
  }
  if (urgency && urgency !== 'all') {
    conditions.push('c.urgency = ?');
    params.push(urgency);
  }
  if (source && source !== 'all') {
    conditions.push('c.source = ?');
    params.push(source);
  }
  if (q && safeTrim(q)) {
    conditions.push('(c.name LIKE ? OR c.zalo_phone LIKE ? OR c.districts LIKE ? OR c.university LIKE ?)');
    const term = `%${safeTrim(q)}%`;
    params.push(term, term, term, term);
  }
  if (conditions.length > 0) {
    sql += ` WHERE ` + conditions.join(' AND ');
  }
  sql += ` GROUP BY c.id ORDER BY c.updated_at DESC, c.id DESC`;

  let customers = db
    .prepare(sql)
    .all(...params)
    .map((c) => enrichCustomer(c));
  if (needs_reminder === 'true' || needs_reminder === '1') {
    customers = customers.filter((c) => c.needs_followup_reminder);
  }
  res.json(customers);
});

router.get('/customers/:id/sends', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID khách hàng không hợp lệ' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  }

  const sends = db
    .prepare('SELECT * FROM sends WHERE customer_id = ? ORDER BY sent_at DESC, id DESC')
    .all(customer.id);

  const enrichedSends = sends.map((send) => {
    let roomIds = [];
    try {
      const parsed = JSON.parse(send.room_ids || '[]');
      if (Array.isArray(parsed)) {
        roomIds = parsed.map((rid) => parsePositiveIntId(rid)).filter(Boolean);
      }
    } catch {
      roomIds = [];
    }
    let rooms = [];
    if (roomIds.length > 0) {
      const placeholders = roomIds.map(() => '?').join(',');
      rooms = db
        .prepare(
          `SELECT id, code, street, district, price, status FROM rooms WHERE id IN (${placeholders})`
        )
        .all(...roomIds);
    }
    return { ...send, room_ids: roomIds, rooms };
  });

  res.json({ customer: enrichCustomer(customer), sends: enrichedSends });
});

router.get('/customers/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID khách hàng không hợp lệ' });
  }

  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) {
    return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  }

  res.json(enrichCustomer(customer));
});

router.post('/customers', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const b = req.body || {};
  const name = safeTrim(b.name);
  if (!name) {
    return res.status(400).json({ error: 'Tên khách hàng không được để trống' });
  }

  const budgetMinRes = parseVietnameseCurrency(b.budget_min, null);
  if (!budgetMinRes.ok) {
    return res.status(400).json({ error: 'Ngân sách tối thiểu không hợp lệ' });
  }
  const budgetMaxRes = parseVietnameseCurrency(b.budget_max, null);
  if (!budgetMaxRes.ok) {
    return res.status(400).json({ error: 'Ngân sách tối đa không hợp lệ' });
  }

  let status = safeTrim(b.status) || 'chua_cham';
  if (status === 'dang_tim') status = 'chua_cham';
  if (status === 'da_thue') status = 'da_chot';
  if (!ALLOWED_CUSTOMER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái khách hàng không hợp lệ' });
  }

  const urgency =
    b.urgency !== undefined && ['gap', 'binh_thuong', 'hen_truoc'].includes(safeTrim(b.urgency))
      ? safeTrim(b.urgency)
      : 'binh_thuong';
  const targetDate = normalizeTargetDate(
    b.target_date !== undefined ? b.target_date : b.move_in_date
  );
  const source = safeTrim(b.source) || 'manual';
  const university = safeTrim(b.university);

  const result = db
    .prepare(
      `
      INSERT INTO customers (
        name, zalo_phone, budget_min, budget_max, districts, need_note, status, urgency, target_date, source, university, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'), datetime('now', 'localtime'))
    `
    )
    .run(
      name,
      safeTrim(b.zalo_phone),
      budgetMinRes.value === 0 ? null : budgetMinRes.value,
      budgetMaxRes.value === 0 ? null : budgetMaxRes.value,
      safeTrim(b.districts),
      safeTrim(b.need_note),
      status,
      urgency,
      targetDate,
      source,
      university
    );

  const customerId = result.lastInsertRowid;
  if (status === 'da_chot') {
    saveCustomerDeal(customerId, b);
  }

  const created = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  broadcastEvent('customers_changed', { action: 'created', customerId: created.id });
  res.status(201).json(enrichCustomer({ ...created, send_count: 0, last_sent_at: null }));
});

function handleUpdateCustomer(req, res) {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID khách hàng không hợp lệ' });
  }
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  }

  const b = req.body || {};
  if (b.name !== undefined && !safeTrim(b.name)) {
    return res.status(400).json({ error: 'Tên khách hàng không được để trống' });
  }

  const budgetMinRes =
    b.budget_min !== undefined
      ? parseVietnameseCurrency(b.budget_min, null)
      : { ok: true, value: existing.budget_min };
  if (!budgetMinRes.ok) {
    return res.status(400).json({ error: 'Ngân sách tối thiểu không hợp lệ' });
  }

  const budgetMaxRes =
    b.budget_max !== undefined
      ? parseVietnameseCurrency(b.budget_max, null)
      : { ok: true, value: existing.budget_max };
  if (!budgetMaxRes.ok) {
    return res.status(400).json({ error: 'Ngân sách tối đa không hợp lệ' });
  }

  let status = b.status !== undefined ? safeTrim(b.status) : existing.status;
  if (status === 'dang_tim') status = 'chua_cham';
  if (status === 'da_thue') status = 'da_chot';
  if (!ALLOWED_CUSTOMER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái khách hàng không hợp lệ' });
  }

  let urgency = existing.urgency || 'binh_thuong';
  if (b.urgency !== undefined) {
    const cleanUrgency = safeTrim(b.urgency);
    if (['gap', 'binh_thuong', 'hen_truoc'].includes(cleanUrgency)) {
      urgency = cleanUrgency;
    }
  }

  let targetDate = existing.target_date || '';
  if (b.target_date !== undefined || b.move_in_date !== undefined) {
    targetDate = normalizeTargetDate(b.target_date !== undefined ? b.target_date : b.move_in_date);
  }

  let source = existing.source || 'manual';
  if (b.source !== undefined && safeTrim(b.source)) {
    source = safeTrim(b.source);
  }

  let university = existing.university || '';
  if (b.university !== undefined) {
    university = safeTrim(b.university);
  }

  db.prepare(
    `
    UPDATE customers SET
      name = ?,
      zalo_phone = ?,
      budget_min = ?,
      budget_max = ?,
      districts = ?,
      need_note = ?,
      status = ?,
      urgency = ?,
      target_date = ?,
      source = ?,
      university = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `
  ).run(
    b.name !== undefined ? safeTrim(b.name) : existing.name,
    b.zalo_phone !== undefined && b.zalo_phone !== null
      ? safeTrim(b.zalo_phone)
      : existing.zalo_phone,
    b.budget_min !== undefined && budgetMinRes.value === 0 ? null : budgetMinRes.value,
    b.budget_max !== undefined && budgetMaxRes.value === 0 ? null : budgetMaxRes.value,
    b.districts !== undefined && b.districts !== null ? safeTrim(b.districts) : existing.districts,
    b.need_note !== undefined && b.need_note !== null ? safeTrim(b.need_note) : existing.need_note,
    status,
    urgency,
    targetDate,
    source,
    university,
    existing.id
  );

  if (status === 'da_chot') {
    saveCustomerDeal(existing.id, b, existing);
  }

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id);
  broadcastEvent('customers_changed', { action: 'updated', customerId: updated.id });
  res.json(enrichCustomer(updated));
}

router.put('/customers/:id', handleUpdateCustomer);
router.patch('/customers/:id', handleUpdateCustomer);

router.post('/customers/:id/close-deal', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID khách hàng không hợp lệ' });
  }

  const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  }

  const b = req.body || {};
  db.prepare(
    `UPDATE customers SET status = 'da_chot', updated_at = datetime('now', 'localtime') WHERE id = ?`
  ).run(id);

  const dealId = saveCustomerDeal(id, b, existing);

  const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  broadcastEvent('customers_changed', { action: 'updated', customerId: updated.id });

  const deal = db
    .prepare(
      `
    SELECT
      d.*,
      c.name AS customer_name,
      c.zalo_phone AS customer_zalo
    FROM deals d
    JOIN customers c ON c.id = d.customer_id
    WHERE d.id = ?
  `
    )
    .get(dealId);

  res.status(200).json({ customer: enrichCustomer(updated), deal });
});

router.delete('/customers/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID khách hàng không hợp lệ' });
  }

  const existing = db.prepare('SELECT id FROM customers WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  }
  db.prepare('DELETE FROM customers WHERE id = ?').run(existing.id);
  broadcastEvent('customers_changed', { action: 'deleted', customerId: existing.id });
  broadcastEvent('deals_changed', { action: 'deleted', customerId: existing.id });
  res.json({ ok: true });
});

router.get('/sends', (req, res) => {
  const rows = db
    .prepare(
      `
      SELECT s.*, c.name AS customer_name, c.zalo_phone AS customer_zalo
      FROM sends s
      JOIN customers c ON c.id = s.customer_id
      ORDER BY s.sent_at DESC, s.id DESC
      LIMIT 100
    `
    )
    .all();

  res.json(
    rows.map((r) => {
      let roomIds = [];
      try {
        const parsed = JSON.parse(r.room_ids || '[]');
        if (Array.isArray(parsed)) roomIds = parsed;
      } catch {
        roomIds = [];
      }
      return { ...r, room_ids: roomIds };
    })
  );
});

router.post('/sends', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const { customer_id, room_ids = [], message = '' } = req.body || {};
  if (!customer_id) {
    return res.status(400).json({ error: 'Cần chọn khách hàng' });
  }
  const customerId = parsePositiveIntId(customer_id);
  if (!customerId) {
    return res.status(400).json({ error: 'ID khách hàng không hợp lệ' });
  }

  const customer = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
  if (!customer) {
    return res.status(404).json({ error: 'Không tìm thấy khách hàng' });
  }

  if (room_ids !== undefined && !Array.isArray(room_ids)) {
    return res.status(400).json({ error: 'room_ids phải là danh sách ID phòng' });
  }

  const normalizedIds = [];
  for (const rawId of room_ids || []) {
    const rid = parsePositiveIntId(rawId);
    if (!rid) {
      return res.status(400).json({ error: 'Danh sách ID phòng không hợp lệ' });
    }
    normalizedIds.push(rid);
  }

  const result = db
    .prepare(
      `INSERT INTO sends (customer_id, room_ids, sent_at, message)
       VALUES (?, ?, datetime('now', 'localtime'), ?)`
    )
    .run(customer.id, JSON.stringify(normalizedIds), safeTrim(message));

  db.prepare("UPDATE customers SET updated_at = datetime('now', 'localtime') WHERE id = ?").run(
    customer.id
  );

  const created = db.prepare('SELECT * FROM sends WHERE id = ?').get(result.lastInsertRowid);
  broadcastEvent('customers_changed', { action: 'send_recorded', customerId: customer.id });
  res.status(201).json({ ...created, room_ids: normalizedIds });
});

export default router;

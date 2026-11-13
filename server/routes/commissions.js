import { Router } from 'express';
import db from '../db.js';
import { broadcastEvent } from '../services/sse.js';
import {
  ALLOWED_COMMISSION_STATUSES,
  isPlainObject,
  parseOptionalNonNegativeFloat,
  parseOptionalNonNegativeInt,
  parsePositiveIntId,
  safeTrim,
} from '../utils/validation.js';

const router = Router();

function getFullDealById(dealId) {
  return db
    .prepare(
      `
    SELECT
      d.*,
      c.name AS customer_name,
      c.zalo_phone AS customer_zalo,
      r.status AS room_current_status
    FROM deals d
    JOIN customers c ON c.id = d.customer_id
    LEFT JOIN rooms r ON r.id = d.room_id
    WHERE d.id = ?
  `
    )
    .get(dealId);
}

// 1. List deals
router.get(['/', '/commissions'], (req, res) => {
  const { month, status, q, limit = 100, offset = 0 } = req.query;

  let sql = `
    SELECT
      d.*,
      c.name AS customer_name,
      c.zalo_phone AS customer_zalo,
      r.status AS room_current_status
    FROM deals d
    JOIN customers c ON c.id = d.customer_id
    LEFT JOIN rooms r ON r.id = d.room_id
    WHERE 1=1
  `;
  const params = [];

  if (month && month !== 'all') {
    sql += ` AND substr(d.deal_date, 1, 7) = ?`;
    params.push(safeTrim(month));
  }

  if (status && status !== 'all') {
    const trimmedStatus = safeTrim(status);
    if (ALLOWED_COMMISSION_STATUSES.includes(trimmedStatus)) {
      sql += ` AND d.commission_status = ?`;
      params.push(trimmedStatus);
    }
  }

  if (q && safeTrim(q)) {
    const term = `%${safeTrim(q)}%`;
    sql += ` AND (c.name LIKE ? OR c.zalo_phone LIKE ? OR d.room_code LIKE ? OR d.address LIKE ? OR d.district LIKE ? OR d.note LIKE ?)`;
    params.push(term, term, term, term, term, term);
  }

  sql += ` ORDER BY d.deal_date DESC, d.id DESC`;

  const parsedLimit = parsePositiveIntId(limit) || 100;
  const parsedOffset = parseOptionalNonNegativeInt(offset, 0).value || 0;
  sql += ` LIMIT ? OFFSET ?`;
  params.push(parsedLimit, parsedOffset);

  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// 2. Stats endpoint
router.get(['/stats', '/commissions/stats'], (req, res) => {
  const { month } = req.query;

  let sql = `
    SELECT
      COUNT(*) AS total_deals,
      COALESCE(SUM(d.price), 0) AS total_rent_value,
      COALESCE(SUM(d.commission_amount), 0) AS total_commission,
      COALESCE(SUM(
        CASE
          WHEN d.commission_status = 'da_thu' THEN
            CASE WHEN d.commission_received > 0 THEN d.commission_received ELSE d.commission_amount END
          ELSE d.commission_received
        END
      ), 0) AS received_commission,
      COUNT(CASE WHEN d.commission_status = 'cho_thu' THEN 1 END) AS count_cho_thu,
      COUNT(CASE WHEN d.commission_status = 'da_thu' THEN 1 END) AS count_da_thu,
      COUNT(CASE WHEN d.commission_status = 'thu_mot_phan' THEN 1 END) AS count_thu_mot_phan
    FROM deals d
    JOIN customers c ON c.id = d.customer_id
    WHERE 1=1
  `;
  const params = [];

  if (month && month !== 'all') {
    sql += ` AND substr(d.deal_date, 1, 7) = ?`;
    params.push(safeTrim(month));
  }

  const row = db.prepare(sql).get(...params);
  const totalDeals = row ? Number(row.total_deals) : 0;
  const totalRentValue = row ? Number(row.total_rent_value) : 0;
  const totalCommission = row ? Number(row.total_commission) : 0;
  const receivedCommission = row ? Number(row.received_commission) : 0;
  const pendingCommission = Math.max(0, totalCommission - receivedCommission);

  res.json({
    total_deals: totalDeals,
    total_rent_value: totalRentValue,
    total_commission: totalCommission,
    received_commission: receivedCommission,
    pending_commission: pendingCommission,
    count_cho_thu: row ? Number(row.count_cho_thu) : 0,
    count_da_thu: row ? Number(row.count_da_thu) : 0,
    count_thu_mot_phan: row ? Number(row.count_thu_mot_phan) : 0,
  });
});

// 3. Create a deal directly
router.post(['/', '/commissions'], (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const b = req.body || {};
  let customerId = parsePositiveIntId(b.customer_id);
  const customerName = safeTrim(b.customer_name ?? b.name);

  if (!customerId && !customerName) {
    return res.status(400).json({ error: 'Cần chọn hoặc nhập khách hàng' });
  }

  if (customerId) {
    const cust = db.prepare('SELECT id FROM customers WHERE id = ?').get(customerId);
    if (!cust) {
      return res.status(404).json({ error: 'Khách hàng không tồn tại' });
    }
  } else {
    const ins = db
      .prepare(
        `
      INSERT INTO customers (name, zalo_phone, status, created_at, updated_at)
      VALUES (?, ?, 'da_chot', datetime('now', 'localtime'), datetime('now', 'localtime'))
    `
      )
      .run(customerName, safeTrim(b.customer_zalo ?? b.zalo_phone));
    customerId = ins.lastInsertRowid;
    broadcastEvent('customers_changed', { action: 'created', customerId });
  }

  const roomId = parsePositiveIntId(b.room_id);
  let roomCode = safeTrim(b.room_code);
  let address = safeTrim(b.address);
  let district = safeTrim(b.district);
  const priceRes = parseOptionalNonNegativeInt(b.price, 0);
  let price = priceRes.ok ? priceRes.value : 0;

  if (roomId) {
    const room = db
      .prepare('SELECT id, code, address, street, district, price FROM rooms WHERE id = ?')
      .get(roomId);
    if (room) {
      if (!roomCode) roomCode = room.code || '';
      if (!address) address = room.address || room.street || '';
      if (!district) district = room.district || '';
      if (price === 0 && room.price > 0) price = room.price;
    }
  }

  const rateRes = parseOptionalNonNegativeFloat(b.commission_rate, 50);
  const commissionRate = rateRes.ok && rateRes.value !== null ? rateRes.value : 50;

  const commRes = parseOptionalNonNegativeInt(b.commission_amount, null);
  let commissionAmount = commRes.ok && commRes.value !== null ? commRes.value : null;
  if (commissionAmount === null) {
    commissionAmount = price > 0 ? Math.round(price * (commissionRate / 100)) : 0;
  }

  let dealDate = safeTrim(b.deal_date);
  if (!dealDate) {
    dealDate = new Date().toLocaleDateString('en-CA');
  }

  const moveInDate = safeTrim(b.move_in_date);
  let commissionStatus = safeTrim(b.commission_status) || 'cho_thu';
  if (!ALLOWED_COMMISSION_STATUSES.includes(commissionStatus)) {
    return res.status(400).json({ error: 'Trạng thái hoa hồng không hợp lệ' });
  }

  const recvRes = parseOptionalNonNegativeInt(b.commission_received, 0);
  let commissionReceived = recvRes.ok ? recvRes.value : 0;
  if (commissionStatus === 'da_thu' && commissionReceived === 0 && commissionAmount > 0) {
    commissionReceived = commissionAmount;
  }

  const note = safeTrim(b.note);

  const ins = db
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
      roomId,
      roomCode,
      address,
      district,
      price,
      commissionRate,
      commissionAmount,
      dealDate,
      moveInDate,
      commissionStatus,
      commissionReceived,
      note
    );

  const dealId = ins.lastInsertRowid;

  // Sync to customer record
  db.prepare(
    `
    UPDATE customers SET
      status = 'da_chot',
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
    roomId,
    roomCode,
    address,
    district,
    price,
    dealDate,
    commissionAmount,
    commissionStatus,
    customerId
  );

  // If mark_room_rented
  if (roomId && b.mark_room_rented) {
    const targetStatus =
      typeof b.mark_room_rented === 'string' && ['da_coc', 'da_thue'].includes(b.mark_room_rented)
        ? b.mark_room_rented
        : 'da_thue';
    db.prepare(
      `UPDATE rooms SET status = ?, status_changed_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(targetStatus, roomId);
    broadcastEvent('rooms_changed', { action: 'status_updated', roomId, status: targetStatus });
  }

  broadcastEvent('deals_changed', { action: 'created', dealId, customerId });
  broadcastEvent('customers_changed', { action: 'updated', customerId });

  const deal = getFullDealById(dealId);
  res.status(201).json(deal);
});

// 4. Quick update status
router.patch('/:id/status', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID chốt deal không hợp lệ' });
  }

  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy thông tin hoa hồng' });
  }

  const b = req.body || {};
  const status = safeTrim(b.commission_status ?? b.status);
  if (!status || !ALLOWED_COMMISSION_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Trạng thái hoa hồng không hợp lệ' });
  }

  let received = existing.commission_received;
  if (b.commission_received !== undefined || b.received !== undefined) {
    const recvRes = parseOptionalNonNegativeInt(b.commission_received ?? b.received, 0);
    if (!recvRes.ok) {
      return res.status(400).json({ error: 'Số tiền hoa hồng đã thu không hợp lệ' });
    }
    received = recvRes.value;
  } else {
    if (status === 'da_thu') {
      received = existing.commission_amount;
    } else if (status === 'cho_thu') {
      received = 0;
    }
  }

  db.prepare(
    `
    UPDATE deals SET
      commission_status = ?,
      commission_received = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `
  ).run(status, received, existing.id);

  // Sync to customer
  db.prepare(
    `
    UPDATE customers SET
      deal_commission_status = ?,
      updated_at = datetime('now', 'localtime')
    WHERE id = ?
  `
  ).run(status, existing.customer_id);

  broadcastEvent('deals_changed', { action: 'status_updated', dealId: existing.id });
  broadcastEvent('customers_changed', { action: 'updated', customerId: existing.customer_id });

  const updated = getFullDealById(existing.id);
  res.json(updated);
});

// 5. Get single deal
router.get('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID không hợp lệ' });
  }

  const deal = getFullDealById(id);
  if (!deal) {
    return res.status(404).json({ error: 'Không tìm thấy deal hoa hồng' });
  }

  res.json(deal);
});

// 6. Update full deal
router.put('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID không hợp lệ' });
  }

  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy deal hoa hồng' });
  }

  const b = req.body || {};
  const roomId =
    b.room_id !== undefined ? parsePositiveIntId(b.room_id) : existing.room_id;
  let roomCode =
    b.room_code !== undefined ? safeTrim(b.room_code) : existing.room_code;
  let address = b.address !== undefined ? safeTrim(b.address) : existing.address;
  let district =
    b.district !== undefined ? safeTrim(b.district) : existing.district;

  let price = existing.price;
  if (b.price !== undefined) {
    const pRes = parseOptionalNonNegativeInt(b.price, 0);
    if (!pRes.ok) return res.status(400).json({ error: 'Giá thuê không hợp lệ' });
    price = pRes.value;
  }

  let commissionRate = existing.commission_rate;
  if (b.commission_rate !== undefined) {
    const rRes = parseOptionalNonNegativeFloat(b.commission_rate, 50);
    if (!rRes.ok) return res.status(400).json({ error: 'Tỉ lệ hoa hồng không hợp lệ' });
    commissionRate = rRes.value;
  }

  let commissionAmount = existing.commission_amount;
  if (b.commission_amount !== undefined) {
    const cRes = parseOptionalNonNegativeInt(b.commission_amount, 0);
    if (!cRes.ok) return res.status(400).json({ error: 'Số tiền hoa hồng không hợp lệ' });
    commissionAmount = cRes.value;
  } else if (b.price !== undefined || b.commission_rate !== undefined) {
    commissionAmount = price > 0 ? Math.round(price * (commissionRate / 100)) : 0;
  }

  let dealDate = b.deal_date !== undefined ? safeTrim(b.deal_date) : existing.deal_date;
  let moveInDate =
    b.move_in_date !== undefined ? safeTrim(b.move_in_date) : existing.move_in_date;

  let commissionStatus =
    b.commission_status !== undefined
      ? safeTrim(b.commission_status)
      : existing.commission_status;
  if (!ALLOWED_COMMISSION_STATUSES.includes(commissionStatus)) {
    return res.status(400).json({ error: 'Trạng thái hoa hồng không hợp lệ' });
  }

  let commissionReceived = existing.commission_received;
  if (b.commission_received !== undefined) {
    const recvRes = parseOptionalNonNegativeInt(b.commission_received, 0);
    if (!recvRes.ok) return res.status(400).json({ error: 'Số tiền đã thu không hợp lệ' });
    commissionReceived = recvRes.value;
  }

  let note = b.note !== undefined ? safeTrim(b.note) : existing.note;

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
    roomId,
    roomCode,
    address,
    district,
    price,
    commissionRate,
    commissionAmount,
    dealDate,
    moveInDate,
    commissionStatus,
    commissionReceived,
    note,
    existing.id
  );

  // Sync to customer record
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
    roomId,
    roomCode,
    address,
    district,
    price,
    dealDate,
    commissionAmount,
    commissionStatus,
    existing.customer_id
  );

  if (roomId && b.mark_room_rented) {
    const targetStatus =
      typeof b.mark_room_rented === 'string' && ['da_coc', 'da_thue'].includes(b.mark_room_rented)
        ? b.mark_room_rented
        : 'da_thue';
    db.prepare(
      `UPDATE rooms SET status = ?, status_changed_at = datetime('now', 'localtime'), updated_at = datetime('now', 'localtime') WHERE id = ?`
    ).run(targetStatus, roomId);
    broadcastEvent('rooms_changed', { action: 'status_updated', roomId, status: targetStatus });
  }

  broadcastEvent('deals_changed', { action: 'updated', dealId: existing.id });
  broadcastEvent('customers_changed', { action: 'updated', customerId: existing.customer_id });

  const updated = getFullDealById(existing.id);
  res.json(updated);
});

// 7. Delete deal
router.delete('/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID không hợp lệ' });
  }

  const existing = db.prepare('SELECT * FROM deals WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: 'Không tìm thấy deal hoa hồng' });
  }

  db.prepare('DELETE FROM deals WHERE id = ?').run(existing.id);

  // Clear customer deal columns if customer has no other deals
  const otherDeal = db
    .prepare('SELECT id FROM deals WHERE customer_id = ? LIMIT 1')
    .get(existing.customer_id);
  if (!otherDeal) {
    db.prepare(
      `
      UPDATE customers SET
        deal_room_id = NULL,
        deal_room_code = '',
        deal_address = '',
        deal_district = '',
        deal_price = 0,
        deal_date = '',
        deal_commission = 0,
        deal_commission_status = 'cho_thu',
        updated_at = datetime('now', 'localtime')
      WHERE id = ?
    `
    ).run(existing.customer_id);
  }

  broadcastEvent('deals_changed', { action: 'deleted', dealId: existing.id });
  broadcastEvent('customers_changed', { action: 'updated', customerId: existing.customer_id });

  res.json({ ok: true });
});

export default router;

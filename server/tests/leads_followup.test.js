import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PassThrough } from 'node:stream';

// Isolated DB for this test suite
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '.sale-tro-leads-followup-test-'));
const tempDbPath = path.join(tempDir, 'test-leads.db');
const tempImagesDir = path.join(tempDir, 'images');

process.env.DB_PATH = tempDbPath;
process.env.IMAGES_DIR = tempImagesDir;

const { default: db } = await import('../db.js');
const { app } = await import('../index.js');
const { stopSyncScheduler } = await import('../services/sheetSync.js');
const { getTodayBangkokDateString, calculateDaysUntilTarget, enrichCustomer } = await import(
  '../utils/customerUtils.js'
);

async function dispatchApp(targetApp, urlPath, options = {}) {
  const webReq = new Request(`http://127.0.0.1${urlPath}`, options);
  const bodyBuf = webReq.body ? Buffer.from(await webReq.arrayBuffer()) : Buffer.alloc(0);

  const reqSocket = new PassThrough();
  reqSocket.remoteAddress = '127.0.0.1';

  const req = new http.IncomingMessage(reqSocket);
  req.method = webReq.method;
  req.url = urlPath;
  req.headers = Object.fromEntries(webReq.headers.entries());
  if (bodyBuf.length > 0) {
    req.headers['content-length'] = String(bodyBuf.length);
  }
  req.push(bodyBuf.length > 0 ? bodyBuf : null);
  if (bodyBuf.length > 0) {
    req.push(null);
  }

  const res = new http.ServerResponse(req);
  res.useChunkedEncodingByDefault = false;
  const outChunks = [];
  const resSocket = new PassThrough();
  resSocket.writable = true;
  resSocket.write = (chunk, encoding, cb) => {
    outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof encoding === 'function') encoding();
    else if (typeof cb === 'function') cb();
    return true;
  };
  res.assignSocket(resSocket);

  await new Promise((resolve, reject) => {
    res.on('finish', resolve);
    res.on('error', reject);
    targetApp(req, res);
  });

  const raw = Buffer.concat(outChunks);
  const sepIdx = raw.indexOf('\r\n\r\n');
  const bodyRaw = sepIdx !== -1 ? raw.subarray(sepIdx + 4) : raw;
  const text = bodyRaw.toString('utf8');

  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  return { status: res.statusCode, headers: res.getHeaders(), data: json, rawBody: bodyRaw };
}

function apiFetch(urlPath, options = {}) {
  return dispatchApp(app, urlPath, options);
}

function jsonRequest(method, urlPath, body) {
  return apiFetch(urlPath, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function offsetDate(days) {
  const today = getTodayBangkokDateString();
  const [y, m, d] = today.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const oY = dt.getUTCFullYear();
  const oM = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const oD = String(dt.getUTCDate()).padStart(2, '0');
  return `${oY}-${oM}-${oD}`;
}

describe('Customer Leads & Follow-up Reminders Backend', () => {
  after(() => {
    stopSyncScheduler();
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('Migration 5: creates urgency, target_date, and source columns in customers table with correct defaults', () => {
    const cols = db.prepare('PRAGMA table_info(customers)').all();
    const colMap = Object.fromEntries(cols.map((c) => [c.name, c]));

    assert.ok(colMap.urgency, 'Column urgency must exist');
    assert.equal(colMap.urgency.type, 'TEXT');
    assert.equal(colMap.urgency.dflt_value, "'binh_thuong'");

    assert.ok(colMap.target_date, 'Column target_date must exist');
    assert.equal(colMap.target_date.type, 'TEXT');
    assert.equal(colMap.target_date.dflt_value, "''");

    assert.ok(colMap.source, 'Column source must exist');
    assert.equal(colMap.source.type, 'TEXT');
    assert.equal(colMap.source.dflt_value, "'manual'");
  });

  it('POST /api/public/leads accepts urgency, target_date and sets source=web_form, status=chua_cham', async () => {
    const moveDate = offsetDate(5);
    const res = await jsonRequest('POST', '/api/public/leads', {
      name: 'Nguyễn Văn Lead',
      zalo_phone: '0988112233',
      budget_min: 3000000,
      budget_max: 5000000,
      districts: 'Cầu Giấy, Nam Từ Liêm',
      need_note: 'Cần tìm phòng ban công rộng, có thang máy',
      urgency: 'gap',
      target_date: moveDate,
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);
    assert.ok(res.data.customerId);

    // Verify customer in database
    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(res.data.customerId);
    assert.ok(cust);
    assert.equal(cust.name, 'Nguyễn Văn Lead');
    assert.equal(cust.zalo_phone, '0988112233');
    assert.equal(cust.status, 'chua_cham');
    assert.equal(cust.source, 'web_form');
    assert.equal(cust.urgency, 'gap');
    assert.equal(cust.target_date, moveDate);
    assert.equal(cust.budget_min, 3000000);
    assert.equal(cust.budget_max, 5000000);

    // Verify enriched response fields
    assert.equal(res.data.customer.is_urgent, true);
    assert.equal(res.data.customer.days_until_target, 5);
    assert.equal(res.data.customer.needs_followup_reminder, true);
  });

  it('POST /api/leads supports alternate field names (phone, budget, district, note, move_in_date)', async () => {
    const moveDate = offsetDate(15);
    const res = await jsonRequest('POST', '/api/leads', {
      name: 'Trần Thị Thuê',
      phone: '0977445566',
      budget: 4200000,
      district: 'Đống Đa',
      note: 'Ưu tiên gần đường Láng',
      move_in_date: moveDate,
      urgency: 'hen_truoc',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);

    const cust = db.prepare('SELECT * FROM customers WHERE id = ?').get(res.data.customerId);
    assert.equal(cust.name, 'Trần Thị Thuê');
    assert.equal(cust.zalo_phone, '0977445566');
    assert.equal(cust.budget_max, 4200000);
    assert.equal(cust.districts, 'Đống Đa');
    assert.equal(cust.urgency, 'hen_truoc');
    assert.equal(cust.target_date, moveDate);
    assert.equal(cust.source, 'web_form');
    assert.equal(cust.status, 'chua_cham');

    assert.equal(res.data.customer.is_urgent, false);
    assert.equal(res.data.customer.days_until_target, 15);
    assert.equal(res.data.customer.needs_followup_reminder, true);
  });

  it('POST /api/customers includes urgency, target_date, and source', async () => {
    const moveDate = offsetDate(20);
    const res = await jsonRequest('POST', '/api/customers', {
      name: 'Khách Nhập Tay',
      zalo_phone: '0909123456',
      districts: 'Thanh Xuân',
      urgency: 'gap',
      target_date: moveDate,
      source: 'manual',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.name, 'Khách Nhập Tay');
    assert.equal(res.data.urgency, 'gap');
    assert.equal(res.data.target_date, moveDate);
    assert.equal(res.data.source, 'manual');
    assert.equal(res.data.is_urgent, true);
    assert.equal(res.data.days_until_target, 20);
    assert.equal(res.data.needs_followup_reminder, true);
  });

  it('PUT and PATCH /api/customers/:id update urgency, target_date, and source', async () => {
    // Create baseline customer
    const createRes = await jsonRequest('POST', '/api/customers', {
      name: 'Khách Cần Sửa',
      zalo_phone: '0911223344',
      districts: 'Ba Đình',
      urgency: 'binh_thuong',
      target_date: '',
    });
    const custId = createRes.data.id;
    assert.equal(createRes.data.is_urgent, false);
    assert.equal(createRes.data.needs_followup_reminder, false);

    // Update via PUT
    const targetDatePut = offsetDate(10);
    const putRes = await jsonRequest('PUT', `/api/customers/${custId}`, {
      name: 'Khách Cần Sửa (Đã đổi tên)',
      urgency: 'gap',
      target_date: targetDatePut,
    });
    assert.equal(putRes.status, 200);
    assert.equal(putRes.data.name, 'Khách Cần Sửa (Đã đổi tên)');
    assert.equal(putRes.data.urgency, 'gap');
    assert.equal(putRes.data.target_date, targetDatePut);
    assert.equal(putRes.data.is_urgent, true);
    assert.equal(putRes.data.days_until_target, 10);
    assert.equal(putRes.data.needs_followup_reminder, true);

    // Partial update via PATCH
    const patchRes = await jsonRequest('PATCH', `/api/customers/${custId}`, {
      urgency: 'hen_truoc',
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.urgency, 'hen_truoc');
    assert.equal(patchRes.data.target_date, targetDatePut); // preserved
    assert.equal(patchRes.data.is_urgent, false);
    assert.equal(patchRes.data.needs_followup_reminder, true);
  });

  it('GET /api/customers enriches calculated properties and reminder logic accurately', async () => {
    // Clear out customers for deterministic tests
    db.exec('DELETE FROM sends; DELETE FROM deals; DELETE FROM customers;');

    // 1. Target in 5 days, chua_cham -> reminder true
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách 5 Ngày',
      status: 'chua_cham',
      urgency: 'binh_thuong',
      target_date: offsetDate(5),
    });

    // 2. Target today (0 days), da_cham -> reminder true
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách Hôm Nay',
      status: 'da_cham',
      urgency: 'gap',
      target_date: offsetDate(0),
    });

    // 3. Target 7 days ago (-7 days), da_cham -> reminder true
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách 7 Ngày Trước',
      status: 'da_cham',
      urgency: 'binh_thuong',
      target_date: offsetDate(-7),
    });

    // 4. Target 30 days ahead (+30 days), chua_cham -> reminder true
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách 30 Ngày Tới',
      status: 'chua_cham',
      urgency: 'binh_thuong',
      target_date: offsetDate(30),
    });

    // 5. Target 35 days ahead (+35 days), chua_cham -> reminder false (>30 days)
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách Xa 35 Ngày',
      status: 'chua_cham',
      urgency: 'binh_thuong',
      target_date: offsetDate(35),
    });

    // 6. Target 8 days ago (-8 days), da_cham -> reminder false (<-7 days)
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách Quá Hạn 8 Ngày',
      status: 'da_cham',
      urgency: 'binh_thuong',
      target_date: offsetDate(-8),
    });

    // 7. Status da_chot with target in 3 days -> reminder false (already closed)
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách Đã Chốt',
      status: 'da_chot',
      urgency: 'gap',
      target_date: offsetDate(3),
    });

    // 8. Status huy with target in 3 days -> reminder false (cancelled)
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách Đã Huỷ',
      status: 'huy',
      urgency: 'gap',
      target_date: offsetDate(3),
    });

    // 9. No target_date -> reminder false, days_until_target is null
    await jsonRequest('POST', '/api/customers', {
      name: 'Khách Không Có Ngày',
      status: 'chua_cham',
      urgency: 'gap',
      target_date: '',
    });

    const getRes = await apiFetch('/api/customers');
    assert.equal(getRes.status, 200);
    const list = getRes.data;

    const findCust = (name) => list.find((c) => c.name === name);

    const c1 = findCust('Khách 5 Ngày');
    assert.equal(c1.days_until_target, 5);
    assert.equal(c1.is_urgent, false);
    assert.equal(c1.needs_followup_reminder, true);

    const c2 = findCust('Khách Hôm Nay');
    assert.equal(c2.days_until_target, 0);
    assert.equal(c2.is_urgent, true);
    assert.equal(c2.needs_followup_reminder, true);

    const c3 = findCust('Khách 7 Ngày Trước');
    assert.equal(c3.days_until_target, -7);
    assert.equal(c3.needs_followup_reminder, true);

    const c4 = findCust('Khách 30 Ngày Tới');
    assert.equal(c4.days_until_target, 30);
    assert.equal(c4.needs_followup_reminder, true);

    const c5 = findCust('Khách Xa 35 Ngày');
    assert.equal(c5.days_until_target, 35);
    assert.equal(c5.needs_followup_reminder, false);

    const c6 = findCust('Khách Quá Hạn 8 Ngày');
    assert.equal(c6.days_until_target, -8);
    assert.equal(c6.needs_followup_reminder, false);

    const c7 = findCust('Khách Đã Chốt');
    assert.equal(c7.days_until_target, 3);
    assert.equal(c7.is_urgent, true);
    assert.equal(c7.needs_followup_reminder, false);

    const c8 = findCust('Khách Đã Huỷ');
    assert.equal(c8.days_until_target, 3);
    assert.equal(c8.is_urgent, true);
    assert.equal(c8.needs_followup_reminder, false);

    const c9 = findCust('Khách Không Có Ngày');
    assert.equal(c9.days_until_target, null);
    assert.equal(c9.is_urgent, true);
    assert.equal(c9.needs_followup_reminder, false);

    // Test filter ?needs_reminder=true
    const reminderRes = await apiFetch('/api/customers?needs_reminder=true');
    assert.equal(reminderRes.status, 200);
    const reminderNames = reminderRes.data.map((c) => c.name);
    assert.ok(reminderNames.includes('Khách 5 Ngày'));
    assert.ok(reminderNames.includes('Khách Hôm Nay'));
    assert.ok(reminderNames.includes('Khách 7 Ngày Trước'));
    assert.ok(reminderNames.includes('Khách 30 Ngày Tới'));
    assert.ok(!reminderNames.includes('Khách Xa 35 Ngày'));
    assert.ok(!reminderNames.includes('Khách Quá Hạn 8 Ngày'));
    assert.ok(!reminderNames.includes('Khách Đã Chốt'));
    assert.ok(!reminderNames.includes('Khách Đã Huỷ'));
    assert.ok(!reminderNames.includes('Khách Không Có Ngày'));
  });
});

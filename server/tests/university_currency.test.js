import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PassThrough } from 'node:stream';

// Isolated DB for this test suite
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '.sale-tro-university-currency-test-'));
const tempDbPath = path.join(tempDir, 'test-university.db');
const tempImagesDir = path.join(tempDir, 'images');

process.env.DB_PATH = tempDbPath;
process.env.IMAGES_DIR = tempImagesDir;

const { default: db } = await import('../db.js');
const { app } = await import('../index.js');
const { stopSyncScheduler } = await import('../services/sheetSync.js');
const { parseVietnameseCurrency } = await import('../utils/validation.js');

async function dispatchApp(targetApp, urlPath, options = {}) {
  const reqSocket = new PassThrough();
  reqSocket.remoteAddress = '127.0.0.1';

  const req = new http.IncomingMessage(reqSocket);
  req.method = options.method || 'GET';
  req.url = urlPath;
  req.headers = { host: 'localhost', ...(options.headers || {}) };
  if (options.body) {
    const buf = Buffer.from(options.body);
    req.headers['content-length'] = String(buf.length);
    req.push(buf);
    req.push(null);
  } else {
    req.push(null);
  }

  const res = new http.ServerResponse(req);
  res.useChunkedEncodingByDefault = false;
  const outChunks = [];
  const resSocket = new PassThrough();
  resSocket.writable = true;
  resSocket.write = (chunk, encoding, cb) => {
    outChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    if (typeof cb === 'function') cb();
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
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  return {
    status: res.statusCode,
    headers: res.getHeaders(),
    data,
  };
}

function jsonRequest(method, urlPath, body = null, headers = {}) {
  return dispatchApp(app, urlPath, {
    method,
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('parseVietnameseCurrency and University Support', () => {
  after(() => {
    stopSyncScheduler();
    try {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  });

  it('Migration 7: adds university column and index to customers', () => {
    const userVersion = db.prepare('PRAGMA user_version').get();
    assert.ok(userVersion.user_version >= 7, 'user_version should be at least 7');

    const cols = db.prepare('PRAGMA table_info(customers)').all();
    const uniCol = cols.find((c) => c.name === 'university');
    assert.ok(uniCol, 'university column must exist on customers table');
    assert.equal(uniCol.type.toUpperCase(), 'TEXT');

    const indexList = db.prepare(`SELECT name, tbl_name FROM sqlite_master WHERE type = 'index'`).all();
    const uniIndex = indexList.find((i) => i.name === 'idx_customers_university');
    assert.ok(uniIndex, 'idx_customers_university must exist');
    assert.equal(uniIndex.tbl_name, 'customers');
  });

  it('parseVietnameseCurrency: naturally parses Vietnamese currency formats', () => {
    // String formats
    assert.deepEqual(parseVietnameseCurrency('3tr'), { ok: true, value: 3000000 });
    assert.deepEqual(parseVietnameseCurrency('3tr5'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('4tr2'), { ok: true, value: 4200000 });
    assert.deepEqual(parseVietnameseCurrency('3.5tr'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3,5tr'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3500k'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('4m'), { ok: true, value: 4000000 });
    assert.deepEqual(parseVietnameseCurrency('3.5'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3000000'), { ok: true, value: 3000000 });
    assert.deepEqual(parseVietnameseCurrency('3.500.000'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3,500,000'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3 triệu 5'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3 triệu rưỡi'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3tr500k'), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency('3tr05'), { ok: true, value: 3050000 });

    // Numeric formats
    assert.deepEqual(parseVietnameseCurrency(3500000), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency(3.5), { ok: true, value: 3500000 });
    assert.deepEqual(parseVietnameseCurrency(0), { ok: true, value: 0 });
    assert.deepEqual(parseVietnameseCurrency('0'), { ok: true, value: 0 });

    // Empty / null / undefined with default value
    assert.deepEqual(parseVietnameseCurrency(null), { ok: true, value: null });
    assert.deepEqual(parseVietnameseCurrency(undefined), { ok: true, value: null });
    assert.deepEqual(parseVietnameseCurrency(''), { ok: true, value: null });
    assert.deepEqual(parseVietnameseCurrency('   '), { ok: true, value: null });
    assert.deepEqual(parseVietnameseCurrency(null, 0), { ok: true, value: 0 });
    assert.deepEqual(parseVietnameseCurrency(undefined, 500), { ok: true, value: 500 });

    // Invalid / negative
    assert.deepEqual(parseVietnameseCurrency(-5), { ok: false, value: null });
    assert.deepEqual(parseVietnameseCurrency('-3tr'), { ok: false, value: null });
    assert.deepEqual(parseVietnameseCurrency('abc'), { ok: false, value: null });
    assert.deepEqual(parseVietnameseCurrency('thỏa thuận'), { ok: false, value: null });
    assert.deepEqual(parseVietnameseCurrency('invalid', 100), { ok: false, value: 100 });
  });

  it('POST /api/customers accepts university and parses natural budget strings', async () => {
    const res = await jsonRequest('POST', '/api/customers', {
      name: 'Nguyễn Văn Sinh Viên',
      zalo_phone: '0912345678',
      university: 'ĐH Bách Khoa',
      budget_min: '3tr',
      budget_max: '3tr5',
      districts: 'Hai Bà Trưng',
      need_note: 'Tìm phòng gần cổng parabol',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.university, 'ĐH Bách Khoa');
    assert.equal(res.data.budget_min, 3000000);
    assert.equal(res.data.budget_max, 3500000);

    const saved = db.prepare('SELECT * FROM customers WHERE id = ?').get(res.data.id);
    assert.equal(saved.university, 'ĐH Bách Khoa');
    assert.equal(saved.budget_min, 3000000);
    assert.equal(saved.budget_max, 3500000);
  });

  it('GET /api/customers filters by university using search query (q)', async () => {
    // Search query matches university
    const resSearch = await jsonRequest('GET', '/api/customers?q=Bách Khoa');
    assert.equal(resSearch.status, 200);
    assert.ok(Array.isArray(resSearch.data));
    const found = resSearch.data.find((c) => c.university === 'ĐH Bách Khoa');
    assert.ok(found, 'Should find customer with university ĐH Bách Khoa');
    assert.equal(found.budget_min, 3000000);
    assert.equal(found.budget_max, 3500000);

    // Non-matching query returns empty or other results
    const resNone = await jsonRequest('GET', '/api/customers?q=ĐH Bưu Chính Viễn Thông 9999');
    assert.equal(resNone.status, 200);
    const notFound = resNone.data.find((c) => c.university === 'ĐH Bách Khoa');
    assert.equal(notFound, undefined);
  });

  it('PUT /api/customers/:id and PATCH /api/customers/:id update university and budget', async () => {
    // Create customer first
    const createRes = await jsonRequest('POST', '/api/customers', {
      name: 'Lê Hoàng Nam',
      zalo_phone: '0988776655',
      university: 'ĐH Xây Dựng',
      budget_min: '2.5tr',
      budget_max: '3.5tr',
    });
    assert.equal(createRes.status, 201);
    const custId = createRes.data.id;

    // PATCH update university and natural budget
    const patchRes = await jsonRequest('PATCH', `/api/customers/${custId}`, {
      university: 'ĐH Kinh Tế Quốc Dân',
      budget_max: '4tr2',
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.data.university, 'ĐH Kinh Tế Quốc Dân');
    assert.equal(patchRes.data.budget_min, 2500000);
    assert.equal(patchRes.data.budget_max, 4200000);

    // Verify GET customer by ID
    const getRes = await jsonRequest('GET', `/api/customers/${custId}`);
    assert.equal(getRes.status, 200);
    assert.equal(getRes.data.university, 'ĐH Kinh Tế Quốc Dân');
    assert.equal(getRes.data.budget_max, 4200000);
  });

  it('POST /api/leads accepts university and natural budget strings', async () => {
    const res = await jsonRequest('POST', '/api/leads', {
      name: 'Phạm Minh Anh',
      phone: '0933221100',
      university: 'ĐH Ngoại Thương',
      budget: '3tr5',
      district: 'Cầu Giấy',
      note: 'Ưu tiên phòng có ban công',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.customer.university, 'ĐH Ngoại Thương');
    assert.equal(res.data.customer.budget_max, 3500000);

    const saved = db.prepare('SELECT * FROM customers WHERE id = ?').get(res.data.customerId);
    assert.equal(saved.university, 'ĐH Ngoại Thương');
    assert.equal(saved.budget_max, 3500000);
    assert.equal(saved.source, 'web_form');
  });

  it('POST /api/public/leads accepts university and range budgets with 3tr / 4m', async () => {
    const res = await jsonRequest('POST', '/api/public/leads', {
      name: 'Trần Thu Trang',
      phone: '0944556677',
      university: 'ĐHQG Hà Nội',
      budget_min: '3tr',
      budget_max: '4m',
      district: 'Cầu Giấy',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.customer.university, 'ĐHQG Hà Nội');
    assert.equal(res.data.customer.budget_min, 3000000);
    assert.equal(res.data.customer.budget_max, 4000000);
  });

  it('rejects invalid budget inputs with 400 in POST /api/customers', async () => {
    const res = await jsonRequest('POST', '/api/customers', {
      name: 'Lỗi Ngân Sách',
      zalo_phone: '0909090909',
      budget_min: 'không hợp lệ',
    });
    assert.equal(res.status, 400);
    assert.match(res.data.error, /ngân sách/i);
  });
});

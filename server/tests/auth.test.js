import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PassThrough } from 'node:stream';

// Configure isolated temporary DB before importing db and app
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '.sale-tro-auth-test-'));
const tempDbPath = path.join(tempDir, 'test-auth.db');
const tempImagesDir = path.join(tempDir, 'images');

process.env.DB_PATH = tempDbPath;
process.env.IMAGES_DIR = tempImagesDir;

const { default: db } = await import('../db.js');
const { app } = await import('../index.js');
const { stopSyncScheduler } = await import('../services/sheetSync.js');
const { verifyPassword } = await import('../services/auth.js');

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

function jsonRequest(method, urlPath, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return apiFetch(urlPath, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

after(() => {
  stopSyncScheduler();
  try {
    db.close();
  } catch {
    // Ignore
  }
  fs.rmSync(tempDir, { recursive: true, force: true });
});

describe('User Authentication & Role Management', () => {
  it('initial migration seeds admin and sale users with scrypt hashed passwords', () => {
    const admin = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
    assert.ok(admin, 'admin user should exist');
    assert.equal(admin.role, 'admin');
    assert.equal(admin.name, 'Quản trị viên');
    assert.ok(verifyPassword('admin123', admin.password_hash), 'admin password hash should verify admin123');

    const sale = db.prepare('SELECT * FROM users WHERE username = ?').get('sale');
    assert.ok(sale, 'sale user should exist');
    assert.equal(sale.role, 'user');
    assert.equal(sale.name, 'Môi giới Sale');
    assert.ok(verifyPassword('sale123', sale.password_hash), 'sale password hash should verify sale123');
  });

  it('POST /api/auth/login validates credentials and returns user and token', async () => {
    // Missing fields
    const emptyRes = await jsonRequest('POST', '/api/auth/login', {});
    assert.equal(emptyRes.status, 400);

    // Wrong password
    const wrongRes = await jsonRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'wrongpassword',
    });
    assert.equal(wrongRes.status, 401);
    assert.match(wrongRes.data.error, /không chính xác/i);

    // Non-existent user
    const noUserRes = await jsonRequest('POST', '/api/auth/login', {
      username: 'nonexistent_user',
      password: 'password123',
    });
    assert.equal(noUserRes.status, 401);

    // Valid admin login
    const adminRes = await jsonRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    });
    assert.equal(adminRes.status, 200);
    assert.equal(adminRes.data.ok, true);
    assert.equal(adminRes.data.user.username, 'admin');
    assert.equal(adminRes.data.user.role, 'admin');
    assert.ok(adminRes.data.token, 'Must return signed token');

    // Valid sale login
    const saleRes = await jsonRequest('POST', '/api/auth/login', {
      username: 'sale',
      password: 'sale123',
    });
    assert.equal(saleRes.status, 200);
    assert.equal(saleRes.data.ok, true);
    assert.equal(saleRes.data.user.username, 'sale');
    assert.equal(saleRes.data.user.role, 'user');
    assert.ok(saleRes.data.token);
  });

  it('POST /api/auth/register creates user with role user and rejects duplicates/invalid input', async () => {
    // Short username
    const shortUser = await jsonRequest('POST', '/api/auth/register', {
      username: 'ab',
      password: 'validpass',
      name: 'Nguyen Van A',
    });
    assert.equal(shortUser.status, 400);

    // Short password
    const shortPass = await jsonRequest('POST', '/api/auth/register', {
      username: 'sales_agent1',
      password: '12',
      name: 'Nguyen Van A',
    });
    assert.equal(shortPass.status, 400);

    // Missing name
    const missingName = await jsonRequest('POST', '/api/auth/register', {
      username: 'sales_agent1',
      password: 'validpass',
      name: '',
    });
    assert.equal(missingName.status, 400);

    // Successful registration
    const regRes = await jsonRequest('POST', '/api/auth/register', {
      username: 'broker_lan',
      password: 'lanpassword',
      name: 'Mai Thị Lan',
      phone: '0988776655',
      role: 'admin', // Should be ignored; role must default to 'user'
    });
    assert.equal(regRes.status, 201);
    assert.equal(regRes.data.ok, true);
    assert.equal(regRes.data.user.username, 'broker_lan');
    assert.equal(regRes.data.user.role, 'user');
    assert.equal(regRes.data.user.name, 'Mai Thị Lan');
    assert.ok(regRes.data.token);

    // Duplicate username rejection
    const dupRes = await jsonRequest('POST', '/api/auth/register', {
      username: 'broker_lan',
      password: 'anotherpassword',
      name: 'Trùng Tên',
    });
    assert.equal(dupRes.status, 409);
    assert.match(dupRes.data.error, /đã tồn tại/i);
  });

  it('GET /api/auth/me verifies Bearer token and returns authenticated user', async () => {
    // Unauthenticated
    const noToken = await apiFetch('/api/auth/me');
    assert.equal(noToken.status, 401);

    // Invalid token
    const invalidToken = await apiFetch('/api/auth/me', {
      headers: { Authorization: 'Bearer fake.invalid.token' },
    });
    assert.equal(invalidToken.status, 401);

    // Login to get valid token
    const loginRes = await jsonRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    });
    const token = loginRes.data.token;

    const meRes = await apiFetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(meRes.status, 200);
    assert.equal(meRes.data.ok, true);
    assert.equal(meRes.data.user.username, 'admin');
    assert.equal(meRes.data.user.role, 'admin');
  });

  it('GET /api/auth/users lists registered users without password hashes', async () => {
    // Unauthenticated
    const noToken = await apiFetch('/api/auth/users');
    assert.equal(noToken.status, 401);

    // With admin token
    const loginRes = await jsonRequest('POST', '/api/auth/login', {
      username: 'admin',
      password: 'admin123',
    });
    const token = loginRes.data.token;

    const usersRes = await apiFetch('/api/auth/users', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(usersRes.status, 200);
    assert.equal(usersRes.data.ok, true);
    assert.ok(Array.isArray(usersRes.data.users));
    assert.ok(usersRes.data.users.length >= 2);

    for (const u of usersRes.data.users) {
      assert.equal(u.password_hash, undefined, 'Must not leak password_hash');
      assert.ok(u.id);
      assert.ok(u.username);
      assert.ok(u.role);
    }
  });
});

describe('Public Lead Capture Endpoint', () => {
  it('POST /api/public/leads validates required fields', async () => {
    // Missing name
    const res1 = await jsonRequest('POST', '/api/public/leads', {
      phone: '0912345678',
    });
    assert.equal(res1.status, 400);
    assert.match(res1.data.error, /họ tên/i);

    // Missing phone
    const res2 = await jsonRequest('POST', '/api/public/leads', {
      name: 'Nguyen Van Khach',
    });
    assert.equal(res2.status, 400);
    assert.match(res2.data.error, /số điện thoại/i);
  });

  it('POST /api/public/leads creates customer with status chua_cham and formatted need_note', async () => {
    const payload = {
      name: 'Trần Văn Khách',
      phone: '0912345678',
      move_in_date: '15/12',
      budget: 4500000,
      note: 'Ưu tiên phòng có ban công và máy giặt riêng',
      room_code: 'P.201',
      address: 'Số 10 Dịch Vọng Hậu',
      district: 'Cầu Giấy',
    };

    const res = await jsonRequest('POST', '/api/public/leads', payload);
    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);
    assert.ok(res.data.customerId);
    assert.match(res.data.message, /thành công/i);

    // Check customer in database
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(res.data.customerId);
    assert.ok(customer);
    assert.equal(customer.name, 'Trần Văn Khách');
    assert.equal(customer.zalo_phone, '0912345678');
    assert.equal(customer.status, 'chua_cham');
    assert.equal(customer.budget_max, 4500000);
    assert.equal(customer.districts, 'Cầu Giấy');
    assert.ok(customer.need_note.includes('P.201 - Số 10 Dịch Vọng Hậu'));
    assert.ok(customer.need_note.includes('Ngày vào: 15/12'));
    assert.ok(customer.need_note.includes('Ưu tiên phòng có ban công'));
  });

  it('POST /api/public/leads resolves room_code and address automatically if room_id is given', async () => {
    // Insert a room
    const insertRoom = db.prepare(`
      INSERT INTO rooms (code, address, district, price, status)
      VALUES (?, ?, ?, ?, 'trong')
    `).run('P.402', 'Số 50 Xuân Thủy', 'Cầu Giấy', 5200000);
    const roomId = Number(insertRoom.lastInsertRowid);

    const res = await jsonRequest('POST', '/api/public/leads', {
      name: 'Phạm Thị Thảo',
      phone: '0901234567',
      room_id: roomId,
      note: 'Muốn xem phòng vào cuối tuần này',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);

    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(res.data.customerId);
    assert.ok(customer);
    assert.equal(customer.name, 'Phạm Thị Thảo');
    assert.equal(customer.zalo_phone, '0901234567');
    assert.equal(customer.status, 'chua_cham');
    assert.equal(customer.districts, 'Cầu Giấy');
    assert.equal(customer.budget_max, 5200000);
    assert.ok(customer.need_note.includes('P.402 - Số 50 Xuân Thủy'));
    assert.ok(customer.need_note.includes('Ngày vào: Ngay'));
    assert.ok(customer.need_note.includes('Muốn xem phòng vào cuối tuần này'));
  });

  it('supports POST /api/leads alias route', async () => {
    const res = await jsonRequest('POST', '/api/leads', {
      name: 'Khách Alias Route',
      phone: '0977889900',
      district: 'Đống Đa',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);
    assert.ok(res.data.customerId);
  });
});

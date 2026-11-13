import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { PassThrough } from 'node:stream';

// Configure isolated temporary DB, images (inside a dot-prefixed dir to catch dotfile sendFile bugs),
// and google-key paths BEFORE importing server modules
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), '.sale-tro-test-'));
const tempDbPath = path.join(tempDir, 'test.db');
const tempImagesDir = path.join(tempDir, 'images');
const tempGoogleKeyPath = path.join(tempDir, 'google-key.json');

process.env.DB_PATH = tempDbPath;
process.env.IMAGES_DIR = tempImagesDir;
process.env.GOOGLE_KEY_PATH = tempGoogleKeyPath;

const { default: db } = await import('../db.js');
const { app, createApp } = await import('../index.js');
const { parsePrice } = await import('../services/parsePrice.js');
const {
  syncSheetSource,
  parseCsvRows,
  stopSyncScheduler,
  setTestSyncOptions,
  resetTestSyncOptions,
} = await import('../services/sheetSync.js');
const {
  detectHeaderRow,
  detectColumnMap,
  detectDistrict,
  inspectSpreadsheet,
  setTestInspectOptions,
  resetTestInspectOptions,
  tryGsheetsCliRead,
} = await import('../services/autoDetectSheet.js');
const {
  extractDriveFolderId,
  extractDriveFileId,
  parseEmbeddedFolderView,
  resolveDriveFolderImages,
  downloadAndSaveRoomPhotos,
  clearSheetRoomImages,
} = await import('../services/drivePhotoResolver.js');

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

describe('parsePrice', () => {
  it('parses common Vietnamese price formats accurately', () => {
    assert.equal(parsePrice('3tr5'), 3500000);
    assert.equal(parsePrice('3m5'), 3500000);
    assert.equal(parsePrice('3 triệu 5'), 3500000);
    assert.equal(parsePrice('3 triệu rưỡi'), 3500000);
    assert.equal(parsePrice('3,5 tr'), 3500000);
    assert.equal(parsePrice('3.5 triệu'), 3500000);
    assert.equal(parsePrice('4tr'), 4000000);
    assert.equal(parsePrice('3500k'), 3500000);
    assert.equal(parsePrice('3.500k'), 3500000);
    assert.equal(parsePrice('3500000'), 3500000);
    assert.equal(parsePrice('3.500.000'), 3500000);
    assert.equal(parsePrice('3,500,000'), 3500000);
    assert.equal(parsePrice('3,5'), 3500000);
    assert.equal(parsePrice('4.500.000 đ/tháng'), 4500000);
    assert.equal(parsePrice('4tr5/th'), 4500000);
    assert.equal(parsePrice(3.5), 3500000);
    assert.equal(parsePrice(3800000), 3800000);
  });

  it('handles edge cases, negative numbers, and non-price strings safely', () => {
    assert.equal(parsePrice(null), 0);
    assert.equal(parsePrice(undefined), 0);
    assert.equal(parsePrice(''), 0);
    assert.equal(parsePrice('   '), 0);
    assert.equal(parsePrice(0), 0);
    assert.equal(parsePrice(-5), 0);
    assert.equal(parsePrice('-3tr'), 0);
    assert.equal(parsePrice('-3500k'), 0);
    assert.equal(parsePrice(Number.NaN), 0);
    assert.equal(parsePrice(Number.POSITIVE_INFINITY), 0);
    assert.equal(parsePrice('thỏa thuận'), 0);
    assert.equal(parsePrice('liên hệ'), 0);
    assert.equal(parsePrice('3tr05'), 3050000);
  });
});

describe('Error handling & input validation', () => {
  it('returns 400 for malformed JSON without 500', async () => {
    const res = await apiFetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"code": "BAD_JSON"',
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.error);
  });

  it('returns 400 for malformed IDs and 404 for missing IDs', async () => {
    const malformed = [
      await apiFetch('/api/rooms/abc'),
      await apiFetch('/api/rooms/1abc'),
      await jsonRequest('PUT', '/api/rooms/-5', { code: 'X' }),
      await jsonRequest('PATCH', '/api/rooms/0/status', { status: 'trong' }),
      await apiFetch('/api/rooms/1.5', { method: 'DELETE' }),
      await apiFetch('/api/landlords/xyz', { method: 'DELETE' }),
      await apiFetch('/api/customers/nope/sends'),
      await apiFetch('/api/images/abc', { method: 'DELETE' }),
      await apiFetch('/api/carts/notanid', { method: 'DELETE' }),
    ];
    for (const r of malformed) {
      assert.equal(r.status, 400, `Expected 400, got ${r.status}: ${JSON.stringify(r.data)}`);
    }

    const notFound = await apiFetch('/api/rooms/999999');
    assert.equal(notFound.status, 404);

    const unknownApi = await apiFetch('/api/does-not-exist');
    assert.equal(unknownApi.status, 404);
    assert.ok(unknownApi.data.error);
  });

  it('returns 400 cleanly when referencing non-existent landlord foreign key', async () => {
    const res = await jsonRequest('POST', '/api/rooms', {
      code: 'FK-FAIL',
      district: 'Cầu Giấy',
      price: 3000000,
      landlord_id: 999999,
    });
    assert.equal(res.status, 400);
    assert.ok(res.data.error);
  });
});

describe('Landlords, Rooms, Filtering, and Bulk Status Update', () => {
  let landlordId;
  let room1Id;
  let room2Id;
  let room3Id;

  it('creates, updates, lists, and validates landlords', async () => {
    const bad = await jsonRequest('POST', '/api/landlords', { name: '   ' });
    assert.equal(bad.status, 400);

    const created = await jsonRequest('POST', '/api/landlords', {
      name: 'Chú An Test',
      phone: '0911222333',
      zalo: '0911222333',
      note: 'Hoa hồng 50%',
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.name, 'Chú An Test');
    landlordId = created.data.id;

    const updated = await jsonRequest('PUT', `/api/landlords/${landlordId}`, {
      phone: '0999888777',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.phone, '0999888777');
    assert.equal(updated.data.name, 'Chú An Test');
  });

  it('performs Room CRUD and filtering', async () => {
    const r1 = await jsonRequest('POST', '/api/rooms', {
      landlord_id: landlordId,
      code: 'CG-101',
      address: 'Số 10 Ngõ Bí Mật',
      street: 'Quan Hoa',
      district: 'Cầu Giấy',
      price: 3500000,
      area_m2: 25,
      status: 'trong',
      private_note: 'Pass cửa 8888',
    });
    assert.equal(r1.status, 201);
    room1Id = r1.data.id;
    assert.equal(r1.data.deposit, 3500000);

    const r2 = await jsonRequest('POST', '/api/rooms', {
      landlord_id: landlordId,
      code: 'TX-202',
      address: 'Số 20 Ngõ Riêng',
      street: 'Khương Trung',
      district: 'Thanh Xuân',
      price: 5200000,
      area_m2: 35,
      status: 'sap_trong',
    });
    assert.equal(r2.status, 201);
    room2Id = r2.data.id;

    const r3 = await jsonRequest('POST', '/api/rooms', {
      code: 'DD-303',
      street: 'Chùa Láng',
      district: 'Đống Đa',
      price: 2800000,
      status: 'da_coc',
    });
    assert.equal(r3.status, 201);
    room3Id = r3.data.id;

    // Filter by district
    const byDistrict = await apiFetch('/api/rooms?district=C%E1%BA%A7u%20Gi%E1%BA%A5y');
    assert.equal(byDistrict.status, 200);
    assert.ok(byDistrict.data.some((r) => r.id === room1Id));
    assert.ok(!byDistrict.data.some((r) => r.id === room2Id));

    // Filter by multi-status & price range
    const byStatusAndPrice = await apiFetch(
      '/api/rooms?status=trong,sap_trong&min_price=3000000&max_price=4000000'
    );
    assert.equal(byStatusAndPrice.status, 200);
    assert.equal(byStatusAndPrice.data.length, 1);
    assert.equal(byStatusAndPrice.data[0].id, room1Id);

    // Search & sort
    const sorted = await apiFetch('/api/rooms?sort=price_asc');
    assert.equal(sorted.status, 200);
    assert.equal(sorted.data[0].id, room3Id);

    // Update room
    const updated = await jsonRequest('PUT', `/api/rooms/${room1Id}`, {
      price: 3600000,
      description: 'Phòng sáng thoáng',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.price, 3600000);
    assert.equal(updated.data.description, 'Phòng sáng thoáng');

    // Get single room
    const fetched = await apiFetch(`/api/rooms/${room1Id}`);
    assert.equal(fetched.status, 200);
    assert.equal(fetched.data.code, 'CG-101');
  });

  it('supports bulk status update PATCH /api/rooms/bulk-status with validation', async () => {
    const badStatus = await jsonRequest('PATCH', '/api/rooms/bulk-status', {
      ids: [room1Id],
      status: 'khong_hop_le',
    });
    assert.equal(badStatus.status, 400);

    const emptyIds = await jsonRequest('PATCH', '/api/rooms/bulk-status', {
      ids: [],
      status: 'da_thue',
    });
    assert.equal(emptyIds.status, 400);

    const badIds = await jsonRequest('PATCH', '/api/rooms/bulk-status', {
      ids: [room1Id, 'abc'],
      status: 'da_thue',
    });
    assert.equal(badIds.status, 400);

    const missingIds = await jsonRequest('PATCH', '/api/rooms/bulk-status', {
      ids: [888888, 999999],
      status: 'da_thue',
    });
    assert.equal(missingIds.status, 404);

    const okRes = await jsonRequest('PATCH', '/api/rooms/bulk-status', {
      ids: [room1Id, room2Id],
      status: 'da_coc',
    });
    assert.equal(okRes.status, 200);
    assert.equal(okRes.data.ok, true);
    assert.equal(okRes.data.updated, 2);
    assert.equal(okRes.data.status, 'da_coc');

    const check1 = await apiFetch(`/api/rooms/${room1Id}`);
    const check2 = await apiFetch(`/api/rooms/${room2Id}`);
    assert.equal(check1.data.status, 'da_coc');
    assert.equal(check2.data.status, 'da_coc');

    // Reset room1Id back to 'trong' and clean up room3Id
    await jsonRequest('PATCH', `/api/rooms/${room1Id}/status`, { status: 'trong' });
    const del3 = await apiFetch(`/api/rooms/${room3Id}`, { method: 'DELETE' });
    assert.equal(del3.status, 200);
  });

  it('tracks landlord room counts and allows landlord delete (setting room.landlord_id null)', async () => {
    const list = await apiFetch('/api/landlords');
    assert.equal(list.status, 200);
    const l = list.data.find((item) => item.id === landlordId);
    assert.ok(l);
    assert.equal(l.total_rooms, 2);
    assert.equal(l.available_rooms, 1);

    const tempLandlord = await jsonRequest('POST', '/api/landlords', { name: 'Chủ nhà xoá' });
    const del = await apiFetch(`/api/landlords/${tempLandlord.data.id}`, { method: 'DELETE' });
    assert.equal(del.status, 200);
  });
});

describe('Images upload, cover promotion, delete, and cleanup', () => {
  let roomId;
  let imgIds = [];

  before(async () => {
    const res = await jsonRequest('POST', '/api/rooms', {
      code: 'IMG-01',
      district: 'Hai Bà Trưng',
      price: 4000000,
      status: 'trong',
    });
    roomId = res.data.id;
  });

  it('uploads multiple images, sets first as cover, promotes another, and deletes safely', async () => {
    // Uploading to non-existent room should 404 without leaving dir behind
    const fd404 = new FormData();
    fd404.append('images', new Blob([Buffer.from('fakeimg1')], { type: 'image/jpeg' }), 'a.jpg');
    const res404 = await apiFetch('/api/rooms/999999/images', { method: 'POST', body: fd404 });
    assert.equal(res404.status, 404);
    assert.equal(fs.existsSync(path.join(tempImagesDir, '999999')), false);

    // Upload 3 images to roomId
    const fd = new FormData();
    fd.append('images', new Blob([Buffer.from('img-content-1')], { type: 'image/jpeg' }), 'one.jpg');
    fd.append('images', new Blob([Buffer.from('img-content-2')], { type: 'image/png' }), 'two.png');
    fd.append('images', new Blob([Buffer.from('img-content-3')], { type: 'image/jpeg' }), 'three.jpg');
    fd.append('meta', JSON.stringify([{ width: 800, height: 600 }, { width: 1024, height: 768 }]));

    const up = await apiFetch(`/api/rooms/${roomId}/images`, { method: 'POST', body: fd });
    assert.equal(up.status, 201);
    assert.equal(up.data.length, 3);
    assert.equal(up.data[0].is_cover, 1);
    assert.equal(up.data[1].is_cover, 0);
    assert.equal(up.data[0].width, 800);
    imgIds = up.data.map((i) => i.id);

    // Promote 2nd image to cover
    const promo = await apiFetch(`/api/images/${imgIds[1]}/cover`, { method: 'PATCH' });
    assert.equal(promo.status, 200);

    // Proxy endpoint serves local image even when IMAGES_DIR is under a dot-prefixed directory
    const proxyRes = await apiFetch(`/api/images/${imgIds[0]}/proxy`);
    assert.equal(proxyRes.status, 200);
    assert.equal(proxyRes.rawBody.toString('utf8'), 'img-content-1');

    const roomAfterPromo = await apiFetch(`/api/rooms/${roomId}`);
    const covers = roomAfterPromo.data.images.filter((i) => i.is_cover === 1);
    assert.equal(covers.length, 1);
    assert.equal(covers[0].id, imgIds[1]);

    // Delete current cover -> next image should be promoted to cover and file removed from disk
    const deletedImg = covers[0];
    const deletedPath = path.join(tempImagesDir, String(roomId), deletedImg.filename);
    assert.equal(fs.existsSync(deletedPath), true);

    const delRes = await apiFetch(`/api/images/${deletedImg.id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    assert.equal(fs.existsSync(deletedPath), false);

    const roomAfterDelete = await apiFetch(`/api/rooms/${roomId}`);
    assert.equal(roomAfterDelete.data.images.length, 2);
    assert.equal(roomAfterDelete.data.images.filter((i) => i.is_cover === 1).length, 1);
  });

  it('cleans up old da_thue rooms while always keeping the cover image', async () => {
    // Upload 2 more images so roomId has 4 images total
    const fd = new FormData();
    fd.append('images', new Blob([Buffer.from('extra-1')], { type: 'image/jpeg' }), 'extra1.jpg');
    fd.append('images', new Blob([Buffer.from('extra-2')], { type: 'image/jpeg' }), 'extra2.jpg');
    const up = await apiFetch(`/api/rooms/${roomId}/images`, { method: 'POST', body: fd });
    assert.equal(up.status, 201);

    // Mark room as da_thue and backdate status_changed_at by 45 days
    await jsonRequest('PATCH', `/api/rooms/${roomId}/status`, { status: 'da_thue' });
    db.prepare(
      "UPDATE rooms SET status_changed_at = datetime('now', 'localtime', '-45 days') WHERE id = ?"
    ).run(roomId);

    const roomBefore = await apiFetch(`/api/rooms/${roomId}`);
    assert.equal(roomBefore.data.images.length, 4);
    const coverBefore = roomBefore.data.images.find((i) => i.is_cover === 1);
    assert.ok(coverBefore);

    // Also create a recent da_thue room (5 days old) that MUST NOT be cleaned
    const recentRoom = await jsonRequest('POST', '/api/rooms', {
      code: 'RECENT-01',
      district: 'Cầu Giấy',
      price: 3000000,
      status: 'da_thue',
    });
    const fdRecent = new FormData();
    fdRecent.append('images', new Blob([Buffer.from('recent-1')], { type: 'image/jpeg' }), 'r1.jpg');
    fdRecent.append('images', new Blob([Buffer.from('recent-2')], { type: 'image/jpeg' }), 'r2.jpg');
    await apiFetch(`/api/rooms/${recentRoom.data.id}/images`, { method: 'POST', body: fdRecent });

    // Run cleanup with 30 days threshold
    const cleanupRes = await jsonRequest('POST', '/api/storage/cleanup', { days: 30 });
    assert.equal(cleanupRes.status, 200);
    assert.equal(cleanupRes.data.ok, true);
    assert.equal(cleanupRes.data.cleanedRooms, 1);
    assert.equal(cleanupRes.data.deletedFiles, 3);

    // Verify expired room keeps ONLY its cover image on disk & DB
    const roomAfter = await apiFetch(`/api/rooms/${roomId}`);
    assert.equal(roomAfter.data.images.length, 1);
    assert.equal(roomAfter.data.images[0].id, coverBefore.id);
    assert.equal(roomAfter.data.images[0].is_cover, 1);
    assert.equal(
      fs.existsSync(path.join(tempImagesDir, String(roomId), coverBefore.filename)),
      true
    );

    // Verify recent room kept both images
    const recentAfter = await apiFetch(`/api/rooms/${recentRoom.data.id}`);
    assert.equal(recentAfter.data.images.length, 2);

    // Storage stats endpoint works
    const storageRes = await apiFetch('/api/storage');
    assert.equal(storageRes.status, 200);
    assert.ok(storageRes.data.total_rooms >= 2);
  });
});

describe('Customers, Send history, and Shared Cart privacy', () => {
  let customerId;
  let privateRoomId;
  let cartId;
  let cartSlug;

  it('handles Customer CRUD and Send history CRUD', async () => {
    const bad = await jsonRequest('POST', '/api/customers', { name: '' });
    assert.equal(bad.status, 400);

    const created = await jsonRequest('POST', '/api/customers', {
      name: 'Bạn Lan',
      zalo_phone: '0912000111',
      budget_min: 3000000,
      budget_max: 4500000,
      districts: 'Cầu Giấy',
      need_note: 'Cần ban công',
      status: 'dang_tim',
    });
    assert.equal(created.status, 201);
    customerId = created.data.id;

    const updated = await jsonRequest('PUT', `/api/customers/${customerId}`, {
      budget_max: 5000000,
      status: 'dang_tim',
    });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.budget_max, 5000000);

    // Create a room with sensitive private fields & landlord info
    const landlord = await jsonRequest('POST', '/api/landlords', {
      name: 'Chủ Nhà Bí Mật',
      phone: '0900111222',
      zalo: '0900111222',
    });
    const room = await jsonRequest('POST', '/api/rooms', {
      landlord_id: landlord.data.id,
      code: 'PRIV-01',
      address: 'Số 99 Ngách 12 Bí Mật',
      street: 'Xuân Thuỷ',
      district: 'Cầu Giấy',
      price: 4200000,
      deposit: 4200000,
      area_m2: 28,
      status: 'trong',
      description: 'Phòng đẹp gần trường',
      private_note: 'Mật khẩu khoá 9999 - không gửi khách',
    });
    privateRoomId = room.data.id;

    // Record send history
    const sendRes = await jsonRequest('POST', '/api/sends', {
      customer_id: customerId,
      room_ids: [privateRoomId],
      message: 'Gửi bạn phòng Xuân Thuỷ',
    });
    assert.equal(sendRes.status, 201);
    assert.deepEqual(sendRes.data.room_ids, [privateRoomId]);

    const custSends = await apiFetch(`/api/customers/${customerId}/sends`);
    assert.equal(custSends.status, 200);
    assert.equal(custSends.data.sends.length, 1);
    assert.equal(custSends.data.sends[0].rooms[0].code, 'PRIV-01');

    const allSends = await apiFetch('/api/sends');
    assert.equal(allSends.status, 200);
    assert.ok(allSends.data.length >= 1);

    // Delete a temporary customer
    const tmpCust = await jsonRequest('POST', '/api/customers', { name: 'Khách Tạm' });
    const delCust = await apiFetch(`/api/customers/${tmpCust.data.id}`, { method: 'DELETE' });
    assert.equal(delCust.status, 200);
  });

  it('strips private fields (address, private_note, landlord info) on public cart route', async () => {
    const cartRes = await jsonRequest('POST', '/api/carts', {
      title: 'Phòng cho Lan',
      customer_id: customerId,
      room_ids: [privateRoomId],
      note: 'Hẹn xem cuối tuần',
    });
    assert.equal(cartRes.status, 201);
    cartId = cartRes.data.id;
    cartSlug = cartRes.data.slug;

    const pub = await apiFetch(`/api/public/carts/${cartSlug}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.data.title, 'Phòng cho Lan');
    assert.equal(pub.data.rooms.length, 1);

    const r = pub.data.rooms[0];
    assert.equal(r.code, 'PRIV-01');
    assert.equal(r.street, 'Xuân Thuỷ');
    assert.equal(r.district, 'Cầu Giấy');
    assert.equal(r.description, 'Phòng đẹp gần trường');

    // Strictly verify sensitive fields are NEVER present
    assert.equal('address' in r, false);
    assert.equal('private_note' in r, false);
    assert.equal('landlord_id' in r, false);
    assert.equal('landlord_name' in r, false);
    assert.equal('landlord_phone' in r, false);
    assert.equal('landlord_zalo' in r, false);
    assert.equal('customer_id' in pub.data, false);

    // Delete cart -> public route returns 404
    const delCart = await apiFetch(`/api/carts/${cartId}`, { method: 'DELETE' });
    assert.equal(delCart.status, 200);

    const pubAfterDel = await apiFetch(`/api/public/carts/${cartSlug}`);
    assert.equal(pubAfterDel.status, 404);
  });
});

describe('Google Sheets status, validation, and private_note preservation on sync', () => {
  it('returns helpful status and instructions when google-key.json is not yet placed', async () => {
    const res = await apiFetch('/api/sheets');
    assert.equal(res.status, 200);
    assert.equal(res.data.auth.configured, false);
    assert.equal(res.data.auth.exists, false);
    assert.ok(res.data.auth.message);
    assert.ok(Array.isArray(res.data.auth.instructions));
    assert.ok(res.data.auth.instructions.length > 0);
  });

  it('preserves private_note during Google Sheet sync and marks missing rows da_thue', async () => {
    const sourceRes = await jsonRequest('POST', '/api/sheets', {
      name: 'Bảng hàng Test',
      spreadsheet_id: 'https://docs.google.com/spreadsheets/d/abc123XYZ/edit',
      sheet_name: 'Sheet1',
      default_district: 'Cầu Giấy',
      column_map: {
        code: 'Mã phòng',
        street: 'Đường',
        price: 'Giá',
        status: 'Trạng thái',
      },
    });
    assert.equal(sourceRes.status, 201);
    const sourceId = sourceRes.data.id;
    assert.equal(sourceRes.data.spreadsheet_id, 'abc123XYZ');

    const mockSheetsClient1 = {
      spreadsheets: {
        values: {
          get: async () => ({
            data: {
              values: [
                ['Mã phòng', 'Đường', 'Giá', 'Trạng thái'],
                ['SH-01', 'Duy Tân', '3tr8', 'Trống'],
                ['SH-02', 'Thành Thái', '4tr5', 'Sắp trống'],
              ],
            },
          }),
        },
      },
    };

    const sync1 = await syncSheetSource(sourceId, { sheetsClient: mockSheetsClient1 });
    assert.deepEqual(sync1, { added: 2, updated: 0, removed: 0 });

    // User adds a private_note to SH-01
    const sh01 = db
      .prepare('SELECT * FROM rooms WHERE sheet_source_id = ? AND code = ?')
      .get(sourceId, 'SH-01');
    assert.ok(sh01);
    assert.equal(sh01.price, 3800000);

    await jsonRequest('PUT', `/api/rooms/${sh01.id}`, {
      private_note: 'Ghi chú nội bộ cực kỳ quan trọng',
    });

    // Re-sync: SH-01 updated price, SH-02 removed from sheet
    const mockSheetsClient2 = {
      spreadsheets: {
        values: {
          get: async () => ({
            data: {
              values: [
                ['Mã phòng', 'Đường', 'Giá', 'Trạng thái'],
                ['SH-01', 'Duy Tân', '4tr', 'Đã cọc'],
              ],
            },
          }),
        },
      },
    };

    const sync2 = await syncSheetSource(sourceId, { sheetsClient: mockSheetsClient2 });
    assert.deepEqual(sync2, { added: 0, updated: 1, removed: 1 });

    const sh01After = db.prepare('SELECT * FROM rooms WHERE id = ?').get(sh01.id);
    assert.equal(sh01After.price, 4000000);
    assert.equal(sh01After.status, 'da_coc');
    assert.equal(sh01After.private_note, 'Ghi chú nội bộ cực kỳ quan trọng');

    const sh02After = db
      .prepare('SELECT * FROM rooms WHERE sheet_source_id = ? AND code = ?')
      .get(sourceId, 'SH-02');
    assert.equal(sh02After.status, 'da_thue');
  });

  it('parses CSV rows and supports uploading/removing google-key.json via API', async () => {
    const parsed = parseCsvRows('Mã phòng,Đường,Giá\n"P101","Xuân Thuỷ, CG","3,8 tr"\n"P102","Láng","4tr2"');
    assert.equal(parsed.length, 3);
    assert.deepEqual(parsed[1], ['P101', 'Xuân Thuỷ, CG', '3,8 tr']);

    const badKey = await jsonRequest('POST', '/api/sheets/google-key', { json: '{"invalid": true}' });
    assert.equal(badKey.status, 400);

    const validKey = await jsonRequest('POST', '/api/sheets/google-key', {
      json: JSON.stringify({
        type: 'service_account',
        project_id: 'demo-proj',
        client_email: 'sale-tro@demo-proj.iam.gserviceaccount.com',
        private_key: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----\n',
      }),
    });
    assert.equal(validKey.status, 200);
    assert.equal(validKey.data.auth.configured, true);
    assert.equal(
      validKey.data.auth.serviceAccountEmail,
      'sale-tro@demo-proj.iam.gserviceaccount.com'
    );

    const delKey = await apiFetch('/api/sheets/google-key', { method: 'DELETE' });
    assert.equal(delKey.status, 200);
    assert.equal(delKey.data.auth.configured, false);
  });
});

describe('Intelligent Sheet auto-detection and quick-add', () => {
  after(() => {
    resetTestInspectOptions();
    resetTestSyncOptions();
  });

  it('detects header row, column mapping, and district from Vietnamese synonyms accurately', () => {
    // 1. Header row detection with title / banner lines
    const rowsWithBanner = [
      ['BẢNG HÀNG PHÒNG TRỌ KHU VỰC CẦU GIẤY - CẬP NHẬT 2026', '', '', '', ''],
      ['Hotline hỗ trợ: 0912.345.678 (Zalo)', '', '', '', ''],
      [
        'STT',
        'Tòa nhà',
        'Số nhà',
        'Phòng',
        'Loại phòng',
        'Diện tích (m2)',
        'Giá cho thuê',
        'Tiền cọc',
        'Điện',
        'Nước',
        'Nội thất',
        'Trạng thái',
        'Ngày trống',
        'Link ảnh',
        'Ghi chú',
      ],
      ['1', 'Quan Hoa', 'Số 18 ngõ 68', '302', 'Khép kín', '26', '3.8 tr', '3.8tr', '3.8k', '100k', 'Full đồ', 'Trống', 'Vào ngay', 'https://img', 'Gần ĐHGTVT'],
    ];

    const detectedHeader = detectHeaderRow(rowsWithBanner);
    assert.equal(detectedHeader, 3);

    // 2. Column mapping detection
    const headers = rowsWithBanner[2];
    const columnMap = detectColumnMap(headers);

    assert.equal(columnMap.code, 'Phòng');
    assert.equal(columnMap.street, 'Tòa nhà');
    assert.equal(columnMap.address, 'Số nhà');
    assert.equal(columnMap.room_type, 'Loại phòng');
    assert.equal(columnMap.area_m2, 'Diện tích (m2)');
    assert.equal(columnMap.price, 'Giá cho thuê');
    assert.equal(columnMap.deposit, 'Tiền cọc');
    assert.equal(columnMap.electric_price, 'Điện');
    assert.equal(columnMap.water_price, 'Nước');
    assert.equal(columnMap.amenities, 'Nội thất');
    assert.equal(columnMap.status, 'Trạng thái');
    assert.equal(columnMap.available_from, 'Ngày trống');
    assert.equal(columnMap.images, 'Link ảnh');
    assert.equal(columnMap.description, 'Ghi chú');

    // 3. District detection from title and abbreviations
    assert.equal(detectDistrict('Bảng hàng Cầu Giấy - Đạt Bee'), 'Cầu Giấy');
    assert.equal(detectDistrict('Kho phòng Hoàng Mai 2026'), 'Hoàng Mai');
    assert.equal(detectDistrict('Bảng hàng CG T11/2026'), 'Cầu Giấy');
    assert.equal(detectDistrict('Danh sách căn hộ Đống Đa'), 'Đống Đa');

    // 4. District detection from sample rows
    const sampleRows = [
      { 'Tòa nhà': 'Ngõ 298 Khương Đình, Thanh Xuân' },
      { 'Tòa nhà': 'Số 15 Vũ Tông Phan, Thanh Xuân' },
    ];
    assert.equal(detectDistrict('Bảng hàng tổng hợp', sampleRows), 'Thanh Xuân');
  });

  it('POST /api/sheets/inspect validates input and auto-detects sheet structure and preview', async () => {
    // Missing input
    const badReq = await jsonRequest('POST', '/api/sheets/inspect', {});
    assert.equal(badReq.status, 400);

    const mockRows = [
      ['Hotline: 0988.777.666', '', '', '', ''],
      ['Mã căn', 'Đường', 'Giá', 'Trạng thái', 'Nội thất', 'Ảnh'],
      ['CG-101', 'Duy Tân', '3,5 tr', 'Trống', 'Full đồ', 'https://drive.google.com/test1'],
      ['CG-102', 'Trần Thái Tông', '4tr', 'Sắp trống', 'Cơ bản', 'https://drive.google.com/test2'],
    ];

    setTestInspectOptions({
      title: 'Bảng hàng Cầu Giấy 2026',
      tabs: ['Khu Cầu Giấy', 'Khu Nam Từ Liêm'],
      rows: mockRows,
    });

    const res = await jsonRequest('POST', '/api/sheets/inspect', {
      url: 'https://docs.google.com/spreadsheets/d/mockSpreadsheetInspect123/edit#gid=0',
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.spreadsheetId, 'mockSpreadsheetInspect123');
    assert.equal(res.data.title, 'Bảng hàng Cầu Giấy 2026');
    assert.deepEqual(res.data.tabs, ['Khu Cầu Giấy', 'Khu Nam Từ Liêm']);
    assert.equal(res.data.selectedTab, 'Khu Cầu Giấy');
    assert.equal(res.data.headerRow, 2);
    assert.equal(res.data.columnMap.code, 'Mã căn');
    assert.equal(res.data.columnMap.street, 'Đường');
    assert.equal(res.data.columnMap.price, 'Giá');
    assert.equal(res.data.columnMap.status, 'Trạng thái');
    assert.equal(res.data.columnMap.amenities, 'Nội thất');
    assert.equal(res.data.columnMap.images, 'Ảnh');
    assert.equal(res.data.suggestedDistrict, 'Cầu Giấy');
    assert.equal(res.data.sampleRows.length, 2);
    assert.equal(res.data.sampleRows[0]['Mã căn'], 'CG-101');
    assert.equal(res.data.sampleRows[0]['Đường'], 'Duy Tân');

    // Test with specific sheet_name
    const resTab2 = await jsonRequest('POST', '/api/sheets/inspect', {
      url: 'mockSpreadsheetInspect123',
      sheet_name: 'Khu Nam Từ Liêm',
    });
    assert.equal(resTab2.status, 200);
    assert.equal(resTab2.data.selectedTab, 'Khu Nam Từ Liêm');
    assert.equal(resTab2.data.suggestedDistrict, 'Nam Từ Liêm');
  });

  it('POST /api/sheets/quick-add creates landlord, saves sheet_source, and syncs immediately', async () => {
    // Missing URL validation
    const badReq = await jsonRequest('POST', '/api/sheets/quick-add', {
      landlord_name: 'Chủ nhà Test',
    });
    assert.equal(badReq.status, 400);

    // Invalid landlord ID validation
    const badLandlordReq = await jsonRequest('POST', '/api/sheets/quick-add', {
      url: 'https://docs.google.com/spreadsheets/d/testSpreadsheetId/edit',
      landlord_id: 999999,
    });
    assert.equal(badLandlordReq.status, 400);

    const mockSyncRows = [
      ['Mã phòng', 'Đường', 'Giá', 'Trạng thái'],
      ['HM-201', 'Kim Đồng', '3,2 tr', 'Trống'],
      ['HM-202', 'Tân Mai', '4tr5', 'Đã cọc'],
    ];

    setTestInspectOptions({
      title: 'Kho phòng Hoàng Mai - Chú Tuấn',
      tabs: ['Sheet1'],
      rows: mockSyncRows,
    });

    setTestSyncOptions({
      rows: mockSyncRows,
    });

    const res = await jsonRequest('POST', '/api/sheets/quick-add', {
      url: 'https://docs.google.com/spreadsheets/d/quickAddSpreadsheetXYZ/edit#gid=123',
      landlord_name: 'Chú Tuấn Hoàng Mai',
      default_district: 'Hoàng Mai',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.ok, true);
    assert.ok(res.data.source);
    assert.equal(res.data.source.spreadsheet_id, 'quickAddSpreadsheetXYZ');
    assert.equal(res.data.source.name, 'Kho phòng Hoàng Mai - Chú Tuấn');
    assert.equal(res.data.source.default_district, 'Hoàng Mai');
    assert.deepEqual(res.data.syncResult, { added: 2, updated: 0, removed: 0 });
    assert.match(res.data.message, /đồng bộ thành công 2 phòng mới/);

    // Verify landlord was created
    const createdLandlordId = res.data.source.landlord_id;
    assert.ok(createdLandlordId);
    const landlord = db.prepare('SELECT * FROM landlords WHERE id = ?').get(createdLandlordId);
    assert.ok(landlord);
    assert.equal(landlord.name, 'Chú Tuấn Hoàng Mai');

    // Verify rooms are in the database and correctly parsed
    const rooms = db
      .prepare('SELECT * FROM rooms WHERE sheet_source_id = ? ORDER BY id ASC')
      .all(res.data.source.id);
    assert.equal(rooms.length, 2);
    assert.equal(rooms[0].code, 'HM-201');
    assert.equal(rooms[0].street, 'Kim Đồng');
    assert.equal(rooms[0].district, 'Hoàng Mai');
    assert.equal(rooms[0].price, 3200000);
    assert.equal(rooms[0].status, 'trong');

    assert.equal(rooms[1].code, 'HM-202');
    assert.equal(rooms[1].street, 'Tân Mai');
    assert.equal(rooms[1].price, 4500000);
    assert.equal(rooms[1].status, 'da_coc');

    // Reusing existing landlord name should NOT create a duplicate landlord
    const res2 = await jsonRequest('POST', '/api/sheets/quick-add', {
      url: 'https://docs.google.com/spreadsheets/d/secondSheetForSameLandlord/edit',
      landlord_name: 'Chú Tuấn Hoàng Mai',
      column_map: {
        code: 'Mã phòng',
        street: 'Đường',
        price: 'Giá',
        status: 'Trạng thái',
      },
    });

    assert.equal(res2.status, 201);
    assert.equal(res2.data.source.landlord_id, createdLandlordId);

    const countLandlords = db
      .prepare('SELECT COUNT(*) AS c FROM landlords WHERE name = ?')
      .get('Chú Tuấn Hoàng Mai').c;
    assert.equal(countLandlords, 1);
  });

  it('correctly parses multi-building grouped sheets with nested addresses, thousands prices, and manager notes', async () => {
    const groupedRows = [
      ['SS'],
      ['', '', 'AloPhongtro Banner'],
      ['4', '', 'NHÀ CŨ', '', 'NHÀ A4', '', '', 'SỐ 7 NGÕ 20 TÂN TRIỀU', '', '', '', '', '', 'VỊ TRÍ', 'https://maps.google.com/a4', '10'],
      ['2', '', 'NHÀ CŨ', 'KHU VỰC', 'PHÒNG', 'GIÁ GỐC', 'GIẢM GIÁ', '  GIÁ', 'DIỆN TÍCH', 'LOẠI', 'TÌNH TRẠNG', 'ẢNH+VIDEO', 'VIDEO', 'THIẾT BỊ NỘI THẤT', 'QL NHÀ', '10'],
      ['0', '', 'NHÀ CŨ', 'TRIỀU KHÚC', '505A4', '4.100', '100', '4.000', '27m2+10m2', 'Gác xép', 'Trống', 'ẢNH+VIDEO', 'TIKTOK', 'ĐH+NL+G+T+B', 'A.Hiếu\n0975500632', '13'],
      ['3'],
      ['4', '', 'NHÀ CŨ', '', 'NHÀ A15', '', '', 'SỐ 85B NGÕ 68 TRIỀU KHÚC', '', '', '', '', '', 'VỊ TRÍ', 'https://maps.google.com/a15', '10'],
      ['2', '', 'NHÀ CŨ', 'KHU VỰC', 'PHÒNG', 'GIÁ GỐC', 'GIẢM GIÁ', '  GIÁ', 'DIỆN TÍCH', 'LOẠI', 'TÌNH TRẠNG', 'ẢNH+VIDEO', 'VIDEO', 'THIẾT BỊ NỘI THẤT', 'QL NHÀ', '10'],
      ['0', '', 'NHÀ CŨ', 'TRIỀU KHÚC', '101a15', '6.600', '200', '6.400', '50m2', '2N+1KH', 'CT Trống', 'ẢNH+VIDEO', 'Video', 'ĐH+NL+G+T+B+TL+MG', 'A.Tùng\n0972613854', '10'],
    ];

    setTestInspectOptions({
      title: 'Bảng hàng AloPhongtro',
      tabs: ['PHÒNG TRỐNG'],
      rows: groupedRows,
    });
    setTestSyncOptions({
      rows: groupedRows,
    });

    const res = await jsonRequest('POST', '/api/sheets/quick-add', {
      url: 'https://docs.google.com/spreadsheets/d/mockAloGroupedSheet123/edit',
      name: 'AloPhongtro Test Grouped',
    });

    assert.equal(res.status, 201);
    assert.equal(res.data.syncResult.added, 2);

    const rooms = db
      .prepare('SELECT * FROM rooms WHERE sheet_source_id = ? ORDER BY id ASC')
      .all(res.data.source.id);
    assert.equal(rooms.length, 2);

    // Room 1: 505A4 in NHÀ A4
    assert.equal(rooms[0].code, '505A4');
    assert.equal(rooms[0].address, 'SỐ 7 NGÕ 20 TÂN TRIỀU');
    assert.equal(rooms[0].street, 'NHÀ A4 - SỐ 7 NGÕ 20 TÂN TRIỀU');
    assert.equal(rooms[0].price, 4000000);
    assert.equal(rooms[0].area_m2, 37);
    assert.equal(rooms[0].status, 'trong');
    assert.match(rooms[0].private_note, /0975500632/);
    assert.match(rooms[0].private_note, /maps\.google\.com\/a4/);

    // Room 2: 101a15 in NHÀ A15
    assert.equal(rooms[1].code, '101a15');
    assert.equal(rooms[1].address, 'SỐ 85B NGÕ 68 TRIỀU KHÚC');
    assert.equal(rooms[1].street, 'NHÀ A15 - SỐ 85B NGÕ 68 TRIỀU KHÚC');
    assert.equal(rooms[1].price, 6400000);
    assert.equal(rooms[1].area_m2, 50);
    assert.equal(rooms[1].status, 'sap_trong');
    assert.match(rooms[1].private_note, /0972613854/);
  });

  it('handles sync failures and private sheet access errors gracefully in inspect and quick-add', async () => {
    // 1. inspect error when private / non-existent sheet
    setTestInspectOptions({
      fetchPublicFn: async () => {
        const err = new Error(
          'Google Sheet đang ở chế độ riêng tư hoặc link không hợp lệ. Hãy bật chia sẻ "Bất kỳ ai có đường liên kết đều xem được" hoặc tải lên file google-key.json.'
        );
        err.status = 400;
        throw err;
      },
    });

    const inspectFail = await jsonRequest('POST', '/api/sheets/inspect', {
      url: 'https://docs.google.com/spreadsheets/d/privateSheet123/edit',
    });
    assert.equal(inspectFail.status, 400);
    assert.match(inspectFail.data.error, /riêng tư/);

    // 2. quick-add failure when sync throws error
    setTestInspectOptions({
      title: 'Bảng hàng Lỗi',
      tabs: ['Sheet1'],
      rows: [
        ['Mã phòng', 'Đường', 'Giá'],
        ['ERR-01', 'Test', '3tr'],
      ],
    });

    setTestSyncOptions({
      fetchPublicFn: async () => {
        const err = new Error('Không thể kết nối mạng tới Google Sheet');
        err.status = 400;
        throw err;
      },
    });

    const quickAddFail = await jsonRequest('POST', '/api/sheets/quick-add', {
      url: 'https://docs.google.com/spreadsheets/d/networkErrSheet/edit',
      name: 'Bảng hàng Mạng Lỗi',
    });
    assert.equal(quickAddFail.status, 400);
    assert.equal(quickAddFail.data.ok, false);
    assert.match(quickAddFail.data.error, /đồng bộ thất bại/);
    assert.ok(quickAddFail.data.source);
  });
});

describe('Production SPA fallback under dotfile-prefixed workspace path', () => {
  it('serves index.html for /share/:slug in NODE_ENV=production without 404 dotfile error', async () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prodApp = createApp();
      const res = await dispatchApp(prodApp, '/share/demo-slug');
      assert.equal(res.status, 200);
      assert.match(String(res.data), /<!doctype html>/i);

      const api404 = await dispatchApp(prodApp, '/api/nonexistent');
      assert.equal(api404.status, 404);
      const img404 = await dispatchApp(prodApp, '/images/nonexistent.jpg');
      assert.equal(img404.status, 404);
    } finally {
      process.env.NODE_ENV = prevEnv;
    }
  });
});

describe('Google Drive real photo extraction & photo pipeline', () => {
  it('extracts Google Drive folder and file IDs from various URL formats', () => {
    // Folder URLs
    assert.equal(
      extractDriveFolderId('https://drive.google.com/drive/folders/1FNMAPOy9a3ZmVXKL0l1wVKf_aHncsV8R'),
      '1FNMAPOy9a3ZmVXKL0l1wVKf_aHncsV8R'
    );
    assert.equal(
      extractDriveFolderId('https://drive.google.com/drive/folders/1-6WNQlUaR7pd3lyi44ZCFrA-uOb_ZXtF?usp=drive_link'),
      '1-6WNQlUaR7pd3lyi44ZCFrA-uOb_ZXtF'
    );
    assert.equal(
      extractDriveFolderId('https://drive.google.com/drive/u/0/folders/1Q01fN624O8t0kIaGdvEyBetwDS4yqugC'),
      '1Q01fN624O8t0kIaGdvEyBetwDS4yqugC'
    );
    assert.equal(
      extractDriveFolderId('https://drive.google.com/open?id=1FNMAPOy9a3ZmVXKL0l1wVKf_aHncsV8R'),
      '1FNMAPOy9a3ZmVXKL0l1wVKf_aHncsV8R'
    );
    assert.equal(extractDriveFolderId(''), null);
    assert.equal(extractDriveFolderId('https://google.com'), null);

    // File URLs
    assert.equal(
      extractDriveFileId('https://drive.google.com/file/d/1wCBLsaBGrDvHxicATYYqjZsgZfbIRM4v/view?usp=drive_link'),
      '1wCBLsaBGrDvHxicATYYqjZsgZfbIRM4v'
    );
    assert.equal(
      extractDriveFileId('https://drive.google.com/open?id=1wCBLsaBGrDvHxicATYYqjZsgZfbIRM4v'),
      '1wCBLsaBGrDvHxicATYYqjZsgZfbIRM4v'
    );
    assert.equal(
      extractDriveFileId('https://drive.google.com/uc?export=view&id=1wCBLsaBGrDvHxicATYYqjZsgZfbIRM4v'),
      '1wCBLsaBGrDvHxicATYYqjZsgZfbIRM4v'
    );
  });

  it('correctly parses embeddedfolderview HTML entries', () => {
    const mockHtml = `
      <div class="flip-entry" id="entry-folderNew123" tabindex="0" role="link">
        <div class="flip-entry-info">
          <a href="https://drive.google.com/drive/folders/folderNew123" target="_blank">
            <div class="flip-entry-visual"><div class="flip-entry-visual-card"><div class="flip-entry-icon"><div aria-label="Folder" class="icon-color-1"></div></div></div></div>
            <div class="flip-entry-title">Ảnh Mới</div>
          </a>
        </div>
      </div>
      <div class="flip-entry" id="entry-folderOld456" tabindex="0" role="link">
        <div class="flip-entry-info">
          <a href="https://drive.google.com/drive/folders/folderOld456" target="_blank">
            <div class="flip-entry-visual"><div class="flip-entry-visual-card"><div class="flip-entry-icon"><div aria-label="Folder" class="icon-color-1"></div></div></div></div>
            <div class="flip-entry-title">Ảnh Cũ</div>
          </a>
        </div>
      </div>
      <div class="flip-entry" id="entry-video789" tabindex="0" role="link">
        <div class="flip-entry-info">
          <a href="https://drive.google.com/file/d/video789/view" target="_blank">
            <div class="flip-entry-visual"><div class="flip-entry-visual-card"><div class="flip-entry-thumb"><img src="thumb" alt="Video"/></div></div></div>
            <div class="flip-entry-title">room_video.mov</div>
          </a>
        </div>
      </div>
      <div class="flip-entry" id="entry-img999" tabindex="0" role="link">
        <div class="flip-entry-info">
          <a href="https://drive.google.com/file/d/img999/view" target="_blank">
            <div class="flip-entry-visual"><div class="flip-entry-visual-card"><div class="flip-entry-thumb"><img src="thumb" alt="Image"/></div></div></div>
            <div class="flip-entry-title">IMG_1234.HEIC</div>
          </a>
        </div>
      </div>
    `;

    const entries = parseEmbeddedFolderView(mockHtml);
    assert.equal(entries.length, 4);

    const folderNew = entries.find((e) => e.id === 'folderNew123');
    assert.ok(folderNew);
    assert.equal(folderNew.isFolder, true);
    assert.equal(folderNew.title, 'Ảnh Mới');

    const folderOld = entries.find((e) => e.id === 'folderOld456');
    assert.ok(folderOld);
    assert.equal(folderOld.isFolder, true);
    assert.equal(folderOld.title, 'Ảnh Cũ');

    const video = entries.find((e) => e.id === 'video789');
    assert.ok(video);
    assert.equal(video.isFolder, false);
    assert.equal(video.isVideo, true);

    const img = entries.find((e) => e.id === 'img999');
    assert.ok(img);
    assert.equal(img.isFolder, false);
    assert.equal(img.isVideo, false);
  });

  it('downloads and saves room photos with is_cover: 1 on the first photo and clears placeholders', async () => {
    // Create test room
    const roomRes = db.prepare(`
      INSERT INTO rooms (code, address, street, district, price, status, source)
      VALUES ('TEST-ROOM-DRIVE', '123 Test St', 'Test St', 'Cầu Giấy', 4000000, 'trong', 'manual')
    `).run();
    const testRoomId = roomRes.lastInsertRowid;

    // Insert dummy old placeholder photo
    const roomDir = path.join(tempImagesDir, String(testRoomId));
    fs.mkdirSync(roomDir, { recursive: true });
    fs.writeFileSync(path.join(roomDir, `room_${testRoomId}_cover.jpg`), 'dummy placeholder content');
    db.prepare(`
      INSERT INTO images (room_id, filename, remote_url, size, is_cover, sort_order)
      VALUES (?, ?, '', 100, 1, 0)
    `).run(testRoomId, `room_${testRoomId}_cover.jpg`);

    const beforeImgs = db.prepare('SELECT * FROM images WHERE room_id = ?').all(testRoomId);
    assert.equal(beforeImgs.length, 1);
    assert.equal(beforeImgs[0].filename, `room_${testRoomId}_cover.jpg`);

    // Verify clearSheetRoomImages
    // Mock sheet source id
    db.prepare('UPDATE rooms SET sheet_source_id = 999 WHERE id = ?').run(testRoomId);
    const cleared = clearSheetRoomImages(999);
    assert.equal(cleared, 1);
    assert.equal(fs.existsSync(path.join(roomDir, `room_${testRoomId}_cover.jpg`)), false);
    const afterClearImgs = db.prepare('SELECT * FROM images WHERE room_id = ?').all(testRoomId);
    assert.equal(afterClearImgs.length, 0);

    // Test downloadAndSaveRoomPhotos with a direct file or mock
    const directFileUrl = 'https://drive.google.com/file/d/testFileId12345/view';
    const saved = await downloadAndSaveRoomPhotos(testRoomId, directFileUrl, { maxPhotos: 2 });
    assert.equal(saved.count, 1);
    assert.equal(saved.photos[0].isCover, 1);
    assert.equal(saved.photos[0].sortOrder, 0);
    assert.equal(saved.photos[0].remoteUrl, 'https://lh3.googleusercontent.com/d/testFileId12345=w1000');

    // Confirm DB record
    const dbImgs = db.prepare('SELECT * FROM images WHERE room_id = ?').all(testRoomId);
    assert.equal(dbImgs.length, 1);
    assert.equal(dbImgs[0].is_cover, 1);
    assert.equal(dbImgs[0].remote_url, 'https://lh3.googleusercontent.com/d/testFileId12345=w1000');
  });
});

describe('CRM Customer Lifecycle & Commission Deals', () => {
  let customer1Id;
  let customer2Id;
  let roomId;
  let deal1Id;
  let deal2Id;

  it('manages customer statuses (chua_cham, da_cham, da_chot) with default chua_cham', async () => {
    // Default status on creation is chua_cham
    const res1 = await jsonRequest('POST', '/api/customers', {
      name: 'Khách Nguyễn Văn A',
      zalo_phone: '0901234567',
      budget_max: 5000000,
      districts: 'Cầu Giấy',
    });
    assert.equal(res1.status, 201);
    assert.equal(res1.data.status, 'chua_cham');
    assert.equal(res1.data.deal_room_code, '');
    assert.equal(res1.data.deal_price, 0);
    customer1Id = res1.data.id;

    // Update status to da_cham
    const res2 = await jsonRequest('PUT', `/api/customers/${customer1Id}`, {
      status: 'da_cham',
      need_note: 'Đã hẹn lịch xem phòng vào chiều thứ 7',
    });
    assert.equal(res2.status, 200);
    assert.equal(res2.data.status, 'da_cham');
    assert.equal(res2.data.need_note, 'Đã hẹn lịch xem phòng vào chiều thứ 7');

    // Reject invalid status
    const resBad = await jsonRequest('PUT', `/api/customers/${customer1Id}`, {
      status: 'khong_hop_le_xyz',
    });
    assert.equal(resBad.status, 400);

    // Filter customers by status
    const listRes = await apiFetch('/api/customers?status=da_cham');
    assert.equal(listRes.status, 200);
    assert.ok(listRes.data.some((c) => c.id === customer1Id));
  });

  it('closes deal when customer is updated to da_chot with room info and updates room status', async () => {
    // Create available room
    const roomRes = await jsonRequest('POST', '/api/rooms', {
      code: 'CRM-P101',
      address: 'Số 15 Ngõ 82 Duy Tân',
      street: 'Duy Tân',
      district: 'Cầu Giấy',
      price: 5000000,
      status: 'trong',
    });
    assert.equal(roomRes.status, 201);
    roomId = roomRes.data.id;

    // Update customer1 to da_chot and link roomId
    const closeRes = await jsonRequest('PUT', `/api/customers/${customer1Id}`, {
      status: 'da_chot',
      room_id: roomId,
      deal_date: '2026-11-10',
      move_in_date: '2026-11-15',
      commission_rate: 50,
      deal_commission_status: 'cho_thu',
      note: 'Khách cọc giữ chỗ 1 tháng',
      mark_room_rented: true,
    });
    assert.equal(closeRes.status, 200);
    assert.equal(closeRes.data.status, 'da_chot');
    assert.equal(closeRes.data.deal_room_id, roomId);
    assert.equal(closeRes.data.deal_room_code, 'CRM-P101');
    assert.equal(closeRes.data.deal_district, 'Cầu Giấy');
    assert.equal(closeRes.data.deal_price, 5000000);
    assert.equal(closeRes.data.deal_commission, 2500000); // 50% of 5,000,000
    assert.equal(closeRes.data.deal_commission_status, 'cho_thu');

    // Check room status was updated to da_thue
    const checkRoom = await apiFetch(`/api/rooms/${roomId}`);
    assert.equal(checkRoom.status, 200);
    assert.equal(checkRoom.data.status, 'da_thue');

    // Check deal was created in deals table
    const dealsList = await apiFetch('/api/commissions');
    assert.equal(dealsList.status, 200);
    const deal = dealsList.data.find((d) => d.customer_id === customer1Id);
    assert.ok(deal);
    assert.equal(deal.room_code, 'CRM-P101');
    assert.equal(deal.price, 5000000);
    assert.equal(deal.commission_amount, 2500000);
    assert.equal(deal.commission_status, 'cho_thu');
    assert.equal(deal.customer_name, 'Khách Nguyễn Văn A');
    assert.equal(deal.customer_zalo, '0901234567');
    deal1Id = deal.id;
  });

  it('creates manual deal directly via POST /api/commissions with new customer and custom rate', async () => {
    const createDealRes = await jsonRequest('POST', '/api/commissions', {
      name: 'Khách Chốt Nhanh B',
      zalo_phone: '0988776655',
      room_code: 'VIP-02',
      address: 'Số 98 Thái Hà',
      district: 'Đống Đa',
      price: 6000000,
      commission_rate: 100, // 100% 1 month
      commission_status: 'da_thu',
      deal_date: '2026-11-12',
      move_in_date: '2026-11-20',
      note: 'Thu đủ 1 tháng hoa hồng ngay khi ký HĐ',
    });
    assert.equal(createDealRes.status, 201);
    assert.equal(createDealRes.data.room_code, 'VIP-02');
    assert.equal(createDealRes.data.price, 6000000);
    assert.equal(createDealRes.data.commission_rate, 100);
    assert.equal(createDealRes.data.commission_amount, 6000000);
    assert.equal(createDealRes.data.commission_status, 'da_thu');
    assert.equal(createDealRes.data.commission_received, 6000000);
    assert.equal(createDealRes.data.customer_name, 'Khách Chốt Nhanh B');
    assert.equal(createDealRes.data.customer_zalo, '0988776655');

    deal2Id = createDealRes.data.id;
    customer2Id = createDealRes.data.customer_id;

    // Verify customer record was created with da_chot
    const custRes = await apiFetch(`/api/customers`);
    const createdCust = custRes.data.find((c) => c.id === customer2Id);
    assert.ok(createdCust);
    assert.equal(createdCust.status, 'da_chot');
    assert.equal(createdCust.deal_commission, 6000000);
    assert.equal(createdCust.deal_commission_status, 'da_thu');
  });

  it('calculates KPI stats correctly via GET /api/commissions/stats', async () => {
    const statsRes = await apiFetch('/api/commissions/stats');
    assert.equal(statsRes.status, 200);
    const s = statsRes.data;

    // Total rent value = 5,000,000 + 6,000,000 = 11,000,000
    // Total commission = 2,500,000 + 6,000,000 = 8,500,000
    // Received commission = 0 + 6,000,000 = 6,000,000
    // Pending commission = 8,500,000 - 6,000,000 = 2,500,000
    assert.ok(s.total_deals >= 2);
    assert.ok(s.total_rent_value >= 11000000);
    assert.ok(s.total_commission >= 8500000);
    assert.ok(s.received_commission >= 6000000);
    assert.ok(s.pending_commission >= 2500000);

    // Monthly filter
    const monthStats = await apiFetch('/api/commissions/stats?month=2026-11');
    assert.equal(monthStats.status, 200);
    assert.ok(monthStats.data.total_deals >= 2);
  });

  it('filters commissions by month, status, and search query', async () => {
    // Filter by status cho_thu
    const choThuRes = await apiFetch('/api/commissions?status=cho_thu');
    assert.equal(choThuRes.status, 200);
    assert.ok(choThuRes.data.every((d) => d.commission_status === 'cho_thu'));
    assert.ok(choThuRes.data.some((d) => d.id === deal1Id));

    // Filter by status da_thu
    const daThuRes = await apiFetch('/api/commissions?status=da_thu');
    assert.equal(daThuRes.status, 200);
    assert.ok(daThuRes.data.every((d) => d.commission_status === 'da_thu'));
    assert.ok(daThuRes.data.some((d) => d.id === deal2Id));

    // Filter by search query
    const searchRes = await apiFetch('/api/commissions?q=Thái+Hà');
    assert.equal(searchRes.status, 200);
    assert.equal(searchRes.data.length, 1);
    assert.equal(searchRes.data[0].id, deal2Id);

    // Search by customer name
    const searchName = await apiFetch('/api/commissions?q=Nguyễn+Văn+A');
    assert.equal(searchName.status, 200);
    assert.equal(searchName.data[0].id, deal1Id);
  });

  it('supports closing deal via POST /api/customers/:id/close-deal', async () => {
    // Create new customer
    const cRes = await jsonRequest('POST', '/api/customers', {
      name: 'Khách Đóng Deal Trực Tiếp',
      zalo_phone: '0977112233',
    });
    assert.equal(cRes.status, 201);
    const testCustId = cRes.data.id;

    const closeRes = await jsonRequest('POST', `/api/customers/${testCustId}/close-deal`, {
      room_code: 'CLOSE-99',
      address: '99 Láng Hạ',
      district: 'Đống Đa',
      price: 4000000,
      commission_rate: 50,
      deal_commission_status: 'da_thu',
    });
    assert.equal(closeRes.status, 200);
    assert.equal(closeRes.data.customer.status, 'da_chot');
    assert.equal(closeRes.data.customer.deal_room_code, 'CLOSE-99');
    assert.equal(closeRes.data.customer.deal_commission, 2000000);
    assert.equal(closeRes.data.deal.room_code, 'CLOSE-99');
    assert.equal(closeRes.data.deal.commission_amount, 2000000);
    assert.equal(closeRes.data.deal.commission_status, 'da_thu');
  });

  it('quick updates commission status and amount received via PATCH /api/commissions/:id/status', async () => {
    // Update deal1 to thu_mot_phan with 1,000,000 received
    const patch1 = await jsonRequest('PATCH', `/api/commissions/${deal1Id}/status`, {
      status: 'thu_mot_phan',
      commission_received: 1000000,
    });
    assert.equal(patch1.status, 200);
    assert.equal(patch1.data.commission_status, 'thu_mot_phan');
    assert.equal(patch1.data.commission_received, 1000000);

    // Verify stats after partial collection
    const stats1 = await apiFetch('/api/commissions/stats');
    assert.ok(stats1.data.received_commission >= 7000000); // 6,000,000 + 1,000,000

    // Update deal1 to da_thu -> auto fills full commission amount (2,500,000)
    const patch2 = await jsonRequest('PATCH', `/api/commissions/${deal1Id}/status`, {
      status: 'da_thu',
    });
    assert.equal(patch2.status, 200);
    assert.equal(patch2.data.commission_status, 'da_thu');
    assert.equal(patch2.data.commission_received, 2500000);

    // Check customer record synced
    const cust1 = db.prepare('SELECT deal_commission_status FROM customers WHERE id = ?').get(customer1Id);
    assert.equal(cust1.deal_commission_status, 'da_thu');

    // Update back to cho_thu -> auto resets received to 0
    const patch3 = await jsonRequest('PATCH', `/api/commissions/${deal1Id}/status`, {
      status: 'cho_thu',
    });
    assert.equal(patch3.status, 200);
    assert.equal(patch3.data.commission_status, 'cho_thu');
    assert.equal(patch3.data.commission_received, 0);
  });

  it('handles validation and error cases cleanly', async () => {
    // Missing customer in POST /commissions
    const badPost = await jsonRequest('POST', '/api/commissions', { price: 5000000 });
    assert.equal(badPost.status, 400);

    // Non-existent customer_id in POST /commissions
    const badCust = await jsonRequest('POST', '/api/commissions', { customer_id: 999999 });
    assert.equal(badCust.status, 404);

    // Invalid status in PATCH /commissions/:id/status
    const badStatus = await jsonRequest('PATCH', `/api/commissions/${deal1Id}/status`, {
      status: 'khong_hop_le',
    });
    assert.equal(badStatus.status, 400);

    // Non-existent deal ID
    const badId = await apiFetch('/api/commissions/999999');
    assert.equal(badId.status, 404);

    const badDel = await apiFetch('/api/commissions/999999', { method: 'DELETE' });
    assert.equal(badDel.status, 404);
  });

  it('deletes deal and cleans up customer deal fields via DELETE /api/commissions/:id', async () => {
    const delRes = await apiFetch(`/api/commissions/${deal2Id}`, { method: 'DELETE' });
    assert.equal(delRes.status, 200);
    assert.equal(delRes.data.ok, true);

    // Confirm deal gone
    const checkDeal = await apiFetch(`/api/commissions/${deal2Id}`);
    assert.equal(checkDeal.status, 404);

    // Confirm customer deal fields reset
    const cust2 = db.prepare('SELECT deal_room_code, deal_price, deal_commission FROM customers WHERE id = ?').get(customer2Id);
    assert.equal(cust2.deal_room_code, '');
    assert.equal(cust2.deal_price, 0);
    assert.equal(cust2.deal_commission, 0);
  });
});

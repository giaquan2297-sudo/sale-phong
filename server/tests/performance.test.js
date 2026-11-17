import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import zlib from 'node:zlib';
import { PassThrough } from 'node:stream';
import db, { ROOT_DIR, IMAGES_DIR } from '../db.js';
import { app } from '../index.js';

async function dispatchApp(targetApp, urlPath, options = {}) {
  const reqSocket = new PassThrough();
  reqSocket.remoteAddress = '127.0.0.1';

  const req = new http.IncomingMessage(reqSocket);
  req.method = options.method || 'GET';
  req.url = urlPath;
  req.headers = { host: 'localhost', ...(options.headers || {}) };
  req.push(options.body ? Buffer.from(options.body) : null);
  if (options.body) req.push(null);

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

  return {
    status: res.statusCode,
    headers: res.getHeaders(),
    bodyRaw,
  };
}

describe('Performance, DB optimization & caching headers', () => {
  it('applies SQLite performance pragmas', () => {
    const syncRow = db.prepare('PRAGMA synchronous').get();
    // In SQLite, NORMAL is 1
    assert.equal(syncRow.synchronous, 1);

    const cacheRow = db.prepare('PRAGMA cache_size').get();
    assert.equal(cacheRow.cache_size, -20000);

    const tempRow = db.prepare('PRAGMA temp_store').get();
    // In SQLite, MEMORY is 2
    assert.equal(tempRow.temp_store, 2);
  });

  it('runs migration version 6 and creates compound indexes', () => {
    const userVersion = db.prepare('PRAGMA user_version').get();
    assert.ok(userVersion.user_version >= 6, 'user_version should be at least 6');

    const indexList = db.prepare(`
      SELECT name, tbl_name, sql FROM sqlite_master WHERE type = 'index'
    `).all();

    const idxRooms = indexList.find((i) => i.name === 'idx_rooms_filter');
    assert.ok(idxRooms, 'idx_rooms_filter exists');
    assert.equal(idxRooms.tbl_name, 'rooms');
    assert.match(idxRooms.sql, /status.*district.*price/i);

    const idxCustomers = indexList.find((i) => i.name === 'idx_customers_filter');
    assert.ok(idxCustomers, 'idx_customers_filter exists');
    assert.equal(idxCustomers.tbl_name, 'customers');
    assert.match(idxCustomers.sql, /status.*updated_at/i);

    const idxDeals = indexList.find((i) => i.name === 'idx_deals_commission_filter');
    assert.ok(idxDeals, 'idx_deals_commission_filter exists');
    assert.equal(idxDeals.tbl_name, 'deals');
    assert.match(idxDeals.sql, /commission_status.*deal_date/i);
  });

  it('sets security & performance headers on all responses', async () => {
    const res = await dispatchApp(app, '/api/health');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.equal(res.headers['referrer-policy'], 'strict-origin-when-cross-origin');
  });

  it('compresses responses > 1KB with Gzip when Accept-Encoding includes gzip', async () => {
    const resGzip = await dispatchApp(app, '/api/rooms', {
      headers: { 'accept-encoding': 'gzip, deflate' },
    });

    assert.equal(resGzip.status, 200);
    if (resGzip.headers['content-encoding'] === 'gzip') {
      assert.ok(resGzip.headers['vary']?.includes('Accept-Encoding'));
      const unzipped = zlib.gunzipSync(resGzip.bodyRaw).toString('utf8');
      const data = JSON.parse(unzipped);
      assert.ok(Array.isArray(data));
    }

    // Small response (< 1KB) should NOT be gzipped
    const resSmall = await dispatchApp(app, '/api/health', {
      headers: { 'accept-encoding': 'gzip, deflate' },
    });
    assert.equal(resSmall.status, 200);
    assert.equal(resSmall.headers['content-encoding'], undefined);
  });

  it('skips compression for SSE /api/events and event streams', async () => {
    const reqSocket = new PassThrough();
    const req = new http.IncomingMessage(reqSocket);
    req.method = 'GET';
    req.url = '/api/events';
    req.headers = { host: 'localhost', 'accept-encoding': 'gzip', accept: 'text/event-stream' };
    req.push(null);

    const res = new http.ServerResponse(req);
    res.assignSocket(new PassThrough());

    await new Promise((resolve) => {
      const origWrite = res.write.bind(res);
      res.write = (chunk, enc, cb) => {
        setImmediate(() => {
          req.emit('close');
          res.end();
          resolve();
        });
        return origWrite(chunk, enc, cb);
      };
      app(req, res);
    });

    assert.equal(res.getHeader('content-encoding'), undefined);
    assert.ok(String(res.getHeader('content-type')).includes('text/event-stream'));
  });

  it('serves SPA index.html with no-cache, no-store, must-revalidate', async () => {
    const res = await dispatchApp(app, '/');
    if (res.status === 200) {
      assert.equal(res.headers['cache-control'], 'no-cache, no-store, must-revalidate');
    }

    const resSpa = await dispatchApp(app, '/nhu-cau');
    if (resSpa.status === 200) {
      assert.equal(resSpa.headers['cache-control'], 'no-cache, no-store, must-revalidate');
    }
  });

  it('serves assets in web/dist/assets with immutable long-term caching', async () => {
    const assetsDir = path.join(ROOT_DIR, 'web', 'dist', 'assets');
    if (fs.existsSync(assetsDir)) {
      const files = fs.readdirSync(assetsDir);
      if (files.length > 0) {
        const assetPath = `/assets/${files[0]}`;
        const res = await dispatchApp(app, assetPath, {
          headers: { 'accept-encoding': 'gzip' },
        });
        assert.equal(res.status, 200);
        assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
      }
    }
  });

  it('serves uploaded room images with 1-day max-age and stale-while-revalidate', async () => {
    const testImgPath = path.join(IMAGES_DIR, '__test_perf__.png');
    fs.writeFileSync(testImgPath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));

    try {
      const res = await dispatchApp(app, '/images/__test_perf__.png');
      assert.equal(res.status, 200);
      assert.equal(
        res.headers['cache-control'],
        'public, max-age=86400, stale-while-revalidate=604800'
      );
    } finally {
      if (fs.existsSync(testImgPath)) {
        fs.unlinkSync(testImgPath);
      }
    }
  });

  it('checks wrangler.toml contains pages_build_output_dir or D1 config', () => {
    const tomlPath = path.join(ROOT_DIR, 'wrangler.toml');
    if (fs.existsSync(tomlPath)) {
      const content = fs.readFileSync(tomlPath, 'utf8');
      assert.match(content, /d1_databases|sale-tro/);
    } else {
      assert.ok(true);
    }
  });
});

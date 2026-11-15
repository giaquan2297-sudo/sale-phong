import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { PassThrough } from 'node:stream';
import { app } from '../index.js';
import { addSseClient, broadcastReload } from '../services/sse.js';

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

describe('SSE System Reload & POST /api/system/reload', () => {
  it('broadcastReload() sends system_reload event with { reload: true, timestamp }', () => {
    const receivedEvents = [];
    const mockClient = new PassThrough();
    mockClient.write = (chunk) => {
      receivedEvents.push(chunk.toString());
      return true;
    };

    addSseClient(mockClient);

    const before = Date.now();
    broadcastReload();
    const after = Date.now();

    const output = receivedEvents.join('');
    assert.match(output, /event: system_reload/);
    assert.match(output, /data: /);

    const match = output.match(/data: (.*)\n\n/);
    assert.ok(match, 'data payload line exists');
    const payload = JSON.parse(match[1]);

    assert.equal(payload.reload, true);
    assert.ok(typeof payload.timestamp === 'number');
    assert.ok(payload.timestamp >= before && payload.timestamp <= after);

    mockClient.emit('close');
  });

  it('POST /api/system/reload calls broadcastReload and returns { ok: true, reloaded: true }', async () => {
    const receivedEvents = [];
    const mockClient = new PassThrough();
    mockClient.write = (chunk) => {
      receivedEvents.push(chunk.toString());
      return true;
    };

    addSseClient(mockClient);

    const res = await dispatchApp(app, '/api/system/reload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
    });

    assert.equal(res.status, 200);
    assert.equal(res.data.ok, true);
    assert.equal(res.data.reloaded, true);

    const output = receivedEvents.join('');
    assert.match(output, /event: system_reload/);

    mockClient.emit('close');
  });
});

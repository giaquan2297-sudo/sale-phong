import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { IMAGES_DIR, ROOT_DIR } from './db.js';
import { addSseClient, broadcastReload } from './services/sse.js';
import { runImageCleanup } from './services/cleanup.js';
import { startSyncScheduler } from './services/sheetSync.js';
import { getLanIps, getNetworkInfo } from './services/network.js';
import roomsRouter from './routes/rooms.js';
import landlordsRouter from './routes/landlords.js';
import imagesRouter from './routes/images.js';
import sheetsRouter from './routes/sheets.js';
import customersRouter from './routes/customers.js';
import commissionsRouter from './routes/commissions.js';
import settingsRouter from './routes/settings.js';
import sharedCartsRouter from './routes/sharedCarts.js';
import authRouter from './routes/auth.js';
import leadsRouter from './routes/leads.js';

export function createApp() {
  const app = express();

  // Security & performance headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Zero-dependency Gzip compression middleware using 'node:zlib' for responses > 1KB
  app.use((req, res, next) => {
    // Skip SSE /api/events and event streams
    if (
      req.path === '/api/events' ||
      req.originalUrl?.startsWith('/api/events') ||
      req.headers.accept?.includes('text/event-stream')
    ) {
      return next();
    }

    const acceptEncoding = req.headers['accept-encoding'] || '';
    if (!acceptEncoding.includes('gzip') || req.method === 'HEAD') {
      return next();
    }

    const chunks = [];
    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    let isCanceled = false;

    res.write = function (chunk, encoding, callback) {
      let cb = callback;
      let enc = encoding;
      let data = chunk;

      if (typeof encoding === 'function') {
        cb = encoding;
        enc = null;
      }

      if (isCanceled) {
        return originalWrite(data, enc, cb);
      }
      const contentType = res.getHeader('content-type') || '';
      if (typeof contentType === 'string' && contentType.includes('text/event-stream')) {
        isCanceled = true;
        if (chunks.length > 0) {
          for (const c of chunks) originalWrite(c);
          chunks.length = 0;
        }
        return originalWrite(data, enc, cb);
      }
      if (data) {
        chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data, enc || 'utf8'));
      }
      if (typeof cb === 'function') cb();
      return true;
    };

    res.end = function (chunk, encoding, callback) {
      let cb = callback;
      let enc = encoding;
      let data = chunk;

      if (typeof chunk === 'function') {
        cb = chunk;
        data = null;
        enc = null;
      } else if (typeof encoding === 'function') {
        cb = encoding;
        enc = null;
      }

      if (isCanceled) {
        return originalEnd(data, enc, cb);
      }
      const contentType = res.getHeader('content-type') || '';
      if (typeof contentType === 'string' && contentType.includes('text/event-stream')) {
        isCanceled = true;
        if (chunks.length > 0) {
          for (const c of chunks) originalWrite(c);
          chunks.length = 0;
        }
        return originalEnd(data, enc, cb);
      }

      if (data) {
        chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(data, enc || 'utf8'));
      }

      const buffer = Buffer.concat(chunks);

      if (
        res.getHeader('content-encoding') ||
        res.statusCode === 204 ||
        res.statusCode === 304 ||
        buffer.length <= 1024
      ) {
        return originalEnd(buffer, cb);
      }

      try {
        const gzipped = zlib.gzipSync(buffer);
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', gzipped.length);
        const vary = res.getHeader('Vary');
        if (!vary) {
          res.setHeader('Vary', 'Accept-Encoding');
        } else if (typeof vary === 'string' && !vary.includes('Accept-Encoding')) {
          res.setHeader('Vary', `${vary}, Accept-Encoding`);
        }
        return originalEnd(gzipped, cb);
      } catch {
        return originalEnd(buffer, cb);
      }
    };

    next();
  });

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get('/api/network-info', (req, res) => {
    const port = req.socket?.localPort || process.env.PORT || 3000;
    res.json(getNetworkInfo(port));
  });

  app.post('/api/system/reload', (req, res) => {
    broadcastReload();
    res.json({ ok: true, reloaded: true });
  });

  app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true })}\n\n`);
    addSseClient(res);

    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 25000);
    heartbeat.unref?.();

    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  app.use('/api/rooms', roomsRouter);
  app.use('/api/landlords', landlordsRouter);
  app.use('/api', imagesRouter);
  app.use('/api/sheets', sheetsRouter);
  app.use('/api', customersRouter);
  app.use('/api/commissions', commissionsRouter);
  app.use('/api', settingsRouter);
  app.use('/api', sharedCartsRouter);
  app.use('/api/auth', authRouter);
  app.use('/api', authRouter);
  app.use('/api', leadsRouter);

  // Serve uploaded local room images
  app.use(
    '/images',
    express.static(IMAGES_DIR, {
      setHeaders(res) {
        res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      },
    })
  );

  // API 404 fallback
  app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint không tồn tại' });
  });

  // Error handler (malformed JSON, multer, SQLite, unexpected errors)
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
      return res.status(400).json({ error: 'Dữ liệu JSON không hợp lệ' });
    }

    if (err?.name === 'MulterError') {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File ảnh vượt quá giới hạn 10MB' });
      }
      if (err.code === 'LIMIT_FILE_COUNT') {
        return res.status(400).json({ error: 'Tối đa 20 ảnh mỗi lần tải lên' });
      }
      return res.status(400).json({ error: err.message || 'Lỗi tải ảnh lên' });
    }

    if (err?.code === 'ERR_SQLITE_ERROR') {
      const msg = String(err.message || '');
      if (/unique/i.test(msg)) {
        return res.status(409).json({ error: 'Dữ liệu bị trùng lặp' });
      }
      if (/constraint|foreign key|not null|check/i.test(msg)) {
        return res.status(400).json({ error: 'Dữ liệu vi phạm ràng buộc cơ sở dữ liệu' });
      }
      console.error('SQLite error:', err);
      return res.status(500).json({ error: 'Lỗi cơ sở dữ liệu' });
    }

    if (err?.status && err.status >= 400 && err.status < 500) {
      return res.status(err.status).json({ error: err.message || 'Yêu cầu không hợp lệ' });
    }

    console.error('Unhandled server error:', err);
    return res.status(500).json({ error: 'Lỗi máy chủ nội bộ' });
  });

  // Serve built React frontend in production
  const webDistDir = path.join(ROOT_DIR, 'web', 'dist');
  if (fs.existsSync(webDistDir)) {
    const assetsDir = path.join(webDistDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      app.use(
        '/assets',
        express.static(assetsDir, {
          setHeaders(res) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          },
        })
      );
    }

    app.use(
      express.static(webDistDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          }
        },
      })
    );

    app.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next();
      if (req.path.startsWith('/api/') || req.path.startsWith('/images/')) {
        return res.status(404).json({ error: 'Not found' });
      }
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.sendFile('index.html', { root: webDistDir });
    });
  }

  return app;
}

export const app = createApp();

export function startServer() {
  const HOST = process.env.HOST || '0.0.0.0';
  const PORT = parseInt(process.env.PORT || '3000', 10);

  const server = app.listen(PORT, HOST, () => {
    console.log(`Sale Tro server đang chạy:`);
    console.log(`  - Trên máy tính: http://localhost:${PORT}`);
    const lanIps = getLanIps();
    lanIps.forEach((item) => {
      console.log(`  - Trên điện thoại (cùng Wi-Fi): http://${item.ip}:${PORT}`);
    });

    try {
      const cleanupRes = runImageCleanup();
      if (cleanupRes.deletedFiles > 0) {
        console.log(
          `Đã tự dọn ${cleanupRes.deletedFiles} ảnh của ${cleanupRes.cleanedRooms} phòng đã thuê quá ${cleanupRes.days} ngày`
        );
      }
    } catch (err) {
      console.error('Lỗi khi chạy dọn ảnh tự động:', err.message);
    }

    // Run cleanup check once every 24h
    setInterval(() => {
      try {
        runImageCleanup();
      } catch {
        // Ignore background cleanup errors
      }
    }, 24 * 60 * 60 * 1000);

    startSyncScheduler();

    // Notify already-connected browser clients to reload to the latest bundle after server startup
    setTimeout(() => {
      try {
        broadcastReload();
      } catch (err) {
        console.error('Lỗi khi phát sự kiện system_reload:', err.message);
      }
    }, 1200);
  });

  return server;
}

const isEntrypoint =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  startServer();
}

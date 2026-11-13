import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IMAGES_DIR, ROOT_DIR } from './db.js';
import { addSseClient } from './services/sse.js';
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

  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  app.get('/api/network-info', (req, res) => {
    const port = req.socket?.localPort || process.env.PORT || 3000;
    res.json(getNetworkInfo(port));
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
  app.use('/images', express.static(IMAGES_DIR, { maxAge: '1h' }));

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
    app.use(express.static(webDistDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      if (req.path.startsWith('/api/') || req.path.startsWith('/images/')) {
        return res.status(404).json({ error: 'Not found' });
      }
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
  });

  return server;
}

const isEntrypoint =
  Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isEntrypoint) {
  startServer();
}

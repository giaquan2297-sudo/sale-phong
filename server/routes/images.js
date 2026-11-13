import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import db, { IMAGES_DIR } from '../db.js';
import { broadcastEvent } from '../services/sse.js';
import { parsePositiveIntId } from '../utils/validation.js';

const router = Router();
const RESOLVED_IMAGES_DIR = path.resolve(IMAGES_DIR);

function safeRoomImagePath(roomId, filename) {
  const target = path.resolve(IMAGES_DIR, String(roomId), path.basename(filename));
  if (!target.startsWith(RESOLVED_IMAGES_DIR + path.sep)) {
    return null;
  }
  return target;
}

function validateRoomExists(req, res, next) {
  const roomId = parsePositiveIntId(req.params.roomId);
  if (!roomId) {
    return res.status(400).json({ error: 'ID phòng không hợp lệ' });
  }
  const room = db.prepare('SELECT id FROM rooms WHERE id = ?').get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Không tìm thấy phòng' });
  }
  req.roomId = room.id;
  next();
}

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const roomDir = path.join(IMAGES_DIR, String(req.roomId));
    fs.mkdirSync(roomDir, { recursive: true });
    cb(null, roomDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    const fallbackExt = file.mimetype === 'image/png' ? '.png' : file.mimetype === 'image/webp' ? '.webp' : '.jpg';
    const safeExt = allowedExts.includes(ext) ? ext : fallbackExt;
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024, files: 20 },
  fileFilter(req, file, cb) {
    if (file.mimetype && file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      const err = new Error('Chỉ chấp nhận file ảnh');
      err.status = 400;
      cb(err);
    }
  },
});

router.post('/rooms/:roomId/images', validateRoomExists, upload.array('images', 20), (req, res) => {
  const roomId = req.roomId;
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'Chưa chọn ảnh để tải lên' });
  }

  let meta = [];
  if (req.body?.meta) {
    try {
      const parsed = JSON.parse(req.body.meta);
      if (Array.isArray(parsed)) meta = parsed;
    } catch {
      meta = [];
    }
  }

  const hasCover = db
    .prepare('SELECT COUNT(*) AS c FROM images WHERE room_id = ? AND is_cover = 1')
    .get(roomId).c;
  const maxOrder = db
    .prepare('SELECT COALESCE(MAX(sort_order), -1) AS m FROM images WHERE room_id = ?')
    .get(roomId).m;

  const insert = db.prepare(`
    INSERT INTO images (room_id, filename, remote_url, size, width, height, is_cover, sort_order)
    VALUES (?, ?, '', ?, ?, ?, ?, ?)
  `);

  const created = [];
  db.exec('BEGIN');
  try {
    files.forEach((file, idx) => {
      const m = meta[idx] && typeof meta[idx] === 'object' ? meta[idx] : {};
      const width = Math.max(0, parseInt(m.width, 10) || 0);
      const height = Math.max(0, parseInt(m.height, 10) || 0);
      const isCover = hasCover === 0 && idx === 0 ? 1 : 0;
      const result = insert.run(
        roomId,
        file.filename,
        file.size,
        width,
        height,
        isCover,
        maxOrder + 1 + idx
      );
      created.push({
        id: result.lastInsertRowid,
        room_id: roomId,
        filename: file.filename,
        remote_url: '',
        size: file.size,
        width,
        height,
        is_cover: isCover,
        sort_order: maxOrder + 1 + idx,
        url: `/images/${roomId}/${file.filename}`,
      });
    });

    db.prepare("UPDATE rooms SET updated_at = datetime('now', 'localtime') WHERE id = ?").run(roomId);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    for (const f of files) {
      fs.rmSync(f.path, { force: true });
    }
    throw err;
  }

  broadcastEvent('rooms_changed', { action: 'images_uploaded', roomId });
  res.status(201).json(created);
});

router.patch('/images/:id/cover', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID ảnh không hợp lệ' });
  }

  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  if (!img) {
    return res.status(404).json({ error: 'Không tìm thấy ảnh' });
  }

  db.exec('BEGIN');
  try {
    db.prepare('UPDATE images SET is_cover = 0 WHERE room_id = ?').run(img.room_id);
    db.prepare('UPDATE images SET is_cover = 1 WHERE id = ?').run(img.id);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  broadcastEvent('rooms_changed', { action: 'cover_changed', roomId: img.room_id });
  res.json({ ok: true });
});

router.delete('/images/:id', (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID ảnh không hợp lệ' });
  }

  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  if (!img) {
    return res.status(404).json({ error: 'Không tìm thấy ảnh' });
  }

  db.exec('BEGIN');
  try {
    db.prepare('DELETE FROM images WHERE id = ?').run(img.id);
    if (img.is_cover) {
      const nextImg = db
        .prepare('SELECT id FROM images WHERE room_id = ? ORDER BY sort_order ASC, id ASC LIMIT 1')
        .get(img.room_id);
      if (nextImg) {
        db.prepare('UPDATE images SET is_cover = 1 WHERE id = ?').run(nextImg.id);
      }
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  if (img.filename) {
    const filePath = safeRoomImagePath(img.room_id, img.filename);
    if (filePath && fs.existsSync(filePath)) {
      fs.rmSync(filePath, { force: true });
    }
  }

  broadcastEvent('rooms_changed', { action: 'image_deleted', roomId: img.room_id });
  res.json({ ok: true });
});

router.get('/images/:id/proxy', async (req, res) => {
  const id = parsePositiveIntId(req.params.id);
  if (!id) {
    return res.status(400).json({ error: 'ID ảnh không hợp lệ' });
  }

  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
  if (!img) {
    return res.status(404).json({ error: 'Không tìm thấy ảnh' });
  }
  if (img.filename) {
    const filePath = safeRoomImagePath(img.room_id, img.filename);
    if (filePath && fs.existsSync(filePath)) {
      return res.sendFile(path.join(String(img.room_id), path.basename(img.filename)), {
        root: RESOLVED_IMAGES_DIR,
      });
    }
  }
  if (img.remote_url && /^https?:\/\//i.test(img.remote_url)) {
    try {
      const upstream = await fetch(img.remote_url, {
        signal: AbortSignal.timeout(10000),
      });
      if (!upstream.ok) {
        return res.status(502).json({ error: 'Không tải được ảnh từ link ngoài' });
      }
      const contentType = upstream.headers.get('content-type') || 'image/jpeg';
      if (!contentType.startsWith('image/')) {
        return res.status(502).json({ error: 'Link ngoài không trả về dữ liệu ảnh hợp lệ' });
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      res.setHeader('Content-Type', contentType);
      return res.send(buf);
    } catch (err) {
      return res.status(502).json({ error: err.message });
    }
  }
  res.status(404).json({ error: 'Ảnh không tồn tại' });
});

export default router;

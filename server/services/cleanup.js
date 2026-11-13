import fs from 'node:fs';
import path from 'node:path';
import db, { DB_PATH, IMAGES_DIR, getAllSettings } from '../db.js';
import { broadcastEvent } from './sse.js';

function getDirectoryStats(dirPath) {
  let totalBytes = 0;
  let fileCount = 0;

  if (!fs.existsSync(dirPath)) {
    return { totalBytes, fileCount };
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      const sub = getDirectoryStats(fullPath);
      totalBytes += sub.totalBytes;
      fileCount += sub.fileCount;
    } else if (entry.isFile()) {
      try {
        const stat = fs.statSync(fullPath);
        totalBytes += stat.size;
        fileCount += 1;
      } catch {
        // Ignore transient missing files
      }
    }
  }
  return { totalBytes, fileCount };
}

function getDbSizeBytes() {
  if (!DB_PATH || DB_PATH === ':memory:') return 0;
  const candidates = [DB_PATH, `${DB_PATH}-wal`, `${DB_PATH}-shm`];
  let total = 0;
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      try {
        total += fs.statSync(p).size;
      } catch {
        // Ignore
      }
    }
  }
  return total;
}

export function getCleanupCandidates(daysOverride = null) {
  const settings = getAllSettings();
  const days = Math.max(1, parseInt(daysOverride ?? settings.cleanup_days ?? '30', 10) || 30);

  const rooms = db
    .prepare(
      `
      SELECT
        r.id,
        r.code,
        r.street,
        r.district,
        r.status,
        r.status_changed_at,
        COUNT(i.id) AS total_images,
        COALESCE(SUM(CASE WHEN i.filename != '' THEN i.size ELSE 0 END), 0) AS total_bytes
      FROM rooms r
      JOIN images i ON i.room_id = r.id
      WHERE r.status = 'da_thue'
        AND datetime(r.status_changed_at) <= datetime('now', 'localtime', ?)
        AND i.filename != ''
      GROUP BY r.id
      HAVING COUNT(CASE WHEN i.filename != '' THEN 1 END) > 1
      ORDER BY r.status_changed_at ASC
    `
    )
    .all(`-${days} days`);

  return { days, rooms };
}

export function getStorageStats() {
  const imageDirStats = getDirectoryStats(IMAGES_DIR);
  const dbBytes = getDbSizeBytes();
  const counts = db
    .prepare(
      `
      SELECT
        (SELECT COUNT(*) FROM rooms) AS total_rooms,
        (SELECT COUNT(*) FROM rooms WHERE status = 'trong') AS available_rooms,
        (SELECT COUNT(*) FROM rooms WHERE status = 'da_thue') AS rented_rooms,
        (SELECT COUNT(*) FROM images WHERE filename != '') AS local_images,
        (SELECT COUNT(*) FROM images WHERE filename = '' AND remote_url != '') AS remote_images
    `
    )
    .get();

  const { days, rooms: candidates } = getCleanupCandidates();
  const reclaimableBytes = db
    .prepare(
      `
      SELECT COALESCE(SUM(i.size), 0) AS bytes
      FROM images i
      JOIN rooms r ON r.id = i.room_id
      WHERE r.status = 'da_thue'
        AND datetime(r.status_changed_at) <= datetime('now', 'localtime', ?)
        AND i.filename != ''
        AND i.is_cover = 0
        AND i.id != (
          SELECT i2.id FROM images i2
          WHERE i2.room_id = r.id AND i2.filename != ''
          ORDER BY i2.is_cover DESC, i2.sort_order ASC, i2.id ASC
          LIMIT 1
        )
    `
    )
    .get(`-${days} days`);

  return {
    images_bytes: imageDirStats.totalBytes,
    images_file_count: imageDirStats.fileCount,
    db_bytes: dbBytes,
    total_bytes: imageDirStats.totalBytes + dbBytes,
    cleanup_days: days,
    reclaimable_bytes: reclaimableBytes?.bytes || 0,
    cleanup_candidates: candidates,
    ...counts,
  };
}

export function runImageCleanup(daysOverride = null) {
  const settings = getAllSettings();
  const days = Math.max(1, parseInt(daysOverride ?? settings.cleanup_days ?? '30', 10) || 30);

  const expiredRooms = db
    .prepare(
      `
      SELECT id, code
      FROM rooms
      WHERE status = 'da_thue'
        AND datetime(status_changed_at) <= datetime('now', 'localtime', ?)
    `
    )
    .all(`-${days} days`);

  let deletedFiles = 0;
  let freedBytes = 0;
  let cleanedRooms = 0;

  for (const room of expiredRooms) {
    const localImages = db
      .prepare(
        `
        SELECT id, filename, size, is_cover
        FROM images
        WHERE room_id = ? AND filename != ''
        ORDER BY is_cover DESC, sort_order ASC, id ASC
      `
      )
      .all(room.id);

    if (localImages.length <= 1) continue;

    // Always keep the cover image (or promote the first image to cover)
    const keepImage = localImages[0];
    if (!keepImage.is_cover) {
      db.prepare('UPDATE images SET is_cover = 1 WHERE id = ?').run(keepImage.id);
    }

    const toDelete = localImages.slice(1);
    for (const img of toDelete) {
      const filePath = path.join(IMAGES_DIR, String(room.id), img.filename);
      if (fs.existsSync(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          freedBytes += stat.size;
          fs.unlinkSync(filePath);
        } catch {
          freedBytes += img.size || 0;
        }
      } else {
        freedBytes += img.size || 0;
      }
      db.prepare('DELETE FROM images WHERE id = ?').run(img.id);
      deletedFiles += 1;
    }
    cleanedRooms += 1;
  }

  if (deletedFiles > 0) {
    broadcastEvent('storage_cleaned', {
      deletedFiles,
      freedBytes,
      cleanedRooms,
    });
  }

  return {
    days,
    cleanedRooms,
    deletedFiles,
    freedBytes,
  };
}

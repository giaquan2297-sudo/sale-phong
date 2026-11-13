import { Router } from 'express';
import db, { getAllSettings } from '../db.js';
import { getStorageStats, runImageCleanup } from '../services/cleanup.js';
import { startSyncScheduler } from '../services/sheetSync.js';
import { isPlainObject, parsePositiveInt } from '../utils/validation.js';

const router = Router();

router.get('/settings', (req, res) => {
  res.json(getAllSettings());
});

router.put('/settings', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  const updates = req.body || {};

  if (updates.cleanup_days !== undefined) {
    const days = parsePositiveInt(updates.cleanup_days);
    if (!days) {
      return res.status(400).json({ error: 'Số ngày dọn ảnh phải là số nguyên dương' });
    }
  }
  if (updates.sync_interval_minutes !== undefined) {
    const mins = parsePositiveInt(updates.sync_interval_minutes);
    if (!mins) {
      return res.status(400).json({ error: 'Chu kỳ đồng bộ phải là số nguyên dương (phút)' });
    }
  }

  const upsert = db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  );

  const allowedKeys = [
    'cleanup_days',
    'sync_interval_minutes',
    'zalo_greeting',
    'zalo_signature',
  ];

  for (const key of allowedKeys) {
    if (updates[key] !== undefined && updates[key] !== null) {
      upsert.run(key, String(updates[key]));
    }
  }

  if (updates.sync_interval_minutes !== undefined) {
    startSyncScheduler();
  }

  res.json(getAllSettings());
});

router.get('/storage', (req, res) => {
  res.json(getStorageStats());
});

router.post('/storage/cleanup', (req, res) => {
  if (req.body !== undefined && !isPlainObject(req.body)) {
    return res.status(400).json({ error: 'Dữ liệu phải là JSON object' });
  }

  let days = null;
  const rawDays = req.body?.days;
  if (rawDays !== undefined && rawDays !== null && rawDays !== '') {
    days = parsePositiveInt(rawDays);
    if (!days) {
      return res.status(400).json({ error: 'Số ngày phải là số nguyên dương' });
    }
  }

  const result = runImageCleanup(days);
  res.json({
    ok: true,
    ...result,
    stats: getStorageStats(),
  });
});

export default router;

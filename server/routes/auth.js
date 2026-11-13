import express from 'express';
import db from '../db.js';
import {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  authenticate,
} from '../services/auth.js';

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { username, password }
 */
function handleLogin(req, res) {
  const { username, password } = req.body || {};

  if (!username || !password || !String(username).trim() || !String(password)) {
    return res.status(400).json({ error: 'Vui lòng nhập tên đăng nhập và mật khẩu' });
  }

  const cleanUsername = String(username).trim();
  const user = db
    .prepare('SELECT id, username, password_hash, name, role, phone FROM users WHERE LOWER(username) = LOWER(?)')
    .get(cleanUsername);

  if (!user) {
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
  }

  const isValid = verifyPassword(String(password), user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không chính xác' });
  }

  const userPayload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    phone: user.phone || '',
  };

  const token = createToken(userPayload);

  return res.json({
    ok: true,
    user: userPayload,
    token,
  });
}

/**
 * POST /api/auth/register
 * Body: { username, password, name, phone }
 */
function handleRegister(req, res) {
  const { username, password, name, phone } = req.body || {};

  const cleanUsername = String(username || '').trim();
  const cleanPassword = String(password || '');
  const cleanName = String(name || '').trim();
  const cleanPhone = phone ? String(phone).trim() : '';

  if (!cleanUsername || cleanUsername.length < 3) {
    return res.status(400).json({ error: 'Tên đăng nhập phải có ít nhất 3 ký tự' });
  }

  if (!cleanPassword || cleanPassword.length < 4) {
    return res.status(400).json({ error: 'Mật khẩu phải có ít nhất 4 ký tự' });
  }

  if (!cleanName) {
    return res.status(400).json({ error: 'Vui lòng nhập họ và tên' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)')
    .get(cleanUsername);

  if (existing) {
    return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại trên hệ thống' });
  }

  const pwdHash = hashPassword(cleanPassword);
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, name, role, phone)
    VALUES (?, ?, ?, 'user', ?)
  `);

  const result = stmt.run(cleanUsername, pwdHash, cleanName, cleanPhone);
  const newUserId = Number(result.lastInsertRowid);

  const newUser = {
    id: newUserId,
    username: cleanUsername,
    name: cleanName,
    role: 'user',
    phone: cleanPhone,
  };

  const token = createToken(newUser);

  return res.status(201).json({
    ok: true,
    user: newUser,
    token,
  });
}

/**
 * GET /api/auth/me
 * Headers: Authorization: Bearer <token>
 */
function handleMe(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Chưa đăng nhập' });
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }

  const user = db
    .prepare('SELECT id, username, name, role, phone, created_at FROM users WHERE id = ?')
    .get(payload.id);

  if (!user) {
    return res.status(401).json({ ok: false, error: 'Tài khoản không tồn tại' });
  }

  return res.json({
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      phone: user.phone || '',
      created_at: user.created_at,
    },
  });
}

/**
 * GET /api/auth/users
 * Headers: Authorization: Bearer <token> (logged in / admin)
 */
function handleUsers(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ ok: false, error: 'Chưa đăng nhập' });
  }

  const token = authHeader.slice(7).trim();
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ ok: false, error: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn' });
  }

  const users = db
    .prepare('SELECT id, username, name, role, phone, created_at FROM users ORDER BY id ASC')
    .all();

  return res.json({
    ok: true,
    users,
  });
}

// Support both `/login` (when mounted at `/api/auth`) and `/auth/login` (when mounted at `/api`)
router.post('/login', handleLogin);
router.post('/auth/login', handleLogin);

router.post('/register', handleRegister);
router.post('/auth/register', handleRegister);

router.get('/me', handleMe);
router.get('/auth/me', handleMe);

router.get('/users', handleUsers);
router.get('/auth/users', handleUsers);

export default router;

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hashPassword } from './services/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const IMAGES_DIR = process.env.IMAGES_DIR || path.join(DATA_DIR, 'images');
export const GOOGLE_KEY_PATH = process.env.GOOGLE_KEY_PATH || path.join(DATA_DIR, 'google-key.json');

fs.mkdirSync(IMAGES_DIR, { recursive: true });

export const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'sale-tro.db');
if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}
const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

const migrations = [
  {
    version: 1,
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS landlords (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          phone TEXT DEFAULT '',
          zalo TEXT DEFAULT '',
          note TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          landlord_id INTEGER REFERENCES landlords(id) ON DELETE SET NULL,
          code TEXT DEFAULT '',
          address TEXT DEFAULT '',
          street TEXT DEFAULT '',
          district TEXT NOT NULL DEFAULT '',
          price INTEGER NOT NULL DEFAULT 0,
          deposit INTEGER DEFAULT 0,
          area_m2 REAL DEFAULT NULL,
          room_type TEXT DEFAULT 'Phòng trọ chung chủ',
          amenities TEXT DEFAULT '',
          electric_price TEXT DEFAULT '',
          water_price TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'trong',
          available_from TEXT DEFAULT '',
          description TEXT DEFAULT '',
          private_note TEXT DEFAULT '',
          source TEXT NOT NULL DEFAULT 'manual',
          sheet_source_id INTEGER DEFAULT NULL,
          sheet_row_key TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          status_changed_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS images (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
          filename TEXT DEFAULT '',
          remote_url TEXT DEFAULT '',
          size INTEGER DEFAULT 0,
          width INTEGER DEFAULT 0,
          height INTEGER DEFAULT 0,
          is_cover INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL DEFAULT ''
        );

        CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
        CREATE INDEX IF NOT EXISTS idx_rooms_district ON rooms(district);
        CREATE INDEX IF NOT EXISTS idx_rooms_landlord_id ON rooms(landlord_id);
        CREATE INDEX IF NOT EXISTS idx_images_room_id ON images(room_id);
      `);
    },
  },
  {
    version: 2,
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS sheet_sources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          landlord_id INTEGER REFERENCES landlords(id) ON DELETE SET NULL,
          name TEXT DEFAULT '',
          spreadsheet_id TEXT NOT NULL,
          sheet_name TEXT NOT NULL DEFAULT 'Sheet1',
          header_row INTEGER NOT NULL DEFAULT 1,
          column_map TEXT NOT NULL DEFAULT '{}',
          status_rules TEXT NOT NULL DEFAULT '{}',
          default_district TEXT DEFAULT '',
          enabled INTEGER NOT NULL DEFAULT 1,
          last_synced_at TEXT DEFAULT NULL,
          last_error TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS sync_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sheet_source_id INTEGER NOT NULL REFERENCES sheet_sources(id) ON DELETE CASCADE,
          started_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          finished_at TEXT DEFAULT NULL,
          added INTEGER NOT NULL DEFAULT 0,
          updated INTEGER NOT NULL DEFAULT 0,
          removed INTEGER NOT NULL DEFAULT 0,
          error TEXT DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          zalo_phone TEXT DEFAULT '',
          budget_min INTEGER DEFAULT NULL,
          budget_max INTEGER DEFAULT NULL,
          districts TEXT DEFAULT '',
          need_note TEXT DEFAULT '',
          status TEXT NOT NULL DEFAULT 'chua_cham',
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE TABLE IF NOT EXISTS sends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          room_ids TEXT NOT NULL DEFAULT '[]',
          sent_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          message TEXT NOT NULL DEFAULT ''
        );

        CREATE TABLE IF NOT EXISTS shared_carts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slug TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL DEFAULT '',
          customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
          room_ids TEXT NOT NULL DEFAULT '[]',
          note TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          expires_at TEXT DEFAULT NULL
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_rooms_sheet_row
          ON rooms(sheet_source_id, sheet_row_key)
          WHERE sheet_source_id IS NOT NULL AND sheet_row_key IS NOT NULL;
      `);
    },
  },
  {
    version: 3,
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS deals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
          room_code TEXT DEFAULT '',
          address TEXT DEFAULT '',
          district TEXT DEFAULT '',
          price INTEGER NOT NULL DEFAULT 0,
          commission_rate REAL DEFAULT 50,
          commission_amount INTEGER NOT NULL DEFAULT 0,
          deal_date TEXT NOT NULL DEFAULT (date('now', 'localtime')),
          move_in_date TEXT DEFAULT '',
          commission_status TEXT NOT NULL DEFAULT 'cho_thu',
          commission_received INTEGER DEFAULT 0,
          note TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_deals_customer_id ON deals(customer_id);
        CREATE INDEX IF NOT EXISTS idx_deals_room_id ON deals(room_id);
        CREATE INDEX IF NOT EXISTS idx_deals_deal_date ON deals(deal_date);
        CREATE INDEX IF NOT EXISTS idx_deals_commission_status ON deals(commission_status);
      `);

      const customerCols = database
        .prepare('PRAGMA table_info(customers)')
        .all()
        .map((c) => c.name);

      const addCol = (colName, colDef) => {
        if (!customerCols.includes(colName)) {
          database.exec(`ALTER TABLE customers ADD COLUMN ${colName} ${colDef}`);
        }
      };

      addCol('deal_room_id', 'INTEGER DEFAULT NULL');
      addCol('deal_room_code', "TEXT DEFAULT ''");
      addCol('deal_address', "TEXT DEFAULT ''");
      addCol('deal_district', "TEXT DEFAULT ''");
      addCol('deal_price', 'INTEGER DEFAULT 0');
      addCol('deal_date', "TEXT DEFAULT ''");
      addCol('deal_commission', 'INTEGER DEFAULT 0');
      addCol('deal_commission_status', "TEXT DEFAULT 'cho_thu'");

      database.exec(`
        UPDATE customers SET status = 'chua_cham' WHERE status = 'dang_tim';
        UPDATE customers SET status = 'da_chot' WHERE status = 'da_thue';
      `);
    },
  },
  {
    version: 4,
    up(database) {
      database.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          name TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          phone TEXT DEFAULT '',
          created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
        );

        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      `);

      const insertUser = database.prepare(`
        INSERT OR IGNORE INTO users (username, password_hash, name, role, phone)
        VALUES (?, ?, ?, ?, ?)
      `);

      insertUser.run('admin', hashPassword('admin123'), 'Quản trị viên', 'admin', '');
      insertUser.run('sale', hashPassword('sale123'), 'Môi giới Sale', 'user', '');
    },
  },
  {
    version: 5,
    up(database) {
      const customerCols = database
        .prepare('PRAGMA table_info(customers)')
        .all()
        .map((c) => c.name);

      const addCol = (colName, colDef) => {
        if (!customerCols.includes(colName)) {
          database.exec(`ALTER TABLE customers ADD COLUMN ${colName} ${colDef}`);
        }
      };

      addCol('urgency', "TEXT DEFAULT 'binh_thuong'");
      addCol('target_date', "TEXT DEFAULT ''");
      addCol('source', "TEXT DEFAULT 'manual'");

      database.exec(`
        CREATE INDEX IF NOT EXISTS idx_customers_urgency ON customers(urgency);
        CREATE INDEX IF NOT EXISTS idx_customers_target_date ON customers(target_date);
        CREATE INDEX IF NOT EXISTS idx_customers_source ON customers(source);
      `);
    },
  },
];

function runMigrations() {
  const row = db.prepare('PRAGMA user_version').get();
  let currentVersion = row ? row.user_version : 0;

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      db.exec('BEGIN');
      try {
        migration.up(db);
        db.exec(`PRAGMA user_version = ${migration.version}`);
        db.exec('COMMIT');
        currentVersion = migration.version;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    }
  }

  const defaultSettings = {
    cleanup_days: '30',
    sync_interval_minutes: '3',
    zalo_greeting: 'Chào anh/chị, em gửi mình tham khảo một số phòng phù hợp nhu cầu ạ:',
    zalo_signature: 'Anh/chị ưng căn nào nhắn em hẹn lịch qua xem trực tiếp nhé!',
  };

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [key, value] of Object.entries(defaultSettings)) {
    insertSetting.run(key, value);
  }
}

runMigrations();

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const result = {};
  for (const row of rows) {
    result[row.key] = row.value;
  }
  return result;
}

export default db;

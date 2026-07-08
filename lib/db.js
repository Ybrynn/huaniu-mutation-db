const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
let initSqlJs;
let db;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const uploadsDir = path.join(DATA_DIR, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

async function initDb() {
  initSqlJs = require('sql.js');
  const SQL = await initSqlJs();
  const dbPath = path.join(DATA_DIR, 'mutations.db');
  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS mutations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      tree_age TEXT DEFAULT '',
      tree_vigor TEXT DEFAULT '',
      fruit_shape TEXT DEFAULT '',
      fruit_color TEXT DEFAULT '',
      fruit_size TEXT DEFAULT '',
      soluble_solids TEXT DEFAULT '',
      firmness TEXT DEFAULT '',
      leaf_chars TEXT DEFAULT '',
      branch_chars TEXT DEFAULT '',
      phenophase TEXT DEFAULT '',
      disease_resistance TEXT DEFAULT '',
      image_path TEXT DEFAULT '',
      image_hash TEXT DEFAULT '',
      status TEXT DEFAULT '在库',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
  const cols = db.exec(`PRAGMA table_info(mutations)`).flatMap(r => r.values).map(v => v[1]);
  if (!cols.includes('fruit_index')) db.run(`ALTER TABLE mutations ADD COLUMN fruit_index TEXT DEFAULT ''`);
  if (!cols.includes('yield_perf')) db.run(`ALTER TABLE mutations ADD COLUMN yield_perf TEXT DEFAULT ''`);
  if (!cols.includes('stress_resistance')) db.run(`ALTER TABLE mutations ADD COLUMN stress_resistance TEXT DEFAULT ''`);
  if (!cols.includes('pest_resistance')) db.run(`ALTER TABLE mutations ADD COLUMN pest_resistance TEXT DEFAULT ''`);
  if (!cols.includes('rootstock_scion')) db.run(`ALTER TABLE mutations ADD COLUMN rootstock_scion TEXT DEFAULT ''`);
  if (!cols.includes('mutation_chars')) db.run(`ALTER TABLE mutations ADD COLUMN mutation_chars TEXT DEFAULT ''`);
  if (!cols.includes('orchard_address')) db.run(`ALTER TABLE mutations ADD COLUMN orchard_address TEXT DEFAULT ''`);
  if (!cols.includes('village_name')) db.run(`ALTER TABLE mutations ADD COLUMN village_name TEXT DEFAULT ''`);
  if (!cols.includes('orchard_manager')) db.run(`ALTER TABLE mutations ADD COLUMN orchard_manager TEXT DEFAULT ''`);
  if (!cols.includes('contact_phone')) db.run(`ALTER TABLE mutations ADD COLUMN contact_phone TEXT DEFAULT ''`);
  if (!cols.includes('orchard_type')) db.run(`ALTER TABLE mutations ADD COLUMN orchard_type TEXT DEFAULT ''`);
  if (!cols.includes('main_variety')) db.run(`ALTER TABLE mutations ADD COLUMN main_variety TEXT DEFAULT ''`);
  if (!cols.includes('seedling_source')) db.run(`ALTER TABLE mutations ADD COLUMN seedling_source TEXT DEFAULT ''`);
  if (!cols.includes('cultivation_management')) db.run(`ALTER TABLE mutations ADD COLUMN cultivation_management TEXT DEFAULT ''`);
  if (!cols.includes('growth_regulator_use')) db.run(`ALTER TABLE mutations ADD COLUMN growth_regulator_use TEXT DEFAULT ''`);
  if (!cols.includes('special_environment')) db.run(`ALTER TABLE mutations ADD COLUMN special_environment TEXT DEFAULT ''`);
  if (!cols.includes('investigation_team')) db.run(`ALTER TABLE mutations ADD COLUMN investigation_team TEXT DEFAULT ''`);
  if (!cols.includes('investigation_members')) db.run(`ALTER TABLE mutations ADD COLUMN investigation_members TEXT DEFAULT ''`);
  if (!cols.includes('team_contact')) db.run(`ALTER TABLE mutations ADD COLUMN team_contact TEXT DEFAULT ''`);
  if (!cols.includes('longitude')) db.run(`ALTER TABLE mutations ADD COLUMN longitude TEXT DEFAULT ''`);
  if (!cols.includes('latitude')) db.run(`ALTER TABLE mutations ADD COLUMN latitude TEXT DEFAULT ''`);
  if (!cols.includes('altitude')) db.run(`ALTER TABLE mutations ADD COLUMN altitude TEXT DEFAULT ''`);
  if (!cols.includes('location_image')) db.run(`ALTER TABLE mutations ADD COLUMN location_image TEXT DEFAULT ''`);
  if (!cols.includes('fruiting_age')) db.run(`ALTER TABLE mutations ADD COLUMN fruiting_age TEXT DEFAULT ''`);
  const dropCols = ['variety_name', 'mutation_type', 'discovery_location', 'discovery_date', 'evaluation', 'recorder'];
  for (const col of dropCols) {
    try { db.run(`ALTER TABLE mutations DROP COLUMN ${col}`); } catch (e) { /* column may not exist */ }
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS custom_fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS mutation_custom_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mutation_id INTEGER NOT NULL,
      field_id INTEGER NOT NULL,
      value TEXT DEFAULT '',
      FOREIGN KEY (mutation_id) REFERENCES mutations(id),
      FOREIGN KEY (field_id) REFERENCES custom_fields(id)
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      can_edit INTEGER DEFAULT 0,
      can_upload INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id INTEGER,
      detail TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `);
  const userCols = db.exec(`PRAGMA table_info(users)`).flatMap(r => r.values).map(v => v[1]);
  if (!userCols.includes('can_edit')) db.run(`ALTER TABLE users ADD COLUMN can_edit INTEGER DEFAULT 0`);
  if (!userCols.includes('can_upload')) db.run(`ALTER TABLE users ADD COLUMN can_upload INTEGER DEFAULT 0`);
  const adminExists = queryOne(`SELECT id FROM users WHERE username = 'admin'`);
  if (!adminExists) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync('admin123', salt, 10000, 64, 'sha512').toString('hex');
    execute(`INSERT INTO users (username, password_hash, salt, role) VALUES (?, ?, ?, 'admin')`, ['admin', hash, salt]);
    console.log('  已创建默认管理员账号 (admin / admin123)');
  }
  saveDb();
}

let saveTimer = null;
const SAVE_DEBOUNCE_MS = 5000;
const MAX_BACKUPS = 5;

function saveDb() {
  const dbPath = path.join(DATA_DIR, 'mutations.db');

  if (fs.existsSync(dbPath)) {
    const backupDir = path.join(DATA_DIR, 'backups');
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `mutations-${timestamp}.db`);
    fs.copyFileSync(dbPath, backupPath);

    const backups = fs.readdirSync(backupDir)
      .filter(f => f.startsWith('mutations-') && f.endsWith('.db'))
      .sort()
      .reverse();
    for (let i = MAX_BACKUPS; i < backups.length; i++) {
      try { fs.unlinkSync(path.join(backupDir, backups[i])); } catch(e) {}
    }
  }

  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveDb();
    saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

function execute(sql, params = []) {
  db.run(sql, params);
  scheduleSave();
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

function logOperation(userId, username, action, targetType, targetId, detail) {
  try {
    db.run(`INSERT INTO operation_logs (user_id, username, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?, ?)`, [userId||null, username||'', action, targetType||'', targetId||null, detail||'']);
  } catch(e) { console.error('logOperation error:', e.message); }
}

module.exports = { initDb, query, queryOne, execute, logOperation, saveDb, DATA_DIR };

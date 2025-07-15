const SyncMysql = require('sync-mysql');

const config = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  port: parseInt(process.env.MYSQL_PORT || '3306', 10),
  database: process.env.MYSQL_DATABASE || 'anycard',
};

let connection;

function connect() {
  if (!connection) {
    connection = new SyncMysql({
      host: config.host,
      user: config.user,
      password: config.password,
      port: config.port,
      multipleStatements: true,
    });
    connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
    connection.query(`USE \`${config.database}\``);
  }
}

function ensureTables() {
  // user information
  connection.query(`CREATE TABLE IF NOT EXISTS user_info (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    PRIMARY KEY(id)
  )`);

  // card files
  connection.query(`CREATE TABLE IF NOT EXISTS files (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    data LONGBLOB,
    preview LONGBLOB,
    comment TEXT,
    original_name VARCHAR(255),
    size INT,
    email VARCHAR(255),
    PRIMARY KEY(id),
    UNIQUE KEY uniq_owner_filename (owner, filename),
    INDEX idx_owner (owner),
    CONSTRAINT fk_files_owner FOREIGN KEY (owner) REFERENCES user_info(owner) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS groups (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    PRIMARY KEY(id),
    UNIQUE KEY uniq_owner_group (owner, group_id),
    CONSTRAINT fk_groups_owner FOREIGN KEY (owner) REFERENCES user_info(owner) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS file_groups (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uniq_file_group (owner, filename, group_id),
    INDEX idx_owner_filename (owner, filename),
    CONSTRAINT fk_file_groups_file FOREIGN KEY (owner, filename)
      REFERENCES files(owner, filename) ON DELETE CASCADE,
    CONSTRAINT fk_file_groups_group FOREIGN KEY (owner, group_id)
      REFERENCES groups(owner, group_id) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS group_emails (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uniq_group_email (owner, group_id, email),
    INDEX idx_owner_group (owner, group_id),
    CONSTRAINT fk_group_emails_group FOREIGN KEY (owner, group_id)
      REFERENCES groups(owner, group_id) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_state_hidden (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    keyname VARCHAR(255) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uniq_hidden (owner, keyname),
    INDEX idx_owner_hidden (owner),
    CONSTRAINT fk_hidden_owner FOREIGN KEY (owner) REFERENCES user_info(owner) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_state_show (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    keyname VARCHAR(255) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uniq_show (owner, keyname),
    INDEX idx_owner_show (owner),
    CONSTRAINT fk_show_owner FOREIGN KEY (owner) REFERENCES user_info(owner) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS rejections (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uniq_rejection (owner, group_id, email),
    CONSTRAINT fk_rejections_group FOREIGN KEY (owner, group_id)
      REFERENCES groups(owner, group_id) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS usage_stats (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uniq_usage (owner, group_id, email),
    CONSTRAINT fk_usage_group FOREIGN KEY (owner, group_id)
      REFERENCES groups(owner, group_id) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    PRIMARY KEY(id),
    UNIQUE KEY uniq_shared_users (email, owner),
    CONSTRAINT fk_shared_users_owner FOREIGN KEY (owner) REFERENCES user_info(owner) ON DELETE CASCADE
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS telegram_users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    telegram_id VARCHAR(255) UNIQUE,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    registered_at DATETIME,
    left_at DATETIME,
    active TINYINT(1) DEFAULT 1,
    PRIMARY KEY(id),
    CONSTRAINT fk_telegram_email FOREIGN KEY (email) REFERENCES user_info(email) ON DELETE CASCADE
  )`);

  const cols = connection
    .query('SHOW COLUMNS FROM telegram_users')
    .map((r) => r.Field);
  if (!cols.includes('registered_at')) {
    connection.query('ALTER TABLE telegram_users ADD COLUMN registered_at DATETIME');
  }
  if (!cols.includes('left_at')) {
    connection.query('ALTER TABLE telegram_users ADD COLUMN left_at DATETIME');
  }
  if (!cols.includes('active')) {
    connection.query('ALTER TABLE telegram_users ADD COLUMN active TINYINT(1) DEFAULT 1');
  }
}

function reset() {
  connect();
  connection.query(`CREATE DATABASE IF NOT EXISTS \`${config.database}\``);
  connection.query(`USE \`${config.database}\``);
  connection.query('SET FOREIGN_KEY_CHECKS=0');
  connection.query(
    'DROP TABLE IF EXISTS file_groups, group_emails, rejections, usage_stats, shared_users, files, groups, shared_state_hidden, shared_state_show, telegram_users, user_info'
  );
  connection.query('SET FOREIGN_KEY_CHECKS=1');
  ensureTables();
}

function getUploadsDir() {
  return '';
}

function getUserDir(id) {
  return id;
}

function ensureDirs(owner) {
  connect();
  const exist = connection.query('SELECT 1 FROM groups WHERE owner=? LIMIT 1', [owner]);
  if (exist.length === 0) {
    connection.query('INSERT INTO groups(owner, group_id, name) VALUES (?, ?, ?)', [owner, 'default', 'My Cards']);
  }
}

function ownerExists(owner) {
  connect();
  if (!owner) return false;
  const rows = connection.query('SELECT 1 FROM groups WHERE owner=? LIMIT 1', [owner]);
  return rows.length > 0;
}

function listFiles(owner) {
  connect();
  const rows = connection.query('SELECT filename FROM files WHERE owner=?', [owner]);
  return rows.map(r => r.filename);
}

function saveFile(owner, file, buffer) {
  connect();
  const hex = buffer.toString('hex');
  const exists = connection.query('SELECT 1 FROM files WHERE owner=? AND filename=?', [owner, file]);
  if (exists.length === 0) {
    connection.query('INSERT INTO files(owner, filename, data) VALUES (?, ?, UNHEX(?))', [owner, file, hex]);
  } else {
    connection.query('UPDATE files SET data=UNHEX(?) WHERE owner=? AND filename=?', [hex, owner, file]);
  }
}

function savePreview(owner, file, buffer) {
  connect();
  const hex = buffer.toString('hex');
  const exists = connection.query('SELECT 1 FROM files WHERE owner=? AND filename=?', [owner, file]);
  if (exists.length === 0) {
    connection.query('INSERT INTO files(owner, filename, preview) VALUES (?, ?, UNHEX(?))', [owner, file, hex]);
  } else {
    connection.query('UPDATE files SET preview=UNHEX(?) WHERE owner=? AND filename=?', [hex, owner, file]);
  }
}

function loadFile(owner, file, preview = false) {
  connect();
  const rows = connection.query(`SELECT ${preview ? 'preview' : 'data'} AS data FROM files WHERE owner=? AND filename=?`, [owner, file]);
  if (!rows.length || !rows[0].data) return null;
  return rows[0].data;
}

function deleteFile(owner, file) {
  connect();
  connection.query('DELETE FROM files WHERE owner=? AND filename=?', [owner, file]);
  connection.query('DELETE FROM file_groups WHERE owner=? AND filename=?', [owner, file]);
}

function loadMeta(owner, file) {
  connect();
  const rows = connection.query('SELECT comment, original_name, size, email FROM files WHERE owner=? AND filename=?', [owner, file]);
  if (!rows.length) return { comment: '', groups: ['default'] };
  const groups = connection.query('SELECT group_id FROM file_groups WHERE owner=? AND filename=?', [owner, file]).map(r => r.group_id);
  return {
    comment: rows[0].comment || '',
    groups: groups.length ? groups : ['default'],
    originalName: rows[0].original_name,
    size: rows[0].size,
    email: rows[0].email,
  };
}

function saveMeta(owner, file, meta) {
  connect();
  const exists = connection.query('SELECT 1 FROM files WHERE owner=? AND filename=?', [owner, file]);
  if (exists.length === 0) {
    connection.query('INSERT INTO files(owner, filename, comment, original_name, size, email) VALUES (?, ?, ?, ?, ?, ?)', [owner, file, meta.comment || '', meta.originalName || '', meta.size || 0, meta.email || '']);
  } else {
    connection.query('UPDATE files SET comment=?, original_name=?, size=?, email=? WHERE owner=? AND filename=?', [meta.comment || '', meta.originalName || '', meta.size || 0, meta.email || '', owner, file]);
  }
  connection.query('DELETE FROM file_groups WHERE owner=? AND filename=?', [owner, file]);
  (meta.groups || []).forEach(g => {
    connection.query('INSERT INTO file_groups(owner, filename, group_id) VALUES (?, ?, ?)', [owner, file, g]);
  });
}

function loadGroups(owner) {
  connect();
  const rows = connection.query('SELECT group_id AS id, name FROM groups WHERE owner=?', [owner]);
  if (!rows.length) {
    connection.query('INSERT INTO groups(owner, group_id, name) VALUES (?, ?, ?)', [owner, 'default', 'My Cards']);
    return [{ id: 'default', name: 'My Cards', emails: [] }];
  }
  return rows.map(r => {
    const emails = connection.query('SELECT email FROM group_emails WHERE owner=? AND group_id=?', [owner, r.id]).map(e => e.email);
    return { id: r.id, name: r.name, emails };
  });
}

function saveGroups(owner, groups) {
  connect();
  connection.query('DELETE FROM groups WHERE owner=?', [owner]);
  connection.query('DELETE FROM group_emails WHERE owner=?', [owner]);
  groups.forEach(g => {
    connection.query('INSERT INTO groups(owner, group_id, name) VALUES (?, ?, ?)', [owner, g.id, g.name]);
    (g.emails || []).forEach(email => {
      connection.query('INSERT INTO group_emails(owner, group_id, email) VALUES (?, ?, ?)', [owner, g.id, email]);
    });
  });
}

function loadSharedState(owner) {
  connect();
  const hidden = connection.query('SELECT keyname FROM shared_state_hidden WHERE owner=?', [owner]).map(r => r.keyname);
  const show = connection.query('SELECT keyname FROM shared_state_show WHERE owner=?', [owner]).map(r => r.keyname);
  return { hidden, showInMy: show };
}

function saveSharedState(owner, data) {
  connect();
  connection.query('DELETE FROM shared_state_hidden WHERE owner=?', [owner]);
  connection.query('DELETE FROM shared_state_show WHERE owner=?', [owner]);
  (data.hidden || []).forEach(k => {
    connection.query('INSERT INTO shared_state_hidden(owner, keyname) VALUES (?, ?)', [owner, k]);
  });
  (data.showInMy || []).forEach(k => {
    connection.query('INSERT INTO shared_state_show(owner, keyname) VALUES (?, ?)', [owner, k]);
  });
}

function loadRejections(owner) {
  connect();
  const rows = connection.query('SELECT group_id, email FROM rejections WHERE owner=?', [owner]);
  const result = {};
  rows.forEach(r => {
    if (!result[r.group_id]) result[r.group_id] = [];
    result[r.group_id].push(r.email);
  });
  return result;
}

function saveRejections(owner, data) {
  connect();
  connection.query('DELETE FROM rejections WHERE owner=?', [owner]);
  Object.keys(data).forEach(gid => {
    (data[gid] || []).forEach(email => {
      connection.query('INSERT INTO rejections(owner, group_id, email) VALUES (?, ?, ?)', [owner, gid, email]);
    });
  });
}

function loadUsage(owner) {
  connect();
  const rows = connection.query('SELECT group_id, email FROM usage_stats WHERE owner=?', [owner]);
  const result = {};
  rows.forEach(r => {
    if (!result[r.group_id]) result[r.group_id] = [];
    result[r.group_id].push(r.email);
  });
  return result;
}

function saveUsage(owner, data) {
  connect();
  connection.query('DELETE FROM usage_stats WHERE owner=?', [owner]);
  Object.keys(data).forEach(gid => {
    (data[gid] || []).forEach(email => {
      connection.query('INSERT INTO usage_stats(owner, group_id, email) VALUES (?, ?, ?)', [owner, gid, email]);
    });
  });
}

function allUserDirs() {
  connect();
  const rows = connection.query('SELECT DISTINCT owner FROM groups');
  return rows.map(r => r.owner);
}

function loadSharedUsers() {
  connect();
  const rows = connection.query('SELECT email, owner FROM shared_users');
  const result = {};
  rows.forEach(r => {
    if (!result[r.email]) result[r.email] = [];
    result[r.email].push(r.owner);
  });
  return result;
}

function saveSharedUsers(data) {
  connect();
  connection.query('DELETE FROM shared_users');
  Object.keys(data).forEach(email => {
    (data[email] || []).forEach(owner => {
      connection.query('INSERT INTO shared_users(email, owner) VALUES (?, ?)', [email, owner]);
    });
  });
}

function loadUserInfo() {
  connect();
  const rows = connection.query('SELECT owner, name, email FROM user_info');
  const result = {};
  rows.forEach(r => {
    result[r.owner] = { name: r.name, email: r.email };
  });
  return result;
}

function saveUserInfo(data) {
  connect();
  connection.query('DELETE FROM user_info');
  Object.keys(data).forEach(owner => {
    const info = data[owner] || {};
    connection.query('INSERT INTO user_info(owner, name, email) VALUES (?, ?, ?)', [owner, info.name || '', info.email || '']);
  });
}

function loadTelegramMap() {
  connect();
  const rows = connection.query(
    'SELECT email, telegram_id, username, first_name, last_name, registered_at, left_at, active FROM telegram_users'
  );
  const result = {};
  rows.forEach(r => {
    result[r.email] = {
      id: String(r.telegram_id),
      username: r.username || '',
      first_name: r.first_name || '',
      last_name: r.last_name || '',
      registeredAt: r.registered_at ? new Date(r.registered_at).toISOString() : null,
      leftAt: r.left_at ? new Date(r.left_at).toISOString() : null,
      active: !!r.active,
    };
  });
  return result;
}

function saveTelegramMap(data) {
  connect();
  Object.keys(data).forEach(email => {
    const info = data[email] || {};
    connection.query(
      `INSERT INTO telegram_users(email, telegram_id, username, first_name, last_name, registered_at, left_at, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE telegram_id=VALUES(telegram_id), username=VALUES(username), first_name=VALUES(first_name), last_name=VALUES(last_name), registered_at=VALUES(registered_at), left_at=VALUES(left_at), active=VALUES(active)`,
      [
        email.toLowerCase(),
        info.id,
        info.username || '',
        info.first_name || '',
        info.last_name || '',
        info.registeredAt || null,
        info.leftAt || null,
        info.active ? 1 : 0,
      ]
    );
  });
}

function findTelegramById(id) {
  connect();
  const rows = connection.query(
    'SELECT email, telegram_id, username, first_name, last_name, registered_at, left_at, active FROM telegram_users WHERE telegram_id=?',
    [id]
  );
  if (!rows || !rows.length) return null;
  const r = rows[0];
  return {
    email: r.email,
    id: String(r.telegram_id),
    username: r.username || '',
    first_name: r.first_name || '',
    last_name: r.last_name || '',
    registeredAt: r.registered_at ? new Date(r.registered_at).toISOString() : null,
    leftAt: r.left_at ? new Date(r.left_at).toISOString() : null,
    active: !!r.active,
  };
}

function addTelegramMapping(email, info) {
  connect();
  const existing = connection.query('SELECT email FROM telegram_users WHERE telegram_id=?', [info.id]);
  if (existing && existing.length) return false;
  connection.query(
    'INSERT INTO telegram_users(email, telegram_id, username, first_name, last_name, registered_at, left_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
    [
      email.toLowerCase(),
      info.id,
      info.username || '',
      info.first_name || '',
      info.last_name || '',
      new Date().toISOString().slice(0, 19).replace('T', ' '),
      null,
    ]
  );
  return true;
}

function updateTelegramStatus(id, active) {
  connect();
  const result = connection.query(
    'UPDATE telegram_users SET active=?, left_at=? WHERE telegram_id=?',
    [
      active ? 1 : 0,
      active ? null : new Date().toISOString().slice(0, 19).replace('T', ' '),
      id,
    ]
  );
  return result.affectedRows > 0;
}

module.exports = {
  getUploadsDir,
  getUserDir,
  ensureDirs,
  ownerExists,
  loadGroups,
  saveGroups,
  loadMeta,
  saveMeta,
  loadSharedState,
  saveSharedState,
  loadRejections,
  saveRejections,
  loadUsage,
  saveUsage,
  allUserDirs,
  loadSharedUsers,
  saveSharedUsers,
  loadTelegramMap,
  saveTelegramMap,
  findTelegramById,
  addTelegramMapping,
  updateTelegramStatus,
  loadUserInfo,
  saveUserInfo,
  saveFile,
  savePreview,
  loadFile,
  listFiles,
  deleteFile,
  reset,
};
module.exports.config = config;

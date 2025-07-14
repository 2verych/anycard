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
    ensureTables();
  }
}

function ensureTables() {
  // files and groups
  connection.query(`CREATE TABLE IF NOT EXISTS files (
    owner VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    data LONGBLOB,
    preview LONGBLOB,
    comment TEXT,
    original_name VARCHAR(255),
    size INT,
    email VARCHAR(255),
    PRIMARY KEY(owner, filename)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS file_groups (
    owner VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    PRIMARY KEY(owner, filename, group_id)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS groups (
    owner VARCHAR(255) NOT NULL,
    id VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    PRIMARY KEY(owner, id)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS group_emails (
    owner VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    PRIMARY KEY(owner, group_id, email)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_state_hidden (
    owner VARCHAR(255) NOT NULL,
    keyname VARCHAR(255) NOT NULL,
    PRIMARY KEY(owner, keyname)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_state_show (
    owner VARCHAR(255) NOT NULL,
    keyname VARCHAR(255) NOT NULL,
    PRIMARY KEY(owner, keyname)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS rejections (
    owner VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    PRIMARY KEY(owner, group_id, email)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS usage_stats (
    owner VARCHAR(255) NOT NULL,
    group_id VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    PRIMARY KEY(owner, group_id, email)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_users (
    email VARCHAR(255) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    PRIMARY KEY(email, owner)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS user_info (
    owner VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255),
    email VARCHAR(255)
  )`);
}

function reset() {
  connect();
  connection.query(
    'DROP TABLE IF EXISTS file_groups, files, groups, group_emails, shared_state_hidden, shared_state_show, rejections, usage_stats, shared_users, user_info'
  );
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
    connection.query('INSERT INTO groups(owner, id, name) VALUES (?, ?, ?)', [owner, 'default', 'My Cards']);
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
  const rows = connection.query('SELECT id, name FROM groups WHERE owner=?', [owner]);
  if (!rows.length) {
    connection.query('INSERT INTO groups(owner, id, name) VALUES (?, ?, ?)', [owner, 'default', 'My Cards']);
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
    connection.query('INSERT INTO groups(owner, id, name) VALUES (?, ?, ?)', [owner, g.id, g.name]);
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

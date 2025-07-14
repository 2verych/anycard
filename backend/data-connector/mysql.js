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
  connection.query(`CREATE TABLE IF NOT EXISTS files (
    owner VARCHAR(255) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    data LONGBLOB,
    preview LONGBLOB,
    meta JSON,
    PRIMARY KEY(owner, filename)
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS groups (
    owner VARCHAR(255) PRIMARY KEY,
    data JSON
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_state (
    owner VARCHAR(255) PRIMARY KEY,
    data JSON
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS rejections (
    owner VARCHAR(255) PRIMARY KEY,
    data JSON
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS usage_stats (
    owner VARCHAR(255) PRIMARY KEY,
    data JSON
  )`);

  connection.query(`CREATE TABLE IF NOT EXISTS shared_users (
    id INT PRIMARY KEY,
    data JSON
  )`);
  connection.query(`INSERT IGNORE INTO shared_users (id, data) VALUES (1, '{}')`);

  connection.query(`CREATE TABLE IF NOT EXISTS user_info (
    id INT PRIMARY KEY,
    data JSON
  )`);
  connection.query(`INSERT IGNORE INTO user_info (id, data) VALUES (1, '{}')`);
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
    const data = { groups: [{ id: 'default', name: 'My Cards', emails: [] }] };
    connection.query('INSERT INTO groups(owner, data) VALUES (?, ?)', [owner, JSON.stringify(data)]);
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
  const data = buffer.toString('base64');
  const exists = connection.query(
    'SELECT 1 FROM files WHERE owner=? AND filename=?',
    [owner, file]
  );
  if (exists.length === 0) {
    connection.query(
      'INSERT INTO files(owner, filename, data) VALUES (?, ?, ?)',
      [owner, file, data]
    );
  } else {
    connection.query(
      'UPDATE files SET data=? WHERE owner=? AND filename=?',
      [data, owner, file]
    );
  }
}

function savePreview(owner, file, buffer) {
  connect();
  const data = buffer.toString('base64');
  const exists = connection.query(
    'SELECT 1 FROM files WHERE owner=? AND filename=?',
    [owner, file]
  );
  if (exists.length === 0) {
    connection.query(
      'INSERT INTO files(owner, filename, preview) VALUES (?, ?, ?)',
      [owner, file, data]
    );
  } else {
    connection.query(
      'UPDATE files SET preview=? WHERE owner=? AND filename=?',
      [data, owner, file]
    );
  }
}

function loadFile(owner, file, preview = false) {
  connect();
  const rows = connection.query(
    `SELECT ${preview ? 'preview' : 'data'} AS data FROM files WHERE owner=? AND filename=?`,
    [owner, file]
  );
  if (!rows.length || !rows[0].data) return null;
  return Buffer.from(rows[0].data, 'base64');
}

function deleteFile(owner, file) {
  connect();
  connection.query('DELETE FROM files WHERE owner=? AND filename=?', [owner, file]);
}

function loadMeta(owner, file) {
  connect();
  const rows = connection.query('SELECT meta FROM files WHERE owner=? AND filename=?', [owner, file]);
  if (!rows.length || !rows[0].meta) return { comment: '', groups: ['default'] };
  try {
    return JSON.parse(rows[0].meta);
  } catch {
    return { comment: '', groups: ['default'] };
  }
}

function saveMeta(owner, file, meta) {
  connect();
  const exists = connection.query('SELECT 1 FROM files WHERE owner=? AND filename=?', [owner, file]);
  if (exists.length === 0) {
    connection.query('INSERT INTO files(owner, filename, meta) VALUES (?, ?, ?)', [owner, file, JSON.stringify(meta)]);
  } else {
    connection.query('UPDATE files SET meta=? WHERE owner=? AND filename=?', [JSON.stringify(meta), owner, file]);
  }
}

function loadGroups(owner) {
  connect();
  const rows = connection.query('SELECT data FROM groups WHERE owner=?', [owner]);
  if (!rows.length) {
    const data = { groups: [{ id: 'default', name: 'My Cards', emails: [] }] };
    connection.query('INSERT INTO groups(owner, data) VALUES (?, ?)', [owner, JSON.stringify(data)]);
    return data.groups;
  }
  const groups = JSON.parse(rows[0].data).groups || [];
  return groups.map(g => ({ emails: [], ...g }));
}

function saveGroups(owner, groups) {
  connect();
  const data = JSON.stringify({ groups });
  const exists = connection.query('SELECT 1 FROM groups WHERE owner=?', [owner]);
  if (exists.length === 0) {
    connection.query('INSERT INTO groups(owner, data) VALUES (?, ?)', [owner, data]);
  } else {
    connection.query('UPDATE groups SET data=? WHERE owner=?', [data, owner]);
  }
}

function loadSharedState(owner) {
  connect();
  const rows = connection.query('SELECT data FROM shared_state WHERE owner=?', [owner]);
  if (!rows.length) return { hidden: [], showInMy: [] };
  try { return JSON.parse(rows[0].data); } catch { return { hidden: [], showInMy: [] }; }
}

function saveSharedState(owner, data) {
  connect();
  const json = JSON.stringify(data);
  const exists = connection.query('SELECT 1 FROM shared_state WHERE owner=?', [owner]);
  if (exists.length === 0) {
    connection.query('INSERT INTO shared_state(owner, data) VALUES (?, ?)', [owner, json]);
  } else {
    connection.query('UPDATE shared_state SET data=? WHERE owner=?', [json, owner]);
  }
}

function loadRejections(owner) {
  connect();
  const rows = connection.query('SELECT data FROM rejections WHERE owner=?', [owner]);
  if (!rows.length) return {};
  try { return JSON.parse(rows[0].data); } catch { return {}; }
}

function saveRejections(owner, data) {
  connect();
  const json = JSON.stringify(data);
  const exists = connection.query('SELECT 1 FROM rejections WHERE owner=?', [owner]);
  if (exists.length === 0) {
    connection.query('INSERT INTO rejections(owner, data) VALUES (?, ?)', [owner, json]);
  } else {
    connection.query('UPDATE rejections SET data=? WHERE owner=?', [json, owner]);
  }
}

function loadUsage(owner) {
  connect();
  const rows = connection.query('SELECT data FROM usage_stats WHERE owner=?', [owner]);
  if (!rows.length) return {};
  try { return JSON.parse(rows[0].data); } catch { return {}; }
}

function saveUsage(owner, data) {
  connect();
  const json = JSON.stringify(data);
  const exists = connection.query('SELECT 1 FROM usage_stats WHERE owner=?', [owner]);
  if (exists.length === 0) {
    connection.query('INSERT INTO usage_stats(owner, data) VALUES (?, ?)', [owner, json]);
  } else {
    connection.query('UPDATE usage_stats SET data=? WHERE owner=?', [json, owner]);
  }
}

function allUserDirs() {
  connect();
  const rows = connection.query('SELECT owner FROM groups');
  return rows.map(r => r.owner);
}

function loadSharedUsers() {
  connect();
  const rows = connection.query('SELECT data FROM shared_users WHERE id=1');
  if (!rows.length) return {};
  try { return JSON.parse(rows[0].data); } catch { return {}; }
}

function saveSharedUsers(data) {
  connect();
  const json = JSON.stringify(data);
  connection.query('UPDATE shared_users SET data=? WHERE id=1', [json]);
}

function loadUserInfo() {
  connect();
  const rows = connection.query('SELECT data FROM user_info WHERE id=1');
  if (!rows.length) return {};
  try { return JSON.parse(rows[0].data); } catch { return {}; }
}

function saveUserInfo(data) {
  connect();
  const json = JSON.stringify(data);
  connection.query('UPDATE user_info SET data=? WHERE id=1', [json]);
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
};
module.exports.config = config;

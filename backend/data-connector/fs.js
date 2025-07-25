const fs = require('fs');
const path = require('path');

const BASE_DIR = process.env.FS_BASE_DIR || path.join(__dirname, '..', 'uploads');
const config = { baseDir: BASE_DIR };

function getUploadsDir() {
  return BASE_DIR;
}

function getUserDir(id) {
  return path.join(BASE_DIR, id);
}

function ensureDirs(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'previews'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'meta'), { recursive: true });
}

function ownerExists(owner) {
  if (!owner) return false;
  const dir = getUserDir(owner);
  return fs.existsSync(dir);
}

function groupsPath(dir) {
  return path.join(dir, 'groups.json');
}

function loadGroups(dir) {
  const file = groupsPath(dir);
  if (!fs.existsSync(file)) {
    const data = { groups: [{ id: 'default', name: 'My Cards', emails: [] }] };
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return data.groups;
  }
  const groups = JSON.parse(fs.readFileSync(file)).groups;
  return groups.map(g => ({ emails: [], ...g }));
}

function saveGroups(dir, groups) {
  fs.writeFileSync(groupsPath(dir), JSON.stringify({ groups }, null, 2));
}

function loadMeta(dir, file) {
  const metaFile = path.join(dir, 'meta', file + '.json');
  if (!fs.existsSync(metaFile)) {
    return { comment: '', groups: ['default'] };
  }
  try {
    return JSON.parse(fs.readFileSync(metaFile));
  } catch {
    return { comment: '', groups: ['default'] };
  }
}

function saveMeta(dir, file, meta) {
  fs.writeFileSync(path.join(dir, 'meta', file + '.json'), JSON.stringify(meta, null, 2));
}

function sharedStatePath(dir) {
  return path.join(dir, 'shared.json');
}
function loadSharedState(dir) {
  const file = sharedStatePath(dir);
  if (!fs.existsSync(file)) return { hidden: [], showInMy: [] };
  return JSON.parse(fs.readFileSync(file));
}
function saveSharedState(dir, state) {
  fs.writeFileSync(sharedStatePath(dir), JSON.stringify(state, null, 2));
}

function rejectionPath(dir) {
  return path.join(dir, 'rejections.json');
}
function loadRejections(dir) {
  const file = rejectionPath(dir);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file)); } catch { return {}; }
}
function saveRejections(dir, data) {
  fs.writeFileSync(rejectionPath(dir), JSON.stringify(data, null, 2));
}

function usagePath(dir) {
  return path.join(dir, 'usage.json');
}
function loadUsage(dir) {
  const file = usagePath(dir);
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file)); } catch { return {}; }
}
function saveUsage(dir, data) {
  fs.writeFileSync(usagePath(dir), JSON.stringify(data, null, 2));
}

function allUserDirs() {
  if (!fs.existsSync(BASE_DIR)) return [];
  return fs.readdirSync(BASE_DIR);
}

function sharedUsersPath() {
  // keep shared users mapping next to backend files for backward compatibility
  return path.join(__dirname, '..', 'shared-users.json');
}
function loadSharedUsers() {
  const file = sharedUsersPath();
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file)); } catch { return {}; }
}
function saveSharedUsers(data) {
  fs.writeFileSync(sharedUsersPath(), JSON.stringify(data, null, 2));
}

function telegramMapPath() {
  return path.join(__dirname, '..', 'telegram-users.json');
}
function loadTelegramMap() {
  const file = telegramMapPath();
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file)); } catch { return {}; }
}
function saveTelegramMap(data) {
  fs.writeFileSync(telegramMapPath(), JSON.stringify(data, null, 2));
}

function findTelegramById(id) {
  const map = loadTelegramMap();
  for (const [email, info] of Object.entries(map)) {
    if (String(info.id) === String(id)) {
      return { email, ...info };
    }
  }
  return null;
}

function addTelegramMapping(email, info) {
  const map = loadTelegramMap();
  // prevent multiple emails per Telegram user
  const exists = findTelegramById(info.id);
  if (exists) return false;
  map[email.toLowerCase()] = {
    id: String(info.id),
    username: info.username || '',
    first_name: info.first_name || '',
    last_name: info.last_name || '',
    registeredAt: new Date().toISOString(),
    leftAt: null,
    active: false,
  };
  saveTelegramMap(map);
  return true;
}

function updateTelegramStatus(id, active) {
  const map = loadTelegramMap();
  for (const email of Object.keys(map)) {
    const info = map[email];
    if (String(info.id) === String(id)) {
      info.active = active;
      info.leftAt = active ? null : new Date().toISOString();
      saveTelegramMap(map);
      return true;
    }
  }
  return false;
}

function userInfoPath() {
  return path.join(__dirname, '..', 'users.json');
}
function loadUserInfo() {
  const file = userInfoPath();
  if (!fs.existsSync(file)) return {};
  try { return JSON.parse(fs.readFileSync(file)); } catch { return {}; }
}
function saveUserInfo(data) {
  fs.writeFileSync(userInfoPath(), JSON.stringify(data, null, 2));
}

function saveFile(dir, file, buffer) {
  fs.writeFileSync(path.join(dir, file), buffer);
}

function savePreview(dir, file, buffer) {
  fs.writeFileSync(path.join(dir, 'previews', file), buffer);
}

function loadFile(dir, file, preview = false) {
  const fp = preview ? path.join(dir, 'previews', file) : path.join(dir, file);
  if (!fs.existsSync(fp)) return null;
  return fs.readFileSync(fp);
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(
      (f) =>
        !f.endsWith('.txt') && f !== 'previews' && f !== 'meta' && !f.endsWith('.json')
    );
}

function deleteFile(dir, file) {
  try {
    fs.unlinkSync(path.join(dir, file));
  } catch {}
  try {
    fs.unlinkSync(path.join(dir, 'previews', file));
  } catch {}
  try {
    fs.unlinkSync(path.join(dir, 'meta', file + '.json'));
  } catch {}
}

function reset() {
  fs.rmSync(BASE_DIR, { recursive: true, force: true });
  fs.mkdirSync(BASE_DIR, { recursive: true });
  try { fs.unlinkSync(sharedUsersPath()); } catch {}
  try { fs.unlinkSync(userInfoPath()); } catch {}
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

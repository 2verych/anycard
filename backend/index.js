require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const csrf = require('csurf');
const dataService = require('./data-service');
const dataConnector = require('./data-connector');

function emailHash(email) {
  return crypto.createHash('sha256').update(process.env.SALT + email).digest('hex');
}

function getUserId(req) {
  return req.user.hash;
}

function getUserEmail(req) {
  return req.user.emails[0].value;
}


require('dotenv').config();

if (!process.env.SESSION_SECRET) {
  console.error('SESSION_SECRET is required');
  process.exit(1);
}
if (!process.env.SALT) {
  console.error('SALT is required');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;
const PREVIEW_SIZE = parseInt(process.env.PREVIEW_SIZE) || 128;
const MAX_CARDS = parseInt(process.env.MAX_CARDS) || 100;
const MAX_GROUPS = parseInt(process.env.MAX_GROUPS) || 10;
const MAX_SHARE_EMAILS = parseInt(process.env.MAX_SHARE_EMAILS) || 10;
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024;
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(e => e);
const REQUIRE_TELEGRAM = process.env.REQUIRE_TELEGRAM === 'true';
const TELEGRAM_SECRET = process.env.TELEGRAM_SECRET || '';

console.log('Data connector type:', dataConnector.type);
if (dataConnector.type === 'mysql') {
  const { host, port, user, database } = dataConnector.config;
  console.log('MySQL config:', { host, port, user, database });
} else {
  console.log('FS config:', dataConnector.config);
}

function validPathComponent(name) {
  return typeof name === 'string' && !name.includes('..') && !name.includes('/') && !name.includes('\\');
}

function loadLocalization() {
  const dir = path.join(__dirname, 'localization');
  const result = {};
  if (fs.existsSync(dir)) {
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.json')) {
        const code = file.replace(/\.json$/, '');
        try {
          result[code] = JSON.parse(fs.readFileSync(path.join(dir, file)));
        } catch {}
      }
    }
  }
  return result;
}


function calculateUsage(owner) {
  const result = {};
  for (const dir of dataService.allOwners()) {
    if (dir === owner) continue;
    const state = dataService.loadSharedState(dir);
    for (const key of state.showInMy || []) {
      const [o, id] = key.split('/');
      if (o === owner) {
        if (!result[id]) result[id] = [];
        if (!result[id].includes(dir)) result[id].push(dir);
      }
    }
  }
  return result;
}


function updateSharedUsers(ownerId, oldEmails, newEmails) {
  const data = dataService.loadSharedUsers();
  for (const email of oldEmails) {
    if (!newEmails.includes(email)) {
      if (data[email]) {
        data[email] = data[email].filter(o => o !== ownerId);
        if (data[email].length === 0) delete data[email];
      }
    }
  }
  for (const email of newEmails) {
    if (!oldEmails.includes(email)) {
      if (!data[email]) data[email] = [];
      if (!data[email].includes(ownerId)) data[email].push(ownerId);
    }
  }
  dataService.saveSharedUsers(data);
}

function getSharedOwners(email) {
  const data = dataService.loadSharedUsers();
  return data[email] || [];
}

app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
// apply CSRF protection for most routes, but allow the Telegram bot
// to POST without a CSRF token
const csrfProtection = csrf();
app.use((req, res, next) => {
  if (req.path === '/telegram') return next();
  return csrfProtection(req, res, next);
});

passport.serializeUser((user, done) => {
  done(null, user);
});
passport.deserializeUser((obj, done) => {
  done(null, obj);
});

passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/auth/google/callback',
}, (accessToken, refreshToken, profile, done) => {
  profile.hash = emailHash(profile.emails[0].value);
  try {
    const info = dataService.loadUserInfo();
    const id = profile.hash;
    info[id] = { name: profile.displayName, email: profile.emails[0].value };
    dataService.saveUserInfo(info);
  } catch (e) {
    console.error('Failed to save user info', e);
  }
  return done(null, profile);
}));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.status(401).json({ error: 'unauthorized' });
}

function ensureAdmin(req, res, next) {
  if (req.isAuthenticated() && ADMIN_EMAILS.includes(getUserEmail(req))) return next();
  res.status(403).json({ error: 'forbidden' });
}

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  handler: (req, res) => {
    res.status(429).json({ error: 'limit_requests' });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.get('/auth/google', authLimiter, passport.authenticate('google', { scope: ['email', 'profile'] }));

app.get('/auth/google/callback', authLimiter, (req, res, next) => {
  passport.authenticate('google', (err, user) => {
    if (err) {
      console.error('Google OAuth error:', err);
      return res.redirect('/?auth=error');
    }
    if (!user) {
      return res.redirect('/?auth=failed');
    }
    req.logIn(user, (err) => {
      if (err) { return next(err); }
      res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
    });
  })(req, res, next);
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

app.post('/upload', ensureAuthenticated, (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'file_too_large' });
      }
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'upload_failed' });
    }
    const allowedMimeTypes = ['image/jpeg', 'image/png'];
    if (!req.file || !allowedMimeTypes.includes(req.file.mimetype)) {
      if (req.file && req.file.path) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(400).json({ error: 'invalid_file_type' });
    }
    try {
    const email = getUserEmail(req);
    const uid = getUserId(req);
    const existing = dataService.listCards(uid);
    if (existing.length >= MAX_CARDS) {
      return res.status(400).json({ error: 'limit_cards' });
    }

    const comment = req.body.comment || '';
    let groups = [];
    try { groups = JSON.parse(req.body.groups); } catch {}
    if (!Array.isArray(groups) || groups.length === 0) groups = ['default'];

    await dataService.addCard(uid, req.file, comment, groups, email);

    res.json({ success: true });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'upload_failed' });
  }
  });
});

app.get('/cards', ensureAuthenticated, (req, res) => {
  const uid = getUserId(req);
  res.json(dataService.listCards(uid));
});

app.get('/groups', ensureAuthenticated, (req, res) => {
  const uid = getUserId(req);
  const email = getUserEmail(req);
  dataService.ensureUser(uid);
  const groups = dataService.loadGroups(uid);
  const rejections = dataService.loadRejections(uid);
  const usageStored = dataService.loadUsage(uid);
  const usageDynamic = calculateUsage(uid);
  const usage = {};
  groups.forEach(g => {
    usage[g.id] = Array.from(new Set([...(usageStored[g.id] || []), ...(usageDynamic[g.id] || [])]));
  });
  const counts = Object.fromEntries(groups.map(g => [g.id, 0]));
  const cards = dataService.listCards(uid);
  cards.forEach(card => {
    card.groups.forEach(g => { if (counts[g] !== undefined) counts[g]++; });
  });
  res.json(groups.map(g => ({ id: g.id, name: g.name, emails: g.emails || [], rejected: rejections[g.id] || [], used: usage[g.id] || [], count: counts[g.id] || 0 })));
});

app.post('/groups', ensureAuthenticated, (req, res) => {
  const uid = getUserId(req);
  const groups = dataService.loadGroups(uid);
  if (groups.length >= MAX_GROUPS) {
    return res.status(400).json({ error: 'limit_groups' });
  }
  const id = Date.now().toString();
  const name = req.body.name || 'Group';
  groups.push({ id, name, emails: [] });
  dataService.saveGroups(uid, groups);
  res.json({ id, name, emails: [] });
});

app.put('/groups/:id', ensureAuthenticated, (req, res) => {
  const uid = getUserId(req);
  const groups = dataService.loadGroups(uid).map(g => g.id === req.params.id ? { ...g, name: req.body.name } : g);
  dataService.saveGroups(uid, groups);
  res.json({ success: true });
});

app.delete('/groups/:id', ensureAuthenticated, (req, res) => {
  const uid = getUserId(req);
  const all = dataService.loadGroups(uid);
  const target = all.find(g => g.id === req.params.id);
  if (!target) return res.status(404).json({ error: 'not_found' });
  const groups = all.filter(g => g.id !== req.params.id);
  dataService.saveGroups(uid, groups);
  updateSharedUsers(uid, target.emails || [], []);
  const cards = dataService.listCards(uid);
  cards.forEach(card => {
    if (card.groups.includes(req.params.id)) {
      const meta = dataService.loadMeta(uid, card.filename);
      meta.groups = meta.groups.filter(g => g !== req.params.id);
      dataService.saveMeta(uid, card.filename, meta);
    }
  });
  res.json({ success: true });
});

app.put('/groups/:id/emails', ensureAuthenticated, (req, res) => {
  const uid = getUserId(req);
  const emailOwner = getUserEmail(req);
  const emails = req.body.emails || [];
  if (emails.length > MAX_SHARE_EMAILS) {
    return res.status(400).json({ error: 'limit_emails' });
  }
  const groups = dataService.loadGroups(uid);
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'not_found' });
  const oldEmails = groups[idx].emails || [];
  groups[idx] = { ...groups[idx], emails };
  dataService.saveGroups(uid, groups);
  updateSharedUsers(uid, oldEmails, emails);
  res.json({ success: true });
});

app.get('/shared-groups', ensureAuthenticated, (req, res) => {
  const uid = getUserId(req);
  const email = getUserEmail(req);
  dataService.ensureUser(uid);
  const state = dataService.loadSharedState(uid);
  const result = [];
  const owners = getSharedOwners(email);
  const info = dataService.loadUserInfo();

  console.log('[shared-groups] user:', email);
  console.log('[shared-groups] owners:', owners);

  for (const dir of owners) {
    if (dir === email) continue;
    if (!dataService.ownerExists(dir)) continue;
    const groups = dataService.loadGroups(dir);
    const counts = Object.fromEntries(groups.map(g => [g.id, 0]));
    const cards = dataService.listCards(dir);
    cards.forEach(card => {
      card.groups.forEach(g => { if (counts[g] !== undefined) counts[g]++; });
    });
    const rejected = dataService.loadRejections(dir);

    console.log('[shared-groups] owner', dir, 'groups', groups);
    console.log('[shared-groups] owner', dir, 'counts', counts);
    console.log('[shared-groups] owner', dir, 'rejected map', rejected);

    groups.forEach(g => {
      if ((g.emails || []).includes(email)) {
        const key = dir + '/' + g.id;
        if (!state.hidden.includes(key)) {
          const ownerName = (info[dir]?.name || info[dir]?.email || dir);
          result.push({ owner: dir, ownerName, id: g.id, name: g.name, count: counts[g.id] || 0, showInMy: state.showInMy.includes(key), rejected: (rejected[g.id] || []).includes(email) });
        }
      }
    });
  }

  console.log('[shared-groups] result', result);

  res.json(result);
});

app.post('/shared-groups/:owner/:id/delete', ensureAuthenticated, (req, res) => {
  if (!validPathComponent(req.params.owner)) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  if (!dataService.ownerExists(req.params.owner)) {
    return res.status(404).json({ error: 'owner_not_found' });
  }
  const uid = getUserId(req);
  const email = getUserEmail(req);
  const state = dataService.loadSharedState(uid);
  const key = req.params.owner + '/' + req.params.id;
  if (!state.hidden.includes(key)) state.hidden.push(key);
  dataService.saveSharedState(uid, state);
  const rej = dataService.loadRejections(req.params.owner);
  if (!rej[req.params.id]) rej[req.params.id] = [];
  if (!rej[req.params.id].includes(email)) rej[req.params.id].push(email);
  dataService.saveRejections(req.params.owner, rej);
  res.json({ success: true });
});

app.post('/shared-groups/:owner/:id/show', ensureAuthenticated, (req, res) => {
  if (!validPathComponent(req.params.owner)) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  if (!dataService.ownerExists(req.params.owner)) {
    return res.status(404).json({ error: 'owner_not_found' });
  }
  const uid = getUserId(req);
  const email = getUserEmail(req);
  const state = dataService.loadSharedState(uid);
  const key = req.params.owner + '/' + req.params.id;
  state.showInMy = state.showInMy.filter(x => x !== key);
  if (req.body.show) state.showInMy.push(key);
  dataService.saveSharedState(uid, state);
  const usage = dataService.loadUsage(req.params.owner);
  if (!usage[req.params.id]) usage[req.params.id] = [];
  usage[req.params.id] = usage[req.params.id].filter(e => e !== email);
  if (req.body.show) usage[req.params.id].push(email);
  dataService.saveUsage(req.params.owner, usage);
  res.json({ success: true });
});

app.get('/shared-cards/:owner/:group', ensureAuthenticated, (req, res) => {
  if (!validPathComponent(req.params.owner)) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  const email = getUserEmail(req);
  if (!dataService.ownerExists(req.params.owner)) {
    return res.status(404).json({ error: 'owner_not_found' });
  }
  const groups = dataService.loadGroups(req.params.owner);
  const g = groups.find(x => x.id === req.params.group);
  if (!g || !(g.emails || []).includes(email)) return res.json([]);
  const result = dataService
    .listCards(req.params.owner)
    .filter(card => card.groups.includes(req.params.group));
  res.json(result);
});

app.post('/cards/:file/groups/:groupId', ensureAuthenticated, (req, res) => {
  if (!validPathComponent(req.params.file)) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  const uid = getUserId(req);
  const meta = dataService.loadMeta(uid, req.params.file);
  if (meta.groups.includes(req.params.groupId)) {
    meta.groups = meta.groups.filter(g => g !== req.params.groupId);
  } else {
    meta.groups.push(req.params.groupId);
  }
  dataService.saveMeta(uid, req.params.file, meta);
  res.json(meta);
});

app.delete('/cards/:file', ensureAuthenticated, (req, res) => {
  if (!validPathComponent(req.params.file)) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  const uid = getUserId(req);
  const cards = dataService.listCards(uid);
  if (!cards.find(c => c.filename === req.params.file)) {
    return res.status(404).json({ error: 'not_found' });
  }
  dataService.deleteCard(uid, req.params.file);
  res.json({ success: true });
});


function canAccessFile(owner, file, req) {
  const uid = getUserId(req);
  const email = getUserEmail(req);
  if (owner === uid) return true;
  const meta = dataService.loadMeta(owner, file);
  const groups = dataService.loadGroups(owner);
  for (const gid of meta.groups || []) {
    const g = groups.find(x => x.id === gid);
    if (g && (g.emails || []).includes(email)) return true;
  }
  return false;
}

function serveFile(req, res, preview) {
  if (!validPathComponent(req.params.owner) || !validPathComponent(req.params.file)) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  if (!dataService.ownerExists(req.params.owner)) {
    return res.status(404).json({ error: 'owner_not_found' });
  }
  if (!canAccessFile(req.params.owner, req.params.file, req)) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const buffer = dataService.loadFile(req.params.owner, req.params.file, preview);
  if (!buffer) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.type(path.extname(req.params.file));
  res.send(buffer);
}

app.get('/files/:owner/previews/:file', ensureAuthenticated, (req, res) => {
  serveFile(req, res, true);
});

app.get('/files/:owner/:file', ensureAuthenticated, (req, res) => {
  serveFile(req, res, false);
});

app.post('/admin/reset', ensureAdmin, (req, res) => {
  try {
    if (typeof dataConnector.reset === 'function') {
      dataConnector.reset();
    }
    res.json({ success: true });
  } catch (e) {
    console.error('Reset connector failed:', e);
    res.status(500).json({ error: 'reset_failed' });
  }
});

app.get('/localization', (req, res) => {
  res.json(loadLocalization());
});

app.get('/config', (req, res) => {
  res.json({ previewSize: PREVIEW_SIZE });
});

app.get('/me', (req, res) => {
  const user = req.isAuthenticated() ? req.user : null;
  const email = user?.emails?.[0]?.value;
  const admin = email ? ADMIN_EMAILS.includes(email) : false;

  if (user && REQUIRE_TELEGRAM && !admin) {
    const rawMap = dataService.loadTelegramMap();
    const allowed = new Set(Object.keys(rawMap).map(e => e.toLowerCase()));
    const emailLower = email.toLowerCase();
    if (!allowed.has(emailLower)) {
      return res.status(403).json({ error: 'telegram_required' });
    }
  }

  res.json({ user, csrfToken: req.csrfToken(), admin });
});

app.post('/telegram', (req, res) => {
  const { email, telegramId, username, first_name, last_name } = req.body || {};
  console.log('Received Telegram mapping request', email, telegramId);
  const key = req.get('x-telegram-key') || '';
  if (TELEGRAM_SECRET && key !== TELEGRAM_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!email || !telegramId) {
    return res.status(400).json({ error: 'invalid_input' });
  }
  try {
    const ok = dataService.addTelegramMapping(email.toLowerCase(), {
      id: telegramId,
      username,
      first_name,
      last_name,
    });
    if (!ok) {
      return res.status(409).json({ error: 'exists' });
    }
    console.log('Telegram mapping saved');
    res.json({ success: true });
  } catch (e) {
    console.error('Telegram map save failed:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

app.get('/telegram/:id', (req, res) => {
  const key = req.get('x-telegram-key') || '';
  if (TELEGRAM_SECRET && key !== TELEGRAM_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  try {
    const mapping = dataService.findTelegramById(req.params.id);
    if (!mapping) return res.status(404).json({ error: 'not_found' });
    res.json(mapping);
  } catch (e) {
    console.error('Lookup failed:', e);
    res.status(500).json({ error: 'internal_error' });
  }
});

// Generic error handler to prevent uncaught OAuth errors from crashing the app
app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({ error: 'invalid_csrf_token' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => console.log('Server running on port', PORT));

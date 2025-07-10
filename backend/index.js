const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const sharp = require('sharp');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;
const PREVIEW_SIZE = parseInt(process.env.PREVIEW_SIZE) || 128;

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

function getUserDir(req) {
  const email = req.user.emails[0].value;
  return path.join(__dirname, 'uploads', email);
}

function ensureDirs(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'previews'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'meta'), { recursive: true });
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

function allUserDirs() {
  const base = path.join(__dirname, 'uploads');
  if (!fs.existsSync(base)) return [];
  return fs.readdirSync(base);
}

app.use(morgan('dev'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());
app.use(session({
  secret: 'secret',
  resave: false,
  saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());

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
  return done(null, profile);
}));

function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.status(401).json({ error: 'Unauthorized' });
}

app.get('/auth/google', passport.authenticate('google', { scope: ['email', 'profile'] }));

app.get('/auth/google/callback', (req, res, next) => {
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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const email = req.user.emails[0].value;
    const userDir = path.join(__dirname, 'uploads', email);
    fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

app.post('/upload', ensureAuthenticated, upload.single('file'), async (req, res) => {
  try {
    const userDir = getUserDir(req);
    ensureDirs(userDir);

    const comment = req.body.comment || '';
    let groups = [];
    try { groups = JSON.parse(req.body.groups); } catch {}
    if (!Array.isArray(groups) || groups.length === 0) groups = ['default'];

    const previewPath = path.join(userDir, 'previews', req.file.filename);
    await sharp(req.file.path).resize(PREVIEW_SIZE).toFile(previewPath);

    const meta = { comment, groups };
    saveMeta(userDir, req.file.filename, meta);

    res.json({ success: true });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/cards', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  const email = req.user.emails[0].value;
  fs.readdir(userDir, (err, files) => {
    if (err) return res.json([]);
    const result = files
      .filter(f => !f.endsWith('.txt') && f !== 'previews' && f !== 'meta' && !f.endsWith('.json'))
      .map(f => {
        const meta = loadMeta(userDir, f);
        return {
          filename: f,
          original: `/uploads/${email}/${f}`,
          preview: `/uploads/${email}/previews/${f}`,
          comment: meta.comment,
          groups: meta.groups,
          owner: email,
        };
      });
    res.json(result);
  });
});

app.get('/groups', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  ensureDirs(userDir);
  const groups = loadGroups(userDir);
  const rejections = loadRejections(userDir);
  const counts = Object.fromEntries(groups.map(g => [g.id, 0]));
  fs.readdir(userDir, (err, files) => {
    if (!err) {
      files.filter(f => !f.endsWith('.txt') && f !== 'previews' && f !== 'meta' && !f.endsWith('.json'))
        .forEach(f => {
          const meta = loadMeta(userDir, f);
          meta.groups.forEach(g => { if (counts[g] !== undefined) counts[g]++; });
        });
    }
    res.json(groups.map(g => ({ id: g.id, name: g.name, emails: g.emails || [], rejected: rejections[g.id] || [], count: counts[g.id] || 0 })));
  });
});

app.post('/groups', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  const groups = loadGroups(userDir);
  const id = Date.now().toString();
  const name = req.body.name || 'Group';
  groups.push({ id, name, emails: [] });
  saveGroups(userDir, groups);
  res.json({ id, name, emails: [] });
});

app.put('/groups/:id', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  const groups = loadGroups(userDir).map(g => g.id === req.params.id ? { ...g, name: req.body.name } : g);
  saveGroups(userDir, groups);
  res.json({ success: true });
});

app.delete('/groups/:id', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  let groups = loadGroups(userDir).filter(g => g.id !== req.params.id);
  saveGroups(userDir, groups);
  fs.readdirSync(path.join(userDir, 'meta')).forEach(f => {
    const meta = loadMeta(userDir, f.replace('.json',''));
    if (meta.groups.includes(req.params.id)) {
      meta.groups = meta.groups.filter(g => g !== req.params.id);
      saveMeta(userDir, f.replace('.json',''), meta);
    }
  });
  res.json({ success: true });
});

app.put('/groups/:id/emails', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  const groups = loadGroups(userDir).map(g => g.id === req.params.id ? { ...g, emails: req.body.emails || [] } : g);
  saveGroups(userDir, groups);
  res.json({ success: true });
});

app.get('/shared-groups', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const myDir = getUserDir(req);
  ensureDirs(myDir);
  const state = loadSharedState(myDir);
  const result = [];
  for (const dir of allUserDirs()) {
    if (dir === email) continue;
    const ownerDir = path.join(__dirname, 'uploads', dir);
    const groups = loadGroups(ownerDir);
    const counts = Object.fromEntries(groups.map(g => [g.id, 0]));
    fs.readdirSync(ownerDir).forEach(f => {
      if (f === 'previews' || f === 'meta' || f.endsWith('.json')) return;
      const meta = loadMeta(ownerDir, f);
      meta.groups.forEach(g => { if (counts[g] !== undefined) counts[g]++; });
    });
    const rejected = loadRejections(ownerDir);
    groups.forEach(g => {
      if ((g.emails || []).includes(email)) {
        const key = dir + '/' + g.id;
        if (!state.hidden.includes(key)) {
          result.push({ owner: dir, id: g.id, name: g.name, count: counts[g.id] || 0, showInMy: state.showInMy.includes(key), rejected: (rejected[g.id] || []).includes(email) });
        }
      }
    });
  }
  res.json(result);
});

app.post('/shared-groups/:owner/:id/delete', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const myDir = getUserDir(req);
  const state = loadSharedState(myDir);
  const key = req.params.owner + '/' + req.params.id;
  if (!state.hidden.includes(key)) state.hidden.push(key);
  saveSharedState(myDir, state);
  const ownerDir = path.join(__dirname, 'uploads', req.params.owner);
  ensureDirs(ownerDir);
  const rej = loadRejections(ownerDir);
  if (!rej[req.params.id]) rej[req.params.id] = [];
  if (!rej[req.params.id].includes(email)) rej[req.params.id].push(email);
  saveRejections(ownerDir, rej);
  res.json({ success: true });
});

app.post('/shared-groups/:owner/:id/show', ensureAuthenticated, (req, res) => {
  const myDir = getUserDir(req);
  const state = loadSharedState(myDir);
  const key = req.params.owner + '/' + req.params.id;
  state.showInMy = state.showInMy.filter(x => x !== key);
  if (req.body.show) state.showInMy.push(key);
  saveSharedState(myDir, state);
  res.json({ success: true });
});

app.get('/shared-cards/:owner/:group', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const ownerDir = path.join(__dirname, 'uploads', req.params.owner);
  if (!fs.existsSync(ownerDir)) return res.json([]);
  const groups = loadGroups(ownerDir);
  const g = groups.find(x => x.id === req.params.group);
  if (!g || !(g.emails || []).includes(email)) return res.json([]);
  const files = fs.readdirSync(ownerDir).filter(f => !f.endsWith('.txt') && f !== 'previews' && f !== 'meta' && !f.endsWith('.json'));
  const result = files.filter(f => {
    const meta = loadMeta(ownerDir, f);
    return meta.groups.includes(req.params.group);
  }).map(f => {
    const meta = loadMeta(ownerDir, f);
    return {
      filename: f,
      original: `/uploads/${req.params.owner}/${f}`,
      preview: `/uploads/${req.params.owner}/previews/${f}`,
      comment: meta.comment,
      groups: meta.groups,
      owner: req.params.owner,
    };
  });
  res.json(result);
});

app.post('/cards/:file/groups/:groupId', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  const meta = loadMeta(userDir, req.params.file);
  if (meta.groups.includes(req.params.groupId)) {
    meta.groups = meta.groups.filter(g => g !== req.params.groupId);
  } else {
    meta.groups.push(req.params.groupId);
  }
  saveMeta(userDir, req.params.file, meta);
  res.json(meta);
});

app.delete('/cards/:file', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  const file = path.join(userDir, req.params.file);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found' });
  try {
    fs.unlinkSync(file);
  } catch {}
  try {
    fs.unlinkSync(path.join(userDir, 'previews', req.params.file));
  } catch {}
  try {
    fs.unlinkSync(path.join(userDir, 'meta', req.params.file + '.json'));
  } catch {}
  res.json({ success: true });
});

app.use('/uploads', ensureAuthenticated, express.static(path.join(__dirname, 'uploads')));

app.get('/localization', (req, res) => {
  res.json(loadLocalization());
});

app.get('/config', (req, res) => {
  res.json({ previewSize: PREVIEW_SIZE });
});

app.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json(null);
  }
});

// Generic error handler to prevent uncaught OAuth errors from crashing the app
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

app.listen(PORT, () => console.log('Server running on port', PORT));

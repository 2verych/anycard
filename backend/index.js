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
    const data = { groups: [{ id: 'default', name: 'Мои карты' }] };
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return data.groups;
  }
  return JSON.parse(fs.readFileSync(file)).groups;
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
        };
      });
    res.json(result);
  });
});

app.get('/groups', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  ensureDirs(userDir);
  const groups = loadGroups(userDir);
  const counts = Object.fromEntries(groups.map(g => [g.id, 0]));
  fs.readdir(userDir, (err, files) => {
    if (!err) {
      files.filter(f => !f.endsWith('.txt') && f !== 'previews' && f !== 'meta' && !f.endsWith('.json'))
        .forEach(f => {
          const meta = loadMeta(userDir, f);
          meta.groups.forEach(g => { if (counts[g] !== undefined) counts[g]++; });
        });
    }
    res.json(groups.map(g => ({ id: g.id, name: g.name, count: counts[g.id] || 0 })));
  });
});

app.post('/groups', ensureAuthenticated, (req, res) => {
  const userDir = getUserDir(req);
  const groups = loadGroups(userDir);
  const id = Date.now().toString();
  const name = req.body.name || 'Group';
  groups.push({ id, name });
  saveGroups(userDir, groups);
  res.json({ id, name });
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

app.use('/uploads', ensureAuthenticated, express.static(path.join(__dirname, 'uploads')));

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

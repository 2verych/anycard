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

function getUserDir(email) {
  return path.join(__dirname, 'uploads', email);
}

function loadGroups(email) {
  const groupsPath = path.join(getUserDir(email), 'groups.json');
  if (!fs.existsSync(groupsPath)) {
    const def = [{ id: 'default', name: 'Мои карты' }];
    fs.writeFileSync(groupsPath, JSON.stringify(def, null, 2));
    return def;
  }
  return JSON.parse(fs.readFileSync(groupsPath, 'utf8'));
}

function saveGroups(email, groups) {
  const groupsPath = path.join(getUserDir(email), 'groups.json');
  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2));
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
    const email = req.user.emails[0].value;
    const userDir = getUserDir(email);
    const previewDir = path.join(userDir, 'previews');
    fs.mkdirSync(previewDir, { recursive: true });
    loadGroups(email); // ensure groups file exists

    const comment = req.body.comment || '';
    let groups = req.body.groups || [];
    if (!Array.isArray(groups)) groups = groups ? [groups] : [];
    if (groups.length === 0) groups.push('default');

    const meta = { comment, groups };
    fs.writeFileSync(path.join(userDir, req.file.filename + '.json'), JSON.stringify(meta));

    const previewPath = path.join(previewDir, req.file.filename);
    await sharp(req.file.path).resize(PREVIEW_SIZE).toFile(previewPath);

    res.json({ success: true });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

app.get('/cards', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const groupFilter = req.query.group;
  const userDir = getUserDir(email);
  fs.readdir(userDir, (err, files) => {
    if (err) return res.json([]);
    const result = files
      .filter(f => !f.endsWith('.json') && f !== 'previews' && f !== 'groups.json')
      .map(f => {
        const metaPath = path.join(userDir, f + '.json');
        let comment = '';
        let groups = [];
        if (fs.existsSync(metaPath)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          comment = meta.comment || '';
          groups = meta.groups || [];
        }
        const card = {
          name: f,
          original: `/uploads/${email}/${f}`,
          preview: `/uploads/${email}/previews/${f}`,
          comment,
          groups,
        };
        return card;
      })
      .filter(c => !groupFilter || c.groups.includes(groupFilter));
    res.json(result);
  });
});

app.use('/uploads', ensureAuthenticated, express.static(path.join(__dirname, 'uploads')));

app.get('/groups', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const groups = loadGroups(email);
  const userDir = getUserDir(email);
  const counts = {};
  fs.readdirSync(userDir).forEach(f => {
    if (f.endsWith('.json') && f !== 'groups.json') {
      const meta = JSON.parse(fs.readFileSync(path.join(userDir, f), 'utf8'));
      (meta.groups || []).forEach(g => {
        counts[g] = (counts[g] || 0) + 1;
      });
    }
  });
  res.json(groups.map(g => ({ ...g, count: counts[g.id] || 0 })));
});

app.post('/groups', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const groups = loadGroups(email);
  const id = Date.now().toString();
  const group = { id, name: req.body.name || 'New Group' };
  groups.push(group);
  saveGroups(email, groups);
  res.json(group);
});

app.put('/groups/:id', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const groups = loadGroups(email);
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx >= 0) {
    groups[idx].name = req.body.name || groups[idx].name;
    saveGroups(email, groups);
  }
  res.json(groups[idx] || null);
});

app.delete('/groups/:id', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  let groups = loadGroups(email);
  groups = groups.filter(g => g.id !== req.params.id);
  saveGroups(email, groups);
  res.json({ success: true });
});

app.post('/cards/:name/groups/:gid', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const metaPath = path.join(getUserDir(email), req.params.name + '.json');
  let meta = { comment: '', groups: ['default'] };
  if (fs.existsSync(metaPath)) meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  if (!meta.groups.includes(req.params.gid)) meta.groups.push(req.params.gid);
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  res.json(meta);
});

app.delete('/cards/:name/groups/:gid', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const metaPath = path.join(getUserDir(email), req.params.name + '.json');
  if (!fs.existsSync(metaPath)) return res.json({});
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  meta.groups = (meta.groups || []).filter(g => g !== req.params.gid);
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  res.json(meta);
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

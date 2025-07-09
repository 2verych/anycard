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
    const userDir = path.join(__dirname, 'uploads', email);
    const previewDir = path.join(userDir, 'previews');
    fs.mkdirSync(previewDir, { recursive: true });

    const comment = req.body.comment || '';
    if (comment) {
      fs.writeFileSync(path.join(userDir, req.file.filename + '.txt'), comment);
    }

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
  const userDir = path.join(__dirname, 'uploads', email);
  fs.readdir(userDir, (err, files) => {
    if (err) return res.json([]);
    const result = files
      .filter(f => !f.endsWith('.txt') && f !== 'previews')
      .map(f => {
        const commentPath = path.join(userDir, f + '.txt');
        let comment = '';
        if (fs.existsSync(commentPath)) {
          comment = fs.readFileSync(commentPath, 'utf8');
        }
        return {
          original: `/uploads/${email}/${f}`,
          preview: `/uploads/${email}/previews/${f}`,
          comment,
        };
      });
    res.json(result);
  });
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

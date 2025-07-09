const express = require('express');
const session = require('express-session');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

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

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }
);

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

app.post('/upload', ensureAuthenticated, upload.single('file'), (req, res) => {
  res.json({ success: true });
});

app.get('/cards', ensureAuthenticated, (req, res) => {
  const email = req.user.emails[0].value;
  const userDir = path.join(__dirname, 'uploads', email);
  fs.readdir(userDir, (err, files) => {
    if (err) return res.json([]);
    const urls = files.map(f => `/uploads/${email}/${f}`);
    res.json(urls);
  });
});

app.use('/uploads', ensureAuthenticated, express.static(path.join(__dirname, 'uploads')));

app.get('/me', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.json(null);
  }
});

app.listen(PORT, () => console.log('Server running on port', PORT));

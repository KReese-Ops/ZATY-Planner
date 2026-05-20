'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express = require('express');
const session = require('express-session');
const path = require('path');

const { initDb } = require('./db/setup');
const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');

// ── Database ──────────────────────────────────────────────────────────────────
initDb();

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ── Sessions ──────────────────────────────────────────────────────────────────
const SQLiteStore = require('connect-sqlite3')(session);

app.use(
  session({
    store: new SQLiteStore({
      db: 'sessions.sqlite',
      dir: path.join(__dirname, '../data'),
    }),
    secret: process.env.SESSION_SECRET || 'please-change-me-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────

// Auth API + Google OAuth flows
app.use('/', authRoutes);

// Calendar API (all routes protected by requireAuth inside the router)
app.use('/api/calendar', calendarRoutes);

// ── Static files (the existing planner HTML/CSS/JS) ──────────────────────────
app.use(express.static(path.join(__dirname, '..')));

// Fallback: serve index.html for any unmatched GET request (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ZATY Planner running at http://localhost:${PORT}`);
  if (!process.env.GOOGLE_CLIENT_ID) {
    console.warn(
      '⚠  GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET not set — ' +
      'Google Calendar integration will be unavailable until you configure .env'
    );
  }
  if (
    process.env.NODE_ENV !== 'production' &&
    (!process.env.SESSION_SECRET ||
      process.env.SESSION_SECRET === 'please-change-me-in-production')
  ) {
    console.warn(
      '⚠  SESSION_SECRET is using the default insecure value. ' +
      'Set a long random string in .env before deploying.'
    );
  }
});

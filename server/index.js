'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL missing');
}

const express = require('express');
const session = require('express-session');
const path = require('path');
const connectPgSimple = require('connect-pg-simple');
const cors = require('cors');

const { pool } = require('./db/pool');
const { initDb } = require('./db/setup');
const authRoutes = require('./routes/auth');
const calendarRoutes = require('./routes/calendar');

// ── Database ──────────────────────────────────────────────────────────────────
initDb().catch((err) => {
  console.error('Failed to initialise database:', err);
  process.exit(1);
});

// ── App ───────────────────────────────────────────────────────────────────────
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(cors({
  origin: 'https://kreese-ops.github.io',
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
}));

// ── Sessions ──────────────────────────────────────────────────────────────────
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || 'please-change-me-in-production',
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'none',
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

// ── Graceful shutdown ─────────────────────────────────────────────────────────
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

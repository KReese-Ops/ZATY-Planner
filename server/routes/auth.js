'use strict';

const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { google } = require('googleapis');
const { getDb } = require('../db/setup');
const { encrypt, decrypt } = require('../utils/crypto');

const router = express.Router();

const BCRYPT_ROUNDS = 12;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
  );
}

function sanitizeEmail(raw) {
  return (raw || '').trim().toLowerCase();
}

// ── JSON API: Register ─────────────────────────────────────────────────────────

router.post('/api/auth/register', async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const password = (req.body.password || '').trim();
  const displayName = (req.body.displayName || '').trim() || null;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  try {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'An account with that email already exists.' });
    }

    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const result = db
      .prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)')
      .run(email, hash, displayName);

    req.session.userId = result.lastInsertRowid;
    req.session.userEmail = email;

    return res.status(201).json({
      user: { id: result.lastInsertRowid, email, displayName },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── JSON API: Login ────────────────────────────────────────────────────────────

router.post('/api/auth/login', async (req, res) => {
  const email = sanitizeEmail(req.body.email);
  const password = (req.body.password || '').trim();

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    req.session.userId = user.id;
    req.session.userEmail = user.email;

    return res.json({
      user: { id: user.id, email: user.email, displayName: user.display_name },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── JSON API: Logout ───────────────────────────────────────────────────────────

router.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
      return res.status(500).json({ error: 'Logout failed.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

// ── JSON API: Current user ─────────────────────────────────────────────────────

router.get('/api/auth/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.json({ user: null });
  }

  try {
    const db = getDb();
    const user = db
      .prepare('SELECT id, email, display_name FROM users WHERE id = ?')
      .get(req.session.userId);

    if (!user) {
      req.session.destroy(() => {});
      return res.json({ user: null });
    }

    const token = db
      .prepare('SELECT google_calendar_id FROM user_calendar_tokens WHERE user_id = ?')
      .get(user.id);

    return res.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        calendarConnected: !!token,
        calendarEmail: token ? token.google_calendar_id : null,
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    return res.status(500).json({ error: 'Could not fetch user.' });
  }
});

// ── Google OAuth: Initiate ─────────────────────────────────────────────────────

router.get('/auth/google', (req, res) => {
  if (!req.session || !req.session.userId) {
    // Preserve the return URL so we can send user back after they log in
    return res.redirect('/login.html?next=google');
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).send(
      'Google OAuth is not configured. ' +
      'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server/.env file.'
    );
  }

  // CSRF-protection state token stored in session
  const state = crypto.randomBytes(16).toString('hex');
  req.session.oauthState = state;

  const oauth2Client = getOAuthClient();
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
  });

  return res.redirect(authUrl);
});

// ── Google OAuth: Callback ─────────────────────────────────────────────────────

router.get('/auth/google/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    console.error('Google OAuth error:', error);
    return res.redirect('/planner.html?cal_error=' + encodeURIComponent(error));
  }

  // Validate CSRF state
  if (!state || state !== req.session.oauthState) {
    return res.redirect('/planner.html?cal_error=invalid_state');
  }
  delete req.session.oauthState;

  if (!req.session.userId) {
    return res.redirect('/login.html?next=google');
  }

  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);

    oauth2Client.setCredentials(tokens);

    // Fetch the user's Google email to use as calendar ID
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const { data: googleUser } = await oauth2.userinfo.get();
    const calendarId = googleUser.email;

    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO user_calendar_tokens
        (user_id, google_calendar_id, access_token_enc, refresh_token_enc, token_expiry, connected_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        google_calendar_id  = excluded.google_calendar_id,
        access_token_enc    = excluded.access_token_enc,
        refresh_token_enc   = COALESCE(excluded.refresh_token_enc, refresh_token_enc),
        token_expiry        = excluded.token_expiry,
        updated_at          = excluded.updated_at
    `).run(
      req.session.userId,
      calendarId,
      encrypt(tokens.access_token),
      tokens.refresh_token ? encrypt(tokens.refresh_token) : null,
      tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
      now,
      now
    );

    return res.redirect('/planner.html?cal_connected=1');
  } catch (err) {
    console.error('OAuth callback error:', err);
    return res.redirect('/planner.html?cal_error=token_exchange_failed');
  }
});

module.exports = router;

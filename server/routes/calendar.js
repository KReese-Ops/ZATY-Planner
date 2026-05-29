'use strict';

const express = require('express');
const { google } = require('googleapis');
const { query } = require('../db/pool');
const { encrypt, decrypt } = require('../utils/crypto');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
  );
}

/**
 * Load and refresh tokens for a user if needed.
 * Returns an authenticated OAuth2 client, or null if not connected.
 * Throws if the refresh token is invalid/revoked.
 */
async function getAuthedClient(userId) {
  const result = await query(
    'SELECT * FROM user_calendar_tokens WHERE user_id = $1',
    [userId]
  );
  const row = result.rows[0];

  if (!row) return null;

  const oauth2Client = getOAuthClient();

  const accessToken = decrypt(row.access_token_enc);
  const refreshToken = row.refresh_token_enc ? decrypt(row.refresh_token_enc) : null;

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: row.token_expiry ? new Date(row.token_expiry).getTime() : null,
  });

  const expiryMs = row.token_expiry ? new Date(row.token_expiry).getTime() : 0;
  const nowMs = Date.now();
  const fiveMinutes = 5 * 60 * 1000;

  if (expiryMs && nowMs >= expiryMs - fiveMinutes) {
    if (!refreshToken) {
      throw new Error('access_token_expired_no_refresh');
    }

    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);

      await query(
        `UPDATE user_calendar_tokens
         SET access_token_enc = $1,
             token_expiry     = $2,
             updated_at       = NOW()
         WHERE user_id = $3`,
        [
          encrypt(credentials.access_token),
          credentials.expiry_date
            ? new Date(credentials.expiry_date).toISOString()
            : null,
          userId,
        ]
      );
    } catch (refreshErr) {
      console.error('Token refresh failed for user', userId, refreshErr.message);
      throw new Error('token_refresh_failed');
    }
  }

  return oauth2Client;
}

// ── GET /api/calendar/events ──────────────────────────────────────────────────

router.get('/events', requireAuth, async (req, res) => {
  const dateStr = (req.query.date || '').match(/^\d{4}-\d{2}-\d{2}$/)
    ? req.query.date
    : new Date().toISOString().slice(0, 10);

  let authClient;
  try {
    authClient = await getAuthedClient(req.userId);
  } catch (err) {
    console.error('Auth client error for user', req.userId, err.message);
    if (err.message === 'token_refresh_failed') {
      return res.status(401).json({
        error: 'reconnect_required',
        message:
          'Your Google Calendar access has expired or been revoked. ' +
          'Please reconnect your calendar.',
      });
    }
    return res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }

  if (!authClient) {
    return res.status(404).json({ error: 'no_calendar_connected' });
  }

  const [year, month, day] = dateStr.split('-').map(Number);
  const timeMin = new Date(Date.UTC(year, month - 1, day, 0, 0, 0)).toISOString();
  const timeMax = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0)).toISOString();

  try {
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 50,
    });

    const events = (response.data.items || []).map((ev) => ({
      id: ev.id,
      summary: ev.summary || '(No title)',
      description: ev.description || '',
      location: ev.location || '',
      start: ev.start,
      end: ev.end,
      allDay: !ev.start.dateTime,
      htmlLink: ev.htmlLink,
    }));

    return res.json({ events, date: dateStr });
  } catch (err) {
    console.error('Calendar fetch error for user', req.userId, err.message);
    return res.status(500).json({ error: 'Failed to fetch calendar events.' });
  }
});

// ── POST /api/calendar/disconnect ────────────────────────────────────────────

router.post('/disconnect', requireAuth, async (req, res) => {
  try {
    await query(
      'DELETE FROM user_calendar_tokens WHERE user_id = $1',
      [req.userId]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error('Disconnect error:', err);
    return res.status(500).json({ error: 'Failed to disconnect calendar.' });
  }
});

module.exports = router;

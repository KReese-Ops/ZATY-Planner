'use strict';

const { query } = require('./pool');

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name  TEXT,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_calendar_tokens (
      user_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      google_calendar_id   TEXT NOT NULL,
      access_token_enc     TEXT NOT NULL,
      refresh_token_enc    TEXT,
      token_expiry         TIMESTAMPTZ,
      connected_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

module.exports = { initDb };

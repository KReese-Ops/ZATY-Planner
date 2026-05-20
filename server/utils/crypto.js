'use strict';

const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // 96-bit IV recommended for GCM
const TAG_LEN = 16;  // 128-bit auth tag

/**
 * Derive a fixed-length 256-bit key from the TOKEN_ENCRYPTION_KEY env var.
 * Uses scrypt so the raw env value can be any passphrase length.
 */
function getDerivedKey() {
  const passphrase = process.env.TOKEN_ENCRYPTION_KEY;
  if (!passphrase) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY environment variable is required for token encryption. ' +
      'Set it to a long random string (e.g. openssl rand -hex 32).'
    );
  }
  // scryptSync with a fixed salt — the passphrase itself is the primary secret
  return crypto.scryptSync(passphrase, 'zaty-planner-v1-salt', 32);
}

/**
 * Encrypt a plaintext string.
 * @param {string} plaintext
 * @returns {string} base64-encoded ciphertext (IV + auth tag + ciphertext)
 */
function encrypt(plaintext) {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Layout: [12 bytes IV][16 bytes tag][ciphertext]
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

/**
 * Decrypt a value produced by encrypt().
 * @param {string} ciphertext base64-encoded
 * @returns {string} plaintext
 */
function decrypt(ciphertext) {
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const key = getDerivedKey();
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data, undefined, 'utf8') + decipher.final('utf8');
}

module.exports = { encrypt, decrypt };

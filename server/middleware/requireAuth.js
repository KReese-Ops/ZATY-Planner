'use strict';

/**
 * Express middleware: requires an authenticated session.
 * Attaches req.userId for downstream handlers.
 * Returns 401 JSON for unauthenticated API requests.
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentication required. Please log in.' });
  }
  req.userId = req.session.userId;
  next();
}

module.exports = requireAuth;

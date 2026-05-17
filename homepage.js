/* ZATY Planner — Homepage logic */
(function () {
  'use strict';

  var PREF_KEY      = 'zaty_template';
  var LAST_VIEW_KEY = 'zaty_last_view';
  var DEST = { daily: 'planner.html', weekly: 'planner.html', monthly: 'monthly.html' };

  // ── Template selection ───────────────────────────────────────────────────
  // Defined first so it is always reachable — including after Cancel on the
  // redirect overlay or any other early-return branch below.
  function choose(template) {
    if (!DEST[template]) return;
    localStorage.setItem(PREF_KEY, template);
    // Persist the view so planner.html can restore it on next open.
    // 'monthly' goes to a different page, so no view key is needed for it.
    if (template === 'weekly') {
      localStorage.setItem(LAST_VIEW_KEY, 'week');
    } else if (template === 'daily') {
      localStorage.setItem(LAST_VIEW_KEY, 'day');
    }
    window.location.href = DEST[template];
  }

  // Expose globally so onclick= attributes work.
  window.chooseTemplate = choose;

  // ── Scroll CTA ───────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    var cta = document.getElementById('hero-cta');
    if (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById('choose');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    }
  });

  // ── Auto-redirect ────────────────────────────────────────────────────────
  // Skip when the user deliberately navigated back from the planner.
  // The planner's Home link sets this flag in sessionStorage before navigating.
  var fromPlanner = false;
  try {
    fromPlanner = sessionStorage.getItem('zaty_from_planner') === '1';
    if (fromPlanner) sessionStorage.removeItem('zaty_from_planner');
  } catch (e) { /* sessionStorage blocked — treat as fresh visit */ }
  if (fromPlanner) return;

  var saved = localStorage.getItem(PREF_KEY);

  if (saved && DEST[saved]) {
    showRedirectOverlay(saved);
  }

  // ── Redirect overlay ─────────────────────────────────────────────────────
  function showRedirectOverlay(template) {
    var overlay = document.getElementById('redirect-overlay');
    var msg     = document.getElementById('redirect-text');

    if (!overlay) {
      // Script ran before DOM was ready — wait for it.
      // Use a named handler so only one listener is ever registered.
      document.addEventListener('DOMContentLoaded', function onReady() {
        document.removeEventListener('DOMContentLoaded', onReady);
        showRedirectOverlay(template);
      });
      return;
    }

    var labels = { daily: 'Daily Planner', weekly: 'Weekly Planner', monthly: 'Monthly Planner' };
    msg.textContent = 'Opening your ' + (labels[template] || 'Planner') + '…';
    overlay.style.display = 'flex';

    var dest = DEST[template] || 'planner.html';
    var timer = setTimeout(function () {
      window.location.href = dest;
    }, 1200);

    // Use onclick assignment (not addEventListener) so only one handler is
    // ever active — prevents double-fire if this function is somehow called
    // more than once (e.g. from a DOMContentLoaded retry above).
    document.getElementById('redirect-cancel').onclick = function () {
      clearTimeout(timer);
      overlay.style.display = 'none';
      localStorage.removeItem(PREF_KEY);
      localStorage.removeItem(LAST_VIEW_KEY);
      // chooseTemplate is already on window — the cards work immediately.
    };
  }

})();

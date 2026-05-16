/* ZATY Planner — Homepage logic */
(function () {
  'use strict';

  var PREF_KEY = 'zaty_template';
  var PLANNER  = 'planner.html';

  // ── Template selection ───────────────────────────────────────────────────
  // Defined first so it is always reachable — including after Cancel on the
  // redirect overlay or any other early-return branch below.
  function choose(template) {
    if (template !== 'daily' && template !== 'weekly') return;
    localStorage.setItem(PREF_KEY, template);
    window.location.href = PLANNER;
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
  // Skip when the user deliberately navigated back from the planner
  // (planner.html links here with ?from=planner for exactly this purpose).
  var params = new URLSearchParams(window.location.search);
  if (params.get('from') === 'planner') {
    // User intentionally came back — show the homepage as-is, do not redirect.
    return;
  }

  var saved = localStorage.getItem(PREF_KEY);

  if (saved === 'daily' || saved === 'weekly') {
    showRedirectOverlay(saved);
  }

  // ── Redirect overlay ─────────────────────────────────────────────────────
  function showRedirectOverlay(template) {
    var overlay = document.getElementById('redirect-overlay');
    var msg     = document.getElementById('redirect-text');

    if (!overlay) {
      // Script ran before DOM was ready — wait for it.
      document.addEventListener('DOMContentLoaded', function () {
        showRedirectOverlay(template);
      });
      return;
    }

    var label = template === 'weekly' ? 'Weekly Planner' : 'Daily Planner';
    msg.textContent = 'Opening your ' + label + '…';
    overlay.style.display = 'flex';

    var timer = setTimeout(function () {
      window.location.href = PLANNER;
    }, 1200);

    document.getElementById('redirect-cancel').addEventListener('click', function () {
      clearTimeout(timer);
      overlay.style.display = 'none';
      localStorage.removeItem(PREF_KEY);
      // chooseTemplate is already on window — the cards work immediately.
    });
  }

})();

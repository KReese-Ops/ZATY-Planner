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
  // Skip when the user deliberately navigated back from the planner.
  // The planner's Home link sets this flag in sessionStorage before navigating.
  var fromPlanner = false;
  try {
    fromPlanner = sessionStorage.getItem('zaty_from_planner') === '1';
    if (fromPlanner) sessionStorage.removeItem('zaty_from_planner');
  } catch (e) { /* sessionStorage blocked — treat as fresh visit */ }
  if (fromPlanner) return;

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

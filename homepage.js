/* ZATY Planner — Homepage logic */
(function () {
  'use strict';

  var PREF_KEY  = 'zaty_template';
  var PLANNER   = 'planner.html';

  // ── Auto-redirect if a preference is already saved ──────────────────────
  var saved = localStorage.getItem(PREF_KEY);

  if (saved === 'daily' || saved === 'weekly') {
    showRedirectOverlay(saved);
    return; // nothing else runs until the user cancels
  }

  // ── Template selection ───────────────────────────────────────────────────
  function choose(template) {
    if (template !== 'daily' && template !== 'weekly') return;
    localStorage.setItem(PREF_KEY, template);
    window.location.href = 'planner.html';
  }

  // Expose globally so onclick= attributes work
  window.chooseTemplate = choose;

  // ── Redirect overlay ─────────────────────────────────────────────────────
  function showRedirectOverlay(template) {
    var overlay = document.getElementById('redirect-overlay');
    var msg     = document.getElementById('redirect-text');

    if (!overlay) {
      // Build overlay dynamically (runs before DOM is ready in <head> — defer)
      document.addEventListener('DOMContentLoaded', function () {
        showRedirectOverlay(template);
      });
      return;
    }

    var label = template === 'weekly' ? 'Weekly Planner' : 'Daily Planner';
    msg.textContent = 'Opening your ' + label + '…';
    overlay.style.display = 'flex';

    var timer = setTimeout(function () {
      window.location.href = 'planner.html';
    }, 1200);

    document.getElementById('redirect-cancel').addEventListener('click', function () {
      clearTimeout(timer);
      overlay.style.display = 'none';
      localStorage.removeItem(PREF_KEY);
    });
  }

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
})();

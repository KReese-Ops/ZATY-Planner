/* ZATY Planner — Homepage logic */
(function () {
  'use strict';

  var PREF_KEY      = 'zaty_template';
  var LAST_VIEW_KEY = 'zaty_last_view';
  var DEST = { daily: 'planner.html', weekly: 'planner.html', monthly: 'monthly.html' };

  // ── Settings keys (written by customize-template.html) ──────────────────
  var SETTINGS_KEYS = {
    daily:   'dailyPlannerSettings',
    weekly:  'weeklyPlannerSettings',
    monthly: 'monthlyPlannerSettings'
  };

  // ── "My Planner" — set view preference before navigating ────────────────
  // Navigation is handled by the <a href> on the link; this function just
  // persists the correct view key so the planner opens on the right tab.
  function openMyPlanner(type) {
    try {
      if (type === 'weekly')     localStorage.setItem(LAST_VIEW_KEY, 'week');
      else if (type === 'daily') localStorage.setItem(LAST_VIEW_KEY, 'day');
    } catch(e) {}
    // Do NOT call window.location.href here — the anchor's href handles it.
  }
  window.openMyPlanner = openMyPlanner;

  // ── Update "my planner" link visual state ────────────────────────────────
  // Adds .has-settings when the user has already customized that planner,
  // removes it when no settings exist, and updates the tooltip text.
  function updateMyPlannerLinks() {
    document.querySelectorAll('.my-planner-link').forEach(function (link) {
      var type = link.getAttribute('data-type');
      if (!type || !SETTINGS_KEYS[type]) return;
      var hasSettings = false;
      try { hasSettings = !!localStorage.getItem(SETTINGS_KEYS[type]); } catch(e) {}
      link.classList.toggle('has-settings', hasSettings);
      link.title = hasSettings
        ? 'Open your customized ' + type + ' planner'
        : 'Customize your ' + type + ' planner — create a template below';
    });
  }

  // ── Template selection (legacy path — kept for backward compat) ──────────
  // The "choose" path is no longer called by the homepage cards (they go to
  // customize-template.html instead), but may still be triggered elsewhere.
  function choose(template) {
    if (!DEST[template]) return;
    try {
      localStorage.setItem(PREF_KEY, template);
      if (template === 'weekly')     localStorage.setItem(LAST_VIEW_KEY, 'week');
      else if (template === 'daily') localStorage.setItem(LAST_VIEW_KEY, 'day');
    } catch(e) {}
    window.location.href = DEST[template];
  }
  window.chooseTemplate = choose;

  // ── DOMContentLoaded setup ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Smooth-scroll CTA
    var cta = document.getElementById('hero-cta');
    if (cta) {
      cta.addEventListener('click', function (e) {
        e.preventDefault();
        var target = document.getElementById('choose');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    }
    // Reflect saved settings state in the "my planner" links
    updateMyPlannerLinks();
  });

  // ── Auto-redirect ────────────────────────────────────────────────────────
  // Skip when the user deliberately navigated back from the planner.
  var fromPlanner = false;
  try {
    fromPlanner = sessionStorage.getItem('zaty_from_planner') === '1';
    if (fromPlanner) sessionStorage.removeItem('zaty_from_planner');
  } catch (e) {}
  if (fromPlanner) return;

  var saved = null;
  try { saved = localStorage.getItem(PREF_KEY); } catch(e) {}

  if (saved && DEST[saved]) {
    showRedirectOverlay(saved);
  }

  // ── Redirect overlay ─────────────────────────────────────────────────────
  function showRedirectOverlay(template) {
    var overlay = document.getElementById('redirect-overlay');
    var msg     = document.getElementById('redirect-text');

    if (!overlay) {
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
    var timer = setTimeout(function () { window.location.href = dest; }, 1200);

    document.getElementById('redirect-cancel').onclick = function () {
      clearTimeout(timer);
      overlay.style.display = 'none';
      try {
        localStorage.removeItem(PREF_KEY);
        localStorage.removeItem(LAST_VIEW_KEY);
      } catch(e) {}
    };
  }

})();

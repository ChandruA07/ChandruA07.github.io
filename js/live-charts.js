'use strict';
// =============================================================
//  live-charts.js — Incoming-data visualisation (home screen)
//
//  Everything here re-renders automatically: the Firebase
//  listeners (state-bridge.js) refresh DB.* and call the active
//  renderer, which calls renderLiveCharts(). No buttons, no
//  manual refresh — the charts move as data arrives.
//
//  Panels:
//   1. Cumulative plan vs actual — per module, planned dashed /
//      actual solid, built from POD planned qty and progress.
//   2. Daily activity bars — submitted vs completed per day for
//      the last 7 days (from /pod + /dailyProgress).
//   3. Manpower trend — Σ mp per day for the last 7 days from
//      POD entries.
//   4. Photo badges — photos uploaded this week per module
//      (POD photoURL + HSE observation photoURL).
// =============================================================

(function (global) {

  function _iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function _last7() {
    const out = [];
    for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); out.push(_iso(d)); }
    return out;
  }
  function _short(iso) { return iso.slice(8) + '/' + iso.slice(5,7); }

  function _overlay(id, show) {
    const o = document.getElementById(id);
    if (o) o.style.display = show ? 'flex' : 'none';
  }
  function _destroy(id) {
    if (typeof CH !== 'undefined' && CH[id]) { try { CH[id].destroy(); } catch(e){} delete CH[id]; }
  }

  function _allPod() {
    const out = [];
    ['s','w','b','l'].forEach(m => ((DB.pod && DB.pod[m]) || []).forEach(p => out.push(Object.assign({ _m: m }, p))));
    return out;
  }

  const MODS = [
    { k:'s', label:'Solar', col:'#ffca28' },
    { k:'w', label:'WTG',   col:'#4fc3f7' },
    { k:'b', label:'BOP',   col:'#ab47bc' },
    { k:'l', label:'Land',  col:'#66bb6a' }
  ];

  function renderLiveCharts() {
    const wrap = document.getElementById('home-live-viz');
    if (!wrap || typeof Chart === 'undefined' || typeof mkC !== 'function') return;
    // Defer the actual chart build to the next frame so the canvas containers
    // have real layout dimensions. Chart.js with maintainAspectRatio:false
    // measures the parent at creation time; if it runs while the home view is
    // still laying out (or momentarily 0-height), the charts render blank.
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(_buildLiveCharts);
    else _buildLiveCharts();
  }

  function _buildLiveCharts() {
    const wrap = document.getElementById('home-live-viz');
    if (!wrap || typeof Chart === 'undefined' || typeof mkC !== 'function') return;

    const days = _last7();
    const pods = _allPod();

    // ── 1. Module progress overview (ALWAYS has data) ──
    // The cumulative-from-POD chart was empty whenever the last-7-days POD
    // log was empty (common). This shows each module's live Actual % vs its
    // 100% Plan target — sourced from the same calc functions the KPI cards
    // use, so it is always populated and updates as progress is entered.
    const modProg = [
      { label: 'Solar', col: '#ffca28', val: (typeof calcSolarProg === 'function') ? Math.round(calcSolarProg()) : 0 },
      { label: 'WTG',   col: '#4fc3f7', val: (typeof calcWtgProg   === 'function') ? Math.round(calcWtgProg())   : 0 },
      { label: 'BOP',   col: '#ab47bc', val: (typeof calcBopProg   === 'function') ? Math.round(calcBopProg())   : 0 },
    ];
    if (typeof calcBop33PctV2 === 'function') {
      // add the 33kV sub-progress for extra granularity
      modProg.push({ label: '33kV', col: '#26c6da', val: Math.round(calcBop33PctV2()) });
    }
    _overlay('lv-cum-empty', false);
    mkC('ch-live-cum', { type: 'bar',
      data: { labels: modProg.map(m => m.label), datasets: [
        { label: 'Actual %', data: modProg.map(m => m.val),
          backgroundColor: modProg.map(m => m.col), borderRadius: 6, maxBarThickness: 54 },
        { label: 'Plan (target)', type: 'line', data: modProg.map(() => 100),
          borderColor: 'rgba(150,160,175,.7)', borderDash: [6,4], borderWidth: 1.5,
          pointRadius: 0, fill: false }
      ]},
      options: { responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'top', labels: { boxWidth: 14, font: { size: 8 } } },
                   tooltip: { callbacks: { label: (c) => c.dataset.label + ': ' + c.parsed.y + '%' } } },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v) => v + '%' } } } } });

    // ── 2. Daily activity bars — POD submissions + progress entries (7 days) ──
    // POD entries are plan-of-day submissions (status is no longer tracked on
    // POD — that lives in each module section), so "activity" here counts POD
    // submissions plus dailyProgress entries logged from the module sections.
    const submitted = days.map(d => pods.filter(p => p.date === d).length);
    const dpPerDay = days.map(d => (DB.dailyProgress || []).filter(e => e.ts && _iso(new Date(+e.ts)) === d).length);
    const dailyHasData = submitted.some(v => v) || dpPerDay.some(v => v);
    _overlay('lv-daily-empty', !dailyHasData);
    if (dailyHasData) {
      mkC('ch-live-daily', { type: 'bar',
        data: { labels: days.map(_short), datasets: [
          { label: 'POD submissions', data: submitted, backgroundColor: 'rgba(79,195,247,.7)',  borderRadius: 4 },
          { label: 'Progress updates', data: dpPerDay,  backgroundColor: 'rgba(0,230,118,.7)',   borderRadius: 4 }
        ]},
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: 'top', labels: { boxWidth: 14, font: { size: 8 } } } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    } else { _destroy('ch-live-daily'); }

    // ── 3. Manpower trend — Σ POD mp per day (mp coerced: forms may store strings) ──
    const mpPerDay = days.map(d => pods.filter(p => p.date === d)
      .reduce((s, p) => s + (parseFloat(p.mp) || 0), 0));
    let mpHasData = mpPerDay.some(v => v > 0);
    // Fallback: if no POD manpower in the window, plot today's actual on-site
    // manpower (DB.mp) so the chart is informative rather than blank.
    if (!mpHasData && typeof DB !== 'undefined' && DB.mp) {
      const today = (DB.mp.sol || 0) + (DB.mp.wtg || 0) + (DB.mp.bop || 0) + (DB.mp.mgmt || 0);
      if (today > 0) {
        mpPerDay[mpPerDay.length - 1] = today;
        mpHasData = true;
      }
    }
    _overlay('lv-mp-empty', !mpHasData);
    if (mpHasData) {
      mkC('ch-live-mp', { type: 'line',
        data: { labels: days.map(_short), datasets: [{
          label: 'Total manpower deployed', data: mpPerDay,
          borderColor: '#1565c0', backgroundColor: 'rgba(21,101,192,.15)',
          fill: true, tension: .3, pointRadius: 3, borderWidth: 2.2
        }]},
        options: { responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
    } else { _destroy('ch-live-mp'); }

    // ── 4. Photo count badges — this week, per module ──
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const badges = document.getElementById('lv-photo-badges');
    if (badges) {
      const counts = { s: 0, w: 0, b: 0, l: 0, hse: 0 };
      pods.forEach(p => {
        if (p.photoURL && (p.ts || 0) >= weekAgo && counts[p._m] !== undefined) counts[p._m]++;
      });
      ((typeof HSE_DB !== 'undefined' && HSE_DB.observations) || []).forEach(o => {
        if ((o.photoURL || o.photo) && (!o.ts || o.ts >= weekAgo)) counts.hse++;
      });
      const items = [
        ['☀️ Solar', counts.s], ['⚡ WTG', counts.w], ['🔌 BOP', counts.b],
        ['🌍 Land', counts.l], ['🦺 HSE', counts.hse]
      ];
      mount(badges, items.map(([lbl, n]) =>
        el('div', { class: 'live-photo-badge' }, lbl + ' photos this week:', el('b', String(n)))));
    }
  }

  global.renderLiveCharts = renderLiveCharts;

})(window);

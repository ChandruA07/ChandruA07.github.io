'use strict';
// =============================================================
//  sw.js — PWA offline SHELL for the SWPPL dashboard (Phase 3.8)
//
//  Scope of this worker — deliberately narrow:
//    • Pre-cache the app shell (index.html + css/js/images) so the
//      dashboard OPENS with no network ("installability + offline
//      shell loading").
//    • Offline DATA is NOT this worker's job: Firebase RTDB already
//      queues offline writes and replays them on reconnect (see
//      ARCHITECTURE.md §5.4) — no code needed here for that.
//    • CDN assets (Leaflet, Chart.js, supabase-js SDK, fonts,
//      frappe-gantt) are cached at runtime on first successful
//      fetch, network-first, so we never serve a stale SDK.
//
//  Bump CACHE_VERSION whenever any shell file changes; the old
//  cache is purged on activate.
// =============================================================

const CACHE_VERSION = 'swppl-shell-v11';

const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './css/page-logo.css',
  './css/advanced.css',
  './css/ui-polish.css',
  './continuumlogo.png',
  './solar.png',
  './turbine.png',
  './land.png',
  './bop.png',
  // every local script referenced by index.html:
  './js/supabase-config.js', './js/supabase-init.js', './js/shape-map.js', './js/dom.js', './js/auth.js', './js/data-api.js',
  './js/realtime.js', './js/storage.js', './js/state.js', './js/data.js',
  './js/state-bridge.js', './js/calc.js', './js/charts.js', './js/live-charts.js',
  './js/date-picker.js', './js/nav.js', './js/render-home.js', './js/render-solar.js',
  './js/wtg-structure.js', './js/solar-structure.js', './js/solar-gis-data.js',
  './js/project-creator.js', './js/render-wtg.js', './js/render-land.js',
  './js/render-bop.js', './js/render-misc.js',
  './js/render-procurement.js', './js/render-inventory.js', './js/render-planning.js',
  './js/render-documents.js', './js/render-reports.js', './js/render-audit.js',
  './js/advanced.js', './js/user-panel.js', './js/notify.js', './js/ui-live.js',
  './js/loader.js'
];

self.addEventListener('install', ev => {
  ev.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (ev.request.method !== 'GET') return;                       // writes go straight through
  if (url.hostname.endsWith('.supabase.co') ||
      url.hostname.endsWith('.supabase.in') ||
      url.hostname.includes('googleapis.com') && url.pathname.includes('/v0/b/')) {
    return;                                                      // never intercept live data / Storage
  }

  if (url.origin === location.origin) {
    // App shell: cache-first (instant open), background revalidate.
    ev.respondWith(
      caches.match(ev.request).then(hit => {
        const refresh = fetch(ev.request).then(res => {
          if (res && res.ok) caches.open(CACHE_VERSION).then(c => c.put(ev.request, res.clone())).catch(() => {});
          return res;
        }).catch(() => hit);
        return hit || refresh;
      })
    );
  } else {
    // CDN: network-first, fall back to whatever we cached last time.
    ev.respondWith(
      fetch(ev.request).then(res => {
        if (res && res.ok) caches.open(CACHE_VERSION).then(c => c.put(ev.request, res.clone())).catch(() => {});
        return res;
      }).catch(() => caches.match(ev.request))
    );
  }
});

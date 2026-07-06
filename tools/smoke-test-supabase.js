'use strict';
// =====================================================================
//  smoke-test-supabase.js — boots the MIGRATED dashboard headlessly in
//  jsdom, with window.supabase.createClient returning the pg-backed
//  shim (tools/supabase-mock.js) pointed at the local Postgres that ran
//  sql/schema.sql + sql/seed.sql.
//
//  This means: loader → nav → auth → data-api → realtime → state-bridge
//  → renderers all execute the REAL shipped code, and every listener's
//  initial fetch pulls REAL rows from the REAL schema. What it cannot
//  cover: websocket delivery, real Supabase Auth, Storage uploads —
//  see docs/supabase/TESTING.md §C.
//
//  Usage:  node tools/smoke-test-supabase.js "postgresql:///swppl_test?host=/tmp"
// =====================================================================
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createMock } = require('./supabase-mock.js');

const CONN = process.argv[2] || 'postgresql://postgres@localhost/swppl_test?host=/tmp';
const ROOT = path.join(__dirname, '..');
const sbClient = createMock(CONN);

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
// no network in test: strip CDN tags (supabase-js is replaced by the shim)
html = html.replace(/<script src="https?:\/\/[^"]+"><\/script>/g, '');
html = html.replace(/<link[^>]+href="https?:\/\/[^"]*"[^>]*>/g, '');
// install stubs BEFORE the first local script
html = html.replace('<script src="js/supabase-config.js"></script>',
  '<script>window.__installStubs && window.__installStubs(window);</script>\n<script src="js/supabase-config.js"></script>');

const vc = new VirtualConsole();
const logs = [];
vc.on('error', e => logs.push(['error', String(e)]));
vc.on('jsdomError', e => logs.push(['jsdomError', String(e && e.message)]));
vc.on('log', (...a) => logs.push(['log', a.join(' ')]));
vc.on('warn', (...a) => logs.push(['warn', a.join(' ')]));

function installStubs(window) {
  // the migrated app expects window.supabase.createClient → hand it the shim
  window.supabase = { createClient: () => sbClient };
  // Chart.js + Leaflet + canvas stubs (same as the legacy suite)
  function ChartStub(c, cfg) { this.destroy = () => {}; this.update = () => {}; this.config = cfg; }
  ChartStub.register = () => {};
  window.Chart = ChartStub;
  window.L = { map: () => ({ setView() { return this; }, remove() {}, invalidateSize() {}, on() {}, fitBounds() {}, flyTo() {}, addLayer() {} }),
    tileLayer: () => ({ addTo: () => {} }), marker: () => ({ bindPopup() { return this; }, addTo() { return this; }, on() { return this; } }),
    layerGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
    divIcon: () => ({}), icon: () => ({}), polyline: () => ({ addTo() { return this; } }), control: { layers: () => ({ addTo: () => {} }) },
    circleMarker: () => ({ bindPopup() { return this; }, addTo() { return this; }, on() { return this; } }), latLngBounds: () => ({}) };
  window.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : () => ({})) });
}

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + ROOT + '/index.html',
  virtualConsole: vc,
  pretendToBeVisual: true,
  beforeParse(window) { window.__installStubs = installStubs; }
});

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('PASS  ' + label); }
  else { fail++; console.log('FAIL  ' + label); }
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const window = dom.window, d = window.document;
  // wait for boot: loader mounts views, listeners fetch seed data
  for (let i = 0; i < 60 && !(window.DB && window.dataApi && d.getElementById('view-home')); i++) await sleep(100);
  await sleep(1500);   // let initial listener fetches land + first render

  console.log('── boot ────────────────────────────────────────────');
  ok(!!window.sb, 'supabase client initialised (window.sb)');
  ok(window.backendInfo && window.backendInfo.provider === 'supabase', 'backendInfo reports supabase');
  ok(d.querySelectorAll('template[data-partial]').length >= 24, 'inline templates present (' + d.querySelectorAll('template[data-partial]').length + ')');
  ok(d.getElementById('view-home') && d.getElementById('view-home').innerHTML.length > 500, 'home view injected');
  ok(d.getElementById('view-pod'), 'POD view injected');
  ok(typeof window.dataApi === 'object' && typeof window.dataApi.addPod === 'function', 'dataApi surface available');
  ok(typeof window.dataApi.addVendor === 'function' && typeof window.dataApi.recordTransfer === 'function', 'v11 module writers available');
  ok(typeof window.dataApi.setTurbine === 'function' && typeof window.dataApi.markNotificationRead === 'function', 'new Supabase-build writers exposed');
  ok(typeof window.realtime === 'object' && typeof window.realtime.listenBop === 'function', 'realtime surface available');
  ok(typeof window.realtime.listenNotifications === 'function' && typeof window.realtime.listenItcMaps === 'function', 'new listeners exposed');
  ok(window.auth && window.auth.MODE === 'supabase', 'auth runs in supabase mode (not demo fallback)');

  console.log('── seeded data hydration (Postgres → listeners → DB mirror) ──');
  // NOTE (pre-existing design, unchanged): the turbine roster is defined
  // client-side (data.js); DB rows PATCH roster entries, never add ids.
  ok(window.DB && window.DB.wtg && Array.isArray(window.DB.wtg.turbines) && window.DB.wtg.turbines.length >= 10,
     'turbine roster present (' + (window.DB.wtg && window.DB.wtg.turbines.length) + ')');
  const mbi = (window.DB.wtg.turbines || []).find(t => t.id === 'MBI-12');
  ok(!!mbi, 'seeded turbine MBI-12 present in DB mirror');
  // order-independent hydration proof: baseline data.js has NO notes on
  // MBI-12; any notes value can only have arrived from Postgres (seed's
  // 'COMPLETED…' or a later test write like 'T4 95%').
  ok(mbi && typeof mbi.notes === 'string' && /COMPLETED|T4 95%/.test(mbi.notes),
     'MBI-12 carries Postgres-sourced values (hydrated, not data.js baseline)');
  const itcs = window.DB.solar && window.DB.solar.itcs;
  ok(itcs && Object.keys(itcs).length === 6, 'all 6 ITCs hydrated');
  ok(itcs && itcs['ITC-1'] && itcs['ITC-1'].acts && Object.keys(itcs['ITC-1'].acts).length > 0, 'ITC-1 activities hydrated');
  ok(window.DB.bop66 || (window.DB.bop && true), 'BOP state present');
  const hseArr = window.HSE_DB && (window.HSE_DB.employees || window.HSE_DB);
  ok(!!hseArr, 'HSE state object exists');

  console.log('── write path through real UI stack ────────────────');
  // sign-in mock: the suite has no Supabase Auth server; emulate a solar
  // session by injecting the profile the way onAuthStateChange would.
  // (Real auth round-trip is a §C post-deploy check.)
  const marker = 'jsdom boot POD ' + Date.now() + ' <script>evil</script>';
  await window.dataApi.addPod({ module: 's', activity: marker, qty: 7, byName: '<b>bold</b>name' });
  await sleep(700);
  const rows = await sbClient._pool.query(`select activity from pod_entries where activity = $1`, [marker]);
  ok(rows.rows.length === 1, 'POD submitted from the booted app landed in Postgres');
  // XSS: rendered POD list must escape
  const podList = d.getElementById('pod-live-list') || d.getElementById('view-pod');
  const podHtml = podList ? podList.innerHTML : '';
  ok(!podHtml.includes('<script>evil'), 'activity escaped in rendered POD output');

  console.log('── console noise ───────────────────────────────────');
  const errs = logs.filter(l => l[0] === 'error' || l[0] === 'jsdomError')
    .filter(l => !/Could not load img|not implemented|scrollTo|canvas|placeholder values/i.test(l[1]));
  ok(errs.length === 0, 'no unexpected runtime errors during boot' + (errs.length ? ' — ' + errs[0][1].slice(0, 160) : ''));
  if (errs.length) errs.slice(0, 5).forEach(e => console.log('   ·', e[1].slice(0, 200)));

  console.log('════════════════════════════════════════════════════');
  console.log(fail === 0 ? `✅ supabase boot smoke: all ${pass} checks passed`
                         : `❌ supabase boot smoke: ${fail} FAILED / ${pass} passed`);
  await sbClient._end();
  window.close();
  process.exit(fail === 0 ? 0 : 1);
})().catch(async e => { console.error('SUITE CRASHED:', e); try { await sbClient._end(); } catch(_){} process.exit(2); });

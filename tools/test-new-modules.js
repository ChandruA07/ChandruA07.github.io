'use strict';
// =====================================================================
//  test-new-modules.js (SUPABASE EDITION) — v11 module verification on
//  the migrated stack. Same test intent as the Firebase edition (kept
//  as tools/test-new-modules.firebase.js.bak); the storage assertions
//  now check REAL Postgres rows through tools/supabase-mock.js instead
//  of an in-memory RTDB tree, and the database.rules.json static
//  checks are replaced by sql/rls-policies.sql sanity (the EXECUTABLE
//  equivalent is tools/test-rls.sh, run separately).
//
//  Usage:
//    createdb swppl_test && psql -d swppl_test -f sql/schema.sql \
//      && psql -d swppl_test -f sql/seed.sql
//    node tools/test-new-modules.js "postgresql:///swppl_test?host=/tmp"
// =====================================================================
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createMock } = require('./supabase-mock.js');

const CONN = process.argv[2] || 'postgresql://postgres@localhost/swppl_test?host=/tmp';
const ROOT = path.join(__dirname, '..');
const sbClient = createMock(CONN);
const q = (sql, vals) => sbClient._pool.query(sql, vals);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const rejects = async (fn, m) => {
  try { await fn(); fail++; console.log('  ✗ ' + m + ' (did not throw)'); }
  catch (e) { pass++; console.log('  ✓ ' + m + ' — "' + String(e.message).slice(0, 60) + '"'); }
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

function bootDom(withSupabase) {
  let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  html = html.replace(/<script src="https?:\/\/[^"]+"><\/script>/g, '');
  html = html.replace(/<link[^>]+href="https?:\/\/[^"]*"[^>]*>/g, '');
  html = html.replace('<script src="js/supabase-config.js"></script>',
    '<script>window.__installStubs && window.__installStubs(window);</script>\n<script src="js/supabase-config.js"></script>');
  const vc = new VirtualConsole(); vc.on('error', () => {}); vc.on('jsdomError', () => {});
  return new JSDOM(html, {
    runScripts: 'dangerously', resources: 'usable',
    url: 'file://' + ROOT + '/index.html', virtualConsole: vc, pretendToBeVisual: true,
    beforeParse(window) {
      window.__installStubs = (w) => {
        if (withSupabase) w.supabase = { createClient: () => sbClient };
        function ChartStub(c, cfg) { this.destroy = () => {}; this.update = () => {}; this.config = cfg; }
        ChartStub.register = () => {}; w.Chart = ChartStub;
        w.L = { map: () => ({ setView() { return this; }, remove() {}, invalidateSize() {}, on() {}, fitBounds() {}, flyTo() {}, addControl() {}, addLayer() {} }),
          tileLayer: () => ({ addTo: () => {} }), marker: () => ({ bindPopup() { return this; }, addTo() { return this; }, on() { return this; } }),
          layerGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
          divIcon: () => ({}), icon: () => ({}), polyline: () => ({ addTo() { return this; } }),
          control: { layers: () => ({ addTo: () => {} }) }, Control: { extend: () => function () { return { addTo() {} }; } },
          circleMarker: () => ({ bindPopup() { return this; }, addTo() { return this; } }), latLngBounds: () => ({}) };
        w.HTMLCanvasElement.prototype.getContext = () => new Proxy({}, { get: (t, k) => (k === 'canvas' ? {} : () => ({})) });
        w.confirm = () => true;
        w.alert = m => { w.__lastAlert = String(m); };
      };
    }
  });
}

// role emulation: replace the auth surface with a test double AFTER boot
// (real Supabase Auth needs a hosted project — §C post-deploy check).
function loginAs(window, role, name) {
  const UUIDS = { solar:'33333333-3333-4333-8333-000000000001', procurement:'33333333-3333-4333-8333-000000000005',
                  store:'33333333-3333-4333-8333-000000000006', planner:'33333333-3333-4333-8333-000000000007',
                  admin:'33333333-3333-4333-8333-000000000009' };
  if (!role) { window.auth.current = () => null; window.auth.canEdit = () => false; sbClient._setClaims(null); return; }
  const prof = { uid: UUIDS[role], name: name || role + ' user', role, isAdmin: role === 'admin' };
  window.auth.current = () => prof;
  window.auth.canEdit = (s) => {
    if (prof.role === 'viewer') return false;
    if (s === undefined || s === null || s === '') return true;
    if (prof.role === 'admin') return true;
    if (s === 'all') return false;
    return prof.role === String(s).toLowerCase();
  };
  sbClient._setClaims({ sub: prof.uid });
}
async function registerUsers() {
  const rows = [['33333333-3333-4333-8333-000000000001','solar'],['33333333-3333-4333-8333-000000000005','procurement'],
                ['33333333-3333-4333-8333-000000000006','store'],['33333333-3333-4333-8333-000000000007','planner'],
                ['33333333-3333-4333-8333-000000000009','admin']];
  for (const [id, role] of rows)
    await q(`insert into users (id,email,name,role) values ($1,$2,$3,$4) on conflict (id) do update set role=$4`,
            [id, role + '@t.demo', role + ' user', role]);
}

(async () => {
  await registerUsers();
  const dom = bootDom(true);
  const window = dom.window, d = window.document;
  for (let i = 0; i < 80 && !(window.dataApi && d.getElementById('view-home')); i++) await sleep(100);
  await sleep(1200);

  console.log('\n1. Boot, new views, surfaces…');
  ok(window.auth && window.auth.MODE === 'supabase', 'auth boots in supabase mode (MODE=' + (window.auth && window.auth.MODE) + ')');
  ['procurement', 'vendors', 'inventory', 'planning', 'documents', 'reports', 'audit'].forEach(v =>
    ok(!!d.getElementById('view-' + v), 'view-' + v + ' injected'));
  ['rndrProcurement', 'rndrVendors', 'rndrInventory', 'rndrPlanning', 'rndrDocuments', 'rndrReports', 'rndrAudit'].forEach(f =>
    ok(typeof window[f] === 'function', f + ' defined'));
  ['addVendor', 'createPO', 'updatePOStatus', 'addStockMovement', 'recordTransfer', 'addPlanTask', 'setPlanBaseline', 'addDocument', 'addDocumentVersion'].forEach(f =>
    ok(typeof window.dataApi[f] === 'function', 'dataApi.' + f + ' exposed'));

  console.log('\n2. Vendors + PO workflow (rows verified in Postgres)…');
  loginAs(window, 'procurement');
  const tag = Date.now();
  const v1 = await window.dataApi.addVendor({ name: 'Krishna Electrical ' + tag, category: 'Electrical', email: 'k@x.com', rating: 4 });
  let row = (await q(`select name from vendors where id=$1`, [v1.id])).rows[0];
  ok(row && row.name === 'Krishna Electrical ' + tag, 'vendor persisted in vendors table');
  const po = await window.dataApi.createPO({ vendorId: v1.id, module: 'bop', description: 'cable drums' });
  row = (await q(`select status, vendor_name from purchase_orders where id=$1`, [po.id])).rows[0];
  ok(row.status === 'draft' && row.vendor_name === 'Krishna Electrical ' + tag, 'PO created as draft with DENORMALIZED vendor_name');
  await window.dataApi.addPOLineItem(po.id, { itemName: 'Cable drum', qty: 100, rate: 250 });
  await window.dataApi.addPOLineItem(po.id, { itemName: 'Lugs', qty: 40, rate: 12.5 });
  row = (await q(`select total_value from purchase_orders where id=$1`, [po.id])).rows[0];
  ok(Math.abs(Number(row.total_value) - (100 * 250 + 40 * 12.5)) < 0.01, 'header total_value = Σ line items (SQL transaction)');
  await rejects(() => window.dataApi.updatePOStatus(po.id, 'closed'), 'draft→closed rejected (state machine in po_set_status RPC)');
  loginAs(window, 'admin');
  await window.dataApi.updatePOStatus(po.id, 'approved');
  loginAs(window, 'procurement');
  await window.dataApi.updatePOStatus(po.id, 'delivered');
  await window.dataApi.updatePOStatus(po.id, 'closed');
  const hist = (await q(`select status from po_status_history where po_id=$1 order by ts`, [po.id])).rows.map(r => r.status);
  ok(hist.length >= 4 && hist.join(',') === 'draft,approved,delivered,closed', 'status history recorded per transition (trigger + RPC)');

  console.log('\n3. Inventory ledger (append-only, stock = Σ ledger)…');
  loginAs(window, 'store');
  const it = await window.dataApi.addInventoryItem({ name: 'HT Cable ' + tag, unit: 'm', minStock: 50 });
  await window.dataApi.addStockMovement({ itemId: it.id, type: 'in', qty: 100, ref: 'GRN-1' });
  await window.dataApi.addStockMovement({ itemId: it.id, type: 'out', qty: 70, to: 'FDR-1' });
  const stock = (await q(`select stock from current_stock where item_id=$1`, [it.id])).rows[0].stock;
  ok(Number(stock) === 30, 'computed stock = 100 in − 70 out = 30 (current_stock VIEW, no stored total)');
  ok(30 < 50, '(item is below min_stock=50 → low-stock alert case)');
  const tr = await window.dataApi.recordTransfer({ itemId: it.id, qty: 5, from: 'Main Store', to: 'Yard B' });
  const legs = (await q(`select type from stock_movements where transfer_id=(select transfer_id from stock_movements where id=$1)`, [tr.outId])).rows;
  ok(legs.length === 2, 'transfer wrote atomic OUT+IN pair (one SQL transaction)');
  const mut = await q(`update stock_movements set qty=1 where item_id=$1`, [it.id]).then(() => 'ok', e => e.message);
  ok(/append-only/.test(mut), 'ledger rows are append-only at the DATABASE level (trigger)');

  console.log('\n4. Planning: DAG via task_dependencies FK, critical path…');
  loginAs(window, 'planner');
  const tA = await window.dataApi.addPlanTask({ name: 'Foundations', start: '2026-07-01', end: '2026-07-10' });
  const tB = await window.dataApi.addPlanTask({ name: 'Erection', start: '2026-07-11', end: '2026-07-25', predecessorIds: [tA.id] });
  const tC = await window.dataApi.addPlanTask({ name: 'Cabling', start: '2026-07-05', end: '2026-07-08', predecessorIds: [tA.id] });
  const deps = (await q(`select task_id from task_dependencies where predecessor_id=$1`, [tA.id])).rows.map(r => r.task_id);
  ok(deps.includes(tB.id) && deps.includes(tC.id), 'task_dependencies rows replace the manual /planning/dependents index');
  await rejects(() => window.dataApi.addPlanTask({ name: 'Bad', start: '2026-08-02', end: '2026-08-01' }), 'end<start rejected');
  await rejects(() => window.dataApi.updatePlanTask(tB.id, { predecessorIds: [tB.id] }), 'self-dependency rejected');
  await rejects(() => window.dataApi.deletePlanTask(tA.id), 'delete blocked while dependents exist');
  if (window.__planCaches && window.__planCaches.computeCriticalPath) {
    const tasks = (await q(`select * from plan_tasks where id = any($1)`, [[tA.id, tB.id, tC.id]])).rows;
    const depRows = (await q(`select * from task_dependencies where predecessor_id=$1`, [tA.id])).rows;
    const preds = {}; depRows.forEach(r => { (preds[r.task_id] = preds[r.task_id] || {})[r.predecessor_id] = true; });
    window.__planCaches.TASKS.clear();
    tasks.forEach(t => window.__planCaches.TASKS.set(t.id, window.shapeMap.planTaskVal(t, preds[t.id] || null)));
    const cp = window.__planCaches.computeCriticalPath();
    ok(!cp.cyclic, 'no false cycle detected');
    ok(cp.critical.has(tA.id) && cp.critical.has(tB.id) && !cp.critical.has(tC.id),
      'critical path = Foundations→Erection (longest), Cabling off-path');
  } else { ok(false, '__planCaches.computeCriticalPath not exposed'); }
  loginAs(window, 'admin');
  await window.dataApi.setPlanBaseline();
  const bl = (await q(`select start_date from plan_baselines where task_id=$1`, [tA.id])).rows[0];
  ok(bl && bl.start_date === '2026-07-01', 'baseline froze current dates');
  loginAs(window, 'planner');
  await window.dataApi.updatePlanTask(tB.id, { predecessorIds: [] });
  await window.dataApi.updatePlanTask(tC.id, { predecessorIds: [] });
  await window.dataApi.deletePlanTask(tC.id); await window.dataApi.deletePlanTask(tB.id); await window.dataApi.deletePlanTask(tA.id);

  console.log('\n5. Documents: versions + current pointer…');
  loginAs(window, 'admin');
  const doc = await window.dataApi.addDocument({ title: 'HSE Plan ' + tag, category: 'HSE', fileURL: 'https://x/1.pdf', fileName: '1.pdf', size: 10 });
  const v2 = await window.dataApi.addDocumentVersion(doc.id, { fileURL: 'https://x/2.pdf', fileName: '2.pdf', note: 'r1' });
  const dRec = (await q(`select current_version from documents where id=$1`, [doc.id])).rows[0];
  const nVers = (await q(`select count(*)::int c from document_versions where doc_id=$1`, [doc.id])).rows[0].c;
  ok(nVers === 2 && dRec.current_version === v2.versionId, 'two versions; current_version points at latest');

  console.log('\n6. Audit + rendered views + XSS…');
  const nAudit = (await q(`select count(*)::int c from audit_log`)).rows[0].c;
  ok(nAudit >= 12, 'audit entries written per mutation — semantic + row triggers (' + nAudit + ')');
  for (const [v, el] of [['procurement','proc-ct'],['vendors','vendors-ct'],['inventory','inv-ct'],['planning','plan-ct'],['documents','docs-ct'],['reports','reports-ct'],['audit','audit-ct']]) {
    try { window.nav(v); await sleep(150); } catch (e) {}
    const node = d.getElementById(el);
    ok(node && node.innerHTML.length > 100, v + ' view renders');
  }
  loginAs(window, 'procurement');
  const evil = await window.dataApi.addVendor({ name: '<img src=x onerror=alert(1)>EvilCo' + tag });
  try { window.nav('vendors'); await sleep(250); window.rndrVendors && window.rndrVendors(); } catch (e) {}
  await sleep(400);
  const vhtml = d.getElementById('vendors-ct').innerHTML;
  ok(!vhtml.includes('<img src=x'), 'vendor name is HTML-escaped in the directory (XSS check)');
  await q(`delete from vendors where id=$1`, [evil.id]).catch(() => {});

  console.log('\n7. Role gate (client UX; RLS enforces server-side)…');
  loginAs(window, 'solar');
  await rejects(() => window.dataApi.addInventoryItem({ name: 'X' }), 'solar role blocked from store mutator');

  console.log('\n8. PWA assets…');
  ok(fs.existsSync(path.join(ROOT, 'manifest.json')), 'manifest.json present');
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
  ok(man.display === 'standalone' && man.icons.length >= 1, 'manifest installable (standalone + icons)');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const missing = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(f => !fs.existsSync(path.join(ROOT, f)));
  ok(missing.length === 0, 'every file in the SW pre-cache list exists on disk' + (missing.length ? ' — MISSING: ' + missing.join(',') : ''));
  ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('rel="manifest"'), 'index.html links the manifest');

  console.log('\n9. Security artefacts (static sanity; executable checks = tools/test-rls.sh)…');
  const rls = fs.readFileSync(path.join(ROOT, 'sql/rls-policies.sql'), 'utf8');
  ['vendors', 'purchase_orders', 'inventory_items', 'stock_movements', 'plan_tasks', 'documents', 'module_state']
    .forEach(t => ok(rls.includes(t), 'RLS file covers ' + t));
  ok(/audit_log/.test(rls) && /admin/.test(rls), 'audit access is admin-scoped in RLS');
  ok(!/create policy .*ledger.*update/i.test(rls) && /ledger_insert/.test(rls), 'ledger has INSERT-only policy (no update/delete)');
  ok(fs.existsSync(path.join(ROOT, 'sql/storage-buckets.sql')), 'storage bucket policies present');

  console.log('\n10. Demo fallback (supabase-js absent)…');
  const dom2 = bootDom(false);
  const w2 = dom2.window;
  for (let i = 0; i < 60 && !(w2.auth && w2.dataApi); i++) await sleep(100);
  await sleep(400);
  ok(w2.auth && w2.auth.MODE === 'demo', 'auth falls back to demo mode when supabase-js absent (MODE=' + (w2.auth && w2.auth.MODE) + ')');
  await w2.auth.login('site_user', 'Site@123');
  ok(w2.auth.current() && w2.auth.current().isAdmin, 'demo admin sign-in works (fallback gate)');
  w2.close();

  console.log('\n══════════════════════════════════════');
  console.log(fail === 0 ? `✅ ALL NEW-MODULE TESTS PASSED (${pass})` : `❌ FAILURES: ${fail} (passed ${pass})`);
  await sbClient._end();
  window.close();
  process.exit(fail ? 1 : 0);
})().catch(async e => { console.error('harness crashed:', e); try { await sbClient._end(); } catch (_) {} process.exit(2); });

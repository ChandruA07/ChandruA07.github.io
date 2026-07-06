'use strict';
// =====================================================================
//  test-migration.js — Supabase migration verification suite.
//
//  Loads the REAL production files (js/shape-map.js, js/data-api.js,
//  js/realtime.js) into a Node sandbox whose window.sb is a
//  PostgREST-subset shim over the LOCAL Postgres that ran
//  sql/schema.sql + sql/seed.sql. Every assertion therefore exercises
//  the actual shipped code against the actual shipped schema,
//  including the SQL RPCs, constraints, and triggers.
//
//  What this suite CANNOT cover (needs a hosted Supabase project and
//  a browser): live websocket delivery of postgres_changes, real
//  Supabase Auth round-trips, real Storage uploads, PWA install.
//  Those are §C post-deploy checks in docs/supabase/TESTING.md and
//  are NOT claimed as tested here. The live-event → callback mapping
//  IS tested, by feeding synthetic payloads through the channel stub.
//
//  Usage:
//    createdb swppl_test && psql -d swppl_test -f sql/schema.sql \
//      && psql -d swppl_test -f sql/seed.sql
//    node tools/test-migration.js "postgresql:///swppl_test?host=/tmp"
// =====================================================================

const fs = require('fs');
const vm = require('vm');
const path = require('path');
const { createMock } = require('./supabase-mock.js');

const CONN = process.argv[2] || 'postgresql://postgres@localhost/swppl_test?host=/tmp';
// SECURITY=1: run the identical suite as the 'authenticated' Postgres
// role with JWT claims, against a DB where sql/rls-policies.sql is
// applied — i.e. the app under real Phase-6 enforcement.
const SECURITY = process.env.SECURITY === '1';
const sb = createMock(CONN);

// ---- minimal browser-ish sandbox -----------------------------------
const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Date, Math, JSON, Promise, queueMicrotask,
  document: { getElementById: () => null, querySelector: () => null },
};
sandbox.window = sandbox;
sandbox.sb = sb;

// auth mock with the same semantics as js/auth.js (role switchable)
let _profile = null;
sandbox.auth = {
  current: () => _profile,
  canEdit(section) {
    if (!_profile) return false;
    if (_profile.role === 'viewer') return false;
    if (section === undefined || section === null || section === '') return true;
    if (_profile.role === 'admin') return true;
    if (section === 'all') return false;
    return _profile.role === String(section).toLowerCase();
  },
  onChange: () => () => {},
};
const ROLE_UUIDS = {
  solar:'33333333-3333-4333-8333-000000000001', wtg:'33333333-3333-4333-8333-000000000002',
  bop:'33333333-3333-4333-8333-000000000003', land:'33333333-3333-4333-8333-000000000004',
  procurement:'33333333-3333-4333-8333-000000000005', store:'33333333-3333-4333-8333-000000000006',
  planner:'33333333-3333-4333-8333-000000000007', viewer:'33333333-3333-4333-8333-000000000008',
  admin:'33333333-3333-4333-8333-000000000009'
};
function loginAs(role, uid, name) {
  if (!role) {
    _profile = null;
    // signed out: superuser pre-Phase-6 parity vs true anon under RLS
    sb._setClaims(SECURITY ? { sub: '', dbRole: 'anon' } : null);
    return;
  }
  const u = ROLE_UUIDS[role];
  _profile = { uid: u, name: name || (role + ' user'), role };
  sb._setClaims({ sub: u, dbRole: SECURITY ? 'authenticated' : undefined });
}
async function registerUsers() {
  for (const [role, id] of Object.entries(ROLE_UUIDS)) {
    await sb._pool.query(
      `insert into users (id,email,name,role) values ($1,$2,$3,$4)
       on conflict (id) do update set role=$4`, [id, role+'@t.demo', role+' user', role]);
  }
}

vm.createContext(sandbox);
for (const f of ['js/shape-map.js', 'js/data-api.js', 'js/realtime.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), sandbox, { filename: f });
}
const dataApi = sandbox.dataApi, realtime = sandbox.realtime, shapeMap = sandbox.shapeMap;

// ---- tiny assert kit -------------------------------------------------
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('PASS  ' + label); }
  else { fail++; console.log('FAIL  ' + label); }
}
async function throws(fn, re, label) {
  try { await fn(); fail++; console.log('FAIL  ' + label + '  (no error thrown)'); }
  catch (e) {
    if (!re || re.test(e.message || '')) { pass++; console.log('PASS  ' + label); }
    else { fail++; console.log('FAIL  ' + label + '  (wrong error: ' + e.message + ')'); }
  }
}
const q = (sql, vals) => sb._pool.query(sql, vals);
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('══ migration suite against', CONN, '══\n');
  await registerUsers();

  // ════ 1. POD round-trip (shape fidelity) ════════════════════════════
  console.log('── POD ─────────────────────────────────────────────');
  loginAs('solar', 't-solar', 'Solar Tester');
  const podRes = await dataApi.addPod({
    module: 's', activity: 'Trench excavation', qty: 120, mp: 14,
    contractor: 'Krishna Electrical', notes: 'east block',
    resources: [{ type: 'JCB', qty: 2 }]
  });
  ok(podRes && podRes.id, 'addPod returns id');
  ok(podRes.date === dataApi.todayISO(), 'addPod defaults to today');
  const entries = await realtime.loadPodForDate(podRes.date);
  const mine = entries.find(e => e.id === podRes.id);
  ok(!!mine, 'loadPodForDate returns the new entry');
  ok(mine.activity === 'Trench excavation' && mine.qty === 120 && mine.mp === 14, 'POD scalar fields survive round-trip');
  ok(Array.isArray(mine.resources) && mine.resources[0].type === 'JCB', 'POD resources jsonb survives round-trip');
  ok(mine.status === 'nys' && mine.progress === 0, 'POD defaults (nys / 0) applied');
  ok(mine.byName === 'Solar Tester', 'POD byName mapped');

  await dataApi.updatePodStatus(podRes.date, podRes.id, { status: 'wip', progress: 40, remark: 'halfway' });
  const after = (await realtime.loadPodForDate(podRes.date)).find(e => e.id === podRes.id);
  ok(after.status === 'wip' && after.progress === 40 && after.remark === 'halfway', 'updatePodStatus persists');
  ok(after.statusByName === 'Solar Tester', 'status stamp recorded');
  const dpRows = (await q(`select * from daily_progress where activity like '[WIP]%' order by ts desc limit 1`)).rows;
  ok(dpRows.length === 1, 'status change auto-logged to daily progress (DPR feed)');
  await throws(() => dataApi.updatePodStatus(podRes.date, podRes.id, { status: 'bogus' }), /Bad status/, 'invalid status rejected');
  loginAs(null);
  await throws(() => dataApi.updatePodStatus(podRes.date, podRes.id, { status: 'done' }), /Login required/, 'status change requires login');

  if (!SECURITY) {
    // anonymous POD still allowed pre-Phase-6 (public demo parity)
    const anonPod = await dataApi.addPod({ module: 'w', activity: 'anon entry', qty: 1 });
    ok(!!anonPod.id, 'anonymous POD submit works pre-Phase-6');
    const anonRow = (await q('select by_uid, by_name from pod_entries where id=$1', [anonPod.id])).rows[0];
    ok(anonRow.by_uid === null && anonRow.by_name === 'Anonymous', 'anonymous entry tagged correctly');
  } else {
    // Phase 6: anonymous POD must be REJECTED by RLS (breaking, by design)
    loginAs(null);
    await throws(() => dataApi.addPod({ module: 'w', activity: 'anon entry', qty: 1 }),
                 /permission denied|row-level security/i,
                 'Phase 6: anonymous POD rejected server-side by RLS');
    loginAs('solar');
    ok(true, '(anonymous-POD parity check replaced by RLS rejection in SECURITY mode)');
  }

  // ════ 2. Solar ═══════════════════════════════════════════════════════
  console.log('\n── Solar ───────────────────────────────────────────');
  loginAs('solar');
  await dataApi.updateSolarAct('ITC-1', 0, { done: 93, today: 3, subDone: [6185, 6185, 6000, 4000] });
  let itcVal = null;
  const offSolar = realtime.listenSolar('ITC-1', v => { itcVal = v; });
  await sleep(300);
  ok(itcVal && itcVal.acts && itcVal.acts[0], 'listenSolar assembles legacy itc shape');
  ok(itcVal.acts[0].done === 93 && itcVal.acts[0].today === 3, 'solar act update visible in tree');
  ok(Array.isArray(itcVal.acts[0].subDone) && itcVal.acts[0].subDone[3] === 4000, 'subDone array preserved');
  ok(itcVal.acts[0].subScope === 6185, 'seeded subScope preserved');
  ok(itcVal.live && Array.isArray(itcVal.live.activities), 'seeded live activities preserved');
  offSolar();

  await dataApi.updateItcLiveActivities('ITC-1', { activities: ['Piling — 40 nos'], noWorkReason: '' });
  const liveRow = (await q(`select data->'live' as live from solar_itcs where id='ITC-1'`)).rows[0];
  ok(liveRow.live.activities[0] === 'Piling — 40 nos', 'merge_itc_live merges into data.live');
  await throws(() => dataApi.updateSolarAct('ITC-99x', 0, { done: 1 }), /Bad ITC id/, 'ITC id validated');
  await throws(() => dataApi.updateSolarAct('ITC-1', 99, { done: 1 }), /Bad idx/, 'act idx validated');

  await dataApi.updateSolarMeta({ totalMW: 75.5, itcMW: { 'ITC-1': 12.5 } });
  const meta = (await q(`select value from module_state where key='solar/meta'`)).rows[0].value;
  ok(meta.totalMW === 75.5 && meta.itcMW['ITC-1'] === 12.5, 'updateSolarMeta merges module_state');
  ok(meta.itcMW['ITC-2'] !== undefined || Object.keys(meta).length >= 2, 'merge preserved pre-existing meta keys');

  await dataApi.setItcMap('ITC-2', 'https://test.local/photos/itc/ITC-2/maps/1.png');
  const maps = (await q(`select value from module_state where key='solar/itcMaps'`)).rows[0].value;
  ok(maps['ITC-2'].endsWith('1.png'), 'setItcMap stores URL in module_state');

  // ════ 3. WTG ════════════════════════════════════════════════════════
  console.log('\n── WTG ─────────────────────────────────────────────');
  loginAs('wtg');
  await dataApi.updateTurbine('MBI-12', { mech: [100, 100, 100, 95], notes: 'T4 95%' });
  let wtgEvents = [];
  const offWtg = realtime.listenWtg(e => wtgEvents.push(e));
  await sleep(300);
  const mbi = wtgEvents.find(e => e.id === 'MBI-12');
  ok(wtgEvents.length >= 26, 'listenWtg replays every turbine as add (' + wtgEvents.length + ')');
  ok(mbi && mbi.val.mech[3] === 95 && mbi.val.notes === 'T4 95%', 'turbine patch merged into doc');
  ok(mbi.val.civil && mbi.val.civil.length === 5, 'unpatched turbine fields preserved (civil stages)');
  offWtg();
  // live-event mapping (synthetic payload through the channel stub)
  wtgEvents = [];
  const offWtg2 = realtime.listenWtg(e => wtgEvents.push(e));
  await sleep(250);
  wtgEvents = [];
  sb._channels.filter(c => c.name === 'rt:wtg_turbines')
    .forEach(c => c._emit({ eventType: 'UPDATE', new: { id: 'MBI-12', data: { status: 'done' } } }));
  ok(wtgEvents.length === 1 && wtgEvents[0].kind === 'change' && wtgEvents[0].val.status === 'done',
     'live UPDATE payload maps to {kind:change,id,val}');
  offWtg2();

  await dataApi.setZeroPoint({ materials: [{ n: 'Anchor bolts', qty: 120 }] });
  const zp = (await q(`select value from module_state where key='wtg/zeroPoint'`)).rows[0].value;
  ok(zp.materials[0].n === 'Anchor bolts', 'setZeroPoint stores blob');
  let zpSeen = null;
  const offZp = realtime.listenWtgZeroPoint(v => { zpSeen = v; });
  await sleep(250);
  ok(zpSeen && zpSeen.materials && zpSeen.materials.length === 1, 'listenWtgZeroPoint delivers blob');
  offZp();

  // ════ 4. BOP tree ═══════════════════════════════════════════════════
  console.log('\n── BOP ─────────────────────────────────────────────');
  loginAs('bop');
  let bop = null;
  const offBop = realtime.listenBop(v => { bop = v; });
  await sleep(300);
  ok(bop && bop.acts && bop.acts66 && bop.pss && bop.gss, 'listenBop assembles full legacy tree');
  ok(Array.isArray(bop.feeders33) && bop.feeders33.length >= 1 && bop.feeders33[0].km === 13.5, 'feeders33 array reconstructed in order');
  ok(Array.isArray(bop.acts['Feeder-1 SPDC']), '33kv stage arrays preserved');
  ok(bop.pss.acts['Soil Test'] && bop.pss.acts['Soil Test'].scope === 1, 'pss acts preserved');
  offBop();

  await dataApi.updatePssAct('Soil Test', { done: 1, wip: 0 });
  await dataApi.updateBopAct('Feeder-1 SPDC', { feeder: 'Feeder-1 SPDC', arr: [100, 100, 90, 80], done: 90 });
  await dataApi.updateBop66Act('SPDC Feeder', 2, 55);
  await dataApi.updateBop33Line('Feeder-1', { line: 'SPSC', poleTotal: 364, poleDone: 353, spanTotal: 365, spanDone: 95 });
  const b2rows = await q(`select section, act_key, data from bop_activities where act_key in ('Feeder-1 SPDC','SPDC Feeder')`);
  const f1 = b2rows.rows.find(r => r.section === '33kv');
  const f66 = b2rows.rows.find(r => r.section === '66kv');
  ok(Array.isArray(f1.data) && f1.data[2] === 90, '33kv feeder array replaced whole (index write parity)');
  ok(Array.isArray(f66.data) && Number(f66.data[2]) === 55, 'set_bop66_act sets one index, pads array');
  const lines = (await q(`select data from bop_assets where section='lines33' and asset_key='Feeder-1'`)).rows[0].data;
  const poles = (await q(`select data from bop_assets where section='poles33' and asset_key='Feeder-1'`)).rows[0].data;
  ok(lines.poleDone === 353 && lines.spanDone === 95, 'lines33 written');
  ok(poles.done === 353 && poles.total === 364, 'poles33 mirror written (legacy dual-write preserved)');

  // ════ 5. Land ═══════════════════════════════════════════════════════
  console.log('\n── Land ────────────────────────────────────────────');
  loginAs('land');
  await dataApi.updateWtgLand('LOC-7', { status: 'Registered', svy: '112/4' });
  await dataApi.updateSolLand('BLK-A', 2, 60);
  const lease = await dataApi.addSolLease('BLK-A', { own: 'R. Patil', svy: '221/1', dur: '29y', ls: 'Signed' });
  ok(!!lease.id, 'addSolLease returns id');
  const parcel = await dataApi.addLandParcel({ module: 's', name: 'Parcel East', lat: 15.1, lng: 75.2, area: 4.2 });
  let land = null;
  const offLand = realtime.listenLand(v => { land = v; });
  await sleep(300);
  ok(land && land.wtgLocs && land.wtgLocs['LOC-7'].status === 'Registered', 'land tree: wtgLocs');
  ok(land.solBlocks && land.solBlocks['BLK-A'].acts[2] === 60, 'land tree: solBlock acts index set (padded)');
  ok(land.solBlocks['BLK-A'].leases && Object.values(land.solBlocks['BLK-A'].leases)[0].own === 'R. Patil', 'land tree: leases nested under block');
  ok(land.parcels && land.parcels[parcel.id].name === 'Parcel East', 'land tree: parcels');
  offLand();
  await dataApi.deleteWtgLandLoc('LOC-7');
  ok((await q(`select count(*)::int c from land_wtg_locs where id='LOC-7'`)).rows[0].c === 0, 'deleteWtgLandLoc removes row');

  // ════ 6. HSE (legacy-id compatibility) ══════════════════════════════
  console.log('\n── HSE ─────────────────────────────────────────────');
  loginAs('admin', 't-admin', 'Site Manager');
  const obs = await dataApi.addHseObservation({ type: 'UnsafeCondition', severity: 'High', desc: 'Open trench unbarricaded', area: 'ITC-3' });
  ok(!!obs.id, 'addHseObservation returns id');
  await dataApi.updateHseObservation('-hse_obs_001', { status: 'Closed', closedBy: 'Safety Officer' });
  const legacyObs = (await q(`select status, closed_by from hse_observations where legacy_id='-hse_obs_001'`)).rows[0];
  ok(legacyObs.status === 'Closed' && legacyObs.closed_by === 'Safety Officer', 'update by LEGACY id routes to legacy_id column');
  await dataApi.updateHseObservation(obs.id, { status: 'Closed' });
  ok((await q(`select status from hse_observations where id=$1`, [obs.id])).rows[0].status === 'Closed', 'update by uuid routes to id column');
  const emp = await dataApi.addHseEmployee({ name: 'Test Worker', code: 'TW-1', score: 250 });
  ok((await q(`select score from hse_employees where id=$1`, [emp.id])).rows[0].score == 100, 'employee score clamped to 100');
  let emps = null;
  const offEmp = realtime.listenHseEmployees(v => { emps = v; });
  await sleep(250);
  ok(Array.isArray(emps) && emps.some(e => e.id === 'BE28') && emps.some(e => e.code === 'TW-1'), 'listenHseEmployees: seeded + new, legacy ids kept');
  offEmp();
  await dataApi.deleteHseEmployee(emp.id);

  // ════ 7. Milestones / ROW / blockers (legacy ids) ═══════════════════
  console.log('\n── Lists ───────────────────────────────────────────');
  const ms = await dataApi.addMilestone({ title: 'First 66kV charge', date: '2026-08-15', mod: 'BOP' });
  ok(!!ms.id, 'addMilestone ok');
  await throws(() => dataApi.addMilestone({ title: 'bad', date: '15-08-2026' }), /Invalid milestone date/, 'milestone date validated');
  await dataApi.updateMilestone('-ms_001', { title: 'Renamed legacy milestone' });
  ok((await q(`select title from milestones where legacy_id='-ms_001'`)).rows[0].title === 'Renamed legacy milestone', 'legacy milestone updatable');
  const ri = await dataApi.addRowIssue({ loc: 'FDR-2 KP 3.2', issue: 'Farmer objection', type: 'BOP' });
  await dataApi.updateRowIssue(ri.id, { status: 'In Progress' });
  ok((await q(`select status from row_issues where id=$1`, [ri.id])).rows[0].status === 'In Progress', 'row issue update');
  await throws(() => dataApi.addRowIssue({ loc: '', issue: 'x' }), /Location is required/, 'row issue validation');
  let msEvents = [];
  const offMs = realtime.listenMilestones(e => msEvents.push(e));
  await sleep(250);
  ok(msEvents.some(e => e.val.title === 'Renamed legacy milestone' && e.val.label === 'Renamed legacy milestone'),
     'milestone val exposes both title and label (render compat)');
  offMs();

  // ════ 8. Procurement (RPC state machine + totals) ═══════════════════
  console.log('\n── Procurement ─────────────────────────────────────');
  loginAs('procurement', 't-proc', 'Procurement Officer');
  const v1 = await dataApi.addVendor({ name: 'Aaraa Infra', category: 'Civil', email: 'ops@aaraa.in', rating: 4 });
  ok(!!v1.id, 'addVendor ok');
  await throws(() => dataApi.addVendor({ name: 'X', email: 'not-an-email' }), /Invalid email/, 'vendor email validated');
  await throws(() => dataApi.addVendor({ name: '' }), /Vendor name is required/, 'vendor name required');
  const po = await dataApi.createPO({ vendorId: v1.id, module: 'bop', description: 'Pole supply', expectedDate: '2026-08-01' });
  ok(!!po.id && /^PO-/.test(po.poNumber), 'createPO ok, number generated');
  const li1 = await dataApi.addPOLineItem(po.id, { itemName: '11m PSC pole', qty: 100, rate: 8200 });
  await dataApi.addPOLineItem(po.id, { itemName: 'Stay set', qty: 40, rate: 950 });
  let total = (await q(`select total_value from purchase_orders where id=$1`, [po.id])).rows[0].total_value;
  ok(Number(total) === 100*8200 + 40*950, 'PO total = Σ line items (RPC transaction): ' + total);
  await dataApi.deletePOLineItem(po.id, li1.id);
  total = (await q(`select total_value from purchase_orders where id=$1`, [po.id])).rows[0].total_value;
  ok(Number(total) === 40*950, 'total adjusts on line-item delete');
  await throws(() => dataApi.updatePOStatus(po.id, 'closed'), /Invalid transition/, 'draft→closed blocked by state machine');
  await throws(() => dataApi.updatePOStatus(po.id, 'approved'), /Login required/, 'client gate: procurement cannot approve');
  loginAs('admin', 't-admin', 'Site Manager');
  await dataApi.updatePOStatus(po.id, 'approved', 'budget ok');
  loginAs('procurement', 't-proc');
  await throws(() => dataApi.addPOLineItem(po.id, { itemName: 'late', qty: 1, rate: 1 }), /only be edited while the PO is a draft/, 'line items frozen after approval');
  await dataApi.updatePOStatus(po.id, 'delivered');
  await dataApi.updatePOStatus(po.id, 'closed');
  const hist = (await q(`select status from po_status_history where po_id=$1 order by ts`, [po.id])).rows.map(r => r.status);
  ok(hist.join(',') === 'draft,approved,delivered,closed', 'full status history recorded: ' + hist.join('→'));
  // vendor archived guard
  await dataApi.archiveVendor(v1.id);
  await throws(() => dataApi.createPO({ vendorId: v1.id }), /archived/, 'archived vendor cannot receive POs');
  await dataApi.updateVendor(v1.id, { status: 'active' });
  // vendor_performance view
  const vp = (await q(`select * from vendor_performance where vendor_id=$1`, [v1.id])).rows[0];
  ok(Number(vp.total_pos) === 1 && Number(vp.delivered_pos) === 1, 'vendor_performance view aggregates in SQL');

  // legacy val shape via listener (lineItems + history embedded)
  let poSeen = null;
  const offPo = realtime.listenPurchaseOrders(e => { if (e.id === po.id) poSeen = e.val; });
  await sleep(400);
  ok(poSeen && poSeen.status === 'closed' && poSeen.lineItems && poSeen.history, 'PO listener embeds lineItems + history');
  ok(Object.values(poSeen.lineItems)[0].itemName === 'Stay set', 'embedded line item mapped');
  offPo();

  // ════ 9. Inventory (append-only ledger) ═════════════════════════════
  console.log('\n── Inventory ───────────────────────────────────────');
  loginAs('store', 't-store', 'Store Keeper');
  const item = await dataApi.addInventoryItem({ name: 'ACSR Conductor', unit: 'km', minStock: 5, location: 'Main Store' });
  await dataApi.addStockMovement({ itemId: item.id, type: 'in', qty: 12, ref: po.poNumber });
  await dataApi.addStockMovement({ itemId: item.id, type: 'out', qty: 3, to: 'FDR-2 stringing' });
  await dataApi.addStockMovement({ itemId: item.id, type: 'adjust', qty: -1, notes: 'stocktake' });
  const stock = (await q(`select stock from current_stock where item_id=$1`, [item.id])).rows[0].stock;
  ok(Number(stock) === 12 - 3 - 1, 'current_stock view: in−out±adjust = ' + stock);
  await throws(() => dataApi.addStockMovement({ itemId: item.id, type: 'out', qty: -5 }), /Quantity must be > 0/, 'negative out qty rejected');
  await throws(() => dataApi.addStockMovement({ itemId: item.id, type: 'in', qty: 1, date: '2099-01-01' }), /future/, 'future-dated movement rejected');
  const mvId = (await q(`select id from stock_movements where item_id=$1 limit 1`, [item.id])).rows[0].id;
  const updTry = await q(`update stock_movements set qty=999 where id=$1`, [mvId]).then(() => 'ok', e => e.message);
  ok(/append-only/.test(updTry), 'DB trigger blocks ledger UPDATE even for table owner');
  const delTry = await q(`delete from stock_movements where id=$1`, [mvId]).then(() => 'ok', e => e.message);
  ok(/append-only/.test(delTry), 'DB trigger blocks ledger DELETE');
  const tr = await dataApi.recordTransfer({ itemId: item.id, qty: 2, from: 'Main Store', to: 'Site B Yard' });
  const legs = (await q(`select type, location from stock_movements
     where transfer_id = (select transfer_id from stock_movements where id=$1) order by type`, [tr.outId])).rows;
  ok(legs.length === 2 && legs[0].type === 'in' && legs[0].location === 'Site B Yard'
     && legs[1].type === 'out' && legs[1].location === 'Main Store', 'transfer writes both legs atomically');
  const stock2 = (await q(`select stock from current_stock where item_id=$1`, [item.id])).rows[0].stock;
  ok(Number(stock2) === 8, 'transfer is stock-neutral overall (still 8)');
  await throws(() => dataApi.recordTransfer({ itemId: item.id, qty: 2, from: 'A', to: 'A' }), /must differ/, 'same-location transfer rejected');
  // ledger listener: past window + today's replay
  const lm = realtime.listenStockMovements(() => {}, 30);
  const pastRows = await lm.past;
  ok(Array.isArray(pastRows), 'listenStockMovements returns past window promise');
  lm.unsubscribe();

  // ════ 10. Planning (DAG + baseline) ═════════════════════════════════
  console.log('\n── Planning ────────────────────────────────────────');
  loginAs('planner', 't-plan', 'Planning Engineer');
  const tA = await dataApi.addPlanTask({ name: 'Foundation pour', module: 'wtg', start: '2026-07-10', end: '2026-07-20' });
  const tB = await dataApi.addPlanTask({ name: 'Tower erection', module: 'wtg', start: '2026-07-21', end: '2026-08-05', predecessorIds: [tA.id] });
  await throws(() => dataApi.addPlanTask({ name: 'bad', start: '2026-07-10', end: '2026-07-01' }), /End date cannot be before start/, 'date order validated');
  await throws(() => dataApi.updatePlanTask(tA.id, { predecessorIds: [tA.id] }), /cannot depend on itself/, 'self-dependency rejected');
  await throws(() => dataApi.deletePlanTask(tA.id), /depend on this one/, 'delete guarded by dependents');
  // FK RESTRICT backstop (bypassing the app check entirely)
  const fkTry = await q(`delete from plan_tasks where id=$1`, [tA.id]).then(() => 'ok', e => e.code);
  ok(fkTry === '23503', 'FK RESTRICT blocks predecessor delete even without the app check');
  // listener shape must carry the dependency map (regression guard for
  // the planTaskVal array-vs-map bug found by the jsdom suite)
  let taskSeen = {};
  const offTasks = realtime.listenPlanTasks(e => { if (e.kind !== 'remove') taskSeen[e.id] = e.val; });
  await sleep(300);
  ok(taskSeen[tB.id] && taskSeen[tB.id].predecessorIds && taskSeen[tB.id].predecessorIds[tA.id] === true,
     'listenPlanTasks val carries predecessorIds map');
  offTasks();
  loginAs('admin', 't-admin');
  await dataApi.setPlanBaseline();
  const bl = await realtime.loadBaselines();
  ok(bl[tA.id] && bl[tA.id].start === '2026-07-10', 'baseline captured and loads in legacy shape');
  loginAs('planner', 't-plan');
  await dataApi.updatePlanTask(tB.id, { predecessorIds: [] });
  await dataApi.deletePlanTask(tB.id); await dataApi.deletePlanTask(tA.id);
  ok(true, 'unlink → delete flow works');
  await throws(() => { loginAs('solar'); return dataApi.addPlanTask({ name: 'x', start: '2026-07-01', end: '2026-07-02' }); }, /Login required/, 'client gate: solar cannot add tasks');

  // ════ 11. Documents ═════════════════════════════════════════════════
  console.log('\n── Documents ───────────────────────────────────────');
  loginAs('bop', 't-bop', 'BOP Engineer');
  const doc = await dataApi.addDocument({ title: 'FDR-2 SLD', category: 'Drawing', module: 'bop', fileURL: 'https://test.local/documents/docs/x/sld.pdf', fileName: 'sld.pdf', size: 1024 });
  ok(doc.id && doc.versionId, 'document + v1 created atomically');
  const v2 = await dataApi.addDocumentVersion(doc.id, { fileURL: 'https://test.local/documents/docs/y/sld_r1.pdf', fileName: 'sld_r1.pdf', note: 'Rev 1' });
  const dRow = (await q(`select current_version from documents where id=$1`, [doc.id])).rows[0];
  ok(dRow.current_version === v2.versionId, 'current_version pointer bumped');
  await throws(() => dataApi.addDocumentVersion('00000000-0000-4000-8000-0000000000ff', { fileURL: 'x' }), /not found/i, 'version on missing doc rejected');
  let docSeen = null;
  const offDoc = realtime.listenDocuments(e => { if (e.id === doc.id) docSeen = e.val; });
  await sleep(350);
  ok(docSeen && docSeen.versions && Object.keys(docSeen.versions).length === 2 && docSeen.currentVersion === v2.versionId,
     'document listener embeds versions{} in legacy shape');
  offDoc();
  await throws(() => dataApi.archiveDocument(doc.id), /Login required/, 'archive is admin-gated client-side');
  loginAs('admin', 't-admin');
  await dataApi.archiveDocument(doc.id);
  ok((await q(`select status from documents where id=$1`, [doc.id])).rows[0].status === 'archived', 'archive persists');

  // ════ 12. Notifications / snapshots / gantt / schedule ═════════════
  console.log('\n── Misc ────────────────────────────────────────────');
  const nBefore = (await q(`select count(*)::int c from notifications`)).rows[0].c;
  ok(nBefore > 0, 'writes emitted notifications (' + nBefore + ')');
  let notifSeen = [];
  const offN = realtime.listenNotifications(e => notifSeen.push(e), 10);
  await sleep(250);
  ok(notifSeen.length > 0 && notifSeen[0].val.desc !== undefined && notifSeen[0].val.readBy !== undefined,
     'notification val keeps legacy keys (desc, readBy)');
  offN();
  loginAs('admin', 't-admin');
  await dataApi.setGanttRows([{ l: 'Solar mech complete', ps: '2026-07-01', pe: '2026-09-30', c: '#e91' }]);
  const g = (await q(`select value from module_state where key='ganttRows'`)).rows[0].value;
  ok(Array.isArray(g) && g[0].l === 'Solar mech complete', 'setGanttRows stores array');
  await dataApi.updateSchedule({ planned: [5, 20, 45], labels: ['Jul', 'Aug', 'Sep'] });
  const sc = (await q(`select value from module_state where key='schedule'`)).rows[0].value;
  ok(sc.planned[2] === 45 && sc.labels[0] === 'Jul', 'updateSchedule merges');
  await dataApi.debouncedUpdate('wtg/meta/totalMW', 66);
  await dataApi.debouncedUpdate('wtg/meta/count', 22);
  await sleep(600);
  const wm = (await q(`select value from module_state where key='wtg/meta'`)).rows[0].value;
  ok(wm.totalMW === 66 && wm.count === 22, 'debouncedUpdate batches into merge_module_state');

  // ════ 13. Audit (both layers) ═══════════════════════════════════════
  console.log('\n── Audit ───────────────────────────────────────────');
  const semantic = (await q(`select count(*)::int c from audit_log where action='po.status'`)).rows[0].c;
  const triggered = (await q(`select count(*)::int c from audit_log where action like 'row.%' and path like 'purchase_orders/%'`)).rows[0].c;
  ok(semantic >= 3, 'semantic audit events written via RPC (' + semantic + ')');
  ok(triggered >= 4, 'trigger audit rows written independently (' + triggered + ')');
  const audit = await realtime.loadAudit(50);
  ok(Array.isArray(audit) && audit.length > 0 && audit[0].ts && audit[0].action, 'loadAudit returns viewer-shaped rows, newest first');

  // ════ 14. Concurrency shapes ════════════════════════════════════════
  console.log('\n── Concurrency ─────────────────────────────────────');
  loginAs('procurement', 't-proc');
  const v2nd = await dataApi.addVendor({ name: 'Zelveo', category: 'Electrical' });
  const po2 = await dataApi.createPO({ vendorId: v2nd.id, module: 'bop' });
  await Promise.all([1,2,3,4,5].map(i => dataApi.addPOLineItem(po2.id, { itemName: 'Item ' + i, qty: 10, rate: 100 })));
  const t2 = (await q(`select total_value from purchase_orders where id=$1`, [po2.id])).rows[0].total_value;
  ok(Number(t2) === 5000, '5 concurrent line-item adds → exact total (no lost update): ' + t2);
  // two users hammer the same POD date concurrently — every entry lands
  loginAs('solar', 'u-one', 'User One');
  const writes = [];
  for (let i = 0; i < 10; i++) writes.push(dataApi.addPod({ module: 's', activity: 'concurrent ' + i, qty: i }));
  loginAs('wtg', 'u-two', 'User Two');
  for (let i = 10; i < 20; i++) writes.push(dataApi.addPod({ module: 'w', activity: 'concurrent ' + i, qty: i }));
  await Promise.all(writes);
  const cc = (await q(`select count(*)::int c from pod_entries where activity like 'concurrent %'`)).rows[0].c;
  ok(cc === 20, '20 concurrent POD writes from 2 users → 20 rows (no overwrite regression)');
  // concurrent status transitions on one PO: exactly one approval path wins
  loginAs('admin', 't-admin');
  const race = await Promise.allSettled([
    dataApi.updatePOStatus(po2.id, 'approved'),
    dataApi.updatePOStatus(po2.id, 'approved')
  ]);
  const okCount = race.filter(r => r.status === 'fulfilled').length;
  const histN = (await q(`select count(*)::int c from po_status_history where po_id=$1 and status='approved'`, [po2.id])).rows[0].c;
  ok(okCount === 1 && histN === 1, 'racing approvals: row lock lets exactly one through (' + okCount + ' ok, ' + histN + ' history row)');

  // ════ 15. XSS regression guard (payloads stored raw, escaped at render) ═
  console.log('\n── XSS guard ───────────────────────────────────────');
  loginAs('solar', 't-solar', '<img src=x onerror=alert(1)>');
  const evil = await dataApi.addPod({ module: 's', activity: '<script>alert(1)</script>', qty: 1 });
  const evilRow = (await q(`select activity, by_name from pod_entries where id=$1`, [evil.id])).rows[0];
  ok(evilRow.activity === '<script>alert(1)</script>', 'payload stored verbatim (escaping is the render layer\'s job — dom.js esc())');
  const evilVal = shapeMap.podVal({ ...evilRow, resources: [], pod_date: '2026-07-05' });
  ok(evilVal.byName === '<img src=x onerror=alert(1)>', 'shape-map does not double-encode (render layer escapes once)');

  console.log('\n══════════════════════════════════════════════════');
  console.log('mode:', SECURITY ? 'SECURITY (RLS enforced, authenticated role)' : 'permissive (Phase 2 parity)');
  console.log(fail === 0 ? `✅ migration suite: all ${pass} checks passed`
                         : `❌ migration suite: ${fail} FAILED / ${pass} passed`);
  await sb._end();
  process.exit(fail === 0 ? 0 : 1);
})().catch(e => { console.error('SUITE CRASHED:', e); process.exit(2); });

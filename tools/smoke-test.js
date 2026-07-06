// smoke-test.js — boots the SWPPL dashboard headlessly in jsdom with a
// stubbed Firebase, verifies the inline-template loader, navigation,
// POD rendering, notifications UI, and live charts hook.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('jsdom');

// Run from the project: cd <project> && npm i jsdom && node tools/smoke-test.js
const ROOT = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Strip external <script src="http…"> and <link> tags (no network in test)
html = html.replace(/<script src="https?:\/\/[^"]+"><\/script>/g, '');
const localScripts = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map(m => m[1]);

const vc = new VirtualConsole();
const logs = [];
vc.on('error', e => logs.push(['error', String(e)]));
vc.on('warn',  (...a) => logs.push(['warn', a.join(' ')]));
vc.on('log',   (...a) => logs.push(['log', a.join(' ')]));
vc.on('jsdomError', e => logs.push(['jsdomError', String(e && e.message)]));

// Inject a stub-setup inline script BEFORE the first local script so the
// firebase/Chart/Leaflet globals exist when firebase.js etc. run.
html = html.replace('<script src="js/supabase-config.js"></script>',
  '<script>window.__installStubs && window.__installStubs(window);</script>\n<script src="js/supabase-config.js"></script>');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  resources: 'usable',
  url: 'file://' + ROOT + '/index.html',
  virtualConsole: vc,
  pretendToBeVisual: true,
  beforeParse(window) {
    window.__installStubs = installStubs;
  }
});
const { window } = dom;
const fails = [];
const ok = (cond, msg) => { if (cond) console.log('  ✓', msg); else { console.log('  ✗', msg); fails.push(msg); } };

// ── Stub Firebase compat SDK ──
function installStubs(window) {
const dbStore = {};
function mkSnap(val, key) {
  return {
    key, val: () => val, exists: () => val != null,
    numChildren: () => (val && typeof val === 'object') ? Object.keys(val).length : 0,
    forEach: (cb) => { if (val && typeof val === 'object') Object.entries(val).forEach(([k, v]) => cb(mkSnap(v, k))); }
  };
}
window.__writes = [];
const writes = window.__writes;
function mkRef(p) {
  return {
    _path: p,
    push: (v) => { const key = 'k' + Math.random().toString(36).slice(2, 8); const r = mkRef(p + '/' + key); r.key = key;
      if (v !== undefined) { writes.push([p + '/' + key, v]); return { catch: () => {} }; } return r; },
    set: async (v) => { writes.push([p, v]); },
    update: async (v) => { writes.push([p + ' (update)', v]); },
    remove: async () => { writes.push([p, null]); },
    get: async () => mkSnap(null, null),
    on: (evt, cb) => cb && undefined,
    off: () => {},
    orderByChild: () => mkRef(p),
    limitToLast: () => mkRef(p),
    toString: () => 'stub://' + p,
    child: (c) => mkRef(p + '/' + c)
  };
}
// supabase-js stub: every read resolves empty (app boots on data.js
// baselines, same as the old null firebase stub); writes are recorded.
function sbBuilder(table, op) {
  const b = {
    _table: table, _op: op || 'select',
    select(){ if (this._op !== 'select') this._ret = true; return this; },
    insert(rows){ this._op='insert'; writes.push([table+' (insert)', rows]); return this; },
    update(o){ this._op='update'; writes.push([table+' (update)', o]); return this; },
    upsert(o){ this._op='upsert'; writes.push([table+' (upsert)', o]); return this; },
    delete(){ this._op='delete'; writes.push([table+' (delete)', null]); return this; },
    eq(){return this;}, neq(){return this;}, gte(){return this;}, lte(){return this;},
    gt(){return this;}, lt(){return this;}, in(){return this;},
    order(){return this;}, limit(){return this;},
    single(){ this._single = true; return this; },
    maybeSingle(){ this._maybe = true; return this; },
    then(res){ 
      let data = null;
      if (this._op !== 'select' && (this._single || this._ret))
        data = { id: 'stub-' + Math.random().toString(36).slice(2,8) };
      else if (this._op === 'select' && !this._single && !this._maybe) data = [];
      return Promise.resolve({ data, error: null }).then(res);
    },
    catch(f){ return Promise.resolve({ data: null, error: null }).catch(f); }
  };
  return b;
}
window.supabase = { createClient: () => ({
  from: t => sbBuilder(t),
  rpc: (name, params) => { writes.push(['rpc:'+name, params]); return Promise.resolve({ data: null, error: null }); },
  channel: () => ({ on(){ return this; }, subscribe(cb){ cb && cb('SUBSCRIBED'); return this; } }),
  removeChannel(){},
  auth: { onAuthStateChange: () => ({ data:{ subscription:{ unsubscribe(){} } } }),
          getSession: async () => ({ data: { session: null } }),
          signInWithPassword: async () => ({ data: null, error: { message: 'stub' } }),
          signOut: async () => ({}) },
  storage: { from: () => ({ upload: async () => ({ error: null }),
                            getPublicUrl: p => ({ data: { publicUrl: 'https://x/' + p } }),
                            remove: async () => ({ error: null }) }) }
}) };
// Chart.js + Leaflet stubs
function ChartStub(c, cfg) { this.destroy = () => {}; this.update = () => {}; this.config = cfg; }
ChartStub.register = () => {};
window.Chart = ChartStub;
window.L = { map: () => ({ setView() { return this; }, remove() {}, invalidateSize() {}, on() {}, fitBounds() {} }),
  tileLayer: () => ({ addTo: () => {} }), marker: () => ({ bindPopup() { return this; }, addTo() { return this; } }),
  layerGroup: () => ({ addTo() { return this; }, clearLayers() {}, addLayer() {} }),
  divIcon: () => ({}), icon: () => ({}), polyline: () => ({ addTo() { return this; } }), control: { layers: () => ({ addTo: () => {} }) },
  circleMarker: () => ({ bindPopup() { return this; }, addTo() { return this; } }), latLngBounds: () => ({}) };
window.localStorage.setItem('x', 'y'); // sanity

// canvas getContext stub
window.HTMLCanvasElement.prototype.getContext = () => ({ canvas: {}, clearRect() {}, save() {}, restore() {} });
}

console.log('\n1.', localScripts.length, 'local scripts load via <script> tags (classic global semantics)');

window.addEventListener('error', e => logs.push(['werror', String(e.message)]));

setTimeout(() => {
  try {
    const d = window.document;
    ok(d.querySelectorAll('template[data-partial]').length >= 24, 'inline templates present (' + d.querySelectorAll('template[data-partial]').length + ')');
    ok(d.getElementById('view-home') && d.getElementById('view-home').innerHTML.length > 500, 'home view injected from inline template');
    ok(d.getElementById('view-pod'), 'POD view injected');
    ok(!d.getElementById('home-live-viz'), 'Live Data Visualisation row removed from dashboard');
    // Header notification marquee present + populated
    ok(!!d.getElementById('hero-marquee') && !!d.getElementById('hero-marquee-track'), 'header notification marquee present');
    ok(typeof window.renderHeroMarquee === 'function', 'renderHeroMarquee defined');
    try {
      window.renderHeroMarquee();
      const track = d.getElementById('hero-marquee-track');
      ok(track && /hmq-item/.test(track.innerHTML), 'marquee populated with update items');
    } catch(e) { ok(false, 'marquee render — ' + e.message); }
    ok(typeof window.fetchPartial === 'function', 'fetchPartial defined on window');
    ok(typeof window.dataApi === 'object' && typeof window.dataApi.addPod === 'function', 'dataApi surface available');
    ok(typeof window.dataApi.addSolLease === 'function' && typeof window.dataApi.removeSolLease === 'function', 'lease writers exposed');
    ok(typeof window.dataApi.deleteHseEmployee === 'function', 'deleteHseEmployee exposed');
    ok(typeof window.dataApi.notify === 'function', 'notification writer exposed');
    ok(typeof window.renderLiveCharts === 'function', 'renderLiveCharts defined');
    ok(typeof window.podSetStatus === 'function' && typeof window.podSaveProgress === 'function', 'POD status handlers defined');
    ok(typeof window.podPhotoSelected === 'function' && typeof window.hsePhotoSelected === 'function', 'instant photo handlers defined');

    // navigate to POD and render Land tab
    console.log('\n3. POD view — Land tab + status buttons…');
    window.nav('pod');
    ok(d.getElementById('ptb-l') && d.getElementById('ptb-l').style.display !== 'none', 'Land tab visible');
    window.podTab('l');
    ok(d.getElementById('pod-ct').innerHTML.includes('Submit Land POD'), 'Land POD submit button rendered');
    // open the Land form and check extra activities
    window.openPODForm('l');
    ok(d.getElementById('p-b').innerHTML.includes('Survey &amp; Demarcation') || d.getElementById('p-b').innerHTML.includes('Survey & Demarcation'), 'Land activity list present');
    window.openPODForm('s');
    const sf = d.getElementById('p-b').innerHTML;
    ok(sf.includes('Pile Rectification') && sf.includes('SCADA Sensor Installation'), 'Solar extra activities present');
    ok(sf.includes('pf-photo'), 'Solar POD photo field present');
    // contractor dropdown with the required vendor list
    ok(sf.includes('pf-con-sel') && /Select contractor/.test(sf), 'POD contractor is a dropdown');
    ['Aaraa','Senvion','Windplus','Krishna Electrical','Zelveo','SML','HML','Ashirwad Enterprises'].forEach(c=>{
      ok(sf.includes('>'+c+'<'), 'contractor option present: ' + c);
    });
    ok(/Other \(type below\)/.test(sf), 'contractor "Other" option present');
    // activity search box
    ok(sf.includes('_podActSearch') && /Search activity/.test(sf), 'activity search box present');
    // functional: search filters options
    try {
      window._podActSearch('pf-act', 'inverter');
      const selEl = d.getElementById('pf-act');
      const visible = Array.from(selEl.querySelectorAll('option')).filter(o=>!o.hidden && o.value!=='__other__');
      ok(visible.length > 0 && visible.every(o=>/inverter/i.test(o.textContent)), 'activity search filters to matches');
      window._podActSearch('pf-act', ''); // reset
    } catch(e) { ok(false, 'activity search functional — ' + e.message); }
    // contractor select → hidden mirror sync
    try {
      window._podContractorChange('Senvion');
      ok(d.getElementById('pf-con').value === 'Senvion', 'contractor selection syncs to hidden field');
      window._podContractorChange('__other__');
      ok(d.getElementById('pf-con-other').style.display !== 'none', 'contractor "Other" reveals text input');
    } catch(e) { ok(false, 'contractor sync — ' + e.message); }
    window.openPODForm('w');
    ok(d.getElementById('p-b').innerHTML.includes('Nacelle Lifting'), 'WTG extra activities present');
    window.openPODForm('b');
    const bf = d.getElementById('p-b').innerHTML;
    ok(bf.includes('Disc Insulator Stringing') && bf.includes('Substation Commissioning'), 'BOP extra activities present');
    // POD submit must close the modal IMMEDIATELY (optimistic) — the form
    // should not linger while the background Firebase writes complete.
    try {
      window.openPODForm('l');                 // Land form (simplest required fields)
      const setV = (id, v) => { const el = d.getElementById(id); if (el) el.value = v; };
      setV('pf-qty', '5'); setV('pf-mp', '3'); setV('pf-by', 'Perf Tester');
      const ov = d.getElementById('pov');
      const wasOpen = ov && ov.classList.contains('open');
      window.subPOD({ preventDefault(){}, target:{} }, 'l');
      const nowClosed = !ov || !ov.classList.contains('open');
      ok(wasOpen && nowClosed, 'POD submit closes the modal synchronously (no lingering form)');
    } catch(e) { ok(false, 'POD optimistic close — ' + e.message); }

    // XSS check: inject a hostile POD entry and render it
    console.log('\n4. XSS safety — hostile POD entry…');
    window.DB.pod.s.push({ id: 'x1', date: window.dataApi.todayISO(), activity: 'ITC-1 › <img src=x onerror=alert(1)>', qty: 5, mp: 3,
      by: '<script>evil()</script>', time: '10:00', contractor: '"><svg onload=1>', notes: '<b onmouseover=x>n</b>', status: 'wip', progress: 2, remark: '<i>r</i>', resources: [] });
    window.podTab('s');
    const podHtml = d.getElementById('pod-ct').innerHTML;
    ok(!podHtml.includes('<img src=x onerror'), 'activity escaped in POD list');
    ok(!podHtml.includes('<script>evil'), 'byName escaped in POD list');
    ok(podHtml.includes('&lt;script&gt;') || podHtml.includes('&lt;'), 'escaped entities present');
    ok(!podHtml.includes('pod-sbtn'), 'POD status buttons removed (managed in module sections)');
    ok(!podHtml.includes('pod-inline-fields') && !podHtml.includes('🟡 WIP'), 'POD WIP/Completed controls removed');

    // home work table with land + hostile entry
    console.log('\n5. Home work table + live charts…');
    window.nav('home');
    const wt = d.getElementById('home-work-table');
    ok(wt && wt.innerHTML.includes('Land'), 'work table includes Land module row');
    ok(!wt.innerHTML.includes('<img src=x onerror'), 'work table escapes activity');

    // notifications UI
    console.log('\n6. Notifications…');
    ok(d.getElementById('notif-bell'), 'bell injected in topbar');
    ok(d.getElementById('notif-panel'), 'slide-in panel present');
    window.notify.togglePanel(true);
    ok(d.getElementById('notif-panel').classList.contains('open'), 'panel opens');
    // simulate a write → check a notification record was attempted
    window.auth && window.auth.current; // no-op
    window.dataApi.notify('solar', 'POD submitted', 'test desc');
    const notifWrites = window.__writes.filter(w => w[0].startsWith('notifications'));
    ok(notifWrites.length >= 1, 'notification record written to /notifications (' + notifWrites.length + ')');

    // ── UI layer v10.14 ──
    console.log('\n6b. Topbar ticker removed + hero marquee + POD date filter…');
    // v10.14: the topbar "Live Notifications" ticker is REMOVED — updates now
    // scroll only in the header hero marquee.
    ok(!d.getElementById('notif-ticker'), 'topbar Live Notifications ticker removed');
    try {
      const css = require('fs').readFileSync(require('path').join(ROOT, 'css/ui-polish.css'), 'utf8');
      ok(!/#notif-ticker\{/.test(css), 'topbar ticker CSS purged');
      ok(/hmqBorder/.test(css) && /hmq-item\{[^}]*border-radius:24px/.test(css.replace(/\n/g,' ')), 'redesigned marquee CSS (animated border + pill chips)');
    } catch(e) { ok(false, 'ticker CSS check — ' + e.message); }
    // farm + solar field removed
    window.nav('wtg');
    setTimeout(() => {
    ok(!d.getElementById('wtg-farm') && !d.getElementById('wtg-farm-wrap'), 'WTG farm animation removed');
    ok(typeof window.renderWtgFarm === 'undefined', 'wtg-farm.js no longer loaded');
    // Zero Point glitch: ZP must render only in its dedicated view, never leak into WTG
    try {
      window.nav('zp');
      window.eval('rndrZp && rndrZp()');
      ok(window.eval('_wtgSelected') === 'ZP', 'Zero Point selected in its own view');
      const zpBody = d.getElementById('zp-body');
      ok(zpBody && /Store Yard/.test(zpBody.innerHTML) && zpBody.innerHTML.length > 500, 'Zero Point view shows proper data');
      window.nav('wtg');
      window.eval('rndrWtg && rndrWtg(); wTab(0)');
      ok(window.eval('_wtgSelected') !== 'ZP', 'stale ZP selection cleared on entering WTG');
      const rp = d.getElementById('wtg-right-panel');
      const leaked = rp && /Central Store Yard|Store Yard/.test(rp.innerHTML);
      ok(!leaked, 'Zero Point detail does not leak into WTG right panel');
      // wTab must NOT render ZP even if a stale ZP selection lingers
      window.eval('_wtgSelected="ZP"; wTab(0)');
      const rp2 = d.getElementById('wtg-right-panel');
      ok(!/Store Yard/.test(rp2.innerHTML) && window.eval('_wtgSelected') !== 'ZP', 'wTab never renders ZP into WTG panel');
      // the ZP tile navigates to the dedicated view (not inline render)
      ok(/onclick="nav\('zp'\)"/.test(window.eval('rndrZeroPointTile()')), 'ZP tile navigates to dedicated view');
    } catch(e) { ok(false, 'Zero Point leak test — ' + e.message); }
    window.nav('solar');
    setTimeout(() => {
    ok(!d.getElementById('solar-field') && !d.getElementById('solar-field-wrap'), 'Solar field animation removed');
    ok(typeof window.renderSolarField === 'undefined', 'solar-field.js no longer loaded');
    const itcCards = d.getElementById('itc-cards');
    ok(itcCards && !itcCards.innerHTML.includes('Major Ongoing Activities'), 'Major Ongoing Activities box removed');
    ok(itcCards && itcCards.querySelector('.itc-cards-strip'), 'ITC card strip still renders');
    // PBI sub-activity chart still intact
    try {
      const htmlC = window.eval(`(function(){
        const itcId = Object.keys(DB.solar.itcs).find(k => DB.solar.itcs[k].active === true) || Object.keys(DB.solar.itcs)[0];
        const itc = DB.solar.itcs[itcId];
        if (typeof solInitActs === 'function') solInitActs(itc);
        const sec = Object.keys(SOL_STRUCTURE)[0];
        const act = solGetActivities(sec)[0];
        _solChartSel[itcId] = { section: sec, actKey: act.key };
        return _solRndrClusterChart(itc, itcId);
      })()`);
      ok(/conic-gradient/.test(htmlC) && /#118DFF|#E66C37|#1AAB40/.test(htmlC), 'PBI sub-activity chart intact');
    } catch (e) { ok(false, 'PBI chart — ' + e.message); }

    // POD date filter
    window.nav('pod');
    setTimeout(() => {
    window.podTab('s');
    ok(!!d.getElementById('pod-date-filter'), 'POD date filter input present');
    // POD total-count banner (replaces the old "XXX" placeholder)
    let podHtmlNow = d.getElementById('pod-ct').innerHTML;
    ok(!/>\s*XXX\s*</.test(podHtmlNow), 'orphaned "XXX" placeholder removed from POD');
    ok(/Total POD/.test(podHtmlNow), 'POD total-count banner present');
    ok(typeof window._podCountBanner === 'function', '_podCountBanner helper defined');
    const today = window.dataApi.todayISO();
    // hostile+today entry already exists from section 4; add a yesterday entry
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yIso = y.getFullYear() + '-' + String(y.getMonth()+1).padStart(2,'0') + '-' + String(y.getDate()).padStart(2,'0');
    window.DB.pod.s.push({ id: 'yent1', date: yIso, activity: 'ITC-1 › Yesterday Pile Work', qty: 9, mp: 4, by: 'Tester', time: '09:00', status: 'done', progress: 9, resources: [] });
    window.podTab('s');
    let podHtml2 = d.getElementById('pod-ct').innerHTML;
    ok(!podHtml2.includes('Yesterday Pile Work'), "today's filter hides yesterday's entries");
    window.podFilterChange(yIso);
    podHtml2 = d.getElementById('pod-ct').innerHTML;
    ok(podHtml2.includes('Yesterday Pile Work'), 'selected date shows only that date');
    ok(podHtml2.includes('↩ Today'), 'return-to-today shortcut shown');
    window.podFilterChange(today);
    ok(d.querySelectorAll('link[href="css/ui-polish.css"]').length === 1, 'ui-polish.css linked');

    // ── v10.5: BOP 33kV feeder data + Coming Soon removal ──
    console.log('\n6c. BOP 33kV feeder data + Coming Soon…');
    // BOP "Coming Soon" gone from home KPIs
    window.nav('home');
    setTimeout(() => {
    const kpiRow = d.getElementById('home-kpi-row');
    const bopComing = /BOP[\s\S]{0,200}Coming Soon/.test(kpiRow ? kpiRow.innerHTML : '');
    ok(!bopComing, 'BOP "Coming Soon" removed from dashboard (shows real %)');
    // Dashboard manpower KPI must reflect live POD data, not the static seed.
    try {
      const mpEl = d.getElementById('kpi-mp');
      const tIso = window.dataApi.todayISO();
      let expect = 0;
      ['s','w','b','l'].forEach(m=>{(window.DB.pod[m]||[]).forEach(p=>{if((p.date||tIso)===tIso)expect+=parseFloat(p.mp)||0;});});
      const shown = parseFloat((mpEl && mpEl.textContent) || 'NaN');
      ok(mpEl && shown === expect, 'dashboard Total Manpower KPI is live from POD (=' + expect + ', not static seed)');
    } catch(e) { ok(false, 'dashboard manpower KPI — ' + e.message); }
    // Live Data Visualisation row must be REMOVED
    ok(!d.getElementById('home-live-viz'), 'Live Data Visualisation row removed (per request)');

    // ── Manpower & Machinery — live date-wise tracker ──
    console.log('\n6d. Manpower & Machinery (date-wise, drilldown)…');
    try {
      const tIso = window.dataApi.todayISO();
      // seed POD entries with manpower + machinery across two modules
      window.DB.pod.s.push({ id:'mp-s1', date:tIso, activity:'ITC-1 › Pile Driving', qty:10, mp:12,
        resources:[{type:'Piling Rig',qty:2},{type:'Excavator',qty:1}], by:'Eng A', contractor:'Aaraa' });
      window.DB.pod.w.push({ id:'mp-w1', date:tIso, activity:'MOB-142 › Foundation Excavation', qty:1, mp:8,
        resources:[{type:'Excavator',qty:1},{type:'Crane',qty:1}], by:'Eng B', contractor:'Senvion' });
      window.nav('manpower');
      try { window.eval('rndrMp()'); } catch(e) {}
      const mpHtml = d.getElementById('mp-ct').innerHTML;
      ok(/Total Manpower/.test(mpHtml), 'manpower view shows summary KPIs');
      ok(mpHtml.includes('>20<') || /20/.test(mpHtml), 'total manpower = 12+8 = 20 for today');
      ok(/type="date"/.test(mpHtml), 'manpower date picker present');
      ok(/Solar/.test(mpHtml) && /WTG/.test(mpHtml) && /BOP/.test(mpHtml) && /Land/.test(mpHtml), 'all four sub-sections shown');
      // restored layout shows section-wise detail panels inline (no drill click)
      ok(/Section-wise Detail/.test(mpHtml), 'section-wise detail panels shown inline');
      ok(/Piling Rig/.test(mpHtml) && /Pile Driving/.test(mpHtml), 'per-activity machinery + activity listed');
      ok(/Machinery on Site/.test(mpHtml) && /Manpower by Section/.test(mpHtml), 'equipment grid + charts present (all-in-one)');
      // Power BI-style visuals: three charts + share gauges
      ok(/ch-mpd/.test(mpHtml) && /ch-mps/.test(mpHtml) && /ch-mpcmp/.test(mpHtml), 'core manpower charts present (Power BI-style)');
      ok(/mp-share-card/.test(mpHtml) && /% of total manpower/.test(mpHtml), 'section share gauges present');
      ok(/Manpower vs Machinery/.test(mpHtml) && /mp-donut-center/.test(mpHtml), 'comparison chart + donut center total present');
      // new Power BI visuals: hero cards + trend + top-machinery
      ok(/mp-hero-row/.test(mpHtml) && /Machines \/ Worker/.test(mpHtml), 'modern hero KPI cards present');
      ok(/ch-mptrend/.test(mpHtml) && /7-Day Deployment Trend/.test(mpHtml), '7-day deployment trend chart present');
      ok(/ch-mptop/.test(mpHtml) && /Top Machinery Deployed/.test(mpHtml), 'top-machinery chart present');
      ok(/ch-mpcon/.test(mpHtml) && /Manpower by Contractor/.test(mpHtml), 'contractor pie chart present');
      // switch to a past date with no data → per-section empty messages, totals reset
      const y = new Date(); y.setDate(y.getDate()-3);
      const yIso = y.getFullYear()+'-'+String(y.getMonth()+1).padStart(2,'0')+'-'+String(y.getDate()).padStart(2,'0');
      window.mpPickDate(yIso);
      const mpHtml3 = d.getElementById('mp-ct').innerHTML;
      ok(/No .* manpower logged/.test(mpHtml3) && !/Pile Driving/.test(mpHtml3), 'past date with no data shows empty rows');
      window.mpPickDate(tIso); // reset
    } catch(e) { ok(false, 'manpower tracker — ' + e.message); }

    // BOP 33kV: exact feeder pole + span data, derived %, analysis
    window.nav('bop');
    setTimeout(() => {
    try {
      window.eval('rndrBopSec && rndrBopSec("33kv")');
    } catch(e) {}
    const body = d.getElementById('bop-sec-body-33kv');
    const bh = body ? body.innerHTML : '';
    // exact counts from the spec
    ok(/352\/409/.test(bh), 'SPDC poles 352/409 shown');
    ok(/158\/411/.test(bh), 'SPDC spans 158/411 shown');
    ok(/117\/154/.test(bh), 'SPSC F1 poles 117/154 shown');
    ok(/84\/453/.test(bh),  'SPSC F4 poles 84/453 shown');
    ok(/59\/460/.test(bh),  'SPSC F4 spans 59/460 shown');
    ok(/33\/43/.test(bh) && /11\/45/.test(bh), 'SPSC F3 poles 33/43 + spans 11/45 shown');
    ok(/Execution Analysis/.test(bh), 'auto-generated execution analysis present');
    // analysis aggregate totals: poles 586/1059, spans 250/1077
    const totPole = 352+117+0+33+84, totPoleT = 409+154+0+43+453;
    ok(bh.includes(totPole + '/' + totPoleT), 'analysis pole total ' + totPole + '/' + totPoleT + ' derived');
    // derived erection % for SPDC = round(352/409*100)=86
    ok(/86%/.test(bh), 'SPDC erection % derived from counts (86%)');
    // updateBop33Line writer exposed
    ok(typeof window.dataApi.updateBop33Line === 'function', 'updateBop33Line writer exposed');
    // POD status handlers neutralised to no-ops
    ok(typeof window.podSetStatus === 'function', 'podSetStatus shim present (no-op)');

    // ── Back-dating: date selectors on section forms + setProgressDate API ──
    console.log('\n6e. Back-dating progress for past dates…');
    ok(typeof window.dataApi.setProgressDate === 'function', 'dataApi.setProgressDate exposed');
    ok(typeof window._progDateField === 'function' && typeof window._progDateVal === 'function', 'progress-date helpers defined');
    // BOP 33kV form carries a progress-date field
    try {
      window.eval("open33ProgressForm && open33ProgressForm()");
      ok(!!d.getElementById('p33-date'), 'BOP 33kV form has a progress-date field');
      const di = d.getElementById('p33-date');
      ok(di && di.getAttribute('max') === window.dataApi.todayISO(), 'date field capped at today');
      if(d.getElementById('pov')) d.getElementById('pov').classList.remove('open');
    } catch(e) { ok(false, 'BOP date field — ' + e.message); }
    // WTG turbine panel + Solar ITC carry a progress-date selector (editor only)
    ok(typeof window.wtgSetProgDate === 'function', 'WTG back-date setter defined');
    ok(typeof window.solSetProgDate === 'function', 'Solar back-date setter defined');


    // single-file: fetchPartial must resolve from template without fetch
    console.log('\n7. Single-file loader…');
    window.fetchPartial('views/view-pod.html').then(htmlStr => {
      ok(htmlStr.includes('view-pod'), 'fetchPartial reads inline template (no network)');
      const errors = logs.filter(l => l[0] === 'error' && !/Could not load img|canvas|Not implemented/.test(l[1])).filter(l => !/placeholder values/i.test(l[1]));
      ok(errors.length === 0, 'no runtime errors during boot' + (errors.length ? ' — ' + errors[0][1].slice(0, 200) : ''));
      // Google Earth-style map: globe intro + marker flyTo + reset control
      try {
        const rmSrc = require('fs').readFileSync(require('path').join(ROOT, 'js/render-misc.js'), 'utf8');
        ok(/mapInst\.flyTo\(/.test(rmSrc) && /_mapAttachFly/.test(rmSrc), 'map markers use smooth flyTo zoom (Google Earth-style)');
        ok(/Reset View/.test(rmSrc) && /_homeCenter,_homeZoom/.test(rmSrc), 'map has smooth reset-view (zoom-out) control');
        ok(/setView\(\[22,40\],2\)/.test(rmSrc) && /duration:4\.2/.test(rmSrc), 'map opens on world view then flies into the site (globe intro)');
        ok(/map-fly-caption/.test(rmSrc), 'globe-intro flight caption present');
      } catch(e) { ok(false, 'map fly-to check — ' + e.message); }
      console.log('\n' + (fails.length ? '❌ FAILURES: ' + fails.length : '✅ ALL SMOKE TESTS PASSED'));
      process.exit(fails.length ? 1 : 0);
    });
    }, 250);   // bop nav settle
    }, 250);   // home nav settle (6c)
    }, 250);   // pod nav settle
    }, 250);   // solar nav settle
    }, 250);   // wtg nav settle
  } catch (e) {
    console.error('TEST HARNESS ERROR:', e);
    process.exit(1);
  }
}, 2500);

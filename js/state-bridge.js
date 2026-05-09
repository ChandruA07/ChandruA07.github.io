'use strict';
// =============================================================
//  state-bridge.js
//
//  Replaces the old legacy-shim.js. Single responsibility:
//
//    1. Wire Firebase realtime listeners → appStore (single
//       source of truth).
//    2. Mirror appState back into the legacy-shaped `window.DB`
//       object so existing renderers (render-home.js, render-wtg.js
//       etc.) keep working without rewriting every render path.
//    3. Re-render the active view whenever state changes.
//
//  Crucial invariants:
//    • There is NO local-only save. All writes go through dataApi.*,
//      which writes to Firebase, which fires a listener, which
//      updates appState + DB, which triggers re-render.
//    • There is NO scheduleSave/saveDB no-op masking writes any
//      more. Both globals exist for legacy callers but they push
//      the live appState back to Firebase via the proper paths.
// =============================================================

(function (global) {

  // -----------------------------------------------------------
  // CU — keep legacy "current user" name for old renderers.
  // -----------------------------------------------------------
  global.CU = null;

  if (global.auth && auth.onChange) {
    auth.onChange(p => {
      if (!p) {
        global.CU = null;
        appStore.set({ user: null, role: null });
      } else {
        global.CU = {
          uid:   p.uid,
          name:  p.name,
          role:  p.role === 'admin' ? 'all' : p.role,  // legacy alias 'all' for admin
          email: p.email,
          isAdmin: p.role === 'admin',
          isSolar: p.role === 'admin' || p.role === 'solar',
          isWtg:   p.role === 'admin' || p.role === 'wtg',
          isBop:   p.role === 'admin' || p.role === 'bop',
          isViewer:p.role === 'viewer'
        };
        appStore.set({ user: p, role: p.role });
      }
      // Reflect role on document for CSS-based hide/show
      document.documentElement.dataset.role = p ? p.role : 'none';
      const ub = document.getElementById('user-badge');
      if (ub) ub.textContent = p ? (p.name + ' · ' + p.role) : 'Not signed in';
    });
  }

  // Empty USERS dict for any legacy code that still reads it
  global.USERS = {};

  // -----------------------------------------------------------
  // reqLogin(role, cb) — legacy gate. Forwards to auth.requireRole.
  // Maps legacy 'all' → 'admin'.
  // -----------------------------------------------------------
  global.reqLogin = function (role, cb) {
    const map = { all: 'admin', solar: 'solar', wtg: 'wtg', bop: 'bop' };
    auth.requireRole(map[role] || role, cb);
  };

  global.doLogin = () => auth.doLoginForm();
  global.closeLW = () => auth.closeLogin();
  if (typeof global.loadDB !== 'function') global.loadDB = () => false;

  // -----------------------------------------------------------
  // Re-render current view (debounced — many listeners can fire)
  // -----------------------------------------------------------
  let _renderTimer = null;
  function _scheduleRender() {
    clearTimeout(_renderTimer);
    _renderTimer = setTimeout(() => {
      if (typeof rndr === 'function' && global.CV) {
        try { rndr(global.CV, {}); } catch(e) { console.warn('[bridge] rndr failed:', e); }
      }
    }, 60);
  }

  // -----------------------------------------------------------
  // Bridge appState → DB for legacy renderers.
  // -----------------------------------------------------------
  function _mirrorToLegacyDB(s) {
    if (!global.DB) return;
    const DB = global.DB;

    // Solar: appState.solar.itcs.{ITC-1}.acts → DB.solar.itcs[id].acts[i] {done,today,subDone,subScope}
    if (s.solar && s.solar.itcs && DB.solar && DB.solar.itcs) {
      Object.entries(s.solar.itcs).forEach(([id, d]) => {
        if (!DB.solar.itcs[id] || !d || !d.acts) return;
        Object.entries(d.acts).forEach(([idx, a]) => {
          const i = +idx;
          const tgt = DB.solar.itcs[id].acts[i];
          if (!tgt) return;
          if (a.done    !== undefined) tgt.done    = a.done;
          if (a.today   !== undefined) tgt.today   = a.today;
          if (a.subDone !== undefined) tgt.subDone = a.subDone;
          if (a.subScope!== undefined) tgt.subScope= a.subScope;
        });
      });
    }

    // WTG: appState.wtg.turbines{id} → DB.wtg.turbines[]
    // Note: Firebase stores the date dictionary as `mechDates` (legacy name);
    // renderers read it as `t.dates`. Remap here so callers see one shape.
    if (s.wtg && s.wtg.turbines && DB.wtg && Array.isArray(DB.wtg.turbines)) {
      Object.entries(s.wtg.turbines).forEach(([id, val]) => {
        if (!val) return;
        const t = DB.wtg.turbines.find(x => x.id === id);
        if (!t) return;
        Object.assign(t, val);
        if (val.mechDates && !val.dates) t.dates = val.mechDates;
        // Recompute derived status from civil/mech progress so counters
        // ("Foundation Done", "Ready for Erection", "Erection Done") stay
        // honest after a remote update.
        if (typeof recalcTurbStatus === 'function') {
          try { recalcTurbStatus(t); } catch (e) {}
        }
      });
    }

    // BOP
    if (s.bop) {
      // 33kV acts → DB.bopActs['33kv']  (existing behaviour, but scoped now)
      if (s.bop.acts && DB.bopActs) {
        DB.bopActs['33kv'] = s.bop.acts;
      }
      // 66kV acts → DB.bopActs['66kv']  (NEW — was missing, caused 66kV refresh bug)
      if (s.bop.acts66 && DB.bopActs) {
        DB.bopActs['66kv'] = s.bop.acts66;
      }
      if (s.bop.feeders33   && DB.bop33feeders) DB.bop33feeders   = s.bop.feeders33;
      if (s.bop.pss && s.bop.pss.acts && DB.pss)
        Object.entries(s.bop.pss.acts).forEach(([k,v]) => { if (DB.pss.acts[k]) Object.assign(DB.pss.acts[k], v); });
      if (s.bop.gss && s.bop.gss.acts && DB.gss)
        Object.entries(s.bop.gss.acts).forEach(([k,v]) => { if (DB.gss.acts[k]) Object.assign(DB.gss.acts[k], v); });
      console.log('[bridge] mirrored to DB: bop');
    }

    // ROW issues — legacy code reads DB.rowIssues as an array
    if (s.rowIssues) {
      DB.rowIssues = Object.entries(s.rowIssues).map(([id, v]) => ({ id, ...v }));
    }

    // Milestones — legacy reads DB.milestones as array, sorted by date
    if (s.milestones) {
      DB.milestones = Object.entries(s.milestones)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a,b) => (a.date||'').localeCompare(b.date||''));
    }

    // Gantt rows
    if (s.ganttRows) {
      DB.ganttRows = s.ganttRows;
    }

    // Schedule
    if (s.schedule && DB.schedule) {
      if (Array.isArray(s.schedule.planned)) DB.schedule.planned = s.schedule.planned;
      if (Array.isArray(s.schedule.actual))  DB.schedule.actual  = s.schedule.actual;
      if (Array.isArray(s.schedule.labels))  DB.schedule.labels  = s.schedule.labels;
    }

    // Daily Progress feed — legacy reads as array
    if (s.dailyProgress) {
      DB.dailyProgress = Object.entries(s.dailyProgress)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a,b) => (b.ts||0) - (a.ts||0));
    }

    // POD — flatten today's entries into DB.pod.{s,w,l,b}
    if (s.pod) {
      const todayISO = (typeof dataApi !== 'undefined' && dataApi.todayISO) ? dataApi.todayISO()
        : new Date().toISOString().slice(0,10);
      const todayMap = s.pod[todayISO] || {};
      const yesterday = (() => { const d = new Date(); d.setDate(d.getDate()-1); return d.toISOString().slice(0,10); })();
      const yMap = s.pod[yesterday] || {};
      DB.pod = { s:[], w:[], l:[], b:[] };
      [todayMap, yMap].forEach(map => {
        Object.entries(map).forEach(([id, e]) => {
          const m = e.module;
          if (!DB.pod[m]) return;
          DB.pod[m].push({
            id, date: e.date || (e === todayMap ? todayISO : yesterday),
            activity:   e.activity,
            qty:        e.qty,
            mp:         e.mp,
            contractor: e.contractor,
            notes:      e.notes,
            by:         e.byName || e.by,
            photoURL:   e.photoURL,
            ts:         e.ts,
            time:       e.ts ? new Date(e.ts).toLocaleTimeString() : ''
          });
        });
      });
    }
  }

  // Subscribe ONCE: every appState change mirrors to DB and triggers re-render.
  appStore.subscribe(s => {
    _mirrorToLegacyDB(s);
    _scheduleRender();
  });

  // -----------------------------------------------------------
  // Hydrate appState from Firebase. Each listener pushes data
  // into appStore via patchPath/set, which triggers the
  // mirror-to-DB + re-render via the subscriber above.
  // -----------------------------------------------------------
  function _hydrate() {
    if (!global.DB) {
      console.warn('[bridge] window.DB not defined yet — data.js must load first.');
      return;
    }

    // ── Solar (per ITC) ──
    Object.keys(DB.solar.itcs || {}).forEach(itcId => {
      realtime.listenSolar(itcId, val => {
        if (!val) return;
        // val.acts is keyed by idx
        const acts = val.acts || {};
        appStore.patchPath('solar.itcs.' + itcId, { acts });
      });
    });

    // ── WTG (per turbine via child events) ──
    realtime.listenWtg(evt => {
      if (!evt.val) return;
      appStore.patchPath('wtg.turbines.' + evt.id, evt.val);
    });

    // ── BOP (one value listener) ──
    realtime.listenBop(val => {
      if (!val) return;
      appStore.patchPath('bop', val);
    });

    // ── ROW issues ──
    realtime.listenRowIssues(evt => {
      const cur = Object.assign({}, appState.rowIssues || {});
      if (evt.kind === 'remove') delete cur[evt.id];
      else                       cur[evt.id] = evt.val;
      appStore.set({ rowIssues: cur });
    });

    // ── Milestones ──
    realtime.listenMilestones(evt => {
      const cur = Object.assign({}, appState.milestones || {});
      if (evt.kind === 'remove') delete cur[evt.id];
      else                       cur[evt.id] = evt.val;
      appStore.set({ milestones: cur });
    });

    // ── Gantt ──
    realtime.listenGantt(rows => appStore.set({ ganttRows: rows }));

    // ── Schedule ──
    realtime.listenSchedule(sched => { if (sched) appStore.set({ schedule: sched }); });

    // ── Daily Progress feed ──
    realtime.listenDailyProgress(evt => {
      const cur = Object.assign({}, appState.dailyProgress || {});
      if (evt.kind === 'remove') delete cur[evt.id];
      else                       cur[evt.id] = evt.val;
      appStore.set({ dailyProgress: cur });
    }, 200);

    // ── POD (today + recent days; uses date-keyed paths) ──
    realtime.listenPodToday(evt => {
      const todayISO = dataApi.todayISO();
      const cur = Object.assign({}, appState.pod || {});
      const day = Object.assign({}, cur[todayISO] || {});
      if (evt.kind === 'remove') delete day[evt.id];
      else                       day[evt.id] = Object.assign({ date: todayISO }, evt.val);
      cur[todayISO] = day;
      appStore.set({ pod: cur });
    });

    // Also fetch yesterday + day before once (no listener) so the home
    // view shows recent POD entries even if today's is empty.
    realtime.loadRecentPod(3).then(arr => {
      const cur = Object.assign({}, appState.pod || {});
      arr.forEach(({ date, entries }) => {
        const day = {};
        entries.forEach(e => { day[e.id] = e; });
        cur[date] = Object.assign({}, cur[date] || {}, day);
      });
      appStore.set({ pod: cur });
    }).catch(e => console.warn('[bridge] loadRecentPod:', e));

    // ── HSE observations + employees (renderer expects HSE_DB) ──
    // CRITICAL: clear hardcoded seed data BEFORE attaching listeners,
    // otherwise the renderer mixes seed entries with live Firebase data.
    if (global.HSE_DB) {
      HSE_DB.observations = [];
      HSE_DB.employees    = [];
      console.log('[bridge] HSE_DB seed cleared before listener attach');

      realtime.listenHse(evt => {
        HSE_DB.observations = HSE_DB.observations || [];
        if (evt.kind === 'remove') {
          HSE_DB.observations = HSE_DB.observations.filter(o => o._id !== evt.id);
        } else {
          const i = HSE_DB.observations.findIndex(o => o._id === evt.id);
          const obj = { _id: evt.id, ...evt.val };
          if (i >= 0) HSE_DB.observations[i] = obj; else HSE_DB.observations.push(obj);
        }
        console.log('[bridge] mirrored to DB: hse.observations count=' + HSE_DB.observations.length);
        if (typeof rndrSafety === 'function') { try { rndrSafety(); } catch(e) {} }
      });

      realtime.listenHseEmployees(list => {
        HSE_DB.employees = list || [];
        console.log('[bridge] mirrored to DB: hse.employees count=' + HSE_DB.employees.length);
        if (typeof rndrSafety === 'function') { try { rndrSafety(); } catch(e) {} }
      });
    }

    // ── Land: /land/wtgLocs → DB.wtgLand.locs
    //         /land/solBlocks → DB.solLand.blocks
    //         /land/parcels   → DB.landParcels (array)
    realtime.listenLand(land => {
      if (!land || !global.DB) return;
      // WTG locations
      if (land.wtgLocs && DB.wtgLand && Array.isArray(DB.wtgLand.locs)) {
        Object.entries(land.wtgLocs).forEach(([id, val]) => {
          const target = DB.wtgLand.locs.find(x => x.id === id);
          if (target) Object.assign(target, val);
        });
      }
      // Solar blocks
      if (land.solBlocks && DB.solLand && DB.solLand.blocks) {
        Object.entries(land.solBlocks).forEach(([id, val]) => {
          if (DB.solLand.blocks[id] && val.acts) {
            DB.solLand.blocks[id].acts = val.acts;
          }
        });
      }
      // Parcels collection (overwrite array — small dataset)
      if (land.parcels) {
        DB.landParcels = Object.entries(land.parcels).map(([id, v]) => ({ id, ...v }));
      } else if (Array.isArray(DB.landParcels)) {
        DB.landParcels = [];
      }
      console.log('[bridge] mirrored to DB: land');
      _scheduleRender();
    });
  }

  function _whenReady(cb) {
    if (global.DB && global.dataApi && global.realtime && global.auth) cb();
    else setTimeout(() => _whenReady(cb), 50);
  }
  _whenReady(_hydrate);

  // -----------------------------------------------------------
  // Legacy save shims — kept so old code keeps working, but they
  // are NO LONGER no-ops. They are deprecated; new code should
  // call dataApi.* directly.
  //
  // scheduleSave() / saveDB() walk the relevant slices of DB and
  // push them through dataApi.* writes. Debounced.
  // -----------------------------------------------------------
  let _flushTimer = null;
  async function _flushLegacyDB() {
    if (!global.DB) return;
    try {
      const me = (typeof auth !== 'undefined' && auth.current) ? auth.current() : null;
      if (!me) return;       // not signed in → silently drop
      if (me.role === 'viewer') return;

      // Solar
      if (DB.solar && DB.solar.itcs && (me.role === 'admin' || me.role === 'solar')) {
        const proms = [];
        Object.entries(DB.solar.itcs).forEach(([itcId, d]) => {
          (d.acts || []).forEach((a, i) => {
            proms.push(dataApi.updateSolarAct(itcId, i, {
              done:    a.done,
              today:   a.today,
              subDone: a.subDone || []
            }).catch(e => console.warn('[bridge] solar push:', e)));
          });
        });
        await Promise.all(proms);
      }

      // WTG
      if (DB.wtg && Array.isArray(DB.wtg.turbines) && (me.role === 'admin' || me.role === 'wtg')) {
        const proms = DB.wtg.turbines.map(t =>
          dataApi.updateTurbine(t.id, {
            status: t.status, lp: !!t.lp, pp: !!t.pp,
            civil: t.civil || [], mech: t.mech || [],
            uss: t.uss || 0, sup: t.sup || 0,
            notes: t.notes || ''
          }).catch(e => console.warn('[bridge] wtg push:', e))
        );
        await Promise.all(proms);
      }

      const ts = document.getElementById('last-saved-ts');
      if (ts) ts.textContent = '☁️ Synced: ' + new Date().toLocaleTimeString();
    } catch (e) {
      console.warn('[bridge] flush error:', e);
    }
  }

  global.scheduleSave = function () {
    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(_flushLegacyDB, 1000);
  };
  global.saveDB = function () {
    clearTimeout(_flushTimer);
    _flushLegacyDB();
  };

  console.log('[bridge] state-bridge.js initialised — Firebase is the single source of truth.');

})(window);

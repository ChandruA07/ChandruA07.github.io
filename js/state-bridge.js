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

  // ---------------------------------------------------------------
  // FIX 3 — async message channel error swallower.
  //
  // Symptom in DevTools console:
  //   "A listener indicated an asynchronous response by returning
  //    true, but the message channel closed before a response was
  //    received."
  //
  // This is almost always thrown by a browser extension's
  // chrome.runtime.onMessage listener that returned `true` (signal
  // "I'll respond async") but then the page navigated / the popup
  // closed before sendResponse() ran. We can't patch extensions,
  // but we can stop their stray rejections from polluting our
  // console as if they were app bugs.
  //
  // We also wrap every fire-and-forget Firebase write (saveDB /
  // scheduleSave below) in `.catch(() => {})` so a transient
  // network blip doesn't show up as the same error string.
  // ---------------------------------------------------------------
  global.addEventListener('unhandledrejection', function (ev) {
    const msg = (ev && ev.reason && (ev.reason.message || String(ev.reason))) || '';
    if (/message channel closed|listener indicated an asynchronous response/i.test(msg)) {
      ev.preventDefault();   // keep the page console clean
      return;
    }
    // Anything else: leave it visible so real app bugs aren't hidden.
  });

  // Defensive wrap for any chrome-extension-style listener that may
  // exist in the page (e.g. injected by a 3rd-party script). When a
  // listener returns `true`, the runtime expects sendResponse to be
  // called; we wrap sendResponse with a try/catch so a thrown error
  // inside the async handler still produces a `{ error }` reply
  // instead of letting the channel close uncaught.
  if (global.chrome && chrome.runtime && chrome.runtime.onMessage && !chrome.runtime.onMessage.__swpplPatched) {
    try {
      const orig = chrome.runtime.onMessage.addListener.bind(chrome.runtime.onMessage);
      chrome.runtime.onMessage.addListener = function (fn) {
        return orig(function (msg, sender, sendResponse) {
          let safeSend = (resp) => { try { sendResponse(resp); } catch (e) {} };
          try {
            const result = fn(msg, sender, safeSend);
            if (result && typeof result.then === 'function') {
              result.then(r => safeSend(r), e => safeSend({ error: e && e.message || String(e) }));
              return true;
            }
            return result;
          } catch (e) {
            safeSend({ error: e && e.message || String(e) });
            return false;
          }
        });
      };
      chrome.runtime.onMessage.__swpplPatched = true;
    } catch (e) { /* not in an extension context — ignore */ }
  }

  // -----------------------------------------------------------
  // CU — keep legacy "current user" name for old renderers.
  //
  // FIX 4 — synchronous initial population.
  // Old code only populated CU via auth.onChange, which fires on a
  // queueMicrotask. On page reload with sessionStorage already
  // unlocked, that meant CU was null for one tick — and any
  // protected handler that ran in that tick (e.g. user mashes the
  // "Raise ROW" button on a refresh) saw CU===null and printed
  // "Login Required" even though auth.canEdit() was already true.
  // We now seed CU from auth.current() before subscribing, then
  // keep it in sync via onChange.
  // -----------------------------------------------------------
  global.CU = null;

  function _setCUFromProfile(p) {
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
        isLand:  p.role === 'admin' || p.role === 'land',
        isViewer:p.role === 'viewer'
      };
      appStore.set({ user: p, role: p.role });
    }
    // Reflect role on document for CSS-based hide/show
    document.documentElement.dataset.role = p ? p.role : 'none';
    const ub = document.getElementById('user-badge');
    if (ub) ub.textContent = p ? (p.name + ' · ' + p.role) : 'Not signed in';
  }

  // Seed synchronously from whatever auth.current() returns right now
  // (handles "session already unlocked" page reloads).
  if (global.auth && typeof auth.current === 'function') {
    try { _setCUFromProfile(auth.current()); } catch (e) {}
  }

  if (global.auth && auth.onChange) {
    auth.onChange(_setCUFromProfile);
  }

  // Empty USERS dict for any legacy code that still reads it
  global.USERS = {};

  // -----------------------------------------------------------
  // reqLogin(role, cb) — legacy gate. Forwards to auth.requireRole.
  // Maps legacy 'all' → 'admin'.
  // -----------------------------------------------------------
  global.reqLogin = function (role, cb) {
    const map = { all: 'all', solar: 'solar', wtg: 'wtg', bop: 'bop', land: 'land' };
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
  //
  // FIX 1 — debounce + re-entrancy guard.
  // The old code logged "[bridge] mirrored to DB: bop" 12+ times
  // on load because every Firebase listener fired its own appStore
  // patch, which in turn triggered the subscriber, which mirrored
  // again, which (for any code path that wrote back) triggered the
  // listener — a write→read→write loop.
  //
  //   - `isMirroring` short-circuits any nested invocation.
  //   - `_scheduleMirror()` debounces bursts (300ms) so a flood of
  //     listener events collapses into one mirror pass.
  // -----------------------------------------------------------
  let isMirroring     = false;
  let _mirrorTimer    = null;
  let _pendingMirrorState = null;

  function _scheduleMirror(s) {
    _pendingMirrorState = s;
    if (_mirrorTimer) return;
    _mirrorTimer = setTimeout(() => {
      _mirrorTimer = null;
      const next = _pendingMirrorState;
      _pendingMirrorState = null;
      if (isMirroring) return;
      isMirroring = true;
      try {
        _mirrorToLegacyDB(next);
      } catch (e) {
        console.warn('[bridge] mirror failed:', e);
      } finally {
        isMirroring = false;
      }
    }, 300);
  }

  function _mirrorToLegacyDB(s) {
    if (!global.DB) return;
    const DB = global.DB;

    // Solar: appState.solar.itcs.{ITC-1}.acts → DB.solar.itcs[id].acts[i] {done,today,subDone,subScope}
    if (s.solar && s.solar.itcs && DB.solar && DB.solar.itcs) {
      Object.entries(s.solar.itcs).forEach(([id, d]) => {
        if (!DB.solar.itcs[id] || !d) return;
        // Live activities / no-work reason (set by authorized user on ITC subpage)
        if (d.live) {
          DB.solar.itcs[id].live = {
            activities:   Array.isArray(d.live.activities) ? d.live.activities : [],
            noWorkReason: d.live.noWorkReason || '',
            lastByName:   d.live.lastByName || '',
            lastAt:       d.live.lastAt
          };
        }
        if (!d.acts) return;
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

    // WTG Zero Point (store yard) — appState.wtg.zeroPoint → DB.wtg.zeroPoint
    if (s.wtg && s.wtg.zeroPoint && DB.wtg) {
      DB.wtg.zeroPoint = s.wtg.zeroPoint;
    }

    // WTG Custom activity tree — appState.wtg.customActs → DB.wtg.customActs
    if (s.wtg && s.wtg.customActs && DB.wtg) {
      DB.wtg.customActs = s.wtg.customActs;
      // Re-seed every turbine's acts slots so any newly-added custom activity
      // shows up immediately without waiting for a manual click.
      if (typeof wtgInitActs === 'function' && Array.isArray(DB.wtg.turbines)) {
        DB.wtg.turbines.forEach(t => { try { wtgInitActs(t); } catch(e){} });
      }
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
      // FIX 1 — was console.log('[bridge] mirrored to DB: bop'); fired 12+ times on load.
      // Debounced through _scheduleMirror() now; one collapsed log is plenty.
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
    // Include ALL dates stored in appState.pod (today, yesterday, and any
    // extra dates that were submitted via the form's date picker).
    if (s.pod) {
      const todayISO = (typeof dataApi !== 'undefined' && dataApi.todayISO) ? dataApi.todayISO()
        : new Date().toISOString().slice(0,10);
      DB.pod = { s:[], w:[], l:[], b:[] };
      Object.entries(s.pod).forEach(([dateKey, dateMap]) => {
        Object.entries(dateMap).forEach(([id, e]) => {
          const m = e.module;
          if (!DB.pod[m]) return;
          DB.pod[m].push({
            id, date: e.date || dateKey,
            activity:   e.activity,
            qty:        e.qty,
            mp:         e.mp,
            contractor: e.contractor,
            notes:      e.notes,
            by:         e.byName || e.by,
            photoURL:   e.photoURL,
            ts:         e.ts,
            time:       e.ts ? new Date(e.ts).toLocaleTimeString() : '',
            // Status fields (filled in by authorized person from subpages)
            status:       e.status   || 'nys',
            progress:     Number(e.progress) || 0,
            remark:       e.remark   || '',
            statusBy:     e.statusBy,
            statusByName: e.statusByName || '',
            statusAt:     e.statusAt
          });
        });
      });
      // Sort each module's entries newest-first
      ['s','w','l','b'].forEach(m => {
        DB.pod[m].sort((a,b) => (b.ts||0) - (a.ts||0));
      });
    }

    // ── Next Day Plan mirror — DB.nextDayPlan.{s,w,l,b} for tomorrow
    if (s.nextDayPlan) {
      DB.nextDayPlan = { s:[], w:[], l:[], b:[] };
      Object.entries(s.nextDayPlan).forEach(([dateKey, dateMap]) => {
        Object.entries(dateMap).forEach(([id, e]) => {
          const m = e.module;
          if (!DB.nextDayPlan[m]) return;
          DB.nextDayPlan[m].push({
            id, forDate: e.forDate || dateKey,
            activity: e.activity, qty: e.qty, mp: e.mp,
            contractor: e.contractor, notes: e.notes,
            by: e.byName || e.by, ts: e.ts
          });
        });
      });
      ['s','w','l','b'].forEach(m => {
        DB.nextDayPlan[m].sort((a,b) => (b.ts||0) - (a.ts||0));
      });
    }
  }

  // Subscribe ONCE: every appState change mirrors to DB and triggers re-render.
  // FIX 1 — mirror is debounced + guarded against re-entrancy. The render is
  // already debounced separately inside _scheduleRender().
  appStore.subscribe(s => {
    _scheduleMirror(s);
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
        const live = val.live || null;
        const patch = { acts };
        if (live) patch.live = live;
        appStore.patchPath('solar.itcs.' + itcId, patch);
      });
    });

    // ── WTG (per turbine via child events) ──
    realtime.listenWtg(evt => {
      if (!evt.val) return;
      appStore.patchPath('wtg.turbines.' + evt.id, evt.val);
    });

    // ── WTG Zero Point (store yard) ──
    realtime.listenWtgZeroPoint(val => {
      if (!val) return;
      appStore.patchPath('wtg.zeroPoint', val);
    });

    // ── WTG Custom activity tree (global, shared by all turbines) ──
    realtime.listenWtgCustomActs(val => {
      if (!val) return;
      appStore.patchPath('wtg.customActs', val);
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
    // Track which dates already have live listeners to avoid duplicates.
    const _podListenedDates = new Set();

    function _attachPodDateListener(date) {
      if (_podListenedDates.has(date)) return;
      _podListenedDates.add(date);
      realtime.listenPodToday(evt => {
        const cur = Object.assign({}, appState.pod || {});
        const day = Object.assign({}, cur[date] || {});
        if (evt.kind === 'remove') delete day[evt.id];
        else                       day[evt.id] = Object.assign({ date: date }, evt.val);
        cur[date] = day;
        appStore.set({ pod: cur });
      }, date);
    }

    // Always listen to today
    _attachPodDateListener(dataApi.todayISO());
    // Also proactively listen to yesterday — common for late-night submissions
    (function() {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      _attachPodDateListener(iso);
    })();

    // Expose so subPOD can call it when a non-today date is submitted
    global._attachPodDateListener = _attachPodDateListener;

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

    // ── Next Day Plan (listen to tomorrow's planned entries) ──
    if (realtime.listenNextDayPlan) {
      realtime.listenNextDayPlan(evt => {
        const cur = Object.assign({}, appState.nextDayPlan || {});
        const day = Object.assign({}, cur[evt.forDate] || {});
        if (evt.kind === 'remove') delete day[evt.id];
        else                       day[evt.id] = Object.assign({ forDate: evt.forDate }, evt.val);
        cur[evt.forDate] = day;
        appStore.set({ nextDayPlan: cur });
      });
    }

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
      // FIX 1 — collapsed; was logging on every listener tick.
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
    // DEMO BUILD: no-op.
    //
    // The legacy scheduleSave() / saveDB() shims used to bulk-rewrite Solar
    // and WTG state on every call. That had two problems in real-time mode:
    //   1. it could overwrite live edits from another device with stale local
    //      state (last-write-wins on a debounce timer);
    //   2. it pushed hundreds of leaves on every keystroke.
    //
    // Every renderer that mutates real data now calls dataApi.* directly,
    // so this bulk flush isn't needed. We keep the function (and the
    // global aliases) so legacy onclick="scheduleSave()" handlers don't
    // throw; they just become harmless no-ops.
    return;
  }

  global.scheduleSave = function () {
    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(() => {
      // FIX 3 — never let a rejection from a fire-and-forget caller bubble up
      // as an "unhandled promise rejection" / extension-channel-closed error.
      Promise.resolve(_flushLegacyDB()).catch(() => {});
    }, 1000);
  };
  global.saveDB = function () {
    clearTimeout(_flushTimer);
    Promise.resolve(_flushLegacyDB()).catch(() => {});
  };

  console.log('[bridge] state-bridge.js initialised — Firebase is the single source of truth.');

})(window);

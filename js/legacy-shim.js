'use strict';
// =============================================================
//  legacy-shim.js  (v10) — bridges old globals to new layer
//
//  v10 model:
//    - No user accounts; everyone is a guest.
//    - editLock controls whether sensitive writes are permitted.
//    - POD is open (no editLock check inside dataApi.addPod).
//
//  Old globals re-mapped:
//    CU            → fake "everyone is admin in their viewing rights"
//    USERS         → empty (any old code that reads it falls through)
//    doLogin       → editLock.submit (modal "OK" button)
//    closeLW       → editLock.cancel
//    reqLogin(role,cb) → editLock.require(role-as-label, cb)
//    scheduleSave  → no-op (writes go through dataApi.* per-leaf)
//    saveDB        → alias of scheduleSave
// =============================================================

(function (global) {

  // -----------------------------------------------------------
  // CU: legacy "current user" object. Always present so renderers
  // that branch on `if (CU)` work; flags reflect edit-mode state.
  // -----------------------------------------------------------
  function _refreshCU() {
    const unlocked = editLock.isUnlocked();
    global.CU = {
      uid:      'guest',
      name:     unlocked ? 'Editor' : 'Guest',
      role:     unlocked ? 'all' : 'viewer',
      isAdmin:  unlocked,
      isSolar:  unlocked,
      isWtg:    unlocked,
      isBop:    unlocked,
      isViewer: !unlocked
    };
    const ub = document.getElementById('user-badge');
    if (ub) ub.textContent = unlocked ? '🔓 Editor' : '👤 Guest';
    const pill = document.getElementById('edit-mode-pill');
    if (pill) {
      pill.textContent = unlocked ? '🔓 Edit mode' : '🔒 View mode';
      pill.style.color = unlocked ? 'var(--ok,#3ddc84)' : 'var(--t3,#7a93b0)';
    }
    document.documentElement.dataset.editMode = unlocked ? '1' : '0';
  }
  _refreshCU();
  editLock.onChange(_refreshCU);

  global.USERS = {};

  // -----------------------------------------------------------
  // Login modal hooks — repurposed for the edit-lock prompt
  // -----------------------------------------------------------
  global.doLogin = () => editLock.submit();
  global.closeLW = () => editLock.cancel();

  // reqLogin(role, cb) — was a per-role gate; now a single password.
  // We pass a friendly label derived from the role so the modal copy
  // makes sense ("Password required to: WTG").
  global.reqLogin = function (role, cb) {
    const labelMap = { all: 'edit data', solar: 'edit Solar', wtg: 'edit WTG', bop: 'edit BOP' };
    editLock.require(labelMap[role] || ('edit ' + role), cb);
  };

  // -----------------------------------------------------------
  // saveDB / scheduleSave — no-ops in v10
  // -----------------------------------------------------------
  let _warned = false;
  global.scheduleSave = function () {
    if (!_warned) {
      console.warn('[shim v10] scheduleSave() is a no-op — writes go through dataApi.*');
      _warned = true;
    }
  };
  global.saveDB = global.scheduleSave;

  // Stub for any code still calling loadDB
  if (typeof global.loadDB !== 'function') global.loadDB = () => false;

  // -----------------------------------------------------------
  // Bootstrap live listeners that hydrate window.DB.
  // Renderers read DB.* synchronously, so we patch DB in place
  // and call rndr() to refresh the current view.
  // -----------------------------------------------------------
  function _hydrateDB() {
    if (!global.DB) {
      console.warn('[shim v10] window.DB not defined yet — data.js must load first.');
      return;
    }

    // ---- POD: today + yesterday → DB.pod[s|w|l|b] ----
    DB.pod = DB.pod || { s: [], w: [], l: [], b: [] };
    const _resetPod = () => { DB.pod.s = []; DB.pod.w = []; DB.pod.l = []; DB.pod.b = []; };

    let _refreshTimer = null;
    async function _refreshPod() {
      clearTimeout(_refreshTimer);
      _refreshTimer = setTimeout(async () => {
        try {
          const recent = await realtime.loadRecentPod(2); // today + yesterday
          _resetPod();
          recent.forEach(({ date, entries }) => {
            entries.forEach(e => {
              const m = e.module;
              if (DB.pod[m]) {
                DB.pod[m].push({
                  id:         e.id,
                  date:       date,
                  activity:   e.activity || '',
                  qty:        e.qty || 0,
                  unit:       e.unit || '',
                  mp:         e.mp || 0,
                  contractor: e.contractor || '',
                  notes:      e.notes || '',
                  by:         e.by || 'guest',
                  photoB64:   e.photoB64 || null,
                  photoURL:   e.photoURL || null,
                  ts:         e.ts || 0,
                  time:       e.ts ? new Date(e.ts).toLocaleTimeString('en-GB', {hour:'2-digit',minute:'2-digit'}) : ''
                });
              }
            });
          });
          // Sort each module newest-first
          ['s','w','l','b'].forEach(k => DB.pod[k].sort((a,b)=>(b.ts||0)-(a.ts||0)));

          if (typeof rndr === 'function' && global.CV) {
            try { rndr(global.CV, {}); } catch(e) {}
          }
        } catch (e) { console.warn('[shim v10] POD refresh failed:', e); }
      }, 250);
    }

    realtime.listenPodWindow(2, () => _refreshPod()); // listen across today+yesterday
    _refreshPod();

    // ---- Solar ITCs ----
    realtime.listenSolarAll(itcs => {
      if (!itcs) return;
      Object.entries(itcs).forEach(([itcId, val]) => {
        if (!DB.solar.itcs[itcId]) return;
        const acts = (val.acts || {});
        Object.entries(acts).forEach(([idx, a]) => {
          const i = +idx;
          if (DB.solar.itcs[itcId].acts[i]) {
            if (a.done    !== undefined) DB.solar.itcs[itcId].acts[i].done    = a.done;
            if (a.today   !== undefined) DB.solar.itcs[itcId].acts[i].today   = a.today;
            if (a.subDone !== undefined) DB.solar.itcs[itcId].acts[i].subDone = a.subDone;
          }
        });
      });
      if (typeof rndr === 'function' && global.CV) { try { rndr(global.CV, {}); } catch(e) {} }
    });

    // ---- WTG ----
    realtime.listenWtg(evt => {
      if (!evt.val || !DB.wtg || !DB.wtg.turbines) return;
      const t = DB.wtg.turbines.find(x => x.id === evt.id);
      if (t) Object.assign(t, evt.val);
      if (typeof rndr === 'function' && global.CV) { try { rndr(global.CV, {}); } catch(e) {} }
    });

    // ---- BOP ----
    realtime.listenBop(val => {
      if (!val) return;
      if (val.acts        && DB.bopActs)        DB.bopActs        = val.acts;
      if (val.feeders33   && DB.bop33feeders)   DB.bop33feeders   = val.feeders33;
      if (val.pss         && DB.pss)            Object.assign(DB.pss.acts, val.pss.acts || {});
      if (val.gss         && DB.gss)            Object.assign(DB.gss.acts, val.gss.acts || {});
      if (typeof rndr === 'function' && global.CV) { try { rndr(global.CV, {}); } catch(e) {} }
    });

    // ---- HSE ----
    if (global.HSE_DB) {
      realtime.listenHse(evt => {
        HSE_DB.observations = HSE_DB.observations || [];
        if (evt.kind === 'remove') {
          HSE_DB.observations = HSE_DB.observations.filter(o => o._id !== evt.id);
        } else {
          const i = HSE_DB.observations.findIndex(o => o._id === evt.id);
          const obj = { _id: evt.id, ...evt.val };
          if (i >= 0) HSE_DB.observations[i] = obj; else HSE_DB.observations.push(obj);
        }
        if (typeof rndrSafety === 'function') { try { rndrSafety(); } catch(e) {} }
      });
    }
  }

  function _whenReady(cb) {
    if (global.DB) cb(); else setTimeout(() => _whenReady(cb), 50);
  }
  _whenReady(_hydrateDB);

  console.log('[shim v10] Legacy globals re-mapped onto editLock + dataApi.');

})(window);

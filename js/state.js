'use strict';
// =============================================================
//  state.js  —  Single global app state.
//
//  RULE OF THE BUILD:
//    • appState is hydrated EXCLUSIVELY by Firebase listeners.
//    • UI code reads from appState, never from local caches.
//    • Mutations go through dataApi.* (which writes to Firebase).
//      Firebase fans the change back to appState via listeners.
//      The UI re-renders because subscribers see the change.
//
//  This is the closest thing this codebase has to Redux:
//  unidirectional data flow, no manual sync, no duplicate state.
//
//  Public surface (window.appState + window.appStore):
//    appState              — readonly snapshot (do not mutate)
//    appStore.subscribe(fn)  → unsubscribe()  // re-runs fn on every change
//    appStore.set(patch)     // internal — used by state-bridge.js
//    appStore.role()         // shorthand: current user's role
//    appStore.can(perm)      // role-permission helper
// =============================================================

(function (global) {

  const _state = {
    // Auth
    user: null,        // { uid, name, email, role } or null
    role: null,        // 'admin' | 'solar' | 'wtg' | 'bop' | 'viewer' | null

    // Module data — hydrated by Firebase listeners
    solar:    { itcs: {}, meta: {} },
    wtg:      { turbines: {} },                  // keyed by turbine id
    bop:      { acts: {}, feeders33: [], pss: { acts:{} }, gss: { acts:{} } },
    pod:      {},                                // { 'YYYY-MM-DD': { pushId: {...} } }

    // Top-level dashboard collections
    rowIssues:     {},                           // keyed by push id
    milestones:    {},                           // keyed by push id
    ganttRows:     null,                         // array
    schedule:      null,                         // { planned, actual, labels }
    dailyProgress: {},                           // keyed by push id

    // UI / nav
    currentView:   'home',
    online:        true,
    lastSavedAt:   null,
  };

  const _subs = new Set();

  function subscribe(fn) {
    if (typeof fn !== 'function') return () => {};
    _subs.add(fn);
    // Push current state immediately so the subscriber renders right away.
    try { fn(_state); } catch (e) { console.warn('[appStore] subscriber threw:', e); }
    return () => _subs.delete(fn);
  }

  function _notify() {
    _subs.forEach(fn => {
      try { fn(_state); } catch (e) { console.warn('[appStore] subscriber threw:', e); }
    });
  }

  // Shallow patch + notify. Used by state-bridge.js as listeners fire.
  function set(patch) {
    if (!patch || typeof patch !== 'object') return;
    Object.assign(_state, patch);
    _notify();
  }

  // Patch a nested key, e.g. patchPath('solar.itcs.ITC-1.acts.0', { done: 50 })
  // Used by per-leaf listeners that don't need to clobber the rest of the tree.
  function patchPath(path, value) {
    const parts = path.split('.');
    let cur = _state;
    for (let i = 0; i < parts.length - 1; i++) {
      const k = parts[i];
      if (cur[k] === undefined || cur[k] === null) cur[k] = {};
      cur = cur[k];
    }
    cur[parts[parts.length - 1]] = value;
    _notify();
  }

  function role() { return _state.role; }

  // Permission helper. Drives all "can this user edit?" checks.
  // Permissions:
  //   editSolar     editWtg     editBop     editLand
  //   editRow       editMilestone           editGantt
  //   editSchedule  editPod
  function can(perm) {
    const r = _state.role;
    if (!r) return false;
    if (r === 'admin') return true;          // Site Manager → full access
    if (r === 'viewer') return false;        // Viewer → read only
    switch (perm) {
      case 'editSolar':     return r === 'solar';
      case 'editWtg':       return r === 'wtg';
      case 'editBop':       return r === 'bop';
      case 'editLand':      return false;    // admin-only
      case 'editGantt':     return false;    // admin-only
      case 'editSchedule':  return false;    // admin-only
      case 'editRow':       return true;     // any non-viewer authed user
      case 'editMilestone': return true;     // any non-viewer authed user
      case 'editPod':       return true;     // any non-viewer authed user
      default:              return false;
    }
  }

  global.appState = _state;
  global.appStore = { subscribe, set, patchPath, role, can };

})(window);

'use strict';
// =============================================================
//  realtime.js  (v10) — listener registration with auto-cleanup
//
//  Identical strategy to v9:
//    - child_added / child_changed for collections (cheap)
//    - value only for small leaf nodes
//    - .off() listeners on logout / page nav to avoid leaks
//
//  v10 additions:
//    - listenPodWindow(days, cb)  — drives the DPR view
//    - listenAllPodToday(cb)      — drives home + DPR live updates
// =============================================================

(function (global) {

  const _active = new Set();

  function _track(ref, eventType, handler) {
    _active.add({ ref, eventType, handler });
    return () => {
      try { ref.off(eventType, handler); } catch (e) {}
      for (const e of _active) if (e.ref === ref && e.handler === handler) { _active.delete(e); break; }
    };
  }

  function detachAll() {
    for (const e of _active) { try { e.ref.off(e.eventType, e.handler); } catch(_){} }
    _active.clear();
  }

  function isoDaysAgo(n) {
    const d = new Date(); d.setDate(d.getDate() - n);
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  // -----------------------------------------------------------
  //  POD — today only, three event types
  // -----------------------------------------------------------
  function listenPodToday(cb) {
    const date = isoDaysAgo(0);
    const ref = fbDB.ref('pod/' + date);
    const onAdd = ref.on('child_added',   s => cb({ kind: 'add',    id: s.key, date, val: s.val() }));
    const onChg = ref.on('child_changed', s => cb({ kind: 'change', id: s.key, date, val: s.val() }));
    const onRm  = ref.on('child_removed', s => cb({ kind: 'remove', id: s.key, date }));
    _active.add({ ref, eventType: 'child_added',   handler: onAdd });
    _active.add({ ref, eventType: 'child_changed', handler: onChg });
    _active.add({ ref, eventType: 'child_removed', handler: onRm  });
    return () => {
      ref.off('child_added',   onAdd);
      ref.off('child_changed', onChg);
      ref.off('child_removed', onRm);
    };
  }

  async function loadPodForDate(date) {
    const snap = await fbDB.ref('pod/' + date).get();
    if (!snap.exists()) return [];
    const out = [];
    snap.forEach(c => out.push({ id: c.key, date, ...c.val() }));
    return out;
  }

  /**
   * Snapshot-fetch POD for the last N days [today, ..., today-(N-1)].
   * Returns array sorted newest-first per date.
   */
  async function loadRecentPod(days = 3) {
    const out = [];
    for (let i = 0; i < days; i++) {
      const iso = isoDaysAgo(i);
      const entries = await loadPodForDate(iso);
      out.push({ date: iso, entries });
    }
    return out;
  }

  /**
   * Subscribe to the last N days of POD data and call cb every time
   * any of those date-buckets gets a new/changed/removed entry.
   * Used by the home view + DPR view.
   */
  function listenPodWindow(days, cb) {
    const offs = [];
    for (let i = 0; i < days; i++) {
      const date = isoDaysAgo(i);
      const ref = fbDB.ref('pod/' + date);
      const fire = (kind, s) => cb({ kind, id: s.key, date, val: kind==='remove'?null:s.val() });
      const onAdd = ref.on('child_added',   s => fire('add', s));
      const onChg = ref.on('child_changed', s => fire('change', s));
      const onRm  = ref.on('child_removed', s => fire('remove', s));
      _active.add({ ref, eventType: 'child_added',   handler: onAdd });
      _active.add({ ref, eventType: 'child_changed', handler: onChg });
      _active.add({ ref, eventType: 'child_removed', handler: onRm  });
      offs.push(() => {
        ref.off('child_added',   onAdd);
        ref.off('child_changed', onChg);
        ref.off('child_removed', onRm);
      });
    }
    return () => offs.forEach(fn => fn());
  }

  // -----------------------------------------------------------
  //  Solar
  // -----------------------------------------------------------
  function listenSolar(itcId, cb) {
    const ref = fbDB.ref('solar/itcs/' + itcId);
    const h = s => cb(s.exists() ? s.val() : null);
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  function listenSolarAll(cb) {
    const ref = fbDB.ref('solar/itcs');
    const h = s => cb(s.exists() ? s.val() : {});
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  //  WTG
  // -----------------------------------------------------------
  function listenWtg(cb) {
    const ref = fbDB.ref('wtg/turbines');
    const onAdd = ref.on('child_added',   s => cb({ kind: 'add',    id: s.key, val: s.val() }));
    const onChg = ref.on('child_changed', s => cb({ kind: 'change', id: s.key, val: s.val() }));
    _active.add({ ref, eventType: 'child_added',   handler: onAdd });
    _active.add({ ref, eventType: 'child_changed', handler: onChg });
    return () => { ref.off('child_added', onAdd); ref.off('child_changed', onChg); };
  }

  // -----------------------------------------------------------
  //  BOP
  // -----------------------------------------------------------
  function listenBop(cb) {
    const ref = fbDB.ref('bop');
    const h = s => cb(s.exists() ? s.val() : {});
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  //  HSE
  // -----------------------------------------------------------
  function listenHse(cb, limit = 50) {
    const ref = fbDB.ref('hse/observations').orderByChild('ts').limitToLast(limit);
    const onAdd = ref.on('child_added',   s => cb({ kind: 'add',    id: s.key, val: s.val() }));
    const onChg = ref.on('child_changed', s => cb({ kind: 'change', id: s.key, val: s.val() }));
    const onRm  = ref.on('child_removed', s => cb({ kind: 'remove', id: s.key }));
    _active.add({ ref, eventType: 'child_added',   handler: onAdd });
    _active.add({ ref, eventType: 'child_changed', handler: onChg });
    _active.add({ ref, eventType: 'child_removed', handler: onRm  });
    return () => {
      ref.off('child_added', onAdd);
      ref.off('child_changed', onChg);
      ref.off('child_removed', onRm);
    };
  }

  global.realtime = {
    listenPodToday, listenPodWindow, loadPodForDate, loadRecentPod,
    listenSolar, listenSolarAll,
    listenWtg, listenBop, listenHse,
    detachAll
  };

})(window);

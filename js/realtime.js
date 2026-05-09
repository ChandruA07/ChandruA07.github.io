'use strict';
// =============================================================
//  realtime.js  —  Firebase listener registration + cleanup.
//
//  Why a separate module: v8 attached one giant `value` listener
//  on /dashboard. That caused every keystroke from any user to
//  re-render every view on every device. Here we:
//
//  - Use child_added / child_changed for collections (cheap).
//  - Use value only for small leaf nodes.
//  - Track every listener so we can detach when navigating away.
//
//  Public surface (window.realtime):
//    listenPodToday(cb)            → unsubscribe()
//    loadPodForDate(date)          → Promise<entries[]>
//    listenSolar(itcId, cb)        → unsubscribe()
//    listenWtg(cb)                 → unsubscribe()
//    listenBop(cb)                 → unsubscribe()
//    listenHse(cb, limit=50)       → unsubscribe()
//    detachAll()                   → drop everything (on logout)
// =============================================================

(function (global) {

  const _active = new Set(); // each entry: { ref, eventType, handler }

  function _track(ref, eventType, handler) {
    _active.add({ ref, eventType, handler });
    return () => {
      try { ref.off(eventType, handler); } catch(e) {}
      for (const e of _active) if (e.ref === ref && e.handler === handler) { _active.delete(e); break; }
    };
  }

  function detachAll() {
    for (const e of _active) {
      try { e.ref.off(e.eventType, e.handler); } catch(_) {}
    }
    _active.clear();
  }

  // -----------------------------------------------------------
  // POD live feed (today)
  // -----------------------------------------------------------
  function listenPodToday(cb) {
    const date = dataApi.todayISO();
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

  // -----------------------------------------------------------
  // Snapshot fetch (for "Yesterday" panels — no listener)
  // -----------------------------------------------------------
  async function loadPodForDate(date) {
    const snap = await fbDB.ref('pod/' + date).get();
    if (!snap.exists()) return [];
    const out = [];
    snap.forEach(c => out.push({ id: c.key, date, ...c.val() }));
    return out;
  }

  /**
   * Returns a Promise<entries[]> covering [today, today-1, …, today-N+1].
   * Used for the home "Recent Updates" panel.
   */
  async function loadRecentPod(days = 3) {
    const out = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = d.getFullYear() + '-' +
        String(d.getMonth()+1).padStart(2,'0') + '-' +
        String(d.getDate()).padStart(2,'0');
      const entries = await loadPodForDate(iso);
      out.push({ date: iso, entries });
    }
    return out;
  }

  // -----------------------------------------------------------
  // Solar — live for ONE ITC at a time (cheaper than all six)
  // -----------------------------------------------------------
  function listenSolar(itcId, cb) {
    const ref = fbDB.ref('solar/itcs/' + itcId);
    const h = s => cb(s.exists() ? s.val() : null);
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  function listenSolarMeta(cb) {
    const ref = fbDB.ref('solar/meta');
    const h = s => cb(s.exists() ? s.val() : null);
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  // WTG — child_changed (one turbine at a time on the wire)
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
  // BOP — small, value listener is OK
  // -----------------------------------------------------------
  function listenBop(cb) {
    const ref = fbDB.ref('bop');
    const h = s => cb(s.exists() ? s.val() : {});
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  // HSE observations — limit by recency to stay tiny on Spark
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

  // -----------------------------------------------------------
  // HSE employees — small collection, value listener works fine
  // -----------------------------------------------------------
  function listenHseEmployees(cb) {
    const ref = fbDB.ref('hse/employees');
    const h = s => {
      console.log('[rt] data received: hse/employees count=' + s.numChildren());
      const out = [];
      s.forEach(c => out.push({ id: c.key, ...c.val() }));
      cb(out);
    };
    ref.on('value', h);
    console.log('[rt] listener attached: hse/employees');
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  // Land — combined value listener for /land (small enough)
  // -----------------------------------------------------------
  function listenLand(cb) {
    const ref = fbDB.ref('land');
    const h = s => {
      console.log('[rt] data received: land');
      cb(s.exists() ? s.val() : null);
    };
    ref.on('value', h);
    console.log('[rt] listener attached: land');
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  // ROW Issues — collection listener (child events)
  // -----------------------------------------------------------
  function listenRowIssues(cb) {
    const ref = fbDB.ref('rowIssues');
    const onAdd = ref.on('child_added',   s => cb({ kind: 'add',    id: s.key, val: s.val() }));
    const onChg = ref.on('child_changed', s => cb({ kind: 'change', id: s.key, val: s.val() }));
    const onRm  = ref.on('child_removed', s => cb({ kind: 'remove', id: s.key }));
    _active.add({ ref, eventType: 'child_added',   handler: onAdd });
    _active.add({ ref, eventType: 'child_changed', handler: onChg });
    _active.add({ ref, eventType: 'child_removed', handler: onRm  });
    return () => {
      ref.off('child_added',   onAdd);
      ref.off('child_changed', onChg);
      ref.off('child_removed', onRm);
    };
  }

  // -----------------------------------------------------------
  // Milestones — collection listener
  // -----------------------------------------------------------
  function listenMilestones(cb) {
    const ref = fbDB.ref('milestones');
    const onAdd = ref.on('child_added',   s => cb({ kind: 'add',    id: s.key, val: s.val() }));
    const onChg = ref.on('child_changed', s => cb({ kind: 'change', id: s.key, val: s.val() }));
    const onRm  = ref.on('child_removed', s => cb({ kind: 'remove', id: s.key }));
    _active.add({ ref, eventType: 'child_added',   handler: onAdd });
    _active.add({ ref, eventType: 'child_changed', handler: onChg });
    _active.add({ ref, eventType: 'child_removed', handler: onRm  });
    return () => {
      ref.off('child_added',   onAdd);
      ref.off('child_changed', onChg);
      ref.off('child_removed', onRm);
    };
  }

  // -----------------------------------------------------------
  // Gantt rows — value listener (small array, written in bulk)
  // -----------------------------------------------------------
  function listenGantt(cb) {
    const ref = fbDB.ref('ganttRows');
    const h = s => cb(s.exists() ? s.val() : null);
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  // Schedule (S-curve) — value listener
  // -----------------------------------------------------------
  function listenSchedule(cb) {
    const ref = fbDB.ref('schedule');
    const h = s => cb(s.exists() ? s.val() : null);
    ref.on('value', h);
    return _track(ref, 'value', h);
  }

  // -----------------------------------------------------------
  // Daily Progress feed — last N entries by ts
  // -----------------------------------------------------------
  function listenDailyProgress(cb, limit = 100) {
    const ref = fbDB.ref('dailyProgress').orderByChild('ts').limitToLast(limit);
    const onAdd = ref.on('child_added',   s => cb({ kind: 'add',    id: s.key, val: s.val() }));
    const onChg = ref.on('child_changed', s => cb({ kind: 'change', id: s.key, val: s.val() }));
    const onRm  = ref.on('child_removed', s => cb({ kind: 'remove', id: s.key }));
    _active.add({ ref, eventType: 'child_added',   handler: onAdd });
    _active.add({ ref, eventType: 'child_changed', handler: onChg });
    _active.add({ ref, eventType: 'child_removed', handler: onRm  });
    return () => {
      ref.off('child_added',   onAdd);
      ref.off('child_changed', onChg);
      ref.off('child_removed', onRm);
    };
  }

  // NOTE: We do NOT auto-detach on logout. The dashboard is public —
  // logged-out visitors must continue to see live data.
  // Renderers / loader.js can call realtime.detachAll() explicitly if they
  // ever need to (e.g. on app teardown).

  global.realtime = {
    listenPodToday, loadPodForDate, loadRecentPod,
    listenSolar, listenSolarMeta,
    listenWtg, listenBop, listenHse, listenHseEmployees,
    listenLand,
    listenRowIssues, listenMilestones,
    listenGantt, listenSchedule, listenDailyProgress,
    detachAll
  };

})(window);

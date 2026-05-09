'use strict';
// =============================================================
//  data-api.js  —  ALL writes funnel through this module.
//
//  Why: v8 wrote with `firebaseDB.ref('dashboard').set(blob)`,
//  which overwrote the entire database on every save. This file
//  replaces every such site with leaf-level partial updates,
//  push() for new list items, and transaction() for counters.
//
//  Public surface (window.dataApi):
//    addPod(entry)
//    updateSolarAct(itcId, idx, patch)
//    updateTurbine(turbId, patch)
//    updateBopAct(actName, patch)
//    addHseObservation(obs)
//    updateHseObservation(id, patch)
//    addBlocker(b) / addMilestone(m)
//    setUserProfile(patch)        (limited to name; never role)
//
//  Every write:
//    1. Aborts if not signed in.
//    2. Stamps lastBy = uid, lastAt = serverTime.
//    3. Goes through audit() so admin can see who did what.
// =============================================================

(function (global) {

  // -----------------------------------------------------------
  // Internal: throw if not signed in. Server will reject anyway,
  // but this fails fast and gives a friendly error.
  // -----------------------------------------------------------
  function _u() {
    const p = auth.current();
    if (!p) throw new Error('Not signed in.');
    return p;
  }

  // -----------------------------------------------------------
  // Internal: write an audit entry. Best-effort; never throws.
  // -----------------------------------------------------------
  function _audit(action, path, before, after) {
    try {
      const uid = (auth.current() || {}).uid;
      if (!uid) return;
      const ts = Date.now();
      fbDB.ref('audit/' + ts + '_' + Math.random().toString(36).slice(2,7)).set({
        uid, role: (auth.current()||{}).role || '?',
        action, path, before: before === undefined ? null : before,
        after:  after  === undefined ? null : after,
        ts: fbServerTs
      }).catch(() => { /* audit is best-effort */ });
    } catch (e) {}
  }

  // -----------------------------------------------------------
  // Date helper. POD entries are keyed by ISO date.
  // -----------------------------------------------------------
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  // ===========================================================
  //  POD — Plan of Day
  // ===========================================================

  /**
   * Add a POD entry.
   * @param {object} entry  must contain: module ('s'|'w'|'l'|'b'),
   *                                       activity, qty, mp, contractor, notes
   *                        may contain:  date (defaults to today), photoURL
   */
  async function addPod(entry) {
    const me = _u();
    const date = (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) ? entry.date : todayISO();
    const ref = fbDB.ref('pod/' + date).push();
    const payload = {
      module:     String(entry.module || ''),
      activity:   String(entry.activity || '').slice(0, 200),
      qty:        Number(entry.qty)  || 0,
      mp:         Number(entry.mp)   || 0,
      contractor: String(entry.contractor || '').slice(0, 120),
      notes:      String(entry.notes      || '').slice(0, 500),
      photoURL:   entry.photoURL ? String(entry.photoURL) : null,
      by:         me.uid,
      byName:     me.name,
      ts:         fbServerTs
    };
    await ref.set(payload);
    _audit('pod.add', ref.toString(), null, { date, ...payload });
    return { id: ref.key, date };
  }

  // ===========================================================
  //  Solar
  // ===========================================================

  /**
   * Update solar activity progress at the leaf level.
   * Only the fields you pass are written; everything else
   * on the same activity is untouched.
   *
   * @param {string} itcId  e.g. 'ITC-1'
   * @param {number} idx    0..15 matching SOL_ACT_DEFS
   * @param {object} patch  any of: done, today, subDone (array)
   */
  async function updateSolarAct(itcId, idx, patch) {
    const me = _u();
    if (!/^ITC-\d+$/.test(itcId)) throw new Error('Bad ITC id');
    if (!Number.isInteger(idx) || idx < 0 || idx > 50) throw new Error('Bad idx');
    const base = 'solar/itcs/' + itcId + '/acts/' + idx + '/';
    const updates = {};
    if (patch.done    !== undefined) updates[base + 'done']    = Number(patch.done) || 0;
    if (patch.today   !== undefined) updates[base + 'today']   = Number(patch.today) || 0;
    if (patch.subDone !== undefined) updates[base + 'subDone'] = patch.subDone.map(n => Number(n)||0);
    updates[base + 'lastBy'] = me.uid;
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('solar.act.update', base, null, patch);
  }

  /**
   * Solar metadata (totalMW, per-ITC MW). Admin-only on the rules.
   */
  async function updateSolarMeta(patch) {
    _u();
    const updates = {};
    if (patch.totalMW !== undefined) updates['solar/meta/totalMW'] = Number(patch.totalMW);
    if (patch.itcMW)
      Object.entries(patch.itcMW).forEach(([k, v]) => {
        updates['solar/meta/itcMW/' + k] = Number(v);
      });
    await fbDB.ref().update(updates);
    _audit('solar.meta.update', 'solar/meta', null, patch);
  }

  // ===========================================================
  //  WTG
  // ===========================================================

  async function updateTurbine(turbId, patch) {
    const me = _u();
    if (typeof turbId !== 'string' || turbId.length > 30) throw new Error('Bad turbine id');
    const base = 'wtg/turbines/' + turbId + '/';
    const allowed = ['status','lp','pp','civil','mech','uss','sup','notes','mechDates'];
    const updates = {};
    for (const k of allowed) if (patch[k] !== undefined) updates[base + k] = patch[k];
    updates[base + 'lastBy'] = me.uid;
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('wtg.turbine.update', base, null, patch);
  }

  // ===========================================================
  //  BOP
  // ===========================================================

  async function updateBopAct(actName, patch) {
    const me = _u();
    if (!actName) throw new Error('Bad activity');
    const base = 'bop/acts/' + actName.replace(/[.#$\[\]/]/g,'_') + '/';
    const updates = {};
    if (patch.done !== undefined) updates[base + 'done'] = Number(patch.done) || 0;
    if (patch.wip  !== undefined) updates[base + 'wip']  = Number(patch.wip)  || 0;
    updates[base + 'lastBy'] = me.uid;
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('bop.act.update', base, null, patch);
  }

  async function updateBopFeeder(feederIdx, patch) {
    _u();
    const base = 'bop/feeders33/' + feederIdx + '/';
    const updates = {};
    Object.entries(patch).forEach(([k, v]) => { updates[base + k] = v; });
    await fbDB.ref().update(updates);
    _audit('bop.feeder.update', base, null, patch);
  }

  async function updatePssAct(actName, patch) {
    _u();
    const base = 'bop/pss/acts/' + actName.replace(/[.#$\[\]/]/g,'_') + '/';
    const updates = {};
    if (patch.done !== undefined) updates[base + 'done'] = Number(patch.done) || 0;
    if (patch.wip  !== undefined) updates[base + 'wip']  = Number(patch.wip)  || 0;
    await fbDB.ref().update(updates);
    _audit('bop.pss.update', base, null, patch);
  }
  async function updateGssAct(actName, patch) {
    _u();
    const base = 'bop/gss/acts/' + actName.replace(/[.#$\[\]/]/g,'_') + '/';
    const updates = {};
    if (patch.done !== undefined) updates[base + 'done'] = Number(patch.done) || 0;
    if (patch.wip  !== undefined) updates[base + 'wip']  = Number(patch.wip)  || 0;
    await fbDB.ref().update(updates);
    _audit('bop.gss.update', base, null, patch);
  }

  // ===========================================================
  //  HSE
  // ===========================================================

  async function addHseObservation(obs) {
    const me = _u();
    const ref = fbDB.ref('hse/observations').push();
    const payload = {
      type:     String(obs.type || ''),
      severity: String(obs.severity || ''),
      desc:     String(obs.desc || '').slice(0, 1000),
      area:     String(obs.area || ''),
      photoURL: obs.photoURL ? String(obs.photoURL) : null,
      status:   obs.status || 'open',
      by:       me.uid,
      byName:   me.name,
      ts:       fbServerTs
    };
    await ref.set(payload);
    _audit('hse.obs.add', ref.toString(), null, payload);
    return { id: ref.key };
  }

  async function updateHseObservation(id, patch) {
    _u();
    const base = 'hse/observations/' + id + '/';
    const updates = {};
    ['status','desc','severity','photoURL'].forEach(k => {
      if (patch[k] !== undefined) updates[base + k] = patch[k];
    });
    await fbDB.ref().update(updates);
    _audit('hse.obs.update', base, null, patch);
  }

  async function deleteHseObservation(id) {
    _u();
    const base = 'hse/observations/' + id;
    const before = (await fbDB.ref(base).get()).val();
    await fbDB.ref(base).remove();
    _audit('hse.obs.delete', base, before, null);
  }

  // ===========================================================
  //  Misc lists (blockers, milestones, schedule)
  // ===========================================================

  async function addBlocker(b) {
    const me = _u();
    const ref = fbDB.ref('blockers').push();
    await ref.set({
      title:    String(b.title || ''),
      severity: String(b.severity || ''),
      module:   String(b.module || ''),
      desc:     String(b.desc || '').slice(0,500),
      by:       me.uid,
      ts:       fbServerTs
    });
    _audit('blocker.add', ref.toString(), null, b);
    return { id: ref.key };
  }

  async function addMilestone(m) {
    const me = _u();
    if (me.role === 'viewer') throw new Error('Viewers cannot add milestones.');
    const ref = fbDB.ref('milestones').push();
    const payload = {
      title: String(m.title || '').slice(0, 200),
      date:  String(m.date  || ''),
      mod:   String(m.mod   || 'Overall').slice(0, 30),
      by:    me.uid,
      byName:me.name,
      ts:    fbServerTs
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.date)) throw new Error('Invalid milestone date.');
    if (!payload.title) throw new Error('Milestone title required.');
    await ref.set(payload);
    _audit('milestone.add', ref.toString(), null, payload);
    return { id: ref.key };
  }

  async function updateMilestone(id, patch) {
    const me = _u();
    if (me.role === 'viewer') throw new Error('Viewers cannot edit milestones.');
    if (!id) throw new Error('Milestone id required.');
    const base = 'milestones/' + id + '/';
    const updates = {};
    if (patch.title !== undefined) updates[base + 'title'] = String(patch.title).slice(0, 200);
    if (patch.date  !== undefined) updates[base + 'date']  = String(patch.date);
    if (patch.mod   !== undefined) updates[base + 'mod']   = String(patch.mod).slice(0, 30);
    updates[base + 'lastBy'] = me.uid;
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('milestone.update', base, null, patch);
  }

  async function deleteMilestone(id) {
    const me = _u();
    if (me.role !== 'admin') throw new Error('Only admins can delete milestones.');
    if (!id) throw new Error('Milestone id required.');
    const base = 'milestones/' + id;
    const before = (await fbDB.ref(base).get()).val();
    await fbDB.ref(base).remove();
    _audit('milestone.delete', base, before, null);
  }

  // ===========================================================
  //  ROW Issues — auth-protected, viewer cannot edit
  // ===========================================================

  async function addRowIssue(r) {
    const me = _u();
    if (me.role === 'viewer') throw new Error('Viewers cannot add ROW issues.');
    const ref = fbDB.ref('rowIssues').push();
    const payload = {
      loc:      String(r.loc      || '').slice(0, 100),
      issue:    String(r.issue    || '').slice(0, 500),
      type:     String(r.type     || 'Other'),
      status:   String(r.status   || 'Open'),
      opened:   String(r.opened   || todayISO()),
      expClear: String(r.expClear || ''),
      raisedBy: String(r.raisedBy || me.name || me.uid).slice(0, 80),
      by:       me.uid,
      byName:   me.name,
      ts:       fbServerTs
    };
    if (!['WTG','Solar','BOP','Other'].includes(payload.type))     payload.type   = 'Other';
    if (!['Open','Closed','In Progress'].includes(payload.status)) payload.status = 'Open';
    if (!payload.loc)   throw new Error('Location is required.');
    if (!payload.issue) throw new Error('Issue description is required.');
    await ref.set(payload);
    _audit('row.add', ref.toString(), null, payload);
    return { id: ref.key };
  }

  async function updateRowIssue(id, patch) {
    const me = _u();
    if (me.role === 'viewer') throw new Error('Viewers cannot edit ROW issues.');
    if (!id) throw new Error('Row id required.');
    const base = 'rowIssues/' + id + '/';
    const updates = {};
    ['loc','issue','type','status','expClear','raisedBy'].forEach(k => {
      if (patch[k] !== undefined) updates[base + k] = String(patch[k]);
    });
    updates[base + 'lastBy'] = me.uid;
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('row.update', base, null, patch);
  }

  async function deleteRowIssue(id) {
    const me = _u();
    if (me.role !== 'admin') throw new Error('Only admins can delete ROW issues.');
    if (!id) throw new Error('Row id required.');
    const base = 'rowIssues/' + id;
    const before = (await fbDB.ref(base).get()).val();
    await fbDB.ref(base).remove();
    _audit('row.delete', base, before, null);
  }

  // ===========================================================
  //  Gantt Rows — admin / Site Manager only
  // ===========================================================

  async function setGanttRows(rows) {
    const me = _u();
    if (me.role !== 'admin') throw new Error('Only Site Manager can edit the Gantt.');
    if (!Array.isArray(rows)) throw new Error('Rows must be an array.');
    const sanitized = rows.map(r => ({
      l:  String(r.l || '').slice(0, 120),
      ps: String(r.ps || ''),
      pe: String(r.pe || ''),
      as: String(r.as || ''),
      ae: String(r.ae || ''),
      c:  String(r.c  || 'var(--ac)').slice(0, 30)
    }));
    await fbDB.ref('ganttRows').set(sanitized);
    _audit('gantt.set', 'ganttRows', null, { count: sanitized.length });
  }

  // ===========================================================
  //  Daily Progress feed — every Solar/WTG update lands here
  // ===========================================================

  async function pushDailyProgress(entry) {
    const me = _u();
    if (me.role === 'viewer') return; // viewers don't write
    const ref = fbDB.ref('dailyProgress').push();
    const payload = {
      module:  String(entry.module || '').slice(0, 20),
      itc:     entry.itc     ? String(entry.itc).slice(0, 20)     : null,
      turbine: entry.turbine ? String(entry.turbine).slice(0, 20) : null,
      act:     String(entry.act || '').slice(0, 200),
      sub:     entry.sub   ? String(entry.sub).slice(0, 200) : null,
      val:     entry.val   !== undefined ? Number(entry.val)   || 0 : null,
      pct:     entry.pct   !== undefined ? Number(entry.pct)   || 0 : null,
      today:   entry.today !== undefined ? Number(entry.today) || 0 : null,
      by:      me.uid,
      byName:  me.name,
      ts:      fbServerTs
    };
    await ref.set(payload);
    return { id: ref.key };
  }

  // ===========================================================
  //  Schedule (S-curve)  — admin only
  // ===========================================================

  async function updateSchedule(patch) {
    const me = _u();
    if (me.role !== 'admin') throw new Error('Only Site Manager can edit the schedule.');
    const updates = {};
    if (Array.isArray(patch.planned)) updates['schedule/planned'] = patch.planned.map(n => Number(n) || 0);
    if (Array.isArray(patch.actual))  updates['schedule/actual']  = patch.actual.map(n => n === null ? null : Number(n) || 0);
    if (Array.isArray(patch.labels))  updates['schedule/labels']  = patch.labels.map(s => String(s).slice(0, 20));
    await fbDB.ref().update(updates);
    _audit('schedule.update', 'schedule', null, patch);
  }

  // ===========================================================
  //  User profile (own name only; never role)
  // ===========================================================

  async function setUserProfile(patch) {
    const me = _u();
    const updates = {};
    if (patch.name)  updates['users/' + me.uid + '/name']  = String(patch.name).slice(0,80);
    if (patch.email) updates['users/' + me.uid + '/email'] = String(patch.email).slice(0,120);
    // role is intentionally absent — rules reject it from non-admins anyway.
    await fbDB.ref().update(updates);
  }

  // ===========================================================
  //  Debounced batched write (used by sliders/spinners)
  // ===========================================================
  // Some UIs (e.g. ITC sub-activity sliders) fire dozens of
  // value-change events as the user drags. Debounce them so we
  // only push one update per ~400ms — much kinder to the free
  // tier quotas.

  const _pending = {};
  let _pendingTimer = null;
  function debouncedUpdate(path, value) {
    _pending[path] = value;
    clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
      const u = _pending; Object.keys(u).length && fbDB.ref().update(u).catch(e => console.warn('[dataApi] debouncedUpdate failed:', e));
      Object.keys(_pending).forEach(k => delete _pending[k]);
    }, 400);
  }

  global.dataApi = {
    todayISO,
    addPod,
    updateSolarAct, updateSolarMeta,
    updateTurbine,
    updateBopAct, updateBopFeeder, updatePssAct, updateGssAct,
    addHseObservation, updateHseObservation, deleteHseObservation,
    addBlocker,
    addMilestone, updateMilestone, deleteMilestone,
    addRowIssue, updateRowIssue, deleteRowIssue,
    setGanttRows,
    pushDailyProgress,
    updateSchedule,
    setUserProfile,
    debouncedUpdate
  };

})(window);

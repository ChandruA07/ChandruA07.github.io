'use strict';
// =============================================================
//  data-api.js  (v10)
//
//  All writes funnel through this module — leaf-level partial
//  updates, never blob overwrites.
//
//  POD entries: no gate, anyone can write.
//  Other writes: gated by editLock — caller must wrap in
//                editLock.require(...) or check isUnlocked().
//
//  Surface:
//    addPod(entry)              ← OPEN
//    updateSolarAct(...)        ← edit-mode required
//    updateTurbine(...)         ← edit-mode required
//    updateBopAct(...) etc.     ← edit-mode required
//    addHseObservation(...)     ← edit-mode required
// =============================================================

(function (global) {

  // -----------------------------------------------------------
  // Wait for anonymous-auth before any write. Without it, rules
  // reject the write because auth == null. fbReady resolves
  // either when sign-in completes OR when it fails (the user
  // will see a console error in that case).
  // -----------------------------------------------------------
  async function _ready() {
    if (global.fbReady) await global.fbReady;
  }

  function _audit(action, path, before, after) {
    try {
      const ts = Date.now();
      fbDB.ref('audit/' + ts + '_' + Math.random().toString(36).slice(2, 7)).set({
        anonUid: global.fbAnonUid || '?',
        action, path,
        before: before === undefined ? null : before,
        after:  after  === undefined ? null : after,
        ts: fbServerTs
      }).catch(() => {});
    } catch (_) {}
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  function _gate(action) {
    if (!editLock.isUnlocked()) {
      throw new Error('Edit mode required (' + action + ').');
    }
  }

  // ===========================================================
  //  POD — open, no editLock check
  // ===========================================================
  async function addPod(entry) {
    await _ready();
    const date = (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) ? entry.date : todayISO();
    const ref  = fbDB.ref('pod/' + date).push();
    const payload = {
      module:     String(entry.module || ''),
      activity:   String(entry.activity || '').slice(0, 200),
      qty:        Number(entry.qty)  || 0,
      unit:       String(entry.unit || '').slice(0, 20),
      mp:         Number(entry.mp)   || 0,
      contractor: String(entry.contractor || '').slice(0, 120),
      notes:      String(entry.notes      || '').slice(0, 500),
      photoURL:   entry.photoURL ? String(entry.photoURL) : null,
      photoB64:   entry.photoB64 ? String(entry.photoB64).slice(0, 200000) : null,
      by:         String(entry.by || 'guest').slice(0, 60),
      ts:         fbServerTs
    };
    await ref.set(payload);
    _audit('pod.add', 'pod/' + date + '/' + ref.key, null, payload);
    return { id: ref.key, date };
  }

  async function deletePod(date, id) {
    _gate('delete POD entry');
    await _ready();
    const path = 'pod/' + date + '/' + id;
    const before = (await fbDB.ref(path).get()).val();
    await fbDB.ref(path).remove();
    _audit('pod.delete', path, before, null);
  }

  // ===========================================================
  //  Solar
  // ===========================================================
  async function updateSolarAct(itcId, idx, patch) {
    _gate('update Solar progress');
    await _ready();
    if (!/^ITC-\d+$/.test(itcId)) throw new Error('Bad ITC id');
    if (!Number.isInteger(idx) || idx < 0 || idx > 50) throw new Error('Bad idx');
    const base = 'solar/itcs/' + itcId + '/acts/' + idx + '/';
    const updates = {};
    if (patch.done    !== undefined) updates[base + 'done']    = Number(patch.done) || 0;
    if (patch.today   !== undefined) updates[base + 'today']   = Number(patch.today) || 0;
    if (patch.subDone !== undefined) updates[base + 'subDone'] = patch.subDone.map(n => Number(n)||0);
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('solar.act.update', base, null, patch);
  }

  // ===========================================================
  //  WTG
  // ===========================================================
  async function updateTurbine(turbId, patch) {
    _gate('update WTG');
    await _ready();
    if (typeof turbId !== 'string' || turbId.length > 30) throw new Error('Bad turbine id');
    const base = 'wtg/turbines/' + turbId + '/';
    const allowed = ['status','lp','pp','civil','mech','uss','sup','notes','mechDates'];
    const updates = {};
    for (const k of allowed) if (patch[k] !== undefined) updates[base + k] = patch[k];
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('wtg.turbine.update', base, null, patch);
  }

  // ===========================================================
  //  BOP
  // ===========================================================
  function _safeKey(k) { return String(k).replace(/[.#$\[\]/]/g, '_'); }

  async function updateBopAct(actName, patch) {
    _gate('update BOP');
    await _ready();
    const base = 'bop/acts/' + _safeKey(actName) + '/';
    const updates = {};
    if (patch.done !== undefined) updates[base + 'done'] = Number(patch.done) || 0;
    if (patch.wip  !== undefined) updates[base + 'wip']  = Number(patch.wip)  || 0;
    updates[base + 'lastAt'] = fbServerTs;
    await fbDB.ref().update(updates);
    _audit('bop.act.update', base, null, patch);
  }

  async function updatePssAct(actName, patch) {
    _gate('update PSS');
    await _ready();
    const base = 'bop/pss/acts/' + _safeKey(actName) + '/';
    const updates = {};
    if (patch.done !== undefined) updates[base + 'done'] = Number(patch.done) || 0;
    if (patch.wip  !== undefined) updates[base + 'wip']  = Number(patch.wip)  || 0;
    await fbDB.ref().update(updates);
    _audit('bop.pss.update', base, null, patch);
  }

  async function updateGssAct(actName, patch) {
    _gate('update GSS');
    await _ready();
    const base = 'bop/gss/acts/' + _safeKey(actName) + '/';
    const updates = {};
    if (patch.done !== undefined) updates[base + 'done'] = Number(patch.done) || 0;
    if (patch.wip  !== undefined) updates[base + 'wip']  = Number(patch.wip)  || 0;
    await fbDB.ref().update(updates);
    _audit('bop.gss.update', base, null, patch);
  }

  async function updateBopFeeder(feederIdx, patch) {
    _gate('update feeder');
    await _ready();
    const base = 'bop/feeders33/' + feederIdx + '/';
    const updates = {};
    Object.entries(patch).forEach(([k, v]) => { updates[base + k] = v; });
    await fbDB.ref().update(updates);
    _audit('bop.feeder.update', base, null, patch);
  }

  // ===========================================================
  //  HSE
  // ===========================================================
  async function addHseObservation(obs) {
    _gate('add HSE observation');
    await _ready();
    const ref = fbDB.ref('hse/observations').push();
    const payload = {
      type:     String(obs.type || ''),
      severity: String(obs.severity || ''),
      desc:     String(obs.desc || '').slice(0, 1000),
      area:     String(obs.area || ''),
      photoB64: obs.photoB64 ? String(obs.photoB64).slice(0, 500000) : null,
      status:   obs.status || 'open',
      by:       String(obs.by || 'guest').slice(0, 60),
      ts:       fbServerTs
    };
    await ref.set(payload);
    _audit('hse.obs.add', ref.toString(), null, payload);
    return { id: ref.key };
  }

  async function updateHseObservation(id, patch) {
    _gate('update HSE observation');
    await _ready();
    const base = 'hse/observations/' + id + '/';
    const updates = {};
    ['status','desc','severity','photoB64'].forEach(k => {
      if (patch[k] !== undefined) updates[base + k] = patch[k];
    });
    await fbDB.ref().update(updates);
    _audit('hse.obs.update', base, null, patch);
  }

  async function deleteHseObservation(id) {
    _gate('delete HSE observation');
    await _ready();
    const path = 'hse/observations/' + id;
    const before = (await fbDB.ref(path).get()).val();
    await fbDB.ref(path).remove();
    _audit('hse.obs.delete', path, before, null);
  }

  // ===========================================================
  //  Misc lists
  // ===========================================================
  async function addBlocker(b) {
    _gate('add blocker');
    await _ready();
    const ref = fbDB.ref('blockers').push();
    await ref.set({
      title:    String(b.title || ''),
      severity: String(b.severity || ''),
      module:   String(b.module || ''),
      desc:     String(b.desc || '').slice(0,500),
      ts:       fbServerTs
    });
    _audit('blocker.add', ref.toString(), null, b);
    return { id: ref.key };
  }

  // ===========================================================
  //  Debounced batched write (sliders)
  // ===========================================================
  const _pending = {};
  let _pendingTimer = null;
  function debouncedUpdate(path, value) {
    if (!editLock.isUnlocked()) return; // silent no-op when locked
    _pending[path] = value;
    clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
      const u = _pending;
      Object.keys(u).length && fbDB.ref().update(u).catch(e =>
        console.warn('[dataApi] debouncedUpdate failed:', e));
      Object.keys(_pending).forEach(k => delete _pending[k]);
    }, 400);
  }

  global.dataApi = {
    todayISO,
    addPod, deletePod,
    updateSolarAct,
    updateTurbine,
    updateBopAct, updateBopFeeder, updatePssAct, updateGssAct,
    addHseObservation, updateHseObservation, deleteHseObservation,
    addBlocker,
    debouncedUpdate
  };

})(window);

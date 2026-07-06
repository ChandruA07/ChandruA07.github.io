'use strict';
// =============================================================
//  data-api.js  (SUPABASE BUILD)  —  ALL writes funnel through here.
//
//  Same public surface as the Firebase build (window.dataApi) so the
//  render layer is untouched. Every function keeps its name, its
//  signature, its validation, and its thrown error messages.
//
//  What changed underneath:
//    fbDB.ref(...).update/push/set   →  window.sb (supabase-js v2)
//    multi-path atomic updates       →  single-row updates or SQL RPCs
//    transaction() on PO total       →  po_add_line_item() RPC (real txn)
//    read-then-write status check    →  po_set_status() RPC (row lock)
//
//  Every write still:
//    1. Applies the same client-side role gate (UX only — RLS is the
//       real boundary after Phase 6).
//    2. Stamps last_by/last_at (columns now, not sibling keys).
//    3. Writes a semantic audit event via the log_audit() RPC, and the
//       database ALSO audits the row change via triggers.
// =============================================================

(function (global) {

  function _sb() {
    if (!global.sb || typeof global.sb.from !== 'function') {
      throw new Error('Supabase client not initialised (js/supabase-init.js).');
    }
    return global.sb;
  }

  // Throw supabase {error} results as real exceptions with readable text.
  function _ok(res, what) {
    if (res && res.error) {
      const m = res.error.message || String(res.error);
      console.warn('[data] ' + (what || 'write') + ' failed:', m);
      throw new Error(m);
    }
    return res ? res.data : undefined;
  }

  function _u() {
    const p = auth.current();
    if (p) return p;
    return { uid: null, name: 'Anonymous', role: 'viewer' };
  }

  // Semantic audit event (best-effort; the DB triggers audit row
  // changes independently, so this can never be the only record).
  function _audit(action, path, before, after) {
    try {
      if (!auth.current()) return;
      _sb().rpc('log_audit', {
        p_action: action, p_path: path,
        p_before: before === undefined ? null : before,
        p_after:  after  === undefined ? null : after
      }).then(r => { if (r.error) console.warn('[audit] rpc failed:', r.error.message); });
    } catch (e) { /* audit is best-effort */ }
  }

  function _notify(module, action, desc) {
    try {
      const me = _u();
      _sb().from('notifications').insert({
        module: String(module || 'general').slice(0, 20),
        action: String(action || '').slice(0, 60),
        descr:  String(desc   || '').slice(0, 300),
        by_name: String(me.name || 'Anonymous').slice(0, 80)
      }).then(r => { if (r.error) console.warn('[notify] failed:', r.error.message); });
    } catch (e) { /* notifications are best-effort */ }
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  const _stamp = () => ({ last_by: (_u().uid || null), last_at: new Date().toISOString() });

  // ===========================================================
  //  POD — Plan of Day
  // ===========================================================
  async function addPod(entry) {
    const me = auth.current();   // may be null — that's fine (pre-Phase-6)
    const date = (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) ? entry.date : todayISO();
    const row = {
      pod_date:   date,
      module:     String(entry.module || ''),
      activity:   String(entry.activity || '').slice(0, 200),
      qty:        Number(entry.qty)  || 0,
      mp:         Number(entry.mp)   || 0,
      resources:  Array.isArray(entry.resources)
                    ? entry.resources.slice(0,30).map(r => ({
                        type: String(r.type||'').slice(0,60),
                        qty:  Number(r.qty) || 0
                      }))
                    : [],
      contractor: String(entry.contractor || '').slice(0, 120),
      notes:      String(entry.notes      || '').slice(0, 500),
      photo_url:  entry.photoURL ? String(entry.photoURL) : null,
      by_name:    String(entry.byName || (me ? me.name : '') || 'Anonymous').slice(0, 80),
      by_uid:     me ? me.uid : null
    };
    console.log('[data] write pod:', date, row.activity, row.by_name);
    const data = _ok(await _sb().from('pod_entries').insert(row).select('id').single(), 'addPod');
    if (me) _audit('pod.add', 'pod_entries/' + data.id, null, { date, ...row });
    _notify({s:'solar',w:'wtg',b:'bop',l:'land'}[row.module] || 'general',
            'POD submitted',
            row.activity + (row.qty ? (' · qty ' + row.qty) : '') + ' — by ' + row.by_name);
    return { id: data.id, date };
  }

  async function addDailyProgress(entry) {
    const me = auth.current();
    const row = {
      module:   String(entry.module   || '').slice(0, 30),
      activity: String(entry.activity || '').slice(0, 200),
      qty:      Number(entry.qty)     || 0,
      unit:     String(entry.unit     || '').slice(0, 20),
      remarks:  String(entry.remarks  || '').slice(0, 500),
      by_name:  me ? me.name : 'Anonymous',
      by_uid:   me ? me.uid : null
    };
    console.log('[data] write dailyProgress:', row.module, row.activity, row.by_name);
    const data = _ok(await _sb().from('daily_progress').insert(row).select('id').single(), 'addDailyProgress');
    if (me) _audit('dailyProgress.add', 'daily_progress/' + data.id, null, row);
    _notify((row.module || 'general').toLowerCase(), 'Progress update',
            row.activity + (row.qty ? (' · ' + row.qty + ' ' + (row.unit||'')) : ''));
    return { id: data.id };
  }

  async function updatePodStatus(date, id, patch) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to update work status.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Bad date');
    if (!id) throw new Error('Bad id');
    const me = _u();
    const upd = {};
    if (patch.status !== undefined) {
      const s = String(patch.status);
      if (!['nys','wip','done'].includes(s)) throw new Error('Bad status');
      upd.status = s;
    }
    if (patch.progress !== undefined) upd.progress = Math.max(0, Number(patch.progress) || 0);
    if (patch.remark   !== undefined) upd.remark   = String(patch.remark || '').slice(0, 500);
    upd.status_by = me.uid; upd.status_by_name = me.name;
    upd.status_at = new Date().toISOString();
    _ok(await _sb().from('pod_entries').update(upd).eq('id', id).eq('pod_date', date), 'updatePodStatus');
    _audit('pod.status', 'pod_entries/' + id, null, patch);
    if (patch.status) {
      const lbl = patch.status === 'done' ? 'Completed' : patch.status === 'wip' ? 'WIP' : 'Not started';
      _notify('general', 'POD status → ' + lbl,
              (patch.progress != null ? ('progress ' + patch.progress + ' · ') : '') + (patch.remark || '') + ' — by ' + me.name);
    }
    if (patch.status && patch.status !== 'nys') {
      try {
        const e = _ok(await _sb().from('pod_entries').select('*').eq('id', id).maybeSingle());
        if (e) {
          const modMap = {s:'Solar',w:'WTG',l:'Land',b:'BOP'};
          const stateLabel = patch.status === 'done' ? 'COMPLETED' : 'WIP';
          await addDailyProgress({
            module:   modMap[e.module] || e.module || '',
            activity: '[' + stateLabel + '] ' + (e.activity || ''),
            qty:      Number(patch.progress != null ? patch.progress : (patch.status === 'done' ? e.qty : 0)) || 0,
            unit:     '',
            remarks:  patch.remark || ('by ' + me.name)
          });
        }
      } catch (_) {}
    }
    return true;
  }

  async function addNextDayPlan(entry) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to set Next Day Plan.');
    const me = _u();
    let forDate = entry.forDate;
    if (!forDate || !/^\d{4}-\d{2}-\d{2}$/.test(forDate)) {
      const d = new Date(); d.setDate(d.getDate() + 1);
      forDate = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    }
    const row = {
      for_date:   forDate,
      module:     String(entry.module || ''),
      activity:   String(entry.activity || '').slice(0, 200),
      qty:        Number(entry.qty) || 0,
      mp:         Number(entry.mp)  || 0,
      contractor: String(entry.contractor || '').slice(0, 120),
      notes:      String(entry.notes || '').slice(0, 500),
      by_uid:     me.uid, by_name: me.name
    };
    const data = _ok(await _sb().from('next_day_plans').insert(row).select('id').single(), 'addNextDayPlan');
    _audit('nextDayPlan.add', 'next_day_plans/' + data.id, null, row);
    return { id: data.id, forDate };
  }

  async function deleteNextDayPlan(forDate, id) {
    if (!auth.canEdit()) throw new Error('🔒 Login required.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(forDate)) throw new Error('Bad date');
    if (!id) throw new Error('Bad id');
    _ok(await _sb().from('next_day_plans').delete().eq('id', id).eq('for_date', forDate), 'deleteNextDayPlan');
    _audit('nextDayPlan.del', 'next_day_plans/' + id, null, null);
    return true;
  }

  // ===========================================================
  //  SOLAR
  // ===========================================================
  async function updateItcLiveActivities(itcId, patch) {
    if (!auth.canEdit()) throw new Error('🔒 Login required.');
    if (!/^ITC-\d+$/.test(itcId)) throw new Error('Bad ITC id');
    const livePatch = {};
    if (patch.activities !== undefined) {
      const arr = Array.isArray(patch.activities) ? patch.activities : [];
      livePatch.activities = arr.map(s => String(s || '').slice(0, 200)).filter(Boolean);
    }
    if (patch.noWorkReason !== undefined) {
      livePatch.noWorkReason = String(patch.noWorkReason || '').slice(0, 300);
    }
    const me = _u();
    livePatch.lastBy = me.uid; livePatch.lastByName = me.name; livePatch.lastAt = Date.now();
    _ok(await _sb().rpc('merge_itc_live', { p_id: itcId, p_patch: livePatch }), 'updateItcLiveActivities');
    _audit('itc.live.update', 'solar_itcs/' + itcId + '/live', null, patch);
    return true;
  }

  async function updateSolarAct(itcId, idx, patch) {
    const me = _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!/^ITC-\d+$/.test(itcId)) throw new Error('Bad ITC id');
    if (!Number.isInteger(idx) || idx < 0 || idx > 50) throw new Error('Bad idx');
    const row = { itc_id: itcId, idx, ..._stamp() };
    if (patch.done    !== undefined) row.done     = Number(patch.done) || 0;
    if (patch.today   !== undefined) row.today    = Number(patch.today) || 0;
    if (patch.subDone !== undefined) row.sub_done = patch.subDone.map(n => Number(n)||0);
    if (patch.subScope!== undefined) row.sub_scope= Number(patch.subScope) || 0;
    _ok(await _sb().from('solar_activities')
          .upsert(row, { onConflict: 'itc_id,idx' }), 'updateSolarAct');
    _audit('solar.act.update', 'solar_activities/' + itcId + '/' + idx, null, patch);
    _notify('solar', 'Progress update', itcId + ' · activity #' + (idx+1) +
            (patch.done !== undefined ? (' → ' + patch.done + '%') : ''));
  }

  async function updateSolarMeta(patch) {
    _u();
    const p = {};
    if (patch.totalMW !== undefined) p.totalMW = Number(patch.totalMW);
    if (patch.itcMW) {
      // nested merge: read-free via two-level jsonb — itcMW is merged whole,
      // matching how the UI always sends the full map for changed ITCs.
      p.itcMW = {};
      Object.entries(patch.itcMW).forEach(([k, v]) => { p.itcMW[k] = Number(v); });
    }
    _ok(await _sb().rpc('merge_module_state', { p_key: 'solar/meta', p_patch: p }), 'updateSolarMeta');
    _audit('solar.meta.update', 'module_state/solar/meta', null, patch);
  }

  async function setSolarItc(itcId, itc) {
    if (!auth.canEdit('solar')) throw new Error('🔒 Solar login required.');
    itc = itc || {};
    const acts = itc.acts;
    const rest = {};
    Object.keys(itc).forEach(k => { if (k !== 'acts') rest[k] = itc[k]; });
    _ok(await _sb().rpc('set_doc', { p_table: 'solar_itcs', p_id: itcId, p_value: rest }), 'setSolarItc');
    if (acts) {
      const rows = [];
      const items = Array.isArray(acts) ? acts.map((a,i)=>[i,a]) : Object.entries(acts);
      for (const [i, a] of items) {
        if (!a) continue;
        rows.push({
          itc_id: itcId, idx: Number(i),
          done: Number(a.done)||0, today: Number(a.today)||0,
          sub_scope: a.subScope != null ? Number(a.subScope) : null,
          sub_done: a.subDone != null ? a.subDone : null,
          ..._stamp()
        });
      }
      if (rows.length) _ok(await _sb().from('solar_activities').upsert(rows, { onConflict: 'itc_id,idx' }), 'setSolarItc.acts');
    }
    _audit('solar.itc.set', 'solar_itcs/' + itcId, null, {
      mw: (itc && itc.mw) || 0, hasActs: !!(itc && itc.solActs)
    });
  }

  async function setSolarCustomActs(customActs) {
    if (!auth.canEdit('solar')) throw new Error('🔒 Solar login required.');
    _ok(await _sb().rpc('set_module_state', { p_key: 'solar/customActs', p_value: customActs || {} }), 'setSolarCustomActs');
    _audit('solar.customActs.set', 'module_state/solar/customActs', null, {
      pre: (customActs && customActs.pre || []).length,
      install: (customActs && customActs.install || []).length,
      post: (customActs && customActs.post || []).length
    });
  }

  // used by render-solar.js (was a direct fbDB write)
  async function setSolarActSubScope(itcId, idx, scope) {
    if (!auth.canEdit('solar')) throw new Error('🔒 Solar login required.');
    _ok(await _sb().from('solar_activities')
          .upsert({ itc_id: itcId, idx: Number(idx), sub_scope: Number(scope) || 0, ..._stamp() },
                  { onConflict: 'itc_id,idx' }), 'setSolarActSubScope');
    _audit('solar.act.subScope', 'solar_activities/' + itcId + '/' + idx, null, { subScope: scope });
  }

  // used by render-solar.js photo-map upload (was a direct fbDB write)
  async function setItcMap(itcId, url) {
    if (!/^ITC-\d+$/.test(itcId)) throw new Error('Bad ITC id');
    _ok(await _sb().rpc('merge_module_state', {
      p_key: 'solar/itcMaps', p_patch: { [itcId]: String(url || '') }
    }), 'setItcMap');
    _audit('solar.itcMap.set', 'module_state/solar/itcMaps/' + itcId, null, { url });
  }

  // ===========================================================
  //  WTG
  // ===========================================================
  const TURBINE_KEYS = ['status','lp','pp','civil','mech','uss','sup','notes','mechDates','acts','siteIssues','pathways','vendor','mw','localActs','localExtraSubs','iconColor'];

  async function updateTurbine(turbId, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (typeof turbId !== 'string' || turbId.length > 30) throw new Error('Bad turbine id');
    const p = {};
    for (const k of TURBINE_KEYS) if (patch[k] !== undefined) p[k] = patch[k];
    console.log('[data] write wtg:', turbId, patch);
    _ok(await _sb().rpc('merge_doc', { p_table: 'wtg_turbines', p_id: turbId, p_patch: p }), 'updateTurbine');
    _audit('wtg.turbine.update', 'wtg_turbines/' + turbId, null, patch);
    _notify('wtg', 'Progress update', turbId + ' updated' +
            (patch.civil !== undefined ? ' · civil ' + patch.civil + '%' : '') +
            (patch.mech  !== undefined ? ' · mech '  + patch.mech  + '%' : ''));
  }

  // used by render-wtg.js full-object saves (was fbDB.ref(...).set(t))
  async function setTurbine(turbId, t) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (typeof turbId !== 'string' || !turbId) throw new Error('Bad turbine id');
    const doc = {};
    Object.keys(t || {}).forEach(k => { if (k !== 'id') doc[k] = t[k]; });
    _ok(await _sb().rpc('set_doc', { p_table: 'wtg_turbines', p_id: turbId, p_value: doc }), 'setTurbine');
    _audit('wtg.turbine.set', 'wtg_turbines/' + turbId, null, { id: turbId });
  }

  async function setZeroPoint(zp) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit Zero Point.');
    _ok(await _sb().rpc('set_module_state', { p_key: 'wtg/zeroPoint', p_value: zp || {} }), 'setZeroPoint');
    _audit('wtg.zeroPoint.set', 'module_state/wtg/zeroPoint', null, { matCount: (zp && zp.materials || []).length });
  }

  async function setWtgCustomActs(customActs) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit activity tree.');
    _ok(await _sb().rpc('set_module_state', { p_key: 'wtg/customActs', p_value: customActs || {} }), 'setWtgCustomActs');
    _audit('wtg.customActs.set', 'module_state/wtg/customActs', null, {
      pre: (customActs && customActs.pre || []).length,
      erection: (customActs && customActs.erection || []).length,
      post: (customActs && customActs.post || []).length
    });
  }

  async function setWtgKpiOverrides(ov) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit KPI values.');
    _ok(await _sb().rpc('set_module_state', { p_key: 'wtg/kpiOverrides', p_value: ov || {} }), 'setWtgKpiOverrides');
    _audit('wtg.kpiOverrides.set', 'module_state/wtg/kpiOverrides', null, ov || {});
  }

  // ===========================================================
  //  BOP — all four sub-sections
  // ===========================================================
  function _safeKey(s) { return String(s).replace(/[.#$\[\]\/]/g, '_'); }

  async function updateBopAct(actName, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!actName) throw new Error('Bad activity');
    if (patch && patch.feeder !== undefined && Array.isArray(patch.arr)) {
      const safeFeeder = _safeKey(patch.feeder);
      const arr = patch.arr.map(v => Number(v) || 0);
      console.log('[data] write bop 33kV feeder:', patch.feeder, arr);
      _ok(await _sb().rpc('merge_bop', {
        p_kind: 'activity', p_section: '33kv', p_key: safeFeeder,
        p_value: arr, p_mode: 'replace'
      }), 'updateBopAct');
      _notify('bop', 'Progress update', actName + ' updated');
      _audit('bop.act.update', 'bop_activities/33kv/' + safeFeeder, null, patch);
      pushDailyProgress({ module:'BOP', act:'33kV · ' + patch.feeder,
                          pct: Number(patch.done) || 0 }).catch(()=>{});
      return;
    }
    const key = _safeKey(actName);
    const p = {};
    if (patch.done !== undefined) p.done = Number(patch.done) || 0;
    if (patch.wip  !== undefined) p.wip  = Number(patch.wip)  || 0;
    console.log('[data] write bop act:', actName, patch);
    _ok(await _sb().rpc('merge_bop', {
      p_kind: 'activity', p_section: '33kv', p_key: key, p_value: p, p_mode: 'merge'
    }), 'updateBopAct');
    _notify('bop', 'Progress update', actName + ' updated');
    _audit('bop.act.update', 'bop_activities/33kv/' + key, null, patch);
    pushDailyProgress({ module:'BOP', act:'33kV · ' + actName, pct: Number(patch.done) || 0 }).catch(()=>{});
  }

  async function updateBop33Line(feederId, line) {
    const me = _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!feederId) throw new Error('Bad feederId');
    const safeFeeder = _safeKey(feederId);
    const poleTotal = Math.max(0, Number(line && line.poleTotal) || 0);
    const poleDone  = Math.max(0, Number(line && line.poleDone)  || 0);
    const spanTotal = Math.max(0, Number(line && line.spanTotal) || 0);
    const spanDone  = Math.max(0, Number(line && line.spanDone)  || 0);
    _ok(await _sb().rpc('merge_bop', {
      p_kind: 'asset', p_section: 'lines33', p_key: safeFeeder,
      p_value: { line: String((line && line.line) || 'SPSC'),
                 poleTotal, poleDone, spanTotal, spanDone },
      p_mode: 'merge'
    }), 'updateBop33Line');
    _ok(await _sb().rpc('merge_bop', {
      p_kind: 'asset', p_section: 'poles33', p_key: safeFeeder,
      p_value: { total: poleTotal, done: poleDone }, p_mode: 'merge'
    }), 'updateBop33Line.poles');
    _audit('bop.lines33.update', 'bop_assets/lines33/' + safeFeeder, null, { poleTotal, poleDone, spanTotal, spanDone });
    _notify('bop', 'Progress update',
            feederId + ' · poles ' + poleDone + '/' + poleTotal + ' · spans ' + spanDone + '/' + spanTotal);
    pushDailyProgress({ module:'BOP', act:'33kV ' + feederId,
                        pct: poleTotal>0 ? Math.round(poleDone/poleTotal*100) : 0 }).catch(()=>{});
  }

  async function updateBop33Poles(feederId, poles) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!feederId) throw new Error('Bad feederId');
    const safeFeeder = _safeKey(feederId);
    const total = Math.max(0, Number(poles && poles.total) || 0);
    const done  = Math.max(0, Number(poles && poles.done)  || 0);
    _ok(await _sb().rpc('merge_bop', {
      p_kind: 'asset', p_section: 'poles33', p_key: safeFeeder,
      p_value: { total, done }, p_mode: 'merge'
    }), 'updateBop33Poles');
    _audit('bop.poles33.update', 'bop_assets/poles33/' + safeFeeder, null, { total, done });
    pushDailyProgress({ module:'BOP', act:'33kV Poles · ' + feederId,
                        pct: total>0 ? Math.round(done/total*100) : 0 }).catch(()=>{});
  }

  async function updateBopFeeder(feederIdx, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    console.log('[data] write bop feeder33:', feederIdx, patch);
    _ok(await _sb().rpc('merge_bop', {
      p_kind: 'asset', p_section: 'feeders33', p_key: String(feederIdx),
      p_value: patch || {}, p_mode: 'merge'
    }), 'updateBopFeeder');
    _audit('bop.feeder.update', 'bop_assets/feeders33/' + feederIdx, null, patch);
    pushDailyProgress({ module:'BOP', turbine:'33kV-FDR-' + feederIdx, act:'Feeder update' }).catch(()=>{});
  }

  async function updateBop66Act(feederId, actIdx, value) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!feederId) throw new Error('Bad feederId');
    const safeFeeder = _safeKey(feederId);
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    console.log('[data] write bop 66kV:', feederId, actIdx, v);
    _ok(await _sb().rpc('set_bop66_act', { p_key: safeFeeder, p_idx: Number(actIdx), p_val: v }), 'updateBop66Act');
    _audit('bop.66kv.update', 'bop_activities/66kv/' + safeFeeder + '/' + actIdx, null, { value: v });
    let actName = 'Activity ' + actIdx;
    try {
      if (typeof DB !== 'undefined' && DB.bopActDefs && DB.bopActDefs['66kv'] && DB.bopActDefs['66kv'][actIdx]) {
        actName = DB.bopActDefs['66kv'][actIdx].n || actName;
      }
    } catch (e) {}
    pushDailyProgress({ module:'BOP', turbine: feederId, act: '66kV · ' + actName, pct: v }).catch(()=>{});
  }

  async function _updatePssGss(section, actName, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    const key = _safeKey(actName);
    const p = {};
    if (patch.done !== undefined) p.done  = Number(patch.done) || 0;
    if (patch.wip  !== undefined) p.wip   = Number(patch.wip)  || 0;
    if (patch.scope!== undefined) p.scope = Number(patch.scope)|| 0;
    _ok(await _sb().rpc('merge_bop', {
      p_kind: 'activity', p_section: section, p_key: key, p_value: p, p_mode: 'merge'
    }), 'update' + section);
    _audit('bop.' + section + '.update', 'bop_activities/' + section + '/' + key, null, patch);
    pushDailyProgress({ module: section.toUpperCase(), act: actName, pct: Number(patch.done) || 0 }).catch(()=>{});
  }
  const updatePssAct = (actName, patch) => _updatePssGss('pss', actName, patch);
  const updateGssAct = (actName, patch) => _updatePssGss('gss', actName, patch);

  // ===========================================================
  //  LAND
  // ===========================================================
  async function updateWtgLand(locId, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!locId) throw new Error('locId required');
    console.log('[data] write land/wtgLocs:', locId, patch);
    _ok(await _sb().rpc('merge_doc', {
      p_table: 'land_wtg_locs', p_id: _safeKey(locId), p_patch: patch || {}
    }), 'updateWtgLand');
    _audit('land.wtg.update', 'land_wtg_locs/' + locId, null, patch);
  }

  // used by render-land.js (was fbDB.ref('land/wtgLocs/..').remove())
  async function deleteWtgLandLoc(locId) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!locId) throw new Error('locId required');
    _ok(await _sb().from('land_wtg_locs').delete().eq('id', _safeKey(locId)), 'deleteWtgLandLoc');
    _audit('land.wtg.delete', 'land_wtg_locs/' + locId, null, null);
  }

  async function updateSolLand(blockId, actIdx, value) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!blockId) throw new Error('blockId required');
    const v = Math.max(0, Math.min(100, Number(value) || 0));
    console.log('[data] write land/solBlocks:', blockId, actIdx, v);
    _ok(await _sb().rpc('set_sol_block_act', {
      p_id: _safeKey(blockId), p_idx: Number(actIdx), p_val: v
    }), 'updateSolLand');
    _audit('land.sol.update', 'land_sol_blocks/' + blockId + '/acts/' + actIdx, null, { value: v });
  }

  async function addLandParcel(parcel) {
    const me = _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    const row = {
      module: String(parcel.module || ''),
      name:   String(parcel.name   || '').slice(0, 100),
      lat:    Number(parcel.lat) || 0,
      lng:    Number(parcel.lng) || 0,
      area:   Number(parcel.area) || 0,
      notes:  String(parcel.notes || '').slice(0, 500),
      by_uid: me.uid, by_name: me.name
    };
    console.log('[data] write land/parcels add:', row.name);
    const data = _ok(await _sb().from('land_parcels').insert(row).select('id').single(), 'addLandParcel');
    _audit('land.parcel.add', 'land_parcels/' + data.id, null, row);
    return { id: data.id };
  }

  async function updateLandParcel(id, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!id) throw new Error('parcel id required');
    const upd = { ..._stamp() };
    ['module','name','lat','lng','area','notes'].forEach(k => {
      if (patch[k] !== undefined) upd[k] = patch[k];
    });
    console.log('[data] write land/parcels update:', id);
    _ok(await _sb().from('land_parcels').update(upd).eq('id', id), 'updateLandParcel');
    _audit('land.parcel.update', 'land_parcels/' + id, null, patch);
  }

  async function addSolLease(blockId, lease) {
    const me = _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!blockId) throw new Error('blockId required');
    const safeId = _safeKey(blockId);
    // ensure the block row exists (FK target) without touching its data
    _ok(await _sb().from('land_sol_blocks')
          .upsert({ id: safeId }, { onConflict: 'id', ignoreDuplicates: true }), 'addSolLease.ensure');
    const row = {
      block_id: safeId,
      own: String(lease.own || '').slice(0, 100),
      svy: String(lease.svy || '').slice(0, 60),
      dur: String(lease.dur || '').slice(0, 30),
      ls:  String(lease.ls  || 'Pending').slice(0, 30),
      doc: String(lease.doc || 'Pending').slice(0, 30),
      reg: String(lease.reg || 'Pending').slice(0, 30),
      rem: String(lease.rem || '').slice(0, 300),
      by_uid: me.uid, by_name: me.name
    };
    console.log('[data] write land lease add:', blockId, row.svy);
    const data = _ok(await _sb().from('land_leases').insert(row).select('id').single(), 'addSolLease');
    _audit('land.lease.add', 'land_leases/' + data.id, null, row);
    _notify('land', 'Lease added', blockId + ' · ' + row.svy + ' (' + row.own + ')');
    return { id: data.id };
  }

  async function removeSolLease(blockId, leaseId) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!blockId || !leaseId) throw new Error('blockId and leaseId required');
    const before = _ok(await _sb().from('land_leases').select('*').eq('id', leaseId).maybeSingle());
    console.log('[data] delete land lease:', blockId, leaseId);
    _ok(await _sb().from('land_leases').delete().eq('id', leaseId), 'removeSolLease');
    _audit('land.lease.delete', 'land_leases/' + leaseId, before, null);
  }

  // ===========================================================
  //  HSE
  // ===========================================================
  async function addHseObservation(obs) {
    const me = _u();
    const row = {
      type:        String(obs.type || ''),
      severity:    String(obs.severity || ''),
      description: String(obs.desc || '').slice(0, 1000),
      area:        String(obs.area || ''),
      photo_url:   obs.photoURL ? String(obs.photoURL) : null,
      status:      obs.status || 'open',
      by_uid:      me.uid, by_name: me.name
    };
    const data = _ok(await _sb().from('hse_observations').insert(row).select('id').single(), 'addHseObservation');
    _audit('hse.obs.add', 'hse_observations/' + data.id, null, row);
    _notify('hse', 'HSE observation logged',
            (row.severity ? row.severity + ' · ' : '') + (row.description || '').slice(0, 120));
    return { id: data.id };
  }

  const HSE_COL = { desc: 'description', photoURL: 'photo_url', closedBy: 'closed_by' };
  async function updateHseObservation(id, patch) {
    _u();
    const upd = {};
    ['status','desc','obs','severity','photoURL','closedBy','loc','vendor','action'].forEach(k => {
      if (patch[k] !== undefined) upd[HSE_COL[k] || k] = patch[k];
    });
    // legacy ids ('-hse_obs_001') vs uuids — match either column
    const isLegacy = !/^[0-9a-f-]{36}$/i.test(String(id));
    _ok(await _sb().from('hse_observations').update(upd)
          .eq(isLegacy ? 'legacy_id' : 'id', id), 'updateHseObservation');
    _audit('hse.obs.update', 'hse_observations/' + id, null, patch);
    if (patch.status) _notify('hse', 'HSE observation ' + String(patch.status).toLowerCase(), 'Observation marked ' + patch.status);
  }

  async function deleteHseObservation(id) {
    _u();
    const isLegacy = !/^[0-9a-f-]{36}$/i.test(String(id));
    const col = isLegacy ? 'legacy_id' : 'id';
    const before = _ok(await _sb().from('hse_observations').select('*').eq(col, id).maybeSingle());
    console.log('[data] delete hse obs:', id);
    _ok(await _sb().from('hse_observations').delete().eq(col, id), 'deleteHseObservation');
    _audit('hse.obs.delete', 'hse_observations/' + id, before, null);
  }

  async function addHseEmployee(emp) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    const row = {
      name:  String(emp.name || '').slice(0, 80),
      code:  String(emp.code || '').slice(0, 30),
      score: Math.max(0, Math.min(100, Number(emp.score) || 0))
    };
    console.log('[data] write hse employee add:', row.code, row.name);
    const data = _ok(await _sb().from('hse_employees').insert(row).select('id').single(), 'addHseEmployee');
    _audit('hse.emp.add', 'hse_employees/' + data.id, null, row);
    return { id: data.id };
  }

  async function updateHseEmployee(id, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!id) throw new Error('Employee id required');
    const upd = {};
    if (patch.name  !== undefined) upd.name  = String(patch.name).slice(0, 80);
    if (patch.code  !== undefined) upd.code  = String(patch.code).slice(0, 30);
    if (patch.score !== undefined) upd.score = Math.max(0, Math.min(100, Number(patch.score) || 0));
    const isLegacy = !/^[0-9a-f-]{36}$/i.test(String(id));
    console.log('[data] write hse employee update:', id, patch);
    _ok(await _sb().from('hse_employees').update(upd).eq(isLegacy ? 'legacy_id' : 'id', id), 'updateHseEmployee');
    _audit('hse.emp.update', 'hse_employees/' + id, null, patch);
  }

  async function deleteHseEmployee(id) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!id) throw new Error('Employee id required');
    const isLegacy = !/^[0-9a-f-]{36}$/i.test(String(id));
    const col = isLegacy ? 'legacy_id' : 'id';
    const before = _ok(await _sb().from('hse_employees').select('*').eq(col, id).maybeSingle());
    console.log('[data] delete hse employee:', id);
    _ok(await _sb().from('hse_employees').delete().eq(col, id), 'deleteHseEmployee');
    _audit('hse.emp.delete', 'hse_employees/' + id, before, null);
  }

  // ===========================================================
  //  LISTS — blockers / milestones / ROW issues
  // ===========================================================
  async function addBlocker(b) {
    const me = _u();
    const row = {
      title:    String(b.title || ''),
      severity: String(b.severity || ''),
      module:   String(b.module || ''),
      description: String(b.desc || '').slice(0,500),
      by_uid:   me.uid
    };
    const data = _ok(await _sb().from('blockers').insert(row).select('id').single(), 'addBlocker');
    _audit('blocker.add', 'blockers/' + data.id, null, b);
    _notify((b.module || 'general').toLowerCase(), 'Blocker raised',
            (b.severity ? b.severity + ' · ' : '') + (b.title || '') + (b.desc ? ' — ' + b.desc : ''));
    return { id: data.id };
  }

  async function addMilestone(m) {
    const me = _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    const row = {
      title: String(m.title || '').slice(0, 200),
      mdate: String(m.date  || ''),
      mod:   String(m.mod   || 'Overall').slice(0, 30),
      by_uid: me.uid, by_name: me.name
    };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.mdate)) throw new Error('Invalid milestone date.');
    if (!row.title) throw new Error('Milestone title required.');
    const data = _ok(await _sb().from('milestones').insert(row).select('id').single(), 'addMilestone');
    _audit('milestone.add', 'milestones/' + data.id, null, row);
    return { id: data.id };
  }

  function _legacyCol(id) { return /^[0-9a-f-]{36}$/i.test(String(id)) ? 'id' : 'legacy_id'; }

  async function updateMilestone(id, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!id) throw new Error('Milestone id required.');
    const upd = { ..._stamp() };
    if (patch.title !== undefined) upd.title = String(patch.title).slice(0, 200);
    if (patch.date  !== undefined) upd.mdate = String(patch.date);
    if (patch.mod   !== undefined) upd.mod   = String(patch.mod).slice(0, 30);
    _ok(await _sb().from('milestones').update(upd).eq(_legacyCol(id), id), 'updateMilestone');
    _audit('milestone.update', 'milestones/' + id, null, patch);
  }

  async function deleteMilestone(id) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!id) throw new Error('Milestone id required.');
    const before = _ok(await _sb().from('milestones').select('*').eq(_legacyCol(id), id).maybeSingle());
    _ok(await _sb().from('milestones').delete().eq(_legacyCol(id), id), 'deleteMilestone');
    _audit('milestone.delete', 'milestones/' + id, before, null);
  }

  async function addRowIssue(r) {
    const me = _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    const row = {
      loc:      String(r.loc      || '').slice(0, 100),
      issue:    String(r.issue    || '').slice(0, 500),
      type:     String(r.type     || 'Other'),
      status:   String(r.status   || 'Open'),
      opened:   String(r.opened   || todayISO()),
      exp_clear: String(r.expClear || ''),
      raised_by: String(r.raisedBy || me.name || me.uid).slice(0, 80),
      by_uid:   me.uid, by_name: me.name
    };
    if (!['WTG','Solar','BOP','Other'].includes(row.type))     row.type   = 'Other';
    if (!['Open','Closed','In Progress'].includes(row.status)) row.status = 'Open';
    if (!row.loc)   throw new Error('Location is required.');
    if (!row.issue) throw new Error('Issue description is required.');
    const data = _ok(await _sb().from('row_issues').insert(row).select('id').single(), 'addRowIssue');
    _audit('row.add', 'row_issues/' + data.id, null, row);
    _notify(row.type === 'Solar' ? 'solar' : row.type === 'WTG' ? 'wtg' : row.type === 'BOP' ? 'bop' : 'general',
            'ROW issue raised', row.loc + ' — ' + row.issue);
    return { id: data.id };
  }

  async function updateRowIssue(id, patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!id) throw new Error('Row id required.');
    const MAP = { expClear: 'exp_clear', raisedBy: 'raised_by' };
    const upd = { ..._stamp() };
    ['loc','issue','type','status','expClear','raisedBy'].forEach(k => {
      if (patch[k] !== undefined) upd[MAP[k] || k] = String(patch[k]);
    });
    _ok(await _sb().from('row_issues').update(upd).eq(_legacyCol(id), id), 'updateRowIssue');
    _audit('row.update', 'row_issues/' + id, null, patch);
  }

  async function deleteRowIssue(id) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!id) throw new Error('Row id required.');
    const before = _ok(await _sb().from('row_issues').select('*').eq(_legacyCol(id), id).maybeSingle());
    _ok(await _sb().from('row_issues').delete().eq(_legacyCol(id), id), 'deleteRowIssue');
    _audit('row.delete', 'row_issues/' + id, before, null);
  }

  // ===========================================================
  //  SINGLETON CONFIG — gantt / schedule / profile / debounced meta
  // ===========================================================
  async function setGanttRows(rows) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    if (!Array.isArray(rows)) throw new Error('Rows must be an array.');
    const sanitized = rows.map(r => ({
      l:  String(r.l || '').slice(0, 120),
      ps: String(r.ps || ''), pe: String(r.pe || ''),
      as: String(r.as || ''), ae: String(r.ae || ''),
      c:  String(r.c  || 'var(--ac)').slice(0, 30)
    }));
    _ok(await _sb().rpc('set_module_state', { p_key: 'ganttRows', p_value: sanitized }), 'setGanttRows');
    _audit('gantt.set', 'module_state/ganttRows', null, { count: sanitized.length });
  }

  async function updateSchedule(patch) {
    _u();
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit (use the section credentials, or Site Manager).');
    const p = {};
    if (Array.isArray(patch.planned)) p.planned = patch.planned.map(n => Number(n) || 0);
    if (Array.isArray(patch.actual))  p.actual  = patch.actual.map(n => n === null ? null : Number(n) || 0);
    if (Array.isArray(patch.labels))  p.labels  = patch.labels.map(s => String(s).slice(0, 20));
    _ok(await _sb().rpc('merge_module_state', { p_key: 'schedule', p_patch: p }), 'updateSchedule');
    _audit('schedule.update', 'module_state/schedule', null, patch);
  }

  async function setUserProfile(patch) {
    const me = _u();
    if (!me.uid) return;
    const upd = {};
    if (patch.name)  upd.name  = String(patch.name).slice(0,80);
    if (patch.email) upd.email = String(patch.email).slice(0,120);
    if (!Object.keys(upd).length) return;
    _ok(await _sb().from('users').update(upd).eq('id', me.uid), 'setUserProfile');
  }

  // debouncedUpdate(path, value): only ever called with module_state
  // meta paths ('wtg/meta/totalMW', 'bop/meta/km66'). Batched per key
  // and flushed through the atomic merge RPC.
  const _pending = {};
  let _pendingTimer = null;
  function debouncedUpdate(path, value) {
    const parts = String(path).split('/');
    if (parts.length < 3) { console.warn('[dataApi] debouncedUpdate: unsupported path', path); return; }
    const key = parts[0] + '/' + parts[1];           // e.g. 'wtg/meta'
    const field = parts.slice(2).join('/');
    (_pending[key] = _pending[key] || {})[field] = value;
    clearTimeout(_pendingTimer);
    _pendingTimer = setTimeout(() => {
      Object.entries(_pending).forEach(([k, patch]) => {
        _sb().rpc('merge_module_state', { p_key: k, p_patch: patch })
          .then(r => { if (r.error) console.warn('[dataApi] debouncedUpdate failed:', r.error.message); });
        delete _pending[k];
      });
    }, 400);
  }

  // used by js/notify.js (was a direct fbDB readBy write)
  function markNotificationRead(id) {
    return _sb().rpc('notification_mark_read', { p_id: id })
      .then(r => { if (r.error) console.warn('[notify] mark-read failed:', r.error.message); });
  }

  // ===========================================================
  //  DAILY PROGRESS (rich) + progress-date back-dating
  // ===========================================================
  let _sessionProgressDate = null;
  function setProgressDate(iso){
    _sessionProgressDate = (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) ? iso : null;
  }

  async function pushDailyProgress(entry) {
    if (!entry.date && _sessionProgressDate) entry = Object.assign({}, entry, { date: _sessionProgressDate });
    const me = auth.current();
    const customDate = (entry.date && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)) ? entry.date : null;
    const row = {
      module:  String(entry.module || '').slice(0, 20),
      itc:     entry.itc     ? String(entry.itc).slice(0, 20)     : null,
      turbine: entry.turbine ? String(entry.turbine).slice(0, 20) : null,
      activity: String(entry.act || entry.activity || '').slice(0, 200),
      sub:     entry.sub   ? String(entry.sub).slice(0, 200) : null,
      val:     entry.val   !== undefined ? Number(entry.val)   || 0 : null,
      pct:     entry.pct   !== undefined ? Number(entry.pct)   || 0 : null,
      today:   entry.today !== undefined ? Number(entry.today) || 0 : null,
      entry_date: customDate || todayISO(),
      by_uid:  me ? me.uid : null,
      by_name: me ? me.name : 'Anonymous',
      ts:      customDate ? new Date(customDate + 'T12:00:00').toISOString() : new Date().toISOString()
    };
    const data = _ok(await _sb().from('daily_progress').insert(row).select('id').single(), 'pushDailyProgress');
    return { id: data.id };
  }

  // ===========================================================
  //  SNAPSHOTS (unchanged builder; storage now a jsonb row per date)
  // ===========================================================
  function buildSnapshot(dateStr) {
    const date = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? dateStr : todayISO();
    const snap = { date, savedAt: Date.now(), savedBy: _u().uid || 'system' };
    try {
      const turbs = {};
      (DB.wtg && DB.wtg.turbines || []).forEach(t => {
        turbs[t.id] = {
          pct:    (typeof calcTurbProg === 'function') ? calcTurbProg(t) : 0,
          status: t.status || 'pending',
          lp: !!t.lp, pp: !!t.pp
        };
      });
      snap.wtg = {
        overall: (typeof calcWtgProg === 'function') ? calcWtgProg() : 0,
        turbines: turbs
      };
    } catch(e){ snap.wtg = { overall:0, turbines:{} }; }
    try {
      const itcs = {};
      Object.entries(DB.solar && DB.solar.itcs || {}).forEach(([id,d]) => {
        const sp = (typeof solItcActsPct === 'function') ? solItcActsPct(d) : {pre:0,install:0,post:0};
        itcs[id] = {
          pct:     (typeof calcITCProg === 'function') ? calcITCProg(id) : 0,
          pre: sp.pre, install: sp.install, post: sp.post
        };
      });
      snap.solar = {
        overall: (typeof calcSolarProg === 'function') ? calcSolarProg() : 0,
        itcs: itcs
      };
    } catch(e){ snap.solar = { overall:0, itcs:{} }; }
    try {
      snap.bop = {
        overall: (typeof calcBopProg     === 'function') ? calcBopProg()     : 0,
        b33:     (typeof calcBop33PctV2  === 'function') ? calcBop33PctV2()  : 0,
        b66:     (typeof calcBop66PctV2  === 'function') ? calcBop66PctV2()  : 0,
        pss:     (typeof calcPssPct      === 'function') ? calcPssPct()      : 0,
        gss:     (typeof calcGssPct      === 'function') ? calcGssPct()      : 0
      };
    } catch(e){ snap.bop = { overall:0, b33:0, b66:0, pss:0, gss:0 }; }
    return snap;
  }

  async function saveSnapshot(dateStr) {
    const snap = buildSnapshot(dateStr);
    try {
      _ok(await _sb().from('snapshots').upsert({
        snap_date: snap.date, data: snap, saved_by: snap.savedBy,
        saved_at: new Date().toISOString()
      }, { onConflict: 'snap_date' }), 'saveSnapshot');
    } catch(e){ console.warn('[snapshot] save failed:', e); }
    return snap;
  }

  let _snapTimer = null;
  function autoSnapshot() {
    clearTimeout(_snapTimer);
    _snapTimer = setTimeout(() => { saveSnapshot(todayISO()); }, 3000);
  }

  async function getSnapshot(dateStr) {
    try {
      const r = _ok(await _sb().from('snapshots').select('data').eq('snap_date', dateStr).maybeSingle());
      return r ? r.data : null;
    } catch(e){ console.warn('[snapshot] get failed:', e); return null; }
  }

  async function listSnapshotDates() {
    try {
      const rows = _ok(await _sb().from('snapshots').select('snap_date').order('snap_date', { ascending: false }));
      return (rows || []).map(r => r.snap_date);
    } catch(e){ return []; }
  }

  async function updateSnapshot(dateStr, snap) {
    if (!auth.canEdit()) throw new Error('🔒 Login required to edit historical data.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error('Bad date');
    snap.date = dateStr;
    snap.savedAt = Date.now();
    snap.savedBy = _u().uid || 'edit';
    snap.edited = true;
    _ok(await _sb().from('snapshots').upsert({
      snap_date: dateStr, data: snap, saved_by: snap.savedBy,
      saved_at: new Date().toISOString()
    }, { onConflict: 'snap_date' }), 'updateSnapshot');
    _audit('snapshot.edit', 'snapshots/' + dateStr, null, { date: dateStr });
  }

  // ===========================================================
  //  PUBLIC SURFACE — identical names to the Firebase build,
  //  plus the five functions that replace stray direct-DB writes.
  // ===========================================================
  global.dataApi = {
    todayISO,
    buildSnapshot, saveSnapshot, autoSnapshot, getSnapshot,
    listSnapshotDates, updateSnapshot,
    addPod,
    addDailyProgress,
    pushDailyProgress,
    setProgressDate,
    updatePodStatus,
    addNextDayPlan, deleteNextDayPlan,
    updateItcLiveActivities,
    updateSolarAct, updateSolarMeta,
    updateTurbine,
    setZeroPoint,
    setWtgCustomActs,
    setWtgKpiOverrides,
    setSolarItc,
    setSolarCustomActs,
    updateBopAct, updateBopFeeder, updateBop66Act, updateBop33Poles, updateBop33Line, updatePssAct, updateGssAct,
    addHseObservation, updateHseObservation, deleteHseObservation,
    addHseEmployee,    updateHseEmployee,    deleteHseEmployee,
    updateWtgLand, updateSolLand, addLandParcel, updateLandParcel,
    addSolLease, removeSolLease,
    addBlocker,
    addMilestone, updateMilestone, deleteMilestone,
    addRowIssue, updateRowIssue, deleteRowIssue,
    setGanttRows,
    updateSchedule,
    setUserProfile,
    debouncedUpdate,
    notify: _notify,
    // new in the Supabase build — replace stray fbDB call-sites:
    setTurbine, setSolarActSubScope, setItcMap, deleteWtgLandLoc,
    markNotificationRead
  };

})(window);

// ═══════════════════════════════════════════════════════════════
//  data-api.js — EXTENSION BLOCK (v11 modules on Supabase)
//  Procurement · Inventory · Planning · Documents
// ═══════════════════════════════════════════════════════════════
(function (global) {
  const api = global.dataApi;
  if (!api) { console.error('[data-ext] dataApi missing — load order broken'); return; }

  function _sb() {
    if (!global.sb || typeof global.sb.from !== 'function') {
      throw new Error('Supabase client not initialised (js/supabase-init.js).');
    }
    return global.sb;
  }
  function _ok(res, what) {
    if (res && res.error) {
      const m = res.error.message || String(res.error);
      console.warn('[data-ext] ' + (what || 'write') + ' failed:', m);
      throw new Error(m);
    }
    return res ? res.data : undefined;
  }
  function _me() {
    const p = (global.auth && auth.current && auth.current()) || null;
    return p || { uid: null, name: 'Anonymous', role: 'viewer' };
  }
  function _need(section) {
    if (!(global.auth && auth.canEdit && auth.canEdit(section))) {
      throw new Error('🔒 Login required — use the ' + (section || 'section') + ' credentials, or Site Manager.');
    }
  }
  function _audit2(action, path, before, after) {
    try {
      if (!(global.auth && auth.current && auth.current())) return;
      _sb().rpc('log_audit', {
        p_action: action, p_path: path,
        p_before: before === undefined ? null : before,
        p_after:  after  === undefined ? null : after
      }).then(r => { if (r.error) console.warn('[audit] rpc failed:', r.error.message); });
    } catch (e) {}
  }
  const _notify2 = api.notify || function () {};
  function _isISO(d) { return /^\d{4}-\d{2}-\d{2}$/.test(String(d || '')); }
  function _reqStr(v, label, max) {
    v = String(v == null ? '' : v).trim();
    if (!v) throw new Error(label + ' is required.');
    return v.slice(0, max || 200);
  }
  function _num(v, label, min, max) {
    const n = Number(v);
    if (!isFinite(n)) throw new Error(label + ' must be a number.');
    if (min !== undefined && n < min) throw new Error(label + ' must be ≥ ' + min);
    if (max !== undefined && n > max) throw new Error(label + ' must be ≤ ' + max);
    return n;
  }

  // ===========================================================
  //  VENDORS
  // ===========================================================
  async function addVendor(v) {
    _need('procurement'); const me = _me();
    const row = {
      name:     _reqStr(v.name, 'Vendor name', 120),
      category: _reqStr(v.category || 'General', 'Category', 60),
      contact:  String(v.contact || '').slice(0, 120),
      phone:    String(v.phone   || '').slice(0, 30),
      email:    String(v.email   || '').slice(0, 120),
      gstin:    String(v.gstin   || '').slice(0, 20),
      address:  String(v.address || '').slice(0, 300),
      rating:   Math.max(0, Math.min(5, Number(v.rating) || 0)),
      status:   'active',
      by_uid: me.uid, by_name: me.name
    };
    if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) throw new Error('Invalid email address.');
    const data = _ok(await _sb().from('vendors').insert(row).select('id').single(), 'addVendor');
    _audit2('vendor.add', 'vendors/' + data.id, null, { name: row.name });
    _notify2('procurement', 'Vendor added', row.name + ' (' + row.category + ')');
    return { id: data.id };
  }

  async function updateVendor(id, patch) {
    _need('procurement'); const me = _me();
    if (!id) throw new Error('vendor id required');
    const upd = {};
    ['name','category','contact','phone','email','gstin','address','status'].forEach(k => {
      if (patch[k] !== undefined) upd[k] = String(patch[k]).slice(0, 300);
    });
    if (patch.rating !== undefined) upd.rating = Math.max(0, Math.min(5, Number(patch.rating) || 0));
    if (!Object.keys(upd).length) return;
    upd.last_by = me.uid; upd.last_at = new Date().toISOString();
    _ok(await _sb().from('vendors').update(upd).eq('id', id), 'updateVendor');
    _audit2('vendor.update', 'vendors/' + id, null, patch);
  }

  async function archiveVendor(id) { return updateVendor(id, { status: 'archived' }); }

  // ===========================================================
  //  PURCHASE ORDERS
  //  Status machine + line-item totals now live in SQL RPCs, so
  //  two concurrent approvers cannot race the read-then-write the
  //  RTDB build had. PO_FLOW kept for the UI's button rendering.
  // ===========================================================
  const PO_FLOW = { draft: ['approved', 'cancelled'], approved: ['delivered', 'cancelled'], delivered: ['closed'], closed: [], cancelled: [] };

  async function createPO(po) {
    _need('procurement'); const me = _me();
    const vendorId = _reqStr(po.vendorId, 'Vendor', 100);
    const vendor = _ok(await _sb().from('vendors').select('name,status').eq('id', vendorId).maybeSingle());
    if (!vendor) throw new Error('Vendor not found.');
    if (vendor.status === 'archived') throw new Error('Vendor is archived — reactivate before raising a PO.');
    if (po.expectedDate && !_isISO(po.expectedDate)) throw new Error('Expected date must be YYYY-MM-DD.');
    const row = {
      po_number:   _reqStr(po.poNumber || ('PO-' + new Date().getFullYear() + '-' + Math.random().toString(36).slice(2,7).toUpperCase()), 'PO number', 40),
      vendor_id:   vendorId,
      vendor_name: vendor.name || '?',           // denormalized as-of-issue — commercial record, on purpose
      module:      String(po.module || 'general').toLowerCase(),
      description: String(po.description || '').slice(0, 500),
      expected_date: po.expectedDate || null,
      currency:    'INR',
      total_value: _num(po.totalValue || 0, 'Total value', 0),
      status:      'draft',
      attachment_url: po.attachmentURL ? String(po.attachmentURL) : null,
      by_uid: me.uid, by_name: me.name
    };
    const data = _ok(await _sb().from('purchase_orders').insert(row).select('id').single(), 'createPO');
    // initial 'draft' history row is written by the po_create_history
    // trigger (po_status_history is RPC/trigger-only under RLS)
    _audit2('po.create', 'purchase_orders/' + data.id, null, { poNumber: row.po_number, vendor: row.vendor_name });
    _notify2('procurement', 'PO created', row.po_number + ' · ' + row.vendor_name);
    return { id: data.id, poNumber: row.po_number };
  }

  async function addPOLineItem(poId, item) {
    _need('procurement');
    if (!poId) throw new Error('poId required');
    const qty  = _num(item.qty,  'Quantity', 0.0001);
    const rate = _num(item.rate, 'Rate', 0);
    const id = _ok(await _sb().rpc('po_add_line_item', {
      p_po_id: poId,
      p_item_name: _reqStr(item.itemName, 'Item name', 160),
      p_item_id: item.itemId || null,
      p_unit: String(item.unit || 'nos').slice(0, 20),
      p_qty: qty, p_rate: rate
    }), 'addPOLineItem');
    _audit2('po.item.add', 'po_line_items/' + id, null, { itemName: item.itemName, qty, rate });
    return { id };
  }

  async function deletePOLineItem(poId, itemId) {
    _need('procurement');
    _ok(await _sb().rpc('po_delete_line_item', { p_po_id: poId, p_item_id: itemId }), 'deletePOLineItem');
    _audit2('po.item.delete', 'po_line_items/' + itemId, null, null);
  }

  async function updatePOStatus(poId, nextStatus, note) {
    _need(nextStatus === 'approved' ? 'all' : 'procurement');
    _ok(await _sb().rpc('po_set_status', {
      p_po_id: poId, p_next: String(nextStatus), p_note: String(note || '').slice(0, 300)
    }), 'updatePOStatus');
    _audit2('po.status', 'purchase_orders/' + poId, null, { status: nextStatus });
    _notify2('procurement', 'PO ' + nextStatus, 'PO moved to ' + nextStatus + (note ? ' · ' + note : ''));
  }

  // ===========================================================
  //  INVENTORY — append-only ledger
  // ===========================================================
  async function addInventoryItem(item) {
    _need('store'); const me = _me();
    const row = {
      name:     _reqStr(item.name, 'Item name', 160),
      category: String(item.category || 'General').slice(0, 60),
      unit:     String(item.unit || 'nos').slice(0, 20),
      min_stock: Math.max(0, Number(item.minStock) || 0),
      location: String(item.location || 'Main Store').slice(0, 80),
      status:   'active',
      by_uid: me.uid, by_name: me.name
    };
    const data = _ok(await _sb().from('inventory_items').insert(row).select('id').single(), 'addInventoryItem');
    _audit2('inv.item.add', 'inventory_items/' + data.id, null, { name: item.name });
    return { id: data.id };
  }

  async function updateInventoryItem(id, patch) {
    _need('store'); const me = _me();
    const upd = {};
    ['name','category','unit','location','status'].forEach(k => { if (patch[k] !== undefined) upd[k] = String(patch[k]).slice(0, 160); });
    if (patch.minStock !== undefined) upd.min_stock = Math.max(0, Number(patch.minStock) || 0);
    if (!Object.keys(upd).length) return;
    upd.last_by = me.uid; upd.last_at = new Date().toISOString();
    _ok(await _sb().from('inventory_items').update(upd).eq('id', id), 'updateInventoryItem');
    _audit2('inv.item.update', 'inventory_items/' + id, null, patch);
  }

  async function addStockMovement(mv) {
    _need('store'); const me = _me();
    const itemId = _reqStr(mv.itemId, 'Item', 100);
    const type = String(mv.type || '').toLowerCase();
    if (!['in', 'out', 'adjust'].includes(type)) throw new Error("Movement type must be 'in', 'out' or 'adjust'.");
    let qty = _num(mv.qty, 'Quantity');
    if (type !== 'adjust' && qty <= 0) throw new Error('Quantity must be > 0.');
    const date = _isISO(mv.date) ? mv.date : api.todayISO();
    if (date > api.todayISO()) throw new Error('Movement date cannot be in the future.');
    const row = {
      item_id: itemId, mv_date: date, type, qty,
      ref:   String(mv.ref   || '').slice(0, 120),
      dest:  String(mv.to    || '').slice(0, 120),
      notes: String(mv.notes || '').slice(0, 300),
      by_uid: me.uid, by_name: me.name
    };
    const data = _ok(await _sb().from('stock_movements').insert(row).select('id').single(), 'addStockMovement');
    _audit2('inv.move', 'stock_movements/' + data.id, null, { itemId, type, qty });
    _notify2('store', 'Stock ' + type, itemId + ' · ' + qty + (mv.ref ? ' · ' + mv.ref : ''));
    return { id: data.id, date };
  }

  async function recordTransfer(t) {
    _need('store');
    const itemId = _reqStr(t.itemId, 'Item', 100);
    const qty = _num(t.qty, 'Quantity', 0.0001);
    const from = _reqStr(t.from, 'From location', 80);
    const to   = _reqStr(t.to, 'To location', 80);
    if (from === to) throw new Error('From and To locations must differ.');
    const date = _isISO(t.date) ? t.date : api.todayISO();
    const res = _ok(await _sb().rpc('record_transfer', {
      p_item_id: itemId, p_qty: qty, p_from: from, p_to: to,
      p_date: date, p_notes: null
    }), 'recordTransfer');
    _audit2('inv.transfer', 'stock_movements', null, { itemId, qty, from, to });
    _notify2('store', 'Stock transfer', itemId + ' · ' + qty + ' · ' + from + ' → ' + to);
    return { date: res.date, outId: res.outId, inId: res.inId };
  }

  // ===========================================================
  //  PLANNING — DAG via task_dependencies (reverse index deleted:
  //  the FK does the job the /planning/dependents node used to)
  // ===========================================================
  function _asIdList(v) {
    return (Array.isArray(v) ? v : Object.keys(v || {})).filter(Boolean);
  }

  async function addPlanTask(t) {
    _need('planner'); const me = _me();
    const name = _reqStr(t.name, 'Task name', 200);
    if (!_isISO(t.start) || !_isISO(t.end)) throw new Error('Start and end dates are required (YYYY-MM-DD).');
    if (t.end < t.start) throw new Error('End date cannot be before start date.');
    const preds = _asIdList(t.predecessorIds);
    const row = {
      name, module: String(t.module || 'general').toLowerCase(),
      start_date: t.start, end_date: t.end,
      progress: Math.max(0, Math.min(100, Number(t.progress) || 0)),
      by_uid: me.uid, by_name: me.name
    };
    const data = _ok(await _sb().from('plan_tasks').insert(row).select('id').single(), 'addPlanTask');
    if (preds.length) {
      _ok(await _sb().from('task_dependencies')
            .insert(preds.map(p => ({ task_id: data.id, predecessor_id: p }))), 'addPlanTask.deps');
    }
    _audit2('plan.task.add', 'plan_tasks/' + data.id, null, { name, start: t.start, end: t.end });
    _notify2('planner', 'Task added', name);
    return { id: data.id };
  }

  async function updatePlanTask(id, patch) {
    _need('planner'); const me = _me();
    const cur = _ok(await _sb().from('plan_tasks').select('*').eq('id', id).maybeSingle());
    if (!cur) throw new Error('Task not found.');
    const start = patch.start !== undefined ? patch.start : cur.start_date;
    const end   = patch.end   !== undefined ? patch.end   : cur.end_date;
    if (!_isISO(start) || !_isISO(end) || end < start) throw new Error('Invalid start/end dates.');
    const upd = {};
    if (patch.name     !== undefined) upd.name       = _reqStr(patch.name, 'Task name', 200);
    if (patch.module   !== undefined) upd.module     = String(patch.module).toLowerCase();
    if (patch.start    !== undefined) upd.start_date = patch.start;
    if (patch.end      !== undefined) upd.end_date   = patch.end;
    if (patch.progress !== undefined) upd.progress   = Math.max(0, Math.min(100, Number(patch.progress) || 0));
    if (patch.predecessorIds !== undefined) {
      const newP = _asIdList(patch.predecessorIds);
      if (newP.includes(id)) throw new Error('A task cannot depend on itself.');
      _ok(await _sb().from('task_dependencies').delete().eq('task_id', id), 'updatePlanTask.clearDeps');
      if (newP.length) {
        _ok(await _sb().from('task_dependencies')
              .insert(newP.map(p => ({ task_id: id, predecessor_id: p }))), 'updatePlanTask.deps');
      }
    }
    if (Object.keys(upd).length) {
      upd.last_by = me.uid; upd.last_at = new Date().toISOString();
      _ok(await _sb().from('plan_tasks').update(upd).eq('id', id), 'updatePlanTask');
    }
    _audit2('plan.task.update', 'plan_tasks/' + id, null, patch);
  }

  async function deletePlanTask(id) {
    _need('planner');
    const cur = _ok(await _sb().from('plan_tasks').select('id,name').eq('id', id).maybeSingle());
    if (!cur) return;
    const deps = _ok(await _sb().from('task_dependencies').select('task_id').eq('predecessor_id', id));
    if ((deps || []).length) {
      throw new Error('Cannot delete: ' + deps.length + ' task(s) depend on this one. Re-link them first.');
    }
    // the FK (on delete restrict) still guards against a race here
    _ok(await _sb().from('plan_tasks').delete().eq('id', id), 'deletePlanTask');
    _audit2('plan.task.delete', 'plan_tasks/' + id, cur, null);
  }

  async function setPlanBaseline() {
    _need('all');
    const n = _ok(await _sb().rpc('set_plan_baseline'), 'setPlanBaseline');
    _audit2('plan.baseline.set', 'plan_baselines', null, { count: n });
    _notify2('planner', 'Baseline saved', n + ' tasks frozen as baseline');
  }

  // ===========================================================
  //  DOCUMENTS
  // ===========================================================
  async function addDocument(doc) {
    _need();   // any signed-in role may file documents
    const res = _ok(await _sb().rpc('document_create', {
      p_title: _reqStr(doc.title, 'Document title', 200),
      p_category: String(doc.category || 'General').slice(0, 60),
      p_module: String(doc.module || 'general').toLowerCase(),
      p_file_url: _reqStr(doc.fileURL, 'File URL', 2000),
      p_file_name: String(doc.fileName || 'file').slice(0, 200),
      p_size: Number(doc.size) || 0,
      p_note: String(doc.note || 'Initial upload').slice(0, 300)
    }), 'addDocument');
    _audit2('doc.add', 'documents/' + res.id, null, { title: doc.title });
    _notify2('general', 'Document filed', doc.title);
    return { id: res.id, versionId: res.versionId };
  }

  async function addDocumentVersion(docId, ver) {
    _need();
    const vId = _ok(await _sb().rpc('document_add_version', {
      p_doc_id: docId,
      p_file_url: _reqStr(ver.fileURL, 'File URL', 2000),
      p_file_name: String(ver.fileName || 'file').slice(0, 200),
      p_size: Number(ver.size) || 0,
      p_note: String(ver.note || '').slice(0, 300)
    }), 'addDocumentVersion');
    _audit2('doc.version.add', 'document_versions/' + vId, null, { fileName: ver.fileName });
    return { versionId: vId };
  }

  async function archiveDocument(docId) {
    _need('all'); const me = _me();
    _ok(await _sb().from('documents').update({
      status: 'archived', last_by: me.uid, last_at: new Date().toISOString()
    }).eq('id', docId), 'archiveDocument');
    _audit2('doc.archive', 'documents/' + docId, null, { status: 'archived' });
  }

  Object.assign(api, {
    addVendor, updateVendor, archiveVendor,
    createPO, addPOLineItem, deletePOLineItem, updatePOStatus,
    PO_FLOW,
    addInventoryItem, updateInventoryItem, addStockMovement, recordTransfer,
    addPlanTask, updatePlanTask, deletePlanTask, setPlanBaseline,
    addDocument, addDocumentVersion, archiveDocument
  });
})(window);

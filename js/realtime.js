'use strict';
// =============================================================
//  realtime.js  (SUPABASE BUILD) — listener registration + cleanup.
//
//  Same public surface as the Firebase build (window.realtime), same
//  payload shapes (see js/shape-map.js), so state-bridge.js and the
//  renderers are untouched:
//
//    • collection listeners still emit {kind:'add'|'change'|'remove',
//      id, val} — first an 'add' per existing row (matching RTDB
//      child_added replay), then live events from postgres_changes.
//    • whole-tree listeners (listenSolar/listenBop/listenLand/…)
//      still deliver the assembled legacy tree; on any change to an
//      underlying table the tree is re-fetched (debounced to one
//      query burst per 150ms) and re-delivered.
//
//  One realtime channel per table, shared by all listeners on that
//  table; channels are reference-counted and removed when the last
//  listener detaches (detachAll() on logout still drops everything).
//
//  Connection state: channel status events drive the header pill via
//  window.__sbSetConnected (defined in supabase-init.js).
// =============================================================

(function (global) {

  const S = () => global.shapeMap;
  function _sb() { return global.sb; }

  let _warnedNoSb = false;
  function _noSb() {
    if (!global.sb || typeof global.sb.from !== 'function') {
      if (!_warnedNoSb) {
        _warnedNoSb = true;
        console.warn('[rt] Supabase client not initialised — live data disabled ' +
          '(fill js/supabase-config.js; the UI keeps its built-in baseline data).');
      }
      return true;
    }
    return false;
  }

  function _safe(fn) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (e) { console.warn('[rt] listener threw:', e); }
    };
  }

  // -----------------------------------------------------------
  // Channel pool: one supabase channel per table, ref-counted.
  // -----------------------------------------------------------
  const _channels = {};   // table → { chan, handlers:Set, refs }
  const _unsubs   = new Set();

  function _onTable(table, handler) {
    if (_noSb()) return () => {};
    let entry = _channels[table];
    if (!entry) {
      const chan = _sb().channel('rt:' + table)
        .on('postgres_changes', { event: '*', schema: 'public', table },
            payload => { entry.handlers.forEach(h => { try { h(payload); } catch (e) { console.warn('[rt]', table, 'handler threw:', e); } }); })
        .subscribe(status => {
          if (typeof global.__sbSetConnected === 'function') {
            if (status === 'SUBSCRIBED') global.__sbSetConnected(true);
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') global.__sbSetConnected(false);
          }
        });
      entry = _channels[table] = { chan, handlers: new Set(), refs: 0 };
    }
    entry.handlers.add(handler);
    entry.refs++;
    const off = () => {
      if (!_channels[table]) return;
      entry.handlers.delete(handler);
      entry.refs--;
      if (entry.refs <= 0) {
        try { _sb().removeChannel(entry.chan); } catch (e) {}
        delete _channels[table];
      }
      _unsubs.delete(off);
    };
    _unsubs.add(off);
    return off;
  }

  function detachAll() {
    Array.from(_unsubs).forEach(off => { try { off(); } catch (e) {} });
    _unsubs.clear();
  }

  async function _rows(q, what) {
    const { data, error } = await q;
    if (error) { console.warn('[rt] ' + (what || 'load') + ' failed:', error.message); return []; }
    return data || [];
  }

  // -----------------------------------------------------------
  // Generic collection listener: initial 'add' replay + live events.
  //   table     — postgres table
  //   toVal     — row → legacy val (from shape-map)
  //   rowId     — row → legacy id (default r.id / legacy_id fallback)
  //   initialQ  — () => supabase query for the replay
  //   filter    — optional payload predicate for live events
  // -----------------------------------------------------------
  function _listenCollection(opts, cb) {
    if (_noSb()) return () => {};
    const toVal = opts.toVal;
    const rowId = opts.rowId || (r => r.legacy_id || r.id);
    let dead = false;

    (async () => {
      const rows = await _rows(opts.initialQ(), opts.table + ' initial');
      if (dead) return;
      rows.forEach(_safe(r => cb({ kind: 'add', id: rowId(r), val: toVal(r) })));
    })();

    const off = _onTable(opts.table, _safe(payload => {
      if (opts.filter && !opts.filter(payload)) return;
      if (payload.eventType === 'INSERT') cb({ kind: 'add',    id: rowId(payload.new), val: toVal(payload.new) });
      if (payload.eventType === 'UPDATE') cb({ kind: 'change', id: rowId(payload.new), val: toVal(payload.new) });
      if (payload.eventType === 'DELETE') cb({ kind: 'remove', id: rowId(payload.old || {}) });
    }));

    return () => { dead = true; off(); };
  }

  // -----------------------------------------------------------
  // Generic whole-tree listener: fetch+assemble now, then re-fetch
  // (debounced) whenever any of the underlying tables changes.
  // -----------------------------------------------------------
  function _listenTree(tables, assemble, cb) {
    if (_noSb()) return () => {};
    let timer = null, dead = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const val = await assemble();
        if (!dead) _safe(cb)(val);
      }, 150);
    };
    (async () => { const val = await assemble(); if (!dead) _safe(cb)(val); })();
    const offs = tables.map(t => _onTable(t, refresh));
    return () => { dead = true; clearTimeout(timer); offs.forEach(o => o()); };
  }

  function todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }

  // ===========================================================
  //  POD
  // ===========================================================
  function listenPodToday(cb, date) {
    const day = (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) ? date : todayISO();
    return _listenCollection({
      table: 'pod_entries',
      toVal: r => S().podVal(r),
      rowId: r => r.id,
      initialQ: () => _sb().from('pod_entries').select('*').eq('pod_date', day).order('ts'),
      filter: p => ((p.new && p.new.pod_date) || (p.old && p.old.pod_date)) === day
    }, cb);
  }

  async function loadPodForDate(date) {
    if (_noSb()) return [];
    const rows = await _rows(
      _sb().from('pod_entries').select('*').eq('pod_date', date).order('ts'),
      'loadPodForDate');
    return rows.map(r => ({ id: r.id, date, ...S().podVal(r) }));
  }

  async function loadRecentPod(days = 3) {
    if (_noSb()) { const out=[]; const t=new Date(); for(let i=0;i<days;i++){const d=new Date(t);d.setDate(d.getDate()-i);out.push({date:d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),entries:[]});} return out; }
    const today = new Date();
    const from = new Date(today); from.setDate(from.getDate() - (days - 1));
    const fromISO = from.getFullYear() + '-' + String(from.getMonth()+1).padStart(2,'0') + '-' + String(from.getDate()).padStart(2,'0');
    // one range query instead of the RTDB build's N per-day reads
    const rows = await _rows(
      _sb().from('pod_entries').select('*').gte('pod_date', fromISO).order('pod_date').order('ts'),
      'loadRecentPod');
    const byDate = {};
    rows.forEach(r => { (byDate[r.pod_date] = byDate[r.pod_date] || []).push({ id: r.id, date: r.pod_date, ...S().podVal(r) }); });
    const out = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const iso = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      out.push({ date: iso, entries: byDate[iso] || [] });
    }
    return out;
  }

  function listenNextDayPlan(cb, forDate) {
    const d = new Date(); d.setDate(d.getDate() + 1);
    const tomorrow = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    forDate = (forDate && /^\d{4}-\d{2}-\d{2}$/.test(forDate)) ? forDate : tomorrow;
    return _listenCollection({
      table: 'next_day_plans',
      toVal: r => S().nextDayVal(r),
      rowId: r => r.id,
      initialQ: () => _sb().from('next_day_plans').select('*').eq('for_date', forDate).order('ts'),
      filter: p => ((p.new && p.new.for_date) || (p.old && p.old.for_date)) === forDate
    }, evt => cb({ ...evt, forDate }));
  }

  // ===========================================================
  //  SOLAR
  // ===========================================================
  function listenSolar(itcId, cb) {
    return _listenTree(['solar_itcs', 'solar_activities'], async () => {
      const [itcRows, actRows] = await Promise.all([
        _rows(_sb().from('solar_itcs').select('*').eq('id', itcId), 'solar itc'),
        _rows(_sb().from('solar_activities').select('*').eq('itc_id', itcId).order('idx'), 'solar acts')
      ]);
      if (!itcRows.length && !actRows.length) return null;
      return S().solarItcVal(itcRows[0] || { data: {} }, actRows);
    }, cb);
  }

  function listenSolarMeta(cb) {
    return _listenModuleState('solar/meta', cb);
  }

  // ===========================================================
  //  WTG
  // ===========================================================
  function listenWtg(cb) {
    return _listenCollection({
      table: 'wtg_turbines',
      toVal: r => S().turbineVal(r),
      rowId: r => r.id,
      initialQ: () => _sb().from('wtg_turbines').select('*').order('id')
    }, evt => { if (evt.kind !== 'remove') cb(evt); });   // legacy listener had no child_removed
  }

  // ---- module_state singletons (value-listener equivalents) ----------
  function _listenModuleState(key, cb) {
    return _listenTree(['module_state'], async () => {
      const rows = await _rows(_sb().from('module_state').select('value').eq('key', key), key);
      return rows.length ? rows[0].value : null;
    }, cb);
  }
  const listenWtgZeroPoint    = cb => _listenModuleState('wtg/zeroPoint', cb);
  const listenWtgCustomActs   = cb => _listenModuleState('wtg/customActs', cb);
  const listenWtgKpiOverrides = cb => _listenModuleState('wtg/kpiOverrides', cb);
  const listenGantt           = cb => _listenModuleState('ganttRows', cb);
  const listenSchedule        = cb => _listenModuleState('schedule', cb);
  const listenItcMaps         = cb => _listenModuleState('solar/itcMaps', cb);

  // ===========================================================
  //  BOP — one assembled tree, like the old single value listener
  // ===========================================================
  function listenBop(cb) {
    return _listenTree(['bop_activities', 'bop_assets', 'module_state'], async () => {
      const [actRows, assetRows, metaRows] = await Promise.all([
        _rows(_sb().from('bop_activities').select('*'), 'bop acts'),
        _rows(_sb().from('bop_assets').select('*'), 'bop assets'),
        _rows(_sb().from('module_state').select('value').eq('key', 'bop/meta'), 'bop meta')
      ]);
      const t = S().bopTree(actRows, assetRows);
      if (metaRows.length) t.meta = metaRows[0].value;
      return t;
    }, cb);
  }

  // ===========================================================
  //  HSE
  // ===========================================================
  function listenHse(cb, limit = 50) {
    return _listenCollection({
      table: 'hse_observations',
      toVal: r => S().hseObsVal(r),
      initialQ: () => _sb().from('hse_observations').select('*').order('ts', { ascending: false }).limit(limit)
    }, cb);
  }

  function listenHseEmployees(cb) {
    // legacy shape: whole array [{id,...}] on every change
    return _listenTree(['hse_employees'], async () => {
      const rows = await _rows(_sb().from('hse_employees').select('*').order('code'), 'hse employees');
      return rows.map(r => ({ id: r.legacy_id || r.id, ...S().hseEmpVal(r) }));
    }, cb);
  }

  // ===========================================================
  //  LAND — assembled tree
  // ===========================================================
  function listenLand(cb) {
    return _listenTree(['land_wtg_locs', 'land_sol_blocks', 'land_leases', 'land_parcels'], async () => {
      const [wtgLocs, solBlocks, leases, parcels] = await Promise.all([
        _rows(_sb().from('land_wtg_locs').select('*'), 'land wtgLocs'),
        _rows(_sb().from('land_sol_blocks').select('*'), 'land solBlocks'),
        _rows(_sb().from('land_leases').select('*'), 'land leases'),
        _rows(_sb().from('land_parcels').select('*'), 'land parcels')
      ]);
      return S().landTree(wtgLocs, solBlocks, leases, parcels);
    }, cb);
  }

  // ===========================================================
  //  LISTS
  // ===========================================================
  function listenRowIssues(cb) {
    return _listenCollection({
      table: 'row_issues',
      toVal: r => S().rowIssueVal(r),
      initialQ: () => _sb().from('row_issues').select('*').order('ts')
    }, cb);
  }

  function listenMilestones(cb) {
    return _listenCollection({
      table: 'milestones',
      toVal: r => S().milestoneVal(r),
      initialQ: () => _sb().from('milestones').select('*').order('mdate')
    }, cb);
  }

  function listenDailyProgress(cb, limit = 100) {
    return _listenCollection({
      table: 'daily_progress',
      toVal: r => S().dailyProgressVal(r),
      rowId: r => r.id,
      initialQ: () => _sb().from('daily_progress').select('*').order('ts', { ascending: false }).limit(limit)
    }, cb);
  }

  function listenSnapshots(cb, limit = 30) {
    // legacy shape: {date: snapshot} map on every change
    return _listenTree(['snapshots'], async () => {
      const rows = await _rows(
        _sb().from('snapshots').select('*').order('snap_date', { ascending: false }).limit(limit), 'snapshots');
      const out = {};
      rows.forEach(r => { out[r.snap_date] = S().snapshotVal(r); });
      return out;
    }, cb);
  }

  // ===========================================================
  //  NOTIFICATIONS (was inline in notify.js)
  // ===========================================================
  function listenNotifications(cb, limit = 60) {
    return _listenCollection({
      table: 'notifications',
      toVal: r => S().notificationVal(r),
      rowId: r => r.id,
      initialQ: () => _sb().from('notifications').select('*').order('ts', { ascending: false }).limit(limit)
    }, cb);
  }

  global.realtime = {
    listenPodToday, loadPodForDate, loadRecentPod,
    listenSolar, listenSolarMeta,
    listenWtg, listenWtgZeroPoint, listenWtgCustomActs, listenWtgKpiOverrides, listenBop, listenHse, listenHseEmployees,
    listenLand,
    listenRowIssues, listenMilestones,
    listenGantt, listenSchedule, listenDailyProgress, listenSnapshots,
    listenNextDayPlan,
    listenItcMaps, listenNotifications,
    detachAll,
    // internal plumbing shared with the v11 extension block below
    _collection: _listenCollection, _onTable: _onTable, _tree: _listenTree
  };

})(window);

// ═══════════════════════════════════════════════════════════════
//  realtime.js — EXTENSION BLOCK (v11 modules on Supabase)
// ═══════════════════════════════════════════════════════════════
(function (global) {
  const rt = global.realtime;
  if (!rt) { console.error('[rt-ext] realtime missing'); return; }
  const S = () => global.shapeMap;
  function _sb() { return global.sb; }

  async function _rows(q, what) {
    const { data, error } = await q;
    if (error) { console.warn('[rt-ext] ' + (what || 'load') + ' failed:', error.message); return null; }
    return data || [];
  }

  // Vendors / inventory items: plain collections.
  function listenVendors(cb) {
    return rt._collection({
      table: 'vendors', toVal: r => S().vendorVal(r),
      initialQ: () => _sb().from('vendors').select('*').order('name')
    }, cb);
  }
  function listenInventoryItems(cb) {
    return rt._collection({
      table: 'inventory_items', toVal: r => S().inventoryItemVal(r),
      initialQ: () => _sb().from('inventory_items').select('*').order('name')
    }, cb);
  }

  // Purchase orders: the legacy val embedded lineItems + history, so a
  // PO event re-fetches its children (one PO at a time — cheap).
  function listenPurchaseOrders(cb, limit = 300) {
    if (!global.sb || typeof global.sb.from !== 'function') return () => {};
    async function poVal(row) {
      const [items, hist] = await Promise.all([
        _rows(_sb().from('po_line_items').select('*').eq('po_id', row.id).order('ts'), 'po items'),
        _rows(_sb().from('po_status_history').select('*').eq('po_id', row.id).order('ts'), 'po history')
      ]);
      return S().poVal(row, items || [], hist || []);
    }
    let dead = false;
    (async () => {
      const rows = await _rows(_sb().from('purchase_orders').select('*').order('ts', { ascending: false }).limit(limit), 'pos');
      if (dead || !rows) return;
      for (const r of rows) {
        const val = await poVal(r);
        if (dead) return;
        cb({ kind: 'add', id: r.id, val });
      }
    })();
    const refreshOne = async (id) => {
      if (!id) return;
      const rows = await _rows(_sb().from('purchase_orders').select('*').eq('id', id), 'po one');
      if (dead || !rows) return;
      if (rows.length) cb({ kind: 'change', id, val: await poVal(rows[0]) });
    };
    const offs = [
      rt._onTable('purchase_orders', p => {
        if (p.eventType === 'DELETE') { cb({ kind: 'remove', id: (p.old || {}).id }); return; }
        refreshOne((p.new || {}).id);
      }),
      rt._onTable('po_line_items',     p => refreshOne(((p.new || p.old) || {}).po_id)),
      rt._onTable('po_status_history', p => refreshOne(((p.new || p.old) || {}).po_id))
    ];
    return () => { dead = true; offs.forEach(o => o()); };
  }

  // Plan tasks: legacy val carries predecessorIds map.
  function listenPlanTasks(cb) {
    if (!global.sb || typeof global.sb.from !== 'function') return () => {};
    let dead = false;
    async function emitAll() {
      const [tasks, deps] = await Promise.all([
        _rows(_sb().from('plan_tasks').select('*').order('start_date'), 'tasks'),
        _rows(_sb().from('task_dependencies').select('*'), 'deps')
      ]);
      if (dead || !tasks) return;
      const predsByTask = {};
      (deps || []).forEach(d => { (predsByTask[d.task_id] = predsByTask[d.task_id] || {})[d.predecessor_id] = true; });
      tasks.forEach(t => cb({ kind: 'change', id: t.id, val: S().planTaskVal(t, predsByTask[t.id] || null) }));
    }
    (async () => {
      const [tasks, deps] = await Promise.all([
        _rows(_sb().from('plan_tasks').select('*').order('start_date'), 'tasks'),
        _rows(_sb().from('task_dependencies').select('*'), 'deps')
      ]);
      if (dead || !tasks) return;
      const predsByTask = {};
      (deps || []).forEach(d => { (predsByTask[d.task_id] = predsByTask[d.task_id] || {})[d.predecessor_id] = true; });
      tasks.forEach(t => cb({ kind: 'add', id: t.id, val: S().planTaskVal(t, predsByTask[t.id] || null) }));
    })();
    const offs = [
      rt._onTable('plan_tasks', p => {
        if (p.eventType === 'DELETE') { cb({ kind: 'remove', id: (p.old || {}).id }); return; }
        emitAll();
      }),
      rt._onTable('task_dependencies', () => emitAll())
    ];
    return () => { dead = true; offs.forEach(o => o()); };
  }

  // Documents: legacy val embeds versions{}.
  function listenDocuments(cb, limit = 300) {
    if (!global.sb || typeof global.sb.from !== 'function') return () => {};
    async function docVal(row) {
      const vers = await _rows(_sb().from('document_versions').select('*').eq('doc_id', row.id).order('ts'), 'doc versions');
      return S().documentVal(row, vers || []);
    }
    let dead = false;
    (async () => {
      const rows = await _rows(_sb().from('documents').select('*').order('ts', { ascending: false }).limit(limit), 'documents');
      if (dead || !rows) return;
      for (const r of rows) {
        const val = await docVal(r);
        if (dead) return;
        cb({ kind: 'add', id: r.id, val });
      }
    })();
    const refreshOne = async (id) => {
      if (!id) return;
      const rows = await _rows(_sb().from('documents').select('*').eq('id', id), 'doc one');
      if (dead || !rows) return;
      if (rows.length) cb({ kind: 'change', id, val: await docVal(rows[0]) });
    };
    const offs = [
      rt._onTable('documents', p => {
        if (p.eventType === 'DELETE') { cb({ kind: 'remove', id: (p.old || {}).id }); return; }
        refreshOne((p.new || {}).id);
      }),
      rt._onTable('document_versions', p => refreshOne(((p.new || p.old) || {}).doc_id))
    ];
    return () => { dead = true; offs.forEach(o => o()); };
  }

  // Stock movements: one SQL range query replaces the RTDB build's
  // 30 per-day reads; live events stream from the ledger table.
  function listenStockMovements(cb, days = 30) {
    if (!global.sb || typeof global.sb.from !== 'function') return { past: Promise.resolve([]), unsubscribe: () => {} };
    const from = new Date(); from.setDate(from.getDate() - (days - 1));
    const fromISO = from.getFullYear() + '-' + String(from.getMonth()+1).padStart(2,'0') + '-' + String(from.getDate()).padStart(2,'0');
    const today = (global.dataApi ? dataApi.todayISO() : fromISO);
    const past = (async () => {
      const rows = await _rows(
        _sb().from('stock_movements').select('*').gte('mv_date', fromISO).lt('mv_date', today).order('ts'), 'ledger past');
      return (rows || []).map(r => ({ id: r.id, date: r.mv_date, ...S().stockMovementVal(r) }));
    })();
    const offToday = rt._collection({
      table: 'stock_movements',
      toVal: r => S().stockMovementVal(r),
      rowId: r => r.id,
      initialQ: () => _sb().from('stock_movements').select('*').eq('mv_date', today).order('ts'),
      filter: p => ((p.new && p.new.mv_date) || (p.old && p.old.mv_date)) === today
    }, e => cb({ ...e, date: today }));
    return { past, unsubscribe: offToday };
  }

  async function loadBaselines() {
    if (!global.sb || typeof global.sb.from !== 'function') return {};
    const rows = await _rows(_sb().from('plan_baselines').select('*'), 'baselines');
    const out = {};
    (rows || []).forEach(r => { out[r.task_id] = S().baselineVal(r); });
    return out;
  }

  async function loadAudit(limit = 200) {
    if (!global.sb || typeof global.sb.from !== 'function') return null;
    const { data, error } = await _sb().from('audit_log')
      .select('*').order('ts', { ascending: false }).limit(limit);
    if (error) {
      console.warn('[rt-ext] loadAudit failed (admin-only table):', error.message);
      return null;          // null = access denied / error; [] = genuinely empty
    }
    return (data || []).map(r => ({ id: String(r.id), ...S().auditVal(r) }));
  }

  function listenAuditLive(cb) {
    return rt._onTable('audit_log', p => {
      if (p.eventType === 'INSERT' && p.new) cb({ id: String(p.new.id), ...S().auditVal(p.new) });
    });
  }

  Object.assign(rt, {
    listenVendors, listenPurchaseOrders, listenInventoryItems,
    listenPlanTasks, listenDocuments, listenStockMovements,
    loadBaselines, loadAudit, listenAuditLive
  });
})(window);

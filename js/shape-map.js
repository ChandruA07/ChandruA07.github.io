'use strict';
// =============================================================
//  shape-map.js — row ⇄ legacy-tree mappers (Supabase build)
//
//  The renderers and state-bridge still consume the RTDB-era
//  shapes (see ARCHITECTURE.md §3). These pure functions are the
//  single place where normalized Postgres rows are folded back
//  into those shapes, and they are unit-tested directly in
//  tools/test-migration.js so a shape regression fails loudly
//  instead of rendering blanks.
// =============================================================
(function (global) {

  const ms = t => (t == null ? null : (typeof t === 'number' ? t : new Date(t).getTime()));

  // ---- POD -----------------------------------------------------------
  function podVal(r) {
    return {
      module: r.module, activity: r.activity,
      qty: Number(r.qty) || 0, mp: Number(r.mp) || 0,
      resources: r.resources || [],
      contractor: r.contractor || '', notes: r.notes || '',
      photoURL: r.photo_url || null,
      by: r.by_uid || undefined, byName: r.by_name || 'Anonymous',
      date: r.pod_date,
      status: r.status || 'nys', progress: Number(r.progress) || 0,
      remark: r.remark || '',
      statusBy: r.status_by || undefined,
      statusByName: r.status_by_name || undefined,
      statusAt: ms(r.status_at) || undefined,
      ts: ms(r.ts)
    };
  }

  function nextDayVal(r) {
    return {
      module: r.module, activity: r.activity,
      qty: Number(r.qty) || 0, mp: Number(r.mp) || 0,
      contractor: r.contractor || '', notes: r.notes || '',
      forDate: r.for_date, by: r.by_uid, byName: r.by_name, ts: ms(r.ts)
    };
  }

  function dailyProgressVal(r) {
    return {
      module: r.module, itc: r.itc || null, turbine: r.turbine || null,
      activity: r.activity, act: r.activity,
      sub: r.sub || null,
      val: r.val == null ? null : Number(r.val),
      pct: r.pct == null ? null : Number(r.pct),
      today: r.today == null ? null : Number(r.today),
      qty: r.qty == null ? undefined : Number(r.qty),
      unit: r.unit || undefined, remarks: r.remarks || undefined,
      date: r.entry_date, by: r.by_uid || 'anon', byName: r.by_name, ts: ms(r.ts)
    };
  }

  // ---- Solar ----------------------------------------------------------
  function solarActVal(r) {
    const v = Object.assign({}, r.extra || {}, {
      done: Number(r.done) || 0,
      today: Number(r.today) || 0
    });
    if (r.sub_scope != null) v.subScope = Number(r.sub_scope);
    if (r.sub_done  != null) v.subDone  = r.sub_done;
    if (r.last_by) v.lastBy = r.last_by;
    if (r.last_at) v.lastAt = ms(r.last_at);
    return v;
  }
  // itcRow.data + its activity rows → the legacy itc object
  function solarItcVal(itcRow, actRows) {
    const itc = Object.assign({}, itcRow.data || {});
    const acts = {};
    (actRows || []).forEach(a => { acts[a.idx] = solarActVal(a); });
    if (Object.keys(acts).length) itc.acts = acts;
    if (itcRow.last_by) itc.lastBy = itcRow.last_by;
    if (itcRow.last_at) itc.lastAt = ms(itcRow.last_at);
    return itc;
  }

  // ---- WTG ------------------------------------------------------------
  function turbineVal(r) {
    const v = Object.assign({}, r.data || {});
    if (r.last_by) v.lastBy = r.last_by;
    if (r.last_at) v.lastAt = ms(r.last_at);
    return v;
  }

  // ---- BOP ------------------------------------------------------------
  // bop_activities + bop_assets rows → the whole legacy /bop tree.
  function bopTree(actRows, assetRows) {
    const t = { acts: {}, acts66: {}, feeders33: [], lines33: {}, poles33: {},
                pss: { acts: {} }, gss: { acts: {} } };
    const stamp = (dst, r) => {
      // legacy behavior: lastBy/lastAt were sibling keys inside the node
      if (r.last_by != null && dst && typeof dst === 'object' && !Array.isArray(dst)) {
        dst.lastBy = r.last_by; dst.lastAt = ms(r.last_at);
      }
      return dst;
    };
    (actRows || []).forEach(r => {
      const v = (r.data && typeof r.data === 'object') ? (Array.isArray(r.data) ? r.data.slice() : Object.assign({}, r.data)) : r.data;
      if (r.section === '33kv') t.acts[r.act_key]   = stamp(v, r);
      if (r.section === '66kv') t.acts66[r.act_key] = stamp(v, r);
      if (r.section === 'pss')  t.pss.acts[r.act_key] = stamp(v, r);
      if (r.section === 'gss')  t.gss.acts[r.act_key] = stamp(v, r);
    });
    (assetRows || []).forEach(r => {
      const v = (r.data && typeof r.data === 'object') ? (Array.isArray(r.data) ? r.data.slice() : Object.assign({}, r.data)) : r.data;
      if (r.section === 'feeders33') t.feeders33[Number(r.asset_key)] = stamp(v, r);
      if (r.section === 'lines33')   t.lines33[r.asset_key] = stamp(v, r);
      if (r.section === 'poles33')   t.poles33[r.asset_key] = stamp(v, r);
    });
    return t;
  }

  // ---- Land -----------------------------------------------------------
  function landTree(wtgLocs, solBlocks, leases, parcels) {
    const t = {};
    if (wtgLocs && wtgLocs.length) {
      t.wtgLocs = {};
      wtgLocs.forEach(r => {
        const v = Object.assign({}, r.data || {});
        if (r.last_by) { v.lastBy = r.last_by; v.lastAt = ms(r.last_at); }
        t.wtgLocs[r.id] = v;
      });
    }
    if (solBlocks && solBlocks.length) {
      t.solBlocks = {};
      const leasesByBlock = {};
      (leases || []).forEach(l => {
        (leasesByBlock[l.block_id] = leasesByBlock[l.block_id] || {})[l.id] = {
          own: l.own, svy: l.svy, dur: l.dur, ls: l.ls, doc: l.doc, reg: l.reg,
          rem: l.rem, by: l.by_uid, byName: l.by_name, ts: ms(l.ts)
        };
      });
      solBlocks.forEach(r => {
        const v = Object.assign({}, r.data || {}, { acts: r.acts || [] });
        if (leasesByBlock[r.id]) v.leases = leasesByBlock[r.id];
        if (r.last_by) { v.lastBy = r.last_by; v.lastAt = ms(r.last_at); }
        t.solBlocks[r.id] = v;
      });
    }
    if (parcels && parcels.length) {
      t.parcels = {};
      parcels.forEach(p => {
        t.parcels[p.id] = {
          module: p.module, name: p.name, lat: p.lat, lng: p.lng,
          area: Number(p.area) || 0, notes: p.notes,
          by: p.by_uid, byName: p.by_name, ts: ms(p.ts),
          lastBy: p.last_by || undefined, lastAt: ms(p.last_at) || undefined
        };
      });
    }
    return Object.keys(t).length ? t : null;
  }

  // ---- HSE ------------------------------------------------------------
  function hseObsVal(r) {
    const v = Object.assign({}, r.extra || {});
    if (r.type != null)        v.type = r.type;
    if (r.severity != null)    v.severity = r.severity;
    if (r.description != null) v.desc = r.description;
    if (r.obs != null)         v.obs = r.obs;
    if (r.area != null)        v.area = r.area;
    if (r.loc != null)         v.loc = r.loc;
    if (r.vendor != null)      v.vendor = r.vendor;
    if (r.action != null)      v.action = r.action;
    if (r.photo_url != null)   v.photoURL = r.photo_url;
    if (r.closed_by != null)   v.closedBy = r.closed_by;
    v.status = r.status || 'open';
    if (r.by_uid)  v.by = r.by_uid;
    if (r.by_name) v.byName = r.by_name;
    v.ts = ms(r.ts);
    return v;
  }
  function hseEmpVal(r) {
    return { code: r.code, name: r.name, score: Number(r.score) || 0,
             photo: r.photo || '', ts: ms(r.ts) };
  }

  // ---- Lists ----------------------------------------------------------
  function milestoneVal(r) {
    return { title: r.title, label: r.title, date: r.mdate || '',
             mod: r.mod, by: r.by_uid, byName: r.by_name, ts: ms(r.ts) };
  }
  function blockerVal(r) {
    return { title: r.title, severity: r.severity, module: r.module,
             desc: r.description, by: r.by_uid, ts: ms(r.ts) };
  }
  function rowIssueVal(r) {
    return { loc: r.loc, issue: r.issue, type: r.type, status: r.status,
             opened: r.opened, expClear: r.exp_clear, raisedBy: r.raised_by,
             by: r.by_uid, byName: r.by_name, ts: ms(r.ts) };
  }

  // ---- Notifications ---------------------------------------------------
  function notificationVal(r) {
    return { module: r.module, action: r.action, desc: r.descr,
             byName: r.by_name, ts: ms(r.ts), readBy: r.read_by || {} };
  }

  // ---- v11 modules ------------------------------------------------------
  function vendorVal(r) {
    return { name: r.name, category: r.category, contact: r.contact,
             phone: r.phone, email: r.email, gstin: r.gstin, address: r.address,
             rating: Number(r.rating) || 0, status: r.status,
             by: r.by_uid, byName: r.by_name, ts: ms(r.ts),
             lastBy: r.last_by || undefined, lastAt: ms(r.last_at) || undefined };
  }
  function poVal(r, lineItems, history) {
    const v = {
      poNumber: r.po_number, vendorId: r.vendor_id, vendorName: r.vendor_name,
      module: r.module, description: r.description,
      expectedDate: r.expected_date || null,
      currency: r.currency, totalValue: Number(r.total_value) || 0,
      status: r.status, attachmentURL: r.attachment_url || null,
      by: r.by_uid, byName: r.by_name, ts: ms(r.ts),
      lastBy: r.last_by || undefined, lastAt: ms(r.last_at) || undefined
    };
    if (lineItems && lineItems.length) {
      v.lineItems = {};
      lineItems.forEach(li => {
        v.lineItems[li.id] = { itemName: li.item_name, itemId: li.item_id || null,
          unit: li.unit, qty: Number(li.qty), rate: Number(li.rate),
          amount: Number(li.amount), by: li.by_uid, ts: ms(li.ts) };
      });
    }
    if (history && history.length) {
      v.history = {};
      history.forEach(h => {
        v.history[h.id] = { ts: ms(h.ts), status: h.status, note: h.note,
                            by: h.by_uid, byName: h.by_name };
      });
    }
    return v;
  }
  function inventoryItemVal(r) {
    return { name: r.name, category: r.category, unit: r.unit,
             minStock: Number(r.min_stock) || 0, location: r.location,
             status: r.status, by: r.by_uid, byName: r.by_name, ts: ms(r.ts),
             lastBy: r.last_by || undefined, lastAt: ms(r.last_at) || undefined };
  }
  function stockMovementVal(r) {
    return { itemId: r.item_id, type: r.type, qty: Number(r.qty),
             ref: r.ref, to: r.dest, notes: r.notes,
             location: r.location || undefined,
             transferId: r.transfer_id || undefined,
             by: r.by_uid, byName: r.by_name, ts: ms(r.ts), date: r.mv_date };
  }
  function planTaskVal(r, predecessorIds) {
    const v = { name: r.name, module: r.module, start: r.start_date,
                end: r.end_date, progress: Number(r.progress) || 0,
                predecessorIds: null,
                by: r.by_uid, byName: r.by_name, ts: ms(r.ts),
                lastBy: r.last_by || undefined, lastAt: ms(r.last_at) || undefined };
    // accept either an id array or an {id:true} map (listeners pass maps)
    const list = Array.isArray(predecessorIds)
      ? predecessorIds
      : Object.keys(predecessorIds || {});
    if (list.length) {
      v.predecessorIds = {};
      list.forEach(p => { v.predecessorIds[p] = true; });
    }
    return v;
  }
  function baselineVal(r) {
    return { start: r.start_date, end: r.end_date, setBy: r.set_by, setAt: ms(r.set_at) };
  }
  function documentVal(r, versions) {
    const v = { title: r.title, category: r.category, module: r.module,
                status: r.status, currentVersion: r.current_version,
                by: r.by_uid, byName: r.by_name, ts: ms(r.ts),
                lastBy: r.last_by || undefined, lastAt: ms(r.last_at) || undefined };
    if (versions && versions.length) {
      v.versions = {};
      versions.forEach(x => {
        v.versions[x.id] = { fileURL: x.file_url, fileName: x.file_name,
          size: Number(x.size) || 0, note: x.note,
          by: x.by_uid, byName: x.by_name, ts: ms(x.ts) };
      });
    }
    return v;
  }
  function auditVal(r) {
    return { uid: r.uid, role: r.role, action: r.action, path: r.path,
             before: r.before, after: r.after, ts: ms(r.ts) };
  }
  function snapshotVal(r) {
    const v = Object.assign({}, r.data || {});
    v.date = r.snap_date; v.savedBy = r.saved_by; v.savedAt = ms(r.saved_at);
    return v;
  }

  global.shapeMap = {
    ms,
    podVal, nextDayVal, dailyProgressVal,
    solarActVal, solarItcVal, turbineVal, bopTree, landTree,
    hseObsVal, hseEmpVal,
    milestoneVal, blockerVal, rowIssueVal, notificationVal,
    vendorVal, poVal, inventoryItemVal, stockMovementVal,
    planTaskVal, baselineVal, documentVal, auditVal, snapshotVal
  };
})(window);

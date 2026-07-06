'use strict';
// =============================================================
//  render-inventory.js — Store: item master, append-only ledger,
//  computed current stock, low-stock alerts, transfers.
//
//  KEY DESIGN POINT (matches ARCHITECTURE.md's POD fix):
//  /inventory/movements/{YYYY-MM-DD}/{pushId} is an append-only
//  ledger. Current stock is derived client-side as Σ(in) − Σ(out)
//  ± adjust over the loaded window (last 90 days live + item
//  openingBalance support is intentionally omitted for the demo —
//  documented in docs/SCALABILITY.md as the Cloud-Function path).
// =============================================================

(function (global) {

  const ITEMS = new Map();       // itemId -> item
  const LEDGER = new Map();      // movementId -> row (with .date)
  let _invTab = 'stock';
  let _ledgerReady = false;
  let _started = false;
  let _unsubMoves = null;

  function _ensureListeners() {
    if (_started || !global.realtime || !realtime.listenInventoryItems) return;
    _started = true;
    realtime.listenInventoryItems(e => {
      if (e.kind === 'remove') ITEMS.delete(e.id); else ITEMS.set(e.id, e.val);
      _rr();
    });
    const { past, unsubscribe } = realtime.listenStockMovements(e => {
      if (e.kind === 'remove') LEDGER.delete(e.id);
      else LEDGER.set(e.id, { ...e.val, date: e.date, id: e.id });
      _rr();
    }, 90);
    _unsubMoves = unsubscribe;
    past.then(rows => { rows.forEach(r => LEDGER.set(r.id, r)); _ledgerReady = true; _rr(); });
  }

  let _rrT = null;
  function _rr() {
    clearTimeout(_rrT);
    _rrT = setTimeout(() => {
      if (typeof CV !== 'undefined' && CV === 'inventory') rndrInventory();
      if (typeof CV !== 'undefined' && CV === 'reports' && typeof rndrReports === 'function') rndrReports();
    }, 120);
  }

  /** current stock per item from the loaded ledger window */
  function computeStock() {
    const stock = {};
    LEDGER.forEach(m => {
      const s = stock[m.itemId] || (stock[m.itemId] = 0);
      if (m.type === 'in') stock[m.itemId] = s + (Number(m.qty) || 0);
      else if (m.type === 'out') stock[m.itemId] = s - (Number(m.qty) || 0);
      else stock[m.itemId] = s + (Number(m.qty) || 0);   // adjust: signed qty
    });
    return stock;
  }

  function rndrInventory() {
    _ensureListeners();
    const ct = document.getElementById('inv-ct');
    if (!ct) return;
    ['stock', 'ledger', 'move'].forEach(t => document.getElementById('invtb-' + t)?.classList.toggle('on-s', t === _invTab));
    if (_invTab === 'stock')  ct.innerHTML = _stockHTML();
    if (_invTab === 'ledger') ct.innerHTML = _ledgerHTML();
    if (_invTab === 'move')   ct.innerHTML = _moveHTML();
  }

  function _stockHTML() {
    const stock = computeStock();
    const rows = [...ITEMS.entries()].sort((a, b) => String(a[1].name).localeCompare(String(b[1].name)));
    const lows = rows.filter(([id, it]) => it.status !== 'archived' && (stock[id] || 0) < (Number(it.minStock) || 0));
    let html = '';
    if (!_ledgerReady) html += `<div class="kpi" style="margin-bottom:10px;color:var(--t3);font-size:10px;">⏳ Loading movement history (90-day window)…</div>`;
    if (lows.length) {
      html += `<div class="kpi" style="margin-bottom:10px;border-color:var(--er);">
        <b style="color:var(--er);font-size:11px;">⚠ Low stock (${lows.length})</b>
        <div style="font-size:10px;color:var(--t2);margin-top:4px;">` +
        lows.map(([id, it]) => `${esc(it.name)}: <b style="color:var(--er);">${stock[id] || 0}</b> ${esc(it.unit)} (min ${esc(it.minStock)})`).join(' · ') +
        `</div></div>`;
    }
    html += `<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <button class="btn bta bts" onclick="invAddItemForm()">＋ New item</button>
      <span style="font-size:9px;color:var(--t3);align-self:center;">Stock = Σ ledger over loaded window · nothing mutates a running total (see docs)</span>
    </div>
    <div id="inv-item-form"></div>`;
    if (!rows.length) return html + `<div class="kpi" style="text-align:center;padding:30px;color:var(--t3);">No items yet.</div>`;
    html += `<div class="kpi" style="padding:0;overflow:auto;"><table class="tbl">
      <tr><th>Item</th><th>Category</th><th>Location</th><th>Unit</th><th>Min</th><th>Current stock</th><th>Status</th></tr>`;
    rows.forEach(([id, it]) => {
      const s = stock[id] || 0;
      const low = it.status !== 'archived' && s < (Number(it.minStock) || 0);
      html += `<tr>
        <td style="font-weight:700;color:var(--t1);">${esc(it.name)}</td>
        <td>${esc(it.category)}</td><td>${esc(it.location)}</td><td>${esc(it.unit)}</td>
        <td>${esc(it.minStock)}</td>
        <td style="font-weight:700;color:${low ? 'var(--er)' : 'var(--ok)'};">${s}${low ? ' ⚠' : ''}</td>
        <td style="font-size:9px;">${esc(it.status || 'active')}</td></tr>`;
    });
    return html + `</table></div>`;
  }

  function _ledgerHTML() {
    const rows = [...LEDGER.values()].sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 400);
    if (!rows.length) return `<div class="kpi" style="text-align:center;padding:30px;color:var(--t3);">${_ledgerReady ? 'Ledger is empty.' : '⏳ Loading…'}</div>`;
    let html = `<div class="kpi" style="padding:0;overflow:auto;"><table class="tbl">
      <tr><th>Date</th><th>Item</th><th>Type</th><th>Qty</th><th>Ref</th><th>To / Notes</th><th>By</th></tr>`;
    rows.forEach(m => {
      const it = ITEMS.get(m.itemId);
      const col = m.type === 'in' ? 'var(--ok)' : m.type === 'out' ? 'var(--er)' : 'var(--wn)';
      html += `<tr>
        <td>${esc(m.date)}</td>
        <td style="font-weight:600;color:var(--t1);">${esc(it ? it.name : m.itemId)}</td>
        <td style="color:${col};font-weight:700;text-transform:uppercase;font-size:9px;">${esc(m.type)}</td>
        <td style="font-weight:600;">${esc(m.qty)}</td>
        <td>${esc(m.ref || '—')}</td>
        <td style="font-size:9px;">${esc(m.to || '')}${m.to && m.notes ? ' · ' : ''}${esc(m.notes || '')}</td>
        <td style="font-size:9px;">${esc(m.byName || '')}</td></tr>`;
    });
    return html + `</table></div>`;
  }

  function _moveHTML() {
    const opts = [...ITEMS.entries()].filter(([, it]) => it.status !== 'archived')
      .sort((a, b) => String(a[1].name).localeCompare(String(b[1].name)))
      .map(([id, it]) => `<option value="${esc(id)}">${esc(it.name)} (${esc(it.unit)})</option>`).join('');
    const today = dataApi.todayISO();
    return `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;">
      <div class="kpi">
        <b style="font-size:11px;color:var(--t1);">📥 / 📤 Stock movement</b>
        <div class="fg" style="margin-top:8px;"><label class="fl">Item *</label><select class="fs" id="mv-item">${opts || '<option value="">— create an item first —</option>'}</select></div>
        <div style="display:flex;gap:8px;">
          <div class="fg" style="flex:1;"><label class="fl">Type</label>
            <select class="fs" id="mv-type"><option value="in">IN (receipt)</option><option value="out">OUT (issue)</option><option value="adjust">ADJUST (± stocktake)</option></select></div>
          <div class="fg" style="flex:1;"><label class="fl">Qty *</label><input class="fi" id="mv-qty" type="number" step="any"></div>
          <div class="fg" style="flex:1;"><label class="fl">Date</label><input class="fi" id="mv-date" type="date" value="${today}" max="${today}"></div>
        </div>
        <div class="fg"><label class="fl">Reference (PO no. / slip)</label><input class="fi" id="mv-ref"></div>
        <div class="fg"><label class="fl">Issued to / notes</label><input class="fi" id="mv-notes"></div>
        <div id="mv-err" style="color:var(--er);font-size:10px;min-height:14px;"></div>
        <button class="btn bta" onclick="invAddMove()">💾 Post to ledger</button>
      </div>
      <div class="kpi">
        <b style="font-size:11px;color:var(--t1);">🔁 Site-to-site transfer</b>
        <div style="font-size:9px;color:var(--t3);margin:2px 0 8px;">Writes one atomic pair of ledger rows (OUT@from + IN@to) — they succeed or fail together.</div>
        <div class="fg"><label class="fl">Item *</label><select class="fs" id="tr-item">${opts}</select></div>
        <div style="display:flex;gap:8px;">
          <div class="fg" style="flex:1;"><label class="fl">Qty *</label><input class="fi" id="tr-qty" type="number" min="0" step="any"></div>
          <div class="fg" style="flex:1;"><label class="fl">From *</label><input class="fi" id="tr-from" placeholder="Main Store"></div>
          <div class="fg" style="flex:1;"><label class="fl">To *</label><input class="fi" id="tr-to" placeholder="WTG Site Store"></div>
        </div>
        <div id="tr-err" style="color:var(--er);font-size:10px;min-height:14px;"></div>
        <button class="btn bta" onclick="invTransfer()">🔁 Record transfer</button>
      </div>
    </div>`;
  }

  // ── actions ──
  global.invTab = function (t) { _invTab = t; rndrInventory(); };

  global.invAddItemForm = function () {
    const host = document.getElementById('inv-item-form');
    if (!host) return;
    if (host.innerHTML) { host.innerHTML = ''; return; }
    host.innerHTML = `<div class="kpi" style="margin-bottom:10px;max-width:640px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div class="fg" style="flex:2;min-width:160px;"><label class="fl">Item name *</label><input class="fi" id="it-name"></div>
        <div class="fg" style="flex:1;"><label class="fl">Category</label><input class="fi" id="it-cat"></div>
        <div class="fg" style="width:80px;"><label class="fl">Unit</label><input class="fi" id="it-unit" value="nos"></div>
        <div class="fg" style="width:90px;"><label class="fl">Min stock</label><input class="fi" id="it-min" type="number" min="0" value="0"></div>
        <div class="fg" style="flex:1;"><label class="fl">Location</label><input class="fi" id="it-loc" value="Main Store"></div>
      </div>
      <div id="it-err" style="color:var(--er);font-size:10px;min-height:14px;"></div>
      <button class="btn bta bts" onclick="invSaveItem()">💾 Save item</button></div>`;
  };
  global.invSaveItem = function () {
    auth.requireRole('store', async () => {
      const err = document.getElementById('it-err');
      try {
        await dataApi.addInventoryItem({
          name: (document.getElementById('it-name') || {}).value,
          category: (document.getElementById('it-cat') || {}).value,
          unit: (document.getElementById('it-unit') || {}).value,
          minStock: (document.getElementById('it-min') || {}).value,
          location: (document.getElementById('it-loc') || {}).value
        });
        const host = document.getElementById('inv-item-form'); if (host) host.innerHTML = '';
      } catch (e) { if (err) err.textContent = '⚠️ ' + (e.message || e); }
    });
  };
  global.invAddMove = function () {
    auth.requireRole('store', async () => {
      const err = document.getElementById('mv-err');
      try {
        await dataApi.addStockMovement({
          itemId: (document.getElementById('mv-item') || {}).value,
          type:   (document.getElementById('mv-type') || {}).value,
          qty:    (document.getElementById('mv-qty')  || {}).value,
          date:   (document.getElementById('mv-date') || {}).value,
          ref:    (document.getElementById('mv-ref')  || {}).value,
          notes:  (document.getElementById('mv-notes')|| {}).value
        });
        _invTab = 'ledger'; rndrInventory();
      } catch (e) { if (err) err.textContent = '⚠️ ' + (e.message || e); }
    });
  };
  global.invTransfer = function () {
    auth.requireRole('store', async () => {
      const err = document.getElementById('tr-err');
      try {
        await dataApi.recordTransfer({
          itemId: (document.getElementById('tr-item') || {}).value,
          qty:    (document.getElementById('tr-qty')  || {}).value,
          from:   (document.getElementById('tr-from') || {}).value,
          to:     (document.getElementById('tr-to')   || {}).value
        });
        _invTab = 'ledger'; rndrInventory();
      } catch (e) { if (err) err.textContent = '⚠️ ' + (e.message || e); }
    });
  };

  global.rndrInventory = rndrInventory;
  global.__invCaches = { ITEMS, LEDGER, computeStock };

})(window);

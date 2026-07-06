'use strict';
// =============================================================
//  render-procurement.js — Purchase Orders + Vendor Directory
//
//  Data flow (same shape as every other module):
//    render → dataApi.createPO/addVendor/… → RTDB
//    realtime.listenVendors/listenPurchaseOrders → local caches
//    (VND, POS) → re-render if the view is open.
//
//  All user-typed fields go through esc() before hitting HTML.
//  Vendor↔PO joining is CLIENT-SIDE by design: RTDB has no joins,
//  so the vendor drawer filters the already-loaded PO cache.
// =============================================================

(function (global) {

  const VND = new Map();   // vendorId -> vendor
  const POS = new Map();   // poId     -> po
  let _unsubs = [];
  let _procTab = 'po';
  let _vendorSearch = '';
  let _vendorCat = '';
  let _poFilter = '';
  let _openPoId = null;
  let _busy = false;

  const PO_BADGE = {
    draft:     'background:rgba(255,202,40,.14);color:var(--wn);',
    approved:  'background:rgba(0,200,255,.14);color:var(--ac);',
    delivered: 'background:rgba(124,77,255,.14);color:var(--wtg);',
    closed:    'background:rgba(0,230,118,.14);color:var(--ok);',
    cancelled: 'background:rgba(255,82,82,.14);color:var(--er);'
  };

  function _fmtINR(n) {
    n = Number(n) || 0;
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  function _fmtTs(ts) {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function _badge(status) {
    return `<span style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:1px;padding:2px 8px;border-radius:8px;${PO_BADGE[status] || ''}">${esc(status)}</span>`;
  }

  // ── listeners: attach once, cache forever (small master data) ──
  let _started = false;
  function _ensureListeners() {
    if (_started || !global.realtime || !realtime.listenVendors) return;
    _started = true;
    realtime.listenVendors(e => {
      if (e.kind === 'remove') VND.delete(e.id); else VND.set(e.id, e.val);
      _rerenderIfOpen();
    });
    realtime.listenPurchaseOrders(e => {
      if (e.kind === 'remove') POS.delete(e.id); else POS.set(e.id, e.val);
      _rerenderIfOpen();
    });
  }
  let _rrTimer = null;
  function _rerenderIfOpen() {
    clearTimeout(_rrTimer);
    _rrTimer = setTimeout(() => {
      if (typeof CV === 'undefined') return;
      if (CV === 'procurement') rndrProcurement();
      if (CV === 'vendors')     rndrVendors();
      if (CV === 'reports' && typeof rndrReports === 'function') rndrReports();
    }, 120);
  }

  // ═══════════════════════════════════════════════════════════
  //  PROCUREMENT VIEW (PO list + create)
  // ═══════════════════════════════════════════════════════════
  function rndrProcurement() {
    _ensureListeners();
    const ct = document.getElementById('proc-ct');
    if (!ct) return;
    document.getElementById('prtb-po') ?.classList.toggle('on-s', _procTab === 'po');
    document.getElementById('prtb-new')?.classList.toggle('on-s', _procTab === 'new');
    ct.innerHTML = _procTab === 'new' ? _newPoHTML() : _poListHTML();
    if (_procTab === 'new') _wireNewPo(ct);
  }

  function _poListHTML() {
    const rows = [...POS.entries()]
      .filter(([, p]) => !_poFilter || p.status === _poFilter)
      .sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
    const counts = {};
    POS.forEach(p => { counts[p.status] = (counts[p.status] || 0) + 1; });
    const chips = ['', 'draft', 'approved', 'delivered', 'closed', 'cancelled'].map(s =>
      `<button class="btn bts ${_poFilter === s ? 'bta' : ''}" onclick="procFilterPo('${s}')">${s || 'All'}${s ? ' (' + (counts[s] || 0) + ')' : ' (' + POS.size + ')'}</button>`).join(' ');

    let html = `<div class="kpi" style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      <span style="font-size:9px;color:var(--t3);font-weight:700;text-transform:uppercase;letter-spacing:1px;">Filter</span> ${chips}
    </div>`;

    if (!rows.length) {
      return html + `<div class="kpi" style="text-align:center;padding:30px;color:var(--t3);">No purchase orders yet. Use the <b>New PO</b> tab to raise the first one.</div>`;
    }
    html += `<div class="kpi" style="padding:0;overflow:auto;"><table class="tbl">
      <tr><th>PO No.</th><th>Vendor</th><th>Module</th><th>Description</th><th>Value</th><th>Expected</th><th>Status</th><th>Raised</th><th></th></tr>`;
    rows.forEach(([id, p]) => {
      html += `<tr>
        <td style="font-weight:700;color:var(--t1);">${esc(p.poNumber)}</td>
        <td>${esc(p.vendorName)}</td>
        <td style="text-transform:uppercase;font-size:9px;">${esc(p.module)}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(p.description)}</td>
        <td style="font-weight:600;">${_fmtINR(p.totalValue)}</td>
        <td>${esc(p.expectedDate || '—')}</td>
        <td>${_badge(p.status)}</td>
        <td style="font-size:9px;">${_fmtTs(p.ts)} · ${esc(p.byName || '')}</td>
        <td><button class="btn bts" onclick="procOpenPo('${esc(id)}')">Open</button></td>
      </tr>`;
      if (_openPoId === id) html += `<tr><td colspan="9" style="background:var(--card2);">${_poDetailHTML(id, p)}</td></tr>`;
    });
    return html + `</table></div>`;
  }

  function _poDetailHTML(id, p) {
    const items = Object.entries(p.lineItems || {});
    let h = `<div style="padding:6px 2px;">`;
    h += `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px;">
      <b style="color:var(--t1);">${esc(p.poNumber)}</b> ${_badge(p.status)}
      <span style="font-size:9px;color:var(--t3);">Vendor: ${esc(p.vendorName)}</span>
      ${p.attachmentURL ? `<a class="btn bts" href="${esc(p.attachmentURL)}" target="_blank" rel="noopener">📎 Attachment</a>` : ''}
    </div>`;
    // line items
    h += `<table class="tbl" style="margin-bottom:8px;"><tr><th>Item</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr>`;
    if (!items.length) h += `<tr><td colspan="6" style="color:var(--t3);">No line items.</td></tr>`;
    items.forEach(([iid, it]) => {
      h += `<tr><td>${esc(it.itemName)}</td><td>${esc(it.unit)}</td><td>${esc(it.qty)}</td><td>${_fmtINR(it.rate)}</td><td>${_fmtINR(it.amount)}</td>
        <td>${p.status === 'draft' ? `<button class="btn bts" onclick="procDelItem('${esc(id)}','${esc(iid)}')">🗑</button>` : ''}</td></tr>`;
    });
    h += `</table>`;
    if (p.status === 'draft') {
      h += `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-end;margin-bottom:8px;">
        <div class="fg" style="margin:0;flex:2;min-width:140px;"><label class="fl">Item</label><input class="fi" id="po-it-name" placeholder="e.g. 33kV XLPE cable"></div>
        <div class="fg" style="margin:0;width:70px;"><label class="fl">Unit</label><input class="fi" id="po-it-unit" value="nos"></div>
        <div class="fg" style="margin:0;width:80px;"><label class="fl">Qty</label><input class="fi" id="po-it-qty" type="number" min="0" step="any"></div>
        <div class="fg" style="margin:0;width:100px;"><label class="fl">Rate ₹</label><input class="fi" id="po-it-rate" type="number" min="0" step="any"></div>
        <button class="btn bta bts" onclick="procAddItem('${esc(id)}')">＋ Add item</button>
      </div>`;
    }
    // workflow buttons
    const next = (dataApi.PO_FLOW || {})[p.status] || [];
    if (next.length) {
      h += `<div style="display:flex;gap:6px;flex-wrap:wrap;">` + next.map(s =>
        `<button class="btn ${s === 'cancelled' ? '' : 'bta'} bts" onclick="procMovePo('${esc(id)}','${esc(s)}')">${s === 'approved' ? '✅ Approve (Site Manager)' : s === 'delivered' ? '🚚 Mark delivered' : s === 'closed' ? '✔ Close out' : '✖ Cancel'}</button>`).join('') + `</div>`;
    }
    // history
    const hist = Object.entries(p.history || {}).sort((a, b) => parseInt(a[0]) - parseInt(b[0]));
    if (hist.length) {
      h += `<div style="margin-top:8px;font-size:9px;color:var(--t3);">` +
        hist.map(([ts, e]) => `${_fmtTs(e.ts || parseInt(ts))} · <b>${esc(e.status)}</b> by ${esc(e.byName || e.by)}${e.note ? ' — ' + esc(e.note) : ''}`).join('<br>') + `</div>`;
    }
    return h + `</div>`;
  }

  function _newPoHTML() {
    const vendors = [...VND.entries()].filter(([, v]) => v.status !== 'archived')
      .sort((a, b) => String(a[1].name).localeCompare(String(b[1].name)));
    const opts = vendors.map(([id, v]) => `<option value="${esc(id)}">${esc(v.name)} · ${esc(v.category)}</option>`).join('');
    return `<div class="kpi" style="max-width:640px;">
      <div class="fg"><label class="fl">Vendor *</label>
        <select class="fs" id="po-vendor">${opts || '<option value="">— add a vendor first (Vendor Directory) —</option>'}</select></div>
      <div style="display:flex;gap:8px;">
        <div class="fg" style="flex:1;"><label class="fl">Module</label>
          <select class="fs" id="po-module"><option value="solar">Solar</option><option value="wtg">WTG</option><option value="bop">BOP</option><option value="land">Land</option><option value="general" selected>General</option></select></div>
        <div class="fg" style="flex:1;"><label class="fl">Expected delivery</label><input class="fi" id="po-exp" type="date"></div>
      </div>
      <div class="fg"><label class="fl">Description *</label><textarea class="fta" id="po-desc" rows="2" maxlength="500" placeholder="Scope / material description"></textarea></div>
      <div class="fg"><label class="fl">Attachment (optional — PDF/Word/Excel/image, max 10 MB)</label><input class="fi" id="po-file" type="file"></div>
      <div id="po-err" style="color:var(--er);font-size:10px;min-height:14px;"></div>
      <button class="btn bta" id="po-create-btn" onclick="procCreatePo()">📄 Create draft PO</button>
      <span style="font-size:9px;color:var(--t3);margin-left:8px;">Line items are added on the PO after creation, while it is still a draft.</span>
    </div>`;
  }
  function _wireNewPo() { /* all inline handlers */ }

  // ── actions (globals used by inline handlers) ──
  global.procTab = function (t) { _procTab = t; rndrProcurement(); };
  global.procFilterPo = function (s) { _poFilter = s; rndrProcurement(); };
  global.procOpenPo = function (id) { _openPoId = _openPoId === id ? null : id; rndrProcurement(); };

  global.procCreatePo = function () {
    auth.requireRole('procurement', async () => {
      if (_busy) return; _busy = true;
      const err = document.getElementById('po-err');
      const btn = document.getElementById('po-create-btn');
      try {
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Creating…'; }
        let attachmentURL = null;
        const f = document.getElementById('po-file');
        if (f && f.files && f.files[0]) {
          const up = await storage.uploadPoAttachment(f.files[0], p => { if (btn) btn.textContent = '⏳ Uploading ' + p + '%'; });
          attachmentURL = up.url;
        }
        const res = await dataApi.createPO({
          vendorId: (document.getElementById('po-vendor') || {}).value,
          module:   (document.getElementById('po-module') || {}).value,
          expectedDate: (document.getElementById('po-exp') || {}).value || null,
          description:  (document.getElementById('po-desc') || {}).value,
          attachmentURL
        });
        _procTab = 'po'; _openPoId = res.id; _poFilter = '';
        rndrProcurement();
      } catch (e) {
        if (err) err.textContent = '⚠️ ' + (e.message || e);
      } finally {
        _busy = false;
        if (btn) { btn.disabled = false; btn.textContent = '📄 Create draft PO'; }
      }
    });
  };

  global.procAddItem = function (poId) {
    auth.requireRole('procurement', async () => {
      try {
        await dataApi.addPOLineItem(poId, {
          itemName: (document.getElementById('po-it-name') || {}).value,
          unit: (document.getElementById('po-it-unit') || {}).value,
          qty:  (document.getElementById('po-it-qty')  || {}).value,
          rate: (document.getElementById('po-it-rate') || {}).value
        });
      } catch (e) { alert(e.message || e); }
    });
  };
  global.procDelItem = function (poId, itemId) {
    auth.requireRole('procurement', async () => {
      try { await dataApi.deletePOLineItem(poId, itemId); } catch (e) { alert(e.message || e); }
    });
  };
  global.procMovePo = function (poId, status) {
    const role = status === 'approved' ? 'all' : 'procurement';
    auth.requireRole(role, async () => {
      const note = status === 'cancelled' ? (prompt('Cancellation note (optional):') || '') : '';
      try { await dataApi.updatePOStatus(poId, status, note); } catch (e) { alert(e.message || e); }
    });
  };

  // ═══════════════════════════════════════════════════════════
  //  VENDOR DIRECTORY VIEW
  // ═══════════════════════════════════════════════════════════
  let _openVendorId = null;
  let _showVendorForm = false;

  function rndrVendors() {
    _ensureListeners();
    const ct = document.getElementById('vendors-ct');
    if (!ct) return;
    const cats = [...new Set([...VND.values()].map(v => v.category || 'General'))].sort();
    const q = _vendorSearch.toLowerCase();
    const list = [...VND.entries()]
      .filter(([, v]) => (!_vendorCat || v.category === _vendorCat))
      .filter(([, v]) => !q || String(v.name).toLowerCase().includes(q) || String(v.contact).toLowerCase().includes(q) || String(v.category).toLowerCase().includes(q))
      .sort((a, b) => String(a[1].name).localeCompare(String(b[1].name)));

    let html = `<div class="kpi" style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <input class="fi" style="max-width:240px;" placeholder="🔍 Search vendors…" value="${esc(_vendorSearch)}"
             oninput="vendorSearch(this.value)">
      <select class="fs" style="max-width:180px;" onchange="vendorCat(this.value)">
        <option value="">All categories</option>
        ${cats.map(c => `<option ${c === _vendorCat ? 'selected' : ''} value="${esc(c)}">${esc(c)}</option>`).join('')}
      </select>
      <button class="btn bta bts" onclick="vendorToggleForm()">${_showVendorForm ? '✖ Close form' : '＋ Add vendor'}</button>
      <span style="font-size:9px;color:var(--t3);margin-left:auto;">${list.length} of ${VND.size} vendors</span>
    </div>`;

    if (_showVendorForm) html += _vendorFormHTML();

    if (!list.length) {
      html += `<div class="kpi" style="text-align:center;padding:30px;color:var(--t3);">No vendors match. Add one with <b>＋ Add vendor</b>.</div>`;
    } else {
      html += `<div class="kpi" style="padding:0;overflow:auto;"><table class="tbl">
        <tr><th>Vendor</th><th>Category</th><th>Contact</th><th>Phone / Email</th><th>Rating</th><th>POs</th><th>Status</th><th></th></tr>`;
      list.forEach(([id, v]) => {
        const pos = [...POS.entries()].filter(([, p]) => p.vendorId === id);
        const total = pos.reduce((s, [, p]) => s + (Number(p.totalValue) || 0), 0);
        html += `<tr>
          <td style="font-weight:700;color:var(--t1);">${esc(v.name)}</td>
          <td>${esc(v.category)}</td><td>${esc(v.contact || '—')}</td>
          <td style="font-size:9px;">${esc(v.phone || '')}${v.phone && v.email ? ' · ' : ''}${esc(v.email || '')}</td>
          <td>${'★'.repeat(Math.round(v.rating || 0)) || '—'}</td>
          <td>${pos.length}${pos.length ? ' · ' + _fmtINR(total) : ''}</td>
          <td>${_badge(v.status === 'archived' ? 'cancelled' : 'approved').replace('cancelled', 'archived').replace('approved', 'active')}</td>
          <td style="white-space:nowrap;">
            <button class="btn bts" onclick="vendorOpen('${esc(id)}')">PO history</button>
            <button class="btn bts" onclick="vendorArchive('${esc(id)}','${v.status === 'archived' ? 'active' : 'archived'}')">${v.status === 'archived' ? '♻ Restore' : '🗄 Archive'}</button>
          </td></tr>`;
        if (_openVendorId === id) {
          html += `<tr><td colspan="8" style="background:var(--card2);">` +
            (pos.length
              ? `<table class="tbl">` + pos.sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0)).map(([pid, p]) =>
                  `<tr><td>${esc(p.poNumber)}</td><td>${esc(p.description)}</td><td>${_fmtINR(p.totalValue)}</td><td>${_badge(p.status)}</td>
                   <td><button class="btn bts" onclick="nav('procurement');setTimeout(()=>procOpenPo('${esc(pid)}'),80)">Open</button></td></tr>`).join('') + `</table>`
              : `<span style="font-size:10px;color:var(--t3);">No POs raised on this vendor yet.</span>`) + `</td></tr>`;
        }
      });
      html += `</table></div>`;
    }
    ct.innerHTML = html;
  }

  function _vendorFormHTML() {
    return `<div class="kpi" style="margin-bottom:10px;max-width:640px;">
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div class="fg" style="flex:2;min-width:180px;"><label class="fl">Vendor name *</label><input class="fi" id="vn-name"></div>
        <div class="fg" style="flex:1;min-width:140px;"><label class="fl">Category</label><input class="fi" id="vn-cat" placeholder="Civil / Electrical / Supply…"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div class="fg" style="flex:1;"><label class="fl">Contact person</label><input class="fi" id="vn-contact"></div>
        <div class="fg" style="flex:1;"><label class="fl">Phone</label><input class="fi" id="vn-phone"></div>
        <div class="fg" style="flex:1;"><label class="fl">Email</label><input class="fi" id="vn-email" type="email"></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div class="fg" style="flex:1;"><label class="fl">GSTIN</label><input class="fi" id="vn-gstin" maxlength="15"></div>
        <div class="fg" style="flex:2;"><label class="fl">Address</label><input class="fi" id="vn-addr"></div>
        <div class="fg" style="width:90px;"><label class="fl">Rating 0–5</label><input class="fi" id="vn-rating" type="number" min="0" max="5" step="1" value="0"></div>
      </div>
      <div id="vn-err" style="color:var(--er);font-size:10px;min-height:14px;"></div>
      <button class="btn bta" onclick="vendorSave()">💾 Save vendor</button>
    </div>`;
  }

  global.vendorSearch = function (v) { _vendorSearch = v; clearTimeout(_rrTimer); _rrTimer = setTimeout(rndrVendors, 150); };
  global.vendorCat = function (v) { _vendorCat = v; rndrVendors(); };
  global.vendorToggleForm = function () { _showVendorForm = !_showVendorForm; rndrVendors(); };
  global.vendorOpen = function (id) { _openVendorId = _openVendorId === id ? null : id; rndrVendors(); };
  global.vendorSave = function () {
    auth.requireRole('procurement', async () => {
      const err = document.getElementById('vn-err');
      try {
        await dataApi.addVendor({
          name:    (document.getElementById('vn-name')    || {}).value,
          category:(document.getElementById('vn-cat')     || {}).value,
          contact: (document.getElementById('vn-contact') || {}).value,
          phone:   (document.getElementById('vn-phone')   || {}).value,
          email:   (document.getElementById('vn-email')   || {}).value,
          gstin:   (document.getElementById('vn-gstin')   || {}).value,
          address: (document.getElementById('vn-addr')    || {}).value,
          rating:  (document.getElementById('vn-rating')  || {}).value
        });
        _showVendorForm = false;
        rndrVendors();
      } catch (e) { if (err) err.textContent = '⚠️ ' + (e.message || e); }
    });
  };
  global.vendorArchive = function (id, status) {
    auth.requireRole('procurement', async () => {
      try { await dataApi.updateVendor(id, { status }); } catch (e) { alert(e.message || e); }
    });
  };

  // exports for nav.js
  global.rndrProcurement = rndrProcurement;
  global.rndrVendors = rndrVendors;
  // expose caches for reports
  global.__procCaches = { VND, POS };

})(window);

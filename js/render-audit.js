'use strict';
// =============================================================
//  render-audit.js — admin-facing audit trail viewer.
//  Reads /audit (newest 200) via realtime.loadAudit(); a
//  1-item live listener prepends new entries while the view is
//  open. Under the Phase-6 rules only Site Manager can read
//  this node — everyone else sees a friendly access note.
// =============================================================

(function (global) {

  let _rows = null;          // null = not loaded / denied; [] = empty
  let _unsubLive = null;
  let _filter = '';

  async function rndrAudit() {
    const ct = document.getElementById('audit-ct');
    if (!ct) return;
    ct.innerHTML = `<div class="kpi" style="text-align:center;padding:26px;color:var(--t3);">⏳ Loading audit trail…</div>`;
    _rows = await realtime.loadAudit(200);
    if (_unsubLive) { _unsubLive(); _unsubLive = null; }
    if (_rows) {
      _unsubLive = realtime.listenAuditLive(rec => {
        if (typeof CV === 'undefined' || CV !== 'audit') { if (_unsubLive) { _unsubLive(); _unsubLive = null; } return; }
        if (!_rows.some(r => r.id === rec.id)) { _rows.unshift(rec); _paint(); }
      });
    }
    _paint();
  }

  function _fmtTs(ts) {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' ' +
           d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function _paint() {
    const ct = document.getElementById('audit-ct');
    if (!ct) return;
    if (_rows === null) {
      ct.innerHTML = `<div class="kpi" style="padding:26px;text-align:center;">
        <b style="color:var(--er);">🔒 Access denied or audit unavailable.</b>
        <div style="font-size:10px;color:var(--t3);margin-top:6px;">
          Under the production rules the <code>/audit</code> node is readable by Site Manager (admin) only.
          Sign in as Site Manager and reopen this view.</div></div>`;
      return;
    }
    const q = _filter.toLowerCase();
    const rows = _rows.filter(r => !q ||
      String(r.action).toLowerCase().includes(q) ||
      String(r.path).toLowerCase().includes(q) ||
      String(r.role).toLowerCase().includes(q) ||
      String(r.uid).toLowerCase().includes(q));

    let html = `<div class="kpi" style="margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <input class="fi" style="max-width:260px;" placeholder="🔍 Filter action / path / role…" value="${esc(_filter)}" oninput="auditFilter(this.value)">
      <span style="font-size:9px;color:var(--t3);margin-left:auto;">${rows.length} of ${_rows.length} entries · newest first · live</span></div>`;
    if (!rows.length) {
      ct.innerHTML = html + `<div class="kpi" style="text-align:center;padding:26px;color:var(--t3);">No matching audit entries.</div>`;
      return;
    }
    html += `<div class="kpi" style="padding:0;overflow:auto;"><table class="tbl">
      <tr><th>When</th><th>Who</th><th>Role</th><th>Action</th><th>Path</th><th>Payload</th></tr>`;
    rows.slice(0, 300).forEach(r => {
      const payload = r.after ? JSON.stringify(r.after) : (r.before ? '⌫ ' + JSON.stringify(r.before) : '');
      html += `<tr>
        <td style="white-space:nowrap;font-size:9px;">${_fmtTs(r.ts || Number(String(r.id).split('_')[0]))}</td>
        <td style="font-size:9px;">${esc(String(r.uid).slice(0, 14))}</td>
        <td style="text-transform:uppercase;font-size:8px;font-weight:700;color:var(--ac);">${esc(r.role)}</td>
        <td style="font-weight:600;color:var(--t1);">${esc(r.action)}</td>
        <td style="font-size:9px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(r.path)}</td>
        <td style="font-size:9px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(payload.slice(0, 160))}</td></tr>`;
    });
    ct.innerHTML = html + `</table></div>`;
  }

  global.auditFilter = function (v) { _filter = v; _paint(); };
  global.rndrAudit = rndrAudit;

})(window);

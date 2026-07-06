'use strict';
// =============================================================
//  render-documents.js — Document Management.
//  Binary → Firebase Storage (storage.uploadDocument).
//  Metadata + version chain → /documents/{docId} in RTDB.
// =============================================================

(function (global) {

  const DOCS = new Map();
  let _started = false;
  let _showForm = false;
  let _openDocId = null;
  let _search = '';

  function _ensure() {
    if (_started || !global.realtime || !realtime.listenDocuments) return;
    _started = true;
    realtime.listenDocuments(e => {
      if (e.kind === 'remove') DOCS.delete(e.id); else DOCS.set(e.id, e.val);
      clearTimeout(_rrT);
      _rrT = setTimeout(() => { if (typeof CV !== 'undefined' && CV === 'documents') rndrDocuments(); }, 120);
    });
  }
  let _rrT = null;

  function _fmtSize(b) {
    b = Number(b) || 0;
    if (b > 1048576) return (b / 1048576).toFixed(1) + ' MB';
    if (b > 1024) return Math.round(b / 1024) + ' KB';
    return b + ' B';
  }
  function _fmtTs(ts) { return ts ? new Date(ts).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; }

  function rndrDocuments() {
    _ensure();
    const ct = document.getElementById('docs-ct');
    if (!ct) return;
    const q = _search.toLowerCase();
    const list = [...DOCS.entries()]
      .filter(([, d]) => d.status !== 'archived')
      .filter(([, d]) => !q || String(d.title).toLowerCase().includes(q) || String(d.category).toLowerCase().includes(q))
      .sort((a, b) => (b[1].lastAt || b[1].ts || 0) - (a[1].lastAt || a[1].ts || 0));

    let html = `<div class="kpi" style="margin-bottom:10px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
      <input class="fi" style="max-width:240px;" placeholder="🔍 Search documents…" value="${esc(_search)}" oninput="docSearch(this.value)">
      <button class="btn bta bts" onclick="docToggleForm()">${_showForm ? '✖ Close' : '⬆ Upload document'}</button>
      <span style="font-size:9px;color:var(--t3);margin-left:auto;">${list.length} documents · files in Firebase Storage, metadata in RTDB</span>
    </div><div id="doc-form-host"></div>`;

    if (!list.length) {
      html += `<div class="kpi" style="text-align:center;padding:30px;color:var(--t3);">No documents filed yet.</div>`;
    } else {
      html += `<div class="kpi" style="padding:0;overflow:auto;"><table class="tbl">
        <tr><th>Title</th><th>Category</th><th>Module</th><th>Versions</th><th>Latest</th><th>Filed by</th><th></th></tr>`;
      list.forEach(([id, d]) => {
        const vers = Object.entries(d.versions || {}).sort((a, b) => (b[1].ts || 0) - (a[1].ts || 0));
        const cur = (d.versions || {})[d.currentVersion] || (vers[0] || [])[1] || {};
        html += `<tr>
          <td style="font-weight:700;color:var(--t1);">${esc(d.title)}</td>
          <td>${esc(d.category)}</td>
          <td style="text-transform:uppercase;font-size:9px;">${esc(d.module)}</td>
          <td>v${vers.length}</td>
          <td style="font-size:9px;">${cur.fileURL ? `<a class="btn bts" href="${esc(cur.fileURL)}" target="_blank" rel="noopener">⬇ ${esc(cur.fileName)}</a> ${_fmtSize(cur.size)}` : '—'}</td>
          <td style="font-size:9px;">${esc(d.byName || '')} · ${_fmtTs(d.ts)}</td>
          <td style="white-space:nowrap;">
            <button class="btn bts" onclick="docOpen('${esc(id)}')">History</button>
            <button class="btn bts" onclick="docNewVersion('${esc(id)}')">＋ Version</button>
            <button class="btn bts" onclick="docArchive('${esc(id)}')">🗄</button></td></tr>`;
        if (_openDocId === id) {
          html += `<tr><td colspan="7" style="background:var(--card2);"><table class="tbl">` +
            vers.map(([vid, v]) =>
              `<tr><td>${vid === d.currentVersion ? '<b style="color:var(--ok);">current</b>' : ''}</td>
               <td><a href="${esc(v.fileURL)}" target="_blank" rel="noopener" style="color:var(--ac);">${esc(v.fileName)}</a></td>
               <td>${_fmtSize(v.size)}</td><td>${esc(v.note || '')}</td>
               <td style="font-size:9px;">${esc(v.byName || '')} · ${_fmtTs(v.ts)}</td></tr>`).join('') +
            `</table></td></tr>`;
        }
      });
      html += `</table></div>`;
    }
    ct.innerHTML = html;
    if (_showForm) _renderForm();
  }

  function _renderForm(forDocId) {
    const host = document.getElementById('doc-form-host');
    if (!host) return;
    const versionOf = forDocId ? DOCS.get(forDocId) : null;
    host.innerHTML = `<div class="kpi" style="margin-bottom:10px;max-width:640px;">
      <b style="font-size:11px;color:var(--t1);">${versionOf ? '＋ New version of “' + esc(versionOf.title) + '”' : '⬆ Upload document'}</b>
      ${versionOf ? '' : `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <div class="fg" style="flex:2;min-width:180px;"><label class="fl">Title *</label><input class="fi" id="doc-title"></div>
        <div class="fg" style="flex:1;"><label class="fl">Category</label><input class="fi" id="doc-cat" placeholder="Drawing / Approval / Report…"></div>
        <div class="fg" style="flex:1;"><label class="fl">Module</label>
          <select class="fs" id="doc-mod">${['general','solar','wtg','bop','land','hse'].map(m => `<option>${m}</option>`).join('')}</select></div>
      </div>`}
      <div class="fg" style="margin-top:${versionOf ? '8px' : '0'};"><label class="fl">File * (PDF/Word/Excel/PPT/CSV/image, max 10 MB)</label><input class="fi" id="doc-file" type="file"></div>
      <div class="fg"><label class="fl">Version note</label><input class="fi" id="doc-note" maxlength="300" placeholder="${versionOf ? 'What changed?' : 'Initial upload'}"></div>
      <div id="doc-err" style="color:var(--er);font-size:10px;min-height:14px;"></div>
      <button class="btn bta" id="doc-save-btn" onclick="docSave('${forDocId ? esc(forDocId) : ''}')">💾 Upload &amp; save</button>
    </div>`;
  }

  global.docSearch = function (v) { _search = v; clearTimeout(_rrT); _rrT = setTimeout(rndrDocuments, 150); };
  global.docToggleForm = function () { _showForm = !_showForm; rndrDocuments(); };
  global.docOpen = function (id) { _openDocId = _openDocId === id ? null : id; rndrDocuments(); };
  global.docNewVersion = function (id) { _showForm = true; rndrDocuments(); _renderForm(id); };
  global.docSave = function (versionOfId) {
    auth.requireRole(null, async () => {
      const err = document.getElementById('doc-err');
      const btn = document.getElementById('doc-save-btn');
      const f = document.getElementById('doc-file');
      try {
        if (!f || !f.files || !f.files[0]) throw new Error('Choose a file first.');
        if (btn) { btn.disabled = true; btn.textContent = '⏳ Uploading…'; }
        const up = await storage.uploadDocument(f.files[0], p => { if (btn) btn.textContent = '⏳ ' + p + '%'; });
        const meta = {
          fileURL: up.url, fileName: f.files[0].name, size: f.files[0].size,
          note: (document.getElementById('doc-note') || {}).value
        };
        if (versionOfId) {
          await dataApi.addDocumentVersion(versionOfId, meta);
          _openDocId = versionOfId;
        } else {
          await dataApi.addDocument({
            ...meta,
            title:    (document.getElementById('doc-title') || {}).value,
            category: (document.getElementById('doc-cat')   || {}).value,
            module:   (document.getElementById('doc-mod')   || {}).value
          });
        }
        _showForm = false;
        rndrDocuments();
      } catch (e) {
        if (err) err.textContent = '⚠️ ' + (e.message || e);
        if (btn) { btn.disabled = false; btn.textContent = '💾 Upload & save'; }
      }
    });
  };
  global.docArchive = function (id) {
    auth.requireRole('all', async () => {
      if (!confirm('Archive this document? (It stays in Storage; it just leaves the list.)')) return;
      try { await dataApi.archiveDocument(id); } catch (e) { alert(e.message || e); }
    });
  };

  global.rndrDocuments = rndrDocuments;
  global.__docCaches = { DOCS };

})(window);

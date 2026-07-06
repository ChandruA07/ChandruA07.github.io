'use strict';
// =============================================================
//  render-planning.js — schedule tasks, Gantt, critical path,
//  baseline-vs-actual variance.
//
//  Gantt: frappe-gantt (CDN, lazy-loaded on first open — same
//  approach as leaflet/chart.js elsewhere in this app). If the
//  CDN is unreachable (offline / file://), we fall back to a
//  built-in pure-CSS bar chart so the module still works — the
//  PWA shell only caches local assets.
//
//  Critical path: computed CLIENT-SIDE from predecessorIds by
//  longest-path over the task DAG (durations in days). RTDB has
//  no server-side query for this — stated plainly in the docs.
// =============================================================

(function (global) {

  const TASKS = new Map();      // taskId -> task
  let BASELINES = {};
  let _started = false;
  let _ganttLib = null;         // 'frappe' | 'fallback' | null(loading)
  let _showForm = false;
  let _editId = null;

  function _ensure() {
    if (_started || !global.realtime || !realtime.listenPlanTasks) return;
    _started = true;
    realtime.listenPlanTasks(e => {
      if (e.kind === 'remove') TASKS.delete(e.id); else TASKS.set(e.id, e.val);
      _rr();
    });
    realtime.loadBaselines().then(b => { BASELINES = b || {}; _rr(); });
  }
  let _rrT = null;
  function _rr() {
    clearTimeout(_rrT);
    _rrT = setTimeout(() => { if (typeof CV !== 'undefined' && CV === 'planning') rndrPlanning(); }, 120);
  }

  // ── date helpers ──
  const DAY = 86400000;
  function _d(iso) { return new Date(iso + 'T00:00:00'); }
  function _days(a, b) { return Math.round((_d(b) - _d(a)) / DAY) + 1; }

  /**
   * Critical path via longest-path on the DAG.
   * Returns { critical:Set<taskId>, order:string[], cyclic:boolean }.
   */
  function computeCriticalPath() {
    const ids = [...TASKS.keys()];
    const dur = {}, preds = {};
    ids.forEach(id => {
      const t = TASKS.get(id);
      dur[id] = Math.max(1, _days(t.start, t.end));
      preds[id] = Object.keys(t.predecessorIds || {}).filter(p => TASKS.has(p));
    });
    // topological order (Kahn)
    const indeg = {}; ids.forEach(id => indeg[id] = 0);
    ids.forEach(id => preds[id].forEach(() => indeg[id]++));
    const queue = ids.filter(id => indeg[id] === 0), order = [];
    const succ = {}; ids.forEach(id => succ[id] = []);
    ids.forEach(id => preds[id].forEach(p => succ[p].push(id)));
    while (queue.length) {
      const n = queue.shift(); order.push(n);
      succ[n].forEach(m => { if (--indeg[m] === 0) queue.push(m); });
    }
    if (order.length !== ids.length) return { critical: new Set(), order, cyclic: true };
    // longest path
    const dist = {}, via = {};
    order.forEach(id => {
      dist[id] = dur[id]; via[id] = null;
      preds[id].forEach(p => {
        if (dist[p] + dur[id] > dist[id]) { dist[id] = dist[p] + dur[id]; via[id] = p; }
      });
    });
    let end = null; ids.forEach(id => { if (end === null || dist[id] > dist[end]) end = id; });
    const critical = new Set();
    for (let n = end; n; n = via[n]) critical.add(n);
    return { critical, order, cyclic: false };
  }

  // ── main render ──
  function rndrPlanning() {
    _ensure();
    const ct = document.getElementById('plan-ct');
    if (!ct) return;
    const cp = computeCriticalPath();
    const tasks = [...TASKS.entries()].sort((a, b) => String(a[1].start).localeCompare(String(b[1].start)));

    let html = `<div class="kpi" style="margin-bottom:10px;display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      <button class="btn bta bts" onclick="planToggleForm()">${_showForm ? '✖ Close' : '＋ New task'}</button>
      <button class="btn bts" onclick="planSetBaseline()" data-tt="Freeze current dates as baseline (Site Manager)">📌 Set baseline</button>
      <span style="font-size:9px;color:var(--t3);margin-left:auto;">
        ${tasks.length} tasks · <span style="color:var(--er);font-weight:700;">■</span> critical path
        ${cp.cyclic ? ' · <b style="color:var(--er);">⚠ dependency cycle detected — fix predecessors</b>' : ''}
        ${Object.keys(BASELINES).length ? ' · baseline set' : ' · no baseline yet'}
      </span></div>
      <div id="plan-form-host"></div>`;

    if (!tasks.length) {
      ct.innerHTML = html + `<div class="kpi" style="text-align:center;padding:30px;color:var(--t3);">No tasks yet — add the first schedule item.</div>`;
      if (_showForm) _renderForm();
      return;
    }

    html += `<div class="kpi" style="margin-bottom:10px;padding:8px;"><div id="plan-gantt" style="overflow:auto;"></div></div>`;

    // task table with variance
    html += `<div class="kpi" style="padding:0;overflow:auto;"><table class="tbl">
      <tr><th></th><th>Task</th><th>Module</th><th>Start</th><th>End</th><th>Dur</th><th>%</th><th>Predecessors</th><th>Baseline Δ (days)</th><th></th></tr>`;
    tasks.forEach(([id, t]) => {
      const bl = BASELINES[id];
      let variance = '—', vCol = 'var(--t3)';
      if (bl && bl.end) {
        const dv = Math.round((_d(t.end) - _d(bl.end)) / DAY);
        variance = dv === 0 ? 'on baseline' : (dv > 0 ? '+' + dv + 'd late' : dv + 'd early');
        vCol = dv > 0 ? 'var(--er)' : dv < 0 ? 'var(--ok)' : 'var(--t2)';
      }
      const predNames = Object.keys(t.predecessorIds || {}).map(p => esc((TASKS.get(p) || {}).name || p)).join(', ');
      html += `<tr>
        <td>${cp.critical.has(id) ? '<span style="color:var(--er);font-weight:700;" data-tt="On the critical path">■</span>' : ''}</td>
        <td style="font-weight:600;color:var(--t1);">${esc(t.name)}</td>
        <td style="text-transform:uppercase;font-size:9px;">${esc(t.module)}</td>
        <td>${esc(t.start)}</td><td>${esc(t.end)}</td><td>${_days(t.start, t.end)}d</td>
        <td>${esc(t.progress || 0)}%</td>
        <td style="font-size:9px;max-width:180px;">${predNames || '—'}</td>
        <td style="color:${vCol};font-size:9px;font-weight:600;">${variance}</td>
        <td style="white-space:nowrap;">
          <button class="btn bts" onclick="planEdit('${esc(id)}')">✏️</button>
          <button class="btn bts" onclick="planDelete('${esc(id)}')">🗑</button></td></tr>`;
    });
    html += `</table></div>`;
    ct.innerHTML = html;
    if (_showForm) _renderForm();
    _renderGantt(tasks, cp);
  }

  // ── Gantt ──
  function _renderGantt(tasks, cp) {
    const host = document.getElementById('plan-gantt');
    if (!host) return;
    if (_ganttLib === 'frappe' && global.Gantt) { _frappe(host, tasks, cp); return; }
    if (_ganttLib === 'fallback') { _fallbackGantt(host, tasks, cp); return; }
    // lazy-load frappe-gantt once
    if (_ganttLib === null) {
      _ganttLib = 'loading';
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.min.css';
      document.head.appendChild(css);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/frappe-gantt@0.6.1/dist/frappe-gantt.min.js';
      s.onload  = () => { _ganttLib = 'frappe';   _rr(); };
      s.onerror = () => { _ganttLib = 'fallback'; console.warn('[plan] frappe-gantt CDN unreachable — using built-in bars'); _rr(); };
      document.head.appendChild(s);
    }
    _fallbackGantt(host, tasks, cp);   // show something immediately while loading
  }

  function _frappe(host, tasks, cp) {
    try {
      host.innerHTML = '';
      const gTasks = tasks.map(([id, t]) => ({
        id, name: t.name, start: t.start, end: t.end,
        progress: Number(t.progress) || 0,
        dependencies: Object.keys(t.predecessorIds || {}).join(','),
        custom_class: cp.critical.has(id) ? 'swppl-critical' : ''
      }));
      new Gantt(host, gTasks, { view_mode: 'Week', read_only: true, language: 'en' });
      if (!document.getElementById('swppl-gantt-css')) {
        const st = document.createElement('style');
        st.id = 'swppl-gantt-css';
        st.textContent = `.gantt .bar-wrapper.swppl-critical .bar{fill:var(--er)!important;}
          .gantt .bar-wrapper.swppl-critical .bar-progress{fill:#b71c1c!important;}
          .gantt .grid-background{fill:transparent;} .gantt text{fill:var(--t2);font-family:var(--f);}`;
        document.head.appendChild(st);
      }
    } catch (e) {
      console.warn('[plan] frappe render failed, using fallback:', e);
      _ganttLib = 'fallback';
      _fallbackGantt(host, tasks, cp);
    }
  }

  /** dependency-aware pure-CSS bar chart (no external lib needed) */
  function _fallbackGantt(host, tasks, cp) {
    if (!tasks.length) { host.innerHTML = ''; return; }
    let min = tasks[0][1].start, max = tasks[0][1].end;
    tasks.forEach(([, t]) => { if (t.start < min) min = t.start; if (t.end > max) max = t.end; });
    const span = Math.max(1, _days(min, max));
    let h = `<div style="font-size:8px;color:var(--t3);margin-bottom:4px;">${esc(min)} — ${esc(max)} (${span} days)${_ganttLib === 'loading' ? ' · loading interactive Gantt…' : ''}</div>`;
    tasks.forEach(([id, t]) => {
      const left = (_days(min, t.start) - 1) / span * 100;
      const w = _days(t.start, t.end) / span * 100;
      const crit = cp.critical.has(id);
      h += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
        <div style="width:160px;min-width:160px;font-size:9px;color:var(--t2);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.name)}</div>
        <div style="flex:1;height:14px;background:var(--bg3);border-radius:4px;position:relative;">
          <div data-tt="${esc(t.name)}: ${esc(t.start)} → ${esc(t.end)} · ${esc(t.progress || 0)}%${crit ? ' · CRITICAL' : ''}"
               style="position:absolute;left:${left}%;width:${Math.max(w, 0.5)}%;height:100%;border-radius:4px;
               background:${crit ? 'var(--er)' : 'var(--ac)'};opacity:.85;">
            <div style="height:100%;width:${Math.max(0, Math.min(100, Number(t.progress) || 0))}%;background:rgba(255,255,255,.3);border-radius:4px;"></div>
          </div></div></div>`;
    });
    host.innerHTML = h;
  }

  // ── form ──
  function _renderForm() {
    const host = document.getElementById('plan-form-host');
    if (!host) return;
    const t = _editId ? TASKS.get(_editId) : null;
    const predOpts = [...TASKS.entries()].filter(([id]) => id !== _editId)
      .map(([id, x]) => `<option value="${esc(id)}" ${t && t.predecessorIds && t.predecessorIds[id] ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
    host.innerHTML = `<div class="kpi" style="margin-bottom:10px;max-width:720px;">
      <b style="font-size:11px;color:var(--t1);">${t ? '✏️ Edit task' : '＋ New task'}</b>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <div class="fg" style="flex:2;min-width:180px;"><label class="fl">Task name *</label><input class="fi" id="pl-name" value="${t ? esc(t.name) : ''}"></div>
        <div class="fg" style="flex:1;"><label class="fl">Module</label>
          <select class="fs" id="pl-mod">${['solar','wtg','bop','land','general'].map(m => `<option ${t && t.module === m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <div class="fg" style="flex:1;"><label class="fl">Start *</label><input class="fi" id="pl-start" type="date" value="${t ? esc(t.start) : ''}"></div>
        <div class="fg" style="flex:1;"><label class="fl">End *</label><input class="fi" id="pl-end" type="date" value="${t ? esc(t.end) : ''}"></div>
        <div class="fg" style="width:90px;"><label class="fl">Progress %</label><input class="fi" id="pl-prog" type="number" min="0" max="100" value="${t ? esc(t.progress || 0) : 0}"></div>
      </div>
      <div class="fg"><label class="fl">Predecessors (Ctrl-click for multiple)</label>
        <select class="fs" id="pl-preds" multiple size="4">${predOpts}</select></div>
      <div id="pl-err" style="color:var(--er);font-size:10px;min-height:14px;"></div>
      <button class="btn bta" onclick="planSave()">💾 ${t ? 'Update' : 'Create'} task</button>
      ${t ? '<button class="btn" onclick="planEdit(null)">Cancel edit</button>' : ''}
    </div>`;
  }

  // ── actions ──
  global.planToggleForm = function () { _showForm = !_showForm; if (!_showForm) _editId = null; rndrPlanning(); };
  global.planEdit = function (id) { _editId = id; _showForm = !!id || _showForm; rndrPlanning(); };
  global.planSave = function () {
    auth.requireRole('planner', async () => {
      const err = document.getElementById('pl-err');
      const sel = document.getElementById('pl-preds');
      const preds = sel ? [...sel.selectedOptions].map(o => o.value) : [];
      const payload = {
        name:  (document.getElementById('pl-name')  || {}).value,
        module:(document.getElementById('pl-mod')   || {}).value,
        start: (document.getElementById('pl-start') || {}).value,
        end:   (document.getElementById('pl-end')   || {}).value,
        progress: (document.getElementById('pl-prog') || {}).value,
        predecessorIds: preds
      };
      try {
        if (_editId) await dataApi.updatePlanTask(_editId, payload);
        else await dataApi.addPlanTask(payload);
        _showForm = false; _editId = null;
        rndrPlanning();
      } catch (e) { if (err) err.textContent = '⚠️ ' + (e.message || e); }
    });
  };
  global.planDelete = function (id) {
    auth.requireRole('planner', async () => {
      if (!confirm('Delete this task? (Blocked if other tasks depend on it.)')) return;
      try { await dataApi.deletePlanTask(id); } catch (e) { alert(e.message || e); }
    });
  };
  global.planSetBaseline = function () {
    auth.requireRole('all', async () => {
      if (!confirm('Freeze the CURRENT start/end of every task as the baseline?')) return;
      try {
        await dataApi.setPlanBaseline();
        BASELINES = await realtime.loadBaselines();
        rndrPlanning();
      } catch (e) { alert(e.message || e); }
    });
  };

  global.rndrPlanning = rndrPlanning;
  global.__planCaches = { TASKS, computeCriticalPath };

})(window);

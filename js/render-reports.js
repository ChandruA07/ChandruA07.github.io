'use strict';
// =============================================================
//  render-reports.js — cross-module analytics.
//
//  HONESTY NOTE (repeated in docs/SCALABILITY.md): RTDB has NO
//  aggregation engine. Every number on this page is computed in
//  the browser from data the module caches already hold
//  (__procCaches / __invCaches / __planCaches + module DB state).
//  At a few thousand records this is fine; beyond that these
//  rollups belong in a Cloud Function writing to /rollups.
// =============================================================

(function (global) {

  let _charts = {};

  function _destroyCharts() {
    Object.values(_charts).forEach(c => { try { c.destroy(); } catch (e) {} });
    _charts = {};
  }

  function rndrReports() {
    const ct = document.getElementById('reports-ct');
    if (!ct) return;
    // Make sure the source modules' Firebase listeners are attached even if
    // the user opens Reports before ever visiting those views (each renderer
    // attaches its listeners on first call and is cheap when its view is hidden).
    _attachSources();

    const proc = global.__procCaches || { VND: new Map(), POS: new Map() };
    const inv  = global.__invCaches  || { ITEMS: new Map(), LEDGER: new Map(), computeStock: () => ({}) };
    const plan = global.__planCaches || { TASKS: new Map(), computeCriticalPath: () => ({ critical: new Set() }) };

    // ── PO stats ──
    const poByStatus = {};
    let poTotal = 0;
    proc.POS.forEach(p => { poByStatus[p.status] = (poByStatus[p.status] || 0) + 1; poTotal += Number(p.totalValue) || 0; });
    // vendor spend (client-side scan of full PO node — RTDB has no GROUP BY)
    const vendorSpend = {};
    proc.POS.forEach(p => {
      if (p.status === 'cancelled') return;
      vendorSpend[p.vendorName] = (vendorSpend[p.vendorName] || 0) + (Number(p.totalValue) || 0);
    });
    const topVendors = Object.entries(vendorSpend).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // ── inventory stats ──
    const stock = inv.computeStock();
    const lowCount = [...inv.ITEMS.entries()].filter(([id, it]) => it.status !== 'archived' && (stock[id] || 0) < (Number(it.minStock) || 0)).length;
    let ins = 0, outs = 0;
    inv.LEDGER.forEach(m => { if (m.type === 'in') ins++; else if (m.type === 'out') outs++; });

    // ── planning stats ──
    const cp = plan.computeCriticalPath();
    let done = 0, total = plan.TASKS.size, avgProg = 0;
    plan.TASKS.forEach(t => { avgProg += Number(t.progress) || 0; if ((Number(t.progress) || 0) >= 100) done++; });
    avgProg = total ? Math.round(avgProg / total) : 0;

    // ── site progress (existing modules, via legacy DB globals) ──
    const siteProg = {
      Solar: typeof calcSolarProg === 'function' ? Math.round(calcSolarProg()) : 0,
      WTG:   typeof calcWtgProg   === 'function' ? Math.round(calcWtgProg())   : 0,
      BOP:   typeof calcBopProg   === 'function' ? Math.round(calcBopProg())   : 0
    };

    const kpi = (label, val, col, sub) => `<div class="kpi" style="text-align:center;">
      <div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:1px;">${label}</div>
      <div style="font-family:var(--f2);font-size:22px;font-weight:700;color:${col};">${val}</div>
      ${sub ? `<div style="font-size:8px;color:var(--t3);">${sub}</div>` : ''}</div>`;

    ct.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:12px;">
        ${kpi('Open POs', (poByStatus.draft || 0) + (poByStatus.approved || 0), 'var(--ac)', 'draft + approved')}
        ${kpi('PO value (all)', '₹' + (poTotal / 100000).toFixed(1) + 'L', 'var(--ok)', proc.POS.size + ' POs · ' + proc.VND.size + ' vendors')}
        ${kpi('Low-stock items', lowCount, lowCount ? 'var(--er)' : 'var(--ok)', ins + ' in / ' + outs + ' out mvmts')}
        ${kpi('Schedule tasks', total, 'var(--wtg)', done + ' done · avg ' + avgProg + '%')}
        ${kpi('Critical path', cp.critical.size, 'var(--er)', 'tasks on longest path')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:10px;">
        <div class="kpi"><b style="font-size:11px;color:var(--t1);">PO pipeline by status</b><canvas id="rep-po" height="180"></canvas></div>
        <div class="kpi"><b style="font-size:11px;color:var(--t1);">Vendor spend (top 8)</b>
          <div style="font-size:8px;color:var(--t3);">Computed client-side by scanning all POs — RTDB has no GROUP BY.</div>
          <canvas id="rep-vendor" height="180"></canvas></div>
        <div class="kpi"><b style="font-size:11px;color:var(--t1);">Site execution progress</b><canvas id="rep-site" height="180"></canvas></div>
      </div>
      <div style="font-size:9px;color:var(--t3);margin-top:10px;">
        All figures on this page are assembled in the browser from the live module caches. At higher data volumes
        these rollups should move to a scheduled Cloud Function writing to a <code>/rollups</code> node — see docs/SCALABILITY.md.
      </div>`;

    _destroyCharts();
    if (typeof Chart === 'undefined') return;
    const gridCol = 'rgba(138,172,207,.12)';
    const el1 = document.getElementById('rep-po');
    if (el1) _charts.po = new Chart(el1, {
      type: 'doughnut',
      data: {
        labels: Object.keys(poByStatus),
        datasets: [{ data: Object.values(poByStatus), backgroundColor: ['#ffca28', '#00c8ff', '#7c4dff', '#00e676', '#ff5252'] }]
      },
      options: { plugins: { legend: { position: 'bottom', labels: { color: '#8aaccf', font: { size: 9 } } } } }
    });
    const el2 = document.getElementById('rep-vendor');
    if (el2) _charts.vendor = new Chart(el2, {
      type: 'bar',
      data: { labels: topVendors.map(v => v[0]), datasets: [{ data: topVendors.map(v => Math.round(v[1] / 1000)), backgroundColor: '#00c8ff', label: '₹ thousand' }] },
      options: { indexAxis: 'y', plugins: { legend: { display: false } },
        scales: { x: { grid: { color: gridCol }, ticks: { color: '#8aaccf', font: { size: 8 } } }, y: { grid: { display: false }, ticks: { color: '#8aaccf', font: { size: 8 } } } } }
    });
    const el3 = document.getElementById('rep-site');
    if (el3) _charts.site = new Chart(el3, {
      type: 'bar',
      data: { labels: Object.keys(siteProg), datasets: [{ data: Object.values(siteProg), backgroundColor: ['#ffaa00', '#7c4dff', '#ff5722'], label: '% complete' }] },
      options: { plugins: { legend: { display: false } },
        scales: { y: { min: 0, max: 100, grid: { color: gridCol }, ticks: { color: '#8aaccf', font: { size: 8 } } }, x: { grid: { display: false }, ticks: { color: '#8aaccf', font: { size: 9 } } } } }
    });
  }

  // Poke the other modules so their Firebase listeners attach even if the
  // user opens Reports before ever visiting those views.
  function _attachSources() {
    try { if (typeof rndrProcurement === 'function') rndrProcurement(); } catch (e) {}
    try { if (typeof rndrInventory   === 'function') rndrInventory();   } catch (e) {}
    try { if (typeof rndrPlanning    === 'function') rndrPlanning();    } catch (e) {}
  }

  global.rndrReports = rndrReports;

})(window);

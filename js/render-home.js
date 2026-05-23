//  HOME
// ═══════════════════════════════════════════════════════════
//
// FIX 4 — auth gate helpers.
//
// The old gates checked `if(!CU || CU.isViewer)`. CU is mirrored
// from auth.current() via state-bridge's onChange listener, but
// there's a one-tick gap immediately after page reload where CU
// can still be null even though auth.canEdit() is already true
// (sessionStorage already has the unlock). Result: clicking
// Raise ROW / Add Milestone / Edit BOP fired "Login Required"
// even though the user was effectively logged in.
//
// _ensureCU() reads auth.current() directly and lazily synthesises
// a CU-shaped object so the rest of the renderer (which inlines
// `${CU.name}`, `${CU.role}`, etc.) keeps working unchanged.
// _requireUnlock(retryFn) opens the existing demo-password modal
// when not unlocked, and re-runs the protected handler on success.
// ═══════════════════════════════════════════════════════════
function _ensureCU(){
  if (window.CU && !window.CU.isViewer) return window.CU;
  if (typeof auth === 'undefined' || !auth.canEdit || !auth.canEdit()) return null;
  // auth.canEdit() === true but CU not yet mirrored — synthesise from auth.current()
  const p = auth.current() || { uid:'demo', name:'Site Engineer', role:'admin' };
  const synth = {
    uid: p.uid, name: p.name, email: p.email,
    role: p.role === 'admin' ? 'all' : p.role,
    isAdmin: p.role === 'admin',
    isSolar: p.role === 'admin' || p.role === 'solar',
    isWtg:   p.role === 'admin' || p.role === 'wtg',
    isBop:   p.role === 'admin' || p.role === 'bop',
    isLand:  p.role === 'admin' || p.role === 'land',
    isViewer:p.role === 'viewer'
  };
  window.CU = synth;
  return synth;
}
function _requireUnlock(retryFn){
  // Already unlocked? Run immediately.
  if (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit()) {
    _ensureCU();
    return true;
  }
  // Not unlocked — open the modal and re-run the caller on success.
  if (typeof auth !== 'undefined' && auth.requireRole) {
    auth.requireRole('admin', () => {
      _ensureCU();
      try { retryFn && retryFn(); } catch (e) {}
    });
  } else if (typeof showToast === 'function') {
    showToast('🔒 Login required','er');
  }
  return false;
}

function updateOverallBars(){
  const sol=calcSolarProg(),wtg=calcWtgProg(),land=calcLandProg(),bop=calcBopProg(),tot=calcOverall();
  [['mc-sol','bar-sol',sol],['mc-wtg','bar-wtg',wtg],['mc-land','bar-land',land],['mc-bop','bar-bop',bop]].forEach(([mv,bv,v])=>{
    const e=document.getElementById(mv);if(e)e.textContent=v+'%';
    const b=document.getElementById(bv);if(b)b.style.width=v+'%';
  });
  const b33=calcBop33PctV2(),b66=calcBop66PctV2(),pss=calcPssPct(),gss=calcGssPct();
  [['bop33-pct','bop33-bar',b33,'var(--kv3)'],['bop66-pct','bop66-bar',b66,'var(--kv6)'],
   ['boppss-pct','boppss-bar',pss,'var(--pss)'],['bopgss-pct','bopgss-bar',gss,'var(--gss)']].forEach(([p,b,v,c])=>{
    const pe=document.getElementById(p);if(pe)pe.textContent=v+'%';
    const be=document.getElementById(b);if(be){be.style.width=v+'%';be.style.background=c;}
  });
  return {sol,wtg,land,bop,tot};
}

// ═══════════════════════════════════════════════════════════
//  DAILY WORK TABLE — Dashboard ROW 2 (replaces chart-strip)
//
//  Columns:
//   1. POD                    — vendor-submitted Plan of Day, grouped by module
//   2. Live / Today's Work    — derived from POD.status (wip → live, done → today)
//   3. Pending Work / Remarks — auto-calculated (planned − completed) + remark text
//   4. Next Day Plan          — vendor/authorized-person entries for tomorrow
//
//  All editing happens on the Solar/WTG/BOP subpages.
//  This view is strictly read-only.
// ═══════════════════════════════════════════════════════════
function _wtModuleLabel(m){
  return ({s:'SOLAR', w:'WTG', b:'BOP', l:'LAND'})[m] || '';
}
function _wtModuleIcon(m){
  if (m==='s') return (typeof _solImg  === 'function') ? _solImg(13)  : '☀️';
  if (m==='w') return (typeof _turbImg === 'function') ? _turbImg(13) : '🌀';
  if (m==='b') return (typeof _bopImg  === 'function') ? _bopImg(13)  : '⚙️';
  return '📍';
}
function _wtPodLocation(pod){
  // Extract the prefix (ITC-x / MKD-xxx / 33kV / 66kV / PSS / GSS) from the activity label.
  if (!pod || !pod.activity) return '';
  const m = String(pod.activity).split('›');
  return (m.length > 1) ? m[0].trim() : '';
}
function _wtPodActivity(pod){
  if (!pod || !pod.activity) return '—';
  const parts = String(pod.activity).split('›');
  return (parts.length > 1) ? parts.slice(1).join('›').trim() : pod.activity;
}
function _wtTodayPodEntries(){
  // Filter to today's POD entries only (across all modules).
  const today = (typeof dataApi !== 'undefined' && dataApi.todayISO) ? dataApi.todayISO()
    : new Date().toISOString().slice(0,10);
  const all = [];
  ['s','w','b'].forEach(m => {
    (DB.pod[m] || []).forEach(p => {
      if (p.date === today) all.push(Object.assign({_mod: m}, p));
    });
  });
  return all;
}
function _wtNextDayPodEntries(){
  // Tomorrow's nextDayPlan entries across modules
  const d = new Date(); d.setDate(d.getDate() + 1);
  const tomorrow = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  const out = [];
  ['s','w','b'].forEach(m => {
    ((DB.nextDayPlan && DB.nextDayPlan[m]) || []).forEach(p => {
      if (p.forDate === tomorrow) out.push(Object.assign({_mod: m}, p));
    });
  });
  return out;
}

function renderHomeWorkTable(){
  const host = document.getElementById('home-work-table');
  if (!host) return;
  const dateEl = document.getElementById('home-work-table-date');
  const today = (typeof dataApi !== 'undefined' && dataApi.todayISO) ? dataApi.todayISO()
    : new Date().toISOString().slice(0,10);
  if (dateEl) dateEl.textContent = 'Today: ' + today;

  const pods = _wtTodayPodEntries();
  const nextDay = _wtNextDayPodEntries();

  // Group POD by module
  const byMod = {s:[], w:[], b:[]};
  pods.forEach(p => { if (byMod[p._mod]) byMod[p._mod].push(p); });
  // Group next day plans by module
  const ndByMod = {s:[], w:[], b:[]};
  nextDay.forEach(p => { if (ndByMod[p._mod]) ndByMod[p._mod].push(p); });

  const modLabels = {s:'Solar', w:'WTG', b:'BOP'};
  const modNav    = {s:'solar', w:'wtg',  b:'bop'};
  const modCol    = {s:'var(--sol)', w:'var(--wtg)', b:'var(--bop)'};

  let rows = '';
  ['s','w','b'].forEach(m => {
    const podRows  = byMod[m];
    const ndRows   = ndByMod[m];
    // If everything empty for this module, still show a row with placeholders so the user sees the structure.
    if (!podRows.length && !ndRows.length) {
      rows += `
        <tr class="wt-mod-${m}">
          <td>
            <div class="wt-modhdr ${m}">${_wtModuleIcon(m)} ${modLabels[m]}</div>
            <div class="wt-empty-cell">No POD submitted for today.<br>
              <a style="color:${modCol[m]};font-weight:600;cursor:pointer;" onclick="nav('pod')">+ Submit POD</a>
            </div>
          </td>
          <td><div class="wt-empty-cell">No work in progress.</div></td>
          <td><div class="wt-empty-cell">—</div></td>
          <td>
            <div class="wt-empty-cell">No next-day plan.<br>
              <a style="color:${modCol[m]};font-weight:600;cursor:pointer;" onclick="nav('${modNav[m]}')">Add from ${modLabels[m]} →</a>
            </div>
          </td>
        </tr>`;
      return;
    }

    // ── Col 1: POD — bullet list grouped by location ──
    const podCellHtml = podRows.length ? (() => {
      // sub-group by location prefix so it reads like "ITC-1 → piling, trench"
      const byLoc = {};
      podRows.forEach(p => {
        const loc = _wtPodLocation(p) || 'General';
        (byLoc[loc] = byLoc[loc] || []).push(p);
      });
      return `<div class="wt-modhdr ${m}">${_wtModuleIcon(m)} ${modLabels[m]}</div>
        <ul class="wt-pod-ul">
          ${Object.entries(byLoc).map(([loc, items]) => items.map(p => {
            const act = _wtPodActivity(p);
            const qty = p.qty != null && +p.qty > 0 ? ` – target ${p.qty}` : '';
            return `<li><span class="wt-loc">${loc}</span> <b>${act}</b>${qty}</li>`;
          }).join('')).join('')}
        </ul>`;
    })() : `<div class="wt-modhdr ${m}">${_wtModuleIcon(m)} ${modLabels[m]}</div>
            <div class="wt-empty-cell">No POD submitted for today.</div>`;

    // ── Col 2: Live / Today's Work — derived from status (wip → live, done → today) ──
    const liveCellHtml = (() => {
      const wip  = podRows.filter(p => p.status === 'wip');
      const done = podRows.filter(p => p.status === 'done');
      if (!wip.length && !done.length) {
        return `<div class="wt-empty-cell">No work updates from authorized person yet.</div>`;
      }
      const rowsHtml = [];
      // WIP first (live work)
      wip.forEach(p => {
        const act = _wtPodActivity(p);
        const loc = _wtPodLocation(p);
        const planned = +p.qty || 0;
        const prog    = +p.progress || 0;
        const pct     = planned > 0 ? Math.min(100, Math.round(prog/planned*100)) : 0;
        rowsHtml.push(`
          <div class="wt-live-row">
            <span class="wt-status-chip wt-status-wip">WIP</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:10px;color:var(--t1);"><b>${loc?loc+': ':''}</b>${act}</div>
              <div class="wt-progress-text"><b>${prog}</b> / ${planned||'—'} ${planned?'('+pct+'%)':''}</div>
              ${planned ? `<div class="wt-live-bar"><div style="width:${pct}%"></div></div>` : ''}
            </div>
          </div>`);
      });
      // Done after
      done.forEach(p => {
        const act = _wtPodActivity(p);
        const loc = _wtPodLocation(p);
        const completed = p.progress != null ? +p.progress : (+p.qty || 0);
        rowsHtml.push(`
          <div class="wt-live-row">
            <span class="wt-status-chip wt-status-done">✓ Done</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:10px;color:var(--t1);"><b>${loc?loc+': ':''}</b>${act}</div>
              <div class="wt-progress-text">Completed: <b style="color:var(--ok);">${completed}</b></div>
            </div>
          </div>`);
      });
      return rowsHtml.join('');
    })();

    // ── Col 3: Pending Work / Remarks ──
    const pendingCellHtml = (() => {
      const pending = podRows.filter(p => {
        const planned = +p.qty || 0;
        const completed = p.status === 'done' ? (p.progress != null ? +p.progress : planned)
                       :  p.status === 'wip'  ? (+p.progress || 0)
                       :  0;
        return planned > 0 && completed < planned;
      });
      // Also include any explicitly NYS entries — they're "pending" from minute one.
      const nys = podRows.filter(p => p.status === 'nys' && (+p.qty||0) > 0);
      const all = [...pending, ...nys.filter(n => !pending.includes(n))];
      if (!all.length) {
        // All planned work either completed in full or no planned work yet.
        if (podRows.some(p => p.status === 'done')) {
          return `<div style="color:var(--ok);font-size:10px;font-weight:600;">✓ All planned work completed on target.</div>`;
        }
        return `<div class="wt-empty-cell">—</div>`;
      }
      return all.map(p => {
        const planned   = +p.qty || 0;
        const completed = p.status === 'done' ? (p.progress != null ? +p.progress : planned)
                       :  p.status === 'wip'  ? (+p.progress || 0)
                       :  0;
        const remaining = Math.max(0, planned - completed);
        const act = _wtPodActivity(p);
        const loc = _wtPodLocation(p);
        return `
          <div class="wt-pending-row">
            <div style="font-size:9px;color:var(--t2);">${loc?'<b style="color:var(--t1);">'+loc+'</b>: ':''}${act}</div>
            <div class="wt-pending-qty">Pending: ${remaining}${planned?' / '+planned:''}</div>
            ${p.remark ? `<div class="wt-remark">${esc(p.remark)}</div>`
              : (p.status==='nys'
                  ? `<div class="wt-remark" style="color:var(--er);">Not started yet — remark pending</div>`
                  : `<div class="wt-remark" style="color:var(--wn);">No remark provided yet</div>`)}
          </div>`;
      }).join('');
    })();

    // ── Col 4: Next Day Plan ──
    const ndCellHtml = ndRows.length
      ? (() => {
          const byLoc = {};
          ndRows.forEach(p => {
            const loc = _wtPodLocation(p) || 'General';
            (byLoc[loc] = byLoc[loc] || []).push(p);
          });
          return `<ul class="wt-nextday-ul">
            ${Object.entries(byLoc).map(([loc, items]) => items.map(p => {
              const act = _wtPodActivity(p);
              const qty = p.qty != null && +p.qty > 0 ? ` – ${p.qty}` : '';
              return `<li><span class="wt-loc">${loc}</span> <b>${act}</b>${qty}</li>`;
            }).join('')).join('')}
          </ul>`;
        })()
      : `<div class="wt-empty-cell">Not set yet.<br>
          <a style="color:${modCol[m]};font-weight:600;cursor:pointer;" onclick="nav('${modNav[m]}')">Add from ${modLabels[m]} →</a>
        </div>`;

    rows += `
      <tr class="wt-mod-${m}">
        <td>${podCellHtml}</td>
        <td>${liveCellHtml}</td>
        <td>${pendingCellHtml}</td>
        <td>${ndCellHtml}</td>
      </tr>`;
  });

  host.innerHTML = `
    <table class="work-tbl">
      <thead>
        <tr>
          <th style="width:26%;">📋 POD (Plan of Day)</th>
          <th style="width:28%;">⚡ Live / Today's Work</th>
          <th style="width:22%;">⏳ Pending Work / Remarks</th>
          <th style="width:24%;">➜ Next Day Plan</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div style="margin-top:9px;font-size:10.5px;color:var(--t3);text-align:right;">
      🔒 Editing controls (status, remarks, next-day plan) are restricted to the
      <a style="color:var(--sol);font-weight:700;cursor:pointer;" onclick="nav('solar')">Solar</a> /
      <a style="color:var(--wtg);font-weight:700;cursor:pointer;" onclick="nav('wtg')">WTG</a> /
      <a style="color:var(--bop);font-weight:700;cursor:pointer;" onclick="nav('bop')">BOP</a> subpages.
    </div>`;
}

// Helper: escape (fallback if esc() not in scope)
if (typeof esc !== 'function') {
  window.esc = function(s){ return String(s||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); };
}

// ═══════════════════════════════════════════════════════════
//  DAILY PROGRESS GENERATOR
//  Builds today's progress feed dynamically from Solar/WTG inputs.
//  Source = sub-activity updates (subDone) + civil/mech %ages with `today` markers.
//  This drives all dashboard comparisons (Daily Progress vs POD).
// ═══════════════════════════════════════════════════════════
function buildDailyProgressFeed(){
  const feed=[];
  // ── Authoritative source: DB.dailyProgress (populated by Solar/WTG inputs) ──
  // Latest entries from the last 7 days are surfaced first.
  const cutoff = Date.now() - 7*24*60*60*1000;
  (DB.dailyProgress||[]).forEach(e=>{
    if(!e || e.ts<cutoff)return;
    const isSol = e.module==='Solar';
    let title, detail;
    if(isSol){
      title  = `${e.itc||''} — ${e.act||''}${e.sub?' · '+e.sub:''}`;
      detail = e.sub ? `Updated to ${e.val} (activity ${e.pct}%)` : `+${e.today||0}% today (cumulative ${e.pct}%)`;
    }else{
      title  = `${e.turbine||''} — ${e.act||''}`;
      detail = `Updated to ${e.pct}%`;
    }
    feed.push({
      module:e.module, icon:isSol?'☀️':'⚡',
      col: isSol?'var(--sol)':'var(--wtg)',
      title, detail, ts:e.ts, by:e.by||'',
    });
  });
  // ── Fallback: Solar activities flagged with today>0 (legacy entries) ──
  Object.entries(DB.solar.itcs||{}).forEach(([id,d])=>{
    (d.acts||[]).forEach(a=>{
      if((a.today||0)>0){
        const dup=feed.some(f=>f.module==='Solar' && f.title.includes(a.n) && f.title.includes(id));
        if(!dup){
          feed.push({
            module:'Solar', icon:'☀️', col:'var(--sol)',
            title:`${id} — ${a.n}`,
            detail:`+${a.today}% today (cumulative ${a.done}%)`,
            ts:Date.now(),
          });
        }
      }
    });
  });
  // ── WTG status milestones (recent ready-for-erection signals) ──
  (DB.wtg.turbines||[]).forEach(t=>{
    const p=calcTurbProg(t);
    if(t.status==='ready'){
      const dup=feed.some(f=>f.title.includes(t.id) && f.title.toLowerCase().includes('ready'));
      if(!dup){
        feed.push({module:'WTG', icon:'⚡', col:'var(--wtg)',
          title:`${t.id} — Ready for Erection`,
          detail:`Foundation 100% · ${p}% overall`, ts:Date.now()});
      }
    }
  });
  feed.sort((a,b)=>b.ts-a.ts);
  return feed;
}

function rndrHome(){
  const {sol,wtg,land,bop,tot}=updateOverallBars();
  const totalMp=14+DB.mp.sol+DB.mp.wtg+DB.mp.bop;
  const rowCnt=(DB.rowIssues||[]).filter(r=>(r.status||'Open')==='Open').length;

  // ── ROW 1: SQUARE KPI CARDS ──────────────────────────────────────────────
  document.getElementById('home-kpi-row').innerHTML=[
    {label:'Overall Progress',val:tot+'%',       sub:'140.6 MW Total',   col:'var(--ac)',  icon:'continuumlogo.png',nav:'home',  tip:'Overall project progress across WTG, Solar, BOP and Land'},
    {label:'Land Progress',   val:land+'%',       sub:'WTG + Solar',     col:'var(--land)',icon:'land.png',          nav:'land',  tip:'Land acquisition and documentation progress'},
    {label:'Solar Progress',  val:sol+'%',        sub:'70.4 MW',         col:'var(--sol)', icon:'solar.png',         nav:'solar', tip:'Solar 70.4MW across 6 ITCs — MW-weighted'},
    {label:'WTG Progress',    val:wtg+'%',        sub:'70.2 MW',         col:'var(--wtg)', icon:'turbine.png',       nav:'wtg',   tip:'WTG 70.2MW — 26 turbines Civil+Mech+USS+Supply'},
    {label:'BOP Progress',    val:bop+'%',        sub:'4 Sections',      col:'var(--bop)', icon:'bop.png',           nav:'bop',   tip:'33kV + 66kV + PSS + GSS combined progress'},
    {label:'Total Manpower',  val:String(totalMp),sub:'On site today',   col:'var(--ok)', icon:null,nav:'manpower',  id:'kpi-mp',tip:'Total workers on site: Solar + WTG + BOP + Management'},
    {label:'ROW Issues',      val:String(rowCnt), sub:'Open Locations',  col:'var(--er)', icon:null,nav:'home',      tip:'Right-of-way issues blocking construction'},
  ].map(k=>`
    <div class="sq-kpi" style="border-left:4px solid ${k.col};cursor:pointer;padding:14px 12px;" onclick="nav('${k.nav}')" data-tt="${k.tip}">
      <div style="display:flex;align-items:center;gap:7px;margin-bottom:6px;">
        ${k.icon
          ? `<img src="${k.icon}" style="width:22px;height:22px;object-fit:contain;" onerror="this.style.display='none'">`
          : `<div style="width:22px;height:22px;background:${k.col};border-radius:5px;opacity:.35;"></div>`}
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:var(--t2);">${k.label}</div>
      </div>
      <div style="font-family:var(--f2);font-size:30px;font-weight:800;color:${k.col};line-height:1;letter-spacing:-1px;"${k.id?` id="${k.id}"`:''}>${k.val}</div>
      <div style="font-size:9px;color:var(--t3);margin-top:4px;font-weight:500;">${k.sub}</div>
      <div style="height:3px;background:${k.col};opacity:.2;border-radius:2px;margin-top:8px;"></div>
    </div>`).join('');

  // ── ROW 2: DAILY WORK TABLE (replaces chart-strip) ────────────────────────
  // 4-column read-only table: POD | Live/Today | Pending/Remarks | Next Day Plan
  // Editing controls live on the Solar / WTG / BOP subpages only.
  renderHomeWorkTable();

  // ── ROW 3: Row Tracker | S-Curve | Milestones ─────────────────────────────
  // The "POD & Daily Progress" panel was REMOVED per requirements; its slot
  // is now occupied by the Row Tracker (renderRowTracker below).
  // (Manpower section was previously removed; ROW Tracker is now top-level.)

  // ── ROW 3 RIGHT: S-Curve Chart + Milestones ─────────────────────────────
  const sc=DB.schedule;
  // Populate the dynamic date range header above the S-curve chart.
  const _rangeEl = document.getElementById('home-scurve-range');
  if (_rangeEl && sc && Array.isArray(sc.labels) && sc.labels.length) {
    _rangeEl.textContent = sc.labels[0] + ' – ' + sc.labels[sc.labels.length - 1];
  }
  const fi=sc.actual.findLastIndex(v=>v!==null);
  const lastActual = sc.actual[fi]||0;
  const remainSteps = sc.labels.length - 1 - fi;
  const sCurve = sc.labels.map((_,i)=>{
    if(i<=fi) return null;
    const t = (i - fi) / remainSteps;
    const s = 1 / (1 + Math.exp(-10*(t-0.5)));
    const sMin = 1 / (1 + Math.exp(-10*(0-0.5)));
    const sMax = 1 / (1 + Math.exp(-10*(1-0.5)));
    const normalized = (s - sMin) / (sMax - sMin);
    return R(lastActual + (100 - lastActual) * normalized);
  });
  mkC('ch-pva',{type:'line',data:{labels:sc.labels,datasets:[
    {label:'Planned', data:sc.planned,  borderColor:'rgba(0,200,255,.9)',backgroundColor:'rgba(0,200,255,.12)',tension:.45,pointRadius:4,pointHoverRadius:6,fill:true,borderWidth:2.5},
    {label:'Actual',  data:sc.actual,   borderColor:'rgba(0,230,118,.9)',backgroundColor:'rgba(0,230,118,.12)',tension:.45,pointRadius:5,pointHoverRadius:7,fill:true,borderWidth:2.5,spanGaps:false},
    {label:'S-Curve Forecast',data:sCurve,borderColor:'rgba(255,202,40,.9)',backgroundColor:'rgba(255,202,40,.08)',tension:.5,pointRadius:3,borderDash:[],fill:true,borderWidth:2.5,spanGaps:false},
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{position:'top',labels:{boxWidth:12,font:{size:9},padding:10}},
      tooltip:{callbacks:{label:ctx=>` ${ctx.dataset.label}: ${ctx.raw!=null?ctx.raw+'%':'—'}`}}},
    scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:8}},grid:{color:'rgba(255,255,255,.04)'}},
      x:{ticks:{font:{size:8}},grid:{display:false}}}}});

  // ── ROW TRACKER (moved to its own panel, see view-home.html) ───────────
  renderRowTracker();

  // ── Scheduled Milestones — click to edit (auth-protected) ──────────────
  const mEl=document.getElementById('home-milestones');
  if(mEl){
    const milestones = (DB.milestones||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
    mEl.innerHTML = milestones.map(m=>{
      const title = m.title || m.label || '—';
      const today = new Date(); const md = m.date ? new Date(m.date) : null;
      const diff  = md ? Math.ceil((md-today)/(1000*60*60*24)) : 999;
      const cls   = diff<0?'tdn':diff<=7?'tnx':'tpd';
      const lbl   = !md ? '—' : diff<0 ? `${Math.abs(diff)}d ago` : diff===0?'TODAY!':diff<=30?`${diff}d`:(m.date||'').slice(5);
      return `<div class="tli ${cls}" style="margin-bottom:3px;padding:4px 6px;cursor:pointer;" onclick="openMilestoneEdit('${m.id||''}')" data-tt="Click to edit (auth required)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
          <div class="ttx" style="font-size:9px;flex:1;">${title}</div>
          <span class="chip ${diff<0?'cr':diff<=7?'cy':'cb'}" style="font-size:7px;white-space:nowrap;">${lbl}</span>
        </div>
      </div>`;
    }).join('') || `<div style="color:var(--t3);font-size:9px;padding:4px;">No milestones.</div>`;
  }


  // POD count
  const podCt=document.getElementById('mc-pod');
  if(podCt)podCt.textContent=DB.pod.s.length+DB.pod.w.length+DB.pod.l.length+DB.pod.b.length;

  // ── Daily Progress feed (public — no login required to submit) ────────
  if (typeof renderDailyProgressList === 'function') renderDailyProgressList();
  // Refresh the form's auth hint so it shows the correct name immediately.
  if (typeof _refreshDailyProgressAuthHint === 'function') {
    _refreshDailyProgressAuthHint(typeof auth !== 'undefined' ? auth.current() : null);
  }

  // Auto-save timestamp
  const ts=document.getElementById('last-saved-ts');
  if(ts&&DB._lastSaved)ts.textContent='💾 Saved: '+new Date(DB._lastSaved).toLocaleTimeString();

  // Initialize advanced features (Gantt, KPI trends)
  if(typeof initHomeAdvanced==='function') initHomeAdvanced();
}

// ═══════════════════════════════════════════════════════════
//  ROW TRACKER — moved next to Planned vs Actual S-Curve
//  Renders into #home-row-tracker container in view-home.html
// ═══════════════════════════════════════════════════════════
function renderRowTracker(){
  const el=document.getElementById('home-row-tracker');if(!el)return;
  const issues=DB.rowIssues||[];
  const open=issues.filter(r=>(r.status||'Open')==='Open').length;
  const closed=issues.filter(r=>(r.status||'Open')==='Closed').length;
  const rows=issues.slice().sort((a,b)=>{
    const aOpen=(a.status||'Open')==='Open'?0:1;
    const bOpen=(b.status||'Open')==='Open'?0:1;
    if(aOpen!==bOpen)return aOpen-bOpen;
    return new Date(a.opened||0)-new Date(b.opened||0);
  }).map(r=>{
    const opened=r.opened?new Date(r.opened):null;
    const days=opened?Math.floor((Date.now()-opened.getTime())/86400000):0;
    const status=r.status||'Open';
    const sChip=status==='Open'?'chip cr':'chip cg';
    const dChip=status==='Open'?(days>30?'chip cr':days>14?'chip cy':'chip cb'):'chip cg';
    const id=r.id||r.loc;
    return `<tr style="cursor:pointer;" onclick="openRowEdit('${id}')" data-tt="Click to edit / close this ROW">
      <td><b style="color:var(--t1);">${r.loc}</b><div style="font-size:7px;color:var(--t3);">${r.type||'WTG'}</div></td>
      <td style="font-size:8px;line-height:1.4;">${(r.issue||'—').length>54?(r.issue||'').slice(0,52)+'…':(r.issue||'—')}</td>
      <td><span class="${sChip}" style="font-size:7px;">${status}</span></td>
      <td><span class="${dChip}" style="font-size:7px;">${days}d</span></td>
    </tr>`;
  }).join('');
  el.innerHTML=`
    <div class="ph2" style="margin-bottom:6px;">
      <div class="pt" style="font-weight:700;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
        🚧 ROW Tracker
        <span class="chip cr" style="font-size:7px;">${open} Open</span>
        <span class="chip cg" style="font-size:7px;">${closed} Closed</span>
      </div>
      <button class="btn bts" style="font-size:8px;background:var(--er);color:#fff;border:none;" onclick="openRowAdd()" data-tt="Raise a Right-of-Way issue for any location">+ Raise ROW</button>
    </div>
    <div class="tsc" style="max-height:170px;overflow-y:auto;">
      <table class="tbl" style="font-size:8px;">
        <thead><tr><th>Location</th><th>Issue</th><th>Status</th><th>Open</th></tr></thead>
        <tbody>${rows||'<tr><td colspan="4" style="text-align:center;color:var(--t3);padding:12px;font-style:italic;">No ROW issues recorded.<br>Click "+ Raise ROW" to add one.</td></tr>'}</tbody>
      </table>
    </div>`;
}

// ═══════════════════════════════════════════════════════════
//  ROW ENTRY / EDIT
//  Per requirement: ROW raise feature must work across the entire
//  project — for any WTG, Solar ITC, BOP feeder, or custom location.
// ═══════════════════════════════════════════════════════════
// ── ROW: open Add modal — guarded by reqLogin (any non-viewer authed role) ─
function openRowAdd(){
  reqLogin('all', _openRowAddImpl); // 'all' falls through to admin; we'll relax inside
}
// Actual implementation. Called either after auth.requireRole succeeds, or
// directly when CU is already a non-viewer authed user.
function _openRowAddImpl(){
  // FIX 4 — was: if(!CU || CU.isViewer){ showToast('🔒 Login required ...'); return; }
  // The reqLogin('all', _openRowAddImpl) wrapper above already guarantees
  // we got here because the modal succeeded; CU may still be null for one
  // tick. _ensureCU() synthesises it from auth.current() so the rest of
  // this template ($CU.name, $CU.role) renders correctly.
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(_openRowAddImpl); return; }
  document.getElementById('p-t').textContent='🚧 Raise ROW Issue';
  const wtgOpts=DB.wtg.turbines.map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
  const solOpts=Object.keys(DB.solar.itcs).map(id=>`<option value="${id}">${id}</option>`).join('');
  const bopOpts=(DB.bop33feeders||[]).map(f=>`<option value="${f.section}">${f.section}</option>`).join('');
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">⚠️ Right-of-Way (ROW) issues block construction. Logged in as <b>${cu.name}</b> (${cu.role}).</div>
    <form onsubmit="submitRowAdd(event)">
      <div class="fr">
        <div class="fg">
          <label class="fl">Module</label>
          <select class="fs" id="row-type" onchange="rowFilterLocs(this.value)" required>
            <option value="WTG">WTG Turbine</option>
            <option value="Solar">Solar ITC</option>
            <option value="BOP">BOP / 33kV Line</option>
            <option value="Other">Other / Custom</option>
          </select>
        </div>
        <div class="fg">
          <label class="fl">Location</label>
          <select class="fs" id="row-loc-sel" onchange="rowLocChanged(this.value)">
            <optgroup label="WTG Turbines" id="row-grp-wtg">${wtgOpts}</optgroup>
            <optgroup label="Solar ITCs" id="row-grp-sol" style="display:none;">${solOpts}</optgroup>
            <optgroup label="BOP / 33kV" id="row-grp-bop" style="display:none;">${bopOpts}</optgroup>
            <option value="__other__">— Other (specify) —</option>
          </select>
        </div>
      </div>
      <div class="fg" id="row-loc-wrap" style="display:none;">
        <label class="fl">Specify Location</label>
        <input class="fi" id="row-loc-custom" placeholder="Type custom location" oninput="document.getElementById('row-loc').value=this.value">
      </div>
      <input type="hidden" id="row-loc">
      <div class="fg">
        <label class="fl">Reason / Issue</label>
        <textarea class="fta" id="row-issue" placeholder="e.g. Farmer ROW payment pending — pathway 400m blocked" required style="min-height:64px;"></textarea>
      </div>
      <div class="fr">
        <div class="fg">
          <label class="fl">Date Raised</label>
          <input class="fi" id="row-opened" type="date" value="${new Date().toISOString().slice(0,10)}" required>
        </div>
        <div class="fg">
          <label class="fl">Expected Clearance</label>
          <input class="fi" id="row-exp" type="date">
        </div>
      </div>
      <div class="fr">
        <div class="fg">
          <label class="fl">Status</label>
          <select class="fs" id="row-status">
            <option>Open</option>
            <option>In Progress</option>
            <option>Closed</option>
          </select>
        </div>
        <div class="fg">
          <label class="fl">Raised By</label>
          <input class="fi" id="row-by" value="${cu.name||''}" required readonly style="opacity:.7;">
        </div>
      </div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn" style="flex:1.4;background:var(--er);color:#fff;border:none;font-weight:600;">🚧 Raise ROW</button>
      </div>
    </form>`;
  setTimeout(()=>{
    const sel=document.getElementById('row-loc-sel');
    const hid=document.getElementById('row-loc');
    if(sel&&hid&&sel.value!=='__other__')hid.value=sel.value;
  },20);
  ov('pov');
}
function rowLocChanged(v){
  const wrap=document.getElementById('row-loc-wrap');
  const hid=document.getElementById('row-loc');
  if(v==='__other__'){if(wrap)wrap.style.display='block';if(hid)hid.value='';}
  else{if(wrap)wrap.style.display='none';if(hid)hid.value=v;}
}
function rowFilterLocs(type){
  const grpW=document.getElementById('row-grp-wtg');
  const grpS=document.getElementById('row-grp-sol');
  const grpB=document.getElementById('row-grp-bop');
  const sel=document.getElementById('row-loc-sel');
  if(grpW)grpW.style.display=(type==='WTG'||type==='Other')?'':'none';
  if(grpS)grpS.style.display=(type==='Solar'||type==='Other')?'':'none';
  if(grpB)grpB.style.display=(type==='BOP'||type==='Other')?'':'none';
  if(sel){
    const firstGroup=sel.querySelector('optgroup:not([style*="display:none"])');
    if(firstGroup){
      const firstOpt=firstGroup.querySelector('option');
      if(firstOpt){sel.value=firstOpt.value;rowLocChanged(firstOpt.value);}
    }
  }
}

// Auth-protected ROW write: goes through dataApi.addRowIssue → Firebase →
// listener → appState → DB → re-render. Single source of truth.
async function submitRowAdd(e){
  e.preventDefault();
  // FIX 4 — gate via auth.canEdit() not CU.isViewer (which can be stale).
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(() => submitRowAdd(e)); return; }
  const sel=document.getElementById('row-loc-sel');
  let loc=document.getElementById('row-loc')?.value||'';
  if(!loc && sel && sel.value!=='__other__') loc=sel.value;
  if(!loc) loc=document.getElementById('row-loc-custom')?.value||'';
  loc=(loc||'').trim();
  const type=document.getElementById('row-type')?.value||'WTG';
  const issue=document.getElementById('row-issue')?.value?.trim()||'';
  const opened=document.getElementById('row-opened')?.value||new Date().toISOString().slice(0,10);
  const exp=document.getElementById('row-exp')?.value||'';
  const status=document.getElementById('row-status')?.value||'Open';
  if(!loc||!issue){ showToast('⚠️ Location & issue are required','er'); return; }
  try {
    await dataApi.addRowIssue({ loc, type, issue, opened, expClear:exp, status, raisedBy:cu.name });
    // Auto-set WTG turbine status='row' when applicable, via dataApi
    if(type==='WTG' && status!=='Closed'){
      const turb=DB.wtg.turbines.find(t=>t.id===loc);
      if(turb && turb.status!=='ready' && (cu.role==='wtg'||cu.role==='all'||cu.isAdmin)){
        await dataApi.updateTurbine(loc,{status:'row'}).catch(()=>{});
      }
    }
    cov('pov');
    showToast('🚧 ROW raised: '+loc,'ok');
  } catch (err) {
    showToast('❌ '+(err.message||'Failed to raise ROW'),'er');
  }
}

function openRowEdit(idOrLoc){
  // FIX 4 — synth CU from auth.current() if needed.
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(() => openRowEdit(idOrLoc)); return; }
  if(!DB.rowIssues)return;
  const r=DB.rowIssues.find(x=>x.id===idOrLoc) || DB.rowIssues.find(x=>x.loc===idOrLoc);
  if(!r){showToast('ROW entry not found','er');return;}
  document.getElementById('p-t').textContent='🚧 ROW – '+r.loc;
  const days=r.opened?Math.floor((Date.now()-new Date(r.opened).getTime())/86400000):0;
  const canDelete = cu.isAdmin;
  document.getElementById('p-b').innerHTML=`
    <div class="al ${r.status==='Closed'?'al-s':'al-w'}" style="margin-bottom:9px;">
      <b>${r.loc}</b> — ${r.type||'WTG'} • Open ${days} days
    </div>
    <div class="fg">
      <label class="fl">Issue / Reason</label>
      <textarea class="fta" id="row-edit-issue" style="min-height:64px;">${r.issue||''}</textarea>
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Status</label>
        <select class="fs" id="row-edit-status">
          <option ${r.status==='Open'?'selected':''}>Open</option>
          <option ${r.status==='In Progress'?'selected':''}>In Progress</option>
          <option ${r.status==='Closed'?'selected':''}>Closed</option>
        </select>
      </div>
      <div class="fg">
        <label class="fl">Expected Clearance</label>
        <input class="fi" id="row-edit-exp" type="date" value="${r.expClear||''}">
      </div>
    </div>
    <div style="font-size:9px;color:var(--t3);margin-top:6px;">Raised: ${r.opened||'—'}${r.raisedBy?' by '+r.raisedBy:''}</div>
    <div style="display:flex;gap:7px;margin-top:9px;">
      <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
      ${canDelete?`<button type="button" class="btn" style="flex:1;background:var(--er);color:#fff;border:none;" onclick="deleteRow('${r.id||r.loc}')">🗑 Delete</button>`:''}
      <button type="button" class="btn btsol" style="flex:1.4;" onclick="saveRowEdit('${r.id||r.loc}')">✅ Save Changes</button>
    </div>`;
  ov('pov');
}

async function saveRowEdit(idOrLoc){
  // FIX 4
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(() => saveRowEdit(idOrLoc)); return; }
  const r=DB.rowIssues.find(x=>x.id===idOrLoc) || DB.rowIssues.find(x=>x.loc===idOrLoc);
  if(!r)return;
  const patch={
    issue:    document.getElementById('row-edit-issue').value,
    status:   document.getElementById('row-edit-status').value,
    expClear: document.getElementById('row-edit-exp').value
  };
  try {
    await dataApi.updateRowIssue(r.id, patch);
    // Auto-update WTG turbine status if applicable
    if(r.type==='WTG' && (cu.role==='wtg'||cu.role==='all'||cu.isAdmin)){
      const turb=DB.wtg.turbines.find(t=>t.id===r.loc);
      if(turb){
        if(patch.status==='Closed' && turb.status==='row'){
          await dataApi.updateTurbine(turb.id,{status:'wip'}).catch(()=>{});
        } else if(patch.status!=='Closed' && turb.status!=='ready' && turb.status!=='row'){
          await dataApi.updateTurbine(turb.id,{status:'row'}).catch(()=>{});
        }
      }
    }
    cov('pov');
    showToast('✅ ROW updated: '+r.loc,'ok');
  } catch (err) {
    showToast('❌ '+(err.message||'Failed to update'),'er');
  }
}

async function deleteRow(idOrLoc){
  // FIX 4 — admin-only delete still routes through the auth modal
  // (passwords-as-admin in this demo build).
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(() => deleteRow(idOrLoc)); return; }
  if (!cu.isAdmin) { showToast('🔒 Site Manager only','er'); return; }
  const r=DB.rowIssues.find(x=>x.id===idOrLoc) || DB.rowIssues.find(x=>x.loc===idOrLoc);
  if(!r)return;
  if(!confirm('Delete ROW entry "'+r.loc+'" permanently?'))return;
  try {
    await dataApi.deleteRowIssue(r.id);
    cov('pov');
    showToast('ROW deleted','wn');
  } catch (err) {
    showToast('❌ '+(err.message||'Delete failed'),'er');
  }
}

// ═══════════════════════════════════════════════════════════
//  POPUPS — POD all + Daily Progress all (bullet point format)
// ═══════════════════════════════════════════════════════════
function openPodSummaryPopup(){
  if(typeof openDrilldown!=='function'){nav('pod');return;}
  const all=[
    ...(DB.pod.s||[]).map(p=>({...p,_module:'Solar',_col:'var(--sol)'})),
    ...(DB.pod.w||[]).map(p=>({...p,_module:'WTG',_col:'var(--wtg)'})),
    ...(DB.pod.b||[]).map(p=>({...p,_module:'BOP',_col:'var(--bop)'})),
  ].sort((a,b)=>(b.ts||0)-(a.ts||0));
  const html=all.length===0
    ? `<div style="text-align:center;color:var(--t3);padding:30px 20px;">
         <div style="font-size:48px;margin-bottom:8px;">📋</div>
         <div style="font-size:14px;margin-bottom:6px;color:var(--t1);">No POD entries yet</div>
         <div style="font-size:11px;color:var(--t4);margin-bottom:14px;">Click "Submit POD" on the dashboard to add one.</div>
         <button class="btn btsol" onclick="closeDrilldown();nav('pod')">→ Go to POD page</button>
       </div>`
    : `<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;">
         <span class="chip cg">Total: ${all.length}</span>
         <span class="chip cb" style="color:var(--sol);border-color:var(--sol);">Solar: ${(DB.pod.s||[]).length}</span>
         <span class="chip cb" style="color:var(--wtg);border-color:var(--wtg);">WTG: ${(DB.pod.w||[]).length}</span>
         <span class="chip cb" style="color:var(--bop);border-color:var(--bop);">BOP: ${(DB.pod.b||[]).length}</span>
       </div>
       <div style="display:flex;flex-direction:column;gap:6px;">
       ${all.map(p=>`
         <div style="background:var(--card2);border-left:3px solid ${p._col};border-radius:6px;padding:9px 12px;">
           <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px;">
             <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0;">
               <span class="chip" style="background:${p._col};color:#fff;border:none;font-size:8px;">${p._module}</span>
               <b style="color:var(--t1);font-size:11px;">${p.activity||'—'}</b>
             </div>
             <div style="font-size:9px;color:var(--t3);white-space:nowrap;">${p.date||''} ${p.time||''}</div>
           </div>
           <div style="display:flex;gap:10px;flex-wrap:wrap;font-size:9px;color:var(--t2);">
             <span>📊 Qty: <b>${p.qty||'—'}</b></span>
             <span>👷 MP: <b>${p.mp||0}</b></span>
             <span>👤 By: <b>${p.by||'—'}</b></span>
             ${p.contractor?`<span>🏗️ Contractor: <b>${p.contractor}</b></span>`:''}
           </div>
           ${p.notes?`<div style="margin-top:5px;padding:5px 7px;background:var(--card3);border-radius:4px;font-size:9px;color:var(--t3);">📝 ${p.notes}</div>`:''}
         </div>`).join('')}
       </div>`;
  openDrilldown('📋 All POD Entries — Plan of Day', html);
}

function openDailyProgressPopup(){
  if(typeof openDrilldown!=='function')return;

  // ─────────────────────────────────────────────────────────────────────
  // FIX 6 — Daily Progress Feed renders ONLY entries from /dailyProgress.
  //
  //   • POD entries are NEVER pulled into this feed.
  //   • Each entry is rendered as a single bullet line in the spec format:
  //       ✅ Solar | Location: Site A | Activity: Cable Laying | Done: 450 mtr
  //   • Source data shape (written by data-api.pushDailyProgress &
  //     addDailyProgress, mirrored into DB.dailyProgress via the
  //     state-bridge):
  //       { module, itc, turbine, activity / act, sub, val, pct, today,
  //         qty, unit, byName, ts }
  //
  // The previous implementation walked DB.solar.itcs / DB.wtg.turbines
  // (i.e. computed cumulative state) — that is NOT what /dailyProgress
  // contains, and it could blur with POD data through shared structures.
  // We now render directly from the feed.
  // ─────────────────────────────────────────────────────────────────────

  const entries = (DB.dailyProgress || [])
    .filter(e => e && (e.module || e.activity || e.act))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0));

  function _icon(mod) {
    if (mod === 'Solar') return '☀️';
    if (mod === 'WTG')   return '⚡';
    if (mod === 'BOP' || mod === 'PSS' || mod === 'GSS' || mod === '33kV' || mod === '66kV') return '🔌';
    if (mod === 'Land')  return '🌱';
    return '📋';
  }
  function _color(mod) {
    if (mod === 'Solar') return 'var(--sol)';
    if (mod === 'WTG')   return 'var(--wtg)';
    if (mod === 'BOP' || mod === 'PSS' || mod === 'GSS' || mod === '33kV' || mod === '66kV') return 'var(--bop)';
    if (mod === 'Land')  return 'var(--land)';
    return 'var(--ac)';
  }

  // Build one bullet per /dailyProgress entry in the exact spec format.
  function _renderBullet(e) {
    const mod   = e.module || '—';
    // "Location" = ITC for Solar, turbine for WTG, otherwise blank.
    const loc   = e.itc || e.turbine || e.location || e.area || '';
    const act   = e.activity || e.act || '—';

    // "Done" line: prefer explicit qty+unit (POD-style payload),
    // then today%/pct (Solar/WTG progress payload),
    // then val (sub-activity unit count).
    let done = '';
    if (e.qty !== null && e.qty !== undefined && Number(e.qty) !== 0) {
      done = `${e.qty} ${e.unit || ''}`.trim();
    } else if (e.today !== null && e.today !== undefined && Number(e.today) > 0) {
      done = `+${e.today}% today` + (e.pct ? ` (cumulative ${e.pct}%)` : '');
    } else if (e.pct !== null && e.pct !== undefined) {
      done = `${e.pct}%`;
    } else if (e.val !== null && e.val !== undefined) {
      done = String(e.val);
    } else {
      done = '—';
    }

    const sub  = e.sub ? ` · ${e.sub}` : '';
    const who  = e.byName ? ` · 👤 ${e.byName}` : '';
    const when = e.ts ? new Date(e.ts).toLocaleString() : '';
    const col  = _color(mod);

    // The text inside the bullet matches the spec line exactly:
    //   ✅ Solar | Location: Site A | Activity: Cable Laying | Done: 450 mtr
    const specLine =
      `✅ ${mod}` +
      (loc ? ` | Location: ${loc}` : '') +
      ` | Activity: ${act}${sub}` +
      ` | Done: ${done}`;

    return `
      <li style="background:var(--card2);border-left:3px solid ${col};border-radius:6px;padding:9px 13px 9px 16px;position:relative;">
        <div style="position:absolute;left:-5px;top:50%;transform:translateY(-50%);width:9px;height:9px;background:${col};border-radius:50%;border:2px solid var(--bg2);"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div style="font-size:11px;color:var(--t1);font-family:var(--f2,inherit);font-weight:600;">
            <span style="font-size:13px;margin-right:4px;">${_icon(mod)}</span>${specLine}
          </div>
          <div style="font-size:9px;color:var(--t3);white-space:nowrap;">${when}${who}</div>
        </div>
      </li>`;
  }

  const html = entries.length === 0
    ? `<div style="text-align:center;color:var(--t3);padding:30px 20px;">
         <div style="font-size:48px;margin-bottom:8px;">📊</div>
         <div style="font-size:14px;margin-bottom:6px;color:var(--t1);">No daily progress updates yet</div>
         <div style="font-size:11px;color:var(--t4);">
           Saving any entry in Solar, WTG, or BOP automatically appears here.
         </div>
       </div>`
    : `<div style="margin-bottom:12px;font-size:11px;color:var(--t3);padding:8px 10px;background:var(--card2);border-radius:6px;border-left:3px solid var(--ok);">
         <b style="color:var(--t1);">${entries.length}</b> entries — sourced exclusively from <code>/dailyProgress</code>. POD entries are not included here.
       </div>
       <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;">
         ${entries.map(_renderBullet).join('')}
       </ul>`;
  openDrilldown('📊 Daily Progress Feed — Solar / WTG / BOP Updates', html);
}

// ── Milestone form — auth-protected (any non-viewer authed user can add) ──
function openMilestoneForm(){
  reqLogin('all', _openMilestoneFormImpl); // gate via auth modal; admin always allowed
}
function _openMilestoneFormImpl(){
  // FIX 4
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(_openMilestoneFormImpl); return; }
  document.getElementById('p-t').textContent='📅 Add Milestone';
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">Logged in as <b>${cu.name}</b> (${cu.role})</div>
    <div class="fg"><label class="fl">Date</label><input class="fi" id="ms-date" type="date" required value="${new Date().toISOString().slice(0,10)}"></div>
    <div class="fg"><label class="fl">Milestone Title</label><input class="fi" id="ms-title" placeholder="e.g. ITC-1 Commissioning" required maxlength="200"></div>
    <div class="fg"><label class="fl">Module</label>
      <select class="fs" id="ms-mod">
        <option>Solar</option><option>WTG</option><option>BOP</option><option>Land</option><option>Overall</option>
      </select>
    </div>
    <div style="display:flex;gap:7px;margin-top:9px;">
      <button type="button" class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button type="button" class="btn btsol" style="flex:1" onclick="saveMilestone()">✅ Add</button>
    </div>`;
  ov('pov');
}
async function saveMilestone(){
  // FIX 4
  if (!_ensureCU()) { _requireUnlock(saveMilestone); return; }
  const d = document.getElementById('ms-date')?.value;
  const t = document.getElementById('ms-title')?.value?.trim();
  const mod = document.getElementById('ms-mod')?.value || 'Overall';
  if(!d || !t){ showToast('⚠️ Date & title required','er'); return; }
  try {
    await dataApi.addMilestone({ title: t, date: d, mod });
    cov('pov');
    showToast('📅 Milestone added','ok');
  } catch (err) {
    showToast('❌ '+(err.message||'Failed'),'er');
  }
}

function openMilestoneEdit(id){
  // FIX 4 — Schedule Milestone edit was firing "Login Required" on a stale CU.
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(() => openMilestoneEdit(id)); return; }
  if(!id){ showToast('Milestone has no id','er'); return; }
  const m = (DB.milestones||[]).find(x=>x.id===id);
  if(!m){ showToast('Milestone not found','er'); return; }
  const canDelete = cu.isAdmin;
  document.getElementById('p-t').textContent='📅 Edit Milestone';
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">Logged in as <b>${cu.name}</b> (${cu.role})</div>
    <div class="fg"><label class="fl">Date</label><input class="fi" id="ms-edit-date" type="date" required value="${m.date||''}"></div>
    <div class="fg"><label class="fl">Milestone Title</label><input class="fi" id="ms-edit-title" required value="${(m.title||m.label||'').replace(/"/g,'&quot;')}"></div>
    <div class="fg"><label class="fl">Module</label>
      <select class="fs" id="ms-edit-mod">
        ${['Solar','WTG','BOP','Land','Overall'].map(o=>`<option ${m.mod===o?'selected':''}>${o}</option>`).join('')}
      </select>
    </div>
    <div style="display:flex;gap:7px;margin-top:9px;">
      <button type="button" class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      ${canDelete?`<button type="button" class="btn" style="flex:1;background:var(--er);color:#fff;border:none;" onclick="deleteMilestoneNow('${id}')">🗑 Delete</button>`:''}
      <button type="button" class="btn btsol" style="flex:1.4" onclick="saveMilestoneEdit('${id}')">✅ Save</button>
    </div>`;
  ov('pov');
}

async function saveMilestoneEdit(id){
  // FIX 4
  if (!_ensureCU()) { _requireUnlock(() => saveMilestoneEdit(id)); return; }
  const d = document.getElementById('ms-edit-date')?.value;
  const t = document.getElementById('ms-edit-title')?.value?.trim();
  const mod = document.getElementById('ms-edit-mod')?.value || 'Overall';
  if(!d || !t){ showToast('⚠️ Date & title required','er'); return; }
  try {
    await dataApi.updateMilestone(id, { title: t, date: d, mod });
    cov('pov');
    showToast('✅ Milestone updated','ok');
  } catch (err) {
    showToast('❌ '+(err.message||'Failed'),'er');
  }
}

async function deleteMilestoneNow(id){
  // FIX 4 — admin-only, but route through the modal first so the user can unlock.
  const cu = _ensureCU();
  if (!cu) { _requireUnlock(() => deleteMilestoneNow(id)); return; }
  if (!cu.isAdmin) { showToast('🔒 Site Manager only','er'); return; }
  if(!confirm('Delete this milestone permanently?'))return;
  try {
    await dataApi.deleteMilestone(id);
    cov('pov');
    showToast('Milestone deleted','wn');
  } catch (err) {
    showToast('❌ '+(err.message||'Delete failed'),'er');
  }
}

// ── Scope Manager ─────────────────────────────────────────────────────────
function openScopeManager(){
  document.getElementById('p-t').textContent='⚙️ Scope Manager';
  document.getElementById('p-b').innerHTML=`
    <div style="font-size:10px;color:var(--t3);margin-bottom:10px;">
      Set total scope for each module. Progress % = done/scope × 100. Changes reflect everywhere instantly.
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">Solar Total MW</label>
        <input class="fi" id="sc-sol-mw" type="number" value="${DB.solar.totalMW}" step="0.1">
      </div>
      <div class="fg">
        <label class="fl">WTG Total MW</label>
        <input class="fi" id="sc-wtg-mw" type="number" value="${DB.wtg.totalMW}" step="0.1">
      </div>
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">WTG Count</label>
        <input class="fi" id="sc-wtg-cnt" type="number" value="${DB.wtg.count}">
      </div>
      <div class="fg">
        <label class="fl">33kV Total km</label>
        <input class="fi" id="sc-33kv-km" type="number" value="${DB.bop33.lines.reduce((s,l)=>s+l.km,0)}" step="0.1">
      </div>
    </div>
    <div class="fr">
      <div class="fg">
        <label class="fl">66kV Towers (scope)</label>
        <input class="fi" id="sc-66kv-tw" type="number" value="${DB.bop66.totalTowers}">
      </div>
      <div class="fg">
        <label class="fl">66kV km</label>
        <input class="fi" id="sc-66kv-km" type="number" value="${DB.bop66.feeders[0]?.km||12.75}" step="0.1">
      </div>
    </div>
    <div style="font-size:9px;font-weight:600;margin:10px 0 6px;">Solar ITC Scopes (MW)</div>
    <div class="fr" style="flex-wrap:wrap;gap:6px;">
      ${Object.entries(DB.solar.itcs).map(([id,d])=>`
        <div class="fg" style="min-width:100px;">
          <label class="fl">${id}</label>
          <input class="fi" id="sc-itc-${id}" type="number" value="${d.mw}" step="0.1">
        </div>`).join('')}
    </div>
    <div style="display:flex;gap:7px;margin-top:12px;">
      <button type="button" class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button type="button" class="btn btsol" style="flex:1" onclick="applyScope()">✅ Apply Scope</button>
    </div>`;
  ov('pov');
}
function applyScope(){
  DB.solar.totalMW=+document.getElementById('sc-sol-mw').value||DB.solar.totalMW;
  DB.wtg.totalMW=+document.getElementById('sc-wtg-mw').value||DB.wtg.totalMW;
  DB.wtg.count=+document.getElementById('sc-wtg-cnt').value||DB.wtg.count;
  DB.bop66.totalTowers=+document.getElementById('sc-66kv-tw').value||DB.bop66.totalTowers;
  if(DB.bop66.feeders[0])DB.bop66.feeders[0].km=+document.getElementById('sc-66kv-km').value||DB.bop66.feeders[0].km;
  Object.keys(DB.solar.itcs).forEach(id=>{
    const inp=document.getElementById('sc-itc-'+id);
    if(inp)DB.solar.itcs[id].mw=+inp.value||DB.solar.itcs[id].mw;
  });
  saveDB();cov('pov');rndrHome();
  showToast('✅ Scope updated and saved!','ok');
}

// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  DAILY PROGRESS — public form + live feed
//
//  Anyone (logged in or not) can submit. The form writes to
//  /dailyProgress via dataApi.addDailyProgress() which the
//  master-prompt spec explicitly says must NOT call _u().
//  The realtime listener in state-bridge.js feeds DB.dailyProgress
//  and we re-render the home list whenever it changes.
// ═══════════════════════════════════════════════════════════

/** Render the home Daily Progress feed (last 10 entries, newest first). */
function renderDailyProgressList() {
  const el = document.getElementById('home-daily-progress-list');
  if (!el) return;
  const list = (Array.isArray(DB.dailyProgress) ? DB.dailyProgress : [])
                .slice(0, 30);  // show last 30 in DPR list (was 10)
  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--t3);font-size:10px;">No daily progress entries yet.<br>Submit POD or use the form to populate the DPR.</div>';
    return;
  }
  const moduleColor = m => ({
    Solar:'var(--sol)', WTG:'var(--wtg)', BOP:'var(--bop)', Land:'var(--land)'
  })[m] || 'var(--t2)';

  // Group by date so the DPR reads like a daily report.
  const byDate = {};
  list.forEach(e => {
    const ts = e.ts ? new Date(e.ts) : null;
    const dateKey = ts ? ts.toISOString().slice(0,10) : 'unknown';
    (byDate[dateKey] = byDate[dateKey] || []).push(e);
  });
  const sortedDates = Object.keys(byDate).sort().reverse();

  const html = sortedDates.map(dk => {
    const items = byDate[dk];
    const dateLabel = dk === 'unknown'
      ? 'Date unknown'
      : new Date(dk).toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'});
    return `
      <div style="margin-bottom:10px;">
        <div style="font-size:10px;font-weight:700;color:var(--t1);padding:4px 0;border-bottom:1px solid var(--b1);margin-bottom:4px;">📅 ${dateLabel}</div>
        <ul style="list-style:none;padding:0;margin:0;">
          ${items.map(e => {
            const ts = e.ts ? new Date(e.ts) : null;
            const time = ts ? ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '';
            const act  = e.activity || e.act || '—';
            const qty  = (e.qty !== undefined && e.qty !== null && e.qty !== '') ? (' — ' + e.qty + (e.unit ? ' ' + e.unit : '')) : '';
            const by   = e.byName || 'Anonymous';
            const rem  = e.remarks ? ' (' + e.remarks + ')' : '';
            const col  = moduleColor(e.module);
            return `
              <li style="padding:4px 0 4px 16px;border-left:3px solid ${col};margin-bottom:3px;font-size:10px;line-height:1.45;">
                <span style="color:${col};font-weight:700;">●</span>
                <b style="color:${col};">[${e.module || '—'}]</b>
                <span style="color:var(--t1);">${(act+'').slice(0,120)}</span><span style="color:var(--t2);">${qty}</span><span style="color:var(--t3);font-size:9px;">${rem}</span>
                <span style="float:right;color:var(--t3);font-size:8px;">${time} · ${by}</span>
              </li>`;
          }).join('')}
        </ul>
      </div>`;
  }).join('');
  el.innerHTML = html;
}

/** Submit the Daily Progress form. No auth required (per spec). */
async function submitDailyProgressForm(e) {
  e.preventDefault();
  const moduleEl   = document.getElementById('dpf-module');
  const activityEl = document.getElementById('dpf-activity');
  const qtyEl      = document.getElementById('dpf-qty');
  const unitEl     = document.getElementById('dpf-unit');
  const remarksEl  = document.getElementById('dpf-remarks');
  if (!moduleEl || !activityEl || !qtyEl) return false;
  const payload = {
    module:   moduleEl.value,
    activity: activityEl.value.trim(),
    qty:      Number(qtyEl.value) || 0,
    unit:     (unitEl.value || '').trim(),
    remarks:  (remarksEl.value || '').trim()
  };
  if (!payload.activity) {
    if (typeof showToast === 'function') showToast('Activity description required','er');
    return false;
  }
  try {
    await dataApi.addDailyProgress(payload);
    activityEl.value = '';
    qtyEl.value = '';
    unitEl.value = '';
    remarksEl.value = '';
    if (typeof showToast === 'function') showToast('✅ Daily progress submitted','ok');
  } catch (err) {
    console.error('[render-home] daily progress submit failed:', err);
    if (typeof showToast === 'function') showToast('❌ ' + (err.message || 'Submit failed'),'er');
  }
  return false;
}

/** Update the 'Anonymous' / username hint on the form whenever auth state changes. */
function _refreshDailyProgressAuthHint(profile) {
  const hint = document.getElementById('dpf-auth-hint');
  if (!hint) return;
  hint.textContent = profile ? ('Submitting as ' + profile.name) : 'Anonymous';
}
if (typeof auth !== 'undefined' && auth.onChange) auth.onChange(_refreshDailyProgressAuthHint);


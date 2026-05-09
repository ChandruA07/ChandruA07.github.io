//  HOME
// ═══════════════════════════════════════════════════════════
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

  // ── ROW 2: CHART STRIP ──────────────────────────────────────────────────
  mkCWIP('ch-sol-cwip', Object.keys(DB.solar.itcs), Object.keys(DB.solar.itcs).map(id=>calcITCProg(id)));
  mkCWIP('ch-wtg-cwip', DB.wtg.turbines.slice(0,12).map(t=>t.id), DB.wtg.turbines.slice(0,12).map(t=>calcTurbProg(t)));
  mkC('ch-bop-prog',{type:'bar',data:{labels:['33kV','66kV','PSS','GSS'],datasets:[{label:'%',
    data:[calcBop33PctV2(),calcBop66PctV2(),calcPssPct(),calcGssPct()],
    backgroundColor:['rgba(156,39,176,.7)','rgba(255,152,0,.7)','rgba(0,188,212,.7)','rgba(139,195,74,.7)'],borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.05)'}},x:{grid:{display:false}}}}});
  mkC('ch-land-prog',{type:'bar',data:{labels:['WTG','Solar'],datasets:[{label:'%',
    data:[calcWtgLandProg(),calcSolLandProg()],
    backgroundColor:['rgba(0,200,83,.7)','rgba(0,137,123,.7)'],borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%'},grid:{color:'rgba(255,255,255,.05)'}},x:{grid:{display:false}}}}});

  // ── ROW 3 LEFT: POD SUMMARY (top half) + DAILY PROGRESS SUMMARY (bottom half)
  // Manpower section removed per requirements; ROW Tracker moved next to S-curve below.
  const allPod=[...DB.pod.s,...DB.pod.w,...DB.pod.b];
  const podSolCt=DB.pod.s.length, podWtgCt=DB.pod.w.length, podBopCt=DB.pod.b.length;
  const dailyFeed=buildDailyProgressFeed();
  const dailyCt=dailyFeed.length;

  document.getElementById('home-pod-dpr').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;padding-bottom:5px;border-bottom:1px solid var(--b1);">
      <div style="font-size:11px;font-weight:700;color:var(--t2);">📋 POD &amp; Daily Progress</div>
      <button class="btn bts" style="font-size:8px;padding:2px 7px;" onclick="nav('pod')">+ Submit POD</button>
    </div>

    <!-- POD SUMMARY (top half) — clickable popup with all entries -->
    <div onclick="openPodSummaryPopup()" style="cursor:pointer;background:var(--card3);border:1px solid var(--b1);border-radius:7px;padding:9px 10px;margin-bottom:8px;transition:all .15s;"
         onmouseover="this.style.borderColor='var(--ac)';this.style.background='var(--card2)'"
         onmouseout="this.style.borderColor='var(--b1)';this.style.background='var(--card3)'"
         data-tt="Click to view all POD entries">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:700;color:var(--pod);text-transform:uppercase;letter-spacing:.6px;">POD Summary</div>
        <div style="font-size:8px;color:var(--ac);">View all →</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;">
        <div style="text-align:center;padding:5px 0;background:rgba(255,170,0,.10);border-radius:4px;">
          <div style="font-family:var(--f2);font-size:18px;font-weight:800;color:var(--sol);line-height:1;">${podSolCt}</div>
          <div style="font-size:7px;color:var(--t3);font-weight:600;margin-top:2px;letter-spacing:.4px;">SOLAR</div>
        </div>
        <div style="text-align:center;padding:5px 0;background:rgba(124,77,255,.10);border-radius:4px;">
          <div style="font-family:var(--f2);font-size:18px;font-weight:800;color:var(--wtg);line-height:1;">${podWtgCt}</div>
          <div style="font-size:7px;color:var(--t3);font-weight:600;margin-top:2px;letter-spacing:.4px;">WTG</div>
        </div>
        <div style="text-align:center;padding:5px 0;background:rgba(255,87,34,.10);border-radius:4px;">
          <div style="font-family:var(--f2);font-size:18px;font-weight:800;color:var(--bop);line-height:1;">${podBopCt}</div>
          <div style="font-size:7px;color:var(--t3);font-weight:600;margin-top:2px;letter-spacing:.4px;">BOP</div>
        </div>
        <div style="text-align:center;padding:5px 0;background:rgba(0,200,255,.10);border-radius:4px;">
          <div style="font-family:var(--f2);font-size:18px;font-weight:800;color:var(--ac);line-height:1;">${allPod.length}</div>
          <div style="font-size:7px;color:var(--t3);font-weight:600;margin-top:2px;letter-spacing:.4px;">TOTAL</div>
        </div>
      </div>
    </div>

    <!-- DAILY PROGRESS SUMMARY — sourced ONLY from Solar/WTG in-charge inputs -->
    <div onclick="openDailyProgressPopup()" style="cursor:pointer;background:var(--card3);border:1px solid var(--b1);border-radius:7px;padding:9px 10px;transition:all .15s;"
         onmouseover="this.style.borderColor='var(--ok)';this.style.background='var(--card2)'"
         onmouseout="this.style.borderColor='var(--b1)';this.style.background='var(--card3)'"
         data-tt="Click for bullet-point list of all daily progress updates">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <div style="font-size:9px;font-weight:700;color:var(--ok);text-transform:uppercase;letter-spacing:.6px;">📊 Daily Progress (Live)</div>
        <div style="font-size:8px;color:var(--ok);">View all →</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:5px;">
        <div style="text-align:center;padding:6px 8px;background:rgba(0,230,118,.10);border-radius:4px;min-width:60px;">
          <div style="font-family:var(--f2);font-size:22px;font-weight:800;color:var(--ok);line-height:1;">${dailyCt}</div>
          <div style="font-size:7px;color:var(--t3);font-weight:600;margin-top:2px;">UPDATES</div>
        </div>
        <div style="flex:1;font-size:9px;color:var(--t3);line-height:1.45;">
          From <b style="color:var(--sol);">Solar</b> &amp; <b style="color:var(--wtg);">WTG</b> in-charges only — drives <b>POD vs Actual</b> comparison
        </div>
      </div>
      ${dailyCt===0
        ?`<div style="font-size:9px;color:var(--t3);padding:4px 0;font-style:italic;">No progress entries from in-charges yet today.</div>`
        :dailyFeed.slice(0,2).map(p=>`
          <div style="background:var(--card2);border-radius:4px;padding:5px 8px;margin-top:4px;font-size:9px;display:flex;justify-content:space-between;gap:6px;border-left:2px solid ${p.col};">
            <b style="color:var(--t2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;">${p.icon} ${p.title}</b>
            <span style="color:${p.col};white-space:nowrap;font-weight:600;">${p.detail}</span>
          </div>`).join('')
      }
    </div>`;

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
  // Allow any non-viewer authenticated user to raise a ROW issue
  if(!CU || CU.isViewer){ showToast('🔒 Login required to raise ROW issues','er'); return; }
  document.getElementById('p-t').textContent='🚧 Raise ROW Issue';
  const wtgOpts=DB.wtg.turbines.map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
  const solOpts=Object.keys(DB.solar.itcs).map(id=>`<option value="${id}">${id}</option>`).join('');
  const bopOpts=(DB.bop33feeders||[]).map(f=>`<option value="${f.section}">${f.section}</option>`).join('');
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">⚠️ Right-of-Way (ROW) issues block construction. Logged in as <b>${CU.name}</b> (${CU.role}).</div>
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
          <input class="fi" id="row-by" value="${CU.name||''}" required readonly style="opacity:.7;">
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
  if(!CU || CU.isViewer){ showToast('🔒 Login required','er'); return; }
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
    await dataApi.addRowIssue({ loc, type, issue, opened, expClear:exp, status, raisedBy:CU.name });
    // Auto-set WTG turbine status='row' when applicable, via dataApi
    if(type==='WTG' && status!=='Closed'){
      const turb=DB.wtg.turbines.find(t=>t.id===loc);
      if(turb && turb.status!=='ready' && (CU.role==='wtg'||CU.role==='all'||CU.isAdmin)){
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
  if(!CU || CU.isViewer){ showToast('🔒 Login required to edit ROW issues','er'); return; }
  if(!DB.rowIssues)return;
  const r=DB.rowIssues.find(x=>x.id===idOrLoc) || DB.rowIssues.find(x=>x.loc===idOrLoc);
  if(!r){showToast('ROW entry not found','er');return;}
  document.getElementById('p-t').textContent='🚧 ROW – '+r.loc;
  const days=r.opened?Math.floor((Date.now()-new Date(r.opened).getTime())/86400000):0;
  const canDelete = CU.isAdmin;
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
  if(!CU || CU.isViewer){ showToast('🔒 Login required','er'); return; }
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
    if(r.type==='WTG' && (CU.role==='wtg'||CU.role==='all'||CU.isAdmin)){
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
  if(!CU || !CU.isAdmin){ showToast('🔒 Site Manager only','er'); return; }
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
  // Build bullet points: every Solar sub-activity update + every WTG status milestone
  const bullets=[];
  // Solar — sub-activity updates
  Object.entries(DB.solar.itcs||{}).forEach(([id,d])=>{
    (d.acts||[]).forEach(a=>{
      const subs=a.subActs||[];
      const subDone=a.subDone||[];
      const subUnits=a.subUnits||[];
      subs.forEach((sn,si)=>{
        const v=subDone[si]||0;
        if(v>0){
          bullets.push({
            module:'Solar',col:'var(--sol)',icon:'☀️',
            title:`${id} • ${a.n}`,
            line:`${sn}: <b>${v}</b> ${subUnits[si]||'units'} done`,
            sort:1,
          });
        }
      });
      if((a.today||0)>0){
        bullets.push({
          module:'Solar',col:'var(--sol)',icon:'☀️',
          title:`${id} • ${a.n}`,
          line:`Today: <b>+${a.today}%</b> · Cumulative: <b>${a.done}%</b>`,
          sort:0,
        });
      }
    });
  });
  // WTG — civil & mech progress per turbine
  (DB.wtg.turbines||[]).forEach(t=>{
    const cAvg=Math.round(((t.civil||[0,0,0,0,0]).reduce((s,v)=>s+v,0))/5);
    const mAvg=Math.round(((t.mech||[0,0,0,0]).reduce((s,v)=>s+v,0))/4);
    if(cAvg>0||mAvg>0){
      bullets.push({
        module:'WTG',col:'var(--wtg)',icon:'⚡',
        title:`${t.id} • ${(t.status||'pending').toUpperCase()}`,
        line:`Civil: <b>${cAvg}%</b> · Mech: <b>${mAvg}%</b> · USS: <b>${t.uss||0}%</b> · Supply: <b>${t.sup||0}%</b>${t.notes?'<br><span style=\"color:var(--t3);font-size:9px;\">📝 '+t.notes+'</span>':''}`,
        sort:2,
      });
    }
  });
  bullets.sort((a,b)=>a.sort-b.sort);
  const html=bullets.length===0
    ? `<div style="text-align:center;color:var(--t3);padding:30px 20px;">
         <div style="font-size:48px;margin-bottom:8px;">📊</div>
         <div style="font-size:14px;margin-bottom:6px;color:var(--t1);">No daily progress updates yet</div>
         <div style="font-size:11px;color:var(--t4);">Solar &amp; WTG in-charges submit progress from their respective sections.</div>
       </div>`
    : `<div style="margin-bottom:12px;font-size:11px;color:var(--t3);padding:8px 10px;background:var(--card2);border-radius:6px;border-left:3px solid var(--ok);">
         <b style="color:var(--t1);">${bullets.length}</b> active progress items — sourced exclusively from Solar &amp; WTG in-charge inputs. This drives all dashboard comparisons.
       </div>
       <ul style="list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;">
         ${bullets.map(b=>`
           <li style="background:var(--card2);border-left:3px solid ${b.col};border-radius:6px;padding:9px 13px 9px 16px;position:relative;">
             <div style="position:absolute;left:-5px;top:50%;transform:translateY(-50%);width:9px;height:9px;background:${b.col};border-radius:50%;border:2px solid var(--bg2);"></div>
             <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px;">
               <div style="display:flex;align-items:center;gap:6px;">
                 <span style="font-size:14px;">${b.icon}</span>
                 <b style="color:${b.col};font-size:11px;">${b.title}</b>
               </div>
               <span class="chip" style="background:${b.col};color:#fff;border:none;font-size:8px;">${b.module}</span>
             </div>
             <div style="font-size:10px;color:var(--t2);line-height:1.5;">• ${b.line}</div>
           </li>`).join('')}
       </ul>`;
  openDrilldown('📊 Daily Progress Feed — Solar &amp; WTG In-charge Updates', html);
}

// ── Milestone form — auth-protected (any non-viewer authed user can add) ──
function openMilestoneForm(){
  reqLogin('all', _openMilestoneFormImpl); // gate via auth modal; admin always allowed
}
function _openMilestoneFormImpl(){
  if(!CU || CU.isViewer){ showToast('🔒 Login required to add milestones','er'); return; }
  document.getElementById('p-t').textContent='📅 Add Milestone';
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">Logged in as <b>${CU.name}</b> (${CU.role})</div>
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
  if(!CU || CU.isViewer){ showToast('🔒 Login required','er'); return; }
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
  if(!CU || CU.isViewer){ showToast('🔒 Login required to edit milestones','er'); return; }
  if(!id){ showToast('Milestone has no id','er'); return; }
  const m = (DB.milestones||[]).find(x=>x.id===id);
  if(!m){ showToast('Milestone not found','er'); return; }
  const canDelete = CU.isAdmin;
  document.getElementById('p-t').textContent='📅 Edit Milestone';
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">Logged in as <b>${CU.name}</b> (${CU.role})</div>
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
  if(!CU || CU.isViewer){ showToast('🔒 Login required','er'); return; }
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
  if(!CU || !CU.isAdmin){ showToast('🔒 Site Manager only','er'); return; }
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
                .slice(0, 10);
  if (list.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:24px;color:var(--t3);font-size:10px;">No entries yet — be the first to submit one →</div>';
    return;
  }
  const moduleColor = m => ({
    Solar:'var(--sol)', WTG:'var(--wtg)', BOP:'var(--bop)', Land:'var(--land)'
  })[m] || 'var(--t2)';
  el.innerHTML = list.map(e => {
    const ts = e.ts ? new Date(e.ts) : null;
    const time = ts ? ts.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '';
    const date = ts ? ts.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '';
    const act = e.activity || e.act || '—';
    const qty = (e.qty !== undefined && e.qty !== null) ? e.qty : '';
    const unit= e.unit ? e.unit : '';
    const by  = e.byName || 'Anonymous';
    return `<div style="display:grid;grid-template-columns:auto auto 1fr auto auto;gap:8px;align-items:center;padding:6px 4px;border-bottom:1px solid var(--b1);">
      <span style="font-size:8px;color:var(--t3);min-width:48px;">${date}<br>${time}</span>
      <span style="display:inline-block;padding:2px 8px;border-radius:9px;background:${moduleColor(e.module)}22;color:${moduleColor(e.module)};font-size:9px;font-weight:700;">${e.module || '—'}</span>
      <span style="font-size:10px;font-weight:600;color:var(--t1);">${(act+'').slice(0,80)}</span>
      <span style="font-size:10px;color:var(--t2);">${qty} ${unit}</span>
      <span style="font-size:8px;color:var(--t3);max-width:80px;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${by}">${by}</span>
    </div>`;
  }).join('');
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


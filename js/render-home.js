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

function rndrHome(){
  const {sol,wtg,land,bop,tot}=updateOverallBars();
  const totalMp=14+DB.mp.sol+DB.mp.wtg+DB.mp.bop;
  const rowCnt=DB.rowIssues.length;

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

  // ── ROW 3 LEFT: POD + Manpower DPR + ROW ─────────────────────────────────
  const allPod=[...DB.pod.s,...DB.pod.w,...DB.pod.b];
  const mpEl2=`
    <div class="pr" style="margin-bottom:2px;"><div class="prl" style="font-size:9px;">${_solImg(11)} Solar</div><div class="prt"><div class="prf" style="width:${Math.min(100,((6+DB.mp.sol)/20)*100)}%;background:var(--sol)"></div></div><div class="prp" style="color:var(--sol);font-size:9px;">${6+DB.mp.sol}</div></div>
    <div class="pr" style="margin-bottom:2px;"><div class="prl" style="font-size:9px;">${_turbImg(11,'')} WTG</div><div class="prt"><div class="prf" style="width:${Math.min(100,((4+DB.mp.wtg)/20)*100)}%;background:var(--wtg)"></div></div><div class="prp" style="color:var(--wtg);font-size:9px;">${4+DB.mp.wtg}</div></div>
    <div class="pr" style="margin-bottom:2px;"><div class="prl" style="font-size:9px;">${_bopImg(11)} BOP</div><div class="prt"><div class="prf" style="width:${Math.min(100,((3+DB.mp.bop)/20)*100)}%;background:var(--bop)"></div></div><div class="prp" style="color:var(--bop);font-size:9px;">${3+DB.mp.bop}</div></div>
    <div style="font-size:8px;color:var(--t3);margin-top:2px;">Total: <b style="color:var(--ok);">${totalMp}</b></div>`;
  const rowRows=DB.rowIssues.map(r=>{
    const opened=new Date(r.opened),today=new Date();
    const days=Math.floor((today-opened)/(1000*60*60*24));
    const status=r.status||'Open';
    const sChip=status==='Open'?'chip cr':'chip cg';
    return`<tr><td><b>${r.loc}</b></td><td style="font-size:8px;">${r.issue}</td><td><span class="${sChip}">${status}</span></td><td><span class="chip cr">${days}d</span></td></tr>`;
  }).join('');

  document.getElementById('home-pod-dpr').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;padding-bottom:5px;border-bottom:1px solid var(--b1);">
      <div style="font-size:10px;font-weight:600;color:var(--t2);">POD &amp; Daily Progress</div>
      <button class="btn bts" style="font-size:7px;padding:2px 7px;" onclick="nav('pod')">Submit →</button>
    </div>
    ${allPod.length===0
      ?`<div style="color:var(--t3);font-size:8px;padding:3px 0;">No POD entries today.</div>`
      :allPod.slice(-3).reverse().map(p=>`
        <div style="background:var(--card3);border-radius:4px;padding:3px 7px;margin-bottom:2px;font-size:8px;display:flex;justify-content:space-between;align-items:center;gap:4px;">
          <b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:65%;">${p.activity||'—'}</b>
          <div style="color:var(--t3);white-space:nowrap;">MP:${p.mp||0}|${p.by||'—'}</div>
        </div>`).join('')}
    <div style="font-size:8px;font-weight:600;color:var(--t2);margin:6px 0 3px;">Manpower (DPR)</div>
    ${mpEl2}
    <div style="font-size:8px;font-weight:600;color:var(--t2);margin:6px 0 3px;">
      ROW Issues <span class="chip cr" style="font-size:7px;">${rowCnt} Open</span>
    </div>
    <div class="tsc" style="max-height:100px;overflow-y:auto;">
      <table class="tbl" style="font-size:8px;"><thead><tr><th>Loc.</th><th>Issue</th><th>Status</th><th>Open</th></tr></thead><tbody>${rowRows}</tbody></table>
    </div>`;

  // ── ROW 3 RIGHT: S-Curve Chart + Milestones ─────────────────────────────
  const sc=DB.schedule;
  const fi=sc.actual.findLastIndex(v=>v!==null);
  // True S-curve projection: sigmoid-based, not linear
  const lastActual = sc.actual[fi]||0;
  const remainSteps = sc.labels.length - 1 - fi;
  const sCurve = sc.labels.map((_,i)=>{
    if(i<=fi) return null;
    const t = (i - fi) / remainSteps; // 0→1
    // Sigmoid: slow start, fast middle, slow end
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

  // ── Scheduled Milestones ────────────────────────────────────────────────
  const mEl=document.getElementById('home-milestones');
  if(mEl) mEl.innerHTML=DB.milestones.map(m=>{
    const today=new Date(),md=new Date(m.date);
    const diff=Math.ceil((md-today)/(1000*60*60*24));
    const cls=diff<0?'tdn':diff<=7?'tnx':'tpd';
    const lbl=diff<0?`${Math.abs(diff)}d ago`:diff===0?'TODAY!':diff<=30?`${diff}d`:m.date.slice(5);
    return`<div class="tli ${cls}" style="margin-bottom:3px;padding:4px 6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:4px;">
        <div class="ttx" style="font-size:9px;flex:1;">${m.label}</div>
        <span class="chip ${diff<0?'cr':diff<=7?'cy':'cb'}" style="font-size:7px;white-space:nowrap;">${lbl}</span>
      </div>
    </div>`;
  }).join('')||`<div style="color:var(--t3);font-size:9px;padding:4px;">No milestones.</div>`;
  // ── Blockers (section removed from layout, skip rendering) ─────────────

  // POD count
  const podCt=document.getElementById('mc-pod');
  if(podCt)podCt.textContent=DB.pod.s.length+DB.pod.w.length+DB.pod.l.length+DB.pod.b.length;

  // Auto-save timestamp
  const ts=document.getElementById('last-saved-ts');
  if(ts&&DB._lastSaved)ts.textContent='💾 Saved: '+new Date(DB._lastSaved).toLocaleTimeString();

  // Initialize advanced features (Gantt, KPI trends)
  if(typeof initHomeAdvanced==='function') initHomeAdvanced();
}

// ── Milestone form ────────────────────────────────────────────────────────
function openMilestoneForm(){
  document.getElementById('p-t').textContent='📅 Add Milestone / Schedule';
  document.getElementById('p-b').innerHTML=`
    <div class="fg"><label class="fl">Date</label><input class="fi" id="ms-date" type="date" required></div>
    <div class="fg"><label class="fl">Milestone</label><input class="fi" id="ms-label" placeholder="e.g. ITC-1 Commissioning" required></div>
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
function saveMilestone(){
  const d=document.getElementById('ms-date')?.value;
  const l=document.getElementById('ms-label')?.value?.trim();
  if(!d||!l)return;
  DB.milestones.push({date:d,label:l,mod:document.getElementById('ms-mod')?.value||'Overall'});
  DB.milestones.sort((a,b)=>a.date.localeCompare(b.date));
  saveDB();cov('pov');rndrHome();
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


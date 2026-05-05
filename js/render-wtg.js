//  WTG
// ═══════════════════════════════════════════════════════════
// Image helpers are defined globally in data.js

function rndrWtg(){
  const wtg=calcWtgProg();
  const ready=DB.wtg.turbines.filter(t=>t.status==='ready').length;
  const foundDone=DB.wtg.turbines.filter(t=>['casting','ready'].includes(t.status)).length;
  const lp=DB.wtg.turbines.filter(t=>t.lp).length;
  const pp=DB.wtg.turbines.filter(t=>t.pp).length;
  const erectionDone=DB.wtg.turbines.filter(t=>t.status==='ready'&&t.mech[0]>=100).length;
  const ussCount=DB.wtg.turbines.filter(t=>t.uss>=100).length;
  _pageLogoTR();
  // Section navigation
  if(typeof injectSecNav==='function') setTimeout(()=>injectSecNav('view-wtg',[
    {id:'wtg-kr',label:'KPIs',icon:'📊'},{id:'wtg-tc',label:'Turbines',icon:'⚡'},{id:'wtg-tab-ct',label:'Activities',icon:'📋'},
  ]),50);
  document.getElementById('wtg-kr').innerHTML=`
    <div class="kpi" data-tt="Overall WTG construction progress across all 26 turbines"><div class="kb" style="background:var(--wtg)"></div><div class="kl">WTG Overall %</div><div class="kv" style="color:var(--wtg)">${wtg}%</div></div>
    <div class="kpi" data-tt="Turbines ready for mechanical erection"><div class="kb" style="background:var(--ok)"></div><div class="kl">Ready for Erection</div><div class="kv" style="color:var(--ok)">${ready}/26</div></div>
    <div class="kpi" data-tt="Foundation casting completed"><div class="kb" style="background:var(--ac)"></div><div class="kl">Foundation Completed</div><div class="kv" style="color:var(--ac)">${foundDone}/26</div></div>
    <div class="kpi" data-tt="Logistic pathway cleared for transport"><div class="kb" style="background:var(--sol)"></div><div class="kl">Logistic Pathway</div><div class="kv" style="color:var(--sol)">${lp}/26</div></div>
    <div class="kpi" data-tt="Permanent pathway constructed"><div class="kb" style="background:var(--land)"></div><div class="kl">Permanent Pathway</div><div class="kv" style="color:var(--land)">${pp}/26</div></div>
    <div class="kpi" data-tt="Tower + Nacelle + Blade erection done"><div class="kb" style="background:var(--er)"></div><div class="kl">Erection Done</div><div class="kv" style="color:var(--er)">${erectionDone}/26</div></div>
    <div class="kpi" data-tt="USS (Under Stratum Survey) work completed"><div class="kb" style="background:var(--ok)"></div><div class="kl">USS Complete</div><div class="kv" style="color:var(--ok)">${ussCount}/26</div></div>`;

  const tcEl=document.getElementById('wtg-tc');if(!tcEl)return;
  tcEl.innerHTML=`<div class="wtg-split">
    <div class="wtg-left-panel">
      <div style="font-family:var(--f2);font-size:11px;font-weight:600;margin-bottom:8px;color:var(--wtg);">${_turbImg(20,'var(--wtg)')} All 26 Turbines</div>
      <div class="turbg" id="wtg-turb-grid">${rndrTurbGrid()}</div>
    </div>
    <div class="wtg-right-panel" id="wtg-right-panel">
      <div style="text-align:center;color:var(--t3);padding:40px 20px;">
        <div style="margin-bottom:10px;">${_turbImg(56,'')}</div>
        <div style="font-size:11px;">Select a turbine to view detail</div>
      </div>
    </div>
  </div>`;
}

function wTab(t){
  curWT=t;
  document.querySelectorAll('#view-wtg .tab').forEach((x,i)=>x.classList.toggle('on',i===t));
  const rp=document.getElementById('wtg-right-panel');if(!rp)return;
  if(t===0){
    if(!rp.querySelector('.btn.btwt')){
      rp.innerHTML=`<div style="text-align:center;color:var(--t3);padding:40px 20px;"><div style="margin-bottom:10px;">${_turbImg(56,'')}</div><div style="font-size:11px;">Select a turbine from the left</div></div>`;
    }
    return;
  }
  let html='';
  if(t===1)html=rndrCivilTab();
  else if(t===2)html=rndrMechTab();
  else if(t===3)html=rndrPathTab();
  else if(t===4)html=rndrSupTab();
  rp.innerHTML=`<div style="padding:2px;">${html}</div>`;
  document.querySelectorAll('.turb').forEach(el=>el.style.outline='none');
}

function rndrTurbGrid(){
  const cm={ready:'var(--ok)',casting:'var(--ac)',wip:'var(--wn)',row:'var(--er)',pending:'var(--t4)',delayed:'var(--bop)'};
  const statusLabel={ready:'READY',casting:'CASTING',wip:'WIP',row:'ROW HOLD',pending:'PENDING',delayed:'DELAYED'};
  return DB.wtg.turbines.map(t=>{
    const p=calcTurbProg(t);const sc=cm[t.status]||'var(--t4)';
    return`<div class="turb st-${t.status}" onclick="selectTurbine('${t.id}')" id="tcard-${t.id}"
      data-tt="${t.id} | ${statusLabel[t.status]||t.status} | Progress: ${p}% | LP:${t.lp?'✅':'⏳'} PP:${t.pp?'✅':'⏳'}${t.notes?' | '+t.notes:''}">
      <div style="line-height:1;">${_turbImg(26,sc)}</div>
      <div style="font-size:8px;font-weight:700;color:${sc};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.id}</div>
      <div style="font-family:var(--f2);font-size:12px;font-weight:700;color:${sc};">${p}%</div>
      <div style="font-size:7px;color:var(--t4);line-height:1.2;">${(statusLabel[t.status]||t.status).slice(0,8)}</div>
      ${t.status==='wip'?'<div style="width:5px;height:5px;background:var(--wn);border-radius:50%;margin:2px auto;animation:pu 1.5s infinite;"></div>':''}
    </div>`;
  }).join('');
}

// Target completion dates per turbine status
const WTG_TARGET_DATES={
  'MBI-12':'Apr 2026','MKD-258':'On Hold','MKD-253':'Apr 2026','MOB-403':'May 2026',
  'KDK-462':'May 2026','BDK-85':'May 2026','AMK-264':'Jun 2026','CDP-221':'May 2026',
  'MOB-142':'May 2026','MKD-211':'Jun 2026','MKD-52':'On Hold','BDK-25':'Jul 2026',
};
function getTargetDate(id){
  return WTG_TARGET_DATES[id]||'TBD';
}

function selectTurbine(id){
  document.querySelectorAll('.turb').forEach(el=>el.style.outline='none');
  const card=document.getElementById('tcard-'+id);
  if(card)card.style.outline='2.5px solid var(--wtg)';
  const t=DB.wtg.turbines.find(x=>x.id===id);if(!t)return;
  const p=calcTurbProg(t);
  const rp=document.getElementById('wtg-right-panel');if(!rp)return;
  const sc={ready:'var(--ok)',casting:'var(--ac)',wip:'var(--wn)',row:'var(--er)',pending:'var(--t4)'}[t.status]||'var(--t4)';
  const statusMap={ready:'READY FOR ERECTION',casting:'CASTING / CURING',wip:'WORK IN PROGRESS',row:'ROW HOLD',pending:'NOT STARTED',delayed:'DELAYED'};
  document.querySelectorAll('#view-wtg .tab').forEach((x,i)=>x.classList.toggle('on',i===0));
  // Mechanical unit counts: Tower Sections=5, Nacelle=1, Hub=1, Blades=3
  const mechUnits=[5,1,1,3];
  const mechNames=['Tower Erection','Nacelle Install','Hub Install','Blade Assembly'];
  rp.innerHTML=`
    <div style="text-align:center;padding:14px 0 10px;border-bottom:1px solid var(--b1);margin-bottom:12px;">
      <div style="margin-bottom:8px;">${_turbImg(64,sc)}</div>
      <div style="font-family:var(--f2);font-size:22px;font-weight:700;color:${sc}">${t.id}</div>
      <div style="margin-top:5px;"><span class="chip ${t.status==='ready'?'cg':t.status==='wip'?'cy':'cr'}" style="font-size:10px;padding:3px 12px;">${statusMap[t.status]||t.status.toUpperCase()}</span></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:5px;margin-bottom:12px;">
      <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:var(--t3);">Overall</div><div style="font-family:var(--f2);font-size:20px;font-weight:700;color:${sc}">${p}%</div></div>
      <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:var(--t3);">Log Path</div><div style="font-size:16px;">${t.lp?"✅":"⏳"}</div><div style="font-size:7px;color:${t.lp?"var(--ok)":"var(--t3)"};">${t.lp?"Done":"Pending"}</div></div>
      <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:var(--t3);">Perm Path</div><div style="font-size:16px;">${t.pp?"✅":"⏳"}</div><div style="font-size:7px;color:${t.pp?"var(--ok)":"var(--t3)"};">${t.pp?"Done":"Pending"}</div></div>
      <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;"><div style="font-size:8px;color:var(--t3);">Target</div><div style="font-size:9px;font-weight:700;color:var(--wn);margin-top:2px;">${getTargetDate(id)}</div></div>
    </div>
    <div style="height:8px;background:var(--b1);border-radius:4px;margin-bottom:12px;overflow:hidden;"><div style="width:${p}%;height:100%;background:${sc};border-radius:4px;transition:width 1s;"></div></div>
    <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:1px;margin-bottom:5px;">Civil (30%)</div>
    ${DB.wtg.civil.map((a,i)=>`<div class="pr" style="margin-bottom:3px;"><div class="prl" style="min-width:110px;font-size:9px;">${a.n}</div><div class="prt"><div class="prf" style="width:${t.civil[i]}%;background:${t.civil[i]>=100?"var(--ok)":t.civil[i]>0?"var(--wn)":"var(--b3)"}"></div></div><div class="prp" style="font-size:9px;color:${t.civil[i]>=100?"var(--ok)":t.civil[i]>0?"var(--wn)":"var(--er)"};">${t.civil[i]}%</div></div>`).join("")}
    <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:1px;margin:8px 0 5px;">Mechanical (50%) — unit counts</div>
    ${DB.wtg.mech.map((a,i)=>{const units=mechUnits[i]||1;const donePcs=Math.round(t.mech[i]/100*units);return`<div class="pr" style="margin-bottom:3px;"><div class="prl" style="min-width:110px;font-size:9px;">${mechNames[i]||a.n}</div><div class="prt"><div class="prf" style="width:${t.mech[i]}%;background:${t.mech[i]>=100?"var(--ok)":t.mech[i]>0?"var(--wn)":"var(--b3)"}"></div></div><div class="prp" style="font-size:9px;color:${t.mech[i]>=100?"var(--ok)":t.mech[i]>0?"var(--wn)":"var(--er)"};">${donePcs}/${units}</div></div>`;}).join("")}
    <div style="font-size:9px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:1px;margin:8px 0 5px;">USS (10%) &amp; Supply</div>
    <div class="pr" style="margin-bottom:3px;"><div class="prl" style="min-width:110px;font-size:9px;">USS Works</div><div class="prt"><div class="prf" style="width:${t.uss}%;background:var(--ok)"></div></div><div class="prp" style="font-size:9px;">${t.uss}%</div></div>
    <div class="pr" style="margin-bottom:3px;"><div class="prl" style="min-width:110px;font-size:9px;">33kV Transformer</div><div class="prt"><div class="prf" style="width:${t.sup}%;background:var(--ac)"></div></div><div class="prp" style="font-size:9px;">${t.sup>=100?"1/1":"0/1"}</div></div>
    <div style="font-size:9px;color:var(--t3);margin:8px 0;">📝 ${t.notes}</div>
    <button class="btn btwt" onclick="reqLogin('wtg',()=>openWtgProgFor('${id}'))">📊 Enter Today's Progress</button>`;
}


function wTab(t){
  curWT=t;
  document.querySelectorAll('#view-wtg .tab').forEach((x,i)=>x.classList.toggle('on',i===t));
  const rp=document.getElementById('wtg-right-panel');if(!rp)return;
  if(t===0){
    if(!rp.querySelector('.btn.btwt')){
      rp.innerHTML=`<div style="text-align:center;color:var(--t3);padding:40px 20px;"><div style="margin-bottom:10px;">${_turbImg(56,'')}</div><div style="font-size:11px;">Select a turbine from the left</div></div>`;
    }
    return;
  }
  let html='';
  if(t===1)html=rndrCivilTab();
  else if(t===2)html=rndrMechTab();
  else if(t===3)html=rndrPathTab();
  else if(t===4)html=rndrSupTab();
  else if(t===5)html=rndrSchedTab();
  rp.innerHTML=`<div style="padding:2px;">${html}</div>`;
  document.querySelectorAll('.turb').forEach(el=>el.style.outline='none');
}

function rndrTurbs(){return '';}

// ── Planned/Completed date helper ────────────────────────────────────────
function saveTurbDate(id,key,val){
  const t=DB.wtg.turbines.find(x=>x.id===id);
  if(!t)return;if(!t.dates)t.dates={};t.dates[key]=val;scheduleSave();
}

function rndrCivilTab(){
  return`<div class="pnl"><div class="ph2"><div class="pt">Civil Activities — Planned &amp; Completed Dates (30%)</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Activity</th><th>Progress</th><th>Planned Date</th><th>Completed Date</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di='style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;"';return DB.wtg.civil.map((a,i)=>`<tr>
        <td style="font-size:9px;font-weight:600;">${t.id}</td>
        <td style="font-size:9px;">${a.n}</td>
        <td><span class="chip ${(t.civil[i]||0)>=100?'cg':(t.civil[i]||0)>0?'cy':'cr'}">${t.civil[i]||0}%</span></td>
        <td><input type="date" value="${t.dates['civ_'+i+'_plan']||''}" ${di} onchange="saveTurbDate('${t.id}','civ_${i}_plan',this.value)"></td>
        <td><input type="date" value="${t.dates['civ_'+i+'_done']||''}" ${di} onchange="saveTurbDate('${t.id}','civ_${i}_done',this.value)"></td>
      </tr>`).join('');}).join('')}</tbody>
    </table></div></div>`;
}

function rndrMechTab(){
  const mechNames=['Tower Erection','Nacelle Install','Hub Install','Blade Assembly'];
  const mechUnits=[5,1,1,3];
  return`<div class="pnl"><div class="ph2"><div class="pt">Mechanical Activities — Planned &amp; Completed Dates (50%)</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Activity</th><th>Count</th><th>Planned Date</th><th>Completed Date</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di='style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;"';return DB.wtg.mech.map((a,i)=>{const u=mechUnits[i]||1;const d=Math.round((t.mech[i]||0)/100*u);return`<tr>
        <td style="font-size:9px;font-weight:600;">${t.id}</td>
        <td style="font-size:9px;">${mechNames[i]||a.n}</td>
        <td><span class="chip ${(t.mech[i]||0)>=100?'cg':(t.mech[i]||0)>0?'cy':'cr'}">${d}/${u}</span></td>
        <td><input type="date" value="${t.dates['mec_'+i+'_plan']||''}" ${di} onchange="saveTurbDate('${t.id}','mec_${i}_plan',this.value)"></td>
        <td><input type="date" value="${t.dates['mec_'+i+'_done']||''}" ${di} onchange="saveTurbDate('${t.id}','mec_${i}_done',this.value)"></td>
      </tr>`;}).join('');}).join('')}</tbody>
    </table></div></div>`;
}

function rndrPathTab(){
  return`<div class="pnl"><div class="ph2"><div class="pt">Pathway — Planned &amp; Completed Dates</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Type</th><th>Status</th><th>Planned Date</th><th>Completed Date</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di='style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;"';return`
        <tr><td style="font-size:9px;font-weight:600;" rowspan="2">${t.id}</td>
        <td style="font-size:9px;">Logistic Pathway</td>
        <td>${t.lp?'<span class="chip cg">Done</span>':'<span class="chip cr">Pending</span>'}</td>
        <td><input type="date" value="${t.dates.lp_plan||''}" ${di} onchange="saveTurbDate('${t.id}','lp_plan',this.value)"></td>
        <td><input type="date" value="${t.dates.lp_done||''}" ${di} onchange="saveTurbDate('${t.id}','lp_done',this.value)"></td></tr>
        <tr><td style="font-size:9px;">Permanent Pathway</td>
        <td>${t.pp?'<span class="chip cg">Done</span>':'<span class="chip cr">Pending</span>'}</td>
        <td><input type="date" value="${t.dates.pp_plan||''}" ${di} onchange="saveTurbDate('${t.id}','pp_plan',this.value)"></td>
        <td><input type="date" value="${t.dates.pp_done||''}" ${di} onchange="saveTurbDate('${t.id}','pp_done',this.value)"></td></tr>`;}).join('')}</tbody>
    </table></div></div>`;
}

function rndrSupTab(){
  const comps=[
    {key:'tower',  label:'Tower Sections (x5)', u:5},
    {key:'nacelle',label:'Nacelle',             u:1},
    {key:'hub',    label:'Hub',                 u:1},
    {key:'blade',  label:'Blade Set (x3)',      u:3},
    {key:'xfmr33', label:'33kV Transformer',   u:1},
    {key:'conv',   label:'Converter Panel',     u:1},
  ];
  return`<div class="pnl"><div class="ph2"><div class="pt">Supply Chain — Component Arrival Dates</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Component</th><th>Qty</th><th>Expected Arrival</th><th>Actual Arrival</th><th>Status</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di='style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;"';
      return comps.map(c=>`<tr>
        <td style="font-size:9px;font-weight:600;">${t.id}</td>
        <td style="font-size:9px;">${c.label}</td>
        <td style="text-align:center;font-size:9px;">${c.u}</td>
        <td><input type="date" value="${t.dates[c.key+'_exp']||''}" ${di} onchange="saveTurbDate('${t.id}','${c.key}_exp',this.value)"></td>
        <td><input type="date" value="${t.dates[c.key+'_arr']||''}" ${di} onchange="saveTurbDate('${t.id}','${c.key}_arr',this.value)"></td>
        <td>${t.dates[c.key+'_arr']?'<span class="chip cg">Arrived</span>':'<span class="chip cr">Awaited</span>'}</td>
      </tr>`).join('');}).join('')}</tbody>
    </table></div></div>`;
}

function rndrSchedTab(){return '';}

function saveTurbDate(id,key,val){
  const t=DB.wtg.turbines.find(x=>x.id===id);
  if(!t)return;if(!t.sched)t.sched={};t.sched[field]=val;scheduleSave();
}
function showTurb(id){selectTurbine(id);}// legacy stub

// ═══════════════════════════════════════════════════════════

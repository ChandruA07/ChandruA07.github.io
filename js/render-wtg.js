//  WTG
// ═══════════════════════════════════════════════════════════
// Image helpers are defined globally in data.js

function rndrWtg(){
  // Recompute all derived statuses BEFORE counting — guarantees KPIs match data.
  // (Won't override manual ROW lock; recalcTurbStatus respects it.)
  if (typeof recalcTurbStatus === 'function') {
    DB.wtg.turbines.forEach(t => recalcTurbStatus(t));
  }
  const wtg=calcWtgProg();

  // Derived counters — every counter is computed from leaf data, never trusted.
  const turbines = DB.wtg.turbines || [];
  const total    = turbines.length || 26;

  // "Foundation Completed" → all 5 civil steps at 100%
  const foundDone = turbines.filter(t => Array.isArray(t.civil) && t.civil.length >= 1 &&
                                         t.civil.every(v => (v||0) >= 100)).length;

  // "Ready for Erection" → foundation done AND mech work not yet finished (status = casting or ready)
  // Per spec: when casting completed → "Ready for Erection" +1
  const ready = turbines.filter(t => t.status === 'casting' || t.status === 'ready').length;

  // Pathway counters
  const lp = turbines.filter(t => t.lp).length;
  const pp = turbines.filter(t => t.pp).length;

  // "Erection Done" → all mech steps at 100% (Tower + Nacelle + Hub + Blade)
  const erectionDone = turbines.filter(t => Array.isArray(t.mech) && t.mech.length >= 1 &&
                                            t.mech.every(v => (v||0) >= 100)).length;

  // USS (Under-Stratum Survey) — turbines where uss is 100
  const ussCount = turbines.filter(t => (t.uss||0) >= 100).length;

  // Commissioned — all civil + mech + uss + supply at 100
  const commissioned = turbines.filter(t =>
    Array.isArray(t.civil) && t.civil.every(v => (v||0)>=100) &&
    Array.isArray(t.mech)  && t.mech.every(v => (v||0)>=100) &&
    (t.uss||0) >= 100 && (t.sup||0) >= 100).length;

  _pageLogoTR();
  // Section navigation
  if(typeof injectSecNav==='function') setTimeout(()=>injectSecNav('view-wtg',[
    {id:'wtg-kr',label:'KPIs',icon:'📊'},{id:'wtg-tc',label:'Turbines',icon:'⚡'},{id:'wtg-tab-ct',label:'Activities',icon:'📋'},
  ]),50);
  document.getElementById('wtg-kr').innerHTML=`
    <div class="kpi" data-tt="Overall WTG construction progress across all ${total} turbines"><div class="kb" style="background:var(--wtg)"></div><div class="kl">WTG Overall %</div><div class="kv" style="color:var(--wtg)">${wtg}%</div></div>
    <div class="kpi" data-tt="Turbines ready for mechanical erection (foundation casting complete)"><div class="kb" style="background:var(--ok)"></div><div class="kl">Ready for Erection</div><div class="kv" style="color:var(--ok)">${ready}/${total}</div></div>
    <div class="kpi" data-tt="Foundation casting completed (all 5 civil steps at 100%)"><div class="kb" style="background:var(--ac)"></div><div class="kl">Foundation Completed</div><div class="kv" style="color:var(--ac)">${foundDone}/${total}</div></div>
    <div class="kpi" data-tt="Logistic pathway cleared for transport"><div class="kb" style="background:var(--sol)"></div><div class="kl">Logistic Pathway</div><div class="kv" style="color:var(--sol)">${lp}/${total}</div></div>
    <div class="kpi" data-tt="Permanent pathway constructed"><div class="kb" style="background:var(--land)"></div><div class="kl">Permanent Pathway</div><div class="kv" style="color:var(--land)">${pp}/${total}</div></div>
    <div class="kpi" data-tt="Tower + Nacelle + Hub + Blade erection done"><div class="kb" style="background:var(--er)"></div><div class="kl">Erection Done</div><div class="kv" style="color:var(--er)">${erectionDone}/${total}</div></div>
    <div class="kpi" data-tt="USS (Under Stratum Survey) work completed"><div class="kb" style="background:var(--ok)"></div><div class="kl">USS Complete</div><div class="kv" style="color:var(--ok)">${ussCount}/${total}</div></div>
    <div class="kpi" data-tt="Fully commissioned turbines (all activities 100%)"><div class="kb" style="background:var(--ok)"></div><div class="kl">Commissioned</div><div class="kv" style="color:var(--ok)">${commissioned}/${total}</div></div>`;

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

// ── Role helpers — only WTG Manager (or Site Manager 'all') may edit dates ─
function _isWtgEditor(){
  return (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit('wtg'));
}

// ── Auto-recompute turbine.status from civil/mech progress ────────────────
// Rules (project-supplied):
//   • civil avg < 50  → 'wip'
//   • civil avg >=50, all civil[]>=100, mech avg <100 → 'casting' (foundation done)
//   • all civil[]>=100 AND all mech[]>=100 → 'ready' (erection done)
//   • status 'row' is preserved (manual ROW lock); 'pending' for brand-new
function recalcTurbStatus(t){
  if(!t)return;
  if(t.status==='row')return; // ROW lock is manual; don't override
  const cArr=t.civil||[], mArr=t.mech||[];
  if(cArr.length===0)return;
  const cAvg=cArr.reduce((s,v)=>s+(v||0),0)/cArr.length;
  const mAvg=mArr.length?mArr.reduce((s,v)=>s+(v||0),0)/mArr.length:0;
  const allCivilDone=cArr.every(v=>(v||0)>=100);
  const allMechDone =mArr.length>0 && mArr.every(v=>(v||0)>=100);
  if(allCivilDone && allMechDone) t.status='ready';
  else if(allCivilDone)            t.status='casting';
  else if(cAvg>0 || mAvg>0)        t.status='wip';
  else                             t.status='pending';
}

// ── Planned/Completed date helper ────────────────────────────────────────
//
// Routes through dataApi.updateTurbine (Firebase) — the change fans out
// via the realtime listener → appState → DB → re-render. Single source
// of truth, real-time sync across devices, auth-protected.
async function saveTurbDate(id,key,val){
  if(!_isWtgEditor()){
    if(typeof showToast==='function')showToast('🔒 WTG Manager login required to edit dates','er');
    if(typeof rndrWtg==='function' && CV==='wtg'){rndrWtg();wTab(curWT);}
    return;
  }
  const t=DB.wtg.turbines.find(x=>x.id===id);
  if(!t)return;

  // Update local copy immediately (optimistic UI)
  if(!t.dates)t.dates={};
  t.dates[key]=val;

  // Auto-promote progress when "_done" date is filled in
  if(val){
    const m1=key.match(/^civ_(\d+)_done$/);
    const m2=key.match(/^mec_(\d+)_done$/);
    if(m1){const i=+m1[1]; if(t.civil[i]<100)t.civil[i]=100;}
    if(m2){const i=+m2[1]; if(t.mech[i]<100) t.mech[i]=100;}
    if(key==='lp_done')t.lp=true;
    if(key==='pp_done')t.pp=true;
  }
  recalcTurbStatus(t);

  // Push the full leaf snapshot to Firebase via dataApi
  try {
    await dataApi.updateTurbine(t.id, {
      status: t.status,
      lp:     !!t.lp,
      pp:     !!t.pp,
      civil:  t.civil || [],
      mech:   t.mech  || [],
      uss:    t.uss   || 0,
      sup:    t.sup   || 0,
      notes:  t.notes || '',
      mechDates: t.dates || {}
    });
    // Track in Daily Progress feed (best-effort)
    if (typeof dataApi.pushDailyProgress === 'function') {
      dataApi.pushDailyProgress({
        module: 'WTG',
        turbine: t.id,
        act: key.replace(/_/g,' '),
        val: val ? 1 : 0,
        pct: calcTurbProg(t)
      }).catch(()=>{});
    }
    if(typeof showToast==='function')showToast('✅ '+t.id+' updated','ok');
  } catch (err) {
    if(typeof showToast==='function')showToast('❌ '+(err.message||'Save failed'),'er');
  }
  // Listener will re-render automatically; force a local refresh so the
  // counters in the header update without waiting for the round-trip.
  if(CV==='wtg'){rndrWtg();wTab(curWT);}
  if(typeof updateOverallBars==='function')updateOverallBars();
}

// ── Edit-permission banner shown above date tables ─────────────────────────
function _wtgEditBanner(){
  if(_isWtgEditor()){
    const me = (typeof auth !== 'undefined') ? auth.current() : null;
    const lbl = (me && me.role === 'admin') ? 'Site Manager' : 'WTG Engineer';
    return `<div class="al al-g" style="margin:0 0 8px 0;font-size:9px;">✅ Logged in as <b>${lbl}</b> — date fields are editable.</div>`;
  }
  return `<div class="al al-w" style="margin:0 0 8px 0;font-size:9px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
    <span>🔒 <b>View-only</b> — date fields are locked. Login as WTG Engineer to edit.</span>
    <button class="btn btwt" style="font-size:9px;padding:3px 8px;" onclick="auth.requireRole('wtg',()=>{if(CV==='wtg'){rndrWtg();wTab(curWT);}})">🔑 Login as WTG Engineer</button>
  </div>`;
}

function rndrCivilTab(){
  const ed=_isWtgEditor();
  const lockAttr=ed?'':'disabled';
  const lockStyle=ed?'':'opacity:.55;cursor:not-allowed;';
  return`${_wtgEditBanner()}<div class="pnl"><div class="ph2"><div class="pt">Civil Activities — Planned &amp; Completed Dates (30%)</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Activity</th><th>Progress</th><th>Planned Date</th><th>Completed Date</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di=`style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;${lockStyle}"`;return DB.wtg.civil.map((a,i)=>`<tr>
        <td style="font-size:9px;font-weight:600;">${t.id}</td>
        <td style="font-size:9px;">${a.n}</td>
        <td><span class="chip ${(t.civil[i]||0)>=100?'cg':(t.civil[i]||0)>0?'cy':'cr'}">${t.civil[i]||0}%</span></td>
        <td><input type="date" value="${t.dates['civ_'+i+'_plan']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','civ_${i}_plan',this.value)"></td>
        <td><input type="date" value="${t.dates['civ_'+i+'_done']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','civ_${i}_done',this.value)"></td>
      </tr>`).join('');}).join('')}</tbody>
    </table></div></div>`;
}

function rndrMechTab(){
  const ed=_isWtgEditor();
  const lockAttr=ed?'':'disabled';
  const lockStyle=ed?'':'opacity:.55;cursor:not-allowed;';
  const mechNames=['Tower Erection','Nacelle Install','Hub Install','Blade Assembly'];
  const mechUnits=[5,1,1,3];
  return`${_wtgEditBanner()}<div class="pnl"><div class="ph2"><div class="pt">Mechanical Activities — Planned &amp; Completed Dates (50%)</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Activity</th><th>Count</th><th>Planned Date</th><th>Completed Date</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di=`style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;${lockStyle}"`;return DB.wtg.mech.map((a,i)=>{const u=mechUnits[i]||1;const d=Math.round((t.mech[i]||0)/100*u);return`<tr>
        <td style="font-size:9px;font-weight:600;">${t.id}</td>
        <td style="font-size:9px;">${mechNames[i]||a.n}</td>
        <td><span class="chip ${(t.mech[i]||0)>=100?'cg':(t.mech[i]||0)>0?'cy':'cr'}">${d}/${u}</span></td>
        <td><input type="date" value="${t.dates['mec_'+i+'_plan']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','mec_${i}_plan',this.value)"></td>
        <td><input type="date" value="${t.dates['mec_'+i+'_done']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','mec_${i}_done',this.value)"></td>
      </tr>`;}).join('');}).join('')}</tbody>
    </table></div></div>`;
}

function rndrPathTab(){
  const ed=_isWtgEditor();
  const lockAttr=ed?'':'disabled';
  const lockStyle=ed?'':'opacity:.55;cursor:not-allowed;';
  return`${_wtgEditBanner()}<div class="pnl"><div class="ph2"><div class="pt">Pathway — Planned &amp; Completed Dates</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Type</th><th>Status</th><th>Planned Date</th><th>Completed Date</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di=`style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;${lockStyle}"`;return`
        <tr><td style="font-size:9px;font-weight:600;" rowspan="2">${t.id}</td>
        <td style="font-size:9px;">Logistic Pathway</td>
        <td>${t.lp?'<span class="chip cg">Done</span>':'<span class="chip cr">Pending</span>'}</td>
        <td><input type="date" value="${t.dates.lp_plan||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','lp_plan',this.value)"></td>
        <td><input type="date" value="${t.dates.lp_done||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','lp_done',this.value)"></td></tr>
        <tr><td style="font-size:9px;">Permanent Pathway</td>
        <td>${t.pp?'<span class="chip cg">Done</span>':'<span class="chip cr">Pending</span>'}</td>
        <td><input type="date" value="${t.dates.pp_plan||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','pp_plan',this.value)"></td>
        <td><input type="date" value="${t.dates.pp_done||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','pp_done',this.value)"></td></tr>`;}).join('')}</tbody>
    </table></div></div>`;
}

function rndrSupTab(){
  const ed=_isWtgEditor();
  const lockAttr=ed?'':'disabled';
  const lockStyle=ed?'':'opacity:.55;cursor:not-allowed;';
  const comps=[
    {key:'tower',  label:'Tower Sections (x5)', u:5},
    {key:'nacelle',label:'Nacelle',             u:1},
    {key:'hub',    label:'Hub',                 u:1},
    {key:'blade',  label:'Blade Set (x3)',      u:3},
    {key:'xfmr33', label:'33kV Transformer',   u:1},
    {key:'conv',   label:'Converter Panel',     u:1},
  ];
  return`${_wtgEditBanner()}<div class="pnl"><div class="ph2"><div class="pt">Supply Chain — Component Arrival Dates</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Component</th><th>Qty</th><th>Expected Arrival</th><th>Actual Arrival</th><th>Status</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di=`style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;${lockStyle}"`;
      return comps.map(c=>`<tr>
        <td style="font-size:9px;font-weight:600;">${t.id}</td>
        <td style="font-size:9px;">${c.label}</td>
        <td style="text-align:center;font-size:9px;">${c.u}</td>
        <td><input type="date" value="${t.dates[c.key+'_exp']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','${c.key}_exp',this.value)"></td>
        <td><input type="date" value="${t.dates[c.key+'_arr']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','${c.key}_arr',this.value)"></td>
        <td>${t.dates[c.key+'_arr']?'<span class="chip cg">Arrived</span>':'<span class="chip cr">Awaited</span>'}</td>
      </tr>`).join('');}).join('')}</tbody>
    </table></div></div>`;
}

function rndrSchedTab(){return '';}

function showTurb(id){selectTurbine(id);}// legacy stub

// ═══════════════════════════════════════════════════════════

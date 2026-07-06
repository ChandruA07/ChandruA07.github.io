//  WTG — Restructured
// ═══════════════════════════════════════════════════════════
//  Top header:    Overall %, Casting, Logistic Pathway, Permanent Pathway,
//                 Ready for Erection, Erection Done, USS Complete, Commissioned
//  Left panel:    26 Turbines + Zero Point (Store Yard) tile
//  Right panel:   Detail page — icon top-left, three accordion sections
//                 (Pre-Erection, Erection, Post-Erection) with activities
//                 and sub-activities (planned/actual dates, status,
//                 responsible, remarks, delay reason, photo upload).
//  Real-time:     sub-activity → activity → turbine → fleet KPI roll-up.
// ═══════════════════════════════════════════════════════════
// Image helpers are defined globally in data.js

// Track which turbine (or 'ZP' for Zero Point) is currently selected
let _wtgSelected = null;
let _wtgOpenSection = 'pre';
let _wtgOpenAct = null;
// Zero Point UI: which material/unit is expanded
let _wtgZpOpenMat = null;
let _wtgZpOpenUnit = null;
// Pathways (LP/PP) section open state
let _wtgPathOpen = false;
// curWT is declared globally in nav.js — do NOT redeclare here.

function rndrWtg(){
  // If we arrived at the WTG view while Zero Point was the last selection
  // (e.g. the user opened the standalone Zero Point view, then clicked WTG),
  // clear that stale selection so the ZP detail does not leak into the WTG
  // right panel. ZP has its own dedicated view (view-zp); inside WTG we start
  // with no turbine selected.
  if (CV === 'wtg' && _wtgSelected === 'ZP') {
    _wtgSelected = null;
  }
  // Init new activity tree + Zero Point (idempotent — safe on every render)
  if(typeof zeroPointInit==='function') zeroPointInit();
  (DB.wtg.turbines||[]).forEach(t=>{
    if(typeof wtgInitActs==='function') wtgInitActs(t);
  });

  // Recompute statuses from leaf data
  if (typeof recalcTurbStatus === 'function') {
    DB.wtg.turbines.forEach(t => recalcTurbStatus(t));
  }

  const wtgPct = calcWtgProg();
  const turbines = DB.wtg.turbines || [];
  const total = (DB.wtg && DB.wtg.count) ? DB.wtg.count : 26;

  // ── Date picker bar + snapshot mode ──
  const _wdpBar=document.getElementById('wtg-dp-bar');
  if(_wdpBar && typeof dpRenderBar==='function') _wdpBar.innerHTML=dpRenderBar('wtg');
  const _wLive=(typeof dpIsLive==='function')?dpIsLive('wtg'):true;
  const _wSnap=(typeof dpGetSnapshot==='function')?dpGetSnapshot('wtg'):null;
  // Headline % shown — snapshot value when viewing a past date
  const _wtgShown=(!_wLive && _wSnap && _wSnap.wtg) ? _wSnap.wtg.overall : wtgPct;

  // ── Header KPI roll-ups — auto-link to specific activity completion ─────
  // Per spec:
  //   Casting              → counts a turbine when Civil "casting" reaches 100%
  //   Logistic Pathway     → counts when turbine.lp flag is set (LP pathway done)
  //   Permanent Pathway    → counts when turbine.pp flag is set (PP pathway done)
  //   Ready for Erection   → counts when Civil "cranePad" reaches 100%
  //                          AND Mechanical is NOT yet 100% (decrements once
  //                          the turbine moves past Erection Done)
  //   Erection Done        → counts when Mechanical "rotorUp" reaches 100%
  //   USS Complete         → counts when both Electrical USS-Civil & USS-Equip = 100%
  //   Commissioned         → counts when Electrical "commiss" = 100%
  //                          AND Mechanical = 100% AND Civil = 100%
  const _actDone = (t, sec, key) => {
    const p = (typeof wtgActPct==='function') ? wtgActPct(t,sec,key) : 0;
    return p >= 100;
  };
  const _secDone = (t, sec) => {
    return (typeof wtgSectionPct==='function') ? wtgSectionPct(t,sec) >= 100 : false;
  };

  // Casting (Civil/casting OR legacy civ[4]>=100)
  const castingCount = turbines.filter(t =>
    _actDone(t,'pre','casting') || (Array.isArray(t.civil)&&(t.civil[4]||0)>=100)
  ).length;

  const lpCount = turbines.filter(t=>t.lp).length;
  const ppCount = turbines.filter(t=>t.pp).length;

  // Ready for Erection: crane pad done AND mechanical not yet done
  // (turbine "leaves" Ready once Mechanical/erection section is complete)
  const readyCount = turbines.filter(t => {
    const cranePadDone = _actDone(t,'pre','cranePad') ||
                        (Array.isArray(t.civil)&&t.civil.every(v=>(v||0)>=100));
    const mechDone = _secDone(t,'erection') ||
                     (Array.isArray(t.mech)&&t.mech.length>=1&&t.mech.every(v=>(v||0)>=100));
    return cranePadDone && !mechDone && t.status!=='row';
  }).length;

  // Erection Done: Rotor Up completed (the user-specified anchor)
  const erectionDoneCount = turbines.filter(t =>
    _actDone(t,'erection','rotorUp') ||
    _secDone(t,'erection') ||
    (Array.isArray(t.mech)&&t.mech.length>=1&&t.mech.every(v=>(v||0)>=100))
  ).length;

  // USS Complete: both USS Civil + USS Equipment activities done
  const ussCompleteCount = turbines.filter(t => {
    if(typeof wtgActPct==='function'){
      const a = wtgActPct(t,'post','ussCivil');
      const b = wtgActPct(t,'post','ussEquip');
      if(a>=100 && b>=100) return true;
    }
    return (t.uss||0)>=100;
  }).length;

  // Commissioned: Electrical/commiss done + all upstream sections done
  const commissionedCount = turbines.filter(t => {
    if(_actDone(t,'post','commiss') && _secDone(t,'erection') && _secDone(t,'pre')) return true;
    return Array.isArray(t.civil)&&t.civil.every(v=>(v||0)>=100) &&
           Array.isArray(t.mech) &&t.mech.every(v=>(v||0)>=100) &&
           (t.uss||0)>=100 && (t.sup||0)>=100;
  }).length;

  _pageLogoTR();
  if(typeof injectSecNav==='function') setTimeout(()=>injectSecNav('view-wtg',[
    {id:'wtg-kr',label:'KPIs',icon:'📊'},
    {id:'wtg-tc',label:'Turbines',icon:'⚡'},
  ]),50);

  // ── 8 dynamic KPI tiles ────────────────────────────────────────────────
  // ── KPI override support — authorized users can correct counts ──
  if(!DB.wtg.kpiOverrides || typeof DB.wtg.kpiOverrides!=='object') DB.wtg.kpiOverrides={};
  const _ov=DB.wtg.kpiOverrides;
  const _wEd=_isWtgEditor();
  // val(key, computed) → overridden value if present, else computed
  const _kv=(key,computed)=> (_ov[key]!=null && _ov[key]!=='') ? _ov[key] : computed;
  // a count KPI cell — clickable to edit when authorized
  const _kCell=(key,label,color,computed,tip)=>{
    const v=_kv(key,computed);
    const isOv=(_ov[key]!=null && _ov[key]!=='');
    const editAttr=_wEd?`onclick="wtgEditKpi('${key}','${label.replace(/'/g,'')}',${computed})" style="cursor:pointer;" title="Click to correct this value"`:'';
    return `<div class="kpi" data-tt="${tip}" ${editAttr}>
      <div class="kb" style="background:${color}"></div>
      <div class="kl">${label}${isOv?' <span style="font-size:7px;color:var(--wn);">✎ edited</span>':''}</div>
      <div class="kv" style="color:${color}">${v}/${total}</div></div>`;
  };

  document.getElementById('wtg-kr').innerHTML = `
    <div class="kpi" data-tt="Overall WTG construction across all ${total} turbines (live)">
      <div class="kb" style="background:var(--wtg)"></div>
      <div class="kl">Overall %</div>
      <div class="kv" style="color:var(--wtg)">${_wtgShown}%</div></div>
    ${_kCell('casting','Casting','var(--ac)',castingCount,'Foundation casting completed')}
    ${_kCell('lp','Logistic Pathway','var(--sol)',lpCount,'Logistic pathway cleared for heavy transport')}
    ${_kCell('pp','Permanent Pathway','var(--land)',ppCount,'Permanent pathway constructed')}
    ${_kCell('ready','Ready for Erection','var(--wn)',readyCount,'Ready for mechanical erection')}
    ${_kCell('erection','Erection Done','var(--er)',erectionDoneCount,'Tower + Nacelle + Hub + Blade + Rotor erection done')}
    ${_kCell('uss','USS Complete','var(--ok)',ussCompleteCount,'USS Civil + USS Equipment both complete')}
    ${_kCell('commissioned','Commissioned','var(--ok)',commissionedCount,'Trial run + sync + load test + final approval')}`;

  // ── Split layout: left grid + Zero Point, right detail panel ───────────
  const tcEl = document.getElementById('wtg-tc'); if(!tcEl) return;
  tcEl.innerHTML = `<div class="wtg-split">
    <div class="wtg-left-panel">
      <div style="font-family:var(--f2);font-size:11px;font-weight:600;margin-bottom:8px;color:var(--wtg);display:flex;align-items:center;gap:6px;">
        ${_turbImg(20,'var(--wtg)')} All ${total} Turbines
      </div>
      <div class="turbg" id="wtg-turb-grid">${rndrTurbGrid()}</div>
      ${_isWtgEditor()?`<button class="btn btwt bts" style="width:100%;margin-top:8px;font-size:10px;padding:6px;"
              onclick="wtgOpenAddLocation()">+ Add WTG Location</button>`:''}
      <div id="wtg-addloc-host"></div>
    </div>
    <div class="wtg-right-panel" id="wtg-right-panel">
      ${rndrRightPanelEmpty()}
    </div>
  </div>`;

  // Restore previous selection across re-renders
  if(_wtgSelected && _wtgSelected !== 'ZP'){
    selectTurbine(_wtgSelected);
  }

  if (typeof renderModulePodList === 'function') renderModulePodList('w','wtg-pod-list');
  if (typeof renderModuleNdpList === 'function') renderModuleNdpList('w','wtg-ndp-list');
}

function rndrRightPanelEmpty(){
  return `<div style="text-align:center;color:var(--t3);padding:40px 20px;">
    <div style="margin-bottom:10px;">${_turbImg(56,'')}</div>
    <div style="font-size:11px;">Select a turbine or Zero Point to view details</div>
  </div>`;
}

// ── Turbine grid (left) ───────────────────────────────────────────────────
// Does turbine t currently have a ROW issue? (open global ROW row OR status='row')
function _wtgHasROW(t){
  if(!t) return false;
  if(t.status === 'row') return true;
  const issues = (DB.rowIssues || []).filter(r =>
    (r.status || 'Open') === 'Open' &&
    r.type === 'WTG' &&
    r.loc && r.loc.indexOf(t.id) >= 0
  );
  return issues.length > 0;
}

// ── Raise / Close ROW for a turbine ───────────────────────────────────────
async function wtgRaiseROW(turbId){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const t = DB.wtg.turbines.find(x=>x.id===turbId); if(!t) return;
  const reason = prompt('Describe the ROW issue at '+turbId+':');
  if(!reason || !reason.trim()) return;
  // Set turbine flag immediately
  t.status = 'row';
  try {
    if(typeof dataApi!=='undefined' && dataApi.updateTurbine){
      await dataApi.updateTurbine(turbId, {status:'row'});
    }
    if(typeof dataApi!=='undefined' && dataApi.addRowIssue){
      await dataApi.addRowIssue({
        loc: turbId,
        issue: reason.trim(),
        type: 'WTG',
        status: 'Open'
      });
    }
  } catch(e){ console.warn('[wtg] raise ROW failed', e); }
  if(typeof showToast==='function') showToast('🚧 ROW raised for '+turbId,'wn');
  rndrWtg(); if(typeof wTab==='function') wTab(curWT);
}

async function wtgCloseROW(turbId){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const t = DB.wtg.turbines.find(x=>x.id===turbId); if(!t) return;
  if(!confirm('Close ROW for '+turbId+'? The turbine will return to green.')) return;
  // Revert the turbine status (best-effort: WIP for in-progress, else pending)
  const newStatus = (calcTurbProg(t) > 0) ? 'wip' : 'pending';
  t.status = newStatus;
  try {
    if(typeof dataApi!=='undefined' && dataApi.updateTurbine){
      await dataApi.updateTurbine(turbId, {status:newStatus});
    }
    // Close any matching open ROW issues
    const open = (DB.rowIssues || []).filter(r =>
      (r.status || 'Open') === 'Open' &&
      r.type === 'WTG' &&
      r.loc && r.loc.indexOf(turbId) >= 0
    );
    for(const r of open){
      if(r.id && typeof dataApi!=='undefined' && dataApi.updateRowIssue){
        try {
          await dataApi.updateRowIssue(r.id, {status:'Closed'});
        } catch(e){ console.warn('[wtg] close ROW issue failed', e); }
      } else {
        // Seed entry without Firebase id — patch local copy
        r.status = 'Closed';
      }
    }
  } catch(e){ console.warn('[wtg] close ROW failed', e); }
  if(typeof showToast==='function') showToast('✅ ROW closed for '+turbId+' — back to green','ok');
  rndrWtg(); if(typeof wTab==='function') wTab(curWT);
}

function rndrTurbGrid(){
  return DB.wtg.turbines.map(t=>{
    const p = calcTurbProg(t);
    const isRow = _wtgHasROW(t);
    // Simplified colour scheme: ROW = red, everything else = green
    const sc = isRow ? 'var(--er)' : 'var(--ok)';
    const label = isRow ? 'ROW' : 'WIP';
    const ringClass = isRow ? 'turb-row' : 'turb-wip';
    return `<div class="turb ${ringClass}" onclick="selectTurbine('${t.id}')" id="tcard-${t.id}"
      style="position:relative;border:1px solid ${sc};box-shadow:0 0 8px ${sc}40;background:var(--card2);"
      data-tt="${esc(t.id)} | ${esc(label)} | Progress: ${p}%${t.notes?' | '+esc(t.notes):''}">
      <div style="line-height:1;">${_turbImg(26,sc)}</div>
      <div style="font-size:8px;font-weight:700;color:${sc};margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.id}</div>
      <div style="font-family:var(--f2);font-size:12px;font-weight:700;color:${sc};">${p}%</div>
      <div style="font-size:7px;font-weight:700;color:${sc};line-height:1.2;letter-spacing:.4px;">${label}</div>
      ${!isRow?'<div style="width:5px;height:5px;background:var(--ok);border-radius:50%;margin:2px auto;animation:pu 1.5s infinite;"></div>':''}
    </div>`;
  }).join('');
}


// ── Add new WTG turbine location ─────────────────────────────────────────
// ── Edit a header KPI count (authorized users) ───────────────────────────
function wtgEditKpi(key, label, computed){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const cur = (DB.wtg.kpiOverrides && DB.wtg.kpiOverrides[key]!=null && DB.wtg.kpiOverrides[key]!=='')
    ? DB.wtg.kpiOverrides[key] : computed;
  const v = prompt('Correct the "'+label+'" count\n\nAuto-calculated value: '+computed+
                    '\nEnter a value to override, or leave blank to use auto:', cur);
  if(v===null) return;
  if(!DB.wtg.kpiOverrides) DB.wtg.kpiOverrides={};
  if(String(v).trim()===''){
    delete DB.wtg.kpiOverrides[key];
  } else {
    const n=parseInt(v,10);
    if(!isFinite(n)||n<0){ if(typeof showToast==='function') showToast('❌ Enter a valid number','er'); return; }
    DB.wtg.kpiOverrides[key]=n;
  }
  _wtgPersistKpiOverrides();
  if(typeof showToast==='function') showToast('✅ "'+label+'" updated','ok');
  rndrWtg(); if(typeof wTab==='function') wTab(curWT);
}

async function _wtgPersistKpiOverrides(){
  try{
    if(typeof dataApi!=='undefined' && dataApi.setWtgKpiOverrides){
      await dataApi.setWtgKpiOverrides(DB.wtg.kpiOverrides);
    }
  }catch(e){ console.warn('[wtg] persist kpi overrides failed',e); }
}

// Turbine icon colour is now fully automatic:
//   • Green by default
//   • Red ONLY when an open ROW issue exists for that turbine
// (The previous user-controlled colour picker has been removed per spec.)

const WTG_VENDORS = ['HML','KRR','Ashwin','NR Infra','SLV','Saishreeja','Other'];

function wtgOpenAddLocation(){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const host = document.getElementById('wtg-addloc-host'); if(!host) return;
  if(host.dataset.open==='1'){ host.innerHTML=''; host.dataset.open=''; return; }
  host.dataset.open='1';
  host.innerHTML = `
    <div style="background:var(--card);border:1px dashed var(--wtg);border-radius:7px;padding:11px;margin-top:8px;">
      <div style="font-weight:700;font-size:10px;margin-bottom:7px;color:var(--wtg);">+ New WTG Location</div>
      <label style="font-size:8px;color:var(--t3);display:block;">Location Name / ID
        <input id="wtg-nl-id" type="text" placeholder="e.g. MBI-300"
          style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:5px 6px;font-size:10px;">
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px;">
        <label style="font-size:8px;color:var(--t3);">Vendor
          <select id="wtg-nl-vendor"
            style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:5px 6px;font-size:10px;">
            ${WTG_VENDORS.map(v=>`<option value="${v}">${v}</option>`).join('')}
          </select>
        </label>
        <label style="font-size:8px;color:var(--t3);">MW Capacity
          <input id="wtg-nl-mw" type="number" min="0" step="0.1" value="2.7"
            style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:5px 6px;font-size:10px;">
        </label>
      </div>
      <div style="display:flex;gap:6px;margin-top:9px;">
        <button class="btn btwt bts" style="font-size:9px;padding:5px 12px;" onclick="wtgSubmitNewLocation()">✓ Add Location</button>
        <button class="btn bts" style="font-size:9px;padding:5px 12px;" onclick="document.getElementById('wtg-addloc-host').innerHTML='';document.getElementById('wtg-addloc-host').dataset.open=''">Cancel</button>
      </div>
    </div>`;
}

async function wtgSubmitNewLocation(){
  if(!_isWtgEditor()) return;
  const id = (document.getElementById('wtg-nl-id')||{}).value || '';
  const vendor = (document.getElementById('wtg-nl-vendor')||{}).value || '';
  const mw = parseFloat((document.getElementById('wtg-nl-mw')||{}).value) || 0;
  const name = id.trim();
  if(!name){ if(typeof showToast==='function') showToast('❌ Location name required','er'); return; }
  if(DB.wtg.turbines.some(t=>t.id===name)){
    if(typeof showToast==='function') showToast('❌ "'+name+'" already exists','er');
    return;
  }
  const t = {
    id: name,
    vendor: vendor,
    mw: mw,
    status: 'pending',
    lp: false, pp: false,
    civil:[0,0,0,0,0], mech:[0,0,0,0], uss:0, sup:0,
    notes: 'New location added — work not yet started'
  };
  DB.wtg.turbines.push(t);
  if(typeof DB.wtg.count==='number') DB.wtg.count = DB.wtg.turbines.length;
  // Seed the activity + pathway trees so the detail panel works immediately
  if(typeof wtgInitActs==='function') wtgInitActs(t);
  if(typeof wtgInitPathways==='function') wtgInitPathways(t);
  // Persist
  try {
    if(typeof dataApi!=='undefined' && dataApi.updateTurbine){
      await dataApi.updateTurbine(name, {
        status:t.status, lp:t.lp, pp:t.pp,
        civil:t.civil, mech:t.mech, uss:t.uss, sup:t.sup,
        notes:t.notes, vendor:t.vendor, mw:t.mw, acts:t.acts, pathways:t.pathways
      });
    } else {
      console.warn('[wtg] dataApi unavailable — write skipped');
      if(typeof showToast==='function') showToast('❌ Save failed — dataApi unavailable','er');
    }
    if(typeof showToast==='function') showToast('✅ Location "'+name+'" added','ok');
  } catch(e){
    if(typeof showToast==='function') showToast('❌ Save failed: '+(e.message||e),'er');
  }
  // Re-render WTG view and open the new turbine
  if(typeof rndrWtg==='function') rndrWtg();
  if(typeof selectTurbine==='function') selectTurbine(name);
}

// ── Zero Point (Store Yard) tile ─────────────────────────────────────────
function rndrZeroPointTile(){
  const zp = DB.wtg.zeroPoint || {materials:[]};
  const matCount = (zp.materials||[]).length;
  const arrived = (zp.materials||[]).filter(m=>m.deliveryDate).length;
  return `<div class="turb st-zp" id="tcard-ZP" onclick="nav('zp')"
    style="background:linear-gradient(135deg,rgba(124,77,255,.10),rgba(101,31,255,.04));border:1px solid rgba(124,77,255,.4);padding:10px;text-align:left;cursor:pointer;"
    title="Open the Zero Point — Store Yard section">
    <div style="display:flex;align-items:center;gap:8px;">
      <div style="font-size:22px;line-height:1;">🏬</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:700;color:var(--wtg);">Zero Point (Store Yard)</div>
        <div style="font-size:9px;color:var(--t3);margin-top:2px;">${arrived}/${matCount} materials received · ${(zp.mobilizations||[]).length} mobilizations</div>
      </div>
      <div style="font-size:11px;color:var(--wtg);">→</div>
    </div>
  </div>`;
}

// ── Target dates ─────────────────────────────────────────────────────────
const WTG_TARGET_DATES={
  'MBI-12':'Apr 2026','MKD-258':'On Hold','MKD-253':'Apr 2026','MOB-403':'May 2026',
  'KDK-462':'May 2026','BDK-85':'May 2026','AMK-264':'Jun 2026','CDP-221':'May 2026',
  'MOB-142':'May 2026','MKD-211':'Jun 2026','MKD-52':'On Hold','BDK-25':'Jul 2026',
};
function getTargetDate(id){ return WTG_TARGET_DATES[id]||'TBD'; }

// ═══════════════════════════════════════════════════════════
//  RIGHT-SIDE DETAIL PANEL — Turbine
// ═══════════════════════════════════════════════════════════
function selectTurbine(id){
  _wtgSelected = id;
  // Fresh selection → progress date defaults to today (clears any prior back-date)
  if(typeof _wtgProgDate!=='undefined') _wtgProgDate = null;
  if(typeof dataApi!=='undefined' && dataApi.setProgressDate) dataApi.setProgressDate(null);
  document.querySelectorAll('.turb').forEach(el=>el.style.outline='none');
  const card=document.getElementById('tcard-'+id);
  if(card) card.style.outline='2.5px solid var(--wtg)';
  const t = DB.wtg.turbines.find(x=>x.id===id); if(!t) return;
  if(typeof wtgInitActs==='function') wtgInitActs(t);
  if(typeof wtgInitPathways==='function') wtgInitPathways(t);

  const p = calcTurbProg(t);
  const sectPct = wtgTurbActsPct(t);
  const rp = document.getElementById('wtg-right-panel'); if(!rp) return;
  // Effective ROW state — t.status==='row' OR an open WTG row issue for this turbine
  const hasROW = (typeof _wtgHasROW === 'function') ? _wtgHasROW(t) : (t.status === 'row');
  const sc = hasROW ? 'var(--er)' : 'var(--ok)';
  const statusMap={ready:'READY FOR ERECTION',casting:'CASTING/CURING',wip:'WORK IN PROGRESS',row:'ROW HOLD',pending:'NOT STARTED',delayed:'DELAYED'};
  const ed = _isWtgEditor();
  // ROW banner (raise when no ROW, close when ROW active)
  const _openRows = (DB.rowIssues || []).filter(r =>
    (r.status || 'Open') === 'Open' && r.type === 'WTG' &&
    r.loc && r.loc.indexOf(t.id) >= 0);
  const rowBanner = hasROW
    ? `<div style="background:rgba(239,68,68,.10);border:1px solid var(--er);border-radius:7px;
                   padding:9px 11px;margin:8px 0;display:flex;align-items:center;gap:9px;">
        <span style="font-size:14px;">🚧</span>
        <div style="flex:1;">
          <div style="font-size:10px;font-weight:800;color:var(--er);">ROW ACTIVE</div>
          <div style="font-size:9px;color:var(--t2);margin-top:2px;">
            ${_openRows.length ? _openRows.map(r=>'• '+(r.issue||'ROW issue')).join('<br>') : 'Status flag set to ROW'}
          </div>
        </div>
        ${ed ? `<button class="btn bts" style="font-size:9px;padding:5px 11px;background:var(--ok);color:#071020;font-weight:800;"
                    onclick="wtgCloseROW('${t.id}')">✓ Close ROW</button>` : ''}
       </div>`
    : (ed
        ? `<div style="display:flex;justify-content:flex-end;margin:8px 0;">
             <button class="btn bts" style="font-size:9px;padding:5px 11px;background:var(--er);color:#fff;font-weight:700;"
                     onclick="wtgRaiseROW('${t.id}')">🚧 Raise ROW</button>
           </div>`
        : '');

  // Set tab to overview when selecting a turbine
  document.querySelectorAll('#view-wtg .tab').forEach((x,i)=>x.classList.toggle('on',i===0));
  curWT = 0;

  rp.innerHTML = `
    <!-- Header: icon TOP-LEFT, ID + status on the right -->
    <div class="wtg-detail-header">
      <div class="wtg-detail-icon">${_turbImg(48,sc)}</div>
      <div class="wtg-detail-info">
        <div class="wtg-detail-title" style="color:${sc};">${t.id}</div>
        <div style="margin-top:3px;">
          <span class="chip ${hasROW?'cr':(t.status==='ready'?'cg':t.status==='wip'?'cy':'cr')}" style="font-size:9px;padding:2px 9px;">${hasROW?'ROW HOLD':(statusMap[t.status]||t.status.toUpperCase())}</span>
        </div>
        <div style="font-size:9px;color:var(--t3);margin-top:4px;">Overall <b style="color:${sc};">${p}%</b> · LP <b style="color:${t.lp?'var(--ok)':'var(--t3)'};">${typeof wtgPathwayPct==='function'?wtgPathwayPct(t,'lp'):0}%</b> · PP <b style="color:${t.pp?'var(--ok)':'var(--t3)'};">${typeof wtgPathwayPct==='function'?wtgPathwayPct(t,'pp'):0}%</b></div>
      </div>
    </div>

    ${rowBanner}

    <div style="height:6px;background:var(--b1);border-radius:4px;margin:8px 0 12px;overflow:hidden;">
      <div style="width:${p}%;height:100%;background:${sc};border-radius:4px;transition:width .8s;"></div>
    </div>

    ${ed ? `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--card2);border:1px solid var(--b1);border-radius:7px;padding:6px 10px;margin-bottom:10px;">
      <span style="font-size:10px;">📅</span>
      <span style="font-size:9px;font-weight:700;color:var(--t2);">Progress date:</span>
      <input type="date" id="wtg-prog-date" max="${_progDateToday()}" value="${_progDateToday()}"
             onchange="wtgSetProgDate(this.value)"
             style="background:var(--card);border:1px solid var(--b1);border-radius:5px;color:var(--t1);font-size:10px;padding:3px 6px;">
      <span style="font-size:8px;color:var(--t3);">Edits below are recorded for this day (pick a past date to back-date).</span>
    </div>` : ''}

    ${_rndrPathways(t)}

    <!-- Section accordion: Pre-Erection / Erection / Post-Erection -->
    ${rndrSectionAccordion(t,'pre',sectPct.pre)}
    ${rndrSectionAccordion(t,'erection',sectPct.erection)}
    ${rndrSectionAccordion(t,'post',sectPct.post)}

    ${t.notes?`<div style="font-size:9px;color:var(--t3);margin:10px 0 0;padding:8px;background:var(--card2);border-radius:6px;border-left:3px solid var(--wn);">📝 ${esc(t.notes)}</div>`:''}

    ${_rndrSiteIssues(t, _isWtgEditor())}
  `;
}

// ═══════════════════════════════════════════════════════════
// ── LP / PP PATHWAY TRACKING (per-turbine) ─────────────────
// ═══════════════════════════════════════════════════════════
function _rndrPathways(t){
  if(typeof wtgInitPathways === 'function') wtgInitPathways(t);
  return `<div class="wtg-section" style="margin-bottom:10px;">
    <div class="wtg-section-head" onclick="wtgTogglePathways()" style="cursor:pointer;">
      <span style="font-size:14px;">🛣️</span>
      <span style="font-weight:700;font-size:11px;color:var(--ac);">Access Pathways — LP &amp; PP</span>
      <span style="font-size:9px;color:var(--t3);margin-left:8px;">
        LP ${wtgPathwayPct(t,'lp')}% · PP ${wtgPathwayPct(t,'pp')}%
      </span>
      <span style="font-size:10px;color:var(--t3);margin-left:auto;">${_wtgPathOpen?'▼':'▶'}</span>
    </div>
    ${_wtgPathOpen?`<div class="wtg-section-body">
      ${_rndrOnePathway(t,'lp','Logistic Pathway','Temporary access road for turbine component transport')}
      ${_rndrOnePathway(t,'pp','Permanent Pathway','Final permanent access road & drainage')}
    </div>`:''}
  </div>`;
}

function _rndrOnePathway(t, which, title, subtitle){
  const pw = t.pathways[which];
  const pct = wtgPathwayPct(t, which);
  const ed = _isWtgEditor();
  const disAttr = ed?'':'disabled';
  const col = pct>=100?'var(--ok)':pct>0?'var(--wn)':'var(--t4)';
  const icon = which==='lp'?'🚚':'🛤️';
  const doneCount = pw.stages.filter(s=>s.done).length;

  // target-date status hint
  let tgtHint = '';
  if(pw.targetDate){
    const today = new Date(); today.setHours(0,0,0,0);
    const tgt = new Date(pw.targetDate);
    const days = Math.round((tgt - today)/86400000);
    if(pct>=100)      tgtHint = `<span style="color:var(--ok);">✓ Completed</span>`;
    else if(days<0)   tgtHint = `<span style="color:var(--er);">⚠ ${Math.abs(days)}d overdue</span>`;
    else if(days===0) tgtHint = `<span style="color:var(--wn);">⏰ Due today</span>`;
    else              tgtHint = `<span style="color:var(--t3);">${days}d remaining</span>`;
  }

  const stageRows = pw.stages.map((s,i)=>{
    const isOptional = !!s.optional;
    const isEnabled = s.enabled !== false;
    // Optional + not enabled → greyed-out row with an "Add" toggle
    const rowDim = (isOptional && !isEnabled) ? 'opacity:.5;' : '';
    const optBadge = isOptional
      ? `<span style="font-size:7px;background:${isEnabled?'var(--ac)':'var(--t4)'};color:#fff;padding:1px 5px;border-radius:6px;margin-left:5px;">OPTIONAL</span>`
      : '';
    const enableToggle = isOptional
      ? `<label style="font-size:7px;color:var(--t3);display:flex;align-items:center;gap:3px;cursor:${ed?'pointer':'not-allowed'};">
           <input type="checkbox" ${isEnabled?'checked':''} ${disAttr}
                  onchange="wtgTogglePathStage('${t.id}','${which}',${i},this.checked)">
           Include
         </label>`
      : '';
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:5px 7px;border-bottom:1px solid var(--b1);${rowDim}">
      <input type="checkbox" ${s.done?'checked':''} ${(disAttr||(isOptional&&!isEnabled))?'disabled':''}
             onchange="wtgSavePathStage('${t.id}','${which}',${i},'done',this.checked)"
             style="cursor:${(ed&&!(isOptional&&!isEnabled))?'pointer':'not-allowed'};">
      <span style="flex:1;font-size:9px;font-weight:600;color:${s.done?'var(--ok)':'var(--t1)'};">
        ${i+1}. ${esc(s.n)}${optBadge}
      </span>
      ${enableToggle}
      <input type="date" value="${s.date||''}" ${(disAttr||(isOptional&&!isEnabled))?'disabled':''}
             onchange="wtgSavePathStage('${t.id}','${which}',${i},'date',this.value)"
             title="Stage date"
             style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:8px;">
      <input type="text" value="${(s.remarks||'').replace(/"/g,'&quot;')}" ${(disAttr||(isOptional&&!isEnabled))?'disabled':''}
             placeholder="remarks"
             onchange="wtgSavePathStage('${t.id}','${which}',${i},'remarks',this.value)"
             style="width:90px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:8px;">
    </div>`;}).join('');

  return `<div style="background:var(--card2);border:1px solid var(--b1);border-radius:7px;padding:10px;margin-bottom:8px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <span style="font-size:15px;">${icon}</span>
      <div style="flex:1;">
        <div style="font-size:10px;font-weight:800;color:${col};">${title}</div>
        <div style="font-size:8px;color:var(--t3);">${subtitle}</div>
      </div>
      <div style="text-align:right;">
        <div style="font-family:var(--f2);font-size:16px;font-weight:800;color:${col};">${pct}%</div>
        <div style="font-size:7px;color:var(--t3);">${doneCount}/${pw.stages.length} stages</div>
      </div>
    </div>
    <div style="height:5px;background:var(--b1);border-radius:3px;overflow:hidden;margin-bottom:8px;">
      <div style="width:${pct}%;height:100%;background:${col};border-radius:3px;transition:width .6s;"></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:8px;">
      <label style="font-size:8px;color:var(--t3);">🎯 Target Date
        <input type="date" value="${pw.targetDate||''}" ${disAttr}
               onchange="wtgSavePathMeta('${t.id}','${which}','targetDate',this.value)"
               style="display:block;width:100%;margin-top:2px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:3px 5px;font-size:9px;">
        ${tgtHint?`<div style="font-size:8px;margin-top:2px;">${tgtHint}</div>`:''}
      </label>
      <label style="font-size:8px;color:var(--t3);">👤 Responsible Person
        <input type="text" value="${(pw.responsible||'').replace(/"/g,'&quot;')}" ${disAttr}
               placeholder="e.g. Site Engineer"
               onchange="wtgSavePathMeta('${t.id}','${which}','responsible',this.value)"
               style="display:block;width:100%;margin-top:2px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:3px 5px;font-size:9px;">
      </label>
    </div>
    <label style="font-size:8px;color:var(--t3);display:block;margin-bottom:8px;">📝 Overall Remarks
      <textarea rows="1" ${disAttr} placeholder="Pathway-level remarks…"
                onchange="wtgSavePathMeta('${t.id}','${which}','remarks',this.value)"
                style="display:block;width:100%;margin-top:2px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:3px 5px;font-size:9px;resize:vertical;">${(pw.remarks||'').replace(/</g,'&lt;')}</textarea>
    </label>

    <div style="font-size:8px;font-weight:700;color:var(--t3);margin-bottom:3px;text-transform:uppercase;letter-spacing:.5px;">Stage Checklist</div>
    <div style="background:var(--card);border:1px solid var(--b1);border-radius:5px;overflow:hidden;">
      ${stageRows}
    </div>
  </div>`;
}

function wtgTogglePathways(){
  _wtgPathOpen = !_wtgPathOpen;
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

async function wtgSavePathStage(turbId, which, stageIdx, field, value){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const t = DB.wtg.turbines.find(x=>x.id===turbId); if(!t) return;
  if(typeof wtgInitPathways==='function') wtgInitPathways(t);
  const stage = t.pathways[which] && t.pathways[which].stages[stageIdx];
  if(!stage) return;
  stage[field] = value;
  if(field==='done' && value && !stage.date){
    stage.date = new Date().toISOString().slice(0,10);
  }
  // keep legacy boolean in sync for the fleet KPIs
  if(typeof wtgSyncPathwayLegacy==='function') wtgSyncPathwayLegacy(t);
  await _persistPathways(turbId, t);
  if(typeof showToast==='function') showToast('✅ '+(which.toUpperCase())+' updated','ok');
  if(CV==='wtg' && _wtgSelected===turbId) selectTurbine(turbId);
}

async function wtgTogglePathStage(turbId, which, stageIdx, enabled){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const t = DB.wtg.turbines.find(x=>x.id===turbId); if(!t) return;
  if(typeof wtgInitPathways==='function') wtgInitPathways(t);
  const stage = t.pathways[which] && t.pathways[which].stages[stageIdx];
  if(!stage || !stage.optional) return;
  stage.enabled = !!enabled;
  if(!enabled){ stage.done = false; }  // disabling clears its done state
  if(typeof wtgSyncPathwayLegacy==='function') wtgSyncPathwayLegacy(t);
  await _persistPathways(turbId, t);
  if(typeof showToast==='function') showToast(enabled?'✅ Optional stage included':'Optional stage excluded','ok');
  if(CV==='wtg' && _wtgSelected===turbId) selectTurbine(turbId);
}

async function wtgSavePathMeta(turbId, which, field, value){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const t = DB.wtg.turbines.find(x=>x.id===turbId); if(!t) return;
  if(typeof wtgInitPathways==='function') wtgInitPathways(t);
  if(!t.pathways[which]) return;
  t.pathways[which][field] = value;
  await _persistPathways(turbId, t);
  if(typeof showToast==='function') showToast('✅ '+(which.toUpperCase())+' '+field+' saved','ok');
  if(CV==='wtg' && _wtgSelected===turbId && field==='targetDate') selectTurbine(turbId);
}

async function _persistPathways(turbId, t){
  try {
    if(typeof dataApi !== 'undefined' && dataApi.updateTurbine){
      await dataApi.updateTurbine(turbId, { pathways: t.pathways, lp: !!t.lp, pp: !!t.pp });
    } else if(typeof dataApi !== 'undefined' && dataApi.setTurbine){
      await dataApi.setTurbine(turbId, t);
    }
  } catch(e){
    console.warn('[wtg] persist pathways failed', e);
  }
}

// ═══════════════════════════════════════════════════════════
// ── SITE ISSUES (per-turbine) ───────────────────────────────
// ═══════════════════════════════════════════════════════════
function _rndrSiteIssues(t, ed){
  if(!Array.isArray(t.siteIssues)) t.siteIssues = [];
  const issues = t.siteIssues;
  const openCount = issues.filter(i => (i.status || 'open') === 'open').length;
  const closedCount = issues.length - openCount;

  const rows = issues.length === 0
    ? `<div style="font-size:9px;color:var(--t3);padding:10px;text-align:center;font-style:italic;">No site issues logged</div>`
    : issues.map(iss => {
        const isOpen = (iss.status || 'open') === 'open';
        const badge = isOpen
          ? `<span style="background:var(--er);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;">🔴 OPEN</span>`
          : `<span style="background:var(--ok);color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:10px;">🟢 CLOSED</span>`;
        const closeBtn = ed
          ? `<button class="btn bts" onclick="turbineToggleIssue('${t.id}','${iss.id}')" style="font-size:8px;padding:2px 8px;">${isOpen?'Mark Closed':'Reopen'}</button>`
          : '';
        const delBtn = ed
          ? `<button class="btn bts" onclick="turbineDeleteIssue('${t.id}','${iss.id}')" style="font-size:8px;padding:2px 6px;" title="Delete">✕</button>`
          : '';
        return `<div style="background:var(--card2);border:1px solid var(--b1);border-radius:6px;padding:8px 10px;margin-bottom:6px;">
          <div style="display:flex;align-items:flex-start;gap:8px;">
            ${badge}
            <div style="flex:1;font-size:10px;color:var(--t1);line-height:1.5;">${(iss.remarks||'').replace(/</g,'&lt;')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;font-size:9px;color:var(--t3);">
            <span>📅 Raised: ${iss.dateRaised||'—'}</span>
            ${iss.dateClosed?`<span>· Closed: ${iss.dateClosed}</span>`:''}
            <span style="margin-left:auto;display:flex;gap:4px;">${closeBtn}${delBtn}</span>
          </div>
        </div>`;
      }).join('');

  return `<div class="wtg-section" style="margin-top:12px;">
    <div class="wtg-section-head" style="cursor:default;">
      <span style="font-size:14px;">📋</span>
      <span style="font-weight:700;font-size:11px;color:var(--er);">Site Issues</span>
      <span style="font-size:9px;color:var(--t3);margin-left:6px;">
        ${openCount} open · ${closedCount} closed
      </span>
      ${ed?`<button class="btn btwt bts" style="margin-left:auto;font-size:9px;padding:3px 10px;" onclick="turbineOpenIssueForm('${t.id}')">+ Raise Issue</button>`:''}
    </div>
    <div class="wtg-section-body">
      <div id="turb-issue-form-host-${t.id}"></div>
      ${rows}
    </div>
  </div>`;
}

function turbineOpenIssueForm(id){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const host = document.getElementById('turb-issue-form-host-'+id); if(!host) return;
  if(host.dataset.open === '1'){ host.innerHTML=''; host.dataset.open=''; return; }
  host.dataset.open = '1';
  const today = new Date().toISOString().slice(0,10);
  host.innerHTML = `<div style="background:var(--card);border:1px dashed var(--er);border-radius:6px;padding:10px;margin-bottom:8px;">
    <div style="font-weight:700;font-size:10px;margin-bottom:6px;color:var(--er);">📋 New Site Issue</div>
    <label style="font-size:8px;color:var(--t3);display:block;">Remarks (required)
      <textarea id="iss-remarks-${id}" rows="2" placeholder="Describe the issue…"
        style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;resize:vertical;"></textarea>
    </label>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin-top:8px;">
      <label style="font-size:8px;color:var(--t3);">Status
        <div style="display:flex;gap:8px;margin-top:3px;">
          <label style="font-size:9px;color:var(--t1);"><input type="radio" name="iss-st-${id}" value="open" checked> Open</label>
          <label style="font-size:9px;color:var(--t1);"><input type="radio" name="iss-st-${id}" value="closed"> Closed</label>
        </div>
      </label>
      <label style="font-size:8px;color:var(--t3);">Date Raised
        <input id="iss-date-${id}" type="date" value="${today}"
          style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;">
      </label>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;">
      <button class="btn btwt bts" style="font-size:9px;padding:4px 12px;" onclick="turbineSaveIssue('${id}')">✓ Save Issue</button>
      <button class="btn bts" style="font-size:9px;padding:4px 12px;" onclick="document.getElementById('turb-issue-form-host-${id}').innerHTML='';document.getElementById('turb-issue-form-host-${id}').dataset.open=''">Cancel</button>
    </div>
  </div>`;
}

async function turbineSaveIssue(id){
  if(!_isWtgEditor()) return;
  const t = DB.wtg.turbines.find(x => x.id === id); if(!t) return;
  const remarksEl = document.getElementById('iss-remarks-'+id);
  const dateEl = document.getElementById('iss-date-'+id);
  const statusRadio = document.querySelector('input[name="iss-st-'+id+'"]:checked');
  const remarks = (remarksEl ? remarksEl.value : '').trim();
  if(!remarks){ if(typeof showToast==='function') showToast('❌ Remarks required','er'); return; }
  const status = statusRadio ? statusRadio.value : 'open';
  const date = (dateEl ? dateEl.value : '') || new Date().toISOString().slice(0,10);

  if(!Array.isArray(t.siteIssues)) t.siteIssues = [];
  t.siteIssues.push({
    id: 'issue-' + Date.now(),
    remarks,
    status,
    dateRaised: date,
    dateClosed: status === 'closed' ? date : ''
  });

  await _persistTurbineIssues(id, t);
  if(typeof showToast==='function') showToast('📋 Site issue logged','ok');
  selectTurbine(id);
}

async function turbineToggleIssue(id, issueId){
  if(!_isWtgEditor()) return;
  const t = DB.wtg.turbines.find(x => x.id === id); if(!t) return;
  const iss = (t.siteIssues||[]).find(x => x.id === issueId); if(!iss) return;
  const willClose = (iss.status || 'open') === 'open';
  iss.status = willClose ? 'closed' : 'open';
  if(willClose && !iss.dateClosed) iss.dateClosed = new Date().toISOString().slice(0,10);
  if(!willClose) iss.dateClosed = '';
  await _persistTurbineIssues(id, t);
  selectTurbine(id);
}

async function turbineDeleteIssue(id, issueId){
  if(!_isWtgEditor()) return;
  if(!confirm('Delete this site issue?')) return;
  const t = DB.wtg.turbines.find(x => x.id === id); if(!t) return;
  t.siteIssues = (t.siteIssues||[]).filter(x => x.id !== issueId);
  await _persistTurbineIssues(id, t);
  if(typeof showToast==='function') showToast('🗑️ Issue removed','ok');
  selectTurbine(id);
}

async function _persistTurbineIssues(id, t){
  try {
    if(typeof dataApi !== 'undefined' && dataApi.updateTurbine){
      await dataApi.updateTurbine(id, { siteIssues: t.siteIssues });
    } else if(typeof dataApi !== 'undefined' && dataApi.setTurbine){
      await dataApi.setTurbine(id, t);
    }
  } catch(e){
    console.warn('[wtg] persist site issues failed', e);
  }
}

// ── Accordion section (Pre/Erection/Post) ────────────────────────────────
function rndrSectionAccordion(t, sectionKey, pct){
  const def = WTG_STRUCTURE[sectionKey];
  const open = (_wtgOpenSection === sectionKey);
  const headerCol = pct>=100?'var(--ok)':pct>0?def.color:'var(--t4)';
  const ed = _isWtgEditor();
  const acts = wtgGetActivities(sectionKey, t);
  return `<div class="wtg-section" data-section="${sectionKey}">
    <div class="wtg-section-head" onclick="wtgToggleSection('${sectionKey}')">
      <span style="font-size:14px;">${def.icon}</span>
      <span style="font-weight:700;font-size:11px;color:${headerCol};">${def.label}</span>
      <div style="flex:1;margin:0 8px;height:4px;background:var(--b1);border-radius:2px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${headerCol};transition:width .6s;"></div>
      </div>
      <span style="font-family:var(--f2);font-size:11px;font-weight:700;color:${headerCol};min-width:32px;text-align:right;">${pct}%</span>
      <span style="font-size:10px;color:var(--t3);margin-left:6px;">${open?'▼':'▶'}</span>
    </div>
    ${open?`<div class="wtg-section-body">
      ${acts.map(a=>rndrActivityRow(t, sectionKey, a)).join('')}
      ${ed?`
        <div id="wtg-addact-form-${sectionKey}"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:6px;">
          <button class="btn btwt bts" style="font-size:9px;padding:4px 10px;" onclick="event.stopPropagation();wtgOpenAddActivity('${sectionKey}','${t.id}')">+ Add Activity</button>
        </div>
      `:''}
    </div>`:''}
  </div>`;
}

// ── Activity row (collapsed/expanded with sub-activities) ────────────────
function rndrActivityRow(t, sectionKey, actDef){
  const pct = wtgActPct(t, sectionKey, actDef.key);
  const isOpen = (_wtgOpenSection===sectionKey && _wtgOpenAct===actDef.key);
  const col = pct>=100?'var(--ok)':pct>0?'var(--wn)':'var(--t4)';
  const ed = _isWtgEditor();
  const lockBadge = actDef.isDefault
    ? '<span title="Built-in activity — locked" style="font-size:8px;color:var(--t3);margin-left:5px;">🔒</span>'
    : (actDef.isLocal
       ? '<span title="This turbine only" style="font-size:7px;background:var(--wn);color:#071020;padding:1px 5px;border-radius:8px;margin-left:5px;font-weight:700;">TURBINE-ONLY</span>'
       : '<span title="Custom activity — all turbines" style="font-size:7px;background:var(--ac);color:#fff;padding:1px 5px;border-radius:8px;margin-left:5px;">ALL TURBINES</span>');
  const subsTotal = (actDef.subs||[]).length;
  const delBtn = (!actDef.isDefault && ed)
    ? `<button class="btn bts" onclick="event.stopPropagation();wtgRemoveAct('${sectionKey}','${actDef.key}')" title="Delete activity" style="font-size:8px;padding:1px 6px;margin-left:4px;">✕</button>`
    : '';
  // Reorder controls — authorized users only
  const moveBtns = ed
    ? `<span style="display:inline-flex;flex-direction:column;margin-left:4px;line-height:.7;">
         <button class="btn bts" title="Move up" style="font-size:7px;padding:0 4px;"
                 onclick="event.stopPropagation();wtgReorderActivity('${sectionKey}','${actDef.key}',-1)">▲</button>
         <button class="btn bts" title="Move down" style="font-size:7px;padding:0 4px;"
                 onclick="event.stopPropagation();wtgReorderActivity('${sectionKey}','${actDef.key}',1)">▼</button>
       </span>`
    : '';
  return `<div class="wtg-act">
    <div class="wtg-act-head" onclick="wtgToggleAct('${sectionKey}','${actDef.key}')">
      <span style="flex:1;font-size:10px;font-weight:600;color:var(--t1);">${actDef.n}${lockBadge}<span style="font-size:8px;color:var(--t3);font-weight:500;margin-left:6px;">${subsTotal} sub-activities</span></span>
      <div class="wtg-act-bar"><div class="wtg-act-bar-fill" style="width:${pct}%;background:${col};"></div></div>
      <span style="font-size:9px;font-weight:700;color:${col};min-width:32px;text-align:right;">${pct}%</span>
      ${moveBtns}
      ${delBtn}
      <span style="font-size:9px;color:var(--t3);margin-left:4px;">${isOpen?'▼':'▶'}</span>
    </div>
    ${isOpen?`<div class="wtg-act-body">
      ${(actDef.subs||[]).map((subName,i)=>rndrSubActivity(t, sectionKey, actDef.key, i, actDef.subsMeta[i])).join('')}
      ${ed?`
        <div id="wtg-addsub-form-${sectionKey}-${actDef.key}"></div>
        <div style="display:flex;justify-content:flex-end;margin-top:4px;">
          <button class="btn btwt bts" style="font-size:9px;padding:3px 9px;" onclick="event.stopPropagation();wtgOpenAddSub('${sectionKey}','${actDef.key}')">+ Add Sub-activity</button>
        </div>
      `:''}
    </div>`:''}
  </div>`;
}

// ── Sub-activity card ────────────────────────────────────────────────────
function rndrSubActivity(t, sectionKey, actKey, idx, meta){
  const s = t.acts[sectionKey][actKey].subs[idx];
  if(!s) return '';
  const ed = _isWtgEditor();
  const disAttr = ed?'':'disabled';
  const disStyle = ed?'':'opacity:.55;cursor:not-allowed;';
  const statusColor = WTG_STATUS_COLORS[s.status]||'var(--t4)';
  const path = `${sectionKey}|${actKey}|${idx}`;
  const photoBlock = s.photo
    ? `<img src="${s.photo}" style="max-width:80px;max-height:60px;border-radius:4px;border:1px solid var(--b1);" alt="proof">`
    : '';
  const isDefault = meta ? meta.isDefault : true;
  const lockIcon = isDefault
    ? '<span title="Default sub-activity — locked" style="font-size:8px;color:var(--t3);">🔒</span>'
    : '<span title="Custom" style="font-size:7px;background:var(--ac);color:#fff;padding:1px 4px;border-radius:6px;">CUSTOM</span>';
  const subDelBtn = (!isDefault && ed)
    ? `<button class="btn bts" onclick="wtgRemoveSub('${sectionKey}','${actKey}',${idx})" title="Delete sub-activity" style="font-size:8px;padding:1px 6px;margin-left:4px;">✕</button>`
    : '';
  // quantity progress
  const tq = s.totalQty||0, dq = s.doneQty||0;
  const qtyPct = tq>0 ? Math.round(Math.min(100,dq/tq*100)) : 0;
  const qtyCol = qtyPct>=100?'var(--ok)':qtyPct>0?'var(--wn)':'var(--t4)';
  // unique id for date-pair validation
  const did = ('wsd_'+path).replace(/[^a-zA-Z0-9_]/g,'_');
  const subMoveBtns = ed
    ? `<span style="display:inline-flex;flex-direction:column;margin-left:3px;line-height:.7;">
         <button class="btn bts" title="Move up" style="font-size:6px;padding:0 4px;"
                 onclick="wtgReorderSub('${sectionKey}','${actKey}',${idx},-1)">▲</button>
         <button class="btn bts" title="Move down" style="font-size:6px;padding:0 4px;"
                 onclick="wtgReorderSub('${sectionKey}','${actKey}',${idx},1)">▼</button>
       </span>`
    : '';
  return `<div class="wtg-sub">
    <div class="wtg-sub-head">
      <span style="font-size:10px;font-weight:600;color:var(--t1);flex:1;">${idx+1}. ${esc(s.n)} ${lockIcon}${subDelBtn}${subMoveBtns}</span>
      <select ${disAttr} onchange="wtgSaveSub('${t.id}','${path}','status',this.value)"
              style="background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:${statusColor};font-size:9px;font-weight:700;padding:2px 5px;${disStyle}">
        ${WTG_STATUS_VALUES.map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${WTG_STATUS_LABELS[v]}</option>`).join('')}
      </select>
    </div>

    <!-- Quantity tracking: Total / Completed / Today -->
    <div style="background:var(--card2);border:1px solid var(--b1);border-radius:5px;padding:6px 7px;margin-top:4px;">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;">
        <span style="font-size:8px;font-weight:700;color:var(--t3);text-transform:uppercase;letter-spacing:.4px;">Quantity Progress</span>
        <span style="margin-left:auto;font-family:var(--f2);font-size:11px;font-weight:800;color:${qtyCol};">
          ${dq} / ${tq}${s.unit?(' '+s.unit):''} · ${qtyPct}%
        </span>
      </div>
      <div style="height:5px;background:var(--b1);border-radius:3px;overflow:hidden;margin-bottom:6px;">
        <div style="width:${qtyPct}%;height:100%;background:${qtyCol};border-radius:3px;transition:width .5s;"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;">
        <label style="font-size:8px;color:var(--t3);">Total Qty
          <input type="number" min="0" step="any" value="${tq}" ${disAttr}
                 onchange="wtgSaveSub('${t.id}','${path}','totalQty',this.valueAsNumber)"
                 style="display:block;width:100%;margin-top:2px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);font-size:9px;padding:3px 4px;${disStyle}">
        </label>
        <label style="font-size:8px;color:var(--t3);">Completed Qty
          <input type="number" min="0" step="any" value="${dq}" ${disAttr}
                 onchange="wtgSaveSub('${t.id}','${path}','doneQty',this.valueAsNumber)"
                 style="display:block;width:100%;margin-top:2px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);font-size:9px;padding:3px 4px;${disStyle}">
        </label>
        <label style="font-size:8px;color:var(--t3);">Work Done Today
          <input type="number" min="0" step="any" value="${s.todayQty||0}" ${disAttr}
                 onchange="wtgSaveSub('${t.id}','${path}','todayQty',this.valueAsNumber)"
                 style="display:block;width:100%;margin-top:2px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);font-size:9px;padding:3px 4px;${disStyle}">
        </label>
        <label style="font-size:8px;color:var(--t3);">Unit
          <input type="text" value="${(s.unit||'').replace(/"/g,'&quot;')}" placeholder="m / nos / m³" ${disAttr}
                 onchange="wtgSaveSub('${t.id}','${path}','unit',this.value)"
                 style="display:block;width:100%;margin-top:2px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);font-size:9px;padding:3px 4px;${disStyle}">
        </label>
      </div>
    </div>

    <div class="wtg-sub-grid" style="margin-top:4px;">
      <label><span>Planned Start</span>
        <input type="date" value="${s.pStart||''}" ${disAttr}
               onchange="wtgSaveSub('${t.id}','${path}','pStart',this.value)"
               style="${disStyle}"></label>
      <label><span>Planned End</span>
        <input type="date" value="${s.pEnd||''}" ${disAttr}
               onchange="wtgSaveSub('${t.id}','${path}','pEnd',this.value)"
               style="${disStyle}"></label>
      <label><span>Actual Start</span>
        <input type="date" id="${did}_as" value="${s.aStart||''}" ${disAttr}
               onchange="wtgSaveSub('${t.id}','${path}','aStart',this.value)"
               style="${disStyle}"></label>
      <label><span>Actual End</span>
        <input type="date" id="${did}_ae" value="${s.aEnd||''}" min="${s.aStart||''}" ${disAttr}
               onchange="wtgSaveSub('${t.id}','${path}','aEnd',this.value)"
               style="${disStyle}"></label>
    </div>
    <div class="wtg-sub-grid wtg-sub-grid-2">
      <label><span>Responsible Person</span>
        <input type="text" value="${(s.responsible||'').replace(/"/g,'&quot;')}" placeholder="e.g. Engineer name"
               ${disAttr} onchange="wtgSaveSub('${t.id}','${path}','responsible',this.value)"
               style="${disStyle}"></label>
      <label><span>Delay Reason</span>
        <select ${disAttr} onchange="wtgSaveSub('${t.id}','${path}','delayReason',this.value)"
                style="${disStyle}">
          ${WTG_DELAY_REASONS.map(r=>`<option value="${r}" ${s.delayReason===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </label>
    </div>
    <label style="display:block;margin-top:4px;"><span style="font-size:8px;color:var(--t3);">Remarks</span>
      <textarea rows="1" placeholder="Add remarks…" ${disAttr}
                onchange="wtgSaveSub('${t.id}','${path}','remarks',this.value)"
                style="width:100%;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-size:9px;padding:3px 5px;resize:vertical;${disStyle}">${(s.remarks||'').replace(/</g,'&lt;')}</textarea>
    </label>
    <div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap;">
      <label style="font-size:8px;color:var(--t3);cursor:${ed?'pointer':'not-allowed'};padding:3px 6px;background:var(--card2);border-radius:4px;border:1px dashed var(--b1);">
        📷 ${s.photo?'Replace photo':'Upload photo'}
        <input type="file" accept="image/*" ${disAttr} style="display:none;"
               onchange="wtgUploadSubPhoto('${t.id}','${path}',this)">
      </label>
      ${photoBlock}
    </div>
  </div>`;
}

// ── Accordion toggles ────────────────────────────────────────────────────
function wtgToggleSection(sectionKey){
  if(_wtgOpenSection===sectionKey){
    _wtgOpenSection = null;
    _wtgOpenAct = null;
  } else {
    _wtgOpenSection = sectionKey;
    _wtgOpenAct = null;
  }
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

function wtgToggleAct(sectionKey, actKey){
  _wtgOpenSection = sectionKey;
  _wtgOpenAct = (_wtgOpenAct===actKey) ? null : actKey;
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

// ── Custom activity / sub UI handlers ─────────────────────────────────────
function wtgOpenAddActivity(sectionKey, turbId){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const host = document.getElementById('wtg-addact-form-'+sectionKey); if(!host) return;
  if(host.dataset.open === '1'){ host.innerHTML=''; host.dataset.open=''; return; }
  host.dataset.open = '1';
  const tid = turbId || _wtgSelected || '';
  host.innerHTML = `
    <div style="background:var(--card2);border:1px dashed var(--ac);border-radius:6px;padding:10px;margin:8px 0;">
      <div style="font-weight:700;font-size:10px;margin-bottom:6px;color:var(--ac);">+ New Activity</div>
      <label style="font-size:8px;color:var(--t3);display:block;">Activity Name
        <input id="wtg-newact-name-${sectionKey}" type="text" placeholder="e.g. Land Procurement"
          style="display:block;width:100%;margin-top:3px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;">
      </label>
      <label style="font-size:8px;color:var(--t3);display:block;margin-top:6px;">Sub-activities (comma-separated, optional)
        <input id="wtg-newact-subs-${sectionKey}" type="text" placeholder="e.g. Step 1, Step 2, Step 3"
          style="display:block;width:100%;margin-top:3px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;">
      </label>
      <div style="margin-top:8px;font-size:8px;color:var(--t3);">Apply to:</div>
      <div style="display:flex;gap:10px;margin-top:4px;">
        <label style="font-size:9px;color:var(--t1);display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="radio" name="wtg-actscope-${sectionKey}" value="one" checked>
          🎯 This turbine only${tid?(' ('+tid+')'):''}
        </label>
        <label style="font-size:9px;color:var(--t1);display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="radio" name="wtg-actscope-${sectionKey}" value="all">
          🌐 All turbines
        </label>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btwt bts" style="font-size:9px;padding:4px 10px;" onclick="wtgSubmitNewActivity('${sectionKey}','${tid}')">✓ Add Activity</button>
        <button class="btn bts" style="font-size:9px;padding:4px 10px;" onclick="document.getElementById('wtg-addact-form-${sectionKey}').innerHTML='';document.getElementById('wtg-addact-form-${sectionKey}').dataset.open=''">Cancel</button>
      </div>
    </div>`;
}

async function wtgSubmitNewActivity(sectionKey, turbId){
  const nameEl = document.getElementById('wtg-newact-name-'+sectionKey);
  const subsEl = document.getElementById('wtg-newact-subs-'+sectionKey);
  if(!nameEl) return;
  const name = (nameEl.value||'').trim();
  if(!name){ if(typeof showToast==='function') showToast('❌ Name required','er'); return; }
  const subs = (subsEl ? (subsEl.value||'') : '').split(',').map(s=>s.trim()).filter(Boolean);
  const scopeEl = document.querySelector('input[name="wtg-actscope-'+sectionKey+'"]:checked');
  const scope = scopeEl ? scopeEl.value : 'one';

  let newKey = null;
  if(scope === 'all'){
    if(typeof wtgAddCustomActivity !== 'function'){
      if(typeof showToast==='function') showToast('❌ Activity API unavailable','er'); return;
    }
    newKey = wtgAddCustomActivity(sectionKey, name, subs);
    if(!newKey){ if(typeof showToast==='function') showToast('❌ Failed to add','er'); return; }
    await _wtgPersistCustomActs();
    if(typeof showToast==='function') showToast('✅ Activity "'+name+'" added to ALL turbines','ok');
  } else {
    const t = DB.wtg.turbines.find(x=>x.id===(turbId||_wtgSelected));
    if(!t){ if(typeof showToast==='function') showToast('❌ No turbine selected','er'); return; }
    if(typeof wtgAddLocalActivity !== 'function'){
      if(typeof showToast==='function') showToast('❌ Activity API unavailable','er'); return;
    }
    newKey = wtgAddLocalActivity(t, sectionKey, name, subs);
    if(!newKey){ if(typeof showToast==='function') showToast('❌ Failed to add','er'); return; }
    await _wtgPersistTurbineLocal(t);
    if(typeof showToast==='function') showToast('✅ Activity "'+name+'" added to '+t.id+' only','ok');
  }
  _wtgOpenSection = sectionKey;
  _wtgOpenAct = newKey;
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

// Persist a turbine's per-turbine local activity data
async function _wtgPersistTurbineLocal(t){
  if(!t) return;
  try{
    if(typeof dataApi!=='undefined' && dataApi.updateTurbine){
      await dataApi.updateTurbine(t.id, {
        acts: t.acts||{},
        localActs: t.localActs||{},
        localExtraSubs: t.localExtraSubs||{}
      });
    }
  }catch(e){ console.warn('[wtg] persist turbine local failed', e); }
}

async function wtgRemoveAct(sectionKey, actKey){
  if(!_isWtgEditor()) return;
  const t = DB.wtg.turbines.find(x=>x.id===_wtgSelected);
  // Is this a turbine-local activity?
  const isLocal = !!(t && t.localActs && Array.isArray(t.localActs[sectionKey]) &&
                     t.localActs[sectionKey].some(a=>a.key===actKey));
  if(isLocal){
    if(!confirm('Delete this activity from '+t.id+' only?')) return;
    if(typeof wtgRemoveLocalActivity !== 'function') return;
    const ok = wtgRemoveLocalActivity(t, sectionKey, actKey);
    if(!ok){ if(typeof showToast==='function') showToast('❌ Failed to remove','er'); return; }
    await _wtgPersistTurbineLocal(t);
    if(typeof showToast==='function') showToast('🗑️ Activity removed from '+t.id,'ok');
  } else {
    if(!confirm('Delete this custom activity from ALL turbines? This will also delete its progress data.')) return;
    if(typeof wtgRemoveCustomActivity !== 'function') return;
    const ok = wtgRemoveCustomActivity(sectionKey, actKey);
    if(!ok){ if(typeof showToast==='function') showToast('🔒 Built-in activities cannot be removed','er'); return; }
    await _wtgPersistCustomActs();
    if(typeof showToast==='function') showToast('🗑️ Activity removed from all turbines','ok');
  }
  if(_wtgOpenAct === actKey) _wtgOpenAct = null;
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

// ── Reorder activities / sub-activities — authorized users only ──────────
async function wtgReorderActivity(sectionKey, actKey, dir){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 Only authorized WTG users can reorder activities','er');
    return;
  }
  if(typeof wtgMoveActivity !== 'function') return;
  const ok = wtgMoveActivity(sectionKey, actKey, dir);
  if(!ok) return;  // already at an edge
  await _wtgPersistCustomActs();
  if(typeof showToast==='function') showToast('↕ Activity reordered','ok');
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

async function wtgReorderSub(sectionKey, actKey, mergedIdx, dir){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 Only authorized WTG users can reorder sub-activities','er');
    return;
  }
  if(typeof wtgMoveSub !== 'function') return;
  const ok = wtgMoveSub(sectionKey, actKey, mergedIdx, dir);
  if(!ok) return;
  await _wtgPersistCustomActs();
  if(typeof showToast==='function') showToast('↕ Sub-activity reordered','ok');
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

function wtgOpenAddSub(sectionKey, actKey){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const host = document.getElementById('wtg-addsub-form-'+sectionKey+'-'+actKey); if(!host) return;
  if(host.dataset.open === '1'){ host.innerHTML=''; host.dataset.open=''; return; }
  host.dataset.open = '1';
  const tid = _wtgSelected || '';
  host.innerHTML = `
    <div style="background:var(--card2);border:1px dashed var(--ac);border-radius:6px;padding:8px;margin:6px 0;">
      <label style="font-size:8px;color:var(--t3);display:block;">New Sub-activity Name
        <input id="wtg-newsub-name-${sectionKey}-${actKey}" type="text" placeholder="e.g. Final inspection"
          style="display:block;width:100%;margin-top:3px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;">
      </label>
      <div style="margin-top:6px;font-size:8px;color:var(--t3);">Apply to:</div>
      <div style="display:flex;gap:10px;margin-top:3px;">
        <label style="font-size:9px;color:var(--t1);display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="radio" name="wtg-subscope-${sectionKey}-${actKey}" value="one" checked>
          🎯 This turbine only
        </label>
        <label style="font-size:9px;color:var(--t1);display:flex;align-items:center;gap:4px;cursor:pointer;">
          <input type="radio" name="wtg-subscope-${sectionKey}-${actKey}" value="all">
          🌐 All turbines
        </label>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn btwt bts" style="font-size:9px;padding:4px 10px;" onclick="wtgSubmitNewSub('${sectionKey}','${actKey}','${tid}')">✓ Add</button>
        <button class="btn bts" style="font-size:9px;padding:4px 10px;" onclick="document.getElementById('wtg-addsub-form-${sectionKey}-${actKey}').innerHTML='';document.getElementById('wtg-addsub-form-${sectionKey}-${actKey}').dataset.open=''">Cancel</button>
      </div>
    </div>`;
}

async function wtgSubmitNewSub(sectionKey, actKey, turbId){
  const el = document.getElementById('wtg-newsub-name-'+sectionKey+'-'+actKey);
  if(!el) return;
  const name = (el.value||'').trim();
  if(!name){ if(typeof showToast==='function') showToast('❌ Name required','er'); return; }
  const scopeEl = document.querySelector('input[name="wtg-subscope-'+sectionKey+'-'+actKey+'"]:checked');
  const scope = scopeEl ? scopeEl.value : 'one';

  if(scope === 'all'){
    if(typeof wtgAddCustomSub !== 'function') return;
    const ok = wtgAddCustomSub(sectionKey, actKey, name);
    if(!ok){ if(typeof showToast==='function') showToast('❌ Failed to add','er'); return; }
    await _wtgPersistCustomActs();
    if(typeof showToast==='function') showToast('✅ Sub-activity added to ALL turbines','ok');
  } else {
    const t = DB.wtg.turbines.find(x=>x.id===(turbId||_wtgSelected));
    if(!t){ if(typeof showToast==='function') showToast('❌ No turbine selected','er'); return; }
    if(typeof wtgAddLocalSub !== 'function') return;
    const ok = wtgAddLocalSub(t, sectionKey, actKey, name);
    if(!ok){ if(typeof showToast==='function') showToast('❌ Failed to add','er'); return; }
    await _wtgPersistTurbineLocal(t);
    if(typeof showToast==='function') showToast('✅ Sub-activity added to '+t.id+' only','ok');
  }
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

async function wtgRemoveSub(sectionKey, actKey, mergedIdx){
  if(!_isWtgEditor()) return;
  const t = DB.wtg.turbines.find(x=>x.id===_wtgSelected);
  // Determine whether this sub is turbine-local or global
  let isLocal = false;
  if(t){
    const acts = wtgGetActivities(sectionKey, t);
    const act = acts.find(a=>a.key===actKey);
    const meta = act && act.subsMeta[mergedIdx];
    isLocal = !!(meta && meta.isLocal);
  }
  if(isLocal){
    if(!confirm('Delete this sub-activity from '+t.id+' only?')) return;
    if(typeof wtgRemoveLocalSub !== 'function') return;
    const ok = wtgRemoveLocalSub(t, sectionKey, actKey, mergedIdx);
    if(!ok){ if(typeof showToast==='function') showToast('🔒 Cannot remove this sub-activity','er'); return; }
    await _wtgPersistTurbineLocal(t);
    if(typeof showToast==='function') showToast('🗑️ Sub-activity removed from '+t.id,'ok');
  } else {
    if(!confirm('Delete this custom sub-activity from ALL turbines?')) return;
    if(typeof wtgRemoveCustomSub !== 'function') return;
    const ok = wtgRemoveCustomSub(sectionKey, actKey, mergedIdx);
    if(!ok){ if(typeof showToast==='function') showToast('🔒 Default sub-activities cannot be removed','er'); return; }
    await _wtgPersistCustomActs();
    if(typeof showToast==='function') showToast('🗑️ Sub-activity removed from all turbines','ok');
  }
  if(_wtgSelected && _wtgSelected!=='ZP') selectTurbine(_wtgSelected);
}

// Persist DB.wtg.customActs + each turbine's regenerated acts tree to Firebase.
async function _wtgPersistCustomActs(){
  try {
    // Save custom-activity tree
    if(typeof dataApi !== 'undefined' && dataApi.setWtgCustomActs){
      await dataApi.setWtgCustomActs(DB.wtg.customActs);
    }
    // Save each turbine's acts (they were rebuilt by wtgInitActs)
    if(typeof dataApi !== 'undefined' && dataApi.updateTurbine){
      for(const t of (DB.wtg.turbines||[])){
        try { await dataApi.updateTurbine(t.id, { acts: t.acts }); } catch(e){}
      }
    }
  } catch(e){
    console.warn('[wtg] persist custom acts failed', e);
  }
}

// ── Save a sub-activity field, roll up, persist ──────────────────────────
// Per-turbine back-date: stores the chosen progress date for inline edits.
let _wtgProgDate = null;
function wtgSetProgDate(iso){
  _wtgProgDate = (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) ? iso : null;
  if(typeof dataApi!=='undefined' && dataApi.setProgressDate) dataApi.setProgressDate(_wtgProgDate);
  if(typeof showToast==='function'){
    const today=(typeof _progDateToday==='function')?_progDateToday():new Date().toISOString().slice(0,10);
    showToast(_wtgProgDate&&_wtgProgDate!==today ? '📅 Recording edits for '+_wtgProgDate : '📅 Recording edits for today','wn');
  }
}

async function wtgSaveSub(turbId, path, field, value){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  // Ensure the session progress date matches this panel's selector (back-dating)
  if(typeof dataApi!=='undefined' && dataApi.setProgressDate) dataApi.setProgressDate(_wtgProgDate);
  const t = DB.wtg.turbines.find(x=>x.id===turbId); if(!t) return;
  if(typeof wtgInitActs==='function') wtgInitActs(t);
  const [section, actKey, idxStr] = path.split('|');
  const idx = +idxStr;
  const sub = t.acts[section] && t.acts[section][actKey] && t.acts[section][actKey].subs[idx];
  if(!sub) return;

  // Date validation: actual end cannot be before actual start
  if(field==='aEnd' && value && sub.aStart && value < sub.aStart){
    if(typeof showToast==='function') showToast('❌ Actual End cannot be before Actual Start','er');
    if(CV==='wtg' && _wtgSelected===turbId) selectTurbine(turbId);  // revert UI
    return;
  }
  if(field==='aStart' && value && sub.aEnd && value > sub.aEnd){
    if(typeof showToast==='function') showToast('❌ Actual Start cannot be after Actual End','er');
    if(CV==='wtg' && _wtgSelected===turbId) selectTurbine(turbId);
    return;
  }

  // Numeric qty fields — guard NaN / negatives
  if(field==='totalQty' || field==='doneQty' || field==='todayQty'){
    let n = (typeof value==='number') ? value : parseFloat(value);
    if(!isFinite(n) || n<0) n = 0;
    sub[field] = n;
  } else {
    sub[field] = value;
  }

  // Auto-derive status from dates
  if(field==='aEnd' && value){ sub.status='done'; }
  else if(field==='aStart' && value && sub.status==='pending'){ sub.status='wip'; }

  // Auto-derive status from quantity
  if(field==='doneQty' || field==='totalQty'){
    const tot=sub.totalQty||0, dn=sub.doneQty||0;
    if(tot>0){
      if(dn>=tot) sub.status='done';
      else if(dn>0 && sub.status==='pending') sub.status='wip';
    }
  }

  // Roll up: leaf → activity → turbine legacy fields
  if(typeof wtgRollupToLegacy==='function') wtgRollupToLegacy(t);
  recalcTurbStatus(t);

  // Persist via dataApi
  try{
    if(typeof dataApi!=='undefined' && dataApi.updateTurbine){
      await dataApi.updateTurbine(t.id, {
        status: t.status,
        lp: !!t.lp, pp: !!t.pp,
        civil: t.civil||[], mech: t.mech||[],
        uss: t.uss||0, sup: t.sup||0,
        notes: t.notes||'',
        acts: t.acts||{},
        mechDates: t.dates||{}
      });
    }
    if(typeof dataApi!=='undefined' && dataApi.pushDailyProgress){
      dataApi.pushDailyProgress({
        module:'WTG', turbine:t.id,
        act: `${WTG_STRUCTURE[section].label} / ${actKey} / ${sub.n} (${field})`,
        val: (sub.status==='done')?1:0,
        pct: calcTurbProg(t)
      }).catch(()=>{});
    }
    if(typeof showToast==='function') showToast('✅ '+t.id+' updated','ok');
  } catch(err){
    if(typeof showToast==='function') showToast('❌ '+(err.message||'Save failed'),'er');
  }

  // NOTE: we deliberately do NOT call rndrWtg() here. The Firebase write above
  // triggers the realtime listener → state-bridge mirror → a single debounced
  // re-render of the current view. Calling rndrWtg() locally as well caused the
  // heavy 26-turbine view to be rebuilt twice per keystroke, which froze the
  // UI for a second or two and blocked further edits. The bridge render keeps
  // the screen in sync within ~1s without the double work.
  // For instant local feedback we refresh ONLY the selected turbine's detail
  // panel (cheap) rather than the whole view.
  if(CV==='wtg' && _wtgSelected===turbId && typeof selectTurbine==='function'){
    requestAnimationFrame(() => { try { selectTurbine(turbId); } catch(e){} });
  }
  if(typeof updateOverallBars==='function') updateOverallBars();
}

// ── Photo upload for a sub-activity ──────────────────────────────────────
function wtgUploadSubPhoto(turbId, path, inputEl){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const file = inputEl.files && inputEl.files[0]; if(!file) return;
  // Instant Firebase Storage upload — only the downloadURL is stored in
  // the database (never base64), and it appears on all devices live.
  if(typeof showToast==='function') showToast('⏫ Uploading photo…','ok');
  (async () => {
    try{
      const { url } = await storage.uploadSubPhoto('wtg', turbId, file);
      await wtgSaveSub(turbId, path, 'photo', url);
      if(typeof showToast==='function') showToast('✅ Photo uploaded & synced','ok');
    }catch(err){
      if(typeof showToast==='function') showToast('❌ '+(err.message||'Upload failed'),'er');
    }
  })();
}

// ═══════════════════════════════════════════════════════════
//  RIGHT-SIDE DETAIL PANEL — Zero Point (Store Yard)
// ═══════════════════════════════════════════════════════════
// ── ZERO POINT (Store Yard) ─────────────────────────────────
// ═══════════════════════════════════════════════════════════
// Standalone "Zero Point" top-level view (nav('zp'))
function rndrZp(){
  selectZeroPoint('zp-body');
}

function selectZeroPoint(containerId){
  _wtgSelected = 'ZP';
  if(typeof zeroPointInit==='function') zeroPointInit();
  const zp = DB.wtg.zeroPoint;
  // Zero Point renders only into its dedicated view body. Default to 'zp-body';
  // a caller may pass an explicit container, but it is never the WTG panel.
  const target = containerId || 'zp-body';
  const rp = document.getElementById(target); if(!rp) return;
  const ed = _isWtgEditor();

  // ── Aggregate stats ──
  const nTurb = (DB.wtg.turbines||[]).length;
  const totalReceived = zp.materials.filter(m => (m.receivedQty||0)>0).length;

  rp.innerHTML = `
    <div class="wtg-detail-header">
      <div class="wtg-detail-icon" style="font-size:40px;line-height:1;display:flex;align-items:center;justify-content:center;width:48px;height:48px;">🏬</div>
      <div class="wtg-detail-info">
        <div class="wtg-detail-title" style="color:var(--wtg);">Zero Point — Store Yard</div>
        <div style="font-size:9px;color:var(--t3);margin-top:4px;">Central material warehouse for ${nTurb} turbines</div>
        <div style="font-size:9px;color:var(--t3);margin-top:3px;">
          ${totalReceived}/${zp.materials.length} material types started · ${(zp.mobilizations||[]).length} mobilizations logged
        </div>
      </div>
    </div>

    ${_rndrZpMatGroup('WTG Materials', '⚡', 'var(--wtg)', zp.materials, 'wtg', ed)}

    <div class="wtg-section" style="margin-top:10px;">
      <div class="wtg-section-head" style="cursor:default;">
        <span style="font-size:14px;">🚚</span>
        <span style="font-weight:700;font-size:11px;color:var(--ac);">Mobilization (Source → Destination)</span>
        ${ed?`<button class="btn btwt bts" style="margin-left:auto;font-size:9px;padding:3px 8px;" onclick="zpOpenMobForm()">+ New Mobilization</button>`:''}
      </div>
      <div class="wtg-section-body">
        <div id="zp-mob-form-host"></div>
        ${_rndrZpMobTable(zp.mobilizations||[], ed)}
      </div>
    </div>
  `;
}

function _rndrZpMatGroup(title, icon, color, allMats, moduleKey, ed){
  const mats = allMats
    .map((m,i)=>({m,i}))
    .filter(({m}) => m.module === moduleKey);
  if(mats.length === 0) return '';

  // Each material is a collapsible group: header → expand to see all units
  const matBlocks = mats.map(({m, i}) => {
    const inStore = zpInStore(m);
    const total = m.totalQty || 0;
    const isOpen = _wtgZpOpenMat === i;
    const isStock = inStore > 0;
    const stockCol = isStock ? 'var(--ok)' : 'var(--er)';

    return `
      <div style="background:var(--card2);border:1px solid var(--b1);border-radius:6px;margin-bottom:6px;overflow:hidden;">
        <div onclick="zpToggleMat(${i})"
             style="display:flex;align-items:center;gap:8px;padding:8px 10px;cursor:pointer;${isOpen?'background:rgba(255,255,255,.03);':''}">
          <span style="font-size:9px;color:${color};">${icon}</span>
          <span style="font-size:10px;font-weight:700;color:var(--t1);flex:1;">${esc(m.name)}</span>
          <span style="font-size:9px;background:var(--card);color:${stockCol};border:1px solid var(--b1);padding:2px 7px;border-radius:10px;font-weight:700;">
            🏬 In Store: ${inStore} / Total: ${total}
          </span>
          <span style="font-size:10px;color:var(--t3);">${isOpen?'▼':'▶'}</span>
        </div>
        ${isOpen ? _rndrZpUnitTable(m, i, ed, color) : ''}
      </div>
    `;
  }).join('');

  return `
    <div class="wtg-section" style="margin-top:10px;">
      <div class="wtg-section-head" style="cursor:default;">
        <span style="font-size:14px;">${icon}</span>
        <span style="font-weight:700;font-size:11px;color:${color};">${title}</span>
        <span style="margin-left:auto;font-size:9px;color:var(--t3);">${mats.length} item${mats.length===1?'':'s'}</span>
      </div>
      <div class="wtg-section-body">${matBlocks}</div>
    </div>`;
}

function _rndrZpUnitTable(m, matIdx, ed, color){
  const disAttr = ed?'':'disabled';
  const disStyle = ed?'':'opacity:.55;cursor:not-allowed;';
  const turbOpts = ['<option value="Unassigned">Unassigned</option>']
    .concat((DB.wtg.turbines||[]).map(t => `<option value="${t.id}">${t.id}</option>`)).join('');

  const rows = (m.units||[]).map((u, ui) => {
    const stagePct = zpUnitStagePct(u);
    const stagesDone = ZP_MATERIAL_STAGES.filter(s => u.stages && u.stages[s] && u.stages[s].done).length;
    const isUnitOpen = (_wtgZpOpenMat === matIdx && _wtgZpOpenUnit === ui);
    const assignSelected = u.assignedSite || 'Unassigned';
    const opts = turbOpts.replace(`value="${assignSelected}"`, `value="${assignSelected}" selected`);
    return `
      <tr>
        <td style="font-size:9px;font-weight:600;color:${color};white-space:nowrap;">Unit #${u.unitNo}</td>
        <td><input type="date" value="${u.deliveryDate||''}" ${disAttr}
              onchange="zpSaveUnit(${matIdx},${ui},'deliveryDate',this.value)"
              style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;${disStyle}"></td>
        <td><select ${disAttr} onchange="zpSaveUnit(${matIdx},${ui},'mddcStatus',this.value)"
              style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;${disStyle}">
              ${ZP_MDDC_STATUSES.map(s=>`<option value="${s}" ${u.mddcStatus===s?'selected':''}>${s}</option>`).join('')}
            </select></td>
        <td><input type="text" value="${(u.storageLocation||'').replace(/"/g,'&quot;')}" ${disAttr}
              onchange="zpSaveUnit(${matIdx},${ui},'storageLocation',this.value)"
              style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;width:110px;${disStyle}"></td>
        <td><select ${disAttr} onchange="zpSaveUnit(${matIdx},${ui},'assignedSite',this.value)"
              style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;${disStyle}">
              ${opts}
            </select></td>
        <td style="font-size:9px;min-width:96px;">
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="flex:1;background:var(--b1);height:6px;border-radius:3px;overflow:hidden;">
              <div style="background:${color};height:100%;width:${stagePct}%;"></div>
            </div>
            <span style="font-size:8px;color:var(--t3);">${stagesDone}/${ZP_MATERIAL_STAGES.length}</span>
          </div>
          <button class="btn bts" onclick="zpToggleUnitStages(${matIdx},${ui})" style="font-size:8px;padding:1px 6px;margin-top:2px;">${isUnitOpen?'Stages ▼':'Stages ▶'}</button>
        </td>
      </tr>
      ${isUnitOpen ? `<tr><td colspan="6" style="padding:8px;background:var(--card2);">
        ${_rndrZpStages(u, matIdx, ui, ed, color)}
      </td></tr>` : ''}
    `;
  }).join('');

  return `<div style="padding:6px;background:var(--card);">
    <div class="tsc"><table class="tbl">
      <thead><tr>
        <th>Unit</th><th>Delivery Date</th><th>MDDC</th>
        <th>Storage</th><th>Assigned Site</th><th>Sub-stages</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
  </div>`;
}

function _rndrZpStages(unit, matIdx, unitIdx, ed, color){
  const disAttr = ed?'':'disabled';
  return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:6px;">
    ${ZP_MATERIAL_STAGES.map(stage => {
      const s = unit.stages[stage] || {done:false,date:'',remarks:''};
      return `<div style="background:var(--card);border:1px solid var(--b1);border-radius:4px;padding:6px;">
        <label style="display:flex;align-items:center;gap:5px;font-size:9px;font-weight:600;cursor:pointer;">
          <input type="checkbox" ${s.done?'checked':''} ${disAttr}
            onchange="zpSaveUnitStage(${matIdx},${unitIdx},'${stage}','done',this.checked)">
          <span style="color:${color};">${ZP_MATERIAL_STAGE_LABELS[stage]}</span>
        </label>
        <input type="date" value="${s.date||''}" ${disAttr}
          onchange="zpSaveUnitStage(${matIdx},${unitIdx},'${stage}','date',this.value)"
          style="width:100%;margin-top:4px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:8px;">
        <input type="text" placeholder="Remarks" value="${(s.remarks||'').replace(/"/g,'&quot;')}" ${disAttr}
          onchange="zpSaveUnitStage(${matIdx},${unitIdx},'${stage}','remarks',this.value)"
          style="width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:8px;">
      </div>`;
    }).join('')}
  </div>`;
}

function _rndrZpMobTable(mobs, ed){
  if(!mobs.length) return `<div style="font-size:9px;color:var(--t3);padding:8px;text-align:center;">No mobilizations logged yet</div>`;
  const rows = mobs.map((mob,i)=>`<tr>
      <td style="font-size:9px;">${mob.material||''}</td>
      <td style="font-size:9px;">${mob.source||'Zero Point'}</td>
      <td style="font-size:9px;font-weight:600;color:var(--wtg);">⚡ ${mob.destination||''}</td>
      <td style="font-size:9px;">${mob.qty||1}</td>
      <td style="font-size:9px;">${mob.date||''}</td>
      <td><select ${ed?'':'disabled'} onchange="zpSaveMob(${i},'status',this.value)"
          style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;">
          ${['planned','in_transit','delivered','returned'].map(s=>`<option value="${s}" ${mob.status===s?'selected':''}>${s}</option>`).join('')}
        </select></td>
      <td>${ed?`<button class="btn bts" onclick="zpDeleteMob(${i})" style="font-size:8px;padding:2px 6px;">✕</button>`:''}</td>
    </tr>`).join('');
  return `<div class="tsc"><table class="tbl">
    <thead><tr>
      <th>Material</th><th>Source</th><th>Destination</th>
      <th>Qty</th><th>Date</th><th>Status</th><th></th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

// ── ZP UI state (module-local) ───────────────────────────────────────────
// _wtgZpOpenMat / _wtgZpOpenUnit are declared at the top of the file.

function zpToggleMat(idx){
  _wtgZpOpenMat = (_wtgZpOpenMat === idx) ? null : idx;
  _wtgZpOpenUnit = null;
  if(CV==='zp') selectZeroPoint('zp-body');
}

function zpToggleUnitStages(matIdx, unitIdx){
  if(_wtgZpOpenMat !== matIdx){
    _wtgZpOpenMat = matIdx;
    _wtgZpOpenUnit = unitIdx;
  } else {
    _wtgZpOpenUnit = (_wtgZpOpenUnit === unitIdx) ? null : unitIdx;
  }
  if(CV==='zp') selectZeroPoint('zp-body');
}

async function zpSaveUnit(matIdx, unitIdx, field, value){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  if(typeof zeroPointInit==='function') zeroPointInit();
  const m = DB.wtg.zeroPoint.materials[matIdx]; if(!m) return;
  const u = (m.units||[])[unitIdx]; if(!u) return;
  u[field] = value;
  await zpPersist();
  if(typeof showToast==='function') showToast('✅ '+m.name+' #'+u.unitNo+' updated','ok');
  if(CV==='zp') selectZeroPoint('zp-body');
}

async function zpSaveUnitStage(matIdx, unitIdx, stage, field, value){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  if(typeof zeroPointInit==='function') zeroPointInit();
  const m = DB.wtg.zeroPoint.materials[matIdx]; if(!m) return;
  const u = (m.units||[])[unitIdx]; if(!u) return;
  if(!u.stages) u.stages = {};
  if(!u.stages[stage]) u.stages[stage] = {done:false, date:'', remarks:''};
  u.stages[stage][field] = value;
  // Auto-set date when marking done
  if(field==='done' && value && !u.stages[stage].date){
    u.stages[stage].date = new Date().toISOString().slice(0,10);
  }
  await zpPersist();
  if(CV==='zp') selectZeroPoint('zp-body');
}

function zpOpenMobForm(){
  if(!_isWtgEditor()) return;
  const host = document.getElementById('zp-mob-form-host'); if(!host) return;
  if(typeof zeroPointInit==='function') zeroPointInit();
  const zp = DB.wtg.zeroPoint;
  const today = new Date().toISOString().slice(0,10);
  const matOpts = zp.materials.map(m => {
    const inStore = zpInStore(m);
    const disabled = inStore <= 0 ? 'disabled' : '';
    return `<option value="${esc(m.name)}" ${disabled}>${esc(m.name)} (${inStore} in store)</option>`;
  }).join('');
  host.innerHTML = `
    <div style="background:var(--card2);border:1px solid var(--b1);border-radius:6px;padding:10px;margin-bottom:10px;">
      <div style="font-weight:700;font-size:10px;margin-bottom:6px;color:var(--ac);">New Mobilization</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;">
        <div>
          <label style="font-size:8px;color:var(--t3);display:block;">Material</label>
          <select id="zpf-mat"
            style="width:100%;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:3px 4px;font-size:9px;">
            ${matOpts}
          </select>
        </div>
        <div>
          <label style="font-size:8px;color:var(--t3);display:block;">Destination Turbine</label>
          <select id="zpf-dest"
            style="width:100%;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:3px 4px;font-size:9px;">
            ${(DB.wtg.turbines||[]).map(t=>`<option value="${t.id}">${t.id}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:8px;color:var(--t3);display:block;">Quantity</label>
          <input id="zpf-qty" type="number" min="1" value="1"
            style="width:100%;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:3px 4px;font-size:9px;">
        </div>
        <div>
          <label style="font-size:8px;color:var(--t3);display:block;">Date</label>
          <input id="zpf-date" type="date" value="${today}"
            style="width:100%;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:3px 4px;font-size:9px;">
        </div>
      </div>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btwt bts" style="font-size:9px;padding:4px 10px;" onclick="zpSubmitMob()">✓ Add</button>
        <button class="btn bts" style="font-size:9px;padding:4px 10px;" onclick="document.getElementById('zp-mob-form-host').innerHTML=''">Cancel</button>
      </div>
    </div>`;
}

async function zpSubmitMob(){
  if(!_isWtgEditor()) return;
  if(typeof zeroPointInit==='function') zeroPointInit();
  const material = document.getElementById('zpf-mat').value;
  const destination = document.getElementById('zpf-dest').value;
  const qty = Math.max(1, parseInt(document.getElementById('zpf-qty').value)||1);
  const date = document.getElementById('zpf-date').value || new Date().toISOString().slice(0,10);
  if(!material || !destination) return;

  // ── Stock check ──
  const m = DB.wtg.zeroPoint.materials.find(x => x.name === material);
  const inStore = m ? zpInStore(m) : 0;
  if(qty > inStore){
    if(typeof showToast==='function') showToast('❌ Not enough stock at Zero Point — only '+inStore+' available','er');
    return;
  }

  DB.wtg.zeroPoint.mobilizations.push({
    id: 'mob-'+Date.now(),
    material, source:'Zero Point', destination,
    destType:'wtg', qty, date, status:'planned'
  });
  await zpPersist();
  if(typeof showToast==='function') showToast('🚚 Mobilization added','ok');
  if(CV==='zp') selectZeroPoint('zp-body');
}

async function zpSaveMob(idx, field, value){
  if(!_isWtgEditor()) return;
  const mob = DB.wtg.zeroPoint.mobilizations[idx]; if(!mob) return;
  mob[field] = value;
  await zpPersist();
  if(CV==='zp') selectZeroPoint('zp-body');
}

async function zpDeleteMob(idx){
  if(!_isWtgEditor()) return;
  if(!confirm('Delete this mobilization?')) return;
  DB.wtg.zeroPoint.mobilizations.splice(idx,1);
  await zpPersist();
  if(typeof showToast==='function') showToast('Deleted','ok');
  if(CV==='zp') selectZeroPoint('zp-body');
}

async function zpPersist(){
  try{
    if(typeof dataApi!=='undefined' && typeof dataApi.setZeroPoint === 'function'){
      await dataApi.setZeroPoint(DB.wtg.zeroPoint);
    }
  }catch(e){ /* local-only fallback is fine */ }
}

// ═══════════════════════════════════════════════════════════
//  LEGACY TABS — kept as quick tabular views
// ═══════════════════════════════════════════════════════════
function wTab(t){
  curWT = 0;  // Only Overview tab exists now
  const rp = document.getElementById('wtg-right-panel'); if(!rp) return;
  // Zero Point now lives ONLY in its dedicated view (nav('zp')); it is never
  // rendered into the WTG right panel. If a stale 'ZP' selection lingers,
  // treat it as "no turbine selected" here.
  if(_wtgSelected === 'ZP') _wtgSelected = null;
  if(_wtgSelected) selectTurbine(_wtgSelected);
  else rp.innerHTML = rndrRightPanelEmpty();
}

function rndrTurbs(){return '';}

// ── Role / edit-permission helpers ───────────────────────────────────────
function _isWtgEditor(){
  return (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit('wtg'));
}

function recalcTurbStatus(t){
  if(!t) return;
  if(t.status==='row') return;
  const cArr=t.civil||[], mArr=t.mech||[];
  if(cArr.length===0) return;
  const cAvg=cArr.reduce((s,v)=>s+(v||0),0)/cArr.length;
  const mAvg=mArr.length?mArr.reduce((s,v)=>s+(v||0),0)/mArr.length:0;
  const allCivilDone=cArr.every(v=>(v||0)>=100);
  const allMechDone =mArr.length>0 && mArr.every(v=>(v||0)>=100);
  if(allCivilDone && allMechDone) t.status='ready';
  else if(allCivilDone)            t.status='casting';
  else if(cAvg>0 || mAvg>0)        t.status='wip';
  else                             t.status='pending';
}

async function saveTurbDate(id,key,val){
  if(!_isWtgEditor()){
    if(typeof showToast==='function')showToast('🔒 WTG Manager login required to edit dates','er');
    if(typeof rndrWtg==='function' && CV==='wtg'){rndrWtg();wTab(curWT);}
    return;
  }
  const t=DB.wtg.turbines.find(x=>x.id===id); if(!t) return;
  if(!t.dates) t.dates={};
  t.dates[key]=val;
  if(val){
    const m1=key.match(/^civ_(\d+)_done$/);
    const m2=key.match(/^mec_(\d+)_done$/);
    if(m1){const i=+m1[1]; if(t.civil[i]<100)t.civil[i]=100;}
    if(m2){const i=+m2[1]; if(t.mech[i]<100) t.mech[i]=100;}
    if(key==='lp_done') t.lp=true;
    if(key==='pp_done') t.pp=true;
  }
  recalcTurbStatus(t);
  try {
    await dataApi.updateTurbine(t.id, {
      status: t.status, lp:!!t.lp, pp:!!t.pp,
      civil:t.civil||[], mech:t.mech||[],
      uss:t.uss||0, sup:t.sup||0, notes:t.notes||'',
      mechDates: t.dates||{}
    });
    if(typeof dataApi.pushDailyProgress === 'function') {
      dataApi.pushDailyProgress({
        module:'WTG', turbine:t.id,
        act:key.replace(/_/g,' '), val:val?1:0,
        pct: calcTurbProg(t)
      }).catch(()=>{});
    }
    if(typeof showToast==='function') showToast('✅ '+t.id+' updated','ok');
  } catch (err){
    if(typeof showToast==='function') showToast('❌ '+(err.message||'Save failed'),'er');
  }
  if(CV==='wtg'){rndrWtg(); wTab(curWT);}
  if(typeof updateOverallBars==='function') updateOverallBars();
}

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
        <td style="font-size:9px;">${esc(a.n)}</td>
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
    {key:'xfmr33', label:'33kV Transformer',    u:1},
    {key:'conv',   label:'Converter Panel',     u:1},
  ];
  return`${_wtgEditBanner()}<div class="pnl"><div class="ph2"><div class="pt">Supply Chain — Component Arrival Dates</div></div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Turbine</th><th>Component</th><th>Qty</th><th>Expected Arrival</th><th>Actual Arrival</th><th>Status</th></tr></thead>
      <tbody>${DB.wtg.turbines.map(t=>{if(!t.dates)t.dates={};const di=`style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t2);padding:2px 4px;font-size:8px;width:90px;${lockStyle}"`;
      return comps.map(c=>`<tr>
        <td style="font-size:9px;font-weight:600;">${t.id}</td>
        <td style="font-size:9px;">${esc(c.label)}</td>
        <td style="text-align:center;font-size:9px;">${c.u}</td>
        <td><input type="date" value="${t.dates[c.key+'_exp']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','${c.key}_exp',this.value)"></td>
        <td><input type="date" value="${t.dates[c.key+'_arr']||''}" ${di} ${lockAttr} onchange="saveTurbDate('${t.id}','${c.key}_arr',this.value)"></td>
        <td>${t.dates[c.key+'_arr']?'<span class="chip cg">Arrived</span>':'<span class="chip cr">Awaited</span>'}</td>
      </tr>`).join('');}).join('')}</tbody>
    </table></div></div>`;
}

function rndrSchedTab(){ return ''; }

function showTurb(id){ selectTurbine(id); } // legacy stub

// ═══════════════════════════════════════════════════════════

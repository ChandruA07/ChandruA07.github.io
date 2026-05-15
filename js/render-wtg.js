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
// curWT is declared globally in nav.js — do NOT redeclare here.

function rndrWtg(){
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

  // ── Header KPI roll-ups (all derived from leaf data, real-time) ─────────
  // Casting: pre.casting done OR legacy civ[4]>=100
  const castingCount = turbines.filter(t=>{
    const p = (typeof wtgActPct==='function') ? wtgActPct(t,'pre','casting') : 0;
    return p>=100 || (Array.isArray(t.civil)&&(t.civil[4]||0)>=100);
  }).length;

  const lpCount = turbines.filter(t=>t.lp).length;
  const ppCount = turbines.filter(t=>t.pp).length;

  // Ready for Erection: full pre-erection done OR foundation 100% (legacy)
  const readyCount = turbines.filter(t=>{
    if(typeof wtgSectionPct==='function' && wtgSectionPct(t,'pre')>=100) return true;
    return Array.isArray(t.civil)&&t.civil.every(v=>(v||0)>=100)&&(t.status!=='row');
  }).length;

  // Erection Done: full erection section OR mech all 100%
  const erectionDoneCount = turbines.filter(t=>{
    if(typeof wtgSectionPct==='function' && wtgSectionPct(t,'erection')>=100) return true;
    return Array.isArray(t.mech)&&t.mech.length>=1&&t.mech.every(v=>(v||0)>=100);
  }).length;

  // USS Complete
  const ussCompleteCount = turbines.filter(t=>{
    if(typeof wtgActPct==='function'){
      const a = wtgActPct(t,'post','ussCivil');
      const b = wtgActPct(t,'post','ussEquip');
      if(a>=100 && b>=100) return true;
    }
    return (t.uss||0)>=100;
  }).length;

  // Commissioned
  const commissionedCount = turbines.filter(t=>{
    if(typeof wtgActPct==='function'){
      if(wtgActPct(t,'post','commiss')>=100 &&
         wtgSectionPct(t,'erection')>=100 &&
         wtgSectionPct(t,'pre')>=100) return true;
    }
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
  document.getElementById('wtg-kr').innerHTML = `
    <div class="kpi" data-tt="Overall WTG construction across all ${total} turbines (live)">
      <div class="kb" style="background:var(--wtg)"></div>
      <div class="kl">Overall %</div>
      <div class="kv" style="color:var(--wtg)">${wtgPct}%</div></div>
    <div class="kpi" data-tt="Foundation casting completed">
      <div class="kb" style="background:var(--ac)"></div>
      <div class="kl">Casting</div>
      <div class="kv" style="color:var(--ac)">${castingCount}/${total}</div></div>
    <div class="kpi" data-tt="Logistic pathway cleared for heavy transport">
      <div class="kb" style="background:var(--sol)"></div>
      <div class="kl">Logistic Pathway</div>
      <div class="kv" style="color:var(--sol)">${lpCount}/${total}</div></div>
    <div class="kpi" data-tt="Permanent pathway constructed">
      <div class="kb" style="background:var(--land)"></div>
      <div class="kl">Permanent Pathway</div>
      <div class="kv" style="color:var(--land)">${ppCount}/${total}</div></div>
    <div class="kpi" data-tt="Ready for mechanical erection (pre-erection done)">
      <div class="kb" style="background:var(--wn)"></div>
      <div class="kl">Ready for Erection</div>
      <div class="kv" style="color:var(--wn)">${readyCount}/${total}</div></div>
    <div class="kpi" data-tt="Tower + Nacelle + Hub + Blade + Rotor erection done">
      <div class="kb" style="background:var(--er)"></div>
      <div class="kl">Erection Done</div>
      <div class="kv" style="color:var(--er)">${erectionDoneCount}/${total}</div></div>
    <div class="kpi" data-tt="USS Civil + USS Equipment both complete">
      <div class="kb" style="background:var(--ok)"></div>
      <div class="kl">USS Complete</div>
      <div class="kv" style="color:var(--ok)">${ussCompleteCount}/${total}</div></div>
    <div class="kpi" data-tt="Trial run + sync + load test + final approval">
      <div class="kb" style="background:var(--ok)"></div>
      <div class="kl">Commissioned</div>
      <div class="kv" style="color:var(--ok)">${commissionedCount}/${total}</div></div>`;

  // ── Split layout: left grid + Zero Point, right detail panel ───────────
  const tcEl = document.getElementById('wtg-tc'); if(!tcEl) return;
  tcEl.innerHTML = `<div class="wtg-split">
    <div class="wtg-left-panel">
      <div style="font-family:var(--f2);font-size:11px;font-weight:600;margin-bottom:8px;color:var(--wtg);display:flex;align-items:center;gap:6px;">
        ${_turbImg(20,'var(--wtg)')} All ${total} Turbines + Store Yard
      </div>
      <div class="turbg" id="wtg-turb-grid">${rndrTurbGrid()}</div>
      <div style="margin-top:10px;">${rndrZeroPointTile()}</div>
    </div>
    <div class="wtg-right-panel" id="wtg-right-panel">
      ${rndrRightPanelEmpty()}
    </div>
  </div>`;

  // Restore previous selection across re-renders
  if(_wtgSelected){
    if(_wtgSelected==='ZP') selectZeroPoint();
    else selectTurbine(_wtgSelected);
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
function rndrTurbGrid(){
  const cm={ready:'var(--ok)',casting:'var(--ac)',wip:'var(--wn)',row:'var(--er)',pending:'var(--t4)',delayed:'var(--bop)'};
  const statusLabel={ready:'READY',casting:'CASTING',wip:'WIP',row:'ROW HOLD',pending:'PENDING',delayed:'DELAYED'};
  return DB.wtg.turbines.map(t=>{
    const p=calcTurbProg(t); const sc=cm[t.status]||'var(--t4)';
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

// ── Zero Point (Store Yard) tile ─────────────────────────────────────────
function rndrZeroPointTile(){
  const zp = DB.wtg.zeroPoint || {materials:[]};
  const matCount = (zp.materials||[]).length;
  const arrived = (zp.materials||[]).filter(m=>m.deliveryDate).length;
  return `<div class="turb st-zp" id="tcard-ZP" onclick="selectZeroPoint()"
    style="background:linear-gradient(135deg,rgba(124,77,255,.10),rgba(101,31,255,.04));border:1px solid rgba(124,77,255,.4);padding:10px;text-align:left;">
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
  document.querySelectorAll('.turb').forEach(el=>el.style.outline='none');
  const card=document.getElementById('tcard-'+id);
  if(card) card.style.outline='2.5px solid var(--wtg)';
  const t = DB.wtg.turbines.find(x=>x.id===id); if(!t) return;
  if(typeof wtgInitActs==='function') wtgInitActs(t);

  const p = calcTurbProg(t);
  const sectPct = wtgTurbActsPct(t);
  const rp = document.getElementById('wtg-right-panel'); if(!rp) return;
  const sc = {ready:'var(--ok)',casting:'var(--ac)',wip:'var(--wn)',row:'var(--er)',pending:'var(--t4)'}[t.status]||'var(--t4)';
  const statusMap={ready:'READY FOR ERECTION',casting:'CASTING/CURING',wip:'WORK IN PROGRESS',row:'ROW HOLD',pending:'NOT STARTED',delayed:'DELAYED'};

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
          <span class="chip ${t.status==='ready'?'cg':t.status==='wip'?'cy':'cr'}" style="font-size:9px;padding:2px 9px;">${statusMap[t.status]||t.status.toUpperCase()}</span>
          <span style="font-size:9px;color:var(--t3);margin-left:6px;">Target: <b style="color:var(--wn);">${getTargetDate(id)}</b></span>
        </div>
        <div style="font-size:9px;color:var(--t3);margin-top:4px;">Overall <b style="color:${sc};">${p}%</b> · LP ${t.lp?'✅':'⏳'} · PP ${t.pp?'✅':'⏳'}</div>
      </div>
    </div>

    <div style="height:6px;background:var(--b1);border-radius:4px;margin:8px 0 12px;overflow:hidden;">
      <div style="width:${p}%;height:100%;background:${sc};border-radius:4px;transition:width .8s;"></div>
    </div>

    <!-- Section accordion: Pre-Erection / Erection / Post-Erection -->
    ${rndrSectionAccordion(t,'pre',sectPct.pre)}
    ${rndrSectionAccordion(t,'erection',sectPct.erection)}
    ${rndrSectionAccordion(t,'post',sectPct.post)}

    ${t.notes?`<div style="font-size:9px;color:var(--t3);margin:10px 0 0;padding:8px;background:var(--card2);border-radius:6px;border-left:3px solid var(--wn);">📝 ${t.notes}</div>`:''}
  `;
}

// ── Accordion section (Pre/Erection/Post) ────────────────────────────────
function rndrSectionAccordion(t, sectionKey, pct){
  const def = WTG_STRUCTURE[sectionKey];
  const open = (_wtgOpenSection === sectionKey);
  const headerCol = pct>=100?'var(--ok)':pct>0?def.color:'var(--t4)';
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
      ${def.activities.map(a=>rndrActivityRow(t, sectionKey, a)).join('')}
    </div>`:''}
  </div>`;
}

// ── Activity row (collapsed/expanded with sub-activities) ────────────────
function rndrActivityRow(t, sectionKey, actDef){
  const pct = wtgActPct(t, sectionKey, actDef.key);
  const isOpen = (_wtgOpenSection===sectionKey && _wtgOpenAct===actDef.key);
  const col = pct>=100?'var(--ok)':pct>0?'var(--wn)':'var(--t4)';
  const dynBadge = actDef.dynamic?'<span style="font-size:7px;background:var(--er);color:#fff;padding:1px 5px;border-radius:8px;margin-left:5px;">DYNAMIC</span>':'';
  return `<div class="wtg-act">
    <div class="wtg-act-head" onclick="wtgToggleAct('${sectionKey}','${actDef.key}')">
      <span style="flex:1;font-size:10px;font-weight:600;color:var(--t1);">${actDef.n}${dynBadge}</span>
      <div class="wtg-act-bar"><div class="wtg-act-bar-fill" style="width:${pct}%;background:${col};"></div></div>
      <span style="font-size:9px;font-weight:700;color:${col};min-width:32px;text-align:right;">${pct}%</span>
      <span style="font-size:9px;color:var(--t3);margin-left:4px;">${isOpen?'▼':'▶'}</span>
    </div>
    ${isOpen?`<div class="wtg-act-body">
      ${actDef.subs.map((subName,i)=>rndrSubActivity(t, sectionKey, actDef.key, i)).join('')}
    </div>`:''}
  </div>`;
}

// ── Sub-activity card ────────────────────────────────────────────────────
function rndrSubActivity(t, sectionKey, actKey, idx){
  const s = t.acts[sectionKey][actKey].subs[idx];
  const ed = _isWtgEditor();
  const disAttr = ed?'':'disabled';
  const disStyle = ed?'':'opacity:.55;cursor:not-allowed;';
  const statusColor = WTG_STATUS_COLORS[s.status]||'var(--t4)';
  const path = `${sectionKey}|${actKey}|${idx}`;
  const photoBlock = s.photo
    ? `<img src="${s.photo}" style="max-width:80px;max-height:60px;border-radius:4px;border:1px solid var(--b1);" alt="proof">`
    : '';
  return `<div class="wtg-sub">
    <div class="wtg-sub-head">
      <span style="font-size:10px;font-weight:600;color:var(--t1);flex:1;">${idx+1}. ${s.n}</span>
      <select ${disAttr} onchange="wtgSaveSub('${t.id}','${path}','status',this.value)"
              style="background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:${statusColor};font-size:9px;font-weight:700;padding:2px 5px;${disStyle}">
        ${WTG_STATUS_VALUES.map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${WTG_STATUS_LABELS[v]}</option>`).join('')}
      </select>
    </div>
    <div class="wtg-sub-grid">
      <label><span>Planned Start</span>
        <input type="date" value="${s.pStart||''}" ${disAttr}
               onchange="wtgSaveSub('${t.id}','${path}','pStart',this.value)"
               style="${disStyle}"></label>
      <label><span>Planned End</span>
        <input type="date" value="${s.pEnd||''}" ${disAttr}
               onchange="wtgSaveSub('${t.id}','${path}','pEnd',this.value)"
               style="${disStyle}"></label>
      <label><span>Actual Start</span>
        <input type="date" value="${s.aStart||''}" ${disAttr}
               onchange="wtgSaveSub('${t.id}','${path}','aStart',this.value)"
               style="${disStyle}"></label>
      <label><span>Actual End</span>
        <input type="date" value="${s.aEnd||''}" ${disAttr}
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

// ── Save a sub-activity field, roll up, persist ──────────────────────────
async function wtgSaveSub(turbId, path, field, value){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const t = DB.wtg.turbines.find(x=>x.id===turbId); if(!t) return;
  if(typeof wtgInitActs==='function') wtgInitActs(t);
  const [section, actKey, idxStr] = path.split('|');
  const idx = +idxStr;
  const sub = t.acts[section] && t.acts[section][actKey] && t.acts[section][actKey].subs[idx];
  if(!sub) return;
  sub[field] = value;

  // Auto-derive status from dates
  if(field==='aEnd' && value){ sub.status='done'; }
  else if(field==='aStart' && value && sub.status==='pending'){ sub.status='wip'; }

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

  if(CV==='wtg'){ rndrWtg(); }
  if(typeof updateOverallBars==='function') updateOverallBars();
}

// ── Photo upload for a sub-activity ──────────────────────────────────────
function wtgUploadSubPhoto(turbId, path, inputEl){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  const file = inputEl.files && inputEl.files[0]; if(!file) return;
  if(file.size > 2_000_000){
    if(typeof showToast==='function') showToast('⚠️ Photo too large (max 2MB)','er');
    return;
  }
  const reader = new FileReader();
  reader.onload = async function(e){
    const dataUrl = e.target.result;
    await wtgSaveSub(turbId, path, 'photo', dataUrl);
  };
  reader.readAsDataURL(file);
}

// ═══════════════════════════════════════════════════════════
//  RIGHT-SIDE DETAIL PANEL — Zero Point (Store Yard)
// ═══════════════════════════════════════════════════════════
function selectZeroPoint(){
  _wtgSelected = 'ZP';
  document.querySelectorAll('.turb').forEach(el=>el.style.outline='none');
  const card = document.getElementById('tcard-ZP');
  if(card) card.style.outline='2.5px solid var(--wtg)';

  if(typeof zeroPointInit==='function') zeroPointInit();
  const zp = DB.wtg.zeroPoint;
  const rp = document.getElementById('wtg-right-panel'); if(!rp) return;
  const ed = _isWtgEditor();
  const disAttr = ed?'':'disabled';
  const disStyle = ed?'':'opacity:.55;cursor:not-allowed;';

  // Reset tabs
  document.querySelectorAll('#view-wtg .tab').forEach((x,i)=>x.classList.toggle('on',i===0));
  curWT = 0;

  const turbOpts = ['<option value="">— Unassigned —</option>']
    .concat(DB.wtg.turbines.map(t=>`<option value="${t.id}">${t.id}</option>`)).join('');

  const matRows = zp.materials.map((m,i)=>{
    // Inject "selected" attribute to the right option
    const sel = m.assignedTurbine || '';
    const opts = turbOpts.replace(`value="${sel}"`,`value="${sel}" selected`);
    return `<tr>
      <td style="font-size:9px;font-weight:600;">${m.name}</td>
      <td><input type="date" value="${m.deliveryDate||''}" ${disAttr}
          onchange="zpSaveMat(${i},'deliveryDate',this.value)"
          style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;${disStyle}"></td>
      <td><input type="text" value="${(m.storageLocation||'').replace(/"/g,'&quot;')}" ${disAttr}
          onchange="zpSaveMat(${i},'storageLocation',this.value)"
          style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;width:110px;${disStyle}"></td>
      <td><select ${disAttr} onchange="zpSaveMat(${i},'mddcStatus',this.value)"
          style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;${disStyle}">
          ${['Pending','Received','Inspected','Approved','Rejected'].map(s=>`<option value="${s}" ${m.mddcStatus===s?'selected':''}>${s}</option>`).join('')}
        </select></td>
      <td><select ${disAttr} onchange="zpSaveMat(${i},'assignedTurbine',this.value)"
          style="background:var(--card2);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:2px 4px;font-size:9px;${disStyle}">
          ${opts}
        </select></td>
    </tr>`;
  }).join('');

  const mobRows = (zp.mobilizations||[]).map((mob,i)=>`<tr>
    <td style="font-size:9px;">${mob.material||''}</td>
    <td style="font-size:9px;">${mob.source||'Zero Point'}</td>
    <td style="font-size:9px;font-weight:600;color:var(--wtg);">${mob.destination||''}</td>
    <td style="font-size:9px;">${mob.date||''}</td>
    <td><span class="chip ${mob.status==='delivered'?'cg':mob.status==='in_transit'?'cy':'cr'}">${mob.status||'planned'}</span></td>
    <td>${ed?`<button class="btn bts" onclick="zpDeleteMob(${i})" style="font-size:8px;padding:2px 6px;">✕</button>`:''}</td>
  </tr>`).join('');

  rp.innerHTML = `
    <div class="wtg-detail-header">
      <div class="wtg-detail-icon" style="font-size:40px;line-height:1;display:flex;align-items:center;justify-content:center;width:48px;height:48px;">🏬</div>
      <div class="wtg-detail-info">
        <div class="wtg-detail-title" style="color:var(--wtg);">Zero Point — Store Yard</div>
        <div style="font-size:9px;color:var(--t3);margin-top:4px;">Central material warehouse for all 26 turbines</div>
        <div style="font-size:9px;color:var(--t3);margin-top:3px;">
          ${zp.materials.filter(m=>m.deliveryDate).length}/${zp.materials.length} materials received ·
          ${(zp.mobilizations||[]).length} mobilizations logged
        </div>
      </div>
    </div>

    <div class="wtg-section" style="margin-top:10px;">
      <div class="wtg-section-head" style="cursor:default;">
        <span style="font-size:14px;">📦</span>
        <span style="font-weight:700;font-size:11px;color:var(--wtg);">Materials Inventory</span>
      </div>
      <div class="wtg-section-body">
        <div class="tsc"><table class="tbl">
          <thead><tr>
            <th>Material</th><th>Delivery Date</th><th>Storage Location</th>
            <th>MDDC Status</th><th>Assigned Turbine</th>
          </tr></thead>
          <tbody>${matRows}</tbody>
        </table></div>
      </div>
    </div>

    <div class="wtg-section" style="margin-top:10px;">
      <div class="wtg-section-head" style="cursor:default;">
        <span style="font-size:14px;">🚚</span>
        <span style="font-weight:700;font-size:11px;color:var(--ac);">Mobilization (source → destination)</span>
        ${ed?`<button class="btn btwt bts" style="margin-left:auto;font-size:9px;padding:3px 8px;" onclick="zpAddMob()">+ New Mobilization</button>`:''}
      </div>
      <div class="wtg-section-body">
        ${mobRows?`<div class="tsc"><table class="tbl">
          <thead><tr>
            <th>Material</th><th>Source</th><th>Destination</th>
            <th>Date</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>${mobRows}</tbody>
        </table></div>`:`<div style="font-size:9px;color:var(--t3);padding:8px;text-align:center;">No mobilizations logged yet</div>`}
      </div>
    </div>
  `;
}

async function zpSaveMat(idx, field, value){
  if(!_isWtgEditor()){
    if(typeof showToast==='function') showToast('🔒 WTG Engineer login required','er');
    return;
  }
  if(typeof zeroPointInit==='function') zeroPointInit();
  const m = DB.wtg.zeroPoint.materials[idx]; if(!m) return;
  m[field] = value;
  await zpPersist();
  if(typeof showToast==='function') showToast('✅ '+m.name+' updated','ok');
  if(CV==='wtg' && _wtgSelected==='ZP') selectZeroPoint();
}

async function zpAddMob(){
  if(!_isWtgEditor()) return;
  if(typeof zeroPointInit==='function') zeroPointInit();
  const material = prompt('Material name (e.g. '+ZERO_POINT_MATERIALS[0]+'):', ZERO_POINT_MATERIALS[0]);
  if(!material) return;
  const dest = prompt('Destination turbine (e.g. MBI-12):','');
  if(!dest) return;
  const today = new Date().toISOString().slice(0,10);
  DB.wtg.zeroPoint.mobilizations.push({
    id: 'mob-'+Date.now(),
    material, source:'Zero Point', destination:dest,
    date: today, status:'planned'
  });
  await zpPersist();
  if(typeof showToast==='function') showToast('🚚 Mobilization added','ok');
  if(CV==='wtg' && _wtgSelected==='ZP') selectZeroPoint();
}

async function zpDeleteMob(idx){
  if(!_isWtgEditor()) return;
  if(!confirm('Delete this mobilization?')) return;
  DB.wtg.zeroPoint.mobilizations.splice(idx,1);
  await zpPersist();
  if(typeof showToast==='function') showToast('Deleted','ok');
  if(CV==='wtg' && _wtgSelected==='ZP') selectZeroPoint();
}

async function zpPersist(){
  try{
    if(typeof dataApi!=='undefined' && typeof dataApi.setZeroPoint === 'function'){
      await dataApi.setZeroPoint(DB.wtg.zeroPoint);
    } else if(typeof fbDB!=='undefined' && fbDB){
      await fbDB.ref('wtg/zeroPoint').set(DB.wtg.zeroPoint);
    }
  }catch(e){ /* local-only fallback is fine */ }
}

// ═══════════════════════════════════════════════════════════
//  LEGACY TABS — kept as quick tabular views
// ═══════════════════════════════════════════════════════════
function wTab(t){
  curWT=t;
  document.querySelectorAll('#view-wtg .tab').forEach((x,i)=>x.classList.toggle('on',i===t));
  const rp=document.getElementById('wtg-right-panel'); if(!rp) return;
  if(t===0){
    if(_wtgSelected==='ZP') selectZeroPoint();
    else if(_wtgSelected) selectTurbine(_wtgSelected);
    else rp.innerHTML = rndrRightPanelEmpty();
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
    {key:'xfmr33', label:'33kV Transformer',    u:1},
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

function rndrSchedTab(){ return ''; }

function showTurb(id){ selectTurbine(id); } // legacy stub

// ═══════════════════════════════════════════════════════════

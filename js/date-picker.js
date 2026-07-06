// ═══════════════════════════════════════════════════════════
//  DATE PICKER + DAILY-SNAPSHOT VIEW  (WTG / Solar / Dashboard)
// ═══════════════════════════════════════════════════════════
// A small shared control that lets the user view any past day's
// progress. "Live" (default) shows current data; picking a past
// date loads that day's snapshot. Past snapshots are editable by
// authorized users.
//
// Public API:
//   dpRenderBar(section)   → HTML string for the picker bar
//   dpIsLive(section)      → true when showing live data
//   dpSelectedDate(section)→ the chosen ISO date (or today)
//   dpGetSnapshot(section) → the loaded snapshot object (or null)

(function(global){
  'use strict';

  // selected date per section: { wtg:'2026-05-20'|null, solar:..., home:... }
  // null  → live mode
  const _sel = { wtg:null, solar:null, home:null };
  // loaded snapshot cache per section
  const _snap = { wtg:null, solar:null, home:null };

  function _today(){
    return (global.dataApi && dataApi.todayISO)
      ? dataApi.todayISO()
      : new Date().toISOString().slice(0,10);
  }

  function dpIsLive(section){ return !_sel[section]; }
  function dpSelectedDate(section){ return _sel[section] || _today(); }
  function dpGetSnapshot(section){ return _snap[section]; }

  // Re-render the section the picker belongs to
  function _rerender(section){
    try {
      if(section==='wtg'   && typeof rndrWtg==='function'){ rndrWtg(); if(typeof wTab==='function' && typeof curWT!=='undefined') wTab(curWT); }
      else if(section==='solar' && typeof rndrSolar==='function') rndrSolar();
      else if(section==='home'  && typeof rndrHome==='function')  rndrHome();
    } catch(e){ console.warn('[datepicker] rerender failed', e); }
  }

  // The picker bar HTML
  function dpRenderBar(section){
    const live = dpIsLive(section);
    const date = dpSelectedDate(section);
    const today = _today();
    const snap = _snap[section];
    const edited = snap && snap.edited;
    const ed = (global.auth && auth.canEdit && auth.canEdit());

    return `<div class="dp-bar" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;
              background:var(--card2);border:1px solid var(--b1);border-radius:8px;
              padding:7px 11px;margin-bottom:10px;">
      <span style="font-size:11px;">📅</span>
      <span style="font-size:10px;font-weight:700;color:var(--t2);">View date:</span>
      <input type="date" max="${today}" value="${date}"
             onchange="dpOnPick('${section}',this.value)"
             style="background:var(--card);border:1px solid var(--b1);border-radius:5px;
                    color:var(--t1);font-size:10px;padding:3px 6px;">
      ${live
        ? `<span style="font-size:9px;font-weight:700;color:var(--ok);background:rgba(0,230,118,.12);
              padding:2px 9px;border-radius:10px;">🟢 LIVE — latest data</span>`
        : `<span style="font-size:9px;font-weight:700;color:var(--wn);background:rgba(255,202,40,.14);
              padding:2px 9px;border-radius:10px;">🕓 Snapshot — ${date}${edited?' (edited)':''}</span>
           <button class="btn bts" style="font-size:9px;padding:3px 9px;"
                   onclick="dpGoLive('${section}')">↩ Back to Live</button>`}
      ${(!live && snap && ed)
        ? `<button class="btn bts" style="font-size:9px;padding:3px 9px;background:var(--ac);color:#fff;"
                   onclick="dpEditSnapshot('${section}')">✏️ Edit this day</button>`
        : ''}
      ${(!live && !snap)
        ? `<span style="font-size:9px;color:var(--er);">No snapshot saved for this date</span>`
        : ''}
    </div>`;
  }

  // User picked a date
  async function dpOnPick(section, val){
    const today = _today();
    if(!val || val===today){
      _sel[section]=null; _snap[section]=null;
      _rerender(section);
      return;
    }
    _sel[section]=val;
    if(typeof showToast==='function') showToast('⏳ Loading snapshot for '+val+'…','wn');
    let snap=null;
    try { snap = (global.dataApi&&dataApi.getSnapshot)?await dataApi.getSnapshot(val):null; }
    catch(e){ snap=null; }
    _snap[section]=snap;
    if(!snap && typeof showToast==='function') showToast('No snapshot exists for '+val,'er');
    _rerender(section);
  }

  function dpGoLive(section){
    _sel[section]=null; _snap[section]=null;
    _rerender(section);
  }

  // Edit historical data: opens a simple editor for the snapshot's headline numbers
  function dpEditSnapshot(section){
    const snap=_snap[section]; if(!snap) return;
    if(!(global.auth&&auth.canEdit&&auth.canEdit())){
      if(typeof showToast==='function') showToast('🔒 Login required to edit historical data','er');
      return;
    }
    const date=_sel[section];
    let host=document.getElementById('dp-edit-modal');
    if(!host){
      host=document.createElement('div');
      host.id='dp-edit-modal';
      host.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;'+
        'display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 16px;';
      document.body.appendChild(host);
    }
    // editable headline fields depend on section
    let fields='';
    if(section==='wtg'){
      fields=`<label class="dpe-l">WTG Overall %
        <input id="dpe-wtg" type="number" min="0" max="100" value="${(snap.wtg&&snap.wtg.overall)||0}"></label>`;
    } else if(section==='solar'){
      fields=`<label class="dpe-l">Solar Overall %
        <input id="dpe-sol" type="number" min="0" max="100" value="${(snap.solar&&snap.solar.overall)||0}"></label>`;
    } else {
      fields=`
        <label class="dpe-l">WTG Overall %
          <input id="dpe-wtg" type="number" min="0" max="100" value="${(snap.wtg&&snap.wtg.overall)||0}"></label>
        <label class="dpe-l">Solar Overall %
          <input id="dpe-sol" type="number" min="0" max="100" value="${(snap.solar&&snap.solar.overall)||0}"></label>
        <label class="dpe-l">BOP Overall %
          <input id="dpe-bop" type="number" min="0" max="100" value="${(snap.bop&&snap.bop.overall)||0}"></label>`;
    }
    host.innerHTML=`
      <style>
        .dpe-l{display:block;font-size:9px;color:var(--t3);margin-bottom:8px;}
        .dpe-l input{display:block;width:100%;margin-top:3px;background:var(--card2);
          border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-size:11px;padding:5px 7px;}
      </style>
      <div style="background:var(--card);border:1px solid var(--ac);border-radius:10px;
                  max-width:380px;width:100%;padding:16px 18px;color:var(--t1);
                  box-shadow:0 12px 40px rgba(0,0,0,.45);">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:16px;">✏️</span>
          <div style="font-size:13px;font-weight:800;color:var(--ac);flex:1;">Edit Snapshot — ${date}</div>
          <button class="btn bts" style="font-size:11px;padding:4px 9px;" onclick="dpCloseEdit()">✕</button>
        </div>
        <div style="font-size:9px;color:var(--t3);margin-bottom:10px;">
          Correct the headline progress figures recorded for this date.
        </div>
        ${fields}
        <div style="display:flex;gap:6px;margin-top:10px;">
          <button class="btn bts" style="flex:1;font-size:10px;padding:6px;" onclick="dpCloseEdit()">Cancel</button>
          <button class="btn bts" style="flex:1;font-size:10px;padding:6px;background:var(--ac);color:#fff;"
                  onclick="dpSaveEdit('${section}')">💾 Save</button>
        </div>
      </div>`;
  }

  function dpCloseEdit(){
    const h=document.getElementById('dp-edit-modal'); if(h) h.remove();
  }

  async function dpSaveEdit(section){
    const snap=_snap[section]; if(!snap) return;
    const date=_sel[section];
    const num=(id)=>{const e=document.getElementById(id);return e?Math.max(0,Math.min(100,+e.value||0)):null;};
    const w=num('dpe-wtg'), s=num('dpe-sol'), b=num('dpe-bop');
    if(w!=null){ if(!snap.wtg) snap.wtg={turbines:{}}; snap.wtg.overall=w; }
    if(s!=null){ if(!snap.solar) snap.solar={itcs:{}}; snap.solar.overall=s; }
    if(b!=null){ if(!snap.bop) snap.bop={}; snap.bop.overall=b; }
    try {
      await dataApi.updateSnapshot(date, snap);
      _snap[section]=snap;
      if(typeof showToast==='function') showToast('💾 Snapshot for '+date+' updated','ok');
    } catch(e){
      if(typeof showToast==='function') showToast('❌ '+(e.message||'Save failed'),'er');
      return;
    }
    dpCloseEdit();
    _rerender(section);
  }

  // expose
  global.dpRenderBar    = dpRenderBar;
  global.dpIsLive       = dpIsLive;
  global.dpSelectedDate = dpSelectedDate;
  global.dpGetSnapshot  = dpGetSnapshot;
  global.dpOnPick       = dpOnPick;
  global.dpGoLive       = dpGoLive;
  global.dpEditSnapshot = dpEditSnapshot;
  global.dpCloseEdit    = dpCloseEdit;
  global.dpSaveEdit     = dpSaveEdit;

})(window);

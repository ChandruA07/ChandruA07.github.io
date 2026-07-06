//  TODAY'S PROGRESS (SOLAR & WTG)
// ═══════════════════════════════════════════════════════════
function openSolProg(id){
  const acts=DB.solar.itcs[id].acts;
  document.getElementById('p-t').textContent='📊 Solar Today\'s Progress – '+id;
  document.getElementById('p-b').innerHTML=`<div class="al al-w" style="margin-bottom:9px;">⚠️ Authorized entry. Updates live calculations.</div>
  <form onsubmit="subSolProg(event,'${id}')">
    <div class="fr"><div class="fg"><label class="fl">Activity</label><select class="fs" id="tp-act">${acts.map(a=>`<option value="${a.n}">${a.n} (${a.done}%)</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">New Cumulative %</label><input class="fi" id="tp-cum" type="number" min="0" max="100" step="0.1" placeholder="New total %" required></div></div>
    <div class="fr3"><div class="fg"><label class="fl">Today's Progress %</label><input class="fi" id="tp-td" type="number" min="0" max="100" step="0.1" placeholder="e.g. 2.5"></div>
    <div class="fg"><label class="fl">Manpower</label><input class="fi" id="tp-mp" type="number" min="0" placeholder="Workers" required></div>
    <div class="fg"><label class="fl">Contractor</label><input class="fi" id="tp-con" placeholder="Contractor"></div></div>
    <div class="fr"><div class="fg"><label class="fl">Work Permit</label><input class="fi" id="tp-wp" placeholder="WP-2026-XXX"></div>
    <div class="fg"><label class="fl">TBT Done?</label><select class="fs" id="tp-tbt"><option>Yes</option><option>No</option></select></div></div>
    <div class="fg"><label class="fl">Safety Status</label><select class="fs" id="tp-saf"><option>All Clear</option><option>Near Miss</option><option>Observation Raised</option></select></div>
    <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="tp-rem" placeholder="Constraints, material, issues..."></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button><button type="submit" class="btn btsol" style="flex:1;">✅ Submit</button></div>
  </form>`;ov('pov');
}
async function subSolProg(e,id){
  e.preventDefault();
  // FIX 4 — was: if(!CU || (CU.role!=='solar' && CU.role!=='all' && !CU.isAdmin)) — failed when CU was stale.
  const cu = (typeof _ensureCU === 'function') ? _ensureCU() : (window.CU || null);
  if (!cu) { if (typeof _requireUnlock === 'function') _requireUnlock(() => subSolProg(e, id)); else showToast('🔒 Login required','er'); return; }
  if (cu.role !== 'solar' && cu.role !== 'all' && !cu.isAdmin) {
    showToast('🔒 Solar role required','er');
    return;
  }
  const actName=document.getElementById('tp-act').value;
  const cum=+document.getElementById('tp-cum').value;
  const td=+document.getElementById('tp-td').value;
  const mp=+document.getElementById('tp-mp').value;
  const idx = DB.solar.itcs[id].acts.findIndex(a=>a.n===actName);
  if (idx < 0) { showToast('Activity not found','er'); return; }
  try {
    await dataApi.updateSolarAct(id, idx, { done: Math.min(100,cum), today: td });
    if (typeof dataApi.pushDailyProgress === 'function') {
      dataApi.pushDailyProgress({ module:'Solar', itc:id, act:actName, today:td, pct:cum }).catch(()=>{});
    }
    DB.mp.sol+=mp;updateKpiMp();
    cov('pov');
    showToast(`✅ Solar ${actName}: ${cum}%`,'ok');
    rndrITC(id);
    if (typeof updateOverallBars === 'function') updateOverallBars();
  } catch(err){
    showToast('❌ '+(err.message||'Save failed'),'er');
  }
}
function openWtgProg(id){
  const t=DB.wtg.turbines.find(x=>x.id===id);if(!t)return;
  document.getElementById('p-t').textContent='📊 WTG Progress – '+id;
  const allActs=[...DB.wtg.civil.map((a,i)=>({...a,type:'civil',idx:i})),...DB.wtg.mech.map((a,i)=>({...a,type:'mech',idx:i})),{n:'USS Works',type:'uss'},{n:'Supply Complete',type:'sup'}];
  document.getElementById('p-b').innerHTML=`<div class="al al-w" style="margin-bottom:9px;">⚠️ Authorized. Updates turbine progress.</div>
  <form onsubmit="subWtgProg(event,'${id}')">
    <div class="fr"><div class="fg"><label class="fl">Activity</label><select class="fs" id="wtp-act">${allActs.map(a=>`<option value="${a.type}:${a.idx||0}">${a.n} (${a.type==='civil'?t.civil[a.idx]:a.type==='mech'?t.mech[a.idx]:a.type==='uss'?t.uss:t.sup}%)</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">New Progress %</label><input class="fi" id="wtp-p" type="number" min="0" max="100" placeholder="0-100" required></div></div>
    <div class="fr3"><div class="fg"><label class="fl">Manpower</label><input class="fi" id="wtp-mp" type="number" min="0" placeholder="Workers" required></div>
    <div class="fg"><label class="fl">Contractor</label><input class="fi" id="wtp-con" placeholder="Contractor"></div>
    <div class="fg"><label class="fl">Work Permit</label><input class="fi" id="wtp-wp" placeholder="WP-XXX"></div></div>
    <div class="fr"><div class="fg"><label class="fl">TBT Done?</label><select class="fs" id="wtp-tbt"><option>Yes</option><option>No</option></select></div>
    <div class="fg"><label class="fl">Safety</label><select class="fs" id="wtp-saf"><option>All Clear</option><option>Near Miss</option><option>Observation</option></select></div></div>
    <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="wtp-rem" placeholder="Status, issues..."></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button><button type="submit" class="btn btwt" style="flex:1;">✅ Submit</button></div>
  </form>`;ov('pov');
}
async function subWtgProg(e,id){
  e.preventDefault();
  // FIX 4 — see subSolProg above; same stale-CU pattern.
  const cu = (typeof _ensureCU === 'function') ? _ensureCU() : (window.CU || null);
  if (!cu) { if (typeof _requireUnlock === 'function') _requireUnlock(() => subWtgProg(e, id)); else showToast('🔒 Login required','er'); return; }
  if (cu.role !== 'wtg' && cu.role !== 'all' && !cu.isAdmin) {
    showToast('🔒 WTG role required','er');
    return;
  }
  const [type,idx]=document.getElementById('wtp-act').value.split(':');
  const p=+document.getElementById('wtp-p').value;
  const mp=+document.getElementById('wtp-mp').value;
  const t=DB.wtg.turbines.find(x=>x.id===id);
  if(!t)return;
  if(type==='civil')t.civil[+idx]=p;
  else if(type==='mech')t.mech[+idx]=p;
  else if(type==='uss')t.uss=p;
  else t.sup=p;
  if(typeof recalcTurbStatus==='function')recalcTurbStatus(t);
  try {
    await dataApi.updateTurbine(t.id, {
      status: t.status,
      lp: !!t.lp, pp: !!t.pp,
      civil: t.civil || [], mech: t.mech || [],
      uss: t.uss || 0, sup: t.sup || 0,
      notes: t.notes || ''
    });
    let actName = type;
    if (type==='civil' && DB.wtg.civil[+idx]) actName = DB.wtg.civil[+idx].n;
    else if (type==='mech' && DB.wtg.mech[+idx]) actName = DB.wtg.mech[+idx].n;
    else if (type==='uss') actName = 'USS Works';
    else if (type==='sup') actName = 'Supply';
    if (typeof dataApi.pushDailyProgress === 'function') {
      dataApi.pushDailyProgress({ module:'WTG', turbine:id, act:actName, pct:p }).catch(()=>{});
    }
    DB.mp.wtg+=mp;updateKpiMp();
    cov('pov');cov('tov');
    showToast(`✅ WTG ${id} | ${type}: ${p}%`,'ok');
    if(CV==='wtg'){rndrWtg();wTab(curWT);}
    if (typeof updateOverallBars === 'function') updateOverallBars();
  } catch(err){
    showToast('❌ '+(err.message||'Save failed'),'er');
  }
}
// ═══════════════════════════════════════════════════════════
//  PROGRESS DATE — shared back-dating selector for section forms
// ═══════════════════════════════════════════════════════════
// Each section's "Update Progress" form includes a date field so the
// resulting daily-progress log entry can be recorded against a past day.
// The chosen date flows into pushDailyProgress({date}) so the dashboard,
// manpower view and reports all reflect it on the correct day.
function _progDateToday(){
  return (typeof dataApi!=='undefined' && dataApi.todayISO) ? dataApi.todayISO()
       : new Date().toISOString().slice(0,10);
}
function _progDateField(id, label){
  const today=_progDateToday();
  return `<div class="fg"><label class="fl">${label||'Progress Date'}
    <span style="font-size:8px;color:var(--t3);font-weight:400;">(pick a past day to back-date)</span></label>
    <input class="fi" id="${id}" type="date" max="${today}" value="${today}"></div>`;
}
function _progDateVal(id){
  const el=document.getElementById(id);
  const v=el&&el.value;
  return (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) ? v : _progDateToday();
}

function updateKpiMp(){
  const el=document.getElementById('kpi-mp');
  if(!el) return;
  // Live total = sum of today's POD manpower across all modules (matches the
  // dashboard KPI computed in rndrHome). Falls back to 0 if POD not loaded.
  const todayIso=(typeof dataApi!=='undefined'&&dataApi.todayISO)?dataApi.todayISO():new Date().toISOString().slice(0,10);
  let tot=0;
  ['s','w','b','l'].forEach(m=>{(DB.pod&&DB.pod[m]||[]).forEach(p=>{if((p.date||todayIso)===todayIso)tot+=parseFloat(p.mp)||0;});});
  el.textContent=tot;
}

// ═══════════════════════════════════════════════════════════
//  POD
// ═══════════════════════════════════════════════════════════
function rndrPod(){
  // Inject custom icons into tab labels
  const si=document.getElementById('ptb-sol-icon');if(si)si.innerHTML=_solImg(14);
  const wi=document.getElementById('ptb-wtg-icon');if(wi)wi.innerHTML=_turbImg(14,'');
  const bi=document.getElementById('ptb-bop-icon');if(bi)bi.innerHTML=_bopImg(14);
  podTab(curPT||'s');
}

function podTab(t){
  curPT=t;
  ['s','w','b','l'].forEach(k=>{
    const el=document.getElementById('ptb-'+k);
    if(el)el.className='stb'+(k===t?` on-${k==='l'?'s':k}`:'');
  });
  // Land tab is now a first-class POD module
  const ltb=document.getElementById('ptb-l');if(ltb)ltb.style.display='';

  const el=document.getElementById('pod-ct');if(!el)return;
  const btnMap={
    s:`<button class="btn btsol bts" onclick="openPODForm('s')">${_solImg(13)} Submit Solar POD</button>`,
    w:`<button class="btn btwt bts" onclick="openPODForm('w')">${_turbImg(13,'')} Submit WTG POD</button>`,
    b:`<button class="btn btbo bts" onclick="openPODForm('b')">${_bopImg(13)} Submit BOP POD</button>`,
    l:`<button class="btn btla bts" onclick="openPODForm('l')">🌍 Submit Land POD</button>`
  };
  const labels={s:'Solar',w:'WTG',b:'BOP',l:'Land'};
  // ── DATE FILTER ──
  // Only the selected date's entries are shown (default: today).
  // Dates within the preloaded 8-day window render instantly; older
  // dates are fetched from Firebase on demand (podFilterChange).
  if(!window._podFilterDate) window._podFilterDate = (typeof dataApi!=='undefined'&&dataApi.todayISO)?dataApi.todayISO():new Date().toISOString().slice(0,10);
  const fDate = window._podFilterDate;
  const todayIso = (typeof dataApi!=='undefined'&&dataApi.todayISO)?dataApi.todayISO():new Date().toISOString().slice(0,10);
  const entries=(DB.pod[t]||[]).filter(x=>x.date===fDate);
  const canEdit=(typeof auth!=='undefined' && auth.canEdit && auth.canEdit());
  el.innerHTML=`
    <div class="pnl" style="position:relative;">
      ${_pageLogoTR()}
      <div class="ph2">
        <div class="pt">Plan of Day — ${labels[t]} | Live feed — entries appear instantly on all devices</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <label style="font-size:9px;color:var(--t2);font-weight:700;display:flex;align-items:center;gap:6px;">
            📅 Date
            <input type="date" class="fi" id="pod-date-filter" value="${esc(fDate)}" max="${esc(todayIso)}"
                   style="width:auto;padding:4px 8px;font-size:10px;" onchange="podFilterChange(this.value)">
          </label>
          ${fDate!==todayIso?`<button class="btn bts" style="font-size:9px;" onclick="podFilterChange('${esc(todayIso)}')">↩ Today</button>`:''}
          ${btnMap[t]||''}
        </div>
      </div>
      ${_podCountBanner(fDate, todayIso)}
      <div id="pod-filter-loading" style="display:none;color:var(--t3);font-size:10px;padding:8px 0;">⏳ Loading entries for ${esc(fDate)} from Firebase…</div>
      ${entries.length
        ? entries.slice().map(x=>_podEntryCard(t,x,canEdit)).join('')
        : `<div style="color:var(--t3);font-size:10px;padding:12px 0;">No ${labels[t]} POD entries for <b>${esc(fDate)}</b>. ${fDate===todayIso?'Click Submit to add.':'Pick another date or return to today.'}</div>`
      }
    </div>`;
}

// Total POD count for the selected date (all modules) + per-module breakdown.
// Replaces the old "XXX" placeholder — gives an at-a-glance "how many POD
// entries today" headline above the live list.
function _podCountBanner(fDate, todayIso){
  const mods=[['s','Solar','var(--sol)'],['w','WTG','var(--wtg)'],['b','BOP','var(--bop)'],['l','Land','var(--land)']];
  const counts={}; let total=0;
  mods.forEach(([k])=>{ const n=(DB.pod[k]||[]).filter(x=>x.date===fDate).length; counts[k]=n; total+=n; });
  const dayLabel = fDate===todayIso ? "Today's" : esc(fDate);
  const chips = mods.map(([k,lbl,col])=>
    `<span style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;
                  background:var(--card2);border:1px solid var(--b1);border-radius:14px;padding:3px 11px;color:var(--t2);">
       <span style="width:8px;height:8px;border-radius:50%;background:${col};"></span>${lbl}
       <b style="color:${col};font-size:12px;">${counts[k]}</b>
     </span>`).join('');
  return `
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;
                background:linear-gradient(135deg,var(--card2),var(--card3));
                border:1px solid var(--b1);border-left:4px solid var(--ac);
                border-radius:10px;padding:10px 14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;">
        <div style="font-family:var(--f2);font-size:30px;font-weight:800;color:var(--ac);line-height:1;letter-spacing:-1px;">${total}</div>
        <div style="font-size:9px;color:var(--t3);line-height:1.4;text-transform:uppercase;letter-spacing:.6px;">
          ${dayLabel}<br>Total POD<br>Entries
        </div>
      </div>
      <div style="width:1px;height:30px;background:var(--b1);"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;flex:1;">${chips}</div>
    </div>`;
}

// Date filter changed: re-render with the new date; if that date is
// outside the preloaded window, fetch it from Firebase once and merge.
async function podFilterChange(dateIso){
  if(!dateIso)return;
  window._podFilterDate = dateIso;
  podTab(curPT||'s');
  const loaded = ['s','w','b','l'].some(m=>(DB.pod[m]||[]).some(x=>x.date===dateIso));
  if(!loaded && typeof realtime!=='undefined' && realtime.loadPodForDate){
    const ld=document.getElementById('pod-filter-loading');
    if(ld)ld.style.display='block';
    try{
      const entries = await realtime.loadPodForDate(dateIso);
      entries.forEach(e=>{
        const m = e.module || 's';
        if(!DB.pod[m]) DB.pod[m]=[];
        if(!DB.pod[m].some(x=>x.id===e.id && x.date===dateIso)){
          DB.pod[m].push({
            id:e.id, date:dateIso, activity:e.activity, qty:e.qty, mp:e.mp,
            by:e.byName||e.by, time:e.time || (e.ts?new Date(e.ts).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):''),
            contractor:e.contractor, notes:e.notes, resources:e.resources,
            status:e.status, progress:e.progress, remark:e.remark,
            statusByName:e.statusByName, photoURL:e.photoURL, ts:e.ts
          });
        }
      });
    }catch(err){ console.warn('[pod] date fetch failed', err); }
    if(window._podFilterDate===dateIso) podTab(curPT||'s');
  }
}

// One POD live-feed card with: module badge, location, activity, planned qty,
// manpower, contractor, status chip, progress, final qty, remark, photo, and
// the 3 status buttons + inline progress/remark fields for the authorised person.
function _podEntryCard(t,x,canEdit){
  const labels={s:'Solar',w:'WTG',b:'BOP',l:'Land'};
  const modCls={s:'btsol',w:'btwt',b:'btbo',l:'btla'};
  // POD is a PLAN-of-day list only. WIP/Completed status is managed in each
  // module's own section (Solar / WTG / BOP / Land), NOT here — so the POD
  // card shows the planned work without status buttons or progress controls.
  // location = first segment of "LOC › Activity" if present
  const parts=(x.activity||'').split(' › ');
  const loc = parts.length>1 ? parts[0] : '';
  const actName = parts.length>1 ? parts.slice(1).join(' › ') : (x.activity||'');
  return `
    <div style="background:var(--card3);border:1px solid var(--b2);border-radius:8px;padding:10px;margin-bottom:7px;font-size:10px;" id="pod-card-${esc(x.id)}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;gap:6px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:7px;min-width:0;">
          <span class="btn ${modCls[t]} bts" style="pointer-events:none;font-size:8px;padding:2px 8px;">${labels[t]}</span>
          ${loc?`<span class="chip cb" style="font-size:8px;">${esc(loc)}</span>`:''}
          <b style="color:var(--t1);">${esc(actName)}</b>
        </div>
      </div>
      <div class="mst">
        <div class="ms">Planned: <b>${esc(x.qty||'—')}</b></div>
        <div class="ms">MP: <b>${esc(x.mp)}</b></div>
        <div class="ms">By: <b>${esc(x.by)}</b></div>
        <div class="ms">At: <b>${esc(x.time)}</b></div>
        ${x.contractor?`<div class="ms">Contractor: <b>${esc(x.contractor)}</b></div>`:''}
      </div>
      ${x.notes?`<div style="color:var(--t3);margin-top:3px;font-size:9px;">📝 ${esc(x.notes)}</div>`:''}
      ${(Array.isArray(x.resources)&&x.resources.length)?`<div style="color:var(--t2);margin-top:4px;font-size:9px;">🔧 ${x.resources.map(r=>esc(r.type)+' × <b>'+esc(r.qty)+'</b>').join(' · ')}</div>`:''}
      ${x.photoURL?`<div style="margin-top:6px;"><img class="pod-photo-thumb" src="${esc(x.photoURL)}" onclick="podViewPhoto('${esc(x.photoURL)}')" alt="POD photo"></div>`:''}
    </div>`;
}

// POD status editing was removed from the POD view — WIP/Completed is managed
// in each module's own section. These shims keep any stale handler safe.
async function podSetStatus(){ /* removed: status managed in module sections */ }

async function podSaveProgress(){ /* removed: progress managed in module sections */ }

function podViewPhoto(url){
  document.getElementById('p-t').textContent='POD Photo';
  const body=document.getElementById('p-b');
  mount(body,
    el('img',{src:url,style:{width:'100%',borderRadius:'8px'}}),
    el('button',{class:'btn',style:{marginTop:'8px',width:'100%'},onclick:()=>cov('pov')},'Close'));
  ov('pov');
}

// Solar activities list (from SOL_ACT_DEFS global)
// Solar activity list — uses full SOL_STRUCTURE if available (phases x activities x sub-activities).
// Returns array of {group, items[]} where each item is the activity OR a sub-activity prefixed with "  ›  ".
function _solarActsList(itcId){
  // Prefer the new 3-phase tree from solar-structure.js
  if(typeof SOL_STRUCTURE !== 'undefined' && SOL_STRUCTURE){
    const out = [];
    Object.keys(SOL_STRUCTURE).forEach(phaseKey => {
      const ph = SOL_STRUCTURE[phaseKey];
      if(!ph || !Array.isArray(ph.activities)) return;
      const items = [];
      ph.activities.forEach(a => {
        items.push(a.n);                                // activity itself
        (a.subs||[]).forEach(s => {
          const name = typeof s==='string' ? s : (s && s.n);
          if(name) items.push('  ›  ' + name);          // indented sub-activity
        });
      });
      out.push({ group: ph.label || phaseKey, items });
    });
    return out;
  }
  // Legacy fallback — flat list from SOL_ACT_DEFS
  return [{ group:'Activities', items: SOL_ACT_DEFS.map(d=>d.n) }];
}

// WTG activity list — full 3-section tree (Civil/Mechanical/Electrical x activities x sub-activities).
function _wtgActsList(){
  if(typeof WTG_STRUCTURE !== 'undefined' && WTG_STRUCTURE){
    const out = [];
    Object.keys(WTG_STRUCTURE).forEach(secKey => {
      const sec = WTG_STRUCTURE[secKey];
      if(!sec || !Array.isArray(sec.activities)) return;
      const items = [];
      sec.activities.forEach(a => {
        items.push(a.n);
        (a.subs||[]).forEach(s => {
          const name = typeof s==='string' ? s : (s && s.n);
          if(name) items.push('  ›  ' + name);
        });
      });
      out.push({ group: sec.label || secKey, items });
    });
    return out;
  }
  // Legacy fallback
  return [{ group:'Activities', items:[...DB.wtg.civil.map(a=>a.n),...DB.wtg.mech.map(a=>a.n),'USS Works','Supply Complete'] }];
}

// BOP activities list (by section) — kept flat (BOP has no sub-activity tree).
function _bopActsList(sec){
  let items;
  if(sec==='PSS') items = Object.keys(DB.pss.acts);
  else if(sec==='GSS') items = Object.keys(DB.gss.acts);
  else {
    const key = sec && sec.includes('33') ? '33kv' : '66kv';
    items = DB.bopActDefs[key].map(a=>a.n);
  }
  return [{ group:sec, items }];
}

// Render a grouped activity dropdown (uses <optgroup>) from one of the above lists
function _podActOptionsGrouped(groups){
  return groups.map(g =>
    `<optgroup label="${g.group}">` +
    g.items.map(n => `<option value="${n.replace(/^\s+›\s+/,'')}">${n}</option>`).join('') +
    `</optgroup>`
  ).join('');
}

// ── POD contractors — fixed dropdown list (+ Other) ───────────────────────
const POD_CONTRACTORS = [
  'Aaraa','Senvion','Windplus','Krishna Electrical','Zelveo',
  'SML','HML','Ashirwad Enterprises'
];
// Renders the Contractor field as a proper dropdown. Selecting "Other"
// reveals a free-text input. Uses the shared id 'pf-con' (a hidden mirror)
// so subPOD keeps reading one value regardless of dropdown vs typed.
function _podContractorField(){
  const opts = POD_CONTRACTORS.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');
  return `<div class="fg">
    <label class="fl">Contractor</label>
    <select class="fs" id="pf-con-sel" onchange="_podContractorChange(this.value)">
      <option value="">— Select contractor —</option>
      ${opts}
      <option value="__other__">Other (type below)</option>
    </select>
    <input class="fi" id="pf-con-other" placeholder="Type contractor / agency name"
           style="display:none;margin-top:6px;" oninput="document.getElementById('pf-con').value=this.value">
    <input type="hidden" id="pf-con">
  </div>`;
}
function _podContractorChange(v){
  const other = document.getElementById('pf-con-other');
  const hidden = document.getElementById('pf-con');
  if(v==='__other__'){
    if(other){ other.style.display='block'; other.focus(); }
    if(hidden) hidden.value = other ? other.value : '';
  } else {
    if(other){ other.style.display='none'; other.value=''; }
    if(hidden) hidden.value = v;
  }
}

// ── POD activity search ───────────────────────────────────────────────────
// A search box above the activity <select> that live-filters its <option>s
// (and hides empty <optgroup>s) so users can quickly find an activity in the
// long EPC list. Wrap the select in a container so we can scope the filter.
function _podActSearchBox(selectId){
  return `<input class="fi" type="text" placeholder="🔍 Search activity..."
            style="margin-bottom:6px;font-size:11px;"
            oninput="_podActSearch('${selectId}', this.value)">`;
}
function _podActSearch(selectId, q){
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const term = (q||'').trim().toLowerCase();
  let firstVisible = null;
  Array.from(sel.querySelectorAll('optgroup')).forEach(grp=>{
    let groupHasMatch = false;
    Array.from(grp.querySelectorAll('option')).forEach(opt=>{
      const txt = opt.textContent.toLowerCase();
      const isOther = opt.value === '__other__';
      const match = !term || isOther || txt.indexOf(term) !== -1;
      opt.hidden = !match;
      opt.disabled = !match && !isOther;
      if(match && !isOther){ groupHasMatch = true; if(!firstVisible) firstVisible = opt; }
    });
    grp.hidden = !groupHasMatch && !!term;
  });
  // also handle bare options not inside an optgroup (e.g. the "Other" option)
  Array.from(sel.children).forEach(node=>{
    if(node.tagName === 'OPTION'){
      const isOther = node.value === '__other__';
      const match = !term || isOther || node.textContent.toLowerCase().indexOf(term) !== -1;
      node.hidden = !match;
    }
  });
  // auto-select the first match so the chosen value is sensible
  if(term && firstVisible) sel.value = firstVisible.value;
}

// ── Full EPC activity master list ─────────────────────────────────────────
// Every construction activity that actually happens on a hybrid EPC site.
// These are appended to the POD activity dropdown as extra optgroups so they
// are always selectable even if not present in the live project structures.
const POD_EXTRA_ACTS = {
  s: [{ group:'Solar — Full EPC Activity List', items:[
    'Pile Marking','Pile Driving','Pile Rectification','Module Mounting Frame Installation',
    'Module Installation','Inter-row DC Cable Laying','String Combiner Box Installation',
    'Inverter Installation','AC Cable Laying (Inverter → Junction Box)','Junction Box Installation',
    'Earthing & Lightning Protection','SCADA Sensor Installation','Final Solar Commissioning Checklist'
  ]}],
  w: [{ group:'WTG — Full EPC Activity List', items:[
    'Foundation Excavation','PCC Pour','Foundation Reinforcement & Casting',
    'Tower Section Delivery & Stacking','Crane Pad Preparation','Tower Erection (Section by Section)',
    'Nacelle Lifting & Installation','Blade Assembly & Lifting','Electrical Interconnection (Inside Tower)',
    'WTG Commissioning & Trial Run','Meteorological Mast Installation'
  ]}],
  b: [
    { group:'BOP 33kV — Full Activity List', items:[
      'Pole Erection','Cross Arm Fitting','Disc Insulator Stringing','Conductor Stringing',
      'Jumpering','Earthing of Poles','Feeder Energisation'
    ]},
    { group:'BOP 66kV — Full Activity List', items:[
      'Tower Foundation','Tower Erection','Conductor Stringing','Earthing Wire Stringing','Line Energisation'
    ]},
    { group:'PSS / GSS — Full Activity List', items:[
      'Civil Foundation','Transformer Installation','Switchgear Installation',
      'Protection Relay Panel Installation','Control Cable Laying','Metering Installation','Substation Commissioning'
    ]}
  ],
  l: [{ group:'Land — Full Activity List', items:[
    'Survey & Demarcation','Acquisition Proceedings','Lease Agreement Signing',
    'Compensation Disbursement','Tree Cutting Clearance','Handing Over to Civil Team'
  ]}]
};
function _podExtraActOptions(t){
  return _podActOptionsGrouped(POD_EXTRA_ACTS[t]||[]);
}

// ── POD photo — automatic, instant upload ─────────────────────────────────
// The moment the user picks an image, the upload starts (no separate
// "Upload" button). A live progress bar shows transfer; on completion the
// Firebase Storage downloadURL lands in a hidden field that subPOD writes
// into the POD record. Never base64 — only the short HTTPS URL is stored.
function _podPhotoBlock(){
  return `<div class="fg">
    <label class="fl">Photo <span style="font-weight:400;color:var(--t3);font-size:9px;">(optional — uploads instantly, max 5 MB)</span></label>
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <input type="file" accept="image/*" id="pf-photo" class="fi" style="flex:1;min-width:160px;" onchange="podPhotoSelected(this)">
      <div class="pod-upl-prog" id="pf-photo-prog" style="display:none;"><div id="pf-photo-prog-bar"></div></div>
      <img id="pf-photo-thumb" class="pod-photo-thumb" style="display:none;" alt="preview">
    </div>
    <input type="hidden" id="pf-photo-url">
    <div id="pf-photo-status" style="font-size:8px;color:var(--t3);margin-top:3px;"></div>
  </div>`;
}
async function podPhotoSelected(input){
  const file=input.files[0];if(!file)return;
  const prog=document.getElementById('pf-photo-prog');
  const bar=document.getElementById('pf-photo-prog-bar');
  const thumb=document.getElementById('pf-photo-thumb');
  const stat=document.getElementById('pf-photo-status');
  const urlEl=document.getElementById('pf-photo-url');
  if(prog){prog.style.display='block';bar.style.width='0%';}
  if(stat)stat.textContent='⏫ Uploading…';
  if(urlEl)urlEl.value='';
  try{
    const {url}=await storage.uploadPodImage(file,pct=>{if(bar)bar.style.width=pct+'%';});
    if(urlEl)urlEl.value=url;
    if(thumb){thumb.src=url;thumb.style.display='block';}
    if(stat)stat.textContent='✅ Uploaded — photo will be attached automatically on submit.';
    if(prog)setTimeout(()=>prog.style.display='none',600);
  }catch(err){
    if(stat)stat.textContent='❌ '+(err.message||'Upload failed');
    if(prog)prog.style.display='none';
    input.value='';
  }
}


// Each POD form can list multiple resources (type + quantity).
const POD_RESOURCE_TYPES = [
  'Excavator','JCB / Backhoe','Crane','Hydra Crane','Tractor','Tipper / Dumper',
  'Concrete Mixer','Transit Mixer','Boom Placer','Water Tanker','Welding Machine',
  'DG Set','Piling Rig','Trailer','Drilling Machine','Compactor / Roller','Other'
];

function _podResourceRow(idx){
  const opts = POD_RESOURCE_TYPES.map(r=>`<option value="${r}">${r}</option>`).join('');
  return `<div class="pod-res-row" data-idx="${idx}" style="display:flex;gap:6px;margin-bottom:5px;align-items:center;">
    <select class="fs pod-res-type" style="flex:2;">${opts}</select>
    <input class="fi pod-res-qty" type="number" min="0" step="any" placeholder="Qty" style="flex:1;">
    <button type="button" class="btn" style="padding:4px 9px;font-size:11px;line-height:1;"
            onclick="podRemoveResource(this)" title="Remove">✕</button>
  </div>`;
}

// HTML block injected into each POD form for the repeatable resource list
function _podResourceBlock(){
  return `<div class="fg">
    <label class="fl">Resources / Equipment <span style="font-weight:400;color:var(--t3);font-size:9px;">(add as many as needed)</span></label>
    <div id="pod-res-list">${_podResourceRow(0)}</div>
    <button type="button" class="btn btsol bts" style="font-size:10px;padding:4px 10px;margin-top:3px;"
            onclick="podAddResource()">+ Add Resource</button>
  </div>`;
}

function podAddResource(){
  const list=document.getElementById('pod-res-list'); if(!list) return;
  const idx=list.querySelectorAll('.pod-res-row').length;
  list.insertAdjacentHTML('beforeend', _podResourceRow(idx));
}

function podRemoveResource(btn){
  const row=btn.closest('.pod-res-row'); if(!row) return;
  const list=document.getElementById('pod-res-list');
  // keep at least one row present
  if(list && list.querySelectorAll('.pod-res-row').length<=1){
    row.querySelector('.pod-res-qty').value='';
    return;
  }
  row.remove();
}

// Collect resource rows into an array of {type, qty}
function _podCollectResources(){
  const out=[];
  document.querySelectorAll('#pod-res-list .pod-res-row').forEach(row=>{
    const type=(row.querySelector('.pod-res-type')||{}).value||'';
    const qty=parseFloat((row.querySelector('.pod-res-qty')||{}).value||'');
    if(type && isFinite(qty) && qty>0) out.push({type, qty});
  });
  return out;
}

function openPODForm(t){
  const titles={s:'Solar POD – Plan of Day',w:'WTG POD – Plan of Day',b:'BOP POD – Plan of Day',l:'Land POD – Plan of Day'};
  document.getElementById('p-t').textContent=titles[t]||'POD';
  document.getElementById('p-b').innerHTML=_buildPODForm(t);
  ov('pov');
}

function _buildPODForm(t){
  if(t==='s'){
    const itcOpts=Object.keys(DB.solar.itcs).map(i=>`<option value="${i}">${i}</option>`).join('');
    const actOpts=_podActOptionsGrouped(_solarActsList('ITC-1'))+_podExtraActOptions('s')+
      '<option value="__other__">— Other (type below) —</option>';
    return `<form onsubmit="subPOD(event,'s')">
      <div class="fr">
        <div class="fg"><label class="fl">ITC</label>
          <select class="fs" id="pf-itc" onchange="updateSolarPODActs(this.value)">${itcOpts}</select>
        </div>
        <div class="fg"><label class="fl">Activity / Sub-activity</label>
          ${_podActSearchBox('pf-act')}
          <select class="fs" id="pf-act" onchange="document.getElementById('pf-other-wrap').style.display=this.value==='__other__'?'block':'none'">
            ${actOpts}
          </select>
        </div>
      </div>
      <div class="fg" id="pf-other-wrap" style="display:none;">
        <label class="fl">Specify Activity Name</label>
        <input class="fi" id="pf-other" placeholder="Type custom activity name">
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Quantity / Progress (%)</label><input class="fi" id="pf-qty" type="number" min="0" max="100" placeholder="e.g. 20" required></div>
        <div class="fg"><label class="fl">Date</label><input class="fi" id="pf-date" type="date" value="${new Date().toISOString().slice(0,10)}" required></div>
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Manpower</label><input class="fi" id="pf-mp" type="number" min="0" placeholder="Workers" required></div>
        <div class="fg"><label class="fl">Submitted By</label><input class="fi" id="pf-by" placeholder="Name" required></div>
      </div>
      ${_podResourceBlock()}
      ${_podPhotoBlock()}
      ${_podContractorField()}
      <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pf-nt" placeholder="Notes..."></textarea></div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btsol" style="flex:1;">${_solImg(12)} Submit Solar POD</button>
      </div>
    </form>`;
  }
  if(t==='w'){
    const turbOpts=DB.wtg.turbines.map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
    const actOpts=_podActOptionsGrouped(_wtgActsList())+_podExtraActOptions('w')+
      '<option value="__other__">— Other (specify below) —</option>';
    return `<form onsubmit="subPOD(event,'w')">
      <div class="fr">
        <div class="fg"><label class="fl">Turbine</label><select class="fs" id="pf-turb">${turbOpts}</select></div>
        <div class="fg"><label class="fl">Activity / Sub-activity</label>
          ${_podActSearchBox('pf-act')}
          <select class="fs" id="pf-act" onchange="document.getElementById('pf-other-wrap').style.display=this.value==='__other__'?'block':'none'">
            ${actOpts}
          </select>
        </div>
      </div>
      <div class="fg" id="pf-other-wrap" style="display:none;">
        <label class="fl">Specify Activity</label>
        <input class="fi" id="pf-other" placeholder="Type activity name">
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Planned Progress %</label><input class="fi" id="pf-qty" type="number" min="0" max="100" placeholder="%" required></div>
        <div class="fg"><label class="fl">Manpower</label><input class="fi" id="pf-mp" type="number" min="0" placeholder="Workers" required></div>
      </div>
      ${_podResourceBlock()}
      ${_podPhotoBlock()}
      ${_podContractorField()}
      <div class="fg"><label class="fl">Submitted By</label><input class="fi" id="pf-by" placeholder="Name" required></div>
      <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pf-nt" placeholder="Notes..."></textarea></div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btwt" style="flex:1;">${_turbImg(12,'')} Submit WTG POD</button>
      </div>
    </form>`;
  }
  if(t==='b'){
    const secOpts=['33kV','66kV','PSS','GSS'].map(s=>`<option value="${s}">${s}</option>`).join('');
    const actOpts=_podActOptionsGrouped(_bopActsList('33kV'))+_podExtraActOptions('b')+
      '<option value="__other__">— Other (specify below) —</option>';
    return `<form onsubmit="subPOD(event,'b')">
      <div class="fr">
        <div class="fg"><label class="fl">Section</label>
          <select class="fs" id="pf-sec" onchange="updateBOPPODActs(this.value)">${secOpts}</select>
        </div>
        <div class="fg"><label class="fl">Activity / Sub-activity</label>
          ${_podActSearchBox('pf-act')}
          <select class="fs" id="pf-act" onchange="document.getElementById('pf-other-wrap').style.display=this.value==='__other__'?'block':'none'">
            ${actOpts}
          </select>
        </div>
      </div>
      <div class="fg" id="pf-other-wrap" style="display:none;">
        <label class="fl">Specify Activity</label>
        <input class="fi" id="pf-other" placeholder="Type activity name">
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Planned Qty</label><input class="fi" id="pf-qty" type="number" min="0" placeholder="Qty" required></div>
        <div class="fg"><label class="fl">Manpower</label><input class="fi" id="pf-mp" type="number" min="0" placeholder="Workers" required></div>
      </div>
      ${_podResourceBlock()}
      ${_podPhotoBlock()}
      ${_podContractorField()}
      <div class="fg"><label class="fl">Submitted By</label><input class="fi" id="pf-by" placeholder="Name" required></div>
      <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pf-nt" placeholder="Notes..."></textarea></div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btbo" style="flex:1;">${_bopImg(12)} Submit BOP POD</button>
      </div>
    </form>`;
  }
  if(t==='l'){
    const locOpts=Object.keys((DB.solLand&&DB.solLand.blocks)||{}).map(b=>`<option value="${esc(b)}">${esc(b)}</option>`).join('')
      + (DB.wtgLand&&Array.isArray(DB.wtgLand.locs)?DB.wtgLand.locs.map(l=>`<option value="${esc(l.id)}">${esc(l.id)}</option>`).join(''):'')
      + '<option value="General">General</option>';
    const actOpts=_podExtraActOptions('l')+
      '<option value="__other__">— Other (specify below) —</option>';
    return `<form onsubmit="subPOD(event,'l')">
      <div class="fr">
        <div class="fg"><label class="fl">Location / Block</label><select class="fs" id="pf-loc">${locOpts}</select></div>
        <div class="fg"><label class="fl">Activity</label>
          ${_podActSearchBox('pf-act')}
          <select class="fs" id="pf-act" onchange="document.getElementById('pf-other-wrap').style.display=this.value==='__other__'?'block':'none'">
            ${actOpts}
          </select>
        </div>
      </div>
      <div class="fg" id="pf-other-wrap" style="display:none;">
        <label class="fl">Specify Activity</label>
        <input class="fi" id="pf-other" placeholder="Type activity name">
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Planned Qty</label><input class="fi" id="pf-qty" type="number" min="0" placeholder="Qty / Acres / Parcels" required></div>
        <div class="fg"><label class="fl">Manpower</label><input class="fi" id="pf-mp" type="number" min="0" placeholder="Workers" required></div>
      </div>
      ${_podResourceBlock()}
      ${_podPhotoBlock()}
      ${_podContractorField()}
      <div class="fg"><label class="fl">Submitted By</label><input class="fi" id="pf-by" placeholder="Name" required></div>
      <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pf-nt" placeholder="Notes..."></textarea></div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btla" style="flex:1;">🌍 Submit Land POD</button>
      </div>
    </form>`;
  }
  return '';
}

// Dynamic activity update when ITC changes (Solar POD)
function updateSolarPODActs(itcId){
  const sel=document.getElementById('pf-act');if(!sel)return;
  sel.innerHTML=_podActOptionsGrouped(_solarActsList(itcId))+_podExtraActOptions('s')+
    '<option value="__other__">— Other (specify below) —</option>';
  const w=document.getElementById('pf-other-wrap');
  if(w) w.style.display='none';
}
// Dynamic activity update when BOP section changes
function updateBOPPODActs(sec){
  const sel=document.getElementById('pf-act');if(!sel)return;
  sel.innerHTML=_podActOptionsGrouped(_bopActsList(sec))+_podExtraActOptions('b')+
    '<option value="__other__">— Other (specify below) —</option>';
  const w=document.getElementById('pf-other-wrap');
  if(w) w.style.display='none';
}

async function subPOD(e, t){
  e.preventDefault();
  // Resolve activity: if "Other" selected, use the text input
  let act = document.getElementById('pf-act')?.value || '';
  if (act === '__other__') {
    act = document.getElementById('pf-other')?.value?.trim() || 'Other';
  }
  // Append turbine or ITC prefix if available
  const itc  = document.getElementById('pf-itc')?.value  || '';
  const turb = document.getElementById('pf-turb')?.value || '';
  const sec  = document.getElementById('pf-sec')?.value  || '';
  const lloc = document.getElementById('pf-loc')?.value  || '';
  const actLabel = [itc || turb || sec || lloc, act].filter(Boolean).join(' › ');
  const photoURL = document.getElementById('pf-photo-url')?.value || null;

  const qty  = +(document.getElementById('pf-qty')?.value || 0);
  const date = document.getElementById('pf-date')?.value || new Date().toISOString().slice(0,10);
  const mp   = +(document.getElementById('pf-mp')?.value || 0);
  const by   = (document.getElementById('pf-by')?.value || '').trim();
  const nt   = document.getElementById('pf-nt')?.value || '';
  // Contractor: prefer the hidden mirror; fall back to the dropdown / other
  // input so a valid selection is never lost.
  let con = document.getElementById('pf-con')?.value || '';
  if(!con){
    const selV = document.getElementById('pf-con-sel')?.value || '';
    if(selV === '__other__') con = document.getElementById('pf-con-other')?.value || '';
    else if(selV) con = selV;
  }
  const resources = _podCollectResources();
  const resourceText = resources.length
    ? resources.map(r => r.type + ' × ' + r.qty).join(', ')
    : '';

  // POD entries are PUBLIC — no auth required (per user spec).
  // Close the modal and confirm IMMEDIATELY (optimistic) so the form doesn't
  // linger or visibly shift while two Firebase round-trips complete. The
  // writes then run in the background; the realtime listener refreshes the
  // POD list automatically when they land.
  cov('pov');
  showToast('✅ POD submitted: ' + actLabel, 'ok');
  (async () => {
    try {
      await dataApi.addPod({
        module:     t,            // 's' | 'w' | 'l' | 'b'
        activity:   actLabel,
        qty:        qty,
        mp:         mp,
        resources:  resources,
        byName:     by,           // submitter name as typed in the form
        contractor: con,
        notes:      nt,
        photoURL:   photoURL,
        date:       date,
      });
      if (date !== dataApi.todayISO() && typeof _attachPodDateListener === 'function') {
        _attachPodDateListener(date);
      }
      await dataApi.addDailyProgress({
        module:   ({s:'Solar',w:'WTG',l:'Land',b:'BOP'})[t] || t,
        activity: actLabel,
        qty:      qty,
        unit:     '',
        remarks:  [by ? ('by ' + by) : '', resourceText ? ('Resources: ' + resourceText) : '', nt]
                    .filter(Boolean).join(' · ')
      });
      // The Firebase listener will refresh DB.pod and re-render automatically;
      // we don't push to DB.pod directly any more (avoids double-counting).
    } catch (err) {
      console.error('[POD] submit failed', err);
      showToast('❌ ' + (err.message || 'Submit failed — check connection'), 'er');
    }
  })();
}

// ═══════════════════════════════════════════════════════════
//  SAFETY
// ═══════════════════════════════════════════════════════════
function rndrSafety(){
  // Seed the specific employees from the spec if not already there
  const specEmps=[
    {code:'BE28',name:'Chandrashekhar Angadi',score:78,photo:''},
    {code:'BE27',name:'Abdul',score:82,photo:''},
    {code:'BE32',name:'Mahesh',score:71,photo:''},
    {code:'BE03',name:'Manjunath',score:88,photo:''},
    {code:'BE12',name:'Shashikant',score:75,photo:''},
    {code:'BE14',name:'Arul',score:80,photo:''},
  ];
  // Seed-employee push removed — HSE_DB.employees is now hydrated by the
  // /hse/employees Firebase listener (state-bridge.js). Adding seed entries
  // here would race with the listener and produce duplicates.

  const obs=HSE_DB.observations;
  const nowDate=new Date();
  const currMonth=nowDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const prevDate=new Date(nowDate.getFullYear(),nowDate.getMonth()-1,1);
  const prevMonth=prevDate.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  const daysInMonth=30;
  // Build tree data: 12 branches × 30 nodes each
  const treeData=Array.from({length:12},(_,bi)=>Array.from({length:daysInMonth},(_,di)=>{
    const o=obs.filter(ob=>ob.branch===bi&&ob.day===di);
    if(o.length===0)return'#2e7d32';
    const r=o[0].risk;
    return r==='No Observation'?'#2e7d32':r==='Unsafe Act / Condition'?'#1565c0':r==='Near Miss'?'#ff8f00':r==='Minor Injury / First Aid'?'#f9a825':r==='Lost Time Injury'?'#c62828':'#b71c1c';
  }));
  // Pyramid levels ordered bottom→top for rendering
  const pyramidLevels=[
    {label:'No Observation',color:'#2e7d32'},
    {label:'Unsafe Act / Condition',color:'#1565c0'},
    {label:'Near Miss',color:'#ff8f00'},
    {label:'Minor Injury / First Aid',color:'#f9a825'},
    {label:'Lost Time Injury',color:'#c62828'},
    {label:'Fatality',color:'#b71c1c'},
  ];

  const sortedEmps=HSE_DB.employees.slice().sort((a,b)=>b.score-a.score);

  document.getElementById('safety-ct').innerHTML=`${_pageLogoTR()}
    <!-- HEADER: Zero LTI -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;padding:12px 18px;background:linear-gradient(135deg,rgba(21,101,192,.12),rgba(0,100,0,.06));border:1px solid rgba(21,101,192,.25);border-radius:var(--r);">
      <div style="text-align:center;">
        <div style="font-family:var(--f2);font-size:28px;font-weight:900;color:#1565c0;letter-spacing:-1px;">ZERO LTI</div>
        <div style="font-size:10px;color:#2e7d32;font-weight:700;">Our Goal — Safety First</div>
      </div>
      <div style="width:1px;height:40px;background:var(--b1);"></div>
      <div style="font-family:var(--f2);font-size:16px;font-weight:700;color:#1565c0;">HSE</div>
      <div style="background:#1565c0;color:#fff;border-radius:20px;padding:2px 14px;font-size:10px;font-weight:600;">${currMonth}</div>
      <div style="background:rgba(21,101,192,.2);color:#1565c0;border-radius:20px;padding:2px 14px;font-size:9px;">prev: ${prevMonth}</div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn bts" style="font-size:9px;border-color:#1565c0;color:#1565c0;" onclick="openAddObservation()">+ Add Observation</button>
        <button class="btn bts" style="font-size:9px;border-color:#1565c0;color:#1565c0;" onclick="openAddEmployee()">+ Add Employee</button>
      </div>
    </div>

    <!-- KPI BOXES row -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
      <div style="border:2px solid #1565c0;border-radius:8px;padding:8px 12px;text-align:center;">
        <div style="font-size:9px;color:var(--t3);">Observations Raised</div>
        <div style="font-family:var(--f2);font-size:26px;font-weight:700;color:#1565c0;">${HSE_DB.kpis.raised}</div>
      </div>
      <div style="border:2px solid #e53935;border-radius:8px;padding:8px 12px;text-align:center;">
        <div style="font-size:9px;color:var(--t3);">Still Open</div>
        <div style="font-family:var(--f2);font-size:26px;font-weight:700;color:#e53935;">${HSE_DB.kpis.open}</div>
      </div>
      <div style="border:2px solid #2e7d32;border-radius:8px;padding:8px 12px;text-align:center;">
        <div style="font-size:9px;color:var(--t3);">Closed</div>
        <div style="font-family:var(--f2);font-size:26px;font-weight:700;color:#2e7d32;">${HSE_DB.kpis.closed}</div>
      </div>
      <div style="border:2px solid #1565c0;border-radius:8px;padding:8px 12px;text-align:center;">
        <div style="font-size:9px;color:var(--t3);">Avg. Close Time</div>
        <div style="font-family:var(--f2);font-size:18px;font-weight:700;color:#1565c0;">${HSE_DB.kpis.avgCloseTime}</div>
      </div>
    </div>

    <!-- SAFETY TREE (large) + PYRAMID (tall) side by side -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
      <!-- Safety Tree: 12 branches × 30 nodes -->
      <div style="background:var(--card2);border:1px solid var(--b1);border-radius:8px;padding:14px;">
        <div style="font-size:11px;font-weight:700;color:#2e7d32;text-align:center;margin-bottom:4px;">🌳 SAFETY TREE OF KUDLIGI SITE</div>
        <div style="font-size:9px;color:#2e7d32;text-align:center;margin-bottom:8px;font-weight:600;">KEEP THE SAFETY TREE GREEN &amp; CLEAN | OUR GOAL IS ZERO LTI</div>
        <div style="display:flex;justify-content:center;align-items:flex-end;gap:4px;flex-wrap:wrap;min-height:200px;">
          ${treeData.map((branch,bi)=>`
            <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
              ${branch.map((col,di)=>`<div title="Branch ${bi+1} Day ${di+1}" onclick="addTreeObs(${bi},${di})"
                style="width:9px;height:9px;border-radius:50%;background:${col};cursor:pointer;border:1px solid rgba(255,255,255,.3);transition:transform .15s;"
                onmouseover="this.style.transform='scale(1.5)'" onmouseout="this.style.transform='scale(1)'"></div>`).join('')}
              <div style="width:2px;height:12px;background:#5d4037;margin-top:1px;"></div>
            </div>`).join('')}
        </div>
        <div style="width:12px;height:40px;background:#5d4037;margin:4px auto;border-radius:2px;"></div>
        <!-- Legend -->
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:8px;justify-content:center;">
          ${[['#2e7d32','No Observation'],['#1565c0','Unsafe Act/Condition'],['#ff8f00','Near Miss'],['#f9a825','Minor Injury'],['#c62828','LTI'],['#b71c1c','Fatality']].map(([c,l])=>`<span style="display:flex;align-items:center;gap:3px;font-size:7px;color:${c};"><span style="width:8px;height:8px;border-radius:50%;background:${c};"></span>${l}</span>`).join('')}
        </div>
      </div>

      <!-- Safety Pyramid: tall proper triangle -->
      <div style="background:var(--card2);border:1px solid var(--b1);border-radius:8px;padding:14px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;">
        <div style="font-size:11px;font-weight:700;color:var(--t2);margin-bottom:10px;">Safety Pyramid</div>
        <div style="width:100%;max-width:280px;">
          ${pyramidLevels.slice().reverse().map((l,i)=>{
            const w=20+(i*13);
            const cnt=obs.filter(o=>o.risk===l.label).length;
            return`<div style="width:${w}%;margin:0 auto 2px;background:${l.color};color:#fff;font-size:8px;font-weight:700;text-align:center;padding:5px 0;border-radius:2px;box-shadow:0 1px 4px rgba(0,0,0,.2);" title="${l.label}">${cnt>0?cnt+' obs':''}</div>`;
          }).join('')}
        </div>
        <div style="font-size:9px;color:var(--t2);font-weight:700;margin-top:10px;">APRIL-2026</div>
        <!-- Pyramid legend -->
        <div style="display:flex;flex-direction:column;gap:2px;margin-top:10px;width:100%;">
          ${pyramidLevels.map(l=>`<div style="display:flex;align-items:center;gap:5px;"><div style="width:12px;height:12px;background:${l.color};border-radius:2px;flex-shrink:0;"></div><span style="font-size:8px;color:var(--t2);">${l.label}</span></div>`).join('')}
        </div>
      </div>
    </div>

    <!-- MONTHLY ANALYTICS + CALENDAR -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px;">
      <!-- Monthly stats -->
      <div class="pnl">
        <div class="ph2"><div class="pt" style="font-weight:700;color:#1565c0;">Monthly Safety Analytics</div></div>
        <div class="pr"><div class="prl" style="font-size:9px;">Obs Raised</div><div class="prt"><div class="prf" style="width:${Math.min(100,HSE_DB.kpis.raised*20)}%;background:#1565c0"></div></div><div class="prp" style="font-size:9px;">${HSE_DB.kpis.raised}</div></div>
        <div class="pr"><div class="prl" style="font-size:9px;">Obs Closed</div><div class="prt"><div class="prf" style="width:${HSE_DB.kpis.raised>0?Math.round(HSE_DB.kpis.closed/HSE_DB.kpis.raised*100):0}%;background:#2e7d32"></div></div><div class="prp" style="font-size:9px;">${HSE_DB.kpis.closed}</div></div>
        <div class="pr"><div class="prl" style="font-size:9px;">Still Open</div><div class="prt"><div class="prf" style="width:${HSE_DB.kpis.raised>0?Math.round(HSE_DB.kpis.open/HSE_DB.kpis.raised*100):0}%;background:#e53935"></div></div><div class="prp" style="font-size:9px;">${HSE_DB.kpis.open}</div></div>
        <div style="margin-top:10px;padding:8px;background:var(--card3);border-radius:8px;text-align:center;">
          <div style="font-size:9px;color:var(--t3);">Closure Rate</div>
          <div style="font-family:var(--f2);font-size:24px;font-weight:700;color:${HSE_DB.kpis.raised>0&&HSE_DB.kpis.closed/HSE_DB.kpis.raised>=.8?'var(--ok)':'var(--er)'};">${HSE_DB.kpis.raised>0?Math.round(HSE_DB.kpis.closed/HSE_DB.kpis.raised*100):0}%</div>
        </div>
        <div class="ch h120" style="margin-top:10px;"><canvas id="ch-hse-monthly"></canvas></div>
      </div>
      <!-- Safety Calendar -->
      <div class="pnl">
        <div class="ph2"><div class="pt" style="font-weight:700;color:#1565c0;">Safety Calendar — ${HSE_DB.month}</div></div>
        <div id="hse-calendar"></div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;">
          ${[['#2e7d32','Safe Day'],['#f9a825','Obs Closed'],['#c62828','Obs Open']].map(([c,l])=>`<span style="display:flex;align-items:center;gap:3px;font-size:7px;color:var(--t3);"><span style="width:8px;height:8px;border-radius:50%;background:${c};"></span>${l}</span>`).join('')}
        </div>
      </div>
      <!-- Risk breakdown -->
      <div class="pnl">
        <div class="ph2"><div class="pt" style="font-weight:700;color:#1565c0;">Risk Category Breakdown</div></div>
        <div class="ch h200"><canvas id="ch-hse-risk"></canvas></div>
      </div>
    </div>

    <!-- OBSERVATION LOG (2/3) + LEADERBOARD (1/3) -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:12px;margin-bottom:14px;">
      <!-- Observation Log -->
      <div class="pnl">
        <div class="ph2"><div class="pt" style="font-weight:700;color:#1565c0;">Observation Log</div><span class="chip cy">${HSE_DB.kpis.open} Open</span></div>
        <div class="tsc"><table class="tbl">
          <thead><tr style="background:#1565c0;">
            <th style="color:#fff;">Location</th><th style="color:#fff;">Observation</th><th style="color:#fff;">Photo</th>
            <th style="color:#fff;">Vendor</th><th style="color:#fff;">Raised Date</th><th style="color:#fff;">Raised By</th>
            <th style="color:#fff;">Status</th><th style="color:#fff;">Closed By</th><th style="color:#fff;">Risk</th><th style="color:#fff;"></th>
          </tr></thead>
          <tbody>${obs.map((o,oi)=>`<tr>
            <td><b>${esc(o.loc)}</b></td>
            <td style="font-size:9px;max-width:120px;">${esc(o.obs)}</td>
            <td style="text-align:center;">
              ${o.photo?`<img src="${esc(o.photo)}" style="width:32px;height:32px;object-fit:cover;border-radius:3px;cursor:pointer;" onclick="viewObsPhoto('${oi}')">`
                       :`<label style="cursor:pointer;font-size:8px;color:#1565c0;text-decoration:underline;">Upload<input type="file" accept="image/*" style="display:none;" onchange="uploadObsPhoto(${oi},this)"></label>`}
            </td>
            <td>${esc(o.vendor)}</td><td style="font-size:9px;">${esc(o.raisedDate)}</td>
            <td style="color:#1565c0;">${o.raisedBy}</td>
            <td><span class="chip ${o.status==='Closed'?'cg':'cy'}">${o.status}</span></td>
            <td>${esc(o.closedBy)||'—'}</td>
            <td><span class="chip cb" style="font-size:7px;">${o.risk}</span></td>
            <td><button onclick="editObs(${oi})" style="background:none;border:none;cursor:pointer;color:var(--t3);font-size:10px;" title="Edit">✏️</button></td>
          </tr>`).join('')}
          ${obs.length===0?`<tr><td colspan="10" style="text-align:center;color:var(--t3);padding:14px;">No observations yet</td></tr>`:''}
          </tbody>
        </table></div>
      </div>

      <!-- Leaderboard 1/3 -->
      <div style="background:var(--card2);border:2px solid #1565c0;border-radius:8px;overflow:hidden;">
        <div style="background:#1565c0;color:#fff;padding:10px 14px;font-size:11px;font-weight:700;">Employee Leaderboard</div>
        <div id="hse-leaderboard-body" style="padding:8px;">
          ${sortedEmps.map((e,i)=>`
            <div style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid var(--b1);${i===0?'background:rgba(255,202,40,.08);border-radius:4px;':''}">
              <div style="font-size:11px;font-weight:800;color:${i===0?'var(--wn)':i===1?'var(--t3)':i===2?'#cd7f32':'var(--t4)'};">
                ${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}
              </div>
              ${e.photo?`<img src="${esc(e.photo)}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`:
                `<div style="width:28px;height:28px;border-radius:50%;background:#1565c0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${esc(e.name.charAt(0).toUpperCase())}</div>`}
              <div style="flex:1;min-width:0;">
                <div style="font-size:9px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.name)}</div>
                <div style="font-size:8px;color:#1565c0;font-weight:600;">${e.code}</div>
              </div>
              <div style="font-family:var(--f2);font-size:14px;font-weight:700;color:${e.score>=80?'var(--ok)':e.score>=60?'var(--wn)':'var(--er)'};">${e.score}</div>
              <div style="display:flex;flex-direction:column;gap:2px;">
                <button onclick="editEmployee('${e.code}')" style="background:none;border:none;cursor:pointer;font-size:9px;color:#1565c0;" title="Edit">✏️</button>
                <button onclick="removeEmployee('${e.code}')" style="background:none;border:none;cursor:pointer;font-size:9px;color:var(--er);" title="Remove">✕</button>
              </div>
            </div>`).join('')}
          <button class="btn bts" style="width:100%;margin-top:8px;font-size:9px;border-color:#1565c0;color:#1565c0;" onclick="openAddEmployee()">+ Add Employee</button>
        </div>
      </div>
    </div>`;

  // Initialize charts and calendar after DOM update
  setTimeout(()=>{
    // Monthly bar chart (last 6 months mock)
    const mLabels=['Nov','Dec','Jan','Feb','Mar','Apr'];
    const mRaised=[2,1,3,1,2,HSE_DB.kpis.raised];
    const mClosed=[2,1,2,1,2,HSE_DB.kpis.closed];
    if(typeof mkC==='function')mkC('ch-hse-monthly',{type:'bar',data:{labels:mLabels,datasets:[
      {label:'Raised',data:mRaised,backgroundColor:'rgba(21,101,192,.7)',borderRadius:3},
      {label:'Closed',data:mClosed,backgroundColor:'rgba(46,125,50,.7)',borderRadius:3},
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top',labels:{boxWidth:8,font:{size:8}}}},scales:{y:{beginAtZero:true,ticks:{font:{size:7}}},x:{ticks:{font:{size:7}}}}}});

    // Risk breakdown doughnut
    const riskCounts={};
    HSE_DB.observations.forEach(o=>{riskCounts[o.risk]=(riskCounts[o.risk]||0)+1;});
    const riskColors={'No Observation':'#2e7d32','Unsafe Act / Condition':'#1565c0','Near Miss':'#ff8f00','Minor Injury / First Aid':'#f9a825','Lost Time Injury':'#c62828','Fatality':'#b71c1c'};
    const rl=Object.keys(riskCounts);const rv=rl.map(k=>riskCounts[k]);const rc=rl.map(k=>riskColors[k]||'var(--b2)');
    if(rl.length>0&&typeof mkC==='function')mkC('ch-hse-risk',{type:'doughnut',data:{labels:rl,datasets:[{data:rv,backgroundColor:rc,borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,cutout:'55%',plugins:{legend:{position:'right',labels:{boxWidth:8,font:{size:8}}}}}});

    // Safety calendar
    if(typeof renderSafetyCalendar==='function')renderSafetyCalendar('hse-calendar',new Date().getMonth()+1,new Date().getFullYear());

    // Leaderboard scoring + re-render
    if(typeof calcLeaderboardScores==='function')calcLeaderboardScores();
    if(typeof renderLeaderboard==='function')renderLeaderboard('hse-leaderboard-body');
  },80);
}

function addTreeObs(branch,day){
  // Pre-fill branch/day in observation form
  openAddObservation(branch,day);
}
async function uploadObsPhoto(idx,input){
  const file=input.files[0];if(!file)return;
  input.value='';
  // FIX 4
  const cu = (typeof _ensureCU === 'function') ? _ensureCU() : (window.CU || null);
  if (!cu) { if (typeof _requireUnlock === 'function') _requireUnlock(() => uploadObsPhoto(idx, input)); else showToast('🔒 Login required','er'); return; }
  try {
    const { url } = await storage.uploadHseImage(file);
    // The HSE_DB observation gets a downloadURL, NOT a base64 blob.
    HSE_DB.observations[idx].photoURL = url;
    HSE_DB.observations[idx].photo    = url; // legacy alias for renderer
    // If this observation has a Firebase id, push the patch via dataApi
    const obsId = HSE_DB.observations[idx]._id;
    if (obsId && typeof dataApi !== 'undefined' && dataApi.updateHseObservation) {
      dataApi.updateHseObservation(obsId, { photoURL: url }).catch(()=>{});
    }
    rndrSafety();
    showToast('✅ Photo uploaded','ok');
  } catch (err) {
    showToast('❌ '+(err.message||'Upload failed'),'er');
  }
}
function viewObsPhoto(idx){
  const o=HSE_DB.observations[idx];if(!o||!o.photo)return;
  document.getElementById('p-t').textContent='Observation Photo';
  document.getElementById('p-b').innerHTML=`<img src="${esc(o.photo)}" style="width:100%;border-radius:8px;"><div style="margin-top:8px;font-size:9px;color:var(--t3);">${esc(o.obs)} — ${esc(o.raisedDate)}</div><button class="btn" style="margin-top:8px;width:100%;" onclick="cov('pov')">Close</button>`;
  ov('pov');
}
function editObs(idx){
  const o=HSE_DB.observations[idx];if(!o)return;
  document.getElementById('p-t').textContent='Edit Observation';
  document.getElementById('p-b').innerHTML=`
    <div class="fr"><div class="fg"><label class="fl">Status</label><select class="fs" id="eo-status"><option ${o.status==='Open'?'selected':''}>Open</option><option ${o.status==='Closed'?'selected':''}>Closed</option></select></div>
    <div class="fg"><label class="fl">Closed By</label><input class="fi" id="eo-closedby" value="${esc(o.closedBy||'')}"></div></div>
    <div class="fg"><label class="fl">Observation</label><textarea class="fta" id="eo-obs">${esc(o.obs)}</textarea></div>
    <div style="display:flex;gap:7px;margin-top:8px;">
      <button class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button class="btn" style="flex:1;background:#1565c0;color:#fff;border:none;" onclick="saveObsEdit(${idx})">Save</button>
    </div>`;
  ov('pov');
}
async function saveObsEdit(idx){
  const o=HSE_DB.observations[idx];if(!o)return;
  o.obs=document.getElementById('eo-obs').value;
  o.status=document.getElementById('eo-status').value;
  o.closedBy=document.getElementById('eo-closedby').value;
  HSE_DB.kpis.open=HSE_DB.observations.filter(x=>x.status==='Open').length;
  HSE_DB.kpis.closed=HSE_DB.observations.filter(x=>x.status==='Closed').length;
  // Persist to Firebase — survives refresh + syncs to all devices.
  try{
    if(o._id){
      await dataApi.updateHseObservation(o._id,{obs:o.obs,desc:o.obs,status:o.status,closedBy:o.closedBy});
    } else {
      // Seed-only observation with no Firebase record yet — create one.
      const res=await dataApi.addHseObservation({type:o.type||'',severity:o.sev||o.severity||'',desc:o.obs,area:o.loc||'',status:o.status});
      o._id=res.id;
      await dataApi.updateHseObservation(o._id,{obs:o.obs,closedBy:o.closedBy});
    }
    cov('pov');rndrSafety();showToast('✅ Observation updated & synced','ok');
  }catch(err){
    cov('pov');rndrSafety();showToast('❌ '+(err.message||'Save failed'),'er');
  }
}
function editEmployee(code){
  const e=HSE_DB.employees.find(x=>x.code===code);if(!e)return;
  document.getElementById('p-t').textContent='Edit Employee: '+code;
  document.getElementById('p-b').innerHTML=`
    <div class="fg"><label class="fl">Name</label><input class="fi" id="ee-name" value="${esc(e.name)}"></div>
    <div class="fg"><label class="fl">Safety Score (0-100)</label><input class="fi" id="ee-score" type="number" min="0" max="100" value="${e.score}"></div>
    <div style="display:flex;gap:7px;margin-top:8px;">
      <button class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button class="btn" style="flex:1;background:#1565c0;color:#fff;border:none;" onclick="saveEmpEdit('${code}')">Save</button>
    </div>`;
  ov('pov');
}
async function saveEmpEdit(code){
  const e=HSE_DB.employees.find(x=>x.code===code);if(!e)return;
  e.name=document.getElementById('ee-name').value;
  e.score=+document.getElementById('ee-score').value||e.score;
  // Persist to Firebase via dataApi (no more scheduleSave no-op).
  try{
    if(e.id){
      await dataApi.updateHseEmployee(e.id,{name:e.name,score:e.score});
    } else {
      const res=await dataApi.addHseEmployee({name:e.name,code:e.code,score:e.score});
      e.id=res.id;
    }
    cov('pov');rndrSafety();showToast('✅ Employee updated & synced','ok');
  }catch(err){
    cov('pov');rndrSafety();showToast('❌ '+(err.message||'Save failed'),'er');
  }
}
async function removeEmployee(code){
  if(!confirm('Remove employee '+code+'?'))return;
  const e=HSE_DB.employees.find(x=>x.code===code);
  HSE_DB.employees=HSE_DB.employees.filter(x=>x.code!==code);
  rndrSafety();
  try{
    if(e && e.id) await dataApi.deleteHseEmployee(e.id);
    showToast('Employee removed','wn');
  }catch(err){
    showToast('❌ '+(err.message||'Delete failed'),'er');
  }
}

function openAddObservation(branch,day){
  document.getElementById('p-t').textContent='➕ Add HSE Observation';
  document.getElementById('p-b').innerHTML=`
    <div class="fr">
      <div class="fg"><label class="fl">Location</label>
        <select class="fs" id="hse-loc">${HSE_DB.locations.map(l=>`<option>${l}</option>`).join('')}</select>
      </div>
      <div class="fg"><label class="fl">Risk Type</label>
        <select class="fs" id="hse-risk">
          <option>No Observation</option><option>Unsafe Act / Condition</option>
          <option>Near Miss</option><option>Minor Injury / First Aid</option>
          <option>Lost Time Injury</option><option>Fatality</option>
        </select>
      </div>
    </div>
    <div class="fg"><label class="fl">Observation</label><textarea class="fta" id="hse-obs" placeholder="Describe..." required></textarea></div>
    <div class="fr">
      <div class="fg"><label class="fl">Vendor</label><input class="fi" id="hse-vendor" placeholder="Vendor / Contractor"></div>
      <div class="fg"><label class="fl">Raised By</label><input class="fi" id="hse-by" placeholder="Your name" required></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Status</label>
        <select class="fs" id="hse-status"><option>Open</option><option>Closed</option></select>
      </div>
      <div class="fg"><label class="fl">Closed By</label><input class="fi" id="hse-closedby" placeholder="If closed"></div>
    </div>
    <div class="fg">
      <label class="fl">Photo <span style="font-weight:400;color:var(--t3);font-size:9px;">(optional — uploads instantly, max 5 MB)</span></label>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <input type="file" accept="image/*" id="hse-photo" class="fi" style="flex:1;min-width:160px;" onchange="hsePhotoSelected(this)">
        <div class="pod-upl-prog" id="hse-photo-prog" style="display:none;"><div id="hse-photo-prog-bar"></div></div>
        <img id="hse-photo-thumb" class="pod-photo-thumb" style="display:none;" alt="preview">
      </div>
      <input type="hidden" id="hse-photo-url">
      <div id="hse-photo-status" style="font-size:8px;color:var(--t3);margin-top:3px;"></div>
    </div>
    <div style="display:flex;gap:7px;margin-top:9px;">
      <button type="button" class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button type="button" class="btn" style="flex:1;background:#1565c0;color:#fff;border:none;" onclick="submitHSEObservation()">Submit</button>
    </div>`;
  ov('pov');
}
async function submitHSEObservation(){
  if (typeof auth !== 'undefined' && (!auth.current() || auth.current().role === 'viewer')) {
    if(typeof showToast==='function')showToast('🔒 Login required to add HSE observations','er');
    return;
  }
  const loc = document.getElementById('hse-loc').value;
  const desc = document.getElementById('hse-obs').value.trim();
  const by  = document.getElementById('hse-by').value.trim();
  if (!desc || !by) { showToast('Observation and Raised By required','er'); return; }
  // Photo already uploaded instantly on selection — just take the URL.
  let photoURL = document.getElementById('hse-photo-url')?.value || null;
  const photoFile = document.getElementById('hse-photo')?.files?.[0] || null;
  try {
    if (!photoURL && photoFile && typeof storage !== 'undefined' && storage.uploadHseImage) {
      const result = await storage.uploadHseImage(photoFile);   // fallback if instant upload failed
      photoURL = result.url;
    }
    await dataApi.addHseObservation({
      type:     document.getElementById('hse-risk').value || 'Unsafe Act / Condition',
      severity: document.getElementById('hse-risk').value || 'Low',
      desc:     desc,
      area:     loc,
      status:   document.getElementById('hse-status').value || 'open',
      vendor:   document.getElementById('hse-vendor').value || '',
      raisedBy: by,
      photoURL: photoURL
    });
    // The state-bridge HSE listener auto-updates HSE_DB.observations and re-renders.
    cov('pov');
    if(typeof showToast==='function')showToast('✅ HSE observation added','ok');
  } catch (err) {
    if(typeof showToast==='function')showToast('❌ ' + (err.message || 'Save failed'),'er');
  }
}
// Instant HSE photo upload — starts the moment the user selects a file.
async function hsePhotoSelected(input){
  const file=input.files[0];if(!file)return;
  const prog=document.getElementById('hse-photo-prog');
  const bar=document.getElementById('hse-photo-prog-bar');
  const thumb=document.getElementById('hse-photo-thumb');
  const stat=document.getElementById('hse-photo-status');
  const urlEl=document.getElementById('hse-photo-url');
  if(prog){prog.style.display='block';bar.style.width='0%';}
  if(stat)stat.textContent='⏫ Uploading…';
  if(urlEl)urlEl.value='';
  try{
    const {url}=await storage.uploadHseImage(file,pct=>{if(bar)bar.style.width=pct+'%';});
    if(urlEl)urlEl.value=url;
    if(thumb){thumb.src=url;thumb.style.display='block';}
    if(stat)stat.textContent='✅ Uploaded — will be attached on submit.';
    if(prog)setTimeout(()=>prog.style.display='none',600);
  }catch(err){
    if(stat)stat.textContent='❌ '+(err.message||'Upload failed');
    if(prog)prog.style.display='none';
    input.value='';
  }
}
function openAddEmployee(){
  document.getElementById('p-t').textContent='Add / Update Employee';
  document.getElementById('p-b').innerHTML=`
    <div class="fr">
      <div class="fg"><label class="fl">EMP Code</label><input class="fi" id="emp-code" placeholder="SW-11" required></div>
      <div class="fg"><label class="fl">Name</label><input class="fi" id="emp-name" placeholder="Name" required></div>
    </div>
    <div class="fg"><label class="fl">Safety Score (0-100)</label><input class="fi" id="emp-score" type="number" min="0" max="100" value="50"></div>
    <div style="display:flex;gap:7px;margin-top:9px;">
      <button type="button" class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button type="button" class="btn" style="flex:1;background:#1565c0;color:#fff;border:none;" onclick="submitEmployee()">Add</button>
    </div>`;
  ov('pov');
}
async function submitEmployee(){
  if (typeof auth !== 'undefined' && !auth.canEdit()) {
    auth.requireRole('admin', () => submitEmployee());
    return;
  }
  const code = document.getElementById('emp-code').value.trim();
  const name = document.getElementById('emp-name').value.trim();
  const score = +document.getElementById('emp-score').value || 50;
  if (!code || !name) { showToast('Code and Name required','er'); return; }
  try {
    const existing = (HSE_DB.employees || []).find(e => e.code === code);
    if (existing && existing.id) {
      await dataApi.updateHseEmployee(existing.id, { name, score });
    } else {
      await dataApi.addHseEmployee({ name, code, score });
    }
    cov('pov');
    showToast('✅ Employee saved','ok');
  } catch (err) {
    showToast('❌ ' + (err.message || 'Save failed'), 'er');
  }
}

// ═══════════════════════════════════════════════════════════
//  MANPOWER & MACHINERY — live, date-wise, drill-down tracker
//
//  Driven entirely by POD entries (each carries module, activity,
//  manpower count `mp`, and a `resources` list of {type, qty}
//  machinery, plus a date). No hardcoded numbers.
//
//  • Date picker: choose any day → totals + breakdown for that day
//  • Section cards: Solar / WTG / BOP / Land — manpower + machine
//    counts for the selected date; click to expand
//  • Expanded section: per-activity rows showing manpower deployed
//    and machinery used for each activity that day
//  • Overall summary KPIs update with the selected date
//  • Re-renders live as POD entries arrive (bridge → rndrMp)
// ═══════════════════════════════════════════════════════════
let _mpSelDate = null;       // null = today
let _mpOpenSection = null;   // which section card is expanded

const MP_SECTIONS = [
  { k:'s', label:'Solar', col:'var(--sol)' },
  { k:'w', label:'WTG',   col:'var(--wtg)' },
  { k:'b', label:'BOP',   col:'var(--bop)' },
  { k:'l', label:'Land',  col:'var(--land)' },
];

function _mpToday(){
  return (typeof dataApi!=='undefined' && dataApi.todayISO) ? dataApi.todayISO()
       : new Date().toISOString().slice(0,10);
}

// Collect POD entries for one module on one date.
function _mpEntries(modKey, date){
  return (DB.pod[modKey]||[]).filter(p => (p.date||_mpToday()) === date);
}
// Sum manpower + machinery for a list of POD entries.
function _mpAggregate(entries){
  let manpower = 0;
  const machines = {};   // type → total qty
  let machineUnits = 0;
  entries.forEach(p=>{
    manpower += parseFloat(p.mp) || 0;
    (Array.isArray(p.resources)?p.resources:[]).forEach(r=>{
      const type = (r.type||'').trim(); if(!type) return;
      const qty = parseFloat(r.qty)||0;
      machines[type] = (machines[type]||0) + qty;
      machineUnits += qty;
    });
  });
  return { manpower, machines, machineUnits, count: entries.length };
}

// Build last-N-day series (ending on `endDate`) of total manpower & machinery
// across all modules — for the trend chart.
function _mpTrend(endDate, days){
  const out=[];
  const end=new Date((endDate||_mpToday())+'T00:00');
  for(let i=days-1;i>=0;i--){
    const dd=new Date(end); dd.setDate(end.getDate()-i);
    const iso=dd.getFullYear()+'-'+String(dd.getMonth()+1).padStart(2,'0')+'-'+String(dd.getDate()).padStart(2,'0');
    let mp=0, mc=0;
    MP_SECTIONS.forEach(s=>{ const a=_mpAggregate(_mpEntries(s.k, iso)); mp+=a.manpower; mc+=a.machineUnits; });
    out.push({ iso, label:dd.toLocaleDateString('en-IN',{day:'2-digit',month:'short'}), mp, mc });
  }
  return out;
}

function rndrMp(){
  const date = _mpSelDate || _mpToday();
  const today = _mpToday();

  // Aggregate per section for the selected date — all LIVE from POD entries.
  const perSection = {};
  let totMp=0, totMachineUnits=0, totActs=0;
  const machineTotals={};
  MP_SECTIONS.forEach(s=>{
    const agg = _mpAggregate(_mpEntries(s.k, date));
    perSection[s.k]=agg;
    totMp += agg.manpower; totMachineUnits += agg.machineUnits; totActs += agg.count;
    Object.entries(agg.machines).forEach(([t,q])=>{ machineTotals[t]=(machineTotals[t]||0)+q; });
  });
  const sol=perSection.s, wtg=perSection.w, bop=perSection.b, land=perSection.l;
  const dateLabel = date===today ? "Today" : new Date(date+'T00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});

  // One section panel: KPI strip + per-activity table (manpower + machinery).
  function sectionPanel(s){
    const agg=perSection[s.k];
    const entries=_mpEntries(s.k, date);
    const rows = entries.length ? entries.map(p=>{
      const parts=(p.activity||'').split(' \u203a ');
      const loc = parts.length>1?parts[0]:'';
      const actName = parts.length>1?parts.slice(1).join(' \u203a '):(p.activity||'');
      const machines=(Array.isArray(p.resources)?p.resources:[]).filter(r=>r&&r.type)
        .map(r=>esc(r.type)+' \u00d7'+esc(r.qty)).join(', ')||'\u2014';
      return `<tr>
        <td>${loc?`<span class="chip cb" style="font-size:8px;">${esc(loc)}</span> `:''}${esc(actName)}</td>
        <td style="text-align:center;font-weight:800;color:var(--ac);">${esc(p.mp)||0}</td>
        <td style="font-size:9px;color:var(--t2);">${machines}</td>
        <td style="font-size:9px;color:var(--t3);">${esc(p.contractor||'\u2014')}</td>
      </tr>`;
    }).join('') : `<tr><td colspan="4" style="text-align:center;color:var(--t3);font-size:9px;padding:14px;">No ${s.label} manpower logged for ${dateLabel}</td></tr>`;
    const machChips = Object.keys(agg.machines).length
      ? Object.entries(agg.machines).map(([t,q])=>`<span class="chip cb" style="font-size:8px;">${esc(t)} \u00d7${q}</span>`).join(' ')
      : '<span style="color:var(--t3);font-size:9px;">No machinery</span>';
    return `
    <div class="pnl" style="border-top:3px solid ${s.col};">
      <div class="ph2" style="margin-bottom:9px;">
        <div class="pt" style="font-weight:800;color:${s.col};">${s.label}</div>
        <div style="display:flex;gap:12px;">
          <span style="font-size:9px;color:var(--t3);">Manpower <b style="color:var(--ac);font-size:13px;">${agg.manpower}</b></span>
          <span style="font-size:9px;color:var(--t3);">Machines <b style="color:var(--wn);font-size:13px;">${agg.machineUnits}</b></span>
          <span style="font-size:9px;color:var(--t3);">Activities <b style="color:var(--t1);font-size:13px;">${agg.count}</b></span>
        </div>
      </div>
      <div style="margin-bottom:8px;display:flex;gap:5px;flex-wrap:wrap;">${machChips}</div>
      <div class="tsc"><table class="tbl">
        <thead><tr><th>Activity</th><th style="text-align:center;">Manpower</th><th>Machinery Used</th><th>Contractor</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>`;
  }

  document.getElementById('mp-ct').innerHTML=`${_pageLogoTR()}
    <div class="ph"><div class="pht">\ud83d\udc77 Manpower & Machinery</div></div>

    <!-- Date picker -->
    <div class="dp-bar" style="display:flex;align-items:center;gap:9px;flex-wrap:wrap;
         background:var(--card2);border:1px solid var(--b1);border-radius:8px;padding:8px 12px;margin-bottom:12px;">
      <span style="font-size:11px;">\ud83d\udcc5</span>
      <span style="font-size:10px;font-weight:700;color:var(--t2);">Select date:</span>
      <input type="date" max="${today}" value="${date}" onchange="mpPickDate(this.value)"
             style="background:var(--card);border:1px solid var(--b1);border-radius:5px;color:var(--t1);font-size:11px;padding:4px 8px;">
      ${date!==today?`<button class="btn bts" style="font-size:9px;" onclick="mpPickDate('${today}')">\u21a9 Today</button>`:''}
      <span style="margin-left:auto;font-size:10px;color:var(--t3);">Showing data for <b style="color:var(--ac);">${dateLabel}</b></span>
    </div>

    <!-- ── Modern hero KPI cards (Power BI-style) ── -->
    <div class="mp-hero-row">
      <div class="mp-hero" style="--c1:#4fc3f7;--c2:#1565c0;">
        <div class="mp-hero-ic">👷</div>
        <div class="mp-hero-v">${totMp}</div>
        <div class="mp-hero-l">Total Manpower</div>
        <div class="mp-hero-s">${totActs} activities · ${dateLabel}</div>
      </div>
      <div class="mp-hero" style="--c1:#ffca28;--c2:#f57f17;">
        <div class="mp-hero-ic">🚜</div>
        <div class="mp-hero-v">${totMachineUnits}</div>
        <div class="mp-hero-l">Machinery Units</div>
        <div class="mp-hero-s">${Object.keys(machineTotals).length} machine types</div>
      </div>
      <div class="mp-hero" style="--c1:#66bb6a;--c2:#2e7d32;">
        <div class="mp-hero-ic">⚙️</div>
        <div class="mp-hero-v">${totMp>0?(totMachineUnits/totMp).toFixed(2):'0.00'}</div>
        <div class="mp-hero-l">Machines / Worker</div>
        <div class="mp-hero-s">deployment ratio</div>
      </div>
      <div class="mp-hero" style="--c1:#ab47bc;--c2:#6a1b9a;">
        <div class="mp-hero-ic">📊</div>
        <div class="mp-hero-v">${[sol,wtg,bop,land].filter(x=>x.manpower>0).length}/4</div>
        <div class="mp-hero-l">Active Sections</div>
        <div class="mp-hero-s">reporting manpower</div>
      </div>
    </div>

    <!-- ── Power BI-style visual dashboard ── -->
    <div class="mp-viz-grid">
      <div class="pnl mp-viz-card">
        <div class="ph2"><div class="pt">📊 Manpower by Section</div><span style="font-size:8px;color:var(--t3);">workers · ${dateLabel}</span></div>
        <div class="ch h240"><canvas id="ch-mpd"></canvas></div>
      </div>
      <div class="pnl mp-viz-card">
        <div class="ph2"><div class="pt">🥧 Manpower by Contractor</div><span style="font-size:8px;color:var(--t3);">${dateLabel}</span></div>
        <div class="ch h240"><canvas id="ch-mpcon"></canvas></div>
      </div>
      <div class="pnl mp-viz-card">
        <div class="ph2"><div class="pt">🔧 Machinery Mix</div><span style="font-size:8px;color:var(--t3);">${totMachineUnits} units</span></div>
        <div class="ch h240" style="position:relative;">
          <canvas id="ch-mps"></canvas>
          <div id="mp-donut-center" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;">
            <div style="font-family:var(--f2);font-size:26px;font-weight:800;color:var(--t1);line-height:1;">${totMachineUnits}</div>
            <div style="font-size:8px;color:var(--t3);text-transform:uppercase;letter-spacing:.8px;">Machinery</div>
          </div>
        </div>
      </div>
    </div>
    <div class="mp-viz-grid">
      <div class="pnl mp-viz-card">
        <div class="ph2"><div class="pt">📈 7-Day Deployment Trend</div><span style="font-size:8px;color:var(--t3);">manpower &amp; machinery</span></div>
        <div class="ch h240"><canvas id="ch-mptrend"></canvas></div>
      </div>
      <div class="pnl mp-viz-card">
        <div class="ph2"><div class="pt">🏗️ Top Machinery Deployed</div><span style="font-size:8px;color:var(--t3);">${dateLabel}</span></div>
        <div class="ch h240"><canvas id="ch-mptop"></canvas></div>
      </div>
      <div class="pnl mp-viz-card">
        <div class="ph2"><div class="pt">⚖️ Manpower vs Machinery</div><span style="font-size:8px;color:var(--t3);">per section</span></div>
        <div class="ch h240"><canvas id="ch-mpcmp"></canvas></div>
      </div>
    </div>

    <!-- KPI gauge strip: each section's share of total manpower -->
    <div class="mp-share-row">
      ${MP_SECTIONS.map(s=>{
        const v=perSection[s.k].manpower; const pct=totMp>0?Math.round(v/totMp*100):0;
        return `<div class="mp-share-card" style="border-left:3px solid ${s.col};">
          <div style="display:flex;justify-content:space-between;align-items:baseline;">
            <span style="font-size:9px;font-weight:700;color:${s.col};">${s.label}</span>
            <span style="font-size:13px;font-weight:800;color:var(--t1);font-family:var(--f2);">${v}</span>
          </div>
          <div style="height:5px;background:var(--b1);border-radius:3px;overflow:hidden;margin-top:5px;">
            <div style="height:100%;width:${pct}%;background:${s.col};border-radius:3px;transition:width .6s cubic-bezier(.22,.8,.36,1);"></div>
          </div>
          <div style="font-size:8px;color:var(--t3);margin-top:3px;">${pct}% of total manpower</div>
        </div>`;
      }).join('')}
    </div>

    <!-- Equipment on site (live aggregate of machinery across all sections) -->
    <div class="pnl"><div class="ph2"><div class="pt">\ud83d\udd27 Machinery on Site \u2014 ${dateLabel}</div></div>
      ${Object.keys(machineTotals).length
        ? `<div class="eqg">${Object.entries(machineTotals).map(([n,v])=>`<div class="eqc"><div class="eqe">\ud83d\udea7</div><div class="eqn">${esc(n)}</div><div class="eqv" style="color:${v?'var(--ac)':'var(--er)'};">${v}</div><div class="eqs">units deployed</div></div>`).join('')}</div>`
        : `<div style="color:var(--t3);font-size:10px;padding:10px 0;">No machinery logged for ${dateLabel}.</div>`}
    </div>

    <!-- Dedicated Solar / WTG / BOP sections (+ Land) -->
    <div class="ph2" style="margin:14px 0 8px;"><div class="pt" style="font-weight:800;">\ud83d\udcc2 Section-wise Detail</div></div>
    ${sectionPanel(MP_SECTIONS[0])}
    ${sectionPanel(MP_SECTIONS[1])}
    ${sectionPanel(MP_SECTIONS[2])}
    ${sectionPanel(MP_SECTIONS[3])}
  `;

  // Charts (deferred so canvases have dimensions) — Power BI-style
  setTimeout(()=>{
    const secCols=['#ffaa00','#00c8ff','#9c27b0','#00c853'];
    // 1) Manpower by Section — vertical bars
    mkC('ch-mpd',{type:'bar',data:{labels:MP_SECTIONS.map(s=>s.label),datasets:[{label:'Manpower',data:MP_SECTIONS.map(s=>perSection[s.k].manpower),backgroundColor:secCols,borderRadius:6,maxBarThickness:48}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},
        tooltip:{callbacks:{label:(c)=>' '+c.parsed.y+' workers'}}},
        scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(255,255,255,.05)'}},x:{grid:{display:false}}}}});

    // 1b) Manpower by Contractor — pie (today's POD entries per contractor)
    const conTotals={};
    MP_SECTIONS.forEach(s=>_mpEntries(s.k,date).forEach(p=>{
      const c=(p.contractor||'Unassigned').trim()||'Unassigned';
      conTotals[c]=(conTotals[c]||0)+(parseFloat(p.mp)||0);
    }));
    const conPairs=Object.entries(conTotals).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,9);
    if(conPairs.length){
      const conPal=['#1e88e5','#43a047','#fb8c00','#8e24aa','#e53935','#00acc1','#fdd835','#6d4c41','#7cb342'];
      mkC('ch-mpcon',{type:'pie',data:{labels:conPairs.map(c=>c[0]),datasets:[{data:conPairs.map(c=>c[1]),backgroundColor:conPairs.map((_,i)=>conPal[i%conPal.length]),borderWidth:2,borderColor:'var(--bg2)'}]},
        options:{responsive:true,maintainAspectRatio:false,
          plugins:{legend:{position:'right',labels:{font:{size:9},boxWidth:10,padding:7}},
            tooltip:{callbacks:{label:(c)=>' '+c.label+': '+c.parsed+' workers'}}}}});
    } else {
      const c=document.getElementById('ch-mpcon'); if(c&&c.parentNode) c.parentNode.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--t3);font-size:10px;">No contractor manpower for this date</div>';
    }

    // 2) Machinery Mix — doughnut with center total (overlay handles the number)
    const mLabels=Object.keys(machineTotals), mData=Object.values(machineTotals);
    const dc=document.getElementById('mp-donut-center');
    if(mLabels.length){
      if(dc) dc.style.display='flex';
      const palette=['#ffaa00','#ff8800','#7c4dff','#9c27b0','#ff9800','#00c8ff','#00c853','#ff5252','#26c6da','#ab47bc'];
      mkC('ch-mps',{type:'doughnut',data:{labels:mLabels,datasets:[{data:mData,backgroundColor:mLabels.map((_,i)=>palette[i%palette.length]),borderWidth:2,borderColor:'var(--bg2)'}]},
        options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{position:'right',labels:{font:{size:9},boxWidth:10,padding:7}},
          tooltip:{callbacks:{label:(c)=>' '+c.label+': '+c.parsed+' units'}}}}});
    } else {
      if(dc) dc.style.display='none';
      const c=document.getElementById('ch-mps'); if(c&&c.parentNode) c.parentNode.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--t3);font-size:10px;">No machinery logged for this date</div>';
    }

    // 3) Manpower vs Machinery — grouped horizontal bars per section
    mkC('ch-mpcmp',{type:'bar',data:{labels:MP_SECTIONS.map(s=>s.label),datasets:[
        {label:'Manpower',data:MP_SECTIONS.map(s=>perSection[s.k].manpower),backgroundColor:'#4fc3f7',borderRadius:4,maxBarThickness:14},
        {label:'Machinery',data:MP_SECTIONS.map(s=>perSection[s.k].machineUnits),backgroundColor:'#ffca28',borderRadius:4,maxBarThickness:14}
      ]},
      options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'top',labels:{font:{size:9},boxWidth:11,padding:8}}},
        scales:{x:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(255,255,255,.05)'}},y:{grid:{display:false}}}}});

    // 4) 7-Day deployment trend — manpower line + machinery line
    const trend=_mpTrend(date,7);
    mkC('ch-mptrend',{type:'line',data:{labels:trend.map(t=>t.label),datasets:[
        {label:'Manpower',data:trend.map(t=>t.mp),borderColor:'#4fc3f7',backgroundColor:'rgba(79,195,247,.14)',fill:true,tension:.32,pointRadius:3,borderWidth:2.4},
        {label:'Machinery',data:trend.map(t=>t.mc),borderColor:'#ffca28',backgroundColor:'rgba(255,202,40,.10)',fill:true,tension:.32,pointRadius:3,borderWidth:2}
      ]},
      options:{responsive:true,maintainAspectRatio:false,
        plugins:{legend:{position:'top',labels:{font:{size:9},boxWidth:11,padding:8}}},
        scales:{y:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(255,255,255,.05)'}},x:{grid:{display:false}}}}});

    // 5) Top machinery deployed — horizontal bars (top 8 by units)
    const topM=Object.entries(machineTotals).sort((a,b)=>b[1]-a[1]).slice(0,8);
    if(topM.length){
      const palette=['#ffaa00','#ff8800','#7c4dff','#9c27b0','#ff9800','#00c8ff','#00c853','#ff5252'];
      mkC('ch-mptop',{type:'bar',data:{labels:topM.map(m=>m[0]),datasets:[{label:'Units',data:topM.map(m=>m[1]),backgroundColor:topM.map((_,i)=>palette[i%palette.length]),borderRadius:5,maxBarThickness:18}]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,
          plugins:{legend:{display:false},tooltip:{callbacks:{label:(c)=>' '+c.parsed.x+' units deployed'}}},
          scales:{x:{beginAtZero:true,ticks:{precision:0},grid:{color:'rgba(255,255,255,.05)'}},y:{grid:{display:false},ticks:{font:{size:9}}}}}});
    } else {
      const c=document.getElementById('ch-mptop'); if(c&&c.parentNode) c.parentNode.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--t3);font-size:10px;">No machinery logged for this date</div>';
    }
  },80);
}

function mpPickDate(d){ if(!d)return; _mpSelDate = (d===_mpToday()?null:d); rndrMp(); }
function mpToggleSection(k){ _mpOpenSection = (_mpOpenSection===k?null:k); rndrMp(); }

// ═══════════════════════════════════════════════════════════
//  MAP
// ═══════════════════════════════════════════════════════════
// ── 66kV EHV Line Tower data (UTM Zone 43P converted to WGS84) ──────────────
const EHV_66KV_TOWERS=[
  {id:"GSS",      type:"terminal", lat:14.862627, lng:76.357685},
  {id:"GANT-1",   type:"gantry",   lat:14.862263, lng:76.358147},
  {id:"AP-1",     type:"tower",    lat:14.862500, lng:76.357870},
  {id:"AP-2",     type:"tower",    lat:14.861936, lng:76.359837},
  {id:"AP-3",     type:"tower",    lat:14.861274, lng:76.360242},
  {id:"GANT-2",   type:"gantry",   lat:14.861038, lng:76.360472},
  {id:"GANT-3",   type:"gantry",   lat:14.860720, lng:76.360805},
  {id:"AP-4",     type:"tower",    lat:14.860601, lng:76.360934},
  {id:"AP-5",     type:"tower",    lat:14.859198, lng:76.362849},
  {id:"AP-6",     type:"tower",    lat:14.859155, lng:76.365488},
  {id:"AP-7",     type:"tower",    lat:14.858057, lng:76.366290},
  {id:"GANT-4",   type:"gantry",   lat:14.857533, lng:76.366231},
  {id:"GANT-5",   type:"gantry",   lat:14.857018, lng:76.366181},
  {id:"AP-8",     type:"tower",    lat:14.856566, lng:76.366169},
  {id:"AP-9",     type:"tower",    lat:14.854184, lng:76.366953},
  {id:"AP-10",    type:"tower",    lat:14.852208, lng:76.367898},
  {id:"AP-11",    type:"tower",    lat:14.850732, lng:76.368260},
  {id:"GANT-6",   type:"gantry",   lat:14.850605, lng:76.368455},
  {id:"GANT-7",   type:"gantry",   lat:14.850404, lng:76.368751},
  {id:"AP-12",    type:"tower",    lat:14.850240, lng:76.369029},
  {id:"AP-12A",   type:"tower",    lat:14.848463, lng:76.369845},
  {id:"AP-13",    type:"tower",    lat:14.847199, lng:76.369632},
  {id:"AP-14",    type:"tower",    lat:14.842834, lng:76.370933},
  {id:"AP-15",    type:"tower",    lat:14.838733, lng:76.372097},
  {id:"AP-16",    type:"tower",    lat:14.836544, lng:76.375233},
  {id:"16/1",     type:"tower",    lat:14.836180, lng:76.377266},
  {id:"AP-17",    type:"tower",    lat:14.835824, lng:76.379252},
  {id:"17/1",     type:"tower",    lat:14.835810, lng:76.381659},
  {id:"17/2",     type:"tower",    lat:14.835804, lng:76.384066},
  {id:"AP-17A",   type:"tower",    lat:14.835790, lng:76.386472},
  {id:"17A/1",    type:"tower",    lat:14.835784, lng:76.388879},
  {id:"17A/2",    type:"tower",    lat:14.835770, lng:76.391332},
  {id:"AP-17B",   type:"tower",    lat:14.835764, lng:76.393692},
  {id:"17B/1",    type:"tower",    lat:14.835750, lng:76.396099},
  {id:"AP-17A2",  type:"tower",    lat:14.835744, lng:76.398505},
  {id:"AP-18",    type:"tower",    lat:14.837161, lng:76.400317},
  {id:"AP-18A",   type:"tower",    lat:14.837470, lng:76.403005},
  {id:"AP-18B",   type:"tower",    lat:14.836316, lng:76.404010},
  {id:"AP-19",    type:"tower",    lat:14.835663, lng:76.405929},
  {id:"AP-20",    type:"tower",    lat:14.835973, lng:76.406935},
  {id:"AP-21",    type:"tower",    lat:14.836434, lng:76.408378},
  {id:"AP-22",    type:"tower",    lat:14.837221, lng:76.409740},
  {id:"AP-22A",   type:"tower",    lat:14.837499, lng:76.411665},
  {id:"AP-23",    type:"tower",    lat:14.837829, lng:76.413740},
  {id:"23/1",     type:"tower",    lat:14.836991, lng:76.416317},
  {id:"AP-23A",   type:"tower",    lat:14.836171, lng:76.418867},
  {id:"AP-23B",   type:"tower",    lat:14.835397, lng:76.421241},
  {id:"AP-24",    type:"tower",    lat:14.834268, lng:76.423966},
  {id:"AP-25",    type:"tower",    lat:14.833297, lng:76.426022},
  {id:"AP-25A",   type:"tower",    lat:14.833252, lng:76.427564},
  {id:"AP-26",    type:"tower",    lat:14.833183, lng:76.429970},
  {id:"AP-27",    type:"tower",    lat:14.832729, lng:76.431761},
  {id:"AP-27A",   type:"tower",    lat:14.834405, lng:76.433909},
  {id:"AP-27B",   type:"tower",    lat:14.835841, lng:76.435665},
  {id:"AP-28",    type:"tower",    lat:14.837239, lng:76.437496},
  {id:"AP-28A",   type:"tower",    lat:14.838041, lng:76.439332},
  {id:"AP-29",    type:"tower",    lat:14.838788, lng:76.441306},
  {id:"AP-30",    type:"tower",    lat:14.839770, lng:76.441917},
  {id:"AP-30A",   type:"tower",    lat:14.839995, lng:76.443415},
  {id:"AP-31",    type:"tower",    lat:14.840212, lng:76.444903},
  {id:"AP-32",    type:"tower",    lat:14.840801, lng:76.447592},
  {id:"AP-33",    type:"tower",    lat:14.840644, lng:76.449561},
  {id:"AP-34",    type:"tower",    lat:14.840014, lng:76.450523},
  {id:"AP-35",    type:"tower",    lat:14.839700, lng:76.451599},
  {id:"PSS",      type:"terminal", lat:14.839608, lng:76.451821},
];

// ── Real 33kV KML coordinates (from 33KV_SPDC_Line_22-04-2026.kml) ──────────
const KML_33KV_MAIN=[[14.862652,76.35769],[14.862512,76.357848],[14.862208,76.359141],[14.862026,76.361225],[14.861136,76.362099],[14.860414,76.363867],[14.859819,76.365483],[14.858116,76.366194],[14.856525,76.365812],[14.849556,76.364422],[14.847669,76.364499],[14.845957,76.365527],[14.845312,76.366844],[14.841158,76.37144],[14.839322,76.372201],[14.837723,76.373556],[14.836546,76.375239],[14.835824,76.379268],[14.835782,76.383633],[14.836048,76.392013],[14.835731,76.400877],[14.835319,76.405979],[14.836032,76.407171],[14.836427,76.40839],[14.83722,76.409752],[14.837795,76.413835],[14.834598,76.423705],[14.832328,76.426605],[14.832354,76.429793],[14.83203,76.431556],[14.836328,76.438711],[14.838056,76.442381],[14.83931,76.442736],[14.840754,76.447659],[14.840651,76.449561],[14.840069,76.450436],[14.839714,76.451591],[14.839604,76.451832]];
const KML_33KV_SPSC=[[14.831771,76.461844],[14.833404,76.461065],[14.833536,76.458853],[14.834445,76.4573],[14.83528,76.455221],[14.837278,76.454084],[14.837477,76.453537],[14.837896,76.453418],[14.83834,76.453287],[14.838759,76.453168],[14.839123,76.452814],[14.839385,76.452488]];
const KML_33KV_DOG=[[14.831771,76.461843],[14.832017,76.462655],[14.832019,76.463236],[14.831772,76.463653],[14.83175,76.463982],[14.831902,76.464255],[14.831941,76.464944],[14.831953,76.465524],[14.832078,76.465875],[14.832118,76.465997],[14.832341,76.466023]];
const KML_PSS_LOC={lat:14.839173,lng:76.452051};
const KML_GSS_LOC={lat:14.862557,lng:76.357378};
const KML_DP_POLES=[{name:"DP",lat:14.839378,lng:76.452489},{name:"SP 3",lat:14.837917,lng:76.453408},{name:"DP 5",lat:14.835266,lng:76.455221},{name:"DP 6",lat:14.834421,lng:76.457297},{name:"DP 7",lat:14.833516,lng:76.458852},{name:"DP 8",lat:14.831753,lng:76.461841},{name:"SP 1",lat:14.839014,lng:76.452905},{name:"SP 2",lat:14.838378,lng:76.453272},{name:"SP 5",lat:14.836772,lng:76.454348},{name:"SP 6",lat:14.836354,lng:76.454717},{name:"SP7",lat:14.835946,lng:76.4549},{name:"SP 8",lat:14.835538,lng:76.455093},{name:"SP 9",lat:14.835082,lng:76.455666},{name:"SP 10",lat:14.83489,lng:76.456111},{name:"SP 11",lat:14.834733,lng:76.456556},{name:"SP 12",lat:14.834623,lng:76.456862},{name:"SP13",lat:14.834183,lng:76.457713},{name:"SP 14",lat:14.833955,lng:76.458102},{name:"SP 15",lat:14.833699,lng:76.458528},{name:"SP 16",lat:14.833486,lng:76.459316},{name:"SP 17",lat:14.833447,lng:76.45979},{name:"SP 18",lat:14.833417,lng:76.460245},{name:"SP 19",lat:14.833387,lng:76.460719},{name:"SP 20",lat:14.832968,lng:76.461264},{name:"SP 21",lat:14.832569,lng:76.461457},{name:"SP 22",lat:14.832152,lng:76.461658}];

// Leaflet layer groups for site-map filtering. Populated in rndrMap.
let MAP_LAYERS = { wtg:null, solar:null, kv33:null, kv66:null, common:null };

function rndrMap(){
  if(mapInst){mapInst.remove();mapInst=null;}
  const mc=document.getElementById('map-ct');
  if(mc&&!mc.querySelector('.page-logo-tr')){mc.insertAdjacentHTML('afterbegin',_pageLogoTR());}

  function mkTurbIcon(col,glow,size=22,active=false){
    return L.divIcon({className:'',
      html:`<div class="${active?'map-pulse':''}" style="position:relative;width:${size}px;height:${size}px;color:${col};">
        <img src="turbine.png" width="${size}" height="${size}" style="filter:drop-shadow(0 0 4px ${col});" onerror="this.style.display='none';this.parentNode.querySelector('.fb').style.display='flex'">
        <div class="fb" style="display:none;width:${size}px;height:${size}px;background:${col};border:2px solid #fff;border-radius:50%;align-items:center;justify-content:center;font-size:11px;">⚡</div>
        <div style="position:absolute;bottom:-2px;right:-2px;width:7px;height:7px;background:${col};border-radius:50%;border:1px solid #fff;${glow}"></div>
      </div>`,iconSize:[size,size],iconAnchor:[size/2,size/2]});
  }
  function mkSolarIcon(size=24){
    return L.divIcon({className:'',
      html:`<img src="solar.png" width="${size}" height="${size}" style="filter:drop-shadow(0 0 6px rgba(255,170,0,.7));" onerror="this.outerHTML='<div style=width:${size}px;height:${size}px;background:#ffaa00;border:2px solid #fff;border-radius:5px;display:flex;align-items:center;justify-content:center>☀</div>'">`,
      iconSize:[size,size],iconAnchor:[size/2,size/2]});
  }

  setTimeout(()=>{
    // ── Google Earth-style intro ─────────────────────────────────────────
    // The map opens on the WHOLE WORLD, pauses a beat, then flies in one
    // continuous cinematic motion into the project site: Leaflet's flyTo
    // eases the pan across the globe and the zoom (2 → 12) together, which
    // reads as the classic Google-Earth "rotate the globe and dive in"
    // transition. A caption overlay narrates the flight and fades away.
    const _homeCenter=[14.848,76.405], _homeZoom=12;
    window._mapHomeView={center:_homeCenter,zoom:_homeZoom};
    mapInst=L.map('sitemap',{
      zoomAnimation:true, fadeAnimation:true, markerZoomAnimation:true,
      zoomSnap:0.25, wheelDebounceTime:40, worldCopyJump:true
    }).setView([22,40],2);   // world view: Africa/Asia hemisphere with India visible
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInst);

    // caption overlay for the flight
    try{
      const mapEl=document.getElementById('sitemap');
      if(mapEl && !document.getElementById('map-fly-caption')){
        mapEl.insertAdjacentHTML('beforeend',
          `<div id="map-fly-caption" class="map-fly-caption">🌍 Flying to SWPPL 140&nbsp;MW Hybrid Site — Karnataka, India…</div>`);
      }
    }catch(e){}
    // Take off after a short beat so the world view registers visually.
    setTimeout(()=>{
      try{
        mapInst.flyTo(_homeCenter,_homeZoom,{animate:true,duration:4.2,easeLinearity:0.08});
        mapInst.once('moveend',()=>{
          const cap=document.getElementById('map-fly-caption');
          if(cap){ cap.classList.add('done'); setTimeout(()=>cap.remove(),900); }
        });
      }catch(e){
        mapInst.setView(_homeCenter,_homeZoom);
        const cap=document.getElementById('map-fly-caption'); if(cap) cap.remove();
      }
    },650);

    // Google Earth-style smooth zoom-in on marker click. flyTo eases both
    // the pan and the zoom together for a cinematic transition, then opens
    // the marker's popup once the flight settles.
    function _attachFly(marker, lat, lng, zoom){
      marker.on('click', (e)=>{
        try{
          mapInst.flyTo([lat,lng], zoom||16, { animate:true, duration:1.6, easeLinearity:0.22 });
          const mk=e.target;
          mapInst.once('moveend', ()=>{ try{ mk.openPopup(); }catch(_){} });
        }catch(_){ try{ e.target.openPopup(); }catch(__){} }
      });
    }
    // Expose so all marker-adding blocks below can register the fly effect.
    window._mapAttachFly=_attachFly;

    // Build per-category layer groups so filterMap() can show/hide them
    const wtgLayer    = L.layerGroup();
    const solarLayer  = L.layerGroup();
    const kv33Layer   = L.layerGroup();
    const kv66Layer   = L.layerGroup();
    const commonLayer = L.layerGroup(); // PSS, GSS, land parcels — always visible

    // ── PSS square marker (from KML) — common ──
    const pssIcon=L.divIcon({className:'',html:`<div style="width:18px;height:18px;background:#00bcd4;border:2px solid #fff;box-shadow:0 0 12px rgba(0,188,212,.7);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">P</div>`,iconSize:[18,18],iconAnchor:[9,9]});
    const _pssMk=L.marker([KML_PSS_LOC.lat,KML_PSS_LOC.lng],{icon:pssIcon})
      .bindPopup(`<b>🏭 PSS – Power Sub Station</b><br>Lat: ${KML_PSS_LOC.lat.toFixed(5)}, Lng: ${KML_PSS_LOC.lng.toFixed(5)}<br>33kV & 66kV Termination`)
      .addTo(commonLayer);
    _attachFly(_pssMk, KML_PSS_LOC.lat, KML_PSS_LOC.lng, 17);
    const d=0.0005;
    L.rectangle([[KML_PSS_LOC.lat-d,KML_PSS_LOC.lng-d],[KML_PSS_LOC.lat+d,KML_PSS_LOC.lng+d]],{color:'#00bcd4',weight:2,fillOpacity:0.15,dashArray:'4,2'}).addTo(commonLayer);

    // ── GSS square marker (from KML) — common ──
    const gssIcon=L.divIcon({className:'',html:`<div style="width:18px;height:18px;background:#8bc34a;border:2px solid #fff;box-shadow:0 0 12px rgba(139,195,74,.7);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">G</div>`,iconSize:[18,18],iconAnchor:[9,9]});
    const _gssMk=L.marker([KML_GSS_LOC.lat,KML_GSS_LOC.lng],{icon:gssIcon})
      .bindPopup(`<b>⚡ GSS – KPTHL Grid Sub Station 220/66kV</b><br>Lat: ${KML_GSS_LOC.lat.toFixed(5)}, Lng: ${KML_GSS_LOC.lng.toFixed(5)}`)
      .addTo(commonLayer);
    _attachFly(_gssMk, KML_GSS_LOC.lat, KML_GSS_LOC.lng, 17);
    L.rectangle([[KML_GSS_LOC.lat-d,KML_GSS_LOC.lng-d],[KML_GSS_LOC.lat+d,KML_GSS_LOC.lng+d]],{color:'#8bc34a',weight:2,fillOpacity:0.15,dashArray:'4,2'}).addTo(commonLayer);

    // ── 33kV Feeder Routing — uses the SAME _FEEDER_ROUTES data as BOP→33kV page
    //    so the site map and the BOP detail page never diverge. ────────────
    const _feederSrc = (typeof _FEEDER_ROUTES === 'object' && _FEEDER_ROUTES)
      ? _FEEDER_ROUTES : null;
    if (_feederSrc) {
      Object.entries(_feederSrc).forEach(([fKey, f]) => {
        if (!f || !Array.isArray(f.nodes) || f.nodes.length < 2) return;
        const latlngs = f.nodes.map(n => [n.lat, n.lng]);
        L.polyline(latlngs, { color: f.col, weight: 3, opacity: 0.85, className: 'flow-line' })
          .bindPopup(`<b>🔋 33kV ${fKey}</b><br>${f.nodes.length} nodes | ${f.nodes.map(n=>n.id).join(' → ')}`)
          .addTo(kv33Layer);
        // Small pole markers between consecutive nodes
        for (let i = 0; i < f.nodes.length - 1; i++) {
          const [lat1, lng1] = [f.nodes[i].lat,   f.nodes[i].lng];
          const [lat2, lng2] = [f.nodes[i+1].lat, f.nodes[i+1].lng];
          for (let t = 0.25; t <= 0.85; t += 0.3) {
            const pl = [lat1 + (lat2-lat1)*t, lng1 + (lng2-lng1)*t];
            const ic = L.divIcon({ className:'',
              html:`<div style="width:7px;height:7px;background:${f.col};border-radius:50%;border:1.5px solid #fff;"></div>`,
              iconSize:[7,7], iconAnchor:[3.5,3.5] });
            L.marker(pl, { icon: ic }).bindTooltip(`${fKey} — 33kV Pole`, { sticky: true })
              .addTo(kv33Layer);
          }
        }
      });
    } else {
      // Fallback only if BOP page hasn't loaded yet (defensive)
      L.polyline(KML_33KV_MAIN, { color:'#9c27b0', weight:3, opacity:.9, className:'flow-line' })
        .bindPopup('<b>🔋 33kV SPDC Main Line</b>').addTo(kv33Layer);
    }

    // ── DP/SP Poles (same as BOP detail) ──
    KML_DP_POLES.forEach(p=>{
      const ic=L.divIcon({className:'',html:`<div style="width:8px;height:8px;background:#9c27b0;border:1.5px solid #fff;border-radius:50%;"></div>`,iconSize:[8,8],iconAnchor:[4,4]});
      L.marker([p.lat,p.lng],{icon:ic}).bindPopup(`<b>${esc(p.name)}</b><br>Lat:${p.lat.toFixed(5)}, Lng:${p.lng.toFixed(5)}`).addTo(kv33Layer);
    });

    // ── 66kV EHV Line ──
    L.polyline(EHV_66KV_TOWERS.map(t=>[t.lat,t.lng]),{color:'#ff9800',weight:2.5,opacity:.85,className:'flow-line'})
      .bindPopup('<b>🔌 66kV EHV Line – PSS to GSS (12.75km)</b><br>65 Towers + 7 Gantries')
      .addTo(kv66Layer);
    EHV_66KV_TOWERS.forEach(tw=>{
      if(tw.type==='terminal')return;
      const isG=tw.type==='gantry';
      const col=isG?'#ff9800':'#ffd54f';
      const sz=isG?12:8;
      const ic=L.divIcon({className:'',html:`<div style="width:${sz}px;height:${sz}px;background:${col};border:1.5px solid #fff;${isG?'border-radius:2px;':'border-radius:50%;'}opacity:.9;"></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
      L.marker([tw.lat,tw.lng],{icon:ic}).bindPopup(`<b>🔌 ${tw.id}</b><br>${tw.type}`).addTo(kv66Layer);
    });

    // ── Solar ITC markers (one per ITC, distributed across Block 2) ──
    const SOLAR_COORDS=[
      {id:'ITC-1', lat:14.832892, lng:76.468903},
      {id:'ITC-2', lat:14.831200, lng:76.470500},
      {id:'ITC-3', lat:14.834500, lng:76.471800},
      {id:'ITC-4', lat:14.830100, lng:76.467200},
      {id:'ITC-5', lat:14.836200, lng:76.469900},
      {id:'ITC-6', lat:14.829500, lng:76.472100},
    ];
    SOLAR_COORDS.forEach(s=>{
      const itc=DB.solar.itcs[s.id];
      if(!itc)return;
      const prog=(typeof calcITCProg==='function')?calcITCProg(s.id):0;
      const _sMk=L.marker([s.lat,s.lng],{icon:mkSolarIcon(28)})
        .bindPopup(`<b>☀️ ${s.id} – ${itc.mw}MW</b><br>Progress: ${prog}%`)
        .addTo(solarLayer);
      _attachFly(_sMk, s.lat, s.lng, 17);
    });

    // ── WTG turbines ──
    const WTG_COORDS=[
      {id:'MBI-12',lat:14.7426,lng:76.4535},{id:'MKD-258',lat:14.7274,lng:76.4779},
      {id:'KDK-462',lat:14.7419,lng:76.4657},{id:'MOB-403',lat:14.8576,lng:76.3799},
      {id:'MKD-253',lat:14.7255,lng:76.4843},
      {id:'AMK-264',lat:14.8710,lng:76.4035},{id:'CDP-221',lat:14.8215,lng:76.4113},
      {id:'MOB-142',lat:14.8661,lng:76.4045},{id:'MKD-211',lat:14.7328,lng:76.4889},
      {id:'MKD-52',lat:14.7424,lng:76.4861},
      {id:'BDK-25',lat:14.8630,lng:76.3446},
      {id:'BDK-183',lat:14.752606,lng:76.495872},
    ]; // CDP-193, BLK-400, BDK-165, BDK-85 removed; BDK-183 added
    // Status scheme: ROW = red pulse, active (wip/casting/ready) = green
    // with a live pulse ring, pending = grey. Pulse = "this asset is alive".
    WTG_COORDS.forEach(c=>{
      const t=DB.wtg.turbines.find(x=>x.id===c.id);
      const isRow = t && (typeof _wtgHasROW==='function' ? _wtgHasROW(t) : t.status==='row');
      const stKey = isRow ? 'row' : (t ? (t.status||'pending') : 'pending');
      const col   = isRow ? '#ff5252'
                  : stKey==='ready'   ? '#00e676'
                  : stKey==='casting' ? '#4fc3f7'
                  : stKey==='wip'     ? '#ffca28'
                  : '#7c8ba1';
      const active = isRow || stKey==='ready' || stKey==='casting' || stKey==='wip';
      const glow = `box-shadow:0 0 8px ${col};`;
      const label = isRow ? 'ROW Issue' : (stKey.charAt(0).toUpperCase()+stKey.slice(1));
      const _wMk=L.marker([c.lat,c.lng],{icon:mkTurbIcon(col,glow,28,active)})
        .bindPopup(`<b>${esc(c.id)}</b><br>Progress: ${t?calcTurbProg(t):0}%<br>Status: ${esc(label)}`)
        .addTo(wtgLayer);
      _attachFly(_wMk, c.lat, c.lng, 17);
    });

    // ── New land parcels (Land page + Add Parcel form) — common ──
    DB.landParcels.forEach(p=>{
      const col=p.module==='Solar'?'#ffaa00':'#7c4dff';
      const ic=L.divIcon({className:'',
        html:`<div style="width:14px;height:14px;background:${col};border:2px solid #fff;transform:rotate(45deg);opacity:.9;box-shadow:0 0 6px ${col};"></div>`,
        iconSize:[14,14],iconAnchor:[7,7]});
      const _lMk=L.marker([p.lat,p.lng],{icon:ic})
        .bindPopup(`<b>🌍 ${esc(p.name)}</b><br>Module: ${esc(p.module)}<br>Area: ${esc(p.area)} Acres<br>Lat: ${esc(p.lat)}, Lng: ${esc(p.lng)}<br>${esc(p.notes||'')}`)
        .addTo(commonLayer);
      _attachFly(_lMk, p.lat, p.lng, 16);
    });

    // Stash layers and add all of them by default (filter='all').
    MAP_LAYERS = { wtg:wtgLayer, solar:solarLayer, kv33:kv33Layer, kv66:kv66Layer, common:commonLayer };
    commonLayer.addTo(mapInst);
    wtgLayer.addTo(mapInst);
    solarLayer.addTo(mapInst);
    kv33Layer.addTo(mapInst);
    kv66Layer.addTo(mapInst);

    // ── Map legend ──
    const legend=L.control({position:'bottomleft'});
    legend.onAdd=function(){
      const d=L.DomUtil.create('div','');
      d.style.cssText='background:rgba(7,16,31,.92);border:1px solid #1a2e4a;border-radius:8px;padding:8px 10px;font-size:9px;color:#8aaccf;line-height:1.8;';
      d.innerHTML=`<b style="color:#ddeeff;font-size:10px;">Map Legend</b><br>
        <span style="color:#9c27b0;">━━</span> 33kV SPDC Main (12.7km)<br>
        <span style="color:#e91e63;">╌╌</span> 33kV SPSC Feeder<br>
        <span style="color:#ff5722;">╌╌</span> 33kV DOG Line<br>
        <span style="color:#9c27b0;">●</span> DP/SP Poles<br>
        <span style="color:#ff9800;">━━</span> 66kV EHV Line<br>
        <span style="color:#ffd54f;">●</span> 66kV Tower &nbsp;<span style="color:#ff9800;">■</span> Gantry<br>
        <span style="color:#00bcd4;">■</span> PSS &nbsp;&nbsp;<span style="color:#8bc34a;">■</span> GSS<br>
        <span style="color:#00e676;">⚡</span> WTG Ready &nbsp;<span style="color:#ffca28;">⚡</span> WIP<br>
        <span style="color:#ffaa00;">☀</span> Solar ITC`;
      return d;
    };
    legend.addTo(mapInst);

    // ── "Reset view" control — smooth zoom-out back to the full-site view ──
    const resetCtl=L.control({position:'topright'});
    resetCtl.onAdd=function(){
      const b=L.DomUtil.create('button','');
      b.innerHTML='🌍 Reset View';
      b.style.cssText='background:linear-gradient(135deg,#1565c0,#0d47a1);color:#fff;border:1px solid rgba(255,255,255,.25);border-radius:8px;padding:7px 12px;font-size:11px;font-weight:700;cursor:pointer;box-shadow:0 3px 10px rgba(0,0,0,.35);';
      L.DomEvent.disableClickPropagation(b);
      b.onclick=function(){
        try{ mapInst.flyTo(_homeCenter,_homeZoom,{animate:true,duration:1.5,easeLinearity:0.22}); }
        catch(_){ mapInst.setView(_homeCenter,_homeZoom); }
      };
      return b;
    };
    resetCtl.addTo(mapInst);
  },280);
}

// filterMap(t) — show only the chosen category. Common (PSS/GSS/land) stays visible.
function filterMap(t){
  if(!mapInst||!MAP_LAYERS.common){return;}
  const groups = {wtg:MAP_LAYERS.wtg, solar:MAP_LAYERS.solar, '33kv':MAP_LAYERS.kv33, '66kv':MAP_LAYERS.kv66};
  // common is always visible
  if(!mapInst.hasLayer(MAP_LAYERS.common))MAP_LAYERS.common.addTo(mapInst);
  Object.entries(groups).forEach(([key,layer])=>{
    if(!layer)return;
    const should = (t==='all' || t===key);
    if(should && !mapInst.hasLayer(layer))layer.addTo(mapInst);
    if(!should && mapInst.hasLayer(layer))mapInst.removeLayer(layer);
  });
  // Update active button styling
  document.querySelectorAll('.map-fbtn').forEach(b=>{
    b.classList.toggle('active', b.getAttribute('data-flt')===t);
  });
  if(typeof showToast==='function')showToast('Filter: '+t.toUpperCase(),'ok');
}


// ═══════════════════════════════════════════════════════════
//  AUTH — thin shims that delegate to window.auth (auth.js).
//
//  The legacy versions of these functions read the deleted USERS
//  constant. They are kept as thin shims here so any onclick=
//  attribute in old markup continues to work; behaviour is now
//  driven by Firebase Auth via window.auth.
// ═══════════════════════════════════════════════════════════
function reqLogin(role, cb){
  if (typeof auth !== 'undefined' && auth.requireRole) {
    const map = { all: 'admin', solar: 'solar', wtg: 'wtg', bop: 'bop' };
    auth.requireRole(map[role] || role, cb);
    return;
  }
  // Fallback (auth.js not yet loaded): just run the callback.
  if (typeof cb === 'function') cb();
}
function doLogin(){
  if (typeof auth !== 'undefined' && auth.doLoginForm) auth.doLoginForm();
}
function closeLW(){
  if (typeof auth !== 'undefined' && auth.closeLogin) auth.closeLogin();
  else { const lw = document.getElementById('lw'); if (lw) lw.style.display = 'none'; }
}

// MODALS
function ov(id){document.getElementById(id)?.classList.add('open');}
function cov(id){document.getElementById(id)?.classList.remove('open');}
// Modal listeners wired in loader.js after partials are injected

// UI
let sbOpen=true;
function toggleSB(){sbOpen=!sbOpen;document.getElementById('sb').classList.toggle('col',!sbOpen);document.getElementById('mn').classList.toggle('wide',!sbOpen);}
// toggleTheme() lives in advanced.js (loads after this file and owns the
// localStorage-persisted theme). The duplicate that used to live here was
// dead code — advanced.js always shadowed it. Removed in v11 (bug fix #2).

// Open WTG progress form for a specific turbine (from right panel)
function openWtgProgFor(id){
  openWtgProg(id);
}

// exportExcel() lives in advanced.js (thin wrapper over exportToCSV, which
// exports every table on the current page). The ~45-line KPI-CSV variant that
// used to live here was dead code — advanced.js loads later and always
// shadowed it. Removed in v11 (bug fix #3).

// INIT: handled by js/loader.js

// ═══════════════════════════════════════════════════════════
//  SHARED: POD / Status / Remarks editor on subpages
//  (Solar / WTG / BOP all use the same renderer.)
//
//  Editing controls show ONLY when auth.canEdit() is true.
//  Anonymous users see the entries read-only.
// ═══════════════════════════════════════════════════════════

function _todayISO(){
  return (typeof dataApi !== 'undefined' && dataApi.todayISO)
    ? dataApi.todayISO()
    : new Date().toISOString().slice(0,10);
}
function _tomorrowISO(){
  const d = new Date(); d.setDate(d.getDate() + 1);
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function _statusLabel(s){
  return ({nys:'Not Yet Started', wip:'WIP', done:'Completed'})[s] || 'Not Yet Started';
}
function _statusChipClass(s){
  return ({nys:'wt-status-nys', wip:'wt-status-wip', done:'wt-status-done'})[s] || 'wt-status-nys';
}

/**
 * Render the POD list with status/remark/progress editors for a module.
 * @param {string} mod   's' | 'w' | 'b'
 * @param {string} hostId  DOM id of the host element
 */
function renderModulePodList(mod, hostId){
  const host = document.getElementById(hostId); if (!host) return;
  const today = _todayISO();
  const list = (DB.pod[mod] || []).filter(p => p.date === today);
  const canEdit = (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit());

  if (!list.length){
    host.innerHTML = `<div class="al al-i" style="font-size:10px;">
      No POD submitted for today.
      <a style="color:var(--ac);cursor:pointer;font-weight:600;" onclick="nav('pod')">+ Submit POD</a>
    </div>`;
    return;
  }

  host.innerHTML = `
    <div class="al al-i" style="margin-bottom:8px;font-size:10px;">
      ℹ️ ${list.length} POD entr${list.length===1?'y':'ies'} for today.
      ${canEdit
        ? 'Use the three status buttons to mark each entry as <b>Not Yet Started</b>, <b>WIP</b>, or <b>Completed</b>.'
        : '🔒 Login to update status and add remarks.'}
    </div>
    ${list.map(p => _podEditCardHtml(mod, p, canEdit)).join('')}`;
}

function _podEditCardHtml(mod, p, canEdit){
  const id = p.id;
  const status = p.status || 'nys';
  const planned = +p.qty || 0;
  const completed = status === 'done' ? (p.progress != null ? +p.progress : planned)
                  : status === 'wip'  ? (+p.progress || 0)
                  : 0;
  const remaining = Math.max(0, planned - completed);
  const pct = planned > 0 ? Math.min(100, Math.round(completed/planned*100)) : 0;

  // Location prefix vs activity name
  const parts = String(p.activity || '').split('›');
  const loc = parts.length > 1 ? parts[0].trim() : '';
  const act = parts.length > 1 ? parts.slice(1).join('›').trim() : (p.activity || '—');

  // For each module, "module/page" context matters
  const modCol = ({s:'var(--sol)', w:'var(--wtg)', b:'var(--bop)'})[mod] || 'var(--ac)';

  return `
  <div class="pod-edit-card" id="podcard-${id}">
    <div class="pod-edit-head">
      <div class="pod-edit-title">
        ${loc ? `<span class="pod-edit-loc" style="color:${modCol};">${esc(loc)}</span>` : ''}
        ${esc(act)}
        <span style="display:inline-block;margin-left:6px;font-weight:400;font-size:9px;color:var(--t3);">
          Planned: <b style="color:var(--t2);">${planned || '—'}</b>
          ${p.mp ? ` · MP: <b style="color:var(--t2);">${p.mp}</b>` : ''}
          ${p.contractor ? ` · ${esc(p.contractor)}` : ''}
          ${p.by ? ` · by <b style="color:var(--t2);">${esc(p.by)}</b>` : ''}
        </span>
      </div>
      <div>
        <span class="wt-status-chip ${_statusChipClass(status)}">${_statusLabel(status)}</span>
      </div>
    </div>

    ${canEdit ? `
      <div class="pod-status-grp" style="margin-top:9px;">
        <button class="pod-status-btn ${status==='nys'?'on-nys':''}" onclick="setPodStatusUI('${p.date}','${id}','nys','${mod}')">⏸ Not Yet Started</button>
        <button class="pod-status-btn ${status==='wip'?'on-wip':''}" onclick="setPodStatusUI('${p.date}','${id}','wip','${mod}')">▶ WIP</button>
        <button class="pod-status-btn ${status==='done'?'on-done':''}" onclick="setPodStatusUI('${p.date}','${id}','done','${mod}')">✓ Completed</button>
      </div>

      ${status !== 'nys' ? `
        <div class="pod-edit-body">
          <div class="fg">
            <label>${status==='done' ? 'Final completed qty' : 'Progress so far'}</label>
            <input type="number" id="podprog-${id}" min="0" step="any"
              value="${completed}"
              placeholder="${planned ? 'out of '+planned : ''}">
          </div>
          <div class="fg">
            <label>Remark (reason for shortfall, if any)</label>
            <input type="text" id="podrem-${id}" value="${esc(p.remark || '')}" placeholder="e.g. Delay due to rain / machine issue">
          </div>
        </div>
        <div class="pod-edit-save-row">
          <button class="btn bts" onclick="savePodProgressRemark('${p.date}','${id}','${mod}')">💾 Save</button>
        </div>
      ` : ''}

    ` : ''}

    <!-- Live computed summary (shown to everyone) -->
    <div class="pod-edit-meta">
      ${status === 'wip' && planned ? `<b>Live:</b> ${completed} / ${planned} (${pct}%)` : ''}
      ${status === 'done' ? `<b style="color:var(--ok);">Completed:</b> ${completed}${planned?' / '+planned:''}` : ''}
      ${remaining > 0 && status !== 'nys' ? ` · <b style="color:var(--wn);">Pending:</b> ${remaining}` : ''}
      ${p.remark ? ` · 💬 ${esc(p.remark)}` : ''}
      ${p.statusByName ? ` · last by <b>${esc(p.statusByName)}</b>` : ''}
    </div>
  </div>`;
}

async function setPodStatusUI(date, id, status, mod){
  if (typeof auth === 'undefined' || !auth.canEdit()){
    if (typeof reqLogin === 'function') reqLogin('all', () => setPodStatusUI(date,id,status,mod));
    return;
  }
  try {
    // Determine progress to send: if "done", pre-fill to planned qty so the col2 flips correctly.
    const entry = (DB.pod[mod]||[]).find(x => x.id === id);
    const patch = { status };
    if (status === 'done' && entry && entry.qty != null) {
      // If a progress field is shown and filled, prefer that, else default to planned qty
      const inp = document.getElementById('podprog-' + id);
      patch.progress = inp && inp.value !== '' ? Number(inp.value) : Number(entry.qty);
    } else if (status === 'wip') {
      const inp = document.getElementById('podprog-' + id);
      if (inp && inp.value !== '') patch.progress = Number(inp.value);
    } else if (status === 'nys') {
      patch.progress = 0;
    }
    const rem = document.getElementById('podrem-' + id);
    if (rem && rem.value !== undefined && rem.value !== '') patch.remark = rem.value;
    await dataApi.updatePodStatus(date, id, patch);
    showToast('✅ Status set to ' + _statusLabel(status), 'ok');
    // The realtime listener will refresh DB.pod and trigger re-render automatically.
  } catch(err){
    showToast('❌ ' + (err.message || 'Save failed'), 'er');
  }
}

async function savePodProgressRemark(date, id, mod){
  if (typeof auth === 'undefined' || !auth.canEdit()){
    if (typeof reqLogin === 'function') reqLogin('all', () => savePodProgressRemark(date,id,mod));
    return;
  }
  const progEl = document.getElementById('podprog-' + id);
  const remEl  = document.getElementById('podrem-' + id);
  const patch = {};
  if (progEl && progEl.value !== '') patch.progress = Number(progEl.value);
  if (remEl)  patch.remark = remEl.value || '';
  try {
    await dataApi.updatePodStatus(date, id, patch);
    showToast('✅ Saved', 'ok');
  } catch(err){
    showToast('❌ ' + (err.message || 'Save failed'), 'er');
  }
}

// ═══════════════════════════════════════════════════════════
//  Next-Day Plan editor (Solar / WTG / BOP subpages)
// ═══════════════════════════════════════════════════════════
function renderModuleNdpList(mod, hostId){
  const host = document.getElementById(hostId); if (!host) return;
  const tomorrow = _tomorrowISO();
  const list = ((DB.nextDayPlan && DB.nextDayPlan[mod]) || []).filter(p => p.forDate === tomorrow);
  const canEdit = (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit());

  if (!list.length){
    host.innerHTML = `<div class="wt-empty-cell" style="padding:10px 0;">
      No next-day plan added yet for <b>${tomorrow}</b>.
      ${canEdit ? '<br>Use the <b>+ Add Next Day Plan</b> button above to add an item.' : '<br>🔒 Login to add next-day plan items.'}
    </div>`;
    return;
  }

  host.innerHTML = list.map(p => {
    const parts = String(p.activity || '').split('›');
    const loc = parts.length > 1 ? parts[0].trim() : '';
    const act = parts.length > 1 ? parts.slice(1).join('›').trim() : (p.activity || '—');
    return `
      <div class="ndp-item">
        <div>
          ${loc ? `<b style="color:var(--ac);font-size:9px;text-transform:uppercase;letter-spacing:.4px;margin-right:6px;">${esc(loc)}</b>` : ''}
          <span style="color:var(--t1);font-weight:600;">${esc(act)}</span>
          ${p.qty ? `<span style="color:var(--ac);margin-left:6px;font-weight:600;">– ${p.qty}</span>` : ''}
          ${p.mp ? `<span style="color:var(--t3);margin-left:8px;font-size:9px;">MP: ${p.mp}</span>` : ''}
          ${p.by ? `<span style="color:var(--t3);margin-left:8px;font-size:9px;">by ${esc(p.by)}</span>` : ''}
        </div>
        ${canEdit
          ? `<button class="ndp-del" onclick="deleteNdpItem('${p.forDate}','${p.id}','${mod}')" title="Delete">🗑</button>`
          : ''}
      </div>`;
  }).join('');
}

function openSolarNdpForm(){ openNdpForm('s'); }
function openWtgNdpForm(){   openNdpForm('w'); }
function openBopNdpForm(){   openNdpForm('b'); }

function openNdpForm(mod){
  const titles = {s:'➜ Solar — Add Next Day Plan', w:'➜ WTG — Add Next Day Plan', b:'➜ BOP — Add Next Day Plan'};
  const btnClass = {s:'btsol', w:'btwt', b:'btbo'}[mod] || 'bta';
  const tomorrow = _tomorrowISO();

  // Location dropdown depends on module
  let locOpts = '';
  if (mod === 's') locOpts = Object.keys(DB.solar.itcs).map(i=>`<option value="${i}">${i}</option>`).join('');
  else if (mod === 'w') locOpts = (DB.wtg.turbines||[]).map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
  else locOpts = ['33kV','66kV','PSS','GSS'].map(s=>`<option value="${s}">${s}</option>`).join('');

  document.getElementById('p-t').textContent = titles[mod];
  document.getElementById('p-b').innerHTML = `
    <form onsubmit="return submitNdp(event,'${mod}')">
      <div class="al al-i" style="margin-bottom:8px;font-size:10px;">
        Adding plan for <b>${tomorrow}</b> (tomorrow). It will appear in the dashboard's
        <b>Next Day Plan</b> column.
      </div>
      <div class="fr">
        <div class="fg">
          <label class="fl">Location</label>
          <select class="fs" id="ndp-loc">${locOpts}</select>
        </div>
        <div class="fg">
          <label class="fl">Activity</label>
          <input class="fi" id="ndp-act" placeholder="e.g. Pile Drilling / Foundation Casting" required>
        </div>
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Target Qty</label><input class="fi" id="ndp-qty" type="number" min="0" step="any" placeholder="e.g. 100" required></div>
        <div class="fg"><label class="fl">Manpower</label><input class="fi" id="ndp-mp" type="number" min="0" placeholder="Workers"></div>
      </div>
      <div class="fr">
        <div class="fg"><label class="fl">Contractor</label><input class="fi" id="ndp-con" placeholder="Contractor / Agency"></div>
        <div class="fg"><label class="fl">Notes</label><input class="fi" id="ndp-nt" placeholder="Optional notes"></div>
      </div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn ${btnClass}" style="flex:1;">➜ Add Next Day Plan</button>
      </div>
    </form>`;
  ov('pov');
}

async function submitNdp(e, mod){
  e.preventDefault();
  if (!auth.canEdit()){ showToast('🔒 Login required','er'); return false; }
  const loc = document.getElementById('ndp-loc')?.value || '';
  const act = document.getElementById('ndp-act')?.value?.trim() || '';
  const qty = +(document.getElementById('ndp-qty')?.value || 0);
  const mp  = +(document.getElementById('ndp-mp')?.value || 0);
  const con = document.getElementById('ndp-con')?.value || '';
  const nt  = document.getElementById('ndp-nt')?.value || '';
  const actLabel = [loc, act].filter(Boolean).join(' › ');
  try {
    await dataApi.addNextDayPlan({
      module: mod, activity: actLabel, qty, mp, contractor: con, notes: nt
    });
    cov('pov');
    showToast('✅ Next-day plan added: ' + actLabel, 'ok');
  } catch(err){
    showToast('❌ ' + (err.message || 'Save failed'), 'er');
  }
  return false;
}

async function deleteNdpItem(forDate, id, mod){
  if (!auth.canEdit()){ showToast('🔒 Login required','er'); return; }
  if (!confirm('Delete this next-day plan item?')) return;
  try {
    await dataApi.deleteNextDayPlan(forDate, id);
    showToast('🗑 Deleted','ok');
  } catch(err){
    showToast('❌ ' + (err.message || 'Delete failed'), 'er');
  }
}

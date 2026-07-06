/* ══════════════════════════════════════════════════════════════
   ADVANCED FEATURES ENGINE  ·  SWPPL EPC Dashboard  ·  v16
   Fully integrated: Search · Tooltip · Theme · Gantt · Drilldown
   Filter · Export · Calendar · Leaderboard · Image Upload · Routing
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ═══════════════════════════════════════════════════════════
//  1. THEME TOGGLE (Dark ↔ Light)
// ═══════════════════════════════════════════════════════════
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme');
  const next=cur==='light'?null:'light';
  if(next)document.documentElement.setAttribute('data-theme','light');
  else document.documentElement.removeAttribute('data-theme');
  const lbl=document.getElementById('adv-theme-lbl');
  const orb=document.getElementById('adv-theme-orb');
  if(lbl)lbl.textContent=next?'Light':'Dark';
  if(orb)orb.textContent=next?'☀️':'🌙';
  const sbIcon=document.getElementById('th-i');           // sidebar Theme item (bug fix #5:
  if(sbIcon)sbIcon.textContent=next?'☀️':'🌙';       // it previously never flipped)
  try{localStorage.setItem('swppl_theme',next||'dark');}catch(e){}
}
function applyStoredTheme(){
  try{
    const t=localStorage.getItem('swppl_theme');
    if(t==='light')document.documentElement.setAttribute('data-theme','light');
  }catch(e){}
}
applyStoredTheme();

// ═══════════════════════════════════════════════════════════
//  2. TOOLTIP ENGINE
// ═══════════════════════════════════════════════════════════
const _tt=(()=>{
  const el=document.createElement('div');
  el.id='adv-tt';document.body.appendChild(el);return el;
})();
let _ttTimer=null;
document.addEventListener('mouseover',e=>{
  const t=e.target.closest('[data-tt]');if(!t)return;
  clearTimeout(_ttTimer);
  _ttTimer=setTimeout(()=>{
    _tt.innerHTML=t.getAttribute('data-tt');
    _tt.classList.add('visible');
  },380);
});
document.addEventListener('mousemove',e=>{
  _tt.style.left=Math.min(e.clientX+14,window.innerWidth-250)+'px';
  _tt.style.top=Math.max(e.clientY-32,8)+'px';
});
document.addEventListener('mouseout',e=>{
  if(!e.target.closest('[data-tt]'))return;
  clearTimeout(_ttTimer);_tt.classList.remove('visible');
});

// ═══════════════════════════════════════════════════════════
//  3. GLOBAL SEARCH  (Ctrl+K / Cmd+K)
// ═══════════════════════════════════════════════════════════
const _idx=[];
function _buildIdx(){
  _idx.length=0;
  // WTG turbines
  try{DB.wtg.turbines.forEach(t=>{
    _idx.push({k:t.id+' '+t.status+' '+(t.notes||''),label:t.id,
      sub:`WTG · ${t.status.toUpperCase()} · ${calcTurbProg(t)}%`,icon:'⚡',cb:()=>nav('wtg')});
  });}catch(e){}
  // Solar ITCs
  try{Object.entries(DB.solar.itcs).forEach(([id,d])=>{
    _idx.push({k:id+' solar itc '+d.mw,label:id,sub:`Solar · ${d.mw}MW · ${calcITCProg(id)}%`,icon:'☀️',cb:()=>openITC(id)});
    d.acts.forEach(a=>_idx.push({k:a.n+' '+id,label:a.n,sub:`${id} activity · ${a.done}%`,icon:'🔧',cb:()=>openITC(id)}));
  });}catch(e){}
  // BOP
  [['33kV Lines','33kv','🔋'],['66kV Towers','66kv','🔌'],['PSS','pss','🏭'],['GSS','gss','⚡']].forEach(([l,k,i])=>{
    _idx.push({k:l.toLowerCase()+' bop',label:l,sub:'BOP Section',icon:i,cb:()=>{nav('bop');setTimeout(()=>rndrBopSec(k),80);}});
  });
  // Milestones
  try{DB.milestones.forEach(m=>{const lab=m.title||m.label||'';if(lab)_idx.push({k:lab.toLowerCase()+' milestone',label:lab,sub:'Milestone · '+(m.date||''),icon:'📅',cb:()=>nav('home')});});}catch(e){}
  // HSE observations
  try{HSE_DB.observations.forEach(o=>_idx.push({k:o.loc+' '+o.obs+' hse',label:o.loc+': '+o.obs.substr(0,30),sub:'HSE · '+o.risk,icon:'⚠️',cb:()=>nav('safety')}));}catch(e){}
  // Employees
  try{HSE_DB.employees.forEach(e=>_idx.push({k:e.code+' '+e.name,label:e.code+' · '+e.name,sub:'Employee · Score:'+e.score,icon:'👤',cb:()=>nav('safety')}));}catch(e){}
  // Sections
  [['Dashboard','home','🏠'],['Solar','solar','☀️'],['WTG','wtg','⚡'],['BOP','bop','⚙️'],['Land','land','🌍'],['HSE / Safety','safety','🦺'],['POD','pod','📋'],['Site Map','map','🗺️'],['Manpower','manpower','👷']].forEach(([l,k,i])=>{
    _idx.push({k:l.toLowerCase(),label:l,sub:'Navigate to section',icon:i,cb:()=>nav(k)});
  });
}

let _srchHighlight=0;
function openSearch(){
  _buildIdx();
  let bar=document.getElementById('adv-search');
  if(!bar){
    bar=document.createElement('div');bar.id='adv-search';
    bar.innerHTML=`<div class="srch-box" onclick="event.stopPropagation()">
      <div style="display:flex;align-items:center;gap:8px;padding-right:14px;">
        <span style="padding:14px 16px;font-size:18px;color:var(--t3);">🔍</span>
        <input id="adv-srch-inp" class="srch-inp" placeholder="Search turbines, activities, sections…" autocomplete="off">
        <kbd class="srch-kbd" style="margin-left:0;">ESC</kbd>
      </div>
      <div id="adv-srch-res" class="srch-results"></div>
    </div>`;
    bar.addEventListener('click',closeSearch);
    document.body.appendChild(bar);
  }
  bar.classList.add('open');
  const inp=document.getElementById('adv-srch-inp');
  if(inp){
    inp.value='';inp.focus();
    inp.oninput=()=>{_srchHighlight=0;_renderSearch(inp.value);};
    inp.onkeydown=e=>{
      const items=document.querySelectorAll('.srch-item');
      if(e.key==='ArrowDown'){e.preventDefault();_srchHighlight=Math.min(_srchHighlight+1,items.length-1);items.forEach((x,i)=>x.classList.toggle('highlighted',i===_srchHighlight));}
      else if(e.key==='ArrowUp'){e.preventDefault();_srchHighlight=Math.max(_srchHighlight-1,0);items.forEach((x,i)=>x.classList.toggle('highlighted',i===_srchHighlight));}
      else if(e.key==='Enter'&&items[_srchHighlight]){items[_srchHighlight].click();}
      else if(e.key==='Escape')closeSearch();
    };
  }
  _renderSearch('');
}
function closeSearch(){
  const bar=document.getElementById('adv-search');
  if(bar)bar.classList.remove('open');
}
function _renderSearch(q){
  const el=document.getElementById('adv-srch-res');if(!el)return;
  if(!q.trim()){
    el.innerHTML=`<div class="srch-cat">Quick Navigation</div>`+
      [['Dashboard','home','🏠'],['WTG','wtg','⚡'],['Solar','solar','☀️'],['BOP','bop','⚙️'],['HSE','safety','🦺'],['Site Map','map','🗺️'],['POD','pod','📋'],['Manpower','manpower','👷']].map(([l,k,i])=>
        `<div class="srch-item" onclick="closeSearch();nav('${k}')"><span class="srch-item-icon">${i}</span><div><div class="srch-item-main">${l}</div></div></div>`).join('');
    return;
  }
  const q2=q.toLowerCase();
  const hits=_idx.filter(x=>x.k.toLowerCase().includes(q2)).slice(0,14);
  if(!hits.length){el.innerHTML=`<div class="srch-empty">No results for "<b>${q}</b>"</div>`;return;}
  el.innerHTML=hits.map((h,i)=>`<div class="srch-item${i===0?' highlighted':''}" onclick="closeSearch();(${h.cb.toString()})()">
    <span class="srch-item-icon">${h.icon}</span>
    <div style="min-width:0;flex:1;">
      <div class="srch-item-main">${h.label}</div>
      <div class="srch-item-sub">${h.sub}</div>
    </div>
  </div>`).join('');
}
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openSearch();}
  if(e.key==='Escape'&&document.getElementById('adv-search')?.classList.contains('open'))closeSearch();
});

// ═══════════════════════════════════════════════════════════
//  4. STICKY SECTION NAV
// ═══════════════════════════════════════════════════════════
function injectSecNav(viewId,sections){
  setTimeout(()=>{
    const view=document.getElementById(viewId);if(!view||!view.classList.contains('on'))return;
    // remove stale
    view.querySelector('.adv-sec-nav')?.remove();
    const nav=document.createElement('div');nav.className='adv-sec-nav';
    nav.innerHTML=sections.map((s,i)=>
      `<div class="sni${i===0?' act':''}" onclick="sniClick(this,'${s.id}',event)" data-tt="${s.label}">${s.icon} ${s.label}</div>`
    ).join('');
    // insert after first .bk element or at top
    const bk=view.querySelector('.bk');
    if(bk)bk.after(nav);else view.prepend(nav);
  },60);
}
function sniClick(el,id,ev){
  ev?.stopPropagation();
  el.closest('.adv-sec-nav').querySelectorAll('.sni').forEach(x=>x.classList.remove('act'));
  el.classList.add('act');
  const target=document.getElementById(id);
  if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
}

// ═══════════════════════════════════════════════════════════
//  5. FILTER TOOLBAR
// ═══════════════════════════════════════════════════════════
const _f={};
function buildFilterBar(containerId,{sections=[],statuses=['Done','WIP','Pending'],onFilter}={}){
  const el=document.getElementById(containerId);if(!el)return;
  const fb=document.createElement('div');fb.className='flt-bar';
  fb.innerHTML=`
    <span class="flt-lbl">Filter:</span>
    <select class="flt-sel" id="flt-sec-${containerId}" data-tt="Filter by section">
      <option value="">All Sections</option>${sections.map(s=>`<option>${s}</option>`).join('')}
    </select>
    <span class="flt-lbl">Status:</span>
    <select class="flt-sel" id="flt-st-${containerId}" data-tt="Filter by status">
      <option value="">All Statuses</option>${statuses.map(s=>`<option>${s}</option>`).join('')}
    </select>
    <span class="flt-lbl">From:</span>
    <input type="date" class="flt-date" id="flt-fr-${containerId}" data-tt="Start date">
    <span class="flt-lbl">To:</span>
    <input type="date" class="flt-date" id="flt-to-${containerId}" data-tt="End date">
    <button class="flt-clr" onclick="_clearFilter('${containerId}',${onFilter?JSON.stringify(onFilter.toString()):null})">✕ Clear</button>`;
  fb.addEventListener('change',()=>{
    _f.sec=document.getElementById('flt-sec-'+containerId)?.value||'';
    _f.st=document.getElementById('flt-st-'+containerId)?.value||'';
    _f.fr=document.getElementById('flt-fr-'+containerId)?.value||'';
    _f.to=document.getElementById('flt-to-'+containerId)?.value||'';
    if(typeof onFilter==='function')onFilter(_f);
  });
  el.prepend(fb);
}
function _clearFilter(cid){
  ['flt-sec-','flt-st-','flt-fr-','flt-to-'].forEach(p=>{const x=document.getElementById(p+cid);if(x)x.value='';});
  Object.keys(_f).forEach(k=>_f[k]='');
}

// ═══════════════════════════════════════════════════════════
//  6. EXPORT  (PDF + CSV/Excel)
// ═══════════════════════════════════════════════════════════
function exportToPDF(title='SWPPL EPC Dashboard'){
  showToast('Preparing PDF…','ok');
  setTimeout(()=>{const p=document.title;document.title=title;window.print();document.title=p;},350);
}
function exportToCSV(title='dashboard'){
  const rows=[];
  document.querySelectorAll('.tbl').forEach((tbl,ti)=>{
    if(ti>0)rows.push(['']);
    tbl.querySelectorAll('tr').forEach(tr=>{
      rows.push(Array.from(tr.cells).map(td=>'"'+td.innerText.replace(/"/g,'""')+'"'));
    });
  });
  if(!rows.length){showToast('No table data to export','wn');return;}
  const csv=rows.map(r=>r.join(',')).join('\n');
  const b=new Blob([csv],{type:'text/csv'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(b),download:title.replace(/\s+/g,'_')+'.csv'});
  a.click();URL.revokeObjectURL(a.href);
  showToast('Exported: '+title+'.csv','ok');
}
function exportExcel(){exportToCSV('SWPPL_EPC_Dashboard');}
function injectExportBar(containerId,title){
  const el=document.getElementById(containerId);if(!el||el.querySelector('.exp-bar'))return;
  const bar=document.createElement('div');bar.className='exp-bar';
  bar.innerHTML=`
    <button class="btn btn-pdf bts" onclick="exportToPDF('${title}')" data-tt="Export this page as PDF (Ctrl+P)">📄 PDF</button>
    <button class="btn btn-csv bts" onclick="exportToCSV('${title}')" data-tt="Export all table data as CSV">📊 Excel/CSV</button>
    <button class="btn bts" onclick="openSearch()" data-tt="Search dashboard (Ctrl + K)">🔍 Search <kbd style='font-size:7px;background:var(--b1);padding:1px 4px;border-radius:3px;margin-left:2px;'>Ctrl+K</kbd></button>`;
  el.prepend(bar);
}

// ═══════════════════════════════════════════════════════════
//  7. DRILLDOWN MODAL
// ═══════════════════════════════════════════════════════════
function _ensureDd(){
  if(document.getElementById('adv-dd'))return;
  const el=document.createElement('div');el.id='adv-dd';
  el.innerHTML=`<div class="dd-box" onclick="event.stopPropagation()">
    <div class="dd-head">
      <div class="dd-title" id="dd-title"></div>
      <button class="dd-close" onclick="closeDrilldown()">✕</button>
    </div>
    <div class="dd-body" id="dd-body"></div>
  </div>`;
  el.addEventListener('click',closeDrilldown);
  document.body.appendChild(el);
}
function openDrilldown(title,html){
  _ensureDd();
  document.getElementById('dd-title').textContent=title;
  document.getElementById('dd-body').innerHTML=html;
  document.getElementById('adv-dd').classList.add('open');
}
function closeDrilldown(){document.getElementById('adv-dd')?.classList.remove('open');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDrilldown();});

// ═══════════════════════════════════════════════════════════
//  8. KPI TREND INDICATORS
// ═══════════════════════════════════════════════════════════
function addKpiTrend(el,cur,prev){
  if(!el)return;
  const diff=+(cur-prev).toFixed(1);
  const cls=diff>0?'delta-up':diff<0?'delta-dn':'delta-nc';
  const arrow=diff>0?'▲':diff<0?'▼':'—';
  let d=el.querySelector('.kpi-delta');
  if(!d){d=document.createElement('div');d.className='kpi-delta';el.appendChild(d);}
  d.className=`kpi-delta ${cls}`;
  d.innerHTML=`<span>${arrow}</span><span>${Math.abs(diff)}%</span><span style="font-size:8px;opacity:.7;margin-left:2px;">vs last</span>`;
}

// ═══════════════════════════════════════════════════════════
//  9. GANTT CHART — Real-date based, editable by Site Manager
//
//  Per requirement: Gantt should use REAL DATES and reflect actual
//  progress, not random data. Site Manager (role 'all'/'admin') can
//  edit activities; updates dynamically reflect in the chart.
//  Data is persisted in DB.ganttRows and survives reloads.
// ═══════════════════════════════════════════════════════════
const _GANTT_MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Generate the Gantt month columns dynamically from the project window.
// No hardcoded years anywhere — the chart always spans the right period
// even if the project schedule shifts.
const GANTT_PROJECT_START = new Date(2026, 0, 1);   // 1 Jan 2026
const GANTT_PROJECT_END   = new Date(2027, 4, 1);   // 1 May 2027
const GANTT_MONTHS = (() => {
  const out = []; const c = new Date(GANTT_PROJECT_START);
  while (c <= GANTT_PROJECT_END) {
    out.push(_GANTT_MONTH_NAMES[c.getMonth()] + ' ' + (c.getFullYear() % 100));
    c.setMonth(c.getMonth() + 1);
  }
  return out;
})();

// Default activity definitions with REAL ISO DATES (YYYY-MM-DD).
// These map to project DPR baseline. Site Manager can edit via the editor.
const GANTT_DEFAULTS=[
  {l:'Land Acquisition',   ps:'2026-01-01',pe:'2026-05-01', as:'2026-01-01',ae:'2026-05-31', c:'var(--land)'},
  {l:'WTG Civil Works',    ps:'2026-02-01',pe:'2026-08-01', as:'2026-02-01',ae:'2026-08-31', c:'var(--wtg)'},
  {l:'WTG T1 Erection',    ps:'2026-04-01',pe:'2026-05-01', as:'2026-04-07',ae:'2026-04-29', c:'#7c4dff'},
  {l:'WTG Bulk Erection',  ps:'2026-06-01',pe:'2026-12-01', as:'2026-07-01',ae:'2027-01-31', c:'var(--wtg)'},
  {l:'Solar Piling',       ps:'2026-01-01',pe:'2026-05-01', as:'2026-01-01',ae:'2026-05-31', c:'var(--sol)'},
  {l:'Solar MMS & Module', ps:'2026-05-01',pe:'2026-09-01', as:'2026-05-09',ae:'2026-10-31', c:'#ff8800'},
  {l:'DC Cable Works',     ps:'2026-05-01',pe:'2026-10-01', as:'2026-05-01',ae:'2026-11-30', c:'#00acc1'},
  {l:'33kV Line F1',       ps:'2026-02-01',pe:'2026-08-01', as:'2026-02-01',ae:'2026-09-30', c:'var(--kv3)'},
  {l:'66kV EHV Line',      ps:'2026-01-01',pe:'2026-07-01', as:'2026-01-01',ae:'2026-07-31', c:'var(--kv6)'},
  {l:'PSS Civil',          ps:'2026-01-01',pe:'2026-05-01', as:'2026-01-01',ae:'2026-05-15', c:'var(--pss)'},
  {l:'PSS Equipment',      ps:'2026-04-01',pe:'2026-08-01', as:'2026-04-01',ae:'2026-09-30', c:'#00bcd4'},
  {l:'GSS 66kV Bay',       ps:'2026-02-01',pe:'2026-06-01', as:'2026-02-01',ae:'2026-06-30', c:'var(--gss)'},
  {l:'Commissioning',      ps:'2026-11-01',pe:'2027-03-01', as:'2026-12-01',ae:'2027-04-30', c:'var(--ok)'},
  {l:'HOTO',               ps:'2027-03-01',pe:'2027-05-31', as:'2027-03-01',ae:'2027-06-30', c:'var(--er)'},
];

// GANTT_ROWS is rebuilt from DB.ganttRows every render.
let GANTT_ROWS = [];

function _parseISO(s){const d=new Date(s);return isNaN(d)?null:d;}
function _isoToMonthIdx(iso, months){
  // Convert YYYY-MM-DD into a fractional index within `months`
  const d=_parseISO(iso); if(!d)return 0;
  const mi=d.getMonth();
  const yr=d.getFullYear()%100;
  const target=`${_GANTT_MONTH_NAMES[mi]} ${yr}`;
  const idx=months.indexOf(target);
  if(idx<0){
    const first=months[0]; const last=months[months.length-1];
    const [fmon,fyr]=first.split(' '); const [lmon,lyr]=last.split(' ');
    const firstD=new Date(2000+(+fyr), _GANTT_MONTH_NAMES.indexOf(fmon),1);
    const lastD =new Date(2000+(+lyr), _GANTT_MONTH_NAMES.indexOf(lmon),28);
    return d<firstD?0:months.length;
  }
  const dayFrac = (d.getDate()-1)/30;
  return idx + Math.min(0.99, dayFrac);
}

function _ensureGanttRows(){
  if(typeof DB==='undefined')return;
  if(!Array.isArray(DB.ganttRows) || DB.ganttRows.length===0){
    DB.ganttRows = GANTT_DEFAULTS.map(r=>({...r}));
  }
  GANTT_ROWS = DB.ganttRows.map((r,i)=>({
    l:r.l, c:r.c,
    ps:_isoToMonthIdx(r.ps, GANTT_MONTHS),
    pe:_isoToMonthIdx(r.pe, GANTT_MONTHS),
    as:_isoToMonthIdx(r.as, GANTT_MONTHS),
    ae:_isoToMonthIdx(r.ae, GANTT_MONTHS),
    _ps:r.ps, _pe:r.pe, _as:r.as, _ae:r.ae,
    _idx:i,
  }));
}

function renderGantt(containerId,rows,months){
  _ensureGanttRows();
  rows=rows||GANTT_ROWS; months=months||GANTT_MONTHS;
  const el=document.getElementById(containerId);if(!el)return;
  const n=months.length;
  const now=new Date();
  const todayIdx=months.findIndex(m=>{
    const [mon,yr]=m.split(' ');
    const y=yr?parseInt('20'+yr):2026;
    const mi=_GANTT_MONTH_NAMES.indexOf(mon);
    return mi===now.getMonth()&&y===now.getFullYear();
  });
  const tIdx=todayIdx>=0?todayIdx:4;
  const tDayFrac=(now.getDate()-1)/30;
  const tFrac=tIdx+tDayFrac;
  const fmtDate=iso=>iso?new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'2-digit'}):'—';

  el.innerHTML=`<div class="gantt-wrap">
    <div class="gantt-inner">
      <div class="gantt-hrow">
        <div class="gantt-hlabel">Activity</div>
        <div class="gantt-hcols">${months.map((m,i)=>`<div class="gantt-hcell" style="${i===tIdx?'color:var(--er);font-weight:700;':''}">${m}${i===tIdx?' ▲':''}</div>`).join('')}</div>
      </div>
      ${rows.map((r,ri)=>{
        const pL=r.ps/n*100, pW=Math.max(0,(r.pe-r.ps)/n*100);
        const aL=r.as/n*100, aW=Math.max(0,(r.ae-r.as)/n*100);
        const late=r.ae>r.pe&&r.ae>0;
        const tip=`${r.l}: Planned ${fmtDate(r._ps)} → ${fmtDate(r._pe)} | Actual ${fmtDate(r._as)} → ${fmtDate(r._ae)}${late?' ⚠ DELAYED':''}`;
        return`<div class="gantt-row">
          <div class="gantt-rlabel" data-tt="${tip}">${r.l}</div>
          <div class="gantt-track">
            <div class="gantt-today" style="left:${tFrac/n*100}%" data-tt="Today (${now.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})})"></div>
            ${pW>0?`<div class="gantt-bar gantt-plan" style="left:${pL}%;width:${pW}%;background:${r.c}" data-tt="Planned: ${fmtDate(r._ps)} → ${fmtDate(r._pe)}">${r.l.substr(0,10)}</div>`:''}
            ${aW>0?`<div class="gantt-bar gantt-actual ${late?'gantt-late':''}" style="left:${aL}%;width:${aW}%;background:${r.c}" data-tt="${tip}" onclick="ganttRowClick(${ri})">${r.l.substr(0,10)}${late?' ⚠':''}</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;padding:8px 10px;font-size:9px;border-top:1px solid var(--b1);">
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:4px;border:1px dashed rgba(255,255,255,.4);display:inline-block;opacity:.5;background:var(--ac);border-radius:2px;"></span>Planned</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:8px;display:inline-block;background:var(--ok);border-radius:2px;opacity:.9;"></span>Actual</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:8px;display:inline-block;background:var(--er);border-radius:2px;opacity:.9;"></span>Delayed</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:2px;height:12px;background:var(--er);display:inline-block;opacity:.75;"></span>Today (${now.toLocaleDateString('en-IN',{day:'2-digit',month:'short'})})</span>
  </div>`;
}
function ganttRowClick(idx){
  _ensureGanttRows();
  const r=GANTT_ROWS[idx]; if(!r)return;
  const fmtDate=iso=>iso?new Date(iso).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}):'—';
  const pe=_parseISO(r._pe), ae=_parseISO(r._ae);
  const delayDays=(pe&&ae)?Math.ceil((ae-pe)/86400000):0;
  openDrilldown(r.l+' — Timeline Detail',`
    <div class="g2" style="margin-bottom:14px;">
      <div class="pnl"><div class="kl">Planned Start</div><div class="kv" style="color:var(--ac);font-size:16px;">${fmtDate(r._ps)}</div></div>
      <div class="pnl"><div class="kl">Planned End</div><div class="kv" style="color:var(--ac);font-size:16px;">${fmtDate(r._pe)}</div></div>
      <div class="pnl"><div class="kl">Actual Start</div><div class="kv" style="color:var(--ok);font-size:16px;">${fmtDate(r._as)}</div></div>
      <div class="pnl"><div class="kl">Actual End</div><div class="kv" style="color:${delayDays>0?'var(--er)':'var(--ok)'};font-size:16px;">${fmtDate(r._ae)}</div></div>
    </div>
    <div class="al ${delayDays>0?'al-d':'al-s'}" style="margin-bottom:8px;">
      ${delayDays>0?`⚠️ <b>DELAYED</b> by ${delayDays} day${delayDays>1?'s':''}`:'✅ On Schedule or Ahead'}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;">
      <button class="btn" style="flex:1;" onclick="closeDrilldown()">Close</button>
      <button class="btn btsol" style="flex:1;" onclick="closeDrilldown();reqLogin('all',()=>openGanttEditor(${r._idx}))" data-tt="Site Manager only">✏️ Edit Activity (Site Manager)</button>
    </div>`);
}

// ═══════════════════════════════════════════════════════════
//  GANTT EDITOR — Site Manager only (role 'all' / 'admin')
//  Allows editing planned & actual start/end dates per activity.
//  Updates dynamically reflect in the Project Gantt chart.
// ═══════════════════════════════════════════════════════════
function openGanttEditor(focusIdx){
  _ensureGanttRows();
  document.getElementById('p-t').textContent='✏️ Edit Project Gantt — Site Manager';
  const rows=DB.ganttRows||[];
  const fmt=iso=>iso||'';
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">⚠️ Site Manager only. Updates reflect immediately in the Gantt chart. All dates use real ISO format.</div>
    <div style="max-height:60vh;overflow-y:auto;border:1px solid var(--b1);border-radius:8px;">
      <table class="tbl" style="font-size:9px;width:100%;">
        <thead>
          <tr>
            <th style="text-align:left;width:24%;">Activity</th>
            <th style="width:18%;">Planned Start</th>
            <th style="width:18%;">Planned End</th>
            <th style="width:18%;">Actual Start</th>
            <th style="width:18%;">Actual End</th>
            <th style="width:4%;"></th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r,i)=>`<tr ${focusIdx===i?'style="background:rgba(0,200,255,.06);"':''}>
            <td>
              <input id="ge-l-${i}" class="fi" style="font-size:9px;padding:3px 6px;width:100%;" value="${r.l||''}" placeholder="Activity name">
            </td>
            <td><input id="ge-ps-${i}" class="fi" type="date" style="font-size:9px;padding:3px 6px;width:100%;" value="${fmt(r.ps)}"></td>
            <td><input id="ge-pe-${i}" class="fi" type="date" style="font-size:9px;padding:3px 6px;width:100%;" value="${fmt(r.pe)}"></td>
            <td><input id="ge-as-${i}" class="fi" type="date" style="font-size:9px;padding:3px 6px;width:100%;" value="${fmt(r.as)}"></td>
            <td><input id="ge-ae-${i}" class="fi" type="date" style="font-size:9px;padding:3px 6px;width:100%;" value="${fmt(r.ae)}"></td>
            <td><button class="btn" style="background:var(--er);color:#fff;border:none;padding:3px 6px;font-size:8px;" onclick="ganttRowDelete(${i})" data-tt="Delete this row">✕</button></td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div style="display:flex;gap:7px;margin-top:9px;flex-wrap:wrap;">
      <button class="btn bts" onclick="ganttRowAdd()">+ Add Activity</button>
      <button class="btn bts" onclick="ganttResetDefaults()" data-tt="Restore default activities">↻ Reset to Defaults</button>
      <div style="flex:1;"></div>
      <button class="btn" onclick="cov('pov')">Cancel</button>
      <button class="btn btsol" onclick="ganttSaveAll()">✅ Save &amp; Reflect</button>
    </div>`;
  ov('pov');
  if(focusIdx!=null){
    setTimeout(()=>{
      const f=document.getElementById('ge-l-'+focusIdx);
      if(f)f.focus();
    },80);
  }
}
function ganttRowAdd(){
  if(!Array.isArray(DB.ganttRows))DB.ganttRows=[];
  const today=new Date().toISOString().slice(0,10);
  const future=new Date(Date.now()+90*86400000).toISOString().slice(0,10);
  DB.ganttRows.push({l:'New Activity', ps:today, pe:future, as:today, ae:future, c:'var(--ac)'});
  openGanttEditor(DB.ganttRows.length-1);
}
function ganttRowDelete(i){
  if(!confirm('Delete this Gantt activity?'))return;
  DB.ganttRows.splice(i,1);
  openGanttEditor();
}
function ganttResetDefaults(){
  if(!confirm('Reset all activities to default project baseline?'))return;
  DB.ganttRows = GANTT_DEFAULTS.map(r=>({...r}));
  openGanttEditor();
}
async function ganttSaveAll(){
  if(!Array.isArray(DB.ganttRows))DB.ganttRows=[];
  DB.ganttRows.forEach((r,i)=>{
    const l=document.getElementById('ge-l-'+i)?.value?.trim();
    const ps=document.getElementById('ge-ps-'+i)?.value;
    const pe=document.getElementById('ge-pe-'+i)?.value;
    const as=document.getElementById('ge-as-'+i)?.value;
    const ae=document.getElementById('ge-ae-'+i)?.value;
    if(l)r.l=l;
    if(ps)r.ps=ps;
    if(pe)r.pe=pe;
    if(as)r.as=as;
    if(ae)r.ae=ae;
  });
  // Push to Firebase via dataApi (admin-only, audit-logged, real-time)
  if (typeof dataApi !== 'undefined' && dataApi.setGanttRows) {
    try {
      await dataApi.setGanttRows(DB.ganttRows);
      cov('pov');
      showToast('✅ Gantt saved & synced','ok');
    } catch (err) {
      showToast('❌ '+(err.message||'Save failed — Site Manager only'),'er');
      return;
    }
  } else {
    cov('pov');
    showToast('Gantt updated (offline)','wn');
  }
  if(typeof renderGantt==='function'){renderGantt('home-gantt');}
}

// ═══════════════════════════════════════════════════════════
//  10. SAFETY CALENDAR
// ═══════════════════════════════════════════════════════════
function renderSafetyCalendar(containerId,month,year){
  const el=document.getElementById(containerId);if(!el)return;
  const days=new Date(year,month,0).getDate();
  const firstDay=new Date(year,month-1,1).getDay();
  const today=new Date();
  const obs=typeof HSE_DB!=='undefined'?HSE_DB.observations:[];
  const names=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  el.innerHTML=`<div class="safe-cal">
    ${names.map(d=>`<div class="safe-cal-hdr">${d}</div>`).join('')}
    ${Array(firstDay).fill('<div></div>').join('')}
    ${Array.from({length:days},(_,i)=>{
      const d=i+1;
      const dayStr=(d<10?'0'+d:d)+'';
      const dayObs=obs.filter(o=>o.raisedDate&&o.raisedDate.replace(/-/g,'/').includes(dayStr));
      const isToday=d===today.getDate()&&month-1===today.getMonth()&&year===today.getFullYear();
      const isFuture=new Date(year,month-1,d)>today;
      const cls=isFuture?'cal-future':dayObs.length===0?'cal-safe':dayObs.some(o=>o.status==='Open')?'cal-obs-open':'cal-obs-closed';
      const tip=dayObs.length?dayObs.length+' obs: '+dayObs.map(o=>o.loc).join(', '):`Day ${d} — Safe`;
      return`<div class="cal-cell ${cls}${isToday?' cal-today':''}" data-tt="${tip}" onclick="calDayClick(${d},${month},${year})">${d}</div>`;
    }).join('')}
  </div>
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;">
    ${[['cal-safe','#2e7d32','Safe'],['cal-obs-closed','#f9a825','Obs (Closed)'],['cal-obs-open','#c62828','Obs (Open)'],['cal-future','var(--card2)','Future']].map(([cls,c,l])=>
      `<span style="display:flex;align-items:center;gap:3px;font-size:7px;color:var(--t3);"><span class="cal-cell ${cls}" style="width:10px;height:10px;border-radius:3px;aspect-ratio:unset;flex-shrink:0;cursor:default;display:inline-flex;"></span>${l}</span>`).join('')}
  </div>`;
}
function calDayClick(d,m,y){
  const obs=typeof HSE_DB!=='undefined'?HSE_DB.observations:[];
  const ds=String(d<10?'0'+d:d);
  const dayObs=obs.filter(o=>o.raisedDate&&o.raisedDate.replace(/-/g,'/').includes(ds));
  if(!dayObs.length){showToast(`${d}/${m}/${y}: No observations recorded`,'ok');return;}
  openDrilldown(`HSE Observations — ${d}/${m}/${y}`,
    dayObs.map(o=>`<div class="pnl" style="margin-bottom:8px;">
      <div style="font-weight:700;margin-bottom:4px;color:var(--t1);">${esc(o.loc)} — ${esc(o.obs)}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:9px;">
        <span>By: <b>${o.raisedBy}</b></span>
        <span>Risk: <b>${o.risk}</b></span>
        <span>Status: <span class="chip ${o.status==='Closed'?'cg':'cy'}">${o.status}</span></span>
        ${o.vendor?`<span>Vendor: <b>${esc(o.vendor)}</b></span>`:''}
      </div>
    </div>`).join(''));
}

// ═══════════════════════════════════════════════════════════
//  11. LEADERBOARD SCORING SYSTEM
// ═══════════════════════════════════════════════════════════
function calcLeaderboardScores(){
  if(typeof HSE_DB==='undefined')return;
  HSE_DB.employees.forEach(e=>{
    const closed=(HSE_DB.observations||[]).filter(o=>o.closedBy===e.name||o.raisedBy===e.name&&o.status==='Closed').length;
    const open=(HSE_DB.observations||[]).filter(o=>o.raisedBy===e.name&&o.status==='Open').length;
    e.computedScore=Math.max(0,Math.min(100,(e.score||50)+closed*4-open*2));
  });
  (HSE_DB.employees||[]).sort((a,b)=>(b.computedScore||b.score)-(a.computedScore||a.score));
}
function renderLeaderboard(containerId){
  const el=document.getElementById(containerId);if(!el)return;
  if(typeof HSE_DB==='undefined')return;
  calcLeaderboardScores();
  const sorted=HSE_DB.employees.slice().sort((a,b)=>(b.computedScore||b.score)-(a.computedScore||a.score));
  el.innerHTML=sorted.map((e,i)=>{
    const sc=e.computedScore||e.score;
    const rankClass=i===0?'rank-gold':i===1?'rank-silver':i===2?'rank-bronze':'';
    const rankIcon=i===0?'🥇':i===1?'🥈':i===2?'🥉':`<span style="font-size:10px;font-weight:700;">${i+1}</span>`;
    return`<div style="display:flex;align-items:center;gap:8px;padding:5px 4px;border-bottom:1px solid var(--b1);" data-tt="${e.code} · Score: ${sc} · ${sc>=80?'Excellent':'Good'}">
      <div style="width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:${i<3?'14px':'11px'};flex-shrink:0;${rankClass?`class="${rankClass}"`:'color:var(--t3);font-weight:700;'}">${rankIcon}</div>
      <div style="width:28px;height:28px;border-radius:50%;background:#1565c0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${esc(e.name.charAt(0).toUpperCase())}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(e.name)}</div>
        <div style="font-size:8px;color:#1565c0;font-weight:600;">${e.code}</div>
      </div>
      <div style="text-align:right;flex-shrink:0;">
        <div style="font-family:var(--f2);font-size:15px;font-weight:700;color:${sc>=80?'var(--ok)':sc>=60?'var(--wn)':'var(--er)'};">${sc}</div>
        <div style="height:3px;width:40px;background:var(--b1);border-radius:2px;margin-top:2px;"><div style="height:100%;width:${sc}%;background:${sc>=80?'var(--ok)':sc>=60?'var(--wn)':'var(--er)'};border-radius:2px;"></div></div>
      </div>
    </div>`;
  }).join('');
}

// ═══════════════════════════════════════════════════════════
//  12. IMAGE UPLOAD WITH PREVIEW
// ═══════════════════════════════════════════════════════════
function buildImgUpload(id,onLoad){
  return`<div class="img-upload-zone" id="iuz-${id}" onclick="document.getElementById('iuf-${id}').click()"
    ondragover="event.preventDefault();this.style.borderColor='var(--ac)'"
    ondragleave="this.style.borderColor=''"
    ondrop="event.preventDefault();this.style.borderColor='';_handleImgDrop(event,'${id}',${onLoad?JSON.stringify(onLoad.toString()):'null'})">
    <input type="file" id="iuf-${id}" accept="image/*" style="display:none;" onchange="_handleImgFile(this,'${id}',${onLoad?JSON.stringify(onLoad.toString()):'null'})">
    <div id="iuprv-${id}" style="font-size:24px;color:var(--t3);">📷</div>
    <div style="font-size:9px;color:var(--t3);margin-top:4px;">Click or drag to upload photo</div>
  </div>`;
}
function _handleImgFile(input,id,cb){
  const f=input.files[0];if(!f)return;
  _readImg(f,id,cb);
}
function _handleImgDrop(ev,id,cb){
  const f=ev.dataTransfer.files[0];if(!f||!f.type.startsWith('image/'))return;
  _readImg(f,id,cb);
}
async function _readImg(file,id,cb){
  // Show local preview immediately for snappy UX
  const localUrl = URL.createObjectURL(file);
  const prv = document.getElementById('iuprv-'+id);
  if(prv) prv.innerHTML = `<img src="${localUrl}" class="img-preview" style="opacity:.6;"><div style="font-size:9px;color:var(--t3);margin-top:4px;">Uploading…</div>`;
  // If signed in, upload to Firebase Storage; the URL is what gets persisted.
  // If not signed in, the preview stays local (no DB write happens anyway).
  try {
    if (typeof storage !== 'undefined' && storage.uploadHseImage && typeof auth !== 'undefined' && auth.current()) {
      const { url } = await storage.uploadHseImage(file);
      if(prv) prv.innerHTML = `<img src="${url}" class="img-preview">`;
      if(typeof cb === 'string') { try { eval('(' + cb + ')')(url); } catch(x){} }
      else if(typeof cb === 'function') cb(url);
      showToast('✅ Image uploaded','ok');
      URL.revokeObjectURL(localUrl);
      return;
    }
  } catch (err) {
    if(prv) prv.innerHTML = `<div style="color:var(--er);font-size:10px;padding:8px;">⚠️ Upload failed: ${err.message||err}</div>`;
    showToast('❌ '+(err.message||'Upload failed'),'er');
    URL.revokeObjectURL(localUrl);
    return;
  }
  // Fallback: not signed in — leave the local preview but don't persist anything.
  if(prv) prv.innerHTML = `<img src="${localUrl}" class="img-preview"><div style="font-size:8px;color:var(--wn);margin-top:3px;">⚠️ Sign in to save permanently</div>`;
  showToast('⚠️ Sign in to save image to cloud','wn');
}

// ═══════════════════════════════════════════════════════════
//  13. ANIMATED MAP ROUTING  (Leaflet helper)
// ═══════════════════════════════════════════════════════════
function drawAnimatedRoute(map,latlngs,color,label,onClick){
  if(!map||!latlngs||!latlngs.length)return null;
  const line=L.polyline(latlngs,{
    color:color||'#00c8ff',weight:3.5,opacity:.88,
    dashArray:'12,8',
  }).addTo(map);
  // CSS animation applied via classname trick
  try{
    const pathEl=line.getElement();
    if(pathEl){pathEl.style.animation='dashFlow 1.4s linear infinite';pathEl.style.strokeDashoffset='0';}
  }catch(e){}
  if(label)line.bindTooltip(label,{permanent:false,sticky:true,className:'leaflet-tooltip'});
  if(onClick)line.on('click',onClick);
  return line;
}
function addTurbineMarker(map,lat,lng,id,status,progress,onHover){
  const cm={ready:'#00e676',casting:'#00c8ff',wip:'#ffca28',row:'#ff5252',pending:'#4a6a8a',delayed:'#ff9800'};
  const col=cm[status]||'#4a6a8a';
  const ic=L.divIcon({className:'',
    html:`<div style="position:relative;width:28px;height:28px;" data-tt="${id} | ${(status||'PENDING').toUpperCase()} | ${progress}%">
      <img src="turbine.png" width="28" height="28" style="filter:drop-shadow(0 0 5px ${col});" onerror="this.outerHTML='<div style=width:28px;height:28px;background:${col};border:2px solid #fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px>⚡</div>'">
      <div style="position:absolute;bottom:-2px;right:-2px;width:9px;height:9px;background:${col};border-radius:50%;border:1.5px solid #fff;"></div>
    </div>`,iconSize:[28,28],iconAnchor:[14,14]});
  const m=L.marker([lat,lng],{icon:ic}).addTo(map);
  m.bindPopup(`<b>${id}</b><br>Status: <b>${(status||'PENDING').toUpperCase()}</b><br>Progress: <b>${progress}%</b>`);
  return m;
}

// ═══════════════════════════════════════════════════════════
//  14. PROJECT GANTT (home dashboard)
// ═══════════════════════════════════════════════════════════
function renderProjectGantt(containerId){
  renderGantt(containerId,GANTT_ROWS,GANTT_MONTHS);
}

// ═══════════════════════════════════════════════════════════
//  15. DYNAMIC CHART REFRESH
// ═══════════════════════════════════════════════════════════
function refreshDashboardCharts(){
  // Update any existing Chart.js canvases without full re-render
  ['ch-sol-cwip','ch-wtg-cwip','ch-bop-prog','ch-land-prog','ch-pva'].forEach(id=>{
    const c=document.getElementById(id);if(!c)return;
    const ch=Chart.getChart(c);if(ch)ch.update('active');
  });
}

// Returns the previous-day baseline [overall, land, solar, wtg, bop] from the
// most recent snapshot dated BEFORE today. Falls back to current values (→ 0
// delta) when no earlier snapshot exists, so the trend never shows fabricated
// movement. Snapshots are stored per-day at /snapshots/{date} and cached in
// global.SNAPSHOTS by the state-bridge.
function _kpiPrevDayBaseline(cur){
  try{
    const snaps = (typeof SNAPSHOTS!=='undefined' && SNAPSHOTS) ? SNAPSHOTS : {};
    const today = (window.dataApi && dataApi.todayISO) ? dataApi.todayISO()
                : new Date().toISOString().slice(0,10);
    const priorDates = Object.keys(snaps).filter(d=>d < today).sort();
    if(!priorDates.length) return cur.slice();   // no history → 0 delta
    const s = snaps[priorDates[priorDates.length-1]];
    if(!s) return cur.slice();
    // map snapshot fields → the KPI card order [overall, land, solar, wtg, bop]
    const solar = s.solar && typeof s.solar.overall==='number' ? s.solar.overall : cur[2];
    const wtg   = s.wtg   && typeof s.wtg.overall  ==='number' ? s.wtg.overall   : cur[3];
    const bop   = s.bop   && typeof s.bop.overall  ==='number' ? s.bop.overall   : cur[4];
    // overall = MW-weighted Solar+WTG (matches the card's own formula)
    const overall = Math.round((solar*70.4 + wtg*70.2)/(70.4+70.2));
    const land  = (s.land && typeof s.land.overall==='number') ? s.land.overall : cur[1];
    return [overall, land, solar, wtg, bop];
  }catch(e){ return cur.slice(); }
}

// ═══════════════════════════════════════════════════════════
//  16. INIT & HOME INTEGRATION
// ═══════════════════════════════════════════════════════════
function initHomeAdvanced(){
  // Gantt chart
  setTimeout(()=>{if(typeof renderProjectGantt==='function')renderProjectGantt('home-gantt');},180);
  // KPI trend arrows — real day-over-day change vs the most recent PRIOR
  // day's snapshot (global.SNAPSHOTS is kept live by state-bridge). If no
  // prior snapshot exists yet, the delta shows 0 (no fabricated movement).
  setTimeout(()=>{
    try{
      const cards=document.querySelectorAll('.sq-kpi');
      const cur=[calcOverall(),calcLandProg(),calcSolarProg(),calcWtgProg(),calcBopProg()];
      const prev=_kpiPrevDayBaseline(cur);
      cards.forEach((el,i)=>{if(i<cur.length&&typeof addKpiTrend==='function')addKpiTrend(el,cur[i],prev[i]);});
    }catch(e){}
  },250);
  // Export bar on home
  injectExportBar('view-home','SWPPL_EPC_Dashboard');
}

function initAdvancedFeatures(){
  // Nothing needed at DOMContentLoaded — features are on-demand
}
if(document.readyState!=='loading')initAdvancedFeatures();
else document.addEventListener('DOMContentLoaded',initAdvancedFeatures);

// ══════════════════════════════════════════════════════════════

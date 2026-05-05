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
  try{DB.milestones.forEach(m=>_idx.push({k:m.label.toLowerCase()+' milestone',label:m.label,sub:'Milestone · '+m.date,icon:'📅',cb:()=>nav('home')}));}catch(e){}
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
//  9. GANTT CHART  (Planned vs Actual with delay highlight)
// ═══════════════════════════════════════════════════════════
const GANTT_MONTHS=['Jan 26','Feb 26','Mar 26','Apr 26','May 26','Jun 26','Jul 26','Aug 26','Sep 26','Oct 26','Nov 26','Dec 26','Jan 27','Feb 27','Mar 27','Apr 27','May 27'];
const GANTT_ROWS=[
  {l:'Land Acquisition',   ps:0,pe:4,  as:0,ae:5,  c:'var(--land)'},
  {l:'WTG Civil Works',    ps:1,pe:7,  as:1,ae:8,  c:'var(--wtg)'},
  {l:'WTG T1 Erection',    ps:4,pe:5,  as:4,ae:5,  c:'#7c4dff'},  // MBI-12 T1-T5 done Apr
  {l:'WTG Bulk Erection',  ps:5,pe:11, as:6,ae:12, c:'var(--wtg)'},
  {l:'Solar Piling',       ps:0,pe:4,  as:0,ae:4,  c:'var(--sol)'},
  {l:'Solar MMS & Module', ps:4,pe:8,  as:5,ae:9,  c:'#ff8800'},   // Module start 9-May
  {l:'DC Cable Works',     ps:4,pe:9,  as:4,ae:10, c:'#00acc1'},
  {l:'33kV Line F1',       ps:1,pe:7,  as:1,ae:8,  c:'var(--kv3)'},
  {l:'66kV EHV Line',      ps:0,pe:6,  as:0,ae:6,  c:'var(--kv6)'},
  {l:'PSS Civil',          ps:0,pe:4,  as:0,ae:4,  c:'var(--pss)'},
  {l:'PSS Equipment',      ps:3,pe:7,  as:3,ae:8,  c:'#00bcd4'},
  {l:'GSS 66kV Bay',       ps:1,pe:5,  as:1,ae:5,  c:'var(--gss)'},
  {l:'Commissioning',      ps:10,pe:14,as:11,ae:15,c:'var(--ok)'},
  {l:'HOTO',               ps:14,pe:16,as:14,ae:17,c:'var(--er)'},
];
function renderGantt(containerId,rows,months){
  rows=rows||GANTT_ROWS; months=months||GANTT_MONTHS;
  const el=document.getElementById(containerId);if(!el)return;
  const n=months.length;
  // Today = May 2026 → index 4
  const now=new Date();
  const todayIdx=months.findIndex(m=>{
    const [mon,yr]=m.split(' ');
    const y=yr?parseInt('20'+yr):2026;
    const mi=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(mon);
    return mi===now.getMonth()&&y===now.getFullYear();
  });
  const tIdx=todayIdx>=0?todayIdx:4; // default May 2026
  el.innerHTML=`<div class="gantt-wrap">
    <div class="gantt-inner">
      <div class="gantt-hrow">
        <div class="gantt-hlabel">Activity</div>
        <div class="gantt-hcols">${months.map((m,i)=>`<div class="gantt-hcell" style="${i===tIdx?'color:var(--er);font-weight:700;':''}">${m}${i===tIdx?' ▲':''}</div>`).join('')}</div>
      </div>
      ${rows.map(r=>{
        const pL=r.ps/n*100,pW=Math.max(0,(r.pe-r.ps)/n*100);
        const aL=r.as/n*100,aW=Math.max(0,(r.ae-r.as)/n*100);
        const late=r.ae>r.pe&&r.ae>0;
        const tip=`${r.l}: Planned ${months[r.ps]||''}–${months[Math.max(0,r.pe-1)]||''} | Actual ${months[r.as]||''}–${months[Math.max(0,r.ae-1)]||''}${late?' ⚠ DELAYED':''}`;
        return`<div class="gantt-row">
          <div class="gantt-rlabel" data-tt="${tip}">${r.l}</div>
          <div class="gantt-track">
            <div class="gantt-today" style="left:${(tIdx+.5)/n*100}%" data-tt="Today (${months[tIdx]||''})"></div>
            ${pW>0?`<div class="gantt-bar gantt-plan" style="left:${pL}%;width:${pW}%;background:${r.c}" data-tt="Planned: ${months[r.ps]||''}–${months[Math.max(0,r.pe-1)]||''}">${r.l.substr(0,10)}</div>`:''}
            ${aW>0?`<div class="gantt-bar gantt-actual ${late?'gantt-late':''}" style="left:${aL}%;width:${aW}%;background:${r.c}" data-tt="${tip}" onclick="ganttRowClick(${JSON.stringify(r).replace(/"/g,"'").replace(/\n/g,'')})">${r.l.substr(0,10)}${late?' ⚠':''}</div>`:''}
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>
  <div style="display:flex;gap:12px;flex-wrap:wrap;padding:8px 10px;font-size:9px;border-top:1px solid var(--b1);">
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:4px;border:1px dashed rgba(255,255,255,.4);display:inline-block;opacity:.5;background:var(--ac);border-radius:2px;"></span>Planned</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:8px;display:inline-block;background:var(--ok);border-radius:2px;opacity:.9;"></span>Actual</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:16px;height:8px;display:inline-block;background:var(--er);border-radius:2px;opacity:.9;"></span>Delayed</span>
    <span style="display:flex;align-items:center;gap:4px;"><span style="width:2px;height:12px;background:var(--er);display:inline-block;opacity:.75;"></span>Today (${months[tIdx]||''})</span>
  </div>`;
}
function ganttRowClick(r){
  openDrilldown(r.l+' — Timeline Detail',`
    <div class="g2" style="margin-bottom:14px;">
      <div class="pnl"><div class="kl">Planned Start</div><div class="kv" style="color:var(--ac);font-size:18px;">${GANTT_MONTHS[r.ps]||'—'}</div></div>
      <div class="pnl"><div class="kl">Planned End</div><div class="kv" style="color:var(--ac);font-size:18px;">${GANTT_MONTHS[Math.max(0,r.pe-1)]||'—'}</div></div>
      <div class="pnl"><div class="kl">Actual Start</div><div class="kv" style="color:var(--ok);font-size:18px;">${GANTT_MONTHS[r.as]||'—'}</div></div>
      <div class="pnl"><div class="kl">Actual End</div><div class="kv" style="color:${r.ae>r.pe?'var(--er)':'var(--ok)'};font-size:18px;">${GANTT_MONTHS[Math.max(0,r.ae-1)]||'—'}</div></div>
    </div>
    <div class="al ${r.ae>r.pe?'al-d':'al-s'}" style="margin-bottom:8px;">
      ${r.ae>r.pe?`⚠️ <b>DELAYED</b> by ${r.ae-r.pe} month(s)`:' ✅ On Schedule or Ahead'}
    </div>
    <div style="background:var(--card2);border-radius:8px;padding:10px;font-size:9px;color:var(--t3);">
      Duration planned: ${r.pe-r.ps} month(s) | Actual: ${r.ae-r.as} month(s)
    </div>`);
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
      <div style="font-weight:700;margin-bottom:4px;color:var(--t1);">${o.loc} — ${o.obs}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:9px;">
        <span>By: <b>${o.raisedBy}</b></span>
        <span>Risk: <b>${o.risk}</b></span>
        <span>Status: <span class="chip ${o.status==='Closed'?'cg':'cy'}">${o.status}</span></span>
        ${o.vendor?`<span>Vendor: <b>${o.vendor}</b></span>`:''}
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
      <div style="width:28px;height:28px;border-radius:50%;background:#1565c0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${e.name.charAt(0).toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.name}</div>
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
function _readImg(file,id,cb){
  const reader=new FileReader();
  reader.onload=e=>{
    const prv=document.getElementById('iuprv-'+id);
    if(prv)prv.innerHTML=`<img src="${e.target.result}" class="img-preview">`;
    if(typeof cb==='string')try{eval('('+cb+')')(e.target.result);}catch(x){}
    else if(typeof cb==='function')cb(e.target.result);
    showToast('Image uploaded','ok');
  };
  reader.readAsDataURL(file);
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

// ═══════════════════════════════════════════════════════════
//  16. INIT & HOME INTEGRATION
// ═══════════════════════════════════════════════════════════
function initHomeAdvanced(){
  // Gantt chart
  setTimeout(()=>{if(typeof renderProjectGantt==='function')renderProjectGantt('home-gantt');},180);
  // KPI trend arrows (comparing to mock "last week" baseline)
  setTimeout(()=>{
    try{
      const cards=document.querySelectorAll('.sq-kpi');
      const cur=[calcOverall(),calcLandProg(),calcSolarProg(),calcWtgProg(),calcBopProg()];
      const prev=[cur[0]-1.1,cur[1]-.4,cur[2]-1.3,cur[3]-.7,cur[4]-1.8];
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

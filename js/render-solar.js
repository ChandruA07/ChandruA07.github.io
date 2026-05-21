//  SOLAR
// ═══════════════════════════════════════════════════════════
function rndrSolar(){
  const sol=calcSolarProg();
  _pageLogoTR();
  // Section nav
  if(typeof injectSecNav==='function') injectSecNav('view-solar',[
    {id:'sol-kr',         label:'KPIs',          icon:'📊'},
    {id:'itc-cards',      label:'ITC Cards',     icon:'🔆'},
    {id:'sol-pod-section',label:'POD & Status',  icon:'📋'},
    {id:'sol-ndp-section',label:'Next Day Plan', icon:'➜'},
  ]);
  // KPIs: Only Overall, Manpower, Charge Ready (remove ITC1/2/3)
  document.getElementById('sol-kr').innerHTML=`
    <div class="kpi"><div class="kb" style="background:var(--sol)"></div><div class="kl">Solar Overall</div><div class="kv" style="color:var(--sol)">${sol}%</div></div>
    <div class="kpi"><div class="kb" style="background:var(--land)"></div><div class="kl">Manpower</div><div class="kv" style="color:var(--land)">14</div></div>
    <div class="kpi"><div class="kb" style="background:var(--er)"></div><div class="kl">Charge Ready</div><div class="kv" style="color:var(--er)">0 MWp</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Total ITCs</div><div class="kv" style="color:var(--ok)">6</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ac)"></div><div class="kl">Total MW</div><div class="kv" style="color:var(--ac)">70.4</div></div>`;

  // ── ITC LAYOUT (REVISED) ──
  // Per requirement:
  //   1. All 6 ITCs in a SINGLE horizontal row (compact cards: id, MW, %, mini bar, edit btn)
  //   2. Below that, a SEPARATE rectangular box listing major ongoing activities
  //      for each ITC as bullet points (piling, trench, cable laying, etc.).
  //      No charts in this box — only bullets, updated by the authorized person.
  const g=document.getElementById('itc-cards');
  if(g){
    const itcEntries = Object.entries(DB.solar.itcs);

    // ── Row 1: compact ITC cards (one row of 6) ──
    const cardsHtml = itcEntries.map(([id,d])=>{
      const p = calcITCProg(id);
      const barCol = p>=100 ? 'var(--ok)' : p>0 ? 'var(--sol)' : 'var(--er)';
      const chipCls = p>=100?'cg':p>0?'cy':'cb';
      const chipTxt = p>=100?'Done':p>0?'WIP':'Pending';
      return `<div class="itc-card-h" onclick="openITC('${id}')" data-tt="Open ${id} detail">
        <div class="itc-card-h-id">${_solImg(14)} ${id}</div>
        <div class="itc-card-h-mw">${d.mw} MW</div>
        <div class="itc-card-h-pct" style="color:${barCol};">${p}%</div>
        <div class="itc-card-h-bar"><div style="width:${p}%;background:${barCol};"></div></div>
        <div class="chip ${chipCls}" style="font-size:8px;">${chipTxt}</div>
        <button class="btn btsol bts itc-card-h-btn"
                onclick="event.stopPropagation();reqLogin('solar',()=>openItcLiveEditor('${id}'))"
                data-tt="Update live activities for ${id}">✏️ Update</button>
      </div>`;
    }).join('');

    // ── Row 2: Major Ongoing Activities box (bullet points per ITC) ──
    const activityCols = itcEntries.map(([id,d])=>{
      const live = d.live || {};
      const acts = Array.isArray(live.activities) ? live.activities.filter(Boolean) : [];
      const noWork = (live.noWorkReason || '').trim();
      let body = '';
      if (noWork && !acts.length) {
        body = `<div class="itc-act-nowork">
          <b>⛔ No Work Today</b>
          <div>${esc(noWork)}</div>
        </div>`;
      } else if (acts.length) {
        body = `<ul class="itc-act-ul">
          ${acts.map(a => {
            const m = String(a).match(/^(.*?)\s*[–-]\s*(.+)$/);
            return m
              ? `<li><b>${esc(m[1].trim())}</b><span class="itc-act-qty">${esc(m[2].trim())}</span></li>`
              : `<li><b>${esc(a)}</b></li>`;
          }).join('')}
        </ul>`;
      } else {
        body = `<div class="itc-act-empty">
          No activities updated yet.<br>
          <span class="itc-act-hint">Click ✏️ Update on the card above.</span>
        </div>`;
      }
      return `<div class="itc-act-col">
        <div class="itc-act-col-hdr">${_solImg(13)} ${id}</div>
        ${body}
      </div>`;
    }).join('');

    g.innerHTML = `
      <!-- ITC card strip (single horizontal row) -->
      <div class="itc-cards-strip">${cardsHtml}</div>

      <!-- Major Ongoing Activities — rectangular box, bullet points only, no charts -->
      <div class="itc-acts-box">
        <div class="itc-acts-box-hdr">
          <div class="itc-acts-box-title">📋 Major Ongoing Activities — by ITC</div>
          <div class="itc-acts-box-sub">Piling · Trench · Cable Laying · Module Installation · etc. — updated by authorized person</div>
        </div>
        <div class="itc-acts-grid">${activityCols}</div>
      </div>`;
  }

  // ── POD & Daily Work Status section ──
  renderModulePodList('s', 'sol-pod-list');

  // ── Next Day Plan section ──
  renderModuleNdpList('s', 'sol-ndp-list');
}
function openITC(id){curITC=id;nav('itc',{itc:id});}

// ═══════════════════════════════════════════════════════════
//  ITC Live Activities Editor (per-ITC modal)
//  Authorized person sets either:
//   • a bullet list of ongoing activities (e.g. "Piling work – 60/100"), OR
//   • a "no work reason" (e.g. "Heavy rain since morning")
// ═══════════════════════════════════════════════════════════
function openItcLiveEditor(itcId){
  const d = DB.solar.itcs[itcId]; if (!d) return;
  const live = d.live || {};
  const actsTxt = Array.isArray(live.activities) ? live.activities.join('\n') : '';
  const noWork  = live.noWorkReason || '';
  document.getElementById('p-t').textContent = '✏️ ' + itcId + ' — Live Activities / No-Work Reason';
  document.getElementById('p-b').innerHTML = `
    <form onsubmit="return saveItcLiveActivities(event,'${itcId}')">
      <div class="al al-i" style="margin-bottom:8px;font-size:10px;">
        Enter one activity per line. Format suggestion: <b>Activity name – quantity</b><br>
        Example: <i>ITC piling work – 60/100</i> &nbsp;·&nbsp; <i>DC 400 sqmm cable laying – 320m</i>
      </div>
      <div class="fg">
        <label class="fl">Ongoing / Today's Activities (bullet points)</label>
        <textarea class="fta" id="itc-live-acts" rows="6"
          placeholder="One activity per line, e.g.:&#10;Piling work – 80/100&#10;DC 4 sqmm trench – 450m&#10;Module installation – 24 nos">${esc(actsTxt)}</textarea>
      </div>
      <div class="fg">
        <label class="fl">OR — No-Work Reason (use only if no work is happening today)</label>
        <input class="fi" id="itc-live-nowork" placeholder="e.g. Rain since 9 AM / Piling rig under maintenance" value="${esc(noWork)}">
        <div style="font-size:8px;color:var(--t3);margin-top:3px;">Fill this only when activities list is empty — it overrides the bullet list on the dashboard.</div>
      </div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btsol" style="flex:1;">💾 Save</button>
      </div>
    </form>`;
  ov('pov');
}
async function saveItcLiveActivities(e, itcId){
  e.preventDefault();
  const actsTxt = (document.getElementById('itc-live-acts')?.value || '').trim();
  const noWork  = (document.getElementById('itc-live-nowork')?.value || '').trim();
  const activities = actsTxt ? actsTxt.split(/\r?\n/).map(s=>s.trim()).filter(Boolean) : [];
  try {
    await dataApi.updateItcLiveActivities(itcId, { activities, noWorkReason: activities.length ? '' : noWork });
    cov('pov');
    showToast('✅ ' + itcId + ' live activities updated', 'ok');
    if (CV === 'solar') rndrSolar();
  } catch(err){
    showToast('❌ ' + (err.message || 'Save failed'), 'er');
  }
  return false;
}


// ── ITC DETAIL: left=pie+sub-acts | right=map (double height) ──────────────
// Sub-activities per spec
const SOL_SUB_ACTS_SPEC={
  'Piling':              {subs:['Pile Marking','Pile Drilling','Pile Casting','Pile Head Chipping'],unit:'piles',total:6000},
  'Road':                {subs:['Subgrade Preparation','WBM Layer','Surface Finishing'],unit:'m',total:2000},
  'Boundary Wall':       {subs:['Excavation & PCC','Masonry Work','Plastering & Coping'],unit:'m',total:1500},
  'DC 4 Sq.mm':          {subs:['Trench Excavation','Cable Laying','Termination & Testing'],unit:'km',total:60},
  'DC 400 Sq.mm':        {subs:['Trench Excavation','Cable Laying','Termination & Testing'],unit:'km',total:60},
  'Main Gate':           {subs:['Foundation','Gate Fabrication','Erection & Paint'],unit:'nos',total:2},
  'SCB':                 {subs:['Foundation','SCB Installation','Cabling'],unit:'nos',total:12},
  'MMS & Module':        {subs:['MMS Erection','Module Fixing','Torque & Inspection'],unit:'nos',total:0},
  'IDT':                 {subs:['IDT Foundation','IDT Installation','Cabling'],unit:'nos',total:0},
  'F INV':               {subs:['Inverter Foundation','Inverter Installation','Wiring'],unit:'nos',total:0},
  'F Equip Installation':{subs:['Civil Work','Equipment Fixing','Wiring & Testing'],unit:'nos',total:0},
  'LA & Earthing':       {subs:['LA Installation','Earth Pit Excavation','Continuity Test'],unit:'nos',total:0},
  'DP Yard':             {subs:['Foundation','Equipment Erection','Wiring & Testing'],unit:'nos',total:0},
  'MCR Building':        {subs:['Foundation','Structure','Finishing'],unit:'%',total:100},
  'Pre-Commissioning':   {subs:['IR Testing','Loop Testing','System Acceptance Test'],unit:'%',total:100},
  'HOTO':                {subs:['Documentation','Snag List','Sign-off'],unit:'%',total:100},
};

function rndrITC(id){
  curITC=id;const d=DB.solar.itcs[id];const p=calcITCProg(id);
  const el=document.getElementById('itc-det');if(!el)return;
  const mapImg=ITC_MAPS[id];

  // Initialise the activity tree on this block (idempotent)
  if(typeof solInitActs === 'function') solInitActs(d);
  const sectPct = (typeof solItcActsPct === 'function') ? solItcActsPct(d) : {pre:0,install:0,post:0};

  // ROW state for this block
  if(!Array.isArray(d.rowIssues)) d.rowIssues = [];
  const openRows = d.rowIssues.filter(r => (r.status||'open') === 'open');
  const siteRow  = openRows.find(r => r.scope === 'site');
  const ed = _solIsEditor();

  el.innerHTML=`
    <div class="ph" style="position:relative;">
      ${_pageLogoTR()}
      <div class="pht" style="color:var(--sol);display:flex;align-items:center;gap:8px;">${_solImg(22)} ${id} – Activity Dashboard</div>
      <div class="phs">${d.mw}MW | Progress: ${p}%</div>
    </div>
    <div class="kr" style="margin-bottom:10px;">
      <div class="kpi" style="padding:8px;"><div class="kb" style="background:var(--sol)"></div><div class="kl">Pre-Installation</div><div class="kv" style="font-size:15px;color:var(--sol)">${sectPct.pre}%</div></div>
      <div class="kpi" style="padding:8px;"><div class="kb" style="background:var(--ac)"></div><div class="kl">Installation</div><div class="kv" style="font-size:15px;color:var(--ac)">${sectPct.install}%</div></div>
      <div class="kpi" style="padding:8px;"><div class="kb" style="background:var(--ok)"></div><div class="kl">Post-Installation</div><div class="kv" style="font-size:15px;color:var(--ok)">${sectPct.post}%</div></div>
      <div class="kpi" style="padding:8px;"><div class="kb" style="background:var(--wn)"></div><div class="kl">Overall</div><div class="kv" style="font-size:15px;color:var(--wn)">${p}%</div></div>
    </div>
    ${_solRndrRowBanner(d, id)}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;">
      <!-- LEFT: activity tile grid grouped by phase -->
      <div>
        <div class="ph2" style="margin-bottom:8px;">
          <div class="pt">Activities — click a tile for sub-activity detail</div>
          <button class="btn bts" style="background:var(--er);color:#fff;font-size:9px;padding:4px 10px;"
                  onclick="solOpenRowForm('${id}')">🚧 Raise ROW</button>
        </div>
        <div id="sol-grid-${id}">
          ${_solRndrPhaseGrid(d, id, 'pre',     siteRow)}
          ${_solRndrPhaseGrid(d, id, 'install', siteRow)}
          ${_solRndrPhaseGrid(d, id, 'post',    siteRow)}
        </div>
        ${_solRndrRowList(d, id, ed)}
      </div>
      <!-- RIGHT: map -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div class="pnl">
          <div class="ph2">
            <div class="pt">${_solImg(13)} ${id} Layout Map</div>
            <button class="btn btsol bts" onclick="triggerMapUpload('${id}')">Upload Map</button>
          </div>
          <div style="min-height:300px;border:2px dashed var(--b2);border-radius:8px;overflow:hidden;display:flex;align-items:center;justify-content:center;background:var(--card2);" id="itc-map-img-box-${id}">
            ${mapImg
              ? `<img src="${mapImg}" style="width:100%;max-height:380px;object-fit:contain;">`
              : `<div style="text-align:center;padding:20px;"><div style="font-size:32px;margin-bottom:8px;">🗺️</div><div style="font-size:9px;color:var(--t3);">No map uploaded<br>Password required</div></div>`}
          </div>
          <input type="file" id="itc-map-file-${id}" accept="image/*" style="display:none;" onchange="handleMapUpload('${id}',this)">
        </div>
        <div id="itc-act-pie-box-${id}" style="display:none;" class="pnl"></div>
      </div>
    </div>`;
}

// ── Render one phase as a labelled tile grid ─────────────────────────────
function _solRndrPhaseGrid(itc, itcId, sectionKey, siteRow){
  const def = SOL_STRUCTURE[sectionKey]; if(!def) return '';
  const acts = solGetActivities(sectionKey);
  const ed = _solIsEditor();
  const pct = (typeof solSectionPct === 'function') ? solSectionPct(itc, sectionKey) : 0;

  // Open ROW issues for this block, indexed by affected activity key
  const openRows = (itc.rowIssues||[]).filter(r => (r.status||'open') === 'open');
  const actRowMap = {};
  openRows.forEach(r => { if(r.scope === 'activity' && r.actKey) actRowMap[r.actKey] = r; });

  // A "site" ROW reddens the whole phase
  const siteRed = !!siteRow;

  const tiles = acts.map(a => {
    const ap = solActPct(itc, sectionKey, a.key);
    const hasRow = !!actRowMap[a.key];
    const baseCol = ap>=100 ? 'var(--ok)' : ap>0 ? def.color : 'var(--b1)';
    const borderCol = (hasRow || siteRed) ? 'var(--er)' : (ap>0 ? def.color : 'var(--b1)');
    const subCount = (a.subs||[]).length;
    return `<div onclick="solOpenActModal('${itcId}','${sectionKey}','${a.key}')"
      style="min-height:92px;background:${(hasRow||siteRed)?'rgba(239,68,68,.08)':'var(--card2)'};
             border:2px solid ${borderCol};border-radius:9px;
             display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:4px;
             cursor:pointer;padding:9px 6px;text-align:center;transition:all .16s;position:relative;"
      onmouseover="this.style.transform='scale(1.04)'"
      onmouseout="this.style.transform='scale(1)'">
      ${hasRow?`<span style="position:absolute;top:3px;right:4px;font-size:9px;">🚧</span>`:''}
      ${!a.isDefault?`<span style="position:absolute;top:3px;left:4px;font-size:6px;background:var(--ac);color:#fff;padding:1px 4px;border-radius:6px;">CUSTOM</span>`:''}
      <div style="font-size:9px;font-weight:700;color:var(--t2);line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;min-height:33px;margin-top:6px;">${a.n}</div>
      <div style="font-family:var(--f2);font-size:17px;font-weight:800;color:${ap>0?baseCol:'var(--t4)'};line-height:1;">${ap}%</div>
      <div style="font-size:7px;color:var(--t3);">${subCount} sub-acts</div>
      <div style="height:4px;width:100%;background:var(--b1);border-radius:3px;overflow:hidden;">
        <div style="width:${ap}%;height:100%;background:${baseCol};border-radius:3px;"></div>
      </div>
    </div>`;
  }).join('');

  return `<div style="margin-bottom:14px;">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;padding:5px 8px;
                background:${siteRed?'rgba(239,68,68,.12)':'var(--card2)'};
                border-left:3px solid ${siteRed?'var(--er)':def.color};border-radius:5px;">
      <span style="font-size:13px;">${def.icon}</span>
      <span style="font-weight:800;font-size:11px;color:${siteRed?'var(--er)':def.color};">${def.label}</span>
      <span style="font-size:9px;color:var(--t3);">${acts.length} activities · ${pct}%</span>
      ${siteRed?`<span style="font-size:8px;background:var(--er);color:#fff;padding:1px 7px;border-radius:8px;font-weight:700;">⛔ SITE ROW OPEN</span>`:''}
      ${ed?`<button class="btn btsol bts" style="margin-left:auto;font-size:8px;padding:3px 8px;"
              onclick="solOpenAddActivity('${itcId}','${sectionKey}')">+ Add Activity</button>`:''}
    </div>
    <div id="sol-addact-form-${itcId}-${sectionKey}"></div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:7px;">${tiles}</div>
  </div>`;
}

// ── ROW banner (top of ITC view) ─────────────────────────────────────────
function _solRndrRowBanner(itc, itcId){
  const openRows = (itc.rowIssues||[]).filter(r => (r.status||'open') === 'open');
  if(!openRows.length) return '';
  return `<div style="background:rgba(239,68,68,.12);border:1px solid var(--er);border-radius:8px;
              padding:8px 12px;margin-bottom:10px;display:flex;align-items:center;gap:10px;">
    <span style="font-size:16px;">🚧</span>
    <span style="font-size:10px;font-weight:700;color:var(--er);">
      ${openRows.length} open ROW issue${openRows.length>1?'s':''} on ${itcId}
    </span>
    <span style="font-size:9px;color:var(--t3);">— affected items are highlighted in red below</span>
  </div>`;
}

// ── ROW list (below grid) ────────────────────────────────────────────────
function _solRndrRowList(itc, itcId, ed){
  const rows = itc.rowIssues || [];
  if(!rows.length) return '';
  return `<div class="pnl" style="margin-top:10px;padding:10px;">
    <div style="font-weight:700;font-size:11px;color:var(--er);margin-bottom:8px;">🚧 ROW Issues — ${itcId}</div>
    <div class="tsc"><table class="tbl">
      <thead><tr><th>Remarks</th><th>Scope</th><th>Affected</th><th>Raised</th><th>Status</th>${ed?'<th></th>':''}</tr></thead>
      <tbody>${rows.map((r,i)=>{
        const isOpen = (r.status||'open')==='open';
        const scopeLabel = r.scope==='site' ? '🌐 Whole Site' : '🎯 Activity';
        let affected = '—';
        if(r.scope==='activity' && r.actKey){
          const a = (typeof solGetActivities==='function')
            ? solGetActivities(r.section||'pre').concat(solGetActivities('install'),solGetActivities('post')).find(x=>x.key===r.actKey)
            : null;
          affected = a ? a.n : r.actKey;
        }
        return `<tr>
          <td style="font-size:9px;">${(r.remarks||'').replace(/</g,'&lt;')}</td>
          <td style="font-size:9px;">${scopeLabel}</td>
          <td style="font-size:9px;">${affected}</td>
          <td style="font-size:9px;">${r.dateRaised||'—'}</td>
          <td><span class="chip ${isOpen?'cr':'cg'}" style="font-size:8px;">${isOpen?'OPEN':'CLOSED'}</span></td>
          ${ed?`<td style="white-space:nowrap;">
            <button class="btn bts" style="font-size:8px;padding:2px 7px;" onclick="solToggleRow('${itcId}','${r.id}')">${isOpen?'Close':'Reopen'}</button>
            <button class="btn bts" style="font-size:8px;padding:2px 6px;" onclick="solDeleteRow('${itcId}','${r.id}')">✕</button>
          </td>`:''}
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;
}

// Render the activity grid for a given ITC. Used both initially and after sub-activity edits.
function _renderActGrid(id){
  const d=DB.solar.itcs[id];if(!d)return;
  const g=document.getElementById('actg-'+id);if(!g)return;
  g.innerHTML=d.acts.map((a,i)=>`
    <div onclick="showSolActDetail('${id}',${i})"
      style="min-height:96px;background:var(--card2);border:2px solid ${a.done>0?a.col:'var(--b1)'};border-radius:9px;
             display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:5px;
             cursor:pointer;padding:10px 6px;text-align:center;transition:all .18s;"
      onmouseover="this.style.borderColor='${a.col}';this.style.transform='scale(1.04)';this.style.boxShadow='0 0 12px '+'${a.col}'+'33'"
      onmouseout="this.style.borderColor='${a.done>0?a.col:'var(--b1)'}';this.style.transform='scale(1)';this.style.boxShadow='none'">
      <div style="font-size:10px;font-weight:700;color:var(--t2);line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;min-height:24px;">${a.n}</div>
      <div style="font-family:var(--f2);font-size:20px;font-weight:800;color:${a.col};line-height:1;">${a.done}%</div>
      <div style="height:5px;width:100%;background:var(--b1);border-radius:3px;overflow:hidden;">
        <div style="width:${a.done}%;height:100%;background:${a.col};border-radius:3px;transition:width .3s;"></div>
      </div>
    </div>`).join('');
}


// ── Show sub-activity drilldown + pie on activity click ─────────────────────
function showSolActDetail(itcId,idx){
  const a=DB.solar.itcs[itcId]?.acts[idx];if(!a)return;
  const bal=100-a.done;

  // ── RIGHT panel: pie chart ──
  const pieBox=document.getElementById('itc-act-pie-box-'+itcId);
  if(pieBox){
    pieBox.style.display='block';
    const cid='ch-act-pie-'+itcId+'_'+idx;
    pieBox.innerHTML=`
      <div class="ph2" style="margin-bottom:8px;">
        <div class="pt" style="color:${a.col};">${a.n}</div>
        <button onclick="document.getElementById('itc-act-pie-box-${itcId}').style.display='none'" style="background:none;border:1px solid var(--b1);color:var(--t3);width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:9px;">✕</button>
      </div>
      <div class="ch h180"><canvas id="${cid}"></canvas></div>
      <div style="margin-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:5px;">
        <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;">
          <div style="font-size:8px;color:var(--t3);">Cumulative Done</div>
          <div style="font-family:var(--f2);font-size:20px;font-weight:700;color:var(--ok);">${a.done}%</div>
        </div>
        <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;">
          <div style="font-size:8px;color:var(--t3);">Remaining</div>
          <div style="font-family:var(--f2);font-size:20px;font-weight:700;color:var(--er);">${bal}%</div>
        </div>
        <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;">
          <div style="font-size:8px;color:var(--t3);">Weight</div>
          <div style="font-family:var(--f2);font-size:16px;font-weight:700;color:${a.col};">${a.w}%</div>
        </div>
        <div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;">
          <div style="font-size:8px;color:var(--t3);">Today</div>
          <div style="font-family:var(--f2);font-size:16px;font-weight:700;color:var(--ac3);">${a.today||0}%</div>
        </div>
      </div>`;
    setTimeout(()=>mkC(cid,{type:'doughnut',
      data:{labels:['Done','Remaining'],datasets:[{data:[a.done,bal],backgroundColor:[a.col,'rgba(26,46,74,.55)'],borderWidth:0,cutout:'65%'}]},
      options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:true,position:'bottom',labels:{font:{size:9},
        generateLabels:c=>{const ds=c.data.datasets[0];return c.data.labels.map((l,i)=>({text:`${l}: ${ds.data[i]}%`,fillStyle:ds.backgroundColor[i],strokeStyle:'transparent',lineWidth:0}));}
      }}}}}),45);
  }

  // ── LEFT panel: sub-activity drilldown with editable values ──
  const subPanel=document.getElementById('sol-subact-panel-'+itcId);
  if(!subPanel)return;
  subPanel.style.display='block';
  const scope=a.subScope||100;
  const subDone=a.subDone||a.subActs.map(()=>0);
  // ✅ Role gate — only Solar In-charge (or Site Manager 'all') may edit sub-activities
  const _isSolEditor = (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit('solar'));
  const _solRoleLabel = (auth.current() && auth.current().role === 'admin') ? 'Site Manager' : 'Solar Engineer';
  const lockAttr  = _isSolEditor?'':'disabled';
  const lockStyle = _isSolEditor?'':'opacity:.55;cursor:not-allowed;';
  const banner = _isSolEditor
    ? `<div class="al al-g" style="margin:0 0 8px 0;font-size:9px;">✅ Logged in as <b>${_solRoleLabel}</b> — sub-activities are editable.</div>`
    : `<div class="al al-w" style="margin:0 0 8px 0;font-size:9px;display:flex;align-items:center;justify-content:space-between;gap:8px;">
        <span>🔒 <b>View-only</b> — Solar In-charge authentication required to edit.</span>
        <button class="btn btsol" style="font-size:9px;padding:3px 8px;" onclick="reqLogin('solar',()=>showSolActDetail('${itcId}',${idx}))">🔑 Login</button>
       </div>`;
  subPanel.innerHTML=`
    <div style="background:var(--card2);border:1px solid ${a.col};border-radius:8px;padding:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-family:var(--f2);font-size:11px;font-weight:700;color:${a.col};">${a.n} — Sub-Activities</div>
        <button onclick="document.getElementById('sol-subact-panel-${itcId}').style.display='none'" style="background:none;border:1px solid var(--b1);color:var(--t3);width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:9px;">✕</button>
      </div>
      ${banner}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="font-size:9px;color:var(--t3);">Total Scope:</div>
        <input type="number" value="${scope}" min="0" ${lockAttr}
          style="width:80px;background:var(--card3);border:1px solid var(--b1);border-radius:4px;color:var(--t2);padding:3px 6px;font-size:9px;${lockStyle}"
          onchange="updateSolSubScope('${itcId}',${idx},+this.value)">
        <div style="font-size:9px;color:var(--t3);">${scope>100?'units':'%'}</div>
      </div>
      ${a.subActs.map((s,si)=>{
        const sv=subDone[si]||0;
        const spct=scope>0?Math.min(100,Math.round(sv/scope*100)):0;
        return`<div style="margin-bottom:6px;">
          <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
            <div style="font-size:9px;font-weight:600;">${s}</div>
            <div style="font-size:9px;color:${a.col};">${sv}/${scope} (${spct}%)</div>
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <div style="flex:1;height:5px;background:var(--b1);border-radius:3px;overflow:hidden;">
              <div style="width:${spct}%;height:100%;background:${a.col};border-radius:3px;"></div>
            </div>
            <input type="number" value="${sv}" min="0" max="${scope}" ${lockAttr}
              style="width:60px;background:var(--card3);border:1px solid var(--b1);border-radius:4px;color:var(--t2);padding:2px 5px;font-size:9px;${lockStyle}"
              onchange="updateSolSubAct('${itcId}',${idx},${si},+this.value)">
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

async function updateSolSubScope(itcId,actIdx,newScope){
  if (typeof auth === 'undefined' || !auth.canEdit('solar')) {
    if(typeof showToast==='function')showToast('🔒 Solar Engineer login required','er');
    showSolActDetail(itcId,actIdx);
    return;
  }
  const a=DB.solar.itcs[itcId]?.acts[actIdx];if(!a)return;
  a.subScope=newScope;
  // Recompute done% so the card matches
  const subDone = a.subDone || a.subActs.map(()=>0);
  const totalDone = subDone.reduce((s,v)=>s+v,0);
  if(newScope > 0 && a.subActs.length > 0){
    a.done = Math.min(100, R(totalDone / newScope / a.subActs.length * 100));
  }
  // Push to Firebase via dataApi (real-time, auth-protected, audit-logged)
  try {
    await dataApi.updateSolarAct(itcId, actIdx, {
      done:    a.done,
      today:   a.today || 0,
      subDone: subDone
    });
    // subScope isn't in the strict dataApi schema — write it directly under the leaf
    await fbDB.ref('solar/itcs/'+itcId+'/acts/'+actIdx+'/subScope').set(Number(newScope) || 0).catch(()=>{});
  } catch (err) {
    if(typeof showToast==='function')showToast('❌ '+(err.message||'Save failed'),'er');
  }
  showSolActDetail(itcId,actIdx);
}

async function updateSolSubAct(itcId,actIdx,subIdx,newVal){
  if (typeof auth === 'undefined' || !auth.canEdit('solar')) {
    if(typeof showToast==='function')showToast('🔒 Solar Engineer login required','er');
    showSolActDetail(itcId,actIdx);
    return;
  }
  const a=DB.solar.itcs[itcId]?.acts[actIdx];if(!a)return;
  if(!a.subDone)a.subDone=a.subActs.map(()=>0);
  a.subDone[subIdx]=newVal;
  const scope=a.subScope||100;
  if(scope>0){
    const totalDone=a.subDone.reduce((s,v)=>s+v,0);
    a.done=Math.min(100,R(totalDone/scope/a.subActs.length*100));
  }
  // Push to Firebase via dataApi
  try {
    await dataApi.updateSolarAct(itcId, actIdx, {
      done:    a.done,
      today:   a.today || 0,
      subDone: a.subDone
    });
    // Also push to Daily Progress feed (real-time)
    if (typeof dataApi.pushDailyProgress === 'function') {
      dataApi.pushDailyProgress({
        module: 'Solar',
        itc:    itcId,
        act:    a.n,
        sub:    a.subActs[subIdx],
        val:    newVal,
        pct:    a.done
      }).catch(()=>{});
    }
  } catch (err) {
    if(typeof showToast==='function')showToast('❌ '+(err.message||'Save failed'),'er');
    return;
  }
  // The realtime listener will eventually re-render, but force an immediate
  // refresh for snappy UX.
  if(typeof updateOverallBars==='function')updateOverallBars();
  _renderActGrid(itcId);
  showSolActDetail(itcId,actIdx);
  if(typeof showToast==='function')showToast('✅ Sub-activity updated','ok');
}

// ── Map upload — role-based via auth.canEdit (replaces v8 password gate) ─────
//
// Old verifyMapPwd() compared the typed password against plaintext entries
// in the USERS const. That const is gone and password checks NEVER belong
// in client JS — Firebase Auth handles login server-side. This function
// just opens the native file picker if the current user has solar edit
// rights; otherwise it shows an inline auth prompt via reqLogin/auth.requireRole.
function triggerMapUpload(itcId){
  if (typeof auth !== 'undefined' && !auth.canEdit('solar')) {
    if (typeof showToast === 'function') {
      showToast('🔒 Solar Engineer or Site Manager login required', 'er');
    }
    if (auth.requireRole) auth.requireRole('solar', () => triggerMapUpload(itcId));
    return;
  }
  const input = document.getElementById('itc-map-file-' + itcId);
  if (input) input.click();
}
async function handleMapUpload(itcId,input){
  const file=input.files[0];if(!file)return;
  input.value='';
  // Auth-gate: must be Solar Engineer or Site Manager
  if (typeof auth === 'undefined' || !auth.canEdit('solar')) {
    showToast('🔒 Solar Engineer or Site Manager only','er');
    return;
  }
  const imgBox=document.getElementById('itc-map-img-box-'+itcId);
  if(imgBox)imgBox.innerHTML=`<div style="padding:20px;text-align:center;color:var(--t3);">📤 Uploading…</div>`;
  try {
    // Upload to Firebase Storage; only the URL goes into ITC_MAPS (not base64).
    const { url } = await storage.uploadItcMap(itcId, file, pct => {
      if(imgBox)imgBox.innerHTML=`<div style="padding:20px;text-align:center;color:var(--t3);">📤 Uploading… ${pct}%</div>`;
    });
    ITC_MAPS[itcId] = url;
    if(imgBox)imgBox.innerHTML=`<img src="${url}" style="width:100%;max-height:380px;object-fit:contain;" alt="${itcId} Map">`;
    showToast(itcId+' map uploaded!','ok');
  } catch (err) {
    if(imgBox)imgBox.innerHTML=`<div style="padding:20px;text-align:center;color:var(--er);">⚠️ Upload failed: ${err.message||err}</div>`;
    showToast('❌ '+(err.message||'Upload failed'),'er');
  }
}
function showToast(msg,type){
  let t=document.getElementById('toast-el');
  if(!t){t=document.createElement('div');t.id='toast-el';t.style.cssText='position:fixed;bottom:24px;right:24px;padding:10px 18px;border-radius:8px;font-size:11px;font-weight:600;z-index:9999;transition:opacity .3s;';document.body.appendChild(t);}
  const c={ok:'rgba(0,230,118,.95)',er:'rgba(255,82,82,.95)',wn:'rgba(255,202,40,.95)'};
  t.style.background=c[type]||c.ok;t.style.color=type==='ok'?'#071020':'#fff';
  t.textContent=msg;t.style.opacity='1';setTimeout(()=>t.style.opacity='0',2800);
}
function showActPieInRight(id,idx){showSolActDetail(id,idx);}
function showActDet(id,idx){showSolActDetail(id,idx);}
function resetItcRightPanel(id){}

// ═══════════════════════════════════════════════════════════
// ── SOLAR — activity modal + ROW (per-ITC) ─────────────────
// ═══════════════════════════════════════════════════════════
function _solIsEditor(){
  try { return (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit('solar')); }
  catch(e){ return false; }
}

// ── Activity sub-activity MODAL ──────────────────────────────────────────
function solOpenActModal(itcId, sectionKey, actKey){
  const itc = DB.solar.itcs[itcId]; if(!itc) return;
  if(typeof solInitActs === 'function') solInitActs(itc);
  const acts = solGetActivities(sectionKey);
  const actDef = acts.find(a => a.key === actKey); if(!actDef) return;
  const ed = _solIsEditor();
  const def = SOL_STRUCTURE[sectionKey];
  const pct = solActPct(itc, sectionKey, actKey);

  // ROW state for this activity
  const openRow = (itc.rowIssues||[]).find(r =>
    (r.status||'open')==='open' && r.scope==='activity' && r.actKey===actKey);

  let host = document.getElementById('sol-act-modal');
  if(!host){
    host = document.createElement('div');
    host.id = 'sol-act-modal';
    host.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9998;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 16px;';
    document.body.appendChild(host);
  }
  const subsHtml = (actDef.subs||[])
    .map((nm,i)=>_solRndrSubActivity(itc, itcId, sectionKey, actKey, i, actDef.subsMeta[i]))
    .join('');

  host.innerHTML = `
    <div style="background:var(--card);border:1px solid ${openRow?'var(--er)':'var(--b1)'};border-radius:10px;max-width:680px;width:100%;padding:16px 18px;color:var(--t1);box-shadow:0 12px 40px rgba(0,0,0,.45);">
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;">
        <span style="font-size:20px;">${def.icon}</span>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:800;color:${def.color};">${actDef.n}</div>
          <div style="font-size:9px;color:var(--t3);margin-top:2px;">${def.label} · ${itcId} · ${(actDef.subs||[]).length} sub-activities · ${pct}% complete</div>
          ${openRow?`<div style="font-size:9px;color:var(--er);font-weight:700;margin-top:3px;">🚧 ROW OPEN — ${(openRow.remarks||'').replace(/</g,'&lt;')}</div>`:''}
        </div>
        <button class="btn bts" style="font-size:11px;padding:4px 10px;" onclick="solCloseActModal()">✕</button>
      </div>
      <div style="max-height:60vh;overflow:auto;padding-right:4px;">
        ${subsHtml || '<div style="font-size:10px;color:var(--t3);padding:12px;text-align:center;">No sub-activities</div>'}
        ${ed?`
          <div id="sol-addsub-form-${itcId}-${sectionKey}-${actKey}"></div>
          <div style="display:flex;justify-content:flex-end;margin-top:6px;">
            <button class="btn btsol bts" style="font-size:9px;padding:4px 10px;" onclick="solOpenAddSub('${itcId}','${sectionKey}','${actKey}')">+ Add Sub-activity</button>
          </div>
        `:''}
      </div>
    </div>`;
  // Remember which modal is open so edits can re-render it
  _solModalOpen = {itcId, sectionKey, actKey};
}

function solCloseActModal(){
  const host = document.getElementById('sol-act-modal');
  if(host) host.remove();
  _solModalOpen = null;
}

// Tracks the currently-open activity modal so saves can refresh it
let _solModalOpen = null;

function _solRefreshAfterEdit(itcId){
  // Re-render the ITC page (grid), then re-open the modal if one was open
  rndrITC(itcId);
  if(_solModalOpen && _solModalOpen.itcId === itcId){
    const m = _solModalOpen;
    solOpenActModal(m.itcId, m.sectionKey, m.actKey);
  }
}

function _solRndrSubActivity(itc, itcId, sectionKey, actKey, idx, meta){
  const s = itc.solActs[sectionKey][actKey].subs[idx];
  if(!s) return '';
  const ed = _solIsEditor();
  const disAttr = ed?'':'disabled';
  const disStyle = ed?'':'opacity:.55;cursor:not-allowed;';
  const statusColor = SOL_STATUS_COLORS[s.status]||'var(--t4)';
  const path = `${sectionKey}|${actKey}|${idx}`;
  const photoBlock = s.photo
    ? `<img src="${s.photo}" style="max-width:80px;max-height:60px;border-radius:4px;border:1px solid var(--b1);" alt="proof">`
    : '';
  const isDefault = meta ? meta.isDefault : true;
  const lockIcon = isDefault
    ? '<span title="Default sub-activity — locked" style="font-size:8px;color:var(--t3);">🔒</span>'
    : '<span title="Custom" style="font-size:7px;background:var(--ac);color:#fff;padding:1px 4px;border-radius:6px;">CUSTOM</span>';
  const subDelBtn = (!isDefault && ed)
    ? `<button class="btn bts" onclick="solRemoveSub('${itcId}','${sectionKey}','${actKey}',${idx})" title="Delete sub-activity" style="font-size:8px;padding:1px 6px;margin-left:4px;">✕</button>`
    : '';
  return `<div class="wtg-sub">
    <div class="wtg-sub-head">
      <span style="font-size:10px;font-weight:600;color:var(--t1);flex:1;">${idx+1}. ${s.n} ${lockIcon}${subDelBtn}</span>
      <select ${disAttr} onchange="solSaveSub('${itcId}','${path}','status',this.value)"
              style="background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:${statusColor};font-size:9px;font-weight:700;padding:2px 5px;${disStyle}">
        ${SOL_STATUS_VALUES.map(v=>`<option value="${v}" ${s.status===v?'selected':''}>${SOL_STATUS_LABELS[v]}</option>`).join('')}
      </select>
    </div>
    <div class="wtg-sub-grid">
      <label><span>Planned Start</span>
        <input type="date" value="${s.pStart||''}" ${disAttr}
               onchange="solSaveSub('${itcId}','${path}','pStart',this.value)"
               style="${disStyle}"></label>
      <label><span>Planned End</span>
        <input type="date" value="${s.pEnd||''}" ${disAttr}
               onchange="solSaveSub('${itcId}','${path}','pEnd',this.value)"
               style="${disStyle}"></label>
      <label><span>Actual Start</span>
        <input type="date" value="${s.aStart||''}" ${disAttr}
               onchange="solSaveSub('${itcId}','${path}','aStart',this.value)"
               style="${disStyle}"></label>
      <label><span>Actual End</span>
        <input type="date" value="${s.aEnd||''}" ${disAttr}
               onchange="solSaveSub('${itcId}','${path}','aEnd',this.value)"
               style="${disStyle}"></label>
    </div>
    <div class="wtg-sub-grid wtg-sub-grid-2">
      <label><span>Responsible Person</span>
        <input type="text" value="${(s.responsible||'').replace(/"/g,'&quot;')}" placeholder="e.g. Engineer name"
               ${disAttr} onchange="solSaveSub('${itcId}','${path}','responsible',this.value)"
               style="${disStyle}"></label>
      <label><span>Delay Reason</span>
        <select ${disAttr} onchange="solSaveSub('${itcId}','${path}','delayReason',this.value)"
                style="${disStyle}">
          ${SOL_DELAY_REASONS.map(r=>`<option value="${r}" ${s.delayReason===r?'selected':''}>${r}</option>`).join('')}
        </select>
      </label>
    </div>
    <label style="display:block;margin-top:4px;"><span style="font-size:8px;color:var(--t3);">Remarks</span>
      <textarea rows="1" placeholder="Add remarks…" ${disAttr}
                onchange="solSaveSub('${itcId}','${path}','remarks',this.value)"
                style="width:100%;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);font-size:9px;padding:3px 5px;resize:vertical;${disStyle}">${(s.remarks||'').replace(/</g,'&lt;')}</textarea>
    </label>
    <div style="display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap;">
      <label style="font-size:8px;color:var(--t3);cursor:${ed?'pointer':'not-allowed'};padding:3px 6px;background:var(--card2);border-radius:4px;border:1px dashed var(--b1);">
        📷 ${s.photo?'Replace photo':'Upload photo'}
        <input type="file" accept="image/*" ${disAttr} style="display:none;"
               onchange="solUploadSubPhoto('${itcId}','${path}',this)">
      </label>
      ${photoBlock}
    </div>
  </div>`;
}

// ═══════════════════════════════════════════════════════════
// ── SOLAR ROW (Right of Way) — per-ITC ─────────────────────
// ═══════════════════════════════════════════════════════════
function solOpenRowForm(itcId){
  if(!_solIsEditor()){
    if(typeof showToast==='function') showToast('🔒 Solar Engineer login required','er');
    return;
  }
  const itc = DB.solar.itcs[itcId]; if(!itc) return;
  const today = new Date().toISOString().slice(0,10);

  // Build the affected-activity dropdown grouped by phase
  const actOptGroups = ['pre','install','post'].map(sec => {
    const def = SOL_STRUCTURE[sec];
    const opts = solGetActivities(sec)
      .map(a => `<option value="${sec}::${a.key}">${a.n}</option>`).join('');
    return `<optgroup label="${def.label}">${opts}</optgroup>`;
  }).join('');

  let host = document.getElementById('sol-row-modal');
  if(!host){
    host = document.createElement('div');
    host.id = 'sol-row-modal';
    host.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:40px 16px;';
    document.body.appendChild(host);
  }
  host.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--er);border-radius:10px;max-width:460px;width:100%;padding:16px 18px;color:var(--t1);box-shadow:0 12px 40px rgba(0,0,0,.45);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span style="font-size:18px;">🚧</span>
        <div style="font-size:14px;font-weight:800;color:var(--er);flex:1;">Raise ROW Issue — ${itcId}</div>
        <button class="btn bts" style="font-size:11px;padding:4px 10px;" onclick="solCloseRowModal()">✕</button>
      </div>

      <label style="font-size:8px;color:var(--t3);display:block;">Remarks (required)
        <textarea id="solrow-remarks" rows="2" placeholder="Describe the ROW issue…"
          style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:5px 7px;font-size:10px;resize:vertical;"></textarea>
      </label>

      <div style="margin-top:10px;font-size:9px;color:var(--t3);">Is this ROW for a specific activity or the whole site?</div>
      <div style="display:flex;gap:14px;margin-top:5px;">
        <label style="font-size:10px;color:var(--t1);display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input type="radio" name="solrow-scope" value="activity" checked onchange="solRowScopeChange()"> 🎯 Specific Activity
        </label>
        <label style="font-size:10px;color:var(--t1);display:flex;align-items:center;gap:5px;cursor:pointer;">
          <input type="radio" name="solrow-scope" value="site" onchange="solRowScopeChange()"> 🌐 Whole Site
        </label>
      </div>

      <div id="solrow-act-wrap" style="margin-top:8px;">
        <label style="font-size:8px;color:var(--t3);display:block;">Affected Activity
          <select id="solrow-act"
            style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:5px 7px;font-size:10px;">
            ${actOptGroups}
          </select>
        </label>
      </div>

      <label style="font-size:8px;color:var(--t3);display:block;margin-top:8px;">Date Raised
        <input id="solrow-date" type="date" value="${today}"
          style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:5px 7px;font-size:10px;">
      </label>

      <div style="display:flex;gap:6px;margin-top:14px;">
        <button class="btn bts" style="background:var(--er);color:#fff;font-size:10px;padding:5px 14px;" onclick="solSubmitRow('${itcId}')">🚧 Raise ROW</button>
        <button class="btn bts" style="font-size:10px;padding:5px 14px;" onclick="solCloseRowModal()">Cancel</button>
      </div>
    </div>`;
}

function solRowScopeChange(){
  const scope = (document.querySelector('input[name="solrow-scope"]:checked')||{}).value;
  const wrap = document.getElementById('solrow-act-wrap');
  if(wrap) wrap.style.display = (scope === 'activity') ? '' : 'none';
}

function solCloseRowModal(){
  const host = document.getElementById('sol-row-modal');
  if(host) host.remove();
}

async function solSubmitRow(itcId){
  if(!_solIsEditor()) return;
  const itc = DB.solar.itcs[itcId]; if(!itc) return;
  const remarks = (document.getElementById('solrow-remarks')||{}).value || '';
  if(!remarks.trim()){ if(typeof showToast==='function') showToast('❌ Remarks required','er'); return; }
  const scope = (document.querySelector('input[name="solrow-scope"]:checked')||{}).value || 'activity';
  const date = (document.getElementById('solrow-date')||{}).value || new Date().toISOString().slice(0,10);

  const row = {
    id: 'solrow-' + Date.now(),
    remarks: remarks.trim(),
    scope: scope,
    status: 'open',
    dateRaised: date,
    dateClosed: ''
  };
  if(scope === 'activity'){
    const sel = (document.getElementById('solrow-act')||{}).value || '';
    const [sec, actKey] = sel.split('::');
    row.section = sec;
    row.actKey = actKey;
  }
  if(!Array.isArray(itc.rowIssues)) itc.rowIssues = [];
  itc.rowIssues.push(row);

  await _solPersistItc(itcId, itc);
  if(typeof showToast==='function') showToast('🚧 ROW raised on '+itcId,'ok');
  solCloseRowModal();
  rndrITC(itcId);
}

async function solToggleRow(itcId, rowId){
  if(!_solIsEditor()) return;
  const itc = DB.solar.itcs[itcId]; if(!itc) return;
  const r = (itc.rowIssues||[]).find(x => x.id === rowId); if(!r) return;
  const willClose = (r.status||'open') === 'open';
  r.status = willClose ? 'closed' : 'open';
  if(willClose && !r.dateClosed) r.dateClosed = new Date().toISOString().slice(0,10);
  if(!willClose) r.dateClosed = '';
  await _solPersistItc(itcId, itc);
  if(typeof showToast==='function') showToast(willClose?'✅ ROW closed':'🚧 ROW reopened','ok');
  rndrITC(itcId);
}

async function solDeleteRow(itcId, rowId){
  if(!_solIsEditor()) return;
  if(!confirm('Delete this ROW issue?')) return;
  const itc = DB.solar.itcs[itcId]; if(!itc) return;
  itc.rowIssues = (itc.rowIssues||[]).filter(x => x.id !== rowId);
  await _solPersistItc(itcId, itc);
  if(typeof showToast==='function') showToast('🗑️ ROW removed','ok');
  rndrITC(itcId);
}

// ── Save sub-activity field, roll up, persist ────────────────────────────
async function solSaveSub(itcId, path, field, value){
  if(!_solIsEditor()){
    if(typeof showToast === 'function') showToast('🔒 Solar Engineer login required','er');
    return;
  }
  const itc = DB.solar.itcs[itcId]; if(!itc) return;
  if(typeof solInitActs === 'function') solInitActs(itc);
  const [section, actKey, idxStr] = path.split('|');
  const idx = +idxStr;
  const sub = itc.solActs[section] && itc.solActs[section][actKey] && itc.solActs[section][actKey].subs[idx];
  if(!sub) return;
  sub[field] = value;
  // Auto status from dates
  if(field === 'aEnd' && value && sub.status !== 'done') sub.status = 'done';
  if(field === 'aStart' && value && sub.status === 'pending') sub.status = 'wip';

  // Roll up to legacy d.acts[].done so calcITCProg / KPIs stay accurate.
  _solRollupToLegacy(itc);

  await _solPersistItc(itcId, itc);
  if(typeof showToast === 'function') showToast('✅ '+itcId+' · '+sub.n+' updated','ok');
  _solRefreshAfterEdit(itcId);
}

// Map new tree progress back into d.acts[].done so existing calc/KPIs keep working.
function _solRollupToLegacy(itc){
  if(!itc || !Array.isArray(itc.acts)) return;
  // Average all section pcts to fill each existing d.acts entry equally — this is a
  // simple roll-up that keeps overall calcSolarProg() in sync without overwriting
  // user-set per-activity targets. If any sub-activity has progress, the activity
  // gets that as its "done" value.
  const pre = solSectionPct(itc, 'pre');
  const ins = solSectionPct(itc, 'install');
  const post = solSectionPct(itc, 'post');
  const overall = Math.round((pre + ins + post) / 3);
  // Apply to ALL existing acts evenly so legacy charts stay in sync.
  itc.acts.forEach(a => { a.done = overall; });
}

async function solUploadSubPhoto(itcId, path, inputEl){
  if(!_solIsEditor()){
    if(typeof showToast === 'function') showToast('🔒 Solar Engineer login required','er');
    return;
  }
  const file = inputEl.files && inputEl.files[0]; if(!file) return;
  if(file.size > 2*1024*1024){
    if(typeof showToast === 'function') showToast('❌ Photo too large (>2MB)','er');
    return;
  }
  const reader = new FileReader();
  reader.onload = async function(e){
    const itc = DB.solar.itcs[itcId]; if(!itc) return;
    if(typeof solInitActs === 'function') solInitActs(itc);
    const [section, actKey, idxStr] = path.split('|');
    const idx = +idxStr;
    const sub = itc.solActs[section] && itc.solActs[section][actKey] && itc.solActs[section][actKey].subs[idx];
    if(!sub) return;
    sub.photo = e.target.result;
    await _solPersistItc(itcId, itc);
    if(typeof showToast === 'function') showToast('📷 Photo uploaded','ok');
    _solRefreshAfterEdit(itcId);
  };
  reader.readAsDataURL(file);
}

async function _solPersistItc(itcId, itc){
  try {
    if(typeof dataApi !== 'undefined' && typeof dataApi.setSolarItc === 'function'){
      await dataApi.setSolarItc(itcId, itc);
    } else if(typeof fbDB !== 'undefined' && fbDB){
      await fbDB.ref('solar/itcs/' + itcId).set(itc);
    } else if(typeof saveDB === 'function'){
      saveDB();
    }
  } catch(e){
    console.warn('[solar] persist ITC failed', e);
  }
}

async function _solPersistCustomActs(){
  try {
    if(typeof dataApi !== 'undefined' && typeof dataApi.setSolarCustomActs === 'function'){
      await dataApi.setSolarCustomActs(DB.solar.customActs);
    } else if(typeof fbDB !== 'undefined' && fbDB){
      await fbDB.ref('solar/customActs').set(DB.solar.customActs);
    }
    // Each ITC's solActs was regenerated — write them too.
    if(DB.solar && DB.solar.itcs){
      for(const [id, itc] of Object.entries(DB.solar.itcs)){
        await _solPersistItc(id, itc);
      }
    }
  } catch(e){
    console.warn('[solar] persist customActs failed', e);
  }
}

// ── Custom activity / sub UI handlers ────────────────────────────────────
function solOpenAddActivity(itcId, sectionKey){
  if(!_solIsEditor()){
    if(typeof showToast === 'function') showToast('🔒 Solar Engineer login required','er');
    return;
  }
  const host = document.getElementById('sol-addact-form-'+itcId+'-'+sectionKey); if(!host) return;
  if(host.dataset.open === '1'){ host.innerHTML=''; host.dataset.open=''; return; }
  host.dataset.open = '1';
  host.innerHTML = `
    <div style="background:var(--card2);border:1px dashed var(--sol);border-radius:6px;padding:10px;margin:8px 0;">
      <div style="font-weight:700;font-size:10px;margin-bottom:6px;color:var(--sol);">+ New Activity (applies to all solar blocks)</div>
      <label style="font-size:8px;color:var(--t3);display:block;">Activity Name
        <input id="sol-newact-name-${itcId}-${sectionKey}" type="text" placeholder="e.g. Site Inspection"
          style="display:block;width:100%;margin-top:3px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;">
      </label>
      <label style="font-size:8px;color:var(--t3);display:block;margin-top:6px;">Sub-activities (comma-separated, optional)
        <input id="sol-newact-subs-${itcId}-${sectionKey}" type="text" placeholder="e.g. Step 1, Step 2, Step 3"
          style="display:block;width:100%;margin-top:3px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;">
      </label>
      <div style="display:flex;gap:6px;margin-top:8px;">
        <button class="btn btsol bts" style="font-size:9px;padding:4px 10px;" onclick="solSubmitNewActivity('${itcId}','${sectionKey}')">✓ Add Activity</button>
        <button class="btn bts" style="font-size:9px;padding:4px 10px;" onclick="document.getElementById('sol-addact-form-${itcId}-${sectionKey}').innerHTML='';document.getElementById('sol-addact-form-${itcId}-${sectionKey}').dataset.open=''">Cancel</button>
      </div>
    </div>`;
}

async function solSubmitNewActivity(itcId, sectionKey){
  const nameEl = document.getElementById('sol-newact-name-'+itcId+'-'+sectionKey);
  const subsEl = document.getElementById('sol-newact-subs-'+itcId+'-'+sectionKey);
  if(!nameEl) return;
  const name = (nameEl.value||'').trim();
  if(!name){ if(typeof showToast === 'function') showToast('❌ Name required','er'); return; }
  const subs = (subsEl ? (subsEl.value||'') : '').split(',').map(s=>s.trim()).filter(Boolean);
  if(typeof solAddCustomActivity !== 'function') return;
  const newKey = solAddCustomActivity(sectionKey, name, subs);
  if(!newKey){ if(typeof showToast === 'function') showToast('❌ Failed to add','er'); return; }
  await _solPersistCustomActs();
  if(typeof showToast === 'function') showToast('✅ Activity "'+name+'" added to all blocks','ok');
  rndrITC(itcId);
}

async function solRemoveAct(itcId, sectionKey, actKey){
  if(!_solIsEditor()) return;
  if(!confirm('Delete this custom activity from ALL solar blocks? This will also delete its progress data.')) return;
  if(typeof solRemoveCustomActivity !== 'function') return;
  const ok = solRemoveCustomActivity(sectionKey, actKey);
  if(!ok){ if(typeof showToast === 'function') showToast('🔒 Built-in activities cannot be removed','er'); return; }
  await _solPersistCustomActs();
  if(typeof showToast === 'function') showToast('🗑️ Activity removed','ok');
  // If the deleted activity's modal is open, close it
  if(_solModalOpen && _solModalOpen.actKey === actKey) solCloseActModal();
  rndrITC(itcId);
}

function solOpenAddSub(itcId, sectionKey, actKey){
  if(!_solIsEditor()){
    if(typeof showToast === 'function') showToast('🔒 Solar Engineer login required','er');
    return;
  }
  const host = document.getElementById('sol-addsub-form-'+itcId+'-'+sectionKey+'-'+actKey); if(!host) return;
  if(host.dataset.open === '1'){ host.innerHTML=''; host.dataset.open=''; return; }
  host.dataset.open = '1';
  host.innerHTML = `
    <div style="background:var(--card2);border:1px dashed var(--sol);border-radius:6px;padding:8px;margin:6px 0;">
      <label style="font-size:8px;color:var(--t3);display:block;">New Sub-activity Name (applies to all blocks)
        <input id="sol-newsub-name-${itcId}-${sectionKey}-${actKey}" type="text" placeholder="e.g. Final inspection"
          style="display:block;width:100%;margin-top:3px;background:var(--card);border:1px solid var(--b1);border-radius:3px;color:var(--t1);padding:4px 6px;font-size:10px;">
      </label>
      <div style="display:flex;gap:6px;margin-top:6px;">
        <button class="btn btsol bts" style="font-size:9px;padding:4px 10px;" onclick="solSubmitNewSub('${itcId}','${sectionKey}','${actKey}')">✓ Add</button>
        <button class="btn bts" style="font-size:9px;padding:4px 10px;" onclick="document.getElementById('sol-addsub-form-${itcId}-${sectionKey}-${actKey}').innerHTML='';document.getElementById('sol-addsub-form-${itcId}-${sectionKey}-${actKey}').dataset.open=''">Cancel</button>
      </div>
    </div>`;
}

async function solSubmitNewSub(itcId, sectionKey, actKey){
  const el = document.getElementById('sol-newsub-name-'+itcId+'-'+sectionKey+'-'+actKey);
  if(!el) return;
  const name = (el.value||'').trim();
  if(!name){ if(typeof showToast === 'function') showToast('❌ Name required','er'); return; }
  if(typeof solAddCustomSub !== 'function') return;
  const ok = solAddCustomSub(sectionKey, actKey, name);
  if(!ok){ if(typeof showToast === 'function') showToast('❌ Failed to add','er'); return; }
  await _solPersistCustomActs();
  if(typeof showToast === 'function') showToast('✅ Sub-activity added to all blocks','ok');
  _solRefreshAfterEdit(itcId);
}

async function solRemoveSub(itcId, sectionKey, actKey, mergedIdx){
  if(!_solIsEditor()) return;
  if(!confirm('Delete this custom sub-activity from ALL solar blocks?')) return;
  if(typeof solRemoveCustomSub !== 'function') return;
  const ok = solRemoveCustomSub(sectionKey, actKey, mergedIdx);
  if(!ok){ if(typeof showToast === 'function') showToast('🔒 Default sub-activities cannot be removed','er'); return; }
  await _solPersistCustomActs();
  if(typeof showToast === 'function') showToast('🗑️ Sub-activity removed','ok');
  _solRefreshAfterEdit(itcId);
}

// ═══════════════════════════════════════════════════════════

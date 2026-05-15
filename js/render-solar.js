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
  el.innerHTML=`
    <div class="ph" style="position:relative;">
      ${_pageLogoTR()}
      <div class="pht" style="color:var(--sol);display:flex;align-items:center;gap:8px;">${_solImg(22)} ${id} – Activity Dashboard</div>
      <div class="phs">${d.mw}MW | Progress: ${p}%</div>
    </div>
    <div class="kr" style="margin-bottom:10px;">
      ${d.acts.slice(0,5).map(a=>`<div class="kpi" style="padding:8px;"><div class="kb" style="background:${a.col}"></div><div class="kl">${a.n.substr(0,16)}</div><div class="kv" style="font-size:15px;color:${a.col}">${a.done}%</div></div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;">
      <!-- LEFT: Square activity grid -->
      <div>
        <div class="ph2" style="margin-bottom:8px;">
          <div class="pt">Activities — Click for sub-activity detail</div>
          <button class="btn btsol bts" onclick="reqLogin('solar',()=>openSolProg('${id}'))">Update</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px;" id="actg-${id}"></div>
        <div id="sol-subact-panel-${id}" style="display:none;margin-top:10px;"></div>
      </div>
      <!-- RIGHT: map double height + pie below -->
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
  setTimeout(()=>_renderActGrid(id),80);
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

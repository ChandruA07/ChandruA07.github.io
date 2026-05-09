//  SOLAR
// ═══════════════════════════════════════════════════════════
function rndrSolar(){
  const sol=calcSolarProg();
  _pageLogoTR();
  // Section nav
  if(typeof injectSecNav==='function') injectSecNav('view-solar',[
    {id:'sol-kr',   label:'KPIs',      icon:'📊'},
    {id:'itc-cards',label:'ITC Cards', icon:'🔆'},
    {id:'sol-chart',label:'Progress',  icon:'📈'},
  ]);
  // KPIs: Only Overall, Manpower, Charge Ready (remove ITC1/2/3)
  document.getElementById('sol-kr').innerHTML=`
    <div class="kpi"><div class="kb" style="background:var(--sol)"></div><div class="kl">Solar Overall</div><div class="kv" style="color:var(--sol)">${sol}%</div></div>
    <div class="kpi"><div class="kb" style="background:var(--land)"></div><div class="kl">Manpower</div><div class="kv" style="color:var(--land)">14</div></div>
    <div class="kpi"><div class="kb" style="background:var(--er)"></div><div class="kl">Charge Ready</div><div class="kv" style="color:var(--er)">0 MWp</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Total ITCs</div><div class="kv" style="color:var(--ok)">6</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ac)"></div><div class="kl">Total MW</div><div class="kv" style="color:var(--ac)">70.4</div></div>`;
  const g=document.getElementById('itc-cards');if(!g)return;
  g.innerHTML=Object.entries(DB.solar.itcs).map(([id,d])=>{
    const p=calcITCProg(id);const r=34,ci=2*Math.PI*r,off=ci*(1-p/100);
    return`<div class="itcc" onclick="openITC('${id}')">
      <div style="display:flex;align-items:center;justify-content:center;gap:5px;font-family:var(--f2);font-size:11px;font-weight:700;color:var(--sol);">${_solImg(16)} ${id}</div>
      <div style="font-size:8px;color:var(--t3);margin-bottom:2px;">${d.mw}MW</div>
      <svg width="72" height="72" class="ring-svg" style="display:block;margin:3px auto;">
        <circle class="ring-bg" cx="36" cy="36" r="${r}"/>
        <circle class="ring-fg" cx="36" cy="36" r="${r}" stroke="${p>0?'var(--sol)':'var(--b3)'}" stroke-dasharray="${ci.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/>
        <text x="36" y="40" text-anchor="middle" fill="${p>0?'var(--sol)':'var(--t3)'}" style="font-family:var(--f2);font-size:12px;font-weight:700;" transform="rotate(90,36,36)">${p}%</text>
      </svg>
      <div class="chip ${p>=100?'cg':p>0?'cy':'cb'}" style="font-size:8px;">${p>=100?'Done':p>0?'WIP':'Pending'}</div>
    </div>`;
  }).join('');
  const ids=Object.keys(DB.solar.itcs);
  mkCWIP('ch-sol-det',ids,ids.map(id=>calcITCProg(id)));
}
function openITC(id){curITC=id;nav('itc',{itc:id});}

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
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;" id="actg-${id}"></div>
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
  setTimeout(()=>{
    const g=document.getElementById('actg-'+id);if(!g)return;
    g.innerHTML=d.acts.map((a,i)=>`
      <div onclick="showSolActDetail('${id}',${i})"
        style="aspect-ratio:1;background:var(--card2);border:2px solid ${a.done>0?a.col:'var(--b1)'};border-radius:10px;
               display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
               cursor:pointer;padding:6px;text-align:center;transition:all .18s;"
        onmouseover="this.style.borderColor='${a.col}';this.style.transform='scale(1.04)'"
        onmouseout="this.style.borderColor='${a.done>0?a.col:'var(--b1)'}';this.style.transform='scale(1)'">
        <div style="font-size:8px;font-weight:700;color:var(--t2);line-height:1.2;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${a.n}</div>
        <div style="font-family:var(--f2);font-size:16px;font-weight:800;color:${a.col};line-height:1;">${a.done}%</div>
        <div style="height:4px;width:80%;background:var(--b1);border-radius:2px;overflow:hidden;">
          <div style="width:${a.done}%;height:100%;background:${a.col};border-radius:2px;"></div>
        </div>
      </div>`).join('');
  },80);
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
  subPanel.innerHTML=`
    <div style="background:var(--card2);border:1px solid ${a.col};border-radius:8px;padding:10px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-family:var(--f2);font-size:11px;font-weight:700;color:${a.col};">${a.n} — Sub-Activities</div>
        <button onclick="document.getElementById('sol-subact-panel-${itcId}').style.display='none'" style="background:none;border:1px solid var(--b1);color:var(--t3);width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:9px;">✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div style="font-size:9px;color:var(--t3);">Total Scope:</div>
        <input type="number" value="${scope}" min="0"
          style="width:80px;background:var(--card3);border:1px solid var(--b1);border-radius:4px;color:var(--t2);padding:3px 6px;font-size:9px;"
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
            <input type="number" value="${sv}" min="0" max="${scope}"
              style="width:60px;background:var(--card3);border:1px solid var(--b1);border-radius:4px;color:var(--t2);padding:2px 5px;font-size:9px;"
              onchange="updateSolSubAct('${itcId}',${idx},${si},+this.value)">
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function updateSolSubScope(itcId,actIdx,newScope){
  const a=DB.solar.itcs[itcId]?.acts[actIdx];if(!a)return;
  a.subScope=newScope;scheduleSave();
  // Reopen the panel to refresh display
  showSolActDetail(itcId,actIdx);
}

function updateSolSubAct(itcId,actIdx,subIdx,newVal){
  const a=DB.solar.itcs[itcId]?.acts[actIdx];if(!a)return;
  if(!a.subDone)a.subDone=a.subActs.map(()=>0);
  a.subDone[subIdx]=newVal;
  // Recalculate activity done% from sub-acts
  const scope=a.subScope||100;
  if(scope>0){
    const totalDone=a.subDone.reduce((s,v)=>s+v,0);
    const maxDone=scope*a.subActs.length;
    a.done=Math.min(100,R(totalDone/scope/a.subActs.length*100));
  }
  scheduleSave();
  // Refresh everything
  updateOverallBars();
  _renderActGrid(itcId);
  showSolActDetail(itcId,actIdx);
  showToast('Sub-activity updated!','ok');
}

// ── Map upload with password ─────────────────────────────────────────────────
function triggerMapUpload(itcId){
  document.getElementById('p-t').textContent='Authorize Map Upload – '+itcId;
  document.getElementById('p-b').innerHTML=`
    <div class="al al-w" style="margin-bottom:9px;">ITC Map upload requires authorization.</div>
    <div class="fg"><label class="fl">Password</label><input class="fi" id="map-pwd-input" type="password" placeholder="Enter password" autocomplete="off"></div>
    <div class="le" id="map-pwd-err"></div>
    <div style="display:flex;gap:7px;margin-top:10px;">
      <button class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
      <button class="btn btsol" style="flex:1;" onclick="verifyMapPwd('${itcId}')">Unlock Upload</button>
    </div>`;
  ov('pov');
}
function verifyMapPwd(itcId){
  const pwd=document.getElementById('map-pwd-input')?.value||'';
  const errEl=document.getElementById('map-pwd-err');
  const valid=Object.values(USERS).some(u=>u.pwd===pwd&&(u.role==='all'||u.role==='solar'));
  if(!valid){if(errEl)errEl.textContent='Incorrect password.';return;}
  cov('pov');
  const input=document.getElementById('itc-map-file-'+itcId);
  if(input)input.click();
}
function handleMapUpload(itcId,input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=function(e){
    ITC_MAPS[itcId]=e.target.result;
    const imgBox=document.getElementById('itc-map-img-box-'+itcId);
    if(imgBox)imgBox.innerHTML=`<img src="${e.target.result}" style="width:100%;max-height:380px;object-fit:contain;" alt="${itcId} Map">`;
    showToast(itcId+' map uploaded!','ok');
  };
  reader.readAsDataURL(file);input.value='';
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

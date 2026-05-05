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
function subSolProg(e,id){
  e.preventDefault();const actName=document.getElementById('tp-act').value;const cum=+document.getElementById('tp-cum').value;const td=+document.getElementById('tp-td').value;const mp=+document.getElementById('tp-mp').value;
  const act=DB.solar.itcs[id].acts.find(a=>a.n===actName);if(act){act.done=Math.min(100,cum);act.today=td;}
  DB.mp.sol+=mp;updateKpiMp();scheduleSave();cov('pov');showToast(`✅ Solar ${actName}: ${cum}%`,'ok');
  rndrITC(id);updateOverallBars();
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
function subWtgProg(e,id){
  e.preventDefault();const [type,idx]=document.getElementById('wtp-act').value.split(':');const p=+document.getElementById('wtp-p').value;const mp=+document.getElementById('wtp-mp').value;
  const t=DB.wtg.turbines.find(x=>x.id===id);
  if(t){if(type==='civil')t.civil[+idx]=p;else if(type==='mech')t.mech[+idx]=p;else if(type==='uss')t.uss=p;else t.sup=p;}
  DB.mp.wtg+=mp;updateKpiMp();scheduleSave();cov('pov');cov('tov');showToast(`✅ WTG ${id} | ${type}: ${p}%`,'ok');
  if(CV==='wtg'){rndrWtg();wTab(curWT);}updateOverallBars();
}
function updateKpiMp(){const el=document.getElementById('kpi-mp');if(el)el.textContent=14+DB.mp.sol+DB.mp.wtg+DB.mp.bop;}

// ═══════════════════════════════════════════════════════════
//  POD
// ═══════════════════════════════════════════════════════════
function rndrPod(){
  // Inject custom icons into tab labels
  const si=document.getElementById('ptb-sol-icon');if(si)si.innerHTML=_solImg(14);
  const wi=document.getElementById('ptb-wtg-icon');if(wi)wi.innerHTML=_turbImg(14,'');
  const bi=document.getElementById('ptb-bop-icon');if(bi)bi.innerHTML=_bopImg(14);
  podTab(curPT==='l'?'s':curPT);
}

function podTab(t){
  curPT=t;
  // Only s, w, b tabs (Land removed)
  ['s','w','b'].forEach(k=>{
    const el=document.getElementById('ptb-'+k);
    if(el)el.className='stb'+(k===t?` on-${k}`:'');
  });
  // Hide land tab if present
  const ltb=document.getElementById('ptb-l');if(ltb)ltb.style.display='none';

  const el=document.getElementById('pod-ct');if(!el)return;
  const btnMap={
    s:`<button class="btn btsol bts" onclick="openPODForm('s')">${_solImg(13)} Submit Solar POD</button>`,
    w:`<button class="btn btwt bts" onclick="openPODForm('w')">${_turbImg(13,'')} Submit WTG POD</button>`,
    b:`<button class="btn btbo bts" onclick="openPODForm('b')">${_bopImg(13)} Submit BOP POD</button>`
  };
  const labels={s:'Solar',w:'WTG',b:'BOP'};
  const entries=DB.pod[t]||[];
  el.innerHTML=`
    <div class="pnl" style="position:relative;">
      ${_pageLogoTR()}
      <div class="ph2">
        <div class="pt">Plan of Day — ${labels[t]} | No login required</div>
        ${btnMap[t]||''}
      </div>
      <div class="al al-i" style="margin-bottom:9px;">ℹ️ POD = Planned work for today. Actual progress update requires login from module pages.</div>
      ${entries.length
        ? entries.slice().reverse().map(x=>`
          <div style="background:var(--card3);border:1px solid var(--b2);border-radius:8px;padding:10px;margin-bottom:7px;font-size:10px;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
              <b style="color:var(--t1);">${x.activity}</b>
              <span class="chip cg" style="font-size:8px;">✓ Planned</span>
            </div>
            <div class="mst">
              <div class="ms">Qty: <b>${x.qty||'—'}</b></div>
              <div class="ms">MP: <b>${x.mp}</b></div>
              <div class="ms">By: <b>${x.by}</b></div>
              <div class="ms">At: <b>${x.time}</b></div>
              ${x.contractor?`<div class="ms">Con: <b>${x.contractor}</b></div>`:''}
            </div>
            ${x.notes?`<div style="color:var(--t3);margin-top:3px;font-size:9px;">📝 ${x.notes}</div>`:''}
          </div>`).join('')
        : `<div style="color:var(--t3);font-size:10px;padding:12px 0;">No POD entries yet for ${labels[t]}. Click Submit to add.</div>`
      }
    </div>`;
}

// Solar activities list (from SOL_ACT_DEFS global)
function _solarActsList(itcId){
  return SOL_ACT_DEFS.map(d=>d.n);
}
// WTG activities list
function _wtgActsList(){
  return [...DB.wtg.civil.map(a=>a.n),...DB.wtg.mech.map(a=>a.n),'USS Works','Supply Complete'];
}
// BOP activities list (by section)
function _bopActsList(sec){
  if(sec==='PSS')return Object.keys(DB.pss.acts);
  if(sec==='GSS')return Object.keys(DB.gss.acts);
  const key=sec&&sec.includes('33')?'33kv':'66kv';
  return DB.bopActDefs[key].map(a=>a.n);
}

function openPODForm(t){
  const titles={s:'Solar POD – Plan of Day',w:'WTG POD – Plan of Day',b:'BOP POD – Plan of Day'};
  document.getElementById('p-t').textContent=titles[t]||'POD';
  document.getElementById('p-b').innerHTML=_buildPODForm(t);
  ov('pov');
}

function _buildPODForm(t){
  if(t==='s'){
    const itcOpts=Object.keys(DB.solar.itcs).map(i=>`<option value="${i}">${i}</option>`).join('');
    const firstActs=_solarActsList('ITC-1');
    const actOpts=firstActs.map(a=>`<option value="${a}">${a}</option>`).join('');
    return `<form onsubmit="subPOD(event,'s')">
      <div class="fr">
        <div class="fg"><label class="fl">ITC</label>
          <select class="fs" id="pf-itc" onchange="updateSolarPODActs(this.value)">${itcOpts}</select>
        </div>
        <div class="fg"><label class="fl">Activity</label>
          <select class="fs" id="pf-act" onchange="document.getElementById('pf-other-wrap').style.display=this.value==='__other__'?'block':'none'">
            ${actOpts}
            <option value="__other__">— Other (type below) —</option>
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
      <div class="fg"><label class="fl">Contractor</label><input class="fi" id="pf-con" placeholder="Contractor / Agency"></div>
      <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pf-nt" placeholder="Notes..."></textarea></div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btsol" style="flex:1;">${_solImg(12)} Submit Solar POD</button>
      </div>
    </form>`;
  }
  if(t==='w'){
    const turbOpts=DB.wtg.turbines.map(t=>`<option value="${t.id}">${t.id}</option>`).join('');
    const actOpts=_wtgActsList().map(a=>`<option value="${a}">${a}</option>`).join('')+
      '<option value="__other__">— Other (specify below) —</option>';
    return `<form onsubmit="subPOD(event,'w')">
      <div class="fr">
        <div class="fg"><label class="fl">Turbine</label><select class="fs" id="pf-turb">${turbOpts}</select></div>
        <div class="fg"><label class="fl">Activity</label>
          <select class="fs" id="pf-act">
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
      <div class="fg"><label class="fl">Contractor</label><input class="fi" id="pf-con" placeholder="Contractor"></div>
      <div class="fg"><label class="fl">Submitted By</label><input class="fi" id="pf-by" placeholder="Name" required></div>
      <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pf-nt" placeholder="Notes..."></textarea></div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btwt" style="flex:1;">${_turbImg(12,'')} Submit WTG POD</button>
      </div>
    </form>
    <script>
      document.getElementById('pf-act').addEventListener('change',function(){
        document.getElementById('pf-other-wrap').style.display=this.value==='__other__'?'block':'none';
      });
    <\/script>`;
  }
  if(t==='b'){
    const secOpts=['33kV','66kV','PSS','GSS'].map(s=>`<option value="${s}">${s}</option>`).join('');
    const firstActs=_bopActsList('33kV');
    const actOpts=firstActs.map(a=>`<option value="${a}">${a}</option>`).join('')+
      '<option value="__other__">— Other (specify below) —</option>';
    return `<form onsubmit="subPOD(event,'b')">
      <div class="fr">
        <div class="fg"><label class="fl">Section</label>
          <select class="fs" id="pf-sec" onchange="updateBOPPODActs(this.value)">${secOpts}</select>
        </div>
        <div class="fg"><label class="fl">Activity</label>
          <select class="fs" id="pf-act">
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
      <div class="fg"><label class="fl">Contractor</label><input class="fi" id="pf-con" placeholder="Contractor"></div>
      <div class="fg"><label class="fl">Submitted By</label><input class="fi" id="pf-by" placeholder="Name" required></div>
      <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pf-nt" placeholder="Notes..."></textarea></div>
      <div style="display:flex;gap:7px;margin-top:9px;">
        <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
        <button type="submit" class="btn btbo" style="flex:1;">${_bopImg(12)} Submit BOP POD</button>
      </div>
    </form>
    <script>
      document.getElementById('pf-act').addEventListener('change',function(){
        document.getElementById('pf-other-wrap').style.display=this.value==='__other__'?'block':'none';
      });
      document.getElementById('pf-sec').addEventListener('change',function(){
        updateBOPPODActs(this.value);
      });
    <\/script>`;
  }
  return '';
}

// Dynamic activity update when ITC changes (Solar POD)
function updateSolarPODActs(itcId){
  const sel=document.getElementById('pf-act');if(!sel)return;
  const acts=_solarActsList(itcId);
  sel.innerHTML=acts.map(a=>`<option value="${a}">${a}</option>`).join('')+
    '<option value="__other__">— Other (specify below) —</option>';
  document.getElementById('pf-other-wrap').style.display='none';
}
// Dynamic activity update when BOP section changes
function updateBOPPODActs(sec){
  const sel=document.getElementById('pf-act');if(!sel)return;
  const acts=_bopActsList(sec);
  sel.innerHTML=acts.map(a=>`<option value="${a}">${a}</option>`).join('')+
    '<option value="__other__">— Other (specify below) —</option>';
  document.getElementById('pf-other-wrap').style.display='none';
}

function subPOD(e,t){
  e.preventDefault();
  // Resolve activity: if "Other" selected, use the text input
  let act=document.getElementById('pf-act')?.value||'';
  if(act==='__other__'){
    act=document.getElementById('pf-other')?.value?.trim()||'Other';
  }
  // Append turbine or ITC prefix if available
  const itc=document.getElementById('pf-itc')?.value||'';
  const turb=document.getElementById('pf-turb')?.value||'';
  const sec=document.getElementById('pf-sec')?.value||'';
  const actLabel=[itc||turb||sec,act].filter(Boolean).join(' › ');

  const qty=document.getElementById('pf-qty')?.value||'—';
  const date=document.getElementById('pf-date')?.value||new Date().toISOString().slice(0,10);
  const mp=+(document.getElementById('pf-mp')?.value||0);
  const by=document.getElementById('pf-by')?.value||'—';
  const nt=document.getElementById('pf-nt')?.value||'';
  const con=document.getElementById('pf-con')?.value||'';

  if(!DB.pod[t])DB.pod[t]=[];
  DB.pod[t].push({activity:actLabel,qty,date:document.getElementById("pf-date")?.value||"",mp,contractor:con,by,notes:nt,time:new Date().toLocaleTimeString()});

  const podEl=document.getElementById('mc-pod');
  if(podEl)podEl.textContent=DB.pod.s.length+DB.pod.w.length+DB.pod.l.length+DB.pod.b.length;

  cov('pov');
  showToast('✅ POD Submitted: '+actLabel,'ok');
  scheduleSave();
  rndrPod();
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
  specEmps.forEach(se=>{if(!HSE_DB.employees.find(e=>e.code===se.code))HSE_DB.employees.push(se);});

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
            <td><b>${o.loc}</b></td>
            <td style="font-size:9px;max-width:120px;">${o.obs}</td>
            <td style="text-align:center;">
              ${o.photo?`<img src="${o.photo}" style="width:32px;height:32px;object-fit:cover;border-radius:3px;cursor:pointer;" onclick="viewObsPhoto('${oi}')">`
                       :`<label style="cursor:pointer;font-size:8px;color:#1565c0;text-decoration:underline;">Upload<input type="file" accept="image/*" style="display:none;" onchange="uploadObsPhoto(${oi},this)"></label>`}
            </td>
            <td>${o.vendor}</td><td style="font-size:9px;">${o.raisedDate}</td>
            <td style="color:#1565c0;">${o.raisedBy}</td>
            <td><span class="chip ${o.status==='Closed'?'cg':'cy'}">${o.status}</span></td>
            <td>${o.closedBy||'—'}</td>
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
              ${e.photo?`<img src="${e.photo}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;">`:
                `<div style="width:28px;height:28px;border-radius:50%;background:#1565c0;color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;">${e.name.charAt(0).toUpperCase()}</div>`}
              <div style="flex:1;min-width:0;">
                <div style="font-size:9px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.name}</div>
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
function uploadObsPhoto(idx,input){
  const file=input.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{HSE_DB.observations[idx].photo=e.target.result;scheduleSave();rndrSafety();showToast('Photo uploaded!','ok');};
  reader.readAsDataURL(file);
}
function viewObsPhoto(idx){
  const o=HSE_DB.observations[idx];if(!o||!o.photo)return;
  document.getElementById('p-t').textContent='Observation Photo';
  document.getElementById('p-b').innerHTML=`<img src="${o.photo}" style="width:100%;border-radius:8px;"><div style="margin-top:8px;font-size:9px;color:var(--t3);">${o.obs} — ${o.raisedDate}</div><button class="btn" style="margin-top:8px;width:100%;" onclick="cov('pov')">Close</button>`;
  ov('pov');
}
function editObs(idx){
  const o=HSE_DB.observations[idx];if(!o)return;
  document.getElementById('p-t').textContent='Edit Observation';
  document.getElementById('p-b').innerHTML=`
    <div class="fr"><div class="fg"><label class="fl">Status</label><select class="fs" id="eo-status"><option ${o.status==='Open'?'selected':''}>Open</option><option ${o.status==='Closed'?'selected':''}>Closed</option></select></div>
    <div class="fg"><label class="fl">Closed By</label><input class="fi" id="eo-closedby" value="${o.closedBy||''}"></div></div>
    <div class="fg"><label class="fl">Observation</label><textarea class="fta" id="eo-obs">${o.obs}</textarea></div>
    <div style="display:flex;gap:7px;margin-top:8px;">
      <button class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button class="btn" style="flex:1;background:#1565c0;color:#fff;border:none;" onclick="saveObsEdit(${idx})">Save</button>
    </div>`;
  ov('pov');
}
function saveObsEdit(idx){
  const o=HSE_DB.observations[idx];if(!o)return;
  o.obs=document.getElementById('eo-obs').value;
  o.status=document.getElementById('eo-status').value;
  o.closedBy=document.getElementById('eo-closedby').value;
  HSE_DB.kpis.open=HSE_DB.observations.filter(x=>x.status==='Open').length;
  HSE_DB.kpis.closed=HSE_DB.observations.filter(x=>x.status==='Closed').length;
  scheduleSave();cov('pov');rndrSafety();showToast('Observation updated!','ok');
}
function editEmployee(code){
  const e=HSE_DB.employees.find(x=>x.code===code);if(!e)return;
  document.getElementById('p-t').textContent='Edit Employee: '+code;
  document.getElementById('p-b').innerHTML=`
    <div class="fg"><label class="fl">Name</label><input class="fi" id="ee-name" value="${e.name}"></div>
    <div class="fg"><label class="fl">Safety Score (0-100)</label><input class="fi" id="ee-score" type="number" min="0" max="100" value="${e.score}"></div>
    <div style="display:flex;gap:7px;margin-top:8px;">
      <button class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button class="btn" style="flex:1;background:#1565c0;color:#fff;border:none;" onclick="saveEmpEdit('${code}')">Save</button>
    </div>`;
  ov('pov');
}
function saveEmpEdit(code){
  const e=HSE_DB.employees.find(x=>x.code===code);if(!e)return;
  e.name=document.getElementById('ee-name').value;
  e.score=+document.getElementById('ee-score').value||e.score;
  scheduleSave();cov('pov');rndrSafety();showToast('Employee updated!','ok');
}
function removeEmployee(code){
  if(!confirm('Remove employee '+code+'?'))return;
  HSE_DB.employees=HSE_DB.employees.filter(e=>e.code!==code);
  scheduleSave();rndrSafety();showToast('Employee removed','wn');
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
    <div style="display:flex;gap:7px;margin-top:9px;">
      <button type="button" class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button type="button" class="btn" style="flex:1;background:#1565c0;color:#fff;border:none;" onclick="submitHSEObservation()">Submit</button>
    </div>`;
  ov('pov');
}
function submitHSEObservation(){
  const loc=document.getElementById('hse-loc').value;
  const obs=document.getElementById('hse-obs').value.trim();
  const by=document.getElementById('hse-by').value.trim();
  if(!obs||!by){showToast('Observation and Raised By required','er');return;}
  const today=new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric'}).replace(/\//g,'-');
  HSE_DB.observations.push({loc,obs,photo:'',vendor:document.getElementById('hse-vendor').value||'—',raisedDate:today,raisedBy:by,status:document.getElementById('hse-status').value,closedBy:document.getElementById('hse-closedby').value||'',closedPhoto:'',avgTime:'—',risk:document.getElementById('hse-risk').value});
  HSE_DB.kpis.raised=HSE_DB.observations.length;
  HSE_DB.kpis.open=HSE_DB.observations.filter(o=>o.status==='Open').length;
  HSE_DB.kpis.closed=HSE_DB.observations.filter(o=>o.status==='Closed').length;
  scheduleSave();cov('pov');rndrSafety();showToast('Observation added!','ok');
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
function submitEmployee(){
  const code=document.getElementById('emp-code').value.trim();
  const name=document.getElementById('emp-name').value.trim();
  const score=+document.getElementById('emp-score').value||50;
  if(!code||!name){showToast('Code and Name required','er');return;}
  const ex=HSE_DB.employees.find(e=>e.code===code);
  if(ex){ex.name=name;ex.score=score;}else HSE_DB.employees.push({code,name,score,photo:''});
  scheduleSave();cov('pov');rndrSafety();showToast('Employee saved!','ok');
}

function rndrMp(){
  const tot=14+DB.mp.sol+DB.mp.wtg+DB.mp.bop;
  document.getElementById('mp-ct').innerHTML=`${_pageLogoTR()}
    <div class="ph"><div class="pht">👷 Manpower & Equipment</div></div>
    <div class="kr">
      <div class="kpi"><div class="kb" style="background:var(--ac)"></div><div class="kl">Total Today</div><div class="kv" style="color:var(--ac)">${tot}</div></div>
      <div class="kpi"><div class="kb" style="background:var(--sol)"></div><div class="kl">Solar</div><div class="kv" style="color:var(--sol)">8</div></div>
      <div class="kpi"><div class="kb" style="background:var(--wtg)"></div><div class="kl">WTG</div><div class="kv" style="color:var(--wtg)">4</div></div>
      <div class="kpi"><div class="kb" style="background:var(--bop)"></div><div class="kl">BOP</div><div class="kv" style="color:var(--bop)">2</div></div>
      <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Skilled</div><div class="kv" style="color:var(--ok)">8</div></div>
      <div class="kpi"><div class="kb" style="background:var(--wn)"></div><div class="kl">Unskilled</div><div class="kv" style="color:var(--wn)">6</div></div>
    </div>
    <div class="g2">
      <div class="pnl"><div class="ph2"><div class="pt">📊 Distribution</div></div><div class="ch h240"><canvas id="ch-mpd"></canvas></div></div>
      <div class="pnl"><div class="ph2"><div class="pt">🧑‍🔧 Skilled vs Unskilled</div></div><div class="ch h240"><canvas id="ch-mps"></canvas></div></div>
    </div>
    <div class="pnl"><div class="ph2"><div class="pt">🔧 Equipment on Site</div></div>
      <div class="eqg">${[['🏗️','Crane','1','100T Mobile'],['🚜','JCB','3','2 Active+1 Standby'],['🚛','Transit Mixer','2','Casting Support'],['🔩','Hitch/Trailer','2','Blade Transport'],['🏎️','Concrete Pump','1','Foundation'],['🚧','Dewatering Pump','2','MKD-211'],['🛻','Piling Rig','1','ITC-1'],['⚙️','Compactor','2','Roads'],['🛢️','Water Tanker','1','Curing'],['🚒','Pickup','4','Transport'],['🔦','DG Set','2','Power'],['🏗️','Tower Crane','0','Not Mobilized']].map(([e,n,v,s])=>`<div class="eqc"><div class="eqe">${e}</div><div class="eqn">${n}</div><div class="eqv" style="color:${v==='0'?'var(--er)':'var(--ac)'};">${v}</div><div class="eqs">${s}</div></div>`).join('')}</div>
    </div>
    <div class="pnl"><div class="ph2"><div class="pt">👷 Crew Breakdown</div></div>
      <div class="tsc"><table class="tbl"><thead><tr><th>Category</th><th>Team</th><th>Count</th><th>Type</th><th>Location</th></tr></thead>
      <tbody>
        <tr><td>Site Manager</td><td>Mgmt</td><td>1</td><td><span class="chip cb">Management</span></td><td>All</td></tr>
        <tr><td>Civil Engineers</td><td>Solar+WTG</td><td>2</td><td><span class="chip cb">Skilled</span></td><td>ITC-1, WTG</td></tr>
        <tr><td>Supervisors</td><td>All</td><td>2</td><td><span class="chip cb">Skilled</span></td><td>Multi</td></tr>
        <tr><td>Piling Crew</td><td>Solar</td><td>3</td><td><span class="chip cy">Skilled</span></td><td>ITC-1</td></tr>
        <tr><td>MMS Erection</td><td>Solar</td><td>2</td><td><span class="chip cy">Skilled</span></td><td>ITC-1</td></tr>
        <tr><td>Foundation Workers</td><td>WTG</td><td>4</td><td><span class="chip cy">Semi</span></td><td>MOB-142</td></tr>
        <tr><td>BOP Roads Crew</td><td>BOP</td><td>2</td><td><span class="chip cr">Unskilled</span></td><td>Roads</td></tr>
        <tr><td>General Labour</td><td>All</td><td>4</td><td><span class="chip cr">Unskilled</span></td><td>Various</td></tr>
        <tr><td>Safety Officer</td><td>HSE</td><td>1</td><td><span class="chip cg">Certified</span></td><td>All</td></tr>
      </tbody></table></div>
    </div>`;
  setTimeout(()=>{
    mkC('ch-mpd',{type:'doughnut',data:{labels:['Piling','MMS','WTG Civil','BOP 33kV','BOP 66kV','Engineers','Safety'],datasets:[{data:[3,2,4,1,1,2,1],backgroundColor:['#ffaa00','#ff8800','#7c4dff','#9c27b0','#ff9800','#00c8ff','#00c853'],borderWidth:2,borderColor:'var(--bg2)'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right',labels:{font:{size:9}}}}}});
    mkC('ch-mps',{type:'bar',data:{labels:['Solar','WTG','BOP','Mgmt','HSE'],datasets:[{label:'Skilled',data:[4,2,1,3,1],backgroundColor:'rgba(0,200,255,.72)',borderRadius:4},{label:'Semi',data:[1,2,0,0,0],backgroundColor:'rgba(255,170,0,.72)',borderRadius:4},{label:'Unskilled',data:[3,0,1,0,0],backgroundColor:'rgba(255,82,82,.72)',borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}}});
  },80);
}

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

function rndrMap(){
  if(mapInst){mapInst.remove();mapInst=null;}
  const mc=document.getElementById('map-ct');
  if(mc&&!mc.querySelector('.page-logo-tr')){mc.insertAdjacentHTML('afterbegin',_pageLogoTR());}

  function mkTurbIcon(col,glow,size=22){
    return L.divIcon({className:'',
      html:`<div style="position:relative;width:${size}px;height:${size}px;">
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
    // Center map to cover full 33kV route (GSS to PSS)
    mapInst=L.map('sitemap').setView([14.848,76.405],12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OpenStreetMap'}).addTo(mapInst);

    // ── PSS square marker (from KML) ──
    const pssIcon=L.divIcon({className:'',html:`<div style="width:18px;height:18px;background:#00bcd4;border:2px solid #fff;box-shadow:0 0 12px rgba(0,188,212,.7);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">P</div>`,iconSize:[18,18],iconAnchor:[9,9]});
    L.marker([KML_PSS_LOC.lat,KML_PSS_LOC.lng],{icon:pssIcon}).addTo(mapInst)
      .bindPopup(`<b>🏭 PSS – Power Sub Station</b><br>Lat: ${KML_PSS_LOC.lat.toFixed(5)}, Lng: ${KML_PSS_LOC.lng.toFixed(5)}<br>33kV & 66kV Termination`);
    const d=0.0005;
    L.rectangle([[KML_PSS_LOC.lat-d,KML_PSS_LOC.lng-d],[KML_PSS_LOC.lat+d,KML_PSS_LOC.lng+d]],{color:'#00bcd4',weight:2,fillOpacity:0.15,dashArray:'4,2'}).addTo(mapInst);

    // ── GSS square marker (from KML) ──
    const gssIcon=L.divIcon({className:'',html:`<div style="width:18px;height:18px;background:#8bc34a;border:2px solid #fff;box-shadow:0 0 12px rgba(139,195,74,.7);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;">G</div>`,iconSize:[18,18],iconAnchor:[9,9]});
    L.marker([KML_GSS_LOC.lat,KML_GSS_LOC.lng],{icon:gssIcon}).addTo(mapInst)
      .bindPopup(`<b>⚡ GSS – KPTHL Grid Sub Station 220/66kV</b><br>Lat: ${KML_GSS_LOC.lat.toFixed(5)}, Lng: ${KML_GSS_LOC.lng.toFixed(5)}`);
    L.rectangle([[KML_GSS_LOC.lat-d,KML_GSS_LOC.lng-d],[KML_GSS_LOC.lat+d,KML_GSS_LOC.lng+d]],{color:'#8bc34a',weight:2,fillOpacity:0.15,dashArray:'4,2'}).addTo(mapInst);

    // ── 33kV SPDC Main Line (from KML, 39 pts) ──
    L.polyline(KML_33KV_MAIN,{color:'#9c27b0',weight:3,opacity:.9}).addTo(mapInst)
      .bindPopup('<b>🔋 33kV SPDC Main Line – 12.7km (Tower Route)</b><br>39 waypoints | GSS → PSS');

    // ── 33kV SPSC Feeder (from KML, 12 pts) ──
    L.polyline(KML_33KV_SPSC,{color:'#e91e63',weight:2.5,opacity:.85,dashArray:'8,4'}).addTo(mapInst)
      .bindPopup('<b>🔋 33kV SPSC Feeder – PSS F#1&3 to TAP-3A (1.5km)</b>');

    // ── 33kV DOG Line to Block 2 ──
    L.polyline(KML_33KV_DOG,{color:'#ff5722',weight:2,opacity:.8,dashArray:'5,5'}).addTo(mapInst)
      .bindPopup('<b>🔋 33kV DOG Line – Block 2 DP Pole</b>');

    // ── DP/SP Poles ──
    KML_DP_POLES.forEach(p=>{
      const ic=L.divIcon({className:'',html:`<div style="width:8px;height:8px;background:#9c27b0;border:1.5px solid #fff;border-radius:50%;"></div>`,iconSize:[8,8],iconAnchor:[4,4]});
      L.marker([p.lat,p.lng],{icon:ic}).addTo(mapInst).bindPopup(`<b>${p.name}</b><br>Lat:${p.lat.toFixed(5)}, Lng:${p.lng.toFixed(5)}`);
    });

    // ── 66kV EHV Line ──
    L.polyline(EHV_66KV_TOWERS.map(t=>[t.lat,t.lng]),{color:'#ff9800',weight:2.5,opacity:.85}).addTo(mapInst)
      .bindPopup('<b>🔌 66kV EHV Line – PSS to GSS (12.75km)</b><br>65 Towers + 7 Gantries');
    EHV_66KV_TOWERS.forEach(tw=>{
      if(tw.type==='terminal')return;
      const isG=tw.type==='gantry';
      const col=isG?'#ff9800':'#ffd54f';
      const sz=isG?12:8;
      const ic=L.divIcon({className:'',html:`<div style="width:${sz}px;height:${sz}px;background:${col};border:1.5px solid #fff;${isG?'border-radius:2px;':'border-radius:50%;'}opacity:.9;"></div>`,iconSize:[sz,sz],iconAnchor:[sz/2,sz/2]});
      L.marker([tw.lat,tw.lng],{icon:ic}).addTo(mapInst).bindPopup(`<b>🔌 ${tw.id}</b><br>${tw.type}`);
    });

    // ── Solar ITC ──
    L.marker([14.832892,76.468903],{icon:mkSolarIcon(30)}).addTo(mapInst)
      .bindPopup(`<b>☀️ ITC-1 – 13.2MW</b><br>Progress: ${calcITCProg('ITC-1')}%`);

    // ── WTG turbines ──
    const WTG_COORDS=[
      {id:'MBI-12',lat:14.7426,lng:76.4535},{id:'MKD-258',lat:14.7274,lng:76.4779},
      {id:'KDK-462',lat:14.7419,lng:76.4657},{id:'MOB-403',lat:14.8576,lng:76.3799},
      {id:'BDK-85',lat:14.8767,lng:76.3509},{id:'MKD-253',lat:14.7255,lng:76.4843},
      {id:'AMK-264',lat:14.8710,lng:76.4035},{id:'CDP-221',lat:14.8215,lng:76.4113},
      {id:'MOB-142',lat:14.8661,lng:76.4045},{id:'MKD-211',lat:14.7328,lng:76.4889},
      {id:'MKD-52',lat:14.7424,lng:76.4861},
      {id:'BDK-25',lat:14.8630,lng:76.3446},
    ]; // CDP-193, BLK-400, BDK-165 removed
    const cm={ready:'#00e676',casting:'#00c8ff',wip:'#ffca28',row:'#ff5252',pending:'#4a6a8a',delayed:'#ff9800'};
    WTG_COORDS.forEach(c=>{
      const t=DB.wtg.turbines.find(x=>x.id===c.id);
      const col=cm[t?.status||'pending'];
      const glow=t?.status==='wip'?`box-shadow:0 0 8px ${col};`:'';
      L.marker([c.lat,c.lng],{icon:mkTurbIcon(col,glow,28)}).addTo(mapInst)
        .bindPopup(`<b>${c.id}</b><br>Progress: ${t?calcTurbProg(t):0}%<br>Status: ${(t?.status||'PENDING').toUpperCase()}`);
    });
    [13,14,15,16,17,18,19,20,21,22,23,24,25,26].forEach((n,i)=>{
      const lat=14.72+Math.sin(i*0.7)*0.05,lng=76.35+Math.cos(i*0.7)*0.06;
      L.marker([lat,lng],{icon:mkTurbIcon('#4a6a8a','',20)}).addTo(mapInst).bindPopup(`<b>LOC-${n}</b><br>Status: PENDING`);
    });

    // ── New land parcels (from Land page + Add Parcel form) ──
    DB.landParcels.forEach(p=>{
      const col=p.module==='Solar'?'#ffaa00':'#7c4dff';
      const ic=L.divIcon({className:'',
        html:`<div style="width:14px;height:14px;background:${col};border:2px solid #fff;transform:rotate(45deg);opacity:.9;box-shadow:0 0 6px ${col};"></div>`,
        iconSize:[14,14],iconAnchor:[7,7]});
      L.marker([p.lat,p.lng],{icon:ic}).addTo(mapInst)
        .bindPopup(`<b>🌍 ${p.name}</b><br>Module: ${p.module}<br>Area: ${p.area} Acres<br>Lat: ${p.lat}, Lng: ${p.lng}<br>${p.notes||''}`);
    });

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
  },280);
}


// ═══════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════
function reqLogin(role,cb){
  if(CU&&(CU.role===role||CU.role==='all')){cb();return;}
  LCB=cb;LR=role;
  const ico={solar:'☀️',wtg:'🌬️',bop:'⚙️',all:'🔐'};
  document.getElementById('l-i').textContent=ico[role]||'🔐';
  document.getElementById('l-t').textContent={solar:'Solar Engineer',wtg:'WTG Engineer',bop:'BOP Engineer',all:'Site Manager'}[role]+' Login';
  document.getElementById('l-s').textContent="Today's Progress requires "+role.toUpperCase()+" authorization";
  document.getElementById('l-u').value='';document.getElementById('l-p').value='';document.getElementById('l-e').textContent='';
  document.getElementById('lw').style.display='flex';
}
function doLogin(){const u=document.getElementById('l-u').value.trim();const p=document.getElementById('l-p').value;const usr=USERS[u];if(usr&&usr.pwd===p&&(usr.role===LR||usr.role==='all')){CU={...usr,uid:u};document.getElementById('lw').style.display='none';if(LCB)LCB();}else document.getElementById('l-e').textContent='❌ Invalid credentials.';}
function closeLW(){document.getElementById('lw').style.display='none';}

// MODALS
function ov(id){document.getElementById(id)?.classList.add('open');}
function cov(id){document.getElementById(id)?.classList.remove('open');}
// Modal listeners wired in loader.js after partials are injected

// UI
let sbOpen=true;
function toggleSB(){sbOpen=!sbOpen;document.getElementById('sb').classList.toggle('col',!sbOpen);document.getElementById('mn').classList.toggle('wide',!sbOpen);}
let dark=true;
function toggleTheme(){dark=!dark;document.documentElement.setAttribute('data-theme',dark?'':'light');document.getElementById('th-i').textContent=dark?'🌙':'☀️';rndr(CV,{});}

// Open WTG progress form for a specific turbine (from right panel)
function openWtgProgFor(id){
  openWtgProg(id);
}

// ═══════════════════════════════════════════════════════════
//  EXPORT EXCEL
// ═══════════════════════════════════════════════════════════
function exportExcel(){
  // Build CSV content (universal — opens in Excel)
  const now=new Date().toLocaleDateString('en-GB');
  let csv='CONTINUUM GREEN ENERGY – SWPPL 140MW Hybrid EPC Dashboard Export\n';
  csv+=`Export Date,${now}\n\n`;

  // Overall KPIs
  csv+='MODULE,PROGRESS %\n';
  csv+=`Overall,${calcOverall()}%\n`;
  csv+=`Solar,${calcSolarProg()}%\n`;
  csv+=`WTG,${calcWtgProg()}%\n`;
  csv+=`Land,${calcLandProg()}%\n`;
  csv+=`BOP,${calcBopProg()}%\n\n`;

  // Solar ITCs
  csv+='SOLAR ITCs\nITC,MW,Progress %\n';
  Object.entries(DB.solar.itcs).forEach(([id,d])=>csv+=`${id},${d.mw},${calcITCProg(id)}%\n`);
  csv+='\n';

  // WTG Turbines
  csv+='WTG TURBINES\nID,Status,LP,PP,Overall %\n';
  DB.wtg.turbines.forEach(t=>csv+=`${t.id},${t.status},${t.lp?'Yes':'No'},${t.pp?'Yes':'No'},${calcTurbProg(t)}%\n`);
  csv+='\n';

  // ROW Issues
  csv+='ROW ISSUES\nLocation,Type,Issue,Opened,Duration\n';
  DB.rowIssues.forEach(r=>csv+=`${r.loc},${r.type},"${r.issue}",${r.opened},${rowDuration(r.opened)}\n`);

  // Download
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download='SWPPL_EPC_Dashboard_'+now.replace(/\//g,'-')+'.csv';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  showToast('📊 Excel export downloaded!','ok');
}

// INIT: handled by js/loader.js

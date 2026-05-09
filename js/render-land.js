//  LAND
// ═══════════════════════════════════════════════════════════
function rndrLand(){
  const wtgL=calcWtgLandProg(),solL=calcSolLandProg(),tot=calcLandProg();
  const totProcured=DB.wtgLand.locs.reduce((s,l)=>s+l.pa+l.la,0);
  const solReq=Object.values(DB.solLand.blocks).reduce((s,b)=>s+b.area,0);
  const solConf=DB.solLand.blocks['ITC-1'].area*(calcSolLandBlockProg('ITC-1')/100);
  _pageLogoTR();
  document.getElementById('land-kr').innerHTML=`
    <div class="kpi"><div class="kb" style="background:var(--land)"></div><div class="kl">Land Overall</div><div class="kv" style="color:var(--land)">${tot}%</div></div>
    <div class="kpi"><div class="kb" style="background:var(--wtg)"></div><div class="kl">WTG Land</div><div class="kv" style="color:var(--wtg)">${wtgL}%</div></div>
    <div class="kpi"><div class="kb" style="background:var(--sol)"></div><div class="kl">Solar Land</div><div class="kv" style="color:var(--sol)">${solL}%</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Total Procured</div><div class="kv" style="color:var(--ok);font-size:16px;">${totProcured.toFixed(0)} Ac</div></div>
    <div class="kpi"><div class="kb" style="background:var(--wn)"></div><div class="kl">Solar Required</div><div class="kv" style="color:var(--wn);font-size:16px;">${solReq} Ac</div></div>
    <div class="kpi"><div class="kb" style="background:var(--er)"></div><div class="kl">Balance Land</div><div class="kv" style="color:var(--er);font-size:16px;">${R(solReq-solConf)} Ac</div></div>`;

  // ── New Land Parcel section ──────────────────────────────────────────────
  const landViewEl = document.getElementById('view-land');
  if(landViewEl){
    let parcelSec = document.getElementById('land-parcel-sec');
    if(!parcelSec){
      parcelSec = document.createElement('div');
      parcelSec.id = 'land-parcel-sec';
      parcelSec.style.marginTop = '12px';
      landViewEl.appendChild(parcelSec);
    }
    parcelSec.innerHTML = `
      <div class="pnl" style="margin-bottom:10px;">
        <div class="ph2">
          <div class="pt">${_landImg(14)} New Land Parcels (with Lat/Lng → reflects on Site Map)</div>
          <button class="btn bts" style="font-size:8px;" onclick="openAddParcel()">+ Add Parcel</button>
        </div>
        ${DB.landParcels.length===0
          ?`<div style="color:var(--t3);font-size:10px;padding:8px 0;">No parcels added yet. Click "+ Add Parcel" to record new land with coordinates.</div>`
          :`<div class="tsc"><table class="tbl">
              <thead><tr><th>ID</th><th>Module</th><th>Name</th><th>Area</th><th>Lat</th><th>Lng</th><th>Added</th><th></th></tr></thead>
              <tbody>${DB.landParcels.map(p=>`<tr>
                <td><b>${p.id}</b></td>
                <td><span class="chip ${p.module==='Solar'?'cy':'cb'}">${p.module}</span></td>
                <td>${p.name}</td>
                <td>${p.area} Ac</td>
                <td style="font-size:9px;">${p.lat}</td>
                <td style="font-size:9px;">${p.lng}</td>
                <td>${p.added}</td>
                <td><button class="btn bts" style="font-size:7px;color:var(--er);" onclick="removeLandParcel('${p.id}');rndrLand();">✕</button></td>
              </tr>`).join('')}
              </tbody>
            </table></div>`
        }
      </div>`;
  }

  setTimeout(()=>{
    const ec=DB.wtgLand.locs.filter(l=>l.ls==='Executed').length;
    const ip=DB.wtgLand.locs.filter(l=>l.ls==='In Progress').length;
    const pnd=26-ec-ip;
    mkC('ch-land-cwip',{type:'bar',data:{labels:['WTG Land','Solar Land'],datasets:[
      {label:'✔ Done', data:[R(ec/26*100),R(solConf/solReq*100)],backgroundColor:'rgba(0,230,118,.75)',borderRadius:4,stack:'s'},
      {label:'🟡 WIP', data:[R(ip/26*100),30],backgroundColor:'rgba(255,202,40,.75)',borderRadius:4,stack:'s'},
      {label:'🔴 Pending',data:[R(pnd/26*100),R((solReq-solConf)/solReq*100-30)],backgroundColor:'rgba(255,82,82,.5)',borderRadius:4,stack:'s'},
    ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{x:{stacked:true},y:{stacked:true,min:0,max:100,ticks:{callback:v=>v+'%'}}}}});
    mkC('ch-land-pie',{type:'doughnut',data:{labels:['WTG Done','Solar Done','Pending'],datasets:[{data:[wtgL,solL,200-wtgL-solL],backgroundColor:['rgba(124,77,255,.8)','rgba(255,170,0,.8)','rgba(26,46,74,.6)'],borderWidth:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'right'}}}});
    const stages=DB.wtgLand.stages;
    const sp=stages.map((_,si)=>R(DB.wtgLand.locs.filter(l=>l.stages[si]).length/DB.wtgLand.locs.length*100));
    mkC('ch-wtg-land-s',{type:'bar',data:{labels:stages.map(s=>s.substr(0,14)),datasets:[{label:'%',data:sp,backgroundColor:sp.map(v=>v>=100?'rgba(0,230,118,.75)':v>0?'rgba(255,202,40,.75)':'rgba(255,82,82,.55)'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:100}}}});
    const bIds=Object.keys(DB.solLand.blocks);const bP=bIds.map(id=>calcSolLandBlockProg(id));
    mkC('ch-sol-land-s',{type:'bar',data:{labels:bIds,datasets:[{label:'%',data:bP,backgroundColor:bP.map(v=>v>=100?'rgba(0,230,118,.75)':v>0?'rgba(255,202,40,.75)':'rgba(255,82,82,.55)'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:100}}}});
  },80);
}

function openAddParcel(){
  document.getElementById('p-t').textContent='+ Add New Land Parcel';
  document.getElementById('p-b').innerHTML=`
    <div style="font-size:9px;color:var(--t3);margin-bottom:9px;">Enter GPS coordinates (from field survey). This parcel will appear on the Site Map immediately.</div>
    <div class="fr">
      <div class="fg"><label class="fl">Module</label>
        <select class="fs" id="ap-mod"><option>Solar</option><option>WTG</option><option>Common</option></select>
      </div>
      <div class="fg"><label class="fl">Parcel Name / Survey No.</label>
        <input class="fi" id="ap-name" placeholder="e.g. SY.45/3 – Rameshu" required>
      </div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Latitude</label>
        <input class="fi" id="ap-lat" type="number" step="0.000001" placeholder="e.g. 14.832892" required>
      </div>
      <div class="fg"><label class="fl">Longitude</label>
        <input class="fi" id="ap-lng" type="number" step="0.000001" placeholder="e.g. 76.468903" required>
      </div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Area (Acres)</label>
        <input class="fi" id="ap-area" type="number" step="0.01" placeholder="e.g. 1.25">
      </div>
      <div class="fg"><label class="fl">Notes</label>
        <input class="fi" id="ap-notes" placeholder="Owner, status, etc.">
      </div>
    </div>
    <div style="display:flex;gap:7px;margin-top:10px;">
      <button type="button" class="btn" style="flex:1" onclick="cov('pov')">Cancel</button>
      <button type="button" class="btn btla" style="flex:1" onclick="submitAddParcel()">✅ Add Parcel</button>
    </div>`;
  ov('pov');
}
function submitAddParcel(){
  const mod=document.getElementById('ap-mod')?.value||'Solar';
  const name=document.getElementById('ap-name')?.value?.trim();
  const lat=+document.getElementById('ap-lat')?.value;
  const lng=+document.getElementById('ap-lng')?.value;
  const area=+document.getElementById('ap-area')?.value||0;
  const notes=document.getElementById('ap-notes')?.value||'';
  if(!name||!lat||!lng){showToast('❌ Name, Lat and Lng are required','er');return;}
  addLandParcel(mod,name,lat,lng,area,notes);
  cov('pov');rndrLand();
}

// WTG LAND
function rndrWtgLand(){
  const tot=calcWtgLandProg();const exec=DB.wtgLand.locs.filter(l=>l.ls==='Executed').length;
  const proc=DB.wtgLand.locs.reduce((s,l)=>s+l.pa+l.la,0);
  document.getElementById('wtgland-kr').innerHTML=`
    <div class="kpi"><div class="kb" style="background:var(--wtg)"></div><div class="kl">WTG Land %</div><div class="kv" style="color:var(--wtg)">${tot}%</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Lease Executed</div><div class="kv" style="color:var(--ok)">${exec}/26</div></div>
    <div class="kpi"><div class="kb" style="background:var(--sol)"></div><div class="kl">Total Procured</div><div class="kv" style="color:var(--sol);font-size:16px;">${proc.toFixed(1)} Ac</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ac)"></div><div class="kl">RFC Done</div><div class="kv" style="color:var(--ac)">${DB.wtgLand.locs.filter(l=>l.stages[9]).length}/26</div></div>`;
  setTimeout(()=>{
    const stages=DB.wtgLand.stages;
    const sp=stages.map((_,si)=>R(DB.wtgLand.locs.filter(l=>l.stages[si]).length/DB.wtgLand.locs.length*100));
    mkC('ch-wtgland-stages',{type:'bar',data:{labels:stages.map(s=>s.substr(0,18)),datasets:[{label:'% Locations Done',data:sp,backgroundColor:sp.map(v=>v>=100?'rgba(0,230,118,.75)':v>0?'rgba(255,202,40,.75)':'rgba(255,82,82,.55)'),borderRadius:4}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%'}}}}});
    rndrWtgLandTable();
  },80);
}
function rndrWtgLandTable(){
  const t=document.getElementById('wtgland-tbl');if(!t)return;
  t.innerHTML=`<thead><tr><th>ID</th><th>Survey</th><th>Patta(Ac)</th><th>Lease(Ac)</th><th>Lease</th><th>Stages</th><th>Progress</th><th>Action</th></tr></thead>
  <tbody>${DB.wtgLand.locs.map(l=>{const p=calcWtgLandLocProg(l);const done=l.stages.filter(Boolean).length;return`<tr>
    <td><b>${l.id}</b></td><td>${l.svy}</td><td>${l.pa}</td><td>${l.la}</td>
    <td><span class="chip ${l.ls==='Executed'?'cg':l.ls==='In Progress'?'cy':'cr'}">${l.ls}</span></td>
    <td><span class="chip cb">${done}/10</span></td><td><b>${p}%</b></td>
    <td style="white-space:nowrap;"><button class="btn bts" onclick="showWtgLandDet('${l.id}')">🔍</button><button class="btn bts" style="color:var(--er);border-color:var(--er);" onclick="removeWtgLand('${l.id}')">✕</button></td>
  </tr>`;}).join('')}</tbody>`;
}
function showWtgLandDet(id){
  const l=DB.wtgLand.locs.find(x=>x.id===id);if(!l)return;
  document.getElementById('lm-t').textContent='📍 '+id+' – Land Detail & Stages';
  document.getElementById('lm-b').innerHTML=`
    <div class="fr" style="margin-bottom:9px;">
      <div class="kpi" style="padding:8px;"><div class="kl">Patta</div><div class="kv" style="font-size:15px;color:var(--sol)">${l.pa} Ac</div></div>
      <div class="kpi" style="padding:8px;"><div class="kl">Lease</div><div class="kv" style="font-size:15px;color:var(--land)">${l.la} Ac</div></div>
    </div>
    <div class="ir"><div class="irl">Survey No.</div><div class="irr">${l.svy}</div></div>
    <div class="ir"><div class="irl">Lease Status</div><div class="irr"><span class="chip ${l.ls==='Executed'?'cg':l.ls==='In Progress'?'cy':'cr'}">${l.ls}</span></div></div>
    <div class="ir"><div class="irl">Compensation</div><div class="irr">${l.comp}</div></div>
    <div class="sep"></div>
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--t3);margin-bottom:6px;">10 Development Stages (Click to toggle)</div>
    <div class="slist">${DB.wtgLand.stages.map((lb,i)=>`<div class="sitm" onclick="toggleStage('${id}',${i},this)">
      <div class="schk${l.stages[i]?' done':''}">${l.stages[i]?'✓':''}</div><span>${lb}</span>
    </div>`).join('')}</div>
    <div class="fg" style="margin-top:10px;"><label class="fl">Notes</label><textarea class="fta" id="ln-${id}" placeholder="Update notes...">${l.notes||''}</textarea></div>
    <button class="btn btla bts" onclick="saveWtgNotes('${id}')">💾 Save Notes</button>`;
  ov('lov');
}
function toggleStage(id,idx,el){
  const l=DB.wtgLand.locs.find(x=>x.id===id);if(!l)return;
  l.stages[idx]=!l.stages[idx];
  const chk=el.querySelector('.schk');if(chk){chk.className='schk'+(l.stages[idx]?' done':'');chk.textContent=l.stages[idx]?'✓':'';}
  rndrWtgLandTable();updateOverallBars();
}
function saveWtgNotes(id){const l=DB.wtgLand.locs.find(x=>x.id===id);if(l){const ta=document.getElementById('ln-'+id);if(ta)l.notes=ta.value;}alert('Notes saved!');}
function removeWtgLand(id){if(!confirm(`Remove ${id}?`))return;const i=DB.wtgLand.locs.findIndex(x=>x.id===id);if(i>=0)DB.wtgLand.locs.splice(i,1);rndrWtgLand();}
function openAddWtgLand(){
  document.getElementById('lm-t').textContent='➕ Add WTG Land Location';
  document.getElementById('lm-b').innerHTML=`<form onsubmit="submitAddWtgLand(event)">
    <div class="fr"><div class="fg"><label class="fl">Location ID</label><input class="fi" id="aw-id" placeholder="LOC-27" required></div><div class="fg"><label class="fl">Survey No.</label><input class="fi" id="aw-sv" placeholder="SY.No.XXX/1" required></div></div>
    <div class="fr"><div class="fg"><label class="fl">Patta (Ac)</label><input class="fi" id="aw-pa" type="number" step=".01" placeholder="1.0" required></div><div class="fg"><label class="fl">Lease (Ac)</label><input class="fi" id="aw-la" type="number" step=".01" placeholder="4.0" required></div></div>
    <div class="fr"><div class="fg"><label class="fl">Lease Status</label><select class="fs" id="aw-ls"><option>Pending</option><option>In Progress</option><option>Executed</option></select></div><div class="fg"><label class="fl">Compensation</label><select class="fs" id="aw-cm"><option>Not Started</option><option>Partial</option><option>Paid</option></select></div></div>
    <div class="fg"><label class="fl">Notes</label><textarea class="fta" id="aw-nt"></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('lov')">Cancel</button><button type="submit" class="btn btla" style="flex:1;">➕ Add</button></div>
  </form>`;ov('lov');
}
function submitAddWtgLand(e){e.preventDefault();DB.wtgLand.locs.push({id:document.getElementById('aw-id').value,svy:document.getElementById('aw-sv').value,pa:+document.getElementById('aw-pa').value,la:+document.getElementById('aw-la').value,ls:document.getElementById('aw-ls').value,comp:document.getElementById('aw-cm').value,stages:new Array(10).fill(false),notes:document.getElementById('aw-nt').value});cov('lov');alert('✅ Added!');rndrWtgLand();}
function openWtgLandProg(){
  document.getElementById('p-t').textContent='📊 Update WTG Land';
  document.getElementById('p-b').innerHTML=`<form onsubmit="submitWtgLandUpdate(event)">
    <div class="fg"><label class="fl">Location</label><select class="fs" id="wlu-loc">${DB.wtgLand.locs.map(l=>`<option>${l.id}</option>`).join('')}</select></div>
    <div class="fr"><div class="fg"><label class="fl">Survey No.</label><input class="fi" id="wlu-sv" placeholder="Leave blank to keep"></div><div class="fg"><label class="fl">Lease Status</label><select class="fs" id="wlu-ls"><option value="">Keep</option><option>Pending</option><option>In Progress</option><option>Executed</option></select></div></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button><button type="submit" class="btn btla" style="flex:1;">💾 Update</button></div>
  </form>`;ov('pov');
}
function submitWtgLandUpdate(e){e.preventDefault();const id=document.getElementById('wlu-loc').value;const l=DB.wtgLand.locs.find(x=>x.id===id);if(l){const sv=document.getElementById('wlu-sv').value;const ls=document.getElementById('wlu-ls').value;if(sv)l.svy=sv;if(ls)l.ls=ls;}scheduleSave();cov('pov');showToast('✅ Updated!','ok');rndrWtgLand();}

// SOLAR LAND
function rndrSolLand(){
  const tot=calcSolLandProg();
  const blks=DB.solLand.blocks;const totalReq=Object.values(blks).reduce((s,b)=>s+b.area,0);
  const totalConf=Object.entries(blks).reduce((s,[id,b])=>s+b.area*(calcSolLandBlockProg(id)/100),0);
  document.getElementById('solland-kr').innerHTML=`
    <div class="kpi"><div class="kb" style="background:var(--sol)"></div><div class="kl">Solar Land %</div><div class="kv" style="color:var(--sol)">${tot}%</div></div>
    <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Total Required</div><div class="kv" style="color:var(--ok);font-size:16px;">${totalReq} Ac</div></div>
    <div class="kpi"><div class="kb" style="background:var(--land)"></div><div class="kl">Confirmed</div><div class="kv" style="color:var(--land);font-size:16px;">${totalConf.toFixed(1)} Ac</div></div>
    <div class="kpi"><div class="kb" style="background:var(--er)"></div><div class="kl">Balance</div><div class="kv" style="color:var(--er);font-size:16px;">${R(totalReq-totalConf)} Ac</div></div>`;
  setTimeout(()=>{
    const bIds=Object.keys(blks);const bP=bIds.map(id=>calcSolLandBlockProg(id));
    const conf=bIds.map(id=>R(blks[id].area*(bP[bIds.indexOf(id)]/100)));
    const bal=bIds.map(id=>R(blks[id].area*(1-bP[bIds.indexOf(id)]/100)));
    mkC('ch-solland',{type:'bar',data:{labels:bIds,datasets:[{label:'Confirmed (Ac)',data:conf,backgroundColor:'rgba(0,230,118,.75)',borderRadius:4,stack:'s'},{label:'Balance (Ac)',data:bal,backgroundColor:'rgba(255,82,82,.55)',borderRadius:4,stack:'s'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{x:{stacked:true},y:{stacked:true,beginAtZero:true}}}});
  },80);
  document.getElementById('sol-land-summary').innerHTML=Object.entries(blks).map(([id,b])=>{const p=calcSolLandBlockProg(id);return`<div style="background:var(--card2);border:1px solid var(--b1);border-radius:7px;padding:9px;margin-bottom:7px;cursor:pointer;" onclick="showSolLandBlock('${id}')">
    <div style="display:flex;justify-content:space-between;margin-bottom:3px;flex-wrap:wrap;gap:3px;">
      <div style="font-family:var(--f2);font-size:12px;font-weight:700;color:var(--sol)">☀️ ${id}</div>
      <span class="chip ${p>=100?'cg':p>0?'cy':'cr'}">${p.toFixed(1)}%</span>
    </div>
    <div class="mst"><div class="ms">Capacity:<b>${b.mw}MW</b></div><div class="ms">Area:<b>${b.area}Ac</b></div><div class="ms">Conf:<b>${R(b.area*p/100)}Ac</b></div></div>
  </div>`;}).join('');
  rndrLeaseTable();
}
function rndrLeaseTable(){
  const t=document.getElementById('sol-lease-tbl');if(!t)return;
  const all=[];Object.entries(DB.solLand.blocks).forEach(([id,b])=>b.leases.forEach((l,i)=>all.push({bid:id,idx:i,...l})));
  t.innerHTML=`<thead><tr><th>Block</th><th>Owner</th><th>Survey</th><th>Duration</th><th>Lease</th><th>Doc</th><th>Reg</th><th>Remarks</th><th>Act</th></tr></thead>
  <tbody>${all.length?all.map(l=>`<tr><td><b>${l.bid}</b></td><td>${l.own}</td><td>${l.svy}</td><td>${l.dur}</td>
    <td><span class="chip ${l.ls==='Executed'?'cg':l.ls==='In Progress'?'cy':'cr'}">${l.ls}</span></td>
    <td><span class="chip ${l.doc==='Complete'?'cg':'cy'}">${l.doc}</span></td>
    <td><span class="chip ${l.reg==='Done'?'cg':'cy'}">${l.reg}</span></td>
    <td>${l.rem}</td>
    <td><button class="btn bts" style="color:var(--er);border-color:var(--er);" onclick="removeLease('${l.bid}',${l.idx})">✕</button></td>
  </tr>`).join(''):`<tr><td colspan="9" style="text-align:center;color:var(--t3);padding:14px;">No entries. Click ➕ Add Entry.</td></tr>`}</tbody>`;
}
function showSolLandBlock(id){
  const b=DB.solLand.blocks[id];if(!b)return;const p=calcSolLandBlockProg(id);
  document.getElementById('lm-t').textContent='☀️ '+id+' Land Detail';
  document.getElementById('lm-b').innerHTML=`
    <div class="fr" style="margin-bottom:9px;">
      <div class="kpi" style="padding:8px;"><div class="kl">Required</div><div class="kv" style="font-size:15px;color:var(--sol)">${b.area} Ac</div></div>
      <div class="kpi" style="padding:8px;"><div class="kl">Progress</div><div class="kv" style="font-size:15px;color:var(--land)">${p}%</div></div>
    </div>
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--t3);margin-bottom:6px;">Activities (per spec weights)</div>
    ${DB.solLand.actDef.map((a,i)=>`<div style="margin-bottom:6px;">
      <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:2px;"><span>${a.n}</span><span style="color:var(--t3);">W:${a.w}%</span></div>
      <div style="display:flex;align-items:center;gap:6px;"><div class="prt" style="flex:1;height:7px;"><div class="prf" style="width:${b.acts[i]}%;background:${b.acts[i]>=100?'var(--ok)':b.acts[i]>0?'var(--wn)':'var(--b3)'}"></div></div>
      <input type="number" min="0" max="100" value="${b.acts[i]}" style="width:50px;background:var(--card);border:1px solid var(--b1);color:var(--t1);padding:2px 4px;border-radius:4px;font-size:9px;" onchange="updSolLandAct('${id}',${i},this.value)"></div>
    </div>`).join('')}`;
  ov('lov');
}
function updSolLandAct(id,i,v){DB.solLand.blocks[id].acts[i]=Math.min(100,Math.max(0,+v));updateOverallBars();}
function openSolLeaseAdd(){
  document.getElementById('lm-t').textContent='➕ Add Lease Entry';
  document.getElementById('lm-b').innerHTML=`<form onsubmit="submitAddLease(event)">
    <div class="fr"><div class="fg"><label class="fl">Block</label><select class="fs" id="al-blk">${Object.keys(DB.solLand.blocks).map(b=>`<option>${b}</option>`).join('')}</select></div><div class="fg"><label class="fl">Owner Name</label><input class="fi" id="al-own" placeholder="Owner" required></div></div>
    <div class="fr"><div class="fg"><label class="fl">Survey No.</label><input class="fi" id="al-sv" placeholder="SY.No.XXX" required></div><div class="fg"><label class="fl">Lease Duration</label><input class="fi" id="al-dur" placeholder="30yr" required></div></div>
    <div class="fr"><div class="fg"><label class="fl">Lease Status</label><select class="fs" id="al-ls"><option>Pending</option><option>In Progress</option><option>Executed</option></select></div><div class="fg"><label class="fl">Doc Status</label><select class="fs" id="al-ds"><option>Pending</option><option>In Progress</option><option>Complete</option></select></div></div>
    <div class="fr"><div class="fg"><label class="fl">Registration</label><select class="fs" id="al-rs"><option>Pending</option><option>In Progress</option><option>Done</option></select></div><div class="fg"><label class="fl">Remarks</label><input class="fi" id="al-rm" placeholder="Notes"></div></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('lov')">Cancel</button><button type="submit" class="btn btsol" style="flex:1;">➕ Add</button></div>
  </form>`;ov('lov');
}
function submitAddLease(e){e.preventDefault();const blk=document.getElementById('al-blk').value;DB.solLand.blocks[blk].leases.push({own:document.getElementById('al-own').value,svy:document.getElementById('al-sv').value,dur:document.getElementById('al-dur').value,ls:document.getElementById('al-ls').value,doc:document.getElementById('al-ds').value,reg:document.getElementById('al-rs').value,rem:document.getElementById('al-rm').value});cov('lov');alert('✅ Added!');rndrSolLand();}
function removeLease(bid,idx){if(!confirm('Remove?'))return;DB.solLand.blocks[bid].leases.splice(idx,1);rndrSolLand();}

// ═══════════════════════════════════════════════════════════
//  BOP
// ═══════════════════════════════════════════════════════════
function rndrBop(){
  const b33=calcBop33PctV2(),b66=calcBop66PctV2(),pss=calcPssPct(),gss=calcGssPct(),tot=calcBopProg();
  _pageLogoTR();
  if(typeof injectSecNav==='function') injectSecNav('view-bop',[
    {id:'bop-kr',   label:'KPIs',     icon:'📊'},
    {id:'bop-secs', label:'Sections', icon:'⚙️'},
  ]);
  if(typeof injectExportBar==='function') injectExportBar('view-bop','BOP_Progress');
  document.getElementById('bop-kr').innerHTML=`
    <div class="kpi" data-tt="Overall BOP progress across 33kV, 66kV, PSS and GSS"><div class="kb" style="background:var(--bop)"></div><div class="kl">BOP Overall</div><div class="kv" style="color:var(--bop)">${tot}%</div></div>
    <div class="kpi" data-tt="33kV Line feeder-wise pole erection & stringing progress"><div class="kb" style="background:var(--kv3)"></div><div class="kl">33kV Lines</div><div class="kv" style="color:var(--kv3)">${b33}%</div></div>
    <div class="kpi" data-tt="66kV EHV Tower erection PSS→GSS progress"><div class="kb" style="background:var(--kv6)"></div><div class="kl">66kV Towers</div><div class="kv" style="color:var(--kv6)">${b66}%</div></div>
    <div class="kpi" data-tt="Primary Sub-Station civil, equipment and MCR progress"><div class="kb" style="background:var(--pss)"></div><div class="kl">PSS</div><div class="kv" style="color:var(--pss)">${pss}%</div></div>
    <div class="kpi" data-tt="Grid Sub-Station 66kV bay, structure and equipment progress"><div class="kb" style="background:var(--gss)"></div><div class="kl">GSS</div><div class="kv" style="color:var(--gss)">${gss}%</div></div>`;
  [['bop33-pct','bop33-bar',b33,'var(--kv3)'],['bop66-pct','bop66-bar',b66,'var(--kv6)'],['boppss-pct','boppss-bar',pss,'var(--pss)'],['bopgss-pct','bopgss-bar',gss,'var(--gss)']].forEach(([p,b,v,c])=>{const pe=document.getElementById(p);if(pe)pe.textContent=v+'%';const be=document.getElementById(b);if(be){be.style.width=v+'%';be.style.background=c;}});
  setTimeout(()=>mkC('ch-bop-sec',{type:'bar',data:{labels:['33kV Lines','66kV Towers','PSS','GSS'],datasets:[{label:'Progress %',data:[b33,b66,pss,gss],backgroundColor:['rgba(156,39,176,.75)','rgba(255,152,0,.75)','rgba(0,188,212,.75)','rgba(139,195,74,.75)'],borderRadius:5}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%'}}}}}),80);
}
function rndrBopSec(sec){
  const SM={
    '33kv':{label:'33 kV Lines',color:'var(--kv3)', iconHtml:'<img src="33kv.png" style="height:22px;vertical-align:middle;object-fit:contain;" onerror="this.style.display=\'none\'">',render:rndr33kv},
    '66kv':{label:'66 kV Towers',color:'var(--kv6)',iconHtml:'<img src="66kv.png" style="height:22px;vertical-align:middle;object-fit:contain;" onerror="this.style.display=\'none\'">',render:rndr66kv},
    'pss': {label:'PSS',color:'var(--pss)',          iconHtml:'<img src="PSS.png" style="height:22px;vertical-align:middle;object-fit:contain;" onerror="this.style.display=\'none\'">',render:rndrPSS},
    'gss': {label:'GSS',color:'var(--gss)',          iconHtml:'<img src="GSS.png" style="height:22px;vertical-align:middle;object-fit:contain;" onerror="this.style.display=\'none\'">',render:rndrGSS},
  };
  const s=SM[sec];if(!s)return;
  const el=document.getElementById('bop-'+sec+'-ct');if(!el)return;
  el.innerHTML=`<div class="bk" onclick="nav('bop')">← BOP</div>
    <div class="ph"><div class="pht" style="color:${s.color};display:flex;align-items:center;gap:8px;">${s.iconHtml} ${s.label}</div></div>
    <div id="bop-sec-body-${sec}"></div>`;
  s.render(sec);
}
function rndr33kv(sec){
  const el=document.getElementById('bop-sec-body-'+sec);if(!el)return;

  // Feeder summary data: total pole erection + stringing per feeder
  const FEEDERS=[
    {id:'Feeder 1', label:'WTG F1',  col:'var(--wtg)',   bg:'rgba(0,200,255,.08)',
     route:['MBI-12','KDK-462','MKD-258','MKD-52','MKD-211','MKD-253','PSS'],
     scope:150, done:95, string_scope:15.7, string_done:9.2, rowIssues:2},
    {id:'Feeder 2', label:'Solar F1', col:'var(--sol)',   bg:'rgba(255,170,0,.08)',
     route:['ITC-1 Tap','ITC-2 Tap','ITC-3 Tap','PSS'],
     scope:80,  done:72, string_scope:8.5, string_done:7.8, rowIssues:0},
    {id:'Feeder 3', label:'Solar F2', col:'#00acc1',     bg:'rgba(0,172,193,.08)',
     route:['ITC-4 Tap','ITC-5 Tap','ITC-6 Tap','PSS'],
     scope:80,  done:68, string_scope:8.2, string_done:6.1, rowIssues:1},
    {id:'Feeder 4', label:'WTG F2',  col:'#7c4dff',     bg:'rgba(124,77,255,.08)',
     route:['CDP-221','AMK-264','MOB-403','BDK-85','BDK-25','MOB-142','PSS'],
     scope:160, done:37, string_scope:16.2, string_done:3.1, rowIssues:3},
  ];

  const tot33Pct=calcBop33PctV2();
  const todayProg=12;
  const totalMp=18;

  el.innerHTML=`
    <!-- KPI Row: matching screenshot style -->
    <div class="kr" style="margin-bottom:14px;">
      <div class="kpi" data-tt="33kV overall feeder progress" style="border-left:3px solid var(--kv3);">
        <div class="kb" style="background:var(--kv3)"></div>
        <div class="kl" style="font-size:10px;font-weight:700;">33kV Progress</div>
        <div class="kv" style="color:var(--kv3);font-size:24px;font-weight:800;">${tot33Pct}%</div>
      </div>
      <div class="kpi" data-tt="Today's construction progress in %" style="border-left:3px solid var(--ok);">
        <div class="kb" style="background:var(--ok)"></div>
        <div class="kl" style="font-size:10px;font-weight:700;">Todays Progress</div>
        <div class="kv" style="color:var(--ok);font-size:24px;font-weight:800;">${todayProg}%</div>
      </div>
      <div class="kpi" data-tt="Charged length in MW" style="border-left:3px solid var(--sol);">
        <div class="kb" style="background:var(--sol)"></div>
        <div class="kl" style="font-size:10px;font-weight:700;">Charged in MW</div>
        <div class="kv" style="color:var(--sol);font-size:24px;font-weight:800;">0</div>
      </div>
      <div class="kpi" data-tt="Total manpower on 33kV line works" style="border-left:3px solid var(--wtg);">
        <div class="kb" style="background:var(--wtg)"></div>
        <div class="kl" style="font-size:10px;font-weight:700;">Manpower</div>
        <div class="kv" style="color:var(--wtg);font-size:24px;font-weight:800;">${totalMp}</div>
      </div>
      <div class="kpi" data-tt="Right-of-way issues pending clearance" style="border-left:3px solid var(--er);">
        <div class="kb" style="background:var(--er)"></div>
        <div class="kl" style="font-size:10px;font-weight:700;">ROW</div>
        <div class="kv" style="color:var(--er);font-size:24px;font-weight:800;">${FEEDERS.reduce((s,f)=>s+f.rowIssues,0)}</div>
      </div>
    </div>

    <!-- MAIN GRID: left=feeder cross-table | right=routing map -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;">

      <!-- LEFT: 4-feeder cross-table (rows=activities, cols=feeders) -->
      <div class="pnl">
        <div class="ph2" style="margin-bottom:10px;">
          <div class="pt" style="font-weight:700;">Feeder-wise Progress</div>
          <button class="btn bts" style="font-size:8px;" onclick="reqLogin('bop',()=>open33ProgressForm())" data-tt="Enter today's pole progress">Update Progress</button>
        </div>

        <!-- Feeder header badges -->
        <div style="display:grid;grid-template-columns:140px repeat(4,1fr);gap:4px;margin-bottom:6px;">
          <div style="font-size:9px;font-weight:700;color:var(--t3);padding:4px 0;">Activity</div>
          ${FEEDERS.map(f=>`<div style="background:var(--card2);border-radius:6px;padding:6px;text-align:center;border-top:3px solid ${f.col};">
            <div style="font-size:10px;font-weight:800;color:${f.col};">${f.id}</div>
            <div style="font-size:8px;color:var(--t3);">${f.label}</div>
          </div>`).join('')}
        </div>

        <!-- Activity rows: Total Poles, Today Progress, ROW Clearance, Foundation & Erection, Testing, HOTO -->
        ${[
          {label:'Total Poles',   vals:FEEDERS.map(f=>`<div style="font-family:var(--f2);font-size:16px;font-weight:700;color:var(--ac);">${f.done}/${f.scope}</div>`)},
          {label:'Today Progress',vals:FEEDERS.map(f=>`<div style="font-size:12px;font-weight:700;color:var(--ok);">+${Math.round(f.done*0.05)} poles</div>`)},
          {label:'ROW Clearance', vals:FEEDERS.map(f=>`<span class="chip ${f.rowIssues===0?'cg':'cr'}" style="font-size:9px;">${f.rowIssues===0?'✅ Clear':f.rowIssues+' Open'}</span>`)},
          {label:'Fdn & Erection',vals:FEEDERS.map(f=>{const pct=Math.round(f.done/f.scope*100);return`<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="font-size:12px;font-weight:700;color:${pct>=80?'var(--ok)':pct>40?'var(--wn)':'var(--er)'};">${pct}%</div><div style="width:100%;height:4px;background:var(--b1);border-radius:2px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${pct>=80?'var(--ok)':pct>40?'var(--wn)':'var(--er)'};border-radius:2px;"></div></div></div>`})},
          {label:'Stringing',     vals:FEEDERS.map(f=>`<div style="font-size:11px;font-weight:700;color:var(--ac);">${f.string_done}/${f.string_scope} km</div>`)},
          {label:'Testing',       vals:FEEDERS.map(f=>`<span class="chip cr" style="font-size:8px;">Pending</span>`)},
          {label:'HOTO',         vals:FEEDERS.map(f=>`<span class="chip cr" style="font-size:8px;">Pending</span>`)},
        ].map(row=>`
          <div style="display:grid;grid-template-columns:140px repeat(4,1fr);gap:4px;margin-bottom:3px;padding:6px 0;border-bottom:1px solid var(--b1);">
            <div style="font-size:9px;font-weight:600;color:var(--t2);display:flex;align-items:center;">${row.label}</div>
            ${row.vals.map(v=>`<div style="display:flex;align-items:center;justify-content:center;background:var(--card2);border-radius:5px;padding:5px 3px;text-align:center;">${v}</div>`).join('')}
          </div>`).join('')}

        <!-- Overall progress bars per feeder -->
        <div style="margin-top:10px;">
          <div style="font-size:9px;font-weight:700;color:var(--t3);margin-bottom:5px;text-transform:uppercase;letter-spacing:1px;">Feeder Overall</div>
          ${FEEDERS.map(f=>{const pct=Math.round(f.done/f.scope*100);return`<div class="pr" style="margin-bottom:4px;">
            <div class="prl" style="font-size:9px;font-weight:700;color:${f.col};min-width:70px;">${f.id}</div>
            <div class="prt"><div class="prf" style="width:${pct}%;background:${f.col}"></div></div>
            <div class="prp" style="color:${f.col};font-size:9px;">${pct}%</div>
          </div>`;}).join('')}
        </div>
      </div>

      <!-- RIGHT: Routing map -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div class="pnl">
          <div class="ph2">
            <div class="pt" style="font-weight:700;">33kV Feeder-wise Routing Map</div>
            <select class="flt-sel" style="font-size:8px;" id="sel-33kv-feeder" onchange="_render33kvMap(this.value)" data-tt="Select feeder to view routing">
              <option value="all">All Feeders</option>
              ${FEEDERS.map(f=>`<option value="${f.id}">${f.id} – ${f.label}</option>`).join('')}
            </select>
          </div>
          <!-- Legend -->
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;font-size:8px;">
            ${[['var(--wtg)','WTG Feeder'],['var(--sol)','Solar Feeder'],['#00acc1','Solar F2'],['#7c4dff','WTG F2'],['#00e676','Turbine'],['#00bcd4','PSS']].map(([c,l])=>
              `<span style="display:flex;align-items:center;gap:3px;"><span style="width:10px;height:4px;background:${c};border-radius:2px;display:inline-block;"></span>${l}</span>`).join('')}
          </div>
          <div id="map-33kv" style="height:360px;border-radius:8px;border:1px solid var(--b1);"></div>
        </div>
        <!-- Planned vs Actual -->
        <div class="pnl">
          <div class="ph2"><div class="pt" style="font-weight:700;">Planned vs Actual Schedule</div></div>
          <div class="ch h200"><canvas id="ch-33kv-pva"></canvas></div>
        </div>
      </div>
    </div>`;

  setTimeout(()=>{
    _bopPVAChart('ch-33kv-pva');
    _init33kvMap('all');
  },120);
}

// ── 33kV Leaflet routing map ──────────────────────────────────────────────
const _FEEDER_ROUTES={
  'Feeder 1':{
    col:'#00c8ff',
    nodes:[
      {id:'MBI-12',  lat:14.7426,lng:76.4535,type:'turbine'},
      {id:'KDK-462', lat:14.7419,lng:76.4657,type:'turbine'},
      {id:'MKD-258', lat:14.7274,lng:76.4779,type:'turbine'},
      {id:'MKD-52',  lat:14.7424,lng:76.4861,type:'turbine'},
      {id:'MKD-211', lat:14.7328,lng:76.4889,type:'turbine'},
      {id:'MKD-253', lat:14.7255,lng:76.4843,type:'turbine'},
      {id:'PSS',     lat:14.8392,lng:76.4521,type:'pss'},
    ]
  },
  'Feeder 2':{
    col:'#ffaa00',
    nodes:[
      {id:'ITC-1 Tap',lat:14.8329,lng:76.4686,type:'solar'},
      {id:'ITC-2 Tap',lat:14.8200,lng:76.4500,type:'solar'},
      {id:'ITC-3 Tap',lat:14.8100,lng:76.4300,type:'solar'},
      {id:'PSS',      lat:14.8392,lng:76.4521,type:'pss'},
    ]
  },
  'Feeder 3':{
    col:'#00acc1',
    nodes:[
      {id:'ITC-4 Tap',lat:14.8050,lng:76.4100,type:'solar'},
      {id:'ITC-5 Tap',lat:14.7950,lng:76.3950,type:'solar'},
      {id:'ITC-6 Tap',lat:14.7850,lng:76.3800,type:'solar'},
      {id:'PSS',      lat:14.8392,lng:76.4521,type:'pss'},
    ]
  },
  'Feeder 4':{
    col:'#7c4dff',
    nodes:[
      {id:'CDP-221', lat:14.8215,lng:76.4113,type:'turbine'},
      {id:'AMK-264', lat:14.8710,lng:76.4035,type:'turbine'},
      {id:'MOB-403', lat:14.8576,lng:76.3799,type:'turbine'},
      {id:'BDK-85',  lat:14.8767,lng:76.3509,type:'turbine'},
      {id:'BDK-25',  lat:14.8630,lng:76.3446,type:'turbine'},
      {id:'MOB-142', lat:14.8661,lng:76.4045,type:'turbine'},
      {id:'PSS',     lat:14.8392,lng:76.4521,type:'pss'},
    ]
  },
};
let _map33=null;
function _init33kvMap(selected){
  const mc=document.getElementById('map-33kv');if(!mc)return;
  if(_map33){try{_map33.remove();}catch(e){}}_map33=null;
  const center=[14.80,76.42];
  const m=L.map('map-33kv',{zoomControl:true}).setView(center,10);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:18}).addTo(m);
  _map33=m;
  _render33kvMap(selected||'all',m);
}
function _render33kvMap(selected,existingMap){
  const m=existingMap||_map33;if(!m)return;
  // Clear existing layers except tile
  m.eachLayer(l=>{if(!(l instanceof L.TileLayer))m.removeLayer(l);});
  // PSS marker
  const pssIcon=L.divIcon({className:'',html:`<div style="width:18px;height:18px;background:#00bcd4;border:2px solid #fff;border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:700;color:#fff;box-shadow:0 0 8px #00bcd4;">P</div>`,iconSize:[18,18],iconAnchor:[9,9]});

  const towerIcon=L.divIcon({className:'',html:`<img src="turbine.png" width="22" height="22" style="filter:drop-shadow(0 0 4px #00c8ff);" onerror="this.outerHTML='<div style=width:18px;height:18px;background:#00c8ff;border-radius:50%;border:2px solid #fff;></div>'">`,iconSize:[22,22],iconAnchor:[11,11]});
  const solarIcon=L.divIcon({className:'',html:`<img src="solar.png" width="20" height="20" style="filter:drop-shadow(0 0 4px #ffaa00);" onerror="this.outerHTML='<div style=width:18px;height:18px;background:#ffaa00;border-radius:3px;border:2px solid #fff;></div>'">`,iconSize:[20,20],iconAnchor:[10,10]});

  const routes=selected==='all'?Object.keys(_FEEDER_ROUTES):[selected].filter(k=>_FEEDER_ROUTES[k]);
  routes.forEach(fKey=>{
    const f=_FEEDER_ROUTES[fKey];if(!f)return;
    const latlngs=f.nodes.map(n=>[n.lat,n.lng]);
    // Animated polyline
    const line=L.polyline(latlngs,{color:f.col,weight:3.5,opacity:.85,dashArray:'12,6'}).addTo(m);
    try{const pe=line.getElement();if(pe)pe.style.cssText+='animation:dashFlow 1.4s linear infinite;';}catch(e){}

    // Node markers with sequence numbers
    f.nodes.forEach((nd,idx)=>{
      let ic;
      if(nd.type==='pss')ic=pssIcon;
      else if(nd.type==='solar')ic=solarIcon;
      else ic=towerIcon;

      const pole33Icon=L.divIcon({className:'',
        html:`<div style="position:relative;"><div style="width:8px;height:8px;background:${f.col};border-radius:50%;border:1px solid #fff;position:absolute;top:-4px;left:-4px;"></div></div>`,
        iconSize:[8,8],iconAnchor:[4,4]});

      // add small pole dots between turbines
      if(idx<f.nodes.length-1){
        const [lat1,lng1]=[nd.lat,nd.lng];const [lat2,lng2]=[f.nodes[idx+1].lat,f.nodes[idx+1].lng];
        for(let t=0.2;t<=0.8;t+=0.3){
          const pl=[lat1+(lat2-lat1)*t,lng1+(lng2-lng1)*t];
          L.marker(pl,{icon:pole33Icon}).addTo(m).bindTooltip(`${fKey} — 33kV Pole`,{sticky:true});
        }
      }

      const status=DB.wtg.turbines.find(x=>x.id===nd.id)?.status||'—';
      const pct=nd.type==='turbine'?calcTurbProg(DB.wtg.turbines.find(x=>x.id===nd.id)||{civil:[],mech:[],uss:0,sup:0}):0;
      L.marker([nd.lat,nd.lng],{icon:ic}).addTo(m)
        .bindPopup(`<b>${fKey}</b> — Node ${idx+1}<br><b>${nd.id}</b><br>Type: ${nd.type.toUpperCase()}${nd.type==='turbine'?`<br>Status: ${status}<br>Progress: ${pct}%`:''}<br><small>Lat:${nd.lat.toFixed(4)}, Lng:${nd.lng.toFixed(4)}</small>`);
    });

    // Route label at midpoint
    const mid=Math.floor(latlngs.length/2);
    L.marker(latlngs[mid],{icon:L.divIcon({className:'',
      html:`<div style="background:${f.col};color:#fff;font-size:8px;font-weight:700;padding:2px 6px;border-radius:4px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,.4);">${fKey}</div>`,
      iconAnchor:[30,10]})}).addTo(m);
  });
}

function open33ProgressForm(){
  document.getElementById('p-t').textContent='📊 33kV Line — Daily Progress Entry';
  document.getElementById('p-b').innerHTML=`<form onsubmit="submit33Progress(event)">
    <div class="fr">
      <div class="fg"><label class="fl">Feeder</label>
        <select class="fs" id="p33-feeder"><option>Feeder 1</option><option>Feeder 2</option><option>Feeder 3</option><option>Feeder 4</option></select>
      </div>
      <div class="fg"><label class="fl">Activity</label>
        <select class="fs" id="p33-act"><option>Foundation</option><option>Erection</option><option>Stringing</option><option>ROW Clearance</option><option>Testing</option></select>
      </div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Poles Done Today</label><input class="fi" id="p33-qty" type="number" min="0" placeholder="No. of poles" required></div>
      <div class="fg"><label class="fl">Manpower</label><input class="fi" id="p33-mp" type="number" min="0" placeholder="Workers" required></div>
    </div>
    <div class="fg"><label class="fl">ROW Issues</label><input class="fi" id="p33-row" type="number" min="0" value="0"></div>
    <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="p33-rem" placeholder="Notes..."></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;">
      <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
      <button type="submit" class="btn btbo" style="flex:1;">✅ Submit</button>
    </div>
  </form>`;ov('pov');
}
function submit33Progress(e){
  e.preventDefault();
  const mp=+(document.getElementById('p33-mp')?.value||0);
  DB.mp.bop+=mp;updateKpiMp();
  scheduleSave();cov('pov');
  showToast('✅ 33kV Progress saved','ok');
  updateOverallBars();rndrBopSec('33kv');
}

function rndr66kv(sec){
  const el=document.getElementById('bop-sec-body-'+sec);if(!el)return;
  const tot66=calcBop66PctV2();

  // 66kV activity data with structured format: name, scope, done, completedDate
  const ACTS66=[
    {n:'Survey & Design',         scope:1,  done:1,  unit:'Lot',    col:'#ff9800', date:'15-Jan-2026'},
    {n:'ROW Clearance',           scope:66, done:13, unit:'towers', col:'#f57c00', date:'—'},
    {n:'Tower Foundation',        scope:66, done:8,  unit:'towers', col:'#e65100', date:'—'},
    {n:'Tower Erection',          scope:66, done:3,  unit:'towers', col:'#ff6d00', date:'—'},
    {n:'Stringing',               scope:66, done:0,  unit:'spans',  col:'#ffb300', date:'—'},
    {n:'Insulators & Fittings',   scope:66, done:0,  unit:'towers', col:'#ffd54f', date:'—'},
    {n:'Earthing',                scope:66, done:0,  unit:'towers', col:'#ffe082', date:'—'},
    {n:'Testing & Commissioning', scope:1,  done:0,  unit:'Lot',    col:'#fff176', date:'—'},
  ];

  // All 65 towers with status
  const ALL_TOWERS=EHV_66KV_TOWERS.map((t,i)=>({
    ...t,
    sl:i+1,
    fdn: i<8?'Done':i<15?'WIP':'Pending',
    erection: i<3?'Done':i<5?'WIP':'Pending',
    stringing:'Pending',
    statusColor: (i<3?'var(--ok)':i<8?'var(--wn)':'var(--er)'),
  }));

  el.innerHTML=`
    <!-- KPIs -->
    <div class="kr" style="margin-bottom:14px;">
      <div class="kpi" data-tt="Total 66kV EHV towers PSS to GSS"><div class="kb" style="background:var(--kv6)"></div><div class="kl">Total Towers</div><div class="kv" style="color:var(--kv6)">65</div></div>
      <div class="kpi" data-tt="Foundation complete"><div class="kb" style="background:var(--ok)"></div><div class="kl">Foundation Done</div><div class="kv" style="color:var(--ok)">8/65</div></div>
      <div class="kpi" data-tt="Tower erection done"><div class="kb" style="background:var(--ac)"></div><div class="kl">Erection Done</div><div class="kv" style="color:var(--ac)">3/65</div></div>
      <div class="kpi" data-tt="Route length PSS to GSS"><div class="kb" style="background:var(--kv6)"></div><div class="kl">Route Length</div><div class="kv" style="color:var(--kv6)">12.75 km</div></div>
      <div class="kpi" data-tt="Overall 66kV progress"><div class="kb" style="background:var(--kv6)"></div><div class="kl">Overall</div><div class="kv" style="color:var(--kv6)">${tot66}%</div></div>
    </div>

    <!-- TWO-COLUMN: left=activities | right=map+chart -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start;">

      <!-- LEFT: Structured activity table -->
      <div>
        <div class="pnl" style="margin-bottom:10px;">
          <div class="ph2"><div class="pt" style="font-weight:700;">66kV Activities — Structured Progress</div><button class="btn btbo bts" style="font-size:8px;" onclick="reqLogin('bop',()=>open66ProgressForm())">Update</button></div>
          ${ACTS66.map((a,i)=>{
            const pct=a.scope>0?Math.round(a.done/a.scope*100):0;
            const col=pct>=100?'var(--ok)':pct>0?'var(--wn)':'var(--er)';
            return`<div style="display:flex;align-items:center;gap:8px;padding:7px 4px;border-bottom:1px solid var(--b1);" data-tt="${a.n}: ${a.done} of ${a.scope} ${a.unit} complete">
              <div style="width:10px;height:10px;border-radius:2px;background:${a.col};flex-shrink:0;"></div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:10px;font-weight:700;color:var(--t1);">${a.n} — <span style="color:${a.col};">${a.done}/${a.scope} ${a.unit}</span></div>
                <div style="display:flex;align-items:center;gap:6px;margin-top:3px;">
                  <div style="flex:1;height:5px;background:var(--b1);border-radius:3px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${a.col};border-radius:3px;transition:width 1.2s ease;"></div>
                  </div>
                  <span style="font-size:9px;font-weight:700;color:${col};min-width:30px;">${pct}%</span>
                  <span style="font-size:8px;color:var(--t3);white-space:nowrap;">${a.date==='—'?'—':a.date}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>

        <!-- Tower Schedule: all 65 towers -->
        <div class="pnl">
          <div class="ph2">
            <div class="pt" style="font-weight:700;">66kV Tower Schedule — GSS → PSS (65 Structures)</div>
            <button class="btn bts" style="font-size:8px;" onclick="_toggle66TowerList()" data-tt="Show/hide full tower schedule">Toggle</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-bottom:8px;">
            <div style="text-align:center;background:var(--card2);border-radius:6px;padding:6px;"><div style="font-size:8px;color:var(--t3);">Done</div><div style="font-size:18px;font-weight:700;color:var(--ok);">8</div></div>
            <div style="text-align:center;background:var(--card2);border-radius:6px;padding:6px;"><div style="font-size:8px;color:var(--t3);">WIP</div><div style="font-size:18px;font-weight:700;color:var(--wn);">7</div></div>
            <div style="text-align:center;background:var(--card2);border-radius:6px;padding:6px;"><div style="font-size:8px;color:var(--t3);">Pending</div><div style="font-size:18px;font-weight:700;color:var(--er);">50</div></div>
          </div>
          <div id="tower66-list" style="display:none;">
            <div class="tsc" style="max-height:320px;"><table class="tbl">
              <thead><tr><th>#</th><th>Tower ID</th><th>Type</th><th>Foundation</th><th>Erection</th><th>Stringing</th><th>Tower→Next</th></tr></thead>
              <tbody>
                ${ALL_TOWERS.map((t,i)=>{
                  const next=ALL_TOWERS[i+1];
                  const sCol=t.erection==='Done'?'var(--ok)':t.fdn==='Done'?'var(--wn)':'var(--er)';
                  return`<tr class="xrow" onclick="_show66TowerDetail('${t.id}')" data-tt="Click to see ${t.id} status">
                    <td style="color:var(--t3);font-size:8px;">${t.sl}</td>
                    <td><b>${t.id}</b></td>
                    <td><span class="chip cy" style="font-size:7px;">${t.type}</span></td>
                    <td><span class="chip ${t.fdn==='Done'?'cg':t.fdn==='WIP'?'cy':'cr'}" style="font-size:7px;">${t.fdn}</span></td>
                    <td><span class="chip ${t.erection==='Done'?'cg':t.erection==='WIP'?'cy':'cr'}" style="font-size:7px;">${t.erection}</span></td>
                    <td><span class="chip cr" style="font-size:7px;">Pending</span></td>
                    <td style="font-size:9px;color:var(--t3);">${next?`${t.id} → ${next.id}`:'PSS End'}</td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table></div>
          </div>
          <div id="tower66-detail-box"></div>
        </div>
      </div>

      <!-- RIGHT: 66kV Map + Planned vs Actual -->
      <div style="display:flex;flex-direction:column;gap:10px;">
        <div class="pnl">
          <div class="ph2"><div class="pt" style="font-weight:700;">66kV EHV Line Map — Click Tower for Status</div></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:6px;font-size:8px;">
            ${[['var(--ok)','Erected'],['var(--wn)','Foundation Done'],['var(--er)','Pending'],['#00bcd4','GSS/PSS']].map(([c,l])=>
              `<span style="display:flex;align-items:center;gap:3px;"><span style="width:10px;height:10px;border-radius:50%;background:${c};border:1px solid rgba(255,255,255,.4);display:inline-block;"></span>${l}</span>`).join('')}
          </div>
          <div id="map-66kv" style="height:320px;border-radius:8px;border:1px solid var(--b1);"></div>
        </div>
        <div class="pnl">
          <div class="ph2"><div class="pt" style="font-weight:700;">Planned vs Actual — 66kV EHV</div></div>
          <div class="ch h200"><canvas id="ch-66kv-pva"></canvas></div>
        </div>
      </div>
    </div>`;

  setTimeout(()=>{
    _bopPVAChart('ch-66kv-pva');
    _init66kvMap(ALL_TOWERS);
  },120);
}

function _toggle66TowerList(){
  const el=document.getElementById('tower66-list');
  if(el)el.style.display=el.style.display==='none'?'block':'none';
}

function _show66TowerDetail(towerId){
  const el=document.getElementById('tower66-detail-box');if(!el)return;
  const t=EHV_66KV_TOWERS.find(x=>x.id===towerId);if(!t)return;
  const idx=EHV_66KV_TOWERS.indexOf(t);
  const fdn=idx<8?'Done':idx<15?'WIP':'Pending';
  const erc=idx<3?'Done':idx<5?'WIP':'Pending';
  const fnCol=fdn==='Done'?'var(--ok)':fdn==='WIP'?'var(--wn)':'var(--er)';
  const erCol=erc==='Done'?'var(--ok)':erc==='WIP'?'var(--wn)':'var(--er)';
  el.innerHTML=`<div style="background:var(--card2);border:1px solid var(--kv6);border-radius:8px;padding:10px;margin-top:8px;">
    <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
      <div style="font-family:var(--f2);font-size:14px;font-weight:700;color:var(--kv6);">${towerId}</div>
      <button onclick="document.getElementById('tower66-detail-box').innerHTML=''" style="background:none;border:1px solid var(--b1);color:var(--t3);width:22px;height:22px;border-radius:5px;cursor:pointer;font-size:10px;">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;">
      <div style="text-align:center;background:var(--card);border-radius:6px;padding:6px;"><div style="font-size:8px;color:var(--t3);">Foundation</div><span class="chip ${fdn==='Done'?'cg':fdn==='WIP'?'cy':'cr'}">${fdn}</span></div>
      <div style="text-align:center;background:var(--card);border-radius:6px;padding:6px;"><div style="font-size:8px;color:var(--t3);">Erection</div><span class="chip ${erc==='Done'?'cg':erc==='WIP'?'cy':'cr'}">${erc}</span></div>
      <div style="text-align:center;background:var(--card);border-radius:6px;padding:6px;"><div style="font-size:8px;color:var(--t3);">Stringing</div><span class="chip cr">Pending</span></div>
    </div>
    <div style="margin-top:6px;font-size:8px;color:var(--t3);">Lat:${t.lat.toFixed(5)}, Lng:${t.lng.toFixed(5)} | Type: ${t.type.toUpperCase()}</div>
    <div style="margin-top:4px;font-size:9px;">Next: ${EHV_66KV_TOWERS[idx+1]?EHV_66KV_TOWERS[idx+1].id:'END'} | Prev: ${idx>0?EHV_66KV_TOWERS[idx-1].id:'START'}</div>
  </div>`;
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

let _map66=null;
function _init66kvMap(allTowers){
  const mc=document.getElementById('map-66kv');if(!mc)return;
  if(_map66){try{_map66.remove();}catch(e){}}_map66=null;
  const m=L.map('map-66kv',{zoomControl:true}).setView([14.849,76.405],11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{attribution:'© OSM',maxZoom:18}).addTo(m);
  _map66=m;

  // Draw the EHV line
  const lineCoords=allTowers.map(t=>[t.lat,t.lng]);
  L.polyline(lineCoords,{color:'#ff9800',weight:3,opacity:.85,dashArray:'8,5'}).addTo(m);

  // Tower markers with status-based color
  allTowers.forEach((t,i)=>{
    const fdn=i<8?'Done':i<15?'WIP':'Pending';
    const erc=i<3?'Done':i<5?'WIP':'Pending';
    const col=erc==='Done'?'#00e676':fdn==='Done'?'#ffca28':'#ff5252';
    const size=t.type==='terminal'?16:t.type==='gantry'?10:8;
    const shape=t.type==='terminal'?'border-radius:3px;':'border-radius:50%;';
    const ic=L.divIcon({className:'',
      html:`<div style="width:${size}px;height:${size}px;background:${col};${shape}border:${t.type==='terminal'?2:1}px solid #fff;box-shadow:0 0 6px ${col};"></div>`,
      iconSize:[size,size],iconAnchor:[size/2,size/2]});
    L.marker([t.lat,t.lng],{icon:ic}).addTo(m)
      .on('click',()=>_show66TowerDetail(t.id))
      .bindTooltip(`<b>${t.id}</b><br>Fdn: ${fdn} | Erection: ${erc}`,{sticky:true});
  });
}

function open66ProgressForm(){
  document.getElementById('p-t').textContent='📊 66kV EHV Line — Progress Entry';
  document.getElementById('p-b').innerHTML=`<form onsubmit="submit66Progress(event)">
    <div class="fr">
      <div class="fg"><label class="fl">Activity</label>
        <select class="fs" id="p66-act"><option>Foundation</option><option>Erection</option><option>Stringing</option><option>ROW Clearance</option><option>Testing</option></select>
      </div>
      <div class="fg"><label class="fl">Towers Done (cumulative)</label><input class="fi" id="p66-done" type="number" min="0" max="65" placeholder="e.g. 8" required></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Manpower</label><input class="fi" id="p66-mp" type="number" min="0" placeholder="Workers" required></div>
      <div class="fg"><label class="fl">Completed Date</label><input class="fi" id="p66-date" type="date"></div>
    </div>
    <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="p66-rem" placeholder="Notes..."></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;">
      <button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button>
      <button type="submit" class="btn btbo" style="flex:1;">✅ Submit</button>
    </div>
  </form>`;ov('pov');
}
function submit66Progress(e){
  e.preventDefault();
  const mp=+(document.getElementById('p66-mp')?.value||0);
  DB.mp.bop+=mp;updateKpiMp();scheduleSave();cov('pov');
  showToast('✅ 66kV Progress saved','ok');
  updateOverallBars();rndrBopSec('66kv');
}
function toggle66TowerTable(){_toggle66TowerList();}
function show66TowerTable(){_toggle66TowerList();}
function show66Vendor(v){}


function render66FeederCard(feeder, defs){
  const acts=DB.bopActs['66kv'][feeder.id]||defs.map(()=>0);
  const p=calcBopLinePct('66kv',feeder.id);
  const cid='ch66f-'+feeder.id.replace(/\s/g,'_');
  const detId='det66f-'+feeder.id.replace(/\s/g,'_');
  return`<div class="pnl">
    <div class="ph2">
      <div class="pt" style="color:var(--kv6)">🔌 ${feeder.id} — Tower Type: ${feeder.towerType} | ${feeder.km}km | ${p.toFixed(1)}% Complete</div>
      <button class="btn btbo bts" onclick="reqLogin('bop',()=>open66FeederProg('${feeder.id}'))">📊 Progress</button>
    </div>
    <div class="g2" style="margin-bottom:11px;">
      <div>
        <div style="font-size:9px;color:var(--t3);margin-bottom:4px;text-align:center;">Weighted Activity Progress</div>
        <div class="ch h200"><canvas id="${cid}"></canvas></div>
        <div style="margin-top:6px;">
          ${defs.map((d,i)=>{const v=+(((acts[i]||0)/100*d.w)).toFixed(1);return`<div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
            <div style="width:9px;height:9px;border-radius:2px;background:${d.col};flex-shrink:0;"></div>
            <div style="font-size:8px;color:var(--t2);flex:1;">${d.n}</div>
            <div style="font-size:8px;font-weight:700;color:${d.col};">${v}%</div>
          </div>`;}).join('')}
        </div>
      </div>
      <div>
        <div class="ir"><div class="irl">Route Length</div><div class="irr">${feeder.km} km</div></div>
        <div class="ir"><div class="irl">Tower Type</div><div class="irr" style="color:var(--kv6)">${feeder.towerType}</div></div>
        <div class="ir"><div class="irl">Tower Scope</div><div class="irr">${feeder.towers.scope}</div></div>
        <div class="ir"><div class="irl">Foundation Done</div><div class="irr" style="color:var(--ok)">${feeder.towers.done}</div></div>
        <div class="ir"><div class="irl">Stringing</div><div class="irr">${feeder.stringing.done}/${feeder.stringing.scope} km</div></div>
        <div class="ir"><div class="irl">Notes</div><div class="irr" style="font-size:9px;">${feeder.notes}</div></div>
        <div style="height:8px;background:var(--b1);border-radius:4px;margin-top:8px;overflow:hidden;">
          <div style="width:${p}%;height:100%;background:var(--kv6);border-radius:4px;transition:width 1s;"></div>
        </div>
        <div style="font-family:var(--f2);font-size:18px;font-weight:700;color:var(--kv6);margin-top:4px;">${p.toFixed(1)}%</div>
      </div>
    </div>
    <div style="font-size:10px;font-weight:600;margin-bottom:6px;">📋 Activities — click for detail</div>
    <div class="actg">
      ${defs.map((d,i)=>{const v=acts[i]||0;return`<div class="actc" onclick="show66FeederActPie('${feeder.id}',${i})">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><div class="actc-nm">${d.n}</div><div class="actc-pct" style="color:${d.col}">${v}%</div></div>
        <div class="actc-bar"><div class="actc-fill" style="width:${v}%;background:${d.col}"></div></div>
        <div class="mst"><div class="ms">W:<b>${d.w}%</b></div><div class="ms">Cum:<b style="color:var(--ok)">${v}%</b></div></div>
        <div class="actc-hint">Click for pie →</div>
      </div>`;}).join('')}
    </div>
    <div id="${detId}"></div>
  </div>`;
}

function show66FeederActPie(feederId,idx){
  const defs=DB.bopActDefs['66kv'];const d=defs[idx];
  const acts=DB.bopActs['66kv'][feederId]||defs.map(()=>0);
  const v=acts[idx]||0;const bal=100-v;
  const detId='det66f-'+feederId.replace(/\s/g,'_');
  const el=document.getElementById(detId);if(!el)return;
  const cid='ch66det-'+feederId.replace(/\s/g,'_')+'_'+idx;
  el.innerHTML=`<div class="det">
    <div style="display:flex;justify-content:space-between;margin-bottom:9px;">
      <div><div style="font-family:var(--f2);font-size:14px;font-weight:700;color:${d.col}">${d.n}</div>
      <div style="font-size:8px;color:var(--t3);">${feederId} | Weight: ${d.w}%</div></div>
      <button onclick="document.getElementById('${detId}').innerHTML=''" style="background:none;border:1px solid var(--b1);color:var(--t3);width:22px;height:22px;border-radius:5px;cursor:pointer;font-size:10px;">✕</button>
    </div>
    <div class="g2">
      <div class="ch h200"><canvas id="${cid}"></canvas></div>
      <div>
        <div class="ir"><div class="irl">Cumulative Done</div><div class="irr" style="color:var(--ok);font-size:15px;font-weight:700;">${v}%</div></div>
        <div class="ir"><div class="irl">Remaining</div><div class="irr" style="color:var(--er)">${bal}%</div></div>
        <div class="ir"><div class="irl">Weight</div><div class="irr" style="color:${d.col}">${d.w}%</div></div>
        <div class="ir"><div class="irl">Weighted Contrib.</div><div class="irr">${+(v/100*d.w).toFixed(2)}%</div></div>
        <div class="ir"><div class="irl">Status</div><div class="irr">${v>=100?'<span class="chip cg">✔ Done</span>':v>0?'<span class="chip cy">🟡 WIP</span>':'<span class="chip cr">🔴 Pending</span>'}</div></div>
      </div>
    </div>
  </div>`;
  setTimeout(()=>mkC(cid,{type:'doughnut',
    data:{labels:['Cumulative Done','Remaining'],datasets:[{data:[v,bal],
      backgroundColor:[d.col,'rgba(26,46,74,.55)'],borderWidth:0,cutout:'65%'}]},
    options:{responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:true,position:'bottom',labels:{font:{size:9},generateLabels:function(chart){
        const ds=chart.data.datasets[0];
        return chart.data.labels.map((lbl,i)=>({text:`${lbl}: ${ds.data[i]}%`,fillStyle:ds.backgroundColor[i],strokeStyle:'transparent',lineWidth:0}));
      }}}}}}),45);
  el.scrollIntoView({behavior:'smooth',block:'nearest'});
}

function open66FeederProg(feederId){
  const defs=DB.bopActDefs['66kv'];
  document.getElementById('p-t').textContent='📊 66kV '+feederId+' – Progress Entry';
  document.getElementById('p-b').innerHTML=`<form onsubmit="submit66FeederProg(event,'${feederId}')">
    <div class="al al-w" style="margin-bottom:9px;">⚠️ Authorized entry. Updates live calculations.</div>
    <div class="fr">
      <div class="fg"><label class="fl">Activity</label><select class="fs" id="p66f-act">${defs.map((d,i)=>`<option value="${i}">${d.n} (${DB.bopActs['66kv'][feederId]?.[i]||0}%)</option>`).join('')}</select></div>
      <div class="fg"><label class="fl">New Cumulative %</label><input class="fi" id="p66f-cum" type="number" min="0" max="100" step="0.1" placeholder="New total %" required></div>
    </div>
    <div class="fr">
      <div class="fg"><label class="fl">Today's Progress %</label><input class="fi" id="p66f-td" type="number" min="0" max="100" step="0.1" placeholder="e.g. 5"></div>
      <div class="fg"><label class="fl">Manpower</label><input class="fi" id="p66f-mp" type="number" min="0" placeholder="Workers" required></div>
    </div>
    <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="p66f-rem" placeholder="Notes..."></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button><button type="submit" class="btn btbo" style="flex:1;">✅ Submit</button></div>
  </form>`;ov('pov');
}

function submit66FeederProg(e,feederId){
  e.preventDefault();
  const idx=+document.getElementById('p66f-act').value;
  const cum=+document.getElementById('p66f-cum').value;
  const mp=+document.getElementById('p66f-mp').value;
  if(!DB.bopActs['66kv'][feederId])DB.bopActs['66kv'][feederId]=DB.bopActDefs['66kv'].map(()=>0);
  DB.bopActs['66kv'][feederId][idx]=Math.min(100,cum);
  // Sync tower count
  const feeder=DB.bop66.feeders?.find(f=>f.id===feederId);
  if(feeder&&idx===2)feeder.towers.done=Math.round(cum/100*feeder.towers.scope);
  DB.mp.bop+=mp;updateKpiMp();scheduleSave();cov('pov');
  alert(`✅ 66kV ${feederId} Progress Saved!\n${DB.bopActDefs['66kv'][idx].n}: ${cum}%`);
  updateOverallBars();rndrBopSec('66kv');
}

function toggle66TowerTable(){
  const t=document.getElementById('tower-table-66kv');
  if(t)t.style.display=t.style.display==='none'?'block':'none';
}

function show66TowerTable(){toggle66TowerTable();}
function show66Vendor(v){} // legacy stub

function _bopPVAChart(canvasId){
  // Mini Planned vs Actual chart for BOP section
  const sc=DB.schedule;
  const fi=sc.actual.findLastIndex(v=>v!==null);
  const fc=sc.labels.map((_,i)=>{
    if(i<=fi)return null;
    const base=sc.actual[fi],rem=100-base,steps=sc.labels.length-1-fi;
    return R(base+rem*(i-fi)/steps);
  });
  mkC(canvasId,{type:'line',data:{labels:sc.labels,datasets:[
    {label:'Planned',data:sc.planned,borderColor:'rgba(0,200,255,.8)',backgroundColor:'rgba(0,200,255,.08)',tension:.4,pointRadius:2,fill:true,borderWidth:1.5},
    {label:'Actual', data:sc.actual, borderColor:'rgba(0,230,118,.8)',backgroundColor:'rgba(0,230,118,.08)',tension:.4,pointRadius:3,fill:true,borderWidth:1.5,spanGaps:false},
    {label:'Forecast',data:fc,       borderColor:'rgba(255,202,40,.7)',backgroundColor:'transparent',tension:.4,pointRadius:2,borderDash:[5,3],fill:false,borderWidth:1.5,spanGaps:false},
  ]},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},
    plugins:{legend:{position:'top',labels:{boxWidth:8,font:{size:8}}}},
    scales:{y:{min:0,max:100,ticks:{callback:v=>v+'%',font:{size:7}}},x:{ticks:{font:{size:7}}}}}});
}

function _bopActTable(acts,secKey){
  const aks=Object.keys(acts);
  const overall=R(aks.reduce((s,nm)=>s+(acts[nm].done/acts[nm].scope*100),0)/aks.length);
  return`
    <div class="tsc" style="margin-bottom:0;">
      <table class="tbl">
        <thead><tr><th>Activity</th><th>Scope</th><th>Done</th><th>WIP</th><th>Balance</th><th>%</th></tr></thead>
        <tbody>
          ${aks.map(nm=>{
            const a=acts[nm];
            const pct=a.scope>0?R(Math.min(100,a.done/a.scope*100)):0;
            const bal=a.bal!==undefined?a.bal:R(a.scope-a.done);
            const pctColor=pct>=100?'var(--ok)':pct>50?'var(--wn)':'var(--er)';
            return`<tr>
              <td style="font-size:9px;"><b>${nm}</b></td>
              <td style="text-align:center;">${a.scope} <span style="font-size:7px;color:var(--t3);">${a.unit}</span></td>
              <td style="text-align:center;color:var(--ok);font-weight:600;">${a.done}</td>
              <td style="text-align:center;color:var(--wn);">${a.wip||0}</td>
              <td style="text-align:center;color:var(--er);">${bal}</td>
              <td style="text-align:center;">
                <div style="display:flex;align-items:center;gap:4px;">
                  <div style="flex:1;height:5px;background:var(--b1);border-radius:3px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${a.col};border-radius:3px;"></div>
                  </div>
                  <span style="font-size:9px;font-weight:700;color:${pctColor};min-width:30px;">${pct}%</span>
                </div>
              </td>
            </tr>`;
          }).join('')}
          <tr style="background:var(--card3);font-weight:700;">
            <td><b>OVERALL</b></td>
            <td colspan="4"></td>
            <td style="text-align:center;color:${overall>=80?'var(--ok)':overall>40?'var(--wn)':'var(--er)'};">${overall}%</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function rndrPSS(sec){
  const el=document.getElementById('bop-sec-body-'+sec);if(!el)return;
  const acts=DB.pss.acts;const aks=Object.keys(acts);
  const overall=calcPssPct();const totalMp=DB.pss.mp||0;
  const switchActs={};const mcrActs={};
  aks.forEach(k=>{if(k.startsWith('CRB')||k.startsWith('Brick')||k.startsWith('Roof')||k.startsWith('Cable Trench')||k.startsWith('C&R'))mcrActs[k]=acts[k];else switchActs[k]=acts[k];});
  el.innerHTML=`
    <div class="kr" style="margin-bottom:10px;">
      <div class="kpi"><div class="kb" style="background:var(--pss)"></div><div class="kl">PSS Overall</div><div class="kv" style="color:var(--pss)">${overall}%</div></div>
      <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Today Progress</div><div class="kv" style="color:var(--ok)">${DB.pss.todayProg||0}%</div></div>
      <div class="kpi"><div class="kb" style="background:var(--wtg)"></div><div class="kl">Manpower</div><div class="kv" style="color:var(--wtg)">${totalMp}</div></div>
      <div class="kpi"><div class="kb" style="background:var(--er)"></div><div class="kl">ROW Issues</div><div class="kv" style="color:var(--er)">0</div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
      <div>
        <div class="ph2" style="margin-bottom:6px;"><div class="pt" style="font-weight:700;color:var(--pss);">Switchyard &amp; Cable Activities</div><button class="btn btbo bts" onclick="reqLogin('bop',()=>openPSSProg())">Update</button></div>
        ${_bopActTable(switchActs,'pss')}
      </div>
      <div class="pnl"><div class="ph2"><div class="pt" style="font-weight:700;">PSS Activities — Planned vs Actual</div></div><div class="ch h240"><canvas id="ch-pss-pva"></canvas></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div>
        <div class="ph2" style="margin-bottom:6px;"><div class="pt" style="font-weight:700;color:var(--pss);">MCR Building Activities</div></div>
        ${_bopActTable(mcrActs,'pss-mcr')}
      </div>
      <div class="pnl"><div class="ph2"><div class="pt" style="font-weight:700;">MCR Building — Planned vs Actual</div></div><div class="ch h240"><canvas id="ch-mcr-pva"></canvas></div></div>
    </div>`;
  setTimeout(()=>{_bopPVAChart('ch-pss-pva');_bopPVAChart('ch-mcr-pva');},80);
}

function rndrGSS(sec){
  const el=document.getElementById('bop-sec-body-'+sec);if(!el)return;
  const acts=DB.gss.acts;
  const overall=calcGssPct();
  const totalMp=DB.gss.mp||0;
  el.innerHTML=`
    <div class="g2" style="margin-bottom:10px;">
      <div>
        <div class="kr" style="margin-bottom:8px;">
          <div class="kpi"><div class="kb" style="background:var(--gss)"></div><div class="kl">GSS Overall</div><div class="kv" style="color:var(--gss)">${overall}%</div></div>
          <div class="kpi"><div class="kb" style="background:var(--ok)"></div><div class="kl">Today Progress</div><div class="kv" style="color:var(--ok)">${DB.gss.todayProg||0}%</div></div>
          <div class="kpi"><div class="kb" style="background:var(--wtg)"></div><div class="kl">Manpower</div><div class="kv" style="color:var(--wtg)">${totalMp}</div></div>
        </div>
        <div class="ph2" style="margin-bottom:6px;"><div class="pt">GSS 66kV Activities</div><button class="btn btbo bts" onclick="reqLogin('bop',()=>openGSSProg())">📊 Update</button></div>
        ${_bopActTable(acts,'gss')}
      </div>
      <div>
        <div class="pnl"><div class="ph2"><div class="pt">Planned vs Actual</div></div><div class="ch h200"><canvas id="ch-gss-pva"></canvas></div></div>
      </div>
    </div>`;
  setTimeout(()=>{ _bopPVAChart('ch-gss-pva'); },80);
}
function showBopAct(secKey,nm){} // legacy stub

function openPSSProg(){
  document.getElementById('p-t').textContent='📊 PSS Progress Update';
  document.getElementById('p-b').innerHTML=`<form onsubmit="submitPSSGSSProg(event,'pss')">
    <div class="fr"><div class="fg"><label class="fl">Activity</label><select class="fs" id="ppss-act">${Object.keys(DB.pss.acts).map(a=>`<option>${a}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Cumulative Done</label><input class="fi" id="ppss-cum" type="number" min="0" placeholder="Total qty done" required></div></div>
    <div class="fr"><div class="fg"><label class="fl">WIP</label><input class="fi" id="ppss-wip" type="number" min="0" placeholder="In progress qty"></div>
    <div class="fg"><label class="fl">Manpower</label><input class="fi" id="ppss-mp" type="number" min="0" placeholder="Workers" required></div></div>
    <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="ppss-rem" placeholder="Notes..."></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button><button type="submit" class="btn btbo" style="flex:1;">✅ Submit</button></div>
  </form>`;ov('pov');
}
function openGSSProg(){
  document.getElementById('p-t').textContent='📊 GSS Progress Update';
  document.getElementById('p-b').innerHTML=`<form onsubmit="submitPSSGSSProg(event,'gss')">
    <div class="fr"><div class="fg"><label class="fl">Activity</label><select class="fs" id="pgss-act">${Object.keys(DB.gss.acts).map(a=>`<option>${a}</option>`).join('')}</select></div>
    <div class="fg"><label class="fl">Cumulative Done</label><input class="fi" id="pgss-cum" type="number" min="0" placeholder="Total done" required></div></div>
    <div class="fr"><div class="fg"><label class="fl">WIP</label><input class="fi" id="pgss-wip" type="number" min="0"></div>
    <div class="fg"><label class="fl">Manpower</label><input class="fi" id="pgss-mp" type="number" min="0" placeholder="Workers" required></div></div>
    <div class="fg"><label class="fl">Remarks</label><textarea class="fta" id="pgss-rem" placeholder="Notes..."></textarea></div>
    <div style="display:flex;gap:7px;margin-top:7px;"><button type="button" class="btn" style="flex:1;" onclick="cov('pov')">Cancel</button><button type="submit" class="btn btbo" style="flex:1;">✅ Submit</button></div>
  </form>`;ov('pov');
}
function submitPSSGSSProg(e,sec){
  e.preventDefault();const prefix='p'+sec;
  const act=document.getElementById(prefix+'-act').value;
  const cum=+document.getElementById(prefix+'-cum').value;
  const wip=+(document.getElementById(prefix+'-wip')?.value||0);
  const mp=+document.getElementById(prefix+'-mp').value;
  const acts=sec==='pss'?DB.pss.acts:DB.gss.acts;
  if(acts[act]){acts[act].done=cum;acts[act].wip=wip;acts[act].bal=acts[act].scope-cum;}
  if(sec==='pss')DB.pss.mp=(DB.pss.mp||0)+mp; else DB.gss.mp=(DB.gss.mp||0)+mp;
  DB.mp.bop+=mp;updateKpiMp();scheduleSave();cov('pov');
  showToast('✅ '+sec.toUpperCase()+' Progress Saved!','ok');
  updateOverallBars();rndrBopSec(sec);
}


// ═══════════════════════════════════════════════════════════

// ── 33kV expandable row toggle ────────────────────────────────────────────
function _toggle33row(idx){
  const det=document.getElementById('xdet33-'+idx);
  const arr=document.getElementById('xarr33-'+idx);
  if(!det)return;
  const hidden=det.classList.toggle('gone');
  if(arr)arr.classList.toggle('open',!hidden);
}
// Filter 33kV table by feeder
function _filter33kv(feeder){
  document.querySelectorAll('#tbl-33kv-feeders .xrow').forEach(tr=>{
    const f=tr.getAttribute('data-feeder')||'';
    const show=!feeder||f===feeder;
    tr.style.display=show?'':'none';
    // also hide its detail row
    const rid=tr.querySelector('.xarrow')?.id?.replace('xarr33-','');
    if(rid){const det=document.getElementById('xdet33-'+rid);if(det){if(!show)det.classList.add('gone');}}
  });
}
// 33kV summary for drilldown modal
function _get33kvSummaryHtml(){
  const total=DB.bop33feeders.reduce((s,r)=>s+r.scope,0);
  const done=DB.bop33feeders.reduce((s,r)=>s+r.done,0);
  const pct=total>0?Math.round(done/total*100):0;
  return`<div class="g4" style="margin-bottom:14px;">
    <div class="pnl"><div class="kl">Total Scope</div><div class="kv" style="color:var(--ac);">${total}</div><div class="km">Poles / spans</div></div>
    <div class="pnl"><div class="kl">Done</div><div class="kv" style="color:var(--ok);">${done}</div><div class="km">Completed</div></div>
    <div class="pnl"><div class="kl">Balance</div><div class="kv" style="color:var(--er);">${total-done}</div><div class="km">Remaining</div></div>
    <div class="pnl"><div class="kl">Overall %</div><div class="kv" style="color:${pct>=80?'var(--ok)':pct>40?'var(--wn)':'var(--er)'};">${pct}%</div></div>
  </div>
  <div style="font-size:9px;font-weight:700;color:var(--t3);margin-bottom:6px;">Feeder Summary</div>
  ${['1','2','3','4'].map(f=>{
    const rows=DB.bop33feeders.filter(r=>r.feeder===f||r.feeder==='1&2');
    const fScope=rows.reduce((s,r)=>s+r.scope,0);
    const fDone=rows.reduce((s,r)=>s+r.done,0);
    const fp=fScope>0?Math.round(fDone/fScope*100):0;
    return`<div class="pr" style="margin-bottom:5px;">
      <div class="prl" style="font-size:9px;">Feeder ${f}</div>
      <div class="prt"><div class="prf" style="width:${fp}%;background:var(--kv3)"></div></div>
      <div class="prp" style="color:var(--kv3);font-size:9px;">${fp}%</div>
    </div>`;}).join('')}`;
}

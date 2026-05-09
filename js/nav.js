//  STATE & NAV
// ═══════════════════════════════════════════════════════════
let CU=null,LCB=null,LR=null,CV='home',curITC='ITC-1',curWT=0,curPT='s',mapInst=null;
const CH={};

function nav(v,p={}){
  ldr(true);
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.ni').forEach(x=>x.classList.remove('on'));
  CV=v;
  document.getElementById('view-'+v)?.classList.add('on');
  const nk=v.startsWith('bop-')? 'bop-'+v.replace('bop-','') : v==='itc'?'solar' : v==='landwtg'||v==='landsol'?'land' : v;
  document.getElementById('nav-'+nk)?.classList.add('on');
  // Also highlight parent for bop sub-sections
  if(v.startsWith('bop-')) document.getElementById('nav-bop')?.classList.add('on');
  setBc(v,p);
  setTimeout(()=>{rndr(v,p);ldr(false);},35);
}
function setBc(v,p){
  const L={home:'Dashboard',solar:'☀️ Solar',wtg:'🌬️ WTG',land:'🌍 Land',landwtg:'📍 WTG Land',landsol:'🌾 Solar Land',bop:'⚙️ BOP','bop-33kv':'33kV','bop-66kv':'66kV','bop-pss':'PSS','bop-gss':'GSS',pod:'📋 POD',safety:'🦺 Safety',manpower:'👷 Manpower',map:'🗺️ Map',itc:'ITC Detail'};
  let h=`<span class="bci" onclick="nav('home')">🏠 SWPPL</span>`;
  if(v!=='home'){
    if(v.startsWith('bop-'))h+=`<span class="bcs">›</span><span class="bci" onclick="nav('bop')">⚙️ BOP</span><span class="bcs">›</span><span class="bci last">${L[v]||v}</span>`;
    else if(v==='itc')h+=`<span class="bcs">›</span><span class="bci" onclick="nav('solar')">☀️ Solar</span><span class="bcs">›</span><span class="bci last">${p.itc||curITC}</span>`;
    else if(v==='landwtg'||v==='landsol')h+=`<span class="bcs">›</span><span class="bci" onclick="nav('land')">🌍 Land</span><span class="bcs">›</span><span class="bci last">${L[v]}</span>`;
    else h+=`<span class="bcs">›</span><span class="bci last">${L[v]||v}</span>`;
  }
  document.getElementById('bc').innerHTML=h;
}
function ldr(on){const l=document.getElementById('ldr');l.style.width=on?'72%':'100%';if(!on)setTimeout(()=>l.style.width='0',220);}
function rndr(v,p){
  const m={home:rndrHome,solar:rndrSolar,itc:()=>rndrITC(p.itc||curITC),wtg:()=>{rndrWtg();wTab(curWT);},land:rndrLand,landwtg:rndrWtgLand,landsol:rndrSolLand,bop:rndrBop,pod:rndrPod,safety:rndrSafety,manpower:rndrMp,map:rndrMap};
  if(v.startsWith('bop-'))rndrBopSec(v.replace('bop-',''));
  else if(m[v])m[v]();
}

// ═══════════════════════════════════════════════════════════
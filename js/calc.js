//  CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════
function calcITCProg(id){
  const itc=DB.solar.itcs[id];
  if(!itc||!Array.isArray(itc.acts))return 0;
  const v=itc.acts.reduce((s,a)=>{
    const done=Number(a&&a.done), w=Number(a&&a.w);
    if(!isFinite(done)||!isFinite(w)) return s;
    return s+(done/100)*w;
  },0);
  return isFinite(v)?R(v):0;
}
function calcSolarProg(){
  // Only ITCs explicitly marked active contribute to the Solar overall %.
  // This prevents stale Firebase values on inactive ITCs (ITC-2..6) from
  // contaminating the headline number while their tracker is "Coming Soon".
  const itcs=Object.entries(DB.solar.itcs||{}).filter(([,d])=>d && d.active===true);
  if(!itcs.length) return 0;
  const totalMW=itcs.reduce((s,[,d])=>s+(Number(d&&d.mw)||0),0);
  if(!totalMW) return 0;
  const sum=itcs.reduce((s,[id,d])=>{
    const p=Number(calcITCProg(id)); const mw=Number(d&&d.mw)||0;
    if(!isFinite(p)) return s;
    return s+p/100*mw;
  },0);
  const r=sum/totalMW*100;
  return isFinite(r)?R(r):0;
}
function rowDuration(opened){
  if(!opened)return '—';
  const d=Math.floor((Date.now()-new Date(opened).getTime())/86400000);
  return d+'d';
}
function calcTurbProg(t){
  if(!t) return 0;
  const civW=DB.wtg.civil.reduce((s,a)=>s+a.w,0); // 30
  const mechW=DB.wtg.mech.reduce((s,a)=>s+a.w,0);  // 50
  const civ=Array.isArray(t.civil)?t.civil:[];
  const mech=Array.isArray(t.mech)?t.mech:[];
  const civDone=DB.wtg.civil.reduce((s,a,i)=>s+(Number(civ[i])||0)/100*a.w,0);
  const mechDone=DB.wtg.mech.reduce((s,a,i)=>s+(Number(mech[i])||0)/100*a.w,0);
  const ussDone=(Number(t.uss)||0)/100*10;
  const supDone=(Number(t.sup)||0)/100*10;
  const v=civDone+mechDone+ussDone+supDone;
  return isFinite(v)?R(v):0;
}
function calcWtgProg(){
  const n = (DB.wtg && DB.wtg.turbines) ? DB.wtg.turbines.length : 0;
  if(!n) return 0;
  const v=DB.wtg.turbines.reduce((s,t)=>s+calcTurbProg(t),0)/n;
  return isFinite(v)?R(v):0;
}
function calcWtgLandLocProg(l){return R(l.stages.filter(Boolean).length/10*100);}
function calcWtgLandProg(){
  const locs = (DB.wtgLand && DB.wtgLand.locs) || [];
  if(!locs.length) return 0;
  return R(locs.reduce((s,l)=>s+calcWtgLandLocProg(l),0)/locs.length);
}
function calcSolLandBlockProg(id){
  const b=DB.solLand.blocks[id];
  return R(DB.solLand.actDef.reduce((s,a,i)=>s+(b.acts[i]||0)/100*a.w,0));
}
function calcSolLandProg(){
  const blks=Object.entries(DB.solLand.blocks);
  const totalMW=blks.reduce((s,[,b])=>s+b.mw,0);
  return R(blks.reduce((s,[id,b])=>s+calcSolLandBlockProg(id)/100*b.mw,0)/totalMW*100);
}
function calcLandProg(){return R(calcWtgLandProg()*.5+calcSolLandProg()*.5);}
function calcBop33Pct(){
  const lines=DB.bop33.lines;
  const totPoles=lines.reduce((s,l)=>s+l.poles.scope,0);
  const donePoles=lines.reduce((s,l)=>s+l.poles.done,0);
  return R(donePoles/totPoles*100);
}
function calcBop66Pct(){
  const tot=DB.bop66.totalTowers;
  const done=DB.bop66.vendors.reduce((s,v)=>s+v.towers.done,0);
  return R(done/tot*100);
}
function calcBopLinePct(section,lineId){
  const defs=DB.bopActDefs[section];
  const acts=DB.bopActs[section] && DB.bopActs[section][lineId];
  if(!defs||!acts)return 0;
  // For 33kV, the Pole-Erection and Stringing positions in bopActs are
  // placeholders (0). Their REAL percentages are derived live from the
  // pole/span counts in DB.bop33lines, so substitute them here — keeping
  // the section %, KPI cards and overall roll-up in sync with site data
  // (no hardcoded erection/stringing values anywhere).
  let erectIdx=-1, stringIdx=-1, line=null;
  if(section==='33kv'){
    erectIdx  = defs.findIndex(d=>/erection/i.test(d.n));
    stringIdx = defs.findIndex(d=>/stringing/i.test(d.n));
    line = DB.bop33lines && DB.bop33lines[lineId];
  }
  let pct = defs.reduce((s,d,i)=>{
    let v = Number(acts[i]); const w = Number(d&&d.w);
    if(section==='33kv' && line){
      if(i===erectIdx)  v = line.poleTotal>0 ? Math.round(line.poleDone/line.poleTotal*100) : 0;
      if(i===stringIdx) v = line.spanTotal>0 ? Math.round(line.spanDone/line.spanTotal*100) : 0;
    }
    if(!isFinite(v)||!isFinite(w)) return s;
    return s + v/100*w;
  },0);
  return isFinite(pct) ? R(pct) : 0;
}
function calcBopSectionPct(section){
  const acts = DB.bopActs && DB.bopActs[section];
  if(!acts) return 0;
  // Only count feeder keys whose value is an array/object of activity numbers
  const lines=Object.keys(acts).filter(k=>{
    const v=acts[k];
    return v && typeof v==='object';
  });
  if(!lines.length)return 0;
  const sum = lines.reduce((s,id)=>{
    const p = calcBopLinePct(section,id);
    return s + (isFinite(p)?p:0);
  },0);
  const r = sum/lines.length;
  return isFinite(r) ? R(r) : 0;
}
function calcBop33PctV2(){return calcBopSectionPct('33kv');}
function calcBop66PctV2(){return calcBopSectionPct('66kv');}
function calcPssPct(){
  const acts=Object.values(DB.pss&&DB.pss.acts||{});
  if(!acts.length) return 0;
  const sum=acts.reduce((s,a)=>{
    const done=Number(a&&a.done), scope=Number(a&&a.scope);
    if(!isFinite(done)||!isFinite(scope)||scope<=0) return s;
    return s+Math.min(100,done/scope*100);
  },0);
  const r=sum/acts.length;
  return isFinite(r)?R(r):0;
}
function calcGssPct(){
  const acts=Object.values(DB.gss&&DB.gss.acts||{});
  if(!acts.length) return 0;
  const sum=acts.reduce((s,a)=>{
    const done=Number(a&&a.done), scope=Number(a&&a.scope);
    if(!isFinite(done)||!isFinite(scope)||scope<=0) return s;
    return s+Math.min(100,done/scope*100);
  },0);
  const r=sum/acts.length;
  return isFinite(r)?R(r):0;
}
function calcBopProg(){
  const v=calcBop33PctV2()*0.3+calcBop66PctV2()*0.3+calcPssPct()*0.2+calcGssPct()*0.2;
  return isFinite(v)?R(v):0;
}
function calcOverall(){
  const s=calcSolarProg(),w=calcWtgProg(),l=calcLandProg(),b=calcBopProg();
  return R(s*.35+w*.35+l*.15+b*.15);
}
function R(v){return Math.round(v*100)/100;}

// ═══════════════════════════════════════════════════════════
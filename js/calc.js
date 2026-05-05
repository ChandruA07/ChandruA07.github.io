//  CALCULATION ENGINE
// ═══════════════════════════════════════════════════════════
function calcITCProg(id){
  const acts=DB.solar.itcs[id].acts;
  return R(acts.reduce((s,a)=>s+(a.done/100)*a.w,0));
}
function calcSolarProg(){
  const itcs=Object.entries(DB.solar.itcs);
  const totalMW=itcs.reduce((s,[,d])=>s+d.mw,0); // should = 70.4
  return R(itcs.reduce((s,[id,d])=>s+calcITCProg(id)/100*d.mw,0)/totalMW*100);
}
function rowDuration(opened){
  if(!opened)return '—';
  const d=Math.floor((Date.now()-new Date(opened).getTime())/86400000);
  return d+'d';
}
function calcTurbProg(t){
  const civW=DB.wtg.civil.reduce((s,a)=>s+a.w,0); // 30
  const mechW=DB.wtg.mech.reduce((s,a)=>s+a.w,0);  // 50
  const civDone=DB.wtg.civil.reduce((s,a,i)=>s+(t.civil[i]||0)/100*a.w,0);
  const mechDone=DB.wtg.mech.reduce((s,a,i)=>s+(t.mech[i]||0)/100*a.w,0);
  const ussDone=(t.uss||0)/100*10;
  const supDone=(t.sup||0)/100*10;
  return R(civDone+mechDone+ussDone+supDone);
}
function calcWtgProg(){return R(DB.wtg.turbines.reduce((s,t)=>s+calcTurbProg(t),0)/26);}
function calcWtgLandLocProg(l){return R(l.stages.filter(Boolean).length/10*100);}
function calcWtgLandProg(){return R(DB.wtgLand.locs.reduce((s,l)=>s+calcWtgLandLocProg(l),0)/26);}
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
  const acts=DB.bopActs[section][lineId];
  if(!defs||!acts)return 0;
  return R(defs.reduce((s,d,i)=>s+(acts[i]||0)/100*d.w,0));
}
function calcBopSectionPct(section){
  const lines=Object.keys(DB.bopActs[section]||{});
  if(!lines.length)return 0;
  return R(lines.reduce((s,id)=>s+calcBopLinePct(section,id),0)/lines.length);
}
function calcBop33PctV2(){return calcBopSectionPct('33kv');}
function calcBop66PctV2(){return calcBopSectionPct('66kv');}
function calcPssPct(){const acts=Object.values(DB.pss.acts);return R(acts.reduce((s,a)=>s+Math.min(100,a.done/a.scope*100),0)/acts.length);}
function calcGssPct(){const acts=Object.values(DB.gss.acts);return R(acts.reduce((s,a)=>s+Math.min(100,a.done/a.scope*100),0)/acts.length);}
function calcBopProg(){return R((calcBop33PctV2()*0.3+calcBop66PctV2()*0.3+calcPssPct()*0.2+calcGssPct()*0.2));}
function calcOverall(){
  const s=calcSolarProg(),w=calcWtgProg(),l=calcLandProg(),b=calcBopProg();
  return R(s*.35+w*.35+l*.15+b*.15);
}
function R(v){return Math.round(v*100)/100;}

// ═══════════════════════════════════════════════════════════
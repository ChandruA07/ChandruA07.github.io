//  MASTER DATA MODEL
//  Last updated: 30-Apr-2026 (from Excel DPR + Solar PDF 29-Apr-2026)
// ═══════════════════════════════════════════════════════════
const ITC_MAPS = {
  'ITC-1': null, 'ITC-2': null, 'ITC-3': null,
  'ITC-4': null, 'ITC-5': null, 'ITC-6': null,
};

function _img(src, size, glowColor){
  const s=typeof size==='number'?`${size}px`:size;
  const filter=glowColor?`drop-shadow(0 0 4px ${glowColor})`:'none';
  const uid='img_'+Math.random().toString(36).slice(2,7);
  const fallbacks={
    'turbine.png':'<span style="font-size:'+s+';line-height:1"></span>',
    'solar.png':'<span style="font-size:'+s+';line-height:1"></span>',
    'bop.png':'<span style="font-size:'+s+';line-height:1">⚙</span>',
    'land.png':'<span style="font-size:'+s+';line-height:1">🌱</span>',
    'continuumlogo.png':'<span style="font-size:'+s+';line-height:1">🌿</span>',
  };
  return `<img id="${uid}" src="${src}" style="width:${s};height:${s};object-fit:contain;vertical-align:middle;filter:${filter};" onerror="(function(el){el.outerHTML='${(fallbacks[src]||'<span>?</span>').replace(/'/g,'&apos;')}`;
}
function _turbImg(size,col){return _img('turbine.png',size||20,col||'');}
function _solImg(size){return _img('solar.png',size||20,'');}
function _bopImg(size){return _img('bop.png',size||20,'');}
function _landImg(size){return _img('land.png',size||20,'');}
function _logoImg(h){return `<img src="continuumlogo.png" style="height:${h||36}px;object-fit:contain;vertical-align:middle;" onerror="this.style.display='none'">`;}
function _pageLogoTR(){return `<div class="page-logo-tr">${_logoImg(34)}</div>`;}

const USERS={
  solar_user:{pwd:'Solar@123',role:'solar',name:'Solar Engr'},
  wtg_user:  {pwd:'WTG@123', role:'wtg',  name:'WTG Engr'},
  bop_user:  {pwd:'BOP@123', role:'bop',  name:'BOP Engr'},
  site_mgr:  {pwd:'Site@123',role:'all',  name:'Site Manager'},
};

// ── SOLAR ACTIVITY DEFINITIONS (16 activities per spec) ──────────────────────
const SOL_ACT_DEFS=[
  // name, weight%, color, sub-activity names, sub-activity scope (actual units from PDF)
  {n:'Piling',              w:12, col:'#ab47bc',
    subActs:['Peg Marking','Pile Drilling','Pile Casting','Pile Coping'],
    subUnits:['Nos','Nos','Nos','Nos'], subScope:6185},
  {n:'Road',                w:4,  col:'#6a1b9a',
    subActs:['Periphery & Internal Road'],
    subUnits:['km'], subScope:1},
  {n:'Boundary Wall',       w:3,  col:'#4a148c',
    subActs:['Precast Boundary Wall'],
    subUnits:['Mtr'], subScope:3620},
  {n:'DC 4 Sq.mm',          w:6,  col:'#00c8ff',
    subActs:['DC Power Cable Trench Excv','DC Power Cable Laying','DC String Cable Laying'],
    subUnits:['Mtr','Mtr','Mtr'], subScope:5679},
  {n:'DC 400 Sq.mm',        w:8,  col:'#0099cc',
    subActs:['AC Cable 400 Sq MM'],
    subUnits:['Mtr'], subScope:9984},
  {n:'Main Gate',           w:2,  col:'#00acc1',
    subActs:['Main Gate Installation'],
    subUnits:['Nos'], subScope:1},
  {n:'SCB',                 w:4,  col:'#00bcd4',
    subActs:['SCB Channel Drilling','SCB Channel Casting','SCB Installation'],
    subUnits:['Nos','Nos','Nos'], subScope:72},
  {n:'MMS & Module',        w:14, col:'#ffaa00',
    subActs:['Full Table Installation','Half Table Installation','Module Installation'],
    subUnits:['Nos','Nos','Nos'], subScope:580},
  {n:'IDT',                 w:5,  col:'#ff8800',
    subActs:['IDT Foundation','IDT BOT & NIFPS BOT','IDT Erection'],
    subUnits:['Nos','Nos','Nos'], subScope:1},
  {n:'F INV',               w:6,  col:'#00897b',
    subActs:['Inverter Foundation & Platform','Inverter Erection','ACDB'],
    subUnits:['Sets','Nos','Nos'], subScope:1},
  {n:'F Equip Installation',w:5,  col:'#00c853',
    subActs:['ICOG Foundation','AUX Transformer Foundation','Equipment Erection'],
    subUnits:['Nos','Nos','Nos'], subScope:1},
  {n:'LA & Earthing',       w:4,  col:'#69f0ae',
    subActs:['LA Foundation','LA Installation','LA Earthing Pit'],
    subUnits:['Nos','Nos','Nos'], subScope:13},
  {n:'DP Yard',             w:4,  col:'#651fff',
    subActs:['DP Yard Installation','33kV Line','Earthing Pit'],
    subUnits:['Nos','km','Nos'], subScope:1},
  {n:'MCR Building',        w:6,  col:'#7c4dff',
    subActs:['Milestone 1 – upto FGL','Milestone 2 – upto Roof','Milestone 3 – Equip Erecting','Milestone 4 – Handover'],
    subUnits:['Lot','Lot','Lot','Lot'], subScope:1},
  {n:'Pre-Commissioning',   w:10, col:'#b39ddb',
    subActs:['String VOC Testing','DC IR Test','HT Cable Testing','Inverter Testing','CEIG Approval'],
    subUnits:['Nos','Nos','Nos','Nos','ITC'], subScope:1236},
  {n:'HOTO',                w:7,  col:'#9575cd',
    subActs:['Testing & Commissioning','Documentation','Snag List','Sign-off'],
    subUnits:['ITC','Lot','Lot','Lot'], subScope:1},
];

// ── mkSolActs: seed with ACTUAL QUANTITIES (not percentages) ─────────────────
// subDone = actual done quantities matching subScope
function mkSolActs(seed){
  const s=seed||{};
  return SOL_ACT_DEFS.map(d=>{
    const entry=s[d.n]||{done:0,subDone:null};
    const donePct=typeof entry==='number'?entry:(entry.done||0);
    const subDone=entry.subDone||d.subActs.map(()=>0);
    return {...d, done:donePct, today:0, subDone, subScope:d.subScope||0};
  });
}

// ── HELPER: today's date string ───────────────────────────────────────────────
function _today(){return new Date().toISOString().slice(0,10);}
function _todayLabel(){
  const d=new Date();
  return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
}

// ════════════════════════════════════════════════════════════
//  MASTER DATABASE — updated from DPRs dated 29/30-Apr-2026
// ════════════════════════════════════════════════════════════
const DB = {

  // ── SOLAR ──────────────────────────────────────────────────────────────────
  // Source: Solar PDF 29-Apr-2026 (ITC-1 = 13.2MW, Block-2, 76.02 Acres)
  // ITC-2 to ITC-6: 0% as no progress reported in any DPR
  solar:{
    totalMW:70.4,
    itcs:{
      'ITC-1':{mw:13.2, pct:9.4, lat:14.832892, lng:76.468903,
        // Sub-activity done in ACTUAL NUMBERS per PDF:
        // Piling:   Peg Marking=6185/6185(100%), Drilling=6185/6185(100%),
        //           Casting=5980/6185(97%), Coping=4600/6185(74%)
        // BoundaryWall: 1220/3620m=34%
        // DC4sqmm:  Trench=2903/5679m(51%), Laying=1000/56542m(2%), String=0/46080m(0%)
        // SCB:      Drilling=8/72(11%), Casting=0/72(0%), Inst=0/13(0%)
        // MMS:      FullTable=350/580(60%), HalfTable=0/77(0%), Module=0/34608(0%)
        // IDT:      Foundation=1/1(100%), BOT=0/1(0%), Erection=0/1(0%)
        // LA:       Foundation=0/13(0%), Install=0/13(0%), Pit=0(0%)
        // MCR:      Milestone1=0%, 2=0%, 3=0%, 4=0%
        // PreComm:  String VOC=0/1236(0%), all testing=0%
        // HOTO:     0%
        acts:mkSolActs({
          'Piling':            {done:Math.round((100+100+97+74)/4), subDone:[6185,6185,5980,4600]},
          'Road':              {done:0,   subDone:[0]},
          'Boundary Wall':     {done:34,  subDone:[1220]},
          'DC 4 Sq.mm':        {done:Math.round((51+2+0)/3), subDone:[2903,1000,0]},
          'DC 400 Sq.mm':      {done:0,   subDone:[0]},
          'Main Gate':         {done:0,   subDone:[0]},
          'SCB':               {done:Math.round((11+0+0)/3), subDone:[8,0,0]},
          'MMS & Module':      {done:Math.round((60+0+0)/3), subDone:[350,0,0]},
          'IDT':               {done:Math.round((100+0+0)/3), subDone:[1,0,0]},
          'F INV':             {done:0,   subDone:[0,0,0]},
          'F Equip Installation':{done:0, subDone:[0,0,0]},
          'LA & Earthing':     {done:0,   subDone:[0,0,0]},
          'DP Yard':           {done:0,   subDone:[0,0,0]},
          'MCR Building':      {done:0,   subDone:[0,0,0,0]},
          'Pre-Commissioning': {done:0,   subDone:[0,0,0,0,0]},
          'HOTO':              {done:0,   subDone:[0,0,0,0]},
        })},
      // ITC-2 to ITC-6: NO progress per DPR — all zeros
      'ITC-2':{mw:13.2, pct:9.4, lat:null, lng:null, acts:mkSolActs({})},
      'ITC-3':{mw:13.2, pct:9.4, lat:null, lng:null, acts:mkSolActs({})},
      'ITC-4':{mw:13.2, pct:9.4, lat:null, lng:null, acts:mkSolActs({})},
      'ITC-5':{mw:8.8,  pct:6.3, lat:null, lng:null, acts:mkSolActs({})},
      'ITC-6':{mw:8.8,  pct:6.3, lat:null, lng:null, acts:mkSolActs({})},
    }
  },

  // ── ROW ISSUES (from Excel DPR SWPPL sheet rows 60-74) ───────────────────
  rowIssues:[
    {loc:'MKD-253', type:'WTG', issue:'Rotor Assembly hold – Local villagers ROW',              opened:'2026-04-20', status:'Open',   expClear:'2026-05-01'},
    {loc:'MKD-258', type:'WTG', issue:'Logistic Pathway dev W400/550m – farmer ROW payment',    opened:'2026-03-17', status:'Open',   expClear:'2026-05-01'},
    {loc:'KDK-462', type:'WTG', issue:'Casting hold – Pathway ROW by farmer (compaction WIP)',  opened:'2026-03-11', status:'Open',   expClear:'2026-05-01'},
    {loc:'AMK-264', type:'WTG', issue:'Shuttering WIP 40% – Logistics Pathway Survey pending',  opened:'2026-03-01', status:'Open',   expClear:'2026-05-01'},
    {loc:'MKD-211', type:'WTG', issue:'GSB 1st layer done – Pathway ROW payment pending',       opened:'2026-04-07', status:'Open',   expClear:'2026-05-01'},
    {loc:'MKD-52',  type:'WTG', issue:'Lease area cleaning hold – ROW farmer payment issue',    opened:'2026-04-05', status:'Open',   expClear:'2026-05-06'},
    {loc:'BDK-25',  type:'WTG', issue:'Excavation WIP 75% – Pathway dev pending',              opened:'2026-03-31', status:'Open',   expClear:'2026-05-01'},
    {loc:'CDP-193', type:'WTG', issue:'Legal case 254/2025 OS-SRC Kudligi Brothers',            opened:'2026-03-01', status:'Open',   expClear:'2026-05-31'},
    {loc:'BDK-165', type:'WTG', issue:'Legal case 14/2026 OS-SRC Kudligi Brothers',             opened:'2026-03-01', status:'Open',   expClear:'2026-05-31'},
    {loc:'BLK-400', type:'WTG', issue:'Location Cancelled – PTCL Legal Issue',                  opened:'2026-01-06', status:'Closed', expClear:'Cancelled'},
    {loc:'CDP-221', type:'WTG', issue:'Logistic pathway WIP – Pond area development (1 pond)',  opened:'2026-02-02', status:'Open',   expClear:'2026-05-01'},
    {loc:'MOB-142', type:'WTG', issue:'Logistics Pathway Survey Pending',                        opened:'2026-02-04', status:'Open',   expClear:'2026-05-01'},
  ],

  // ── SCHEDULE (actual values updated through Apr-2026) ──────────────────────
  // Today = 30-Apr-2026 → index 3 (Apr) is latest actual = 11%
  schedule:{
    planned:[0,2,5,9,14,20,27,35,43,52,61,70,78,85,91,96,100],
    actual: [0,1,3,7,11,null,null,null,null,null,null,null,null,null,null,null,null],
    labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan27','Feb27','Mar27','Apr27','May27'],
  },

  // ── WTG (source: Excel WTG DPR sheet + SWPPL DPR rows 53-74) ─────────────
  // Supply status from SWPPL DPR:
  //   Steel RFM: 10/26, Anchor Cage Set: 16/26, WTG ready dispatch: 8/26
  //   Tower Set: 7/26, Blade Set: 7/26, Nacelle: 8/26, Hub: 8/26
  //   Lift: 17/26, Tower Rack: 8/26, Converter panel: 8/26
  //   USS Transfo 3.2MVA: 17/26, WTG Delivered: 7/26
  wtg:{
    totalMW:70.2, count:26,
    civil:  [{n:'Excavation',w:6,col:'#7c4dff'},{n:'PCC',w:5,col:'#651fff'},{n:'Anchor Cage',w:5,col:'#b39ddb'},{n:'Reinforcement',w:7,col:'#9575cd'},{n:'Casting',w:7,col:'#673ab7'}],
    mech:   [{n:'Tower Erection',w:15,col:'#00c8ff'},{n:'Nacelle Install',w:15,col:'#0099cc'},{n:'Hub Install',w:12,col:'#00acc1'},{n:'Blade Assembly',w:8,col:'#00bcd4'}],
    uss:    [{n:'USS Works',w:10,col:'#00c853'}],
    supply: [{n:'Supply Complete',w:10,col:'#69f0ae'}],
    // supply counts from SWPPL DPR (received/26):
    supplyStatus:{
      steelRFM:10, anchorCage:16, wtgReadyDispatch:8,
      towerSet:7, bladeSet:7, nacelle:8, hub:8,
      lift:17, towerRack:8, converterPanel:8,
      ussTransfo:17, wtgDelivered:7, '33kvTransformer':5,
    },
    // ── 26 Turbines — from WTG DPR rows 5-19 + SWPPL DPR rows 53-74 ──────
    // civil[]: [Excavation%, PCC%, AnchorCage%, Reinforcement%, Casting%]
    // mech[]:  [TowerErection%, NacelleInstall%, HubInstall%, BladeAssembly%]
    // uss: USS%  sup: Supply%
    // EXACT DATES from WTG DPR:
    turbines:[
      // ── Row 5: MBI-12 | HML | Feeder-02
      // Foundation complete. Erection T1-T5 done: T1=19Apr, T2=20Apr, T3=22Apr, T4=26Apr, T5=29Apr
      // Nacelle: 29Apr. Rotor Assembly: 30Apr. Status: T1 Preparation WIP (Rotor Assembly On hold for ROW)
      {id:'MBI-12',  status:'wip',    lp:true,  pp:true,
       civil:[100,100,100,100,100], mech:[100,100,100,0], uss:0, sup:100,
       mechDates:{towerStart:'2026-04-07',towerEnd:'2026-04-19',
                  nacelleStart:'2026-04-20',nacelleEnd:'2026-04-29',
                  bladeStart:'',bladeEnd:''},
       notes:'T1 Preparation WIP. Rotor Assembly – hold due to ROW (local villagers). Nacelle done 29-Apr'},

      // ── Row 6: MKD-258 | HML | Feeder-02
      // Foundation complete. Pathway ROW hold. Erection: NOT started
      {id:'MKD-258', status:'row',    lp:true,  pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Logistic Pathway dev W400/550m – farmer ROW/payment issue. Exp clear 01-May-26'},

      // ── Row 7: KDK-462 | KRR | Feeder-02
      // Excv-done, PCC-done, Reinf-done, Shuttering-done, Casting-hold
      // Backfilling hold – pathway ROW farmer; compaction 1300/1400Mtrs done
      {id:'KDK-462', status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,0],  mech:[0,0,0,0], uss:0, sup:0,
       notes:'Casting plan hold – Pathway ROW farmer. Compaction 1300/1400Mtrs. Exp clear 01-May-26'},

      // ── Row 8: MOB-403 | Ashwin | Feeder-01
      // Foundation complete. Crane platform done. Curing done. Erection NOT started
      {id:'MOB-403', status:'casting',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Backfilling & Cranepad Completed. Erection pending crane mobilisation'},

      // ── Row 9: BDK-85 | KRR | Feeder-01
      // Foundation complete. Backfilling 1st layer WIP. Cranepad done
      {id:'BDK-85',  status:'casting',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Backfilling 1st layer WIP. Cranepad done. Erection pending'},

      // ── Row 10: MKD-253 | HML | Feeder-02
      // Foundation complete. Pathway complete. Erection T1-T5 done.
      // Nacelle done. Rotor Assembly: ON HOLD due to ROW
      {id:'MKD-253', status:'wip',    lp:true,  pp:true,
       civil:[100,100,100,100,100], mech:[100,100,100,0], uss:0, sup:100,
       mechDates:{towerStart:'2026-03-01',towerEnd:'2026-03-12',
                  nacelleStart:'',nacelleEnd:'',
                  bladeStart:'',bladeEnd:''},
       notes:'Nacelle erection COMPLETED. Rotor Assembly ON HOLD – local villagers ROW issue'},

      // ── Row 11: AMK-264 | Ashwin | Feeder-01
      // Excv-done, PCC-done, Reinf-done(60%), Shuttering WIP 40%, Casting not done
      {id:'AMK-264', status:'wip',    lp:false, pp:false,
       civil:[100,100,100,40,0],  mech:[0,0,0,0], uss:0, sup:0,
       notes:'Shuttering WIP 40%. Logistics Pathway Survey Pending. Exp casting 01-May-26'},

      // ── Row 12: CDP-221 | KRR | Feeder-01
      // Foundation complete. Backfilling 1st layer 20% done. Erection NOT started
      {id:'CDP-221', status:'casting',lp:true,  pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Back filling 1st layer filling 20% completed. Pond area dev WIP'},

      // ── Row 13: MOB-142 | KRR | Feeder-01
      // Foundation complete. Curing completed 18-Apr. Erection NOT started
      {id:'MOB-142', status:'casting',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Curing completed 18-Apr-2026. Logistics Pathway Survey Pending'},

      // ── Row 14: MKD-211 | HML | Feeder-02
      // Re-engg: Excv start 11-Dec, PCC done, Anchor 7-Apr
      // Reinf done, Shuttering 17-Apr, Casting 20-Apr, Curing 22-Apr → 01-May-26 target
      {id:'MKD-211', status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'GSB 1st layer 300mm filling & leveling done. Pathway ROW payment issue. Casting done 20-Apr, curing till 01-May'},

      // ── Row 15: BDK-165 | KRR | Feeder-01
      // Foundation complete. Cranepad done 22-Mar. Erection NOT started. Legal case
      {id:'BDK-165', status:'pending',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Foundation complete. Legal case 14/2026 OS-SRC Kudligi Brothers. Exp clear 31-May-26'},

      // ── Row 16: BLK-400 | HML | Feeder-02
      // Location CANCELLED – PTCL Land legal issue
      {id:'BLK-400', status:'row',    lp:false, pp:false,
       civil:[0,0,0,0,0], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Location CANCELLED – PTCL Land (Legal Issue)'},

      // ── Row 17: CDP-193 | KRR | Feeder-01
      // Foundation complete (casting 19-23-Mar). Cranepad WIP. Legal case RFC pending
      {id:'CDP-193', status:'pending',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Foundation complete 23-Mar. Legal case 254/2025 OS-SRC (RFC Pending Court case). Exp clear 31-May-26'},

      // ── Row 18: MKD-52 | Ashwin | Feeder-02
      // Excv 5-Apr, PCC 7-Apr, Anchor 9-Apr, Reinf 10-Apr, Shuttering 18-Apr,
      // Casting 22-Apr, Curing 24-Apr → 03-May-26 cranepad target
      {id:'MKD-52',  status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Casting done 22-Apr, curing till 03-May. Pathway Development Pending. Lease area cleaning hold – ROW farmer'},

      // ── Row 19: BDK-25 | HML | Feeder-01
      // Excv 31-Mar, PCC 2-Apr, Anchor 4-Apr, Reinf 5-Apr, Shuttering 13-Apr,
      // Casting 17-Apr, Curing 19-Apr → cranepad target 30-Apr
      {id:'BDK-25',  status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Curing done 19-Apr. Cranepad plan 30-Apr. Pathway dev pending. Excavation WIP 75%'},

      // LOC-13 to LOC-26: Not started (remaining 12 locations)
      ...[13,14,15,16,17,18,19,20,21,22,23,24,25,26].map(n=>({
        id:`LOC-${String(n).padStart(2,'0')}`,
        status:'pending', lp:false, pp:false,
        civil:[0,0,0,0,0], mech:[0,0,0,0], uss:0, sup:0,
        notes:'Not started'
      }))
    ]
  },

  // ── WTG LAND ────────────────────────────────────────────────────────────────
  wtgLand:{
    stages:['Land Agreement','Land Registration','Land Demarcation','Soil Test','DGPS Survey','Permanent Pathway Agreement','Permanent Pathway Dev','Logistic Path Agreement','Logistic Pathway Dev','RFC Approval'],
    // From SWPPL DPR: Land Leased 15/26 = 58%
    locs:[
      ...['MBI-12','MKD-258','MKD-253','MOB-403','KDK-462'].map((id,i)=>({id,svy:`SY.${101+i}/1`,pa:1.2,la:4.2,ls:'Executed',comp:'Paid',stages:[true,true,true,true,true,true,true,true,true,true],notes:''})),
      ...['BDK-85','AMK-264','CDP-221','MOB-142','MKD-211','BDK-165','CDP-193','MKD-52','BDK-25','BLK-400'].map((id,i)=>({id,svy:`SY.${110+i}/2`,pa:1.1,la:4.0,ls:'In Progress',comp:'Partial',stages:[true,true,true,true,false,false,true,true,false,false],notes:''})),
      ...[13,14,15,16,17,18,19,20,21,22,23,24,25,26].map((n,i)=>({id:`LOC-${String(n).padStart(2,'0')}`,svy:`SY.${120+i}/3`,pa:1.0,la:3.8,ls:'Pending',comp:'Not Started',stages:new Array(10).fill(false),notes:''}))
    ]
  },

  // ── SOLAR LAND ──────────────────────────────────────────────────────────────
  solLand:{
    actDef:[
      {n:'Document Agreement',w:10},{n:'Registration',w:40},{n:'Demarcation',w:5},
      {n:'Leveling',w:5},{n:'Soil Test',w:5},{n:'DGPS Survey',w:5},
      {n:'Permanent Pathway Agreement',w:5},{n:'Permanent Pathway Dev',w:10},
      {n:'Logistic Pathway Agreement',w:5},{n:'Logistic Pathway Dev',w:10},
    ],
    blocks:{
      'ITC-1':{mw:13.2,area:76.02,acts:[100,100,100,100,100,100,30,0,20,0],
        leases:[{own:'Rameshu',svy:'SY.45/1',dur:'30yr',ls:'Executed',doc:'Complete',reg:'Done',rem:'All clear'}]},
      'ITC-2':{mw:13.2,area:52.5,acts:[100,80,60,0,0,0,50,0,0,0],leases:[]},
      'ITC-3':{mw:13.2,area:52.5,acts:[100,20,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-4':{mw:13.2,area:52.5,acts:[50,0,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-5':{mw:8.8, area:35.0,acts:[30,0,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-6':{mw:8.8, area:35.0,acts:[0,0,0,0,0,0,0,0,0,0],leases:[]},
    }
  },

  // ── 33kV LINE (source: Excel "33kV Line Dtls" sheet row 2-18) ─────────────
  // Exact numbers: total poles=1042, completed=506, spans=76/1059
  bop33feeders:[
    {feeder:'1&2',section:'SPDC TAP 1A & 2A', km:13.5,type:'EP',  scope:364,done:352,wip:0,bal:12, pct:96.70, spans:{scope:365,done:76}},
    {feeder:'1',  section:'END Tapping',       km:2.8, type:'EP',  scope:56, done:6,  wip:0,bal:50, pct:10.71, spans:{scope:57,done:0}},
    {feeder:'1',  section:'MBI 12',            km:0.2, type:'Dog', scope:4,  done:0,  wip:0,bal:4,  pct:0,     spans:{scope:5,done:0}},
    {feeder:'1',  section:'KDK 462',           km:0.2, type:'Dog', scope:4,  done:0,  wip:0,bal:4,  pct:0,     spans:{scope:5,done:0}},
    {feeder:'1',  section:'MKD 258',           km:1.8, type:'Dog', scope:36, done:26, wip:0,bal:10, pct:72.22, spans:{scope:37,done:0}},
    {feeder:'1',  section:'MKD 52',            km:2.2, type:'Dog', scope:44, done:36, wip:0,bal:8,  pct:81.82, spans:{scope:45,done:0}},
    {feeder:'1',  section:'MKD 211',           km:1.2, type:'Dog', scope:24, done:14, wip:0,bal:10, pct:58.33, spans:{scope:25,done:0}},
    {feeder:'1',  section:'MKD 253',           km:1.3, type:'Dog', scope:26, done:19, wip:0,bal:7,  pct:73.08, spans:{scope:27,done:0}},
    {feeder:'2',  section:'Solar Land WIP',    km:0,   type:'EP',  scope:0,  done:0,  wip:0,bal:0,  pct:0,     spans:{scope:1,done:0}},
    {feeder:'3',  section:'TAP 3A',            km:1.5, type:'EP',  scope:30, done:0,  wip:0,bal:30, pct:0,     spans:{scope:31,done:0}},
    {feeder:'3',  section:'Block 2',           km:0.6, type:'Dog', scope:12, done:0,  wip:0,bal:12, pct:0,     spans:{scope:13,done:0}},
    {feeder:'4',  section:'MOB 142',           km:10,  type:'EP',  scope:200,done:0,  wip:0,bal:200,pct:0,     spans:{scope:201,done:0}},
    {feeder:'4',  section:'CDP-221',           km:2.6, type:'Dog', scope:52, done:0,  wip:0,bal:52, pct:0,     spans:{scope:53,done:0}},
    {feeder:'4',  section:'AMK 264',           km:0.6, type:'Dog', scope:12, done:0,  wip:0,bal:12, pct:0,     spans:{scope:13,done:0}},
    {feeder:'4',  section:'MOB 403',           km:1.2, type:'Dog', scope:24, done:0,  wip:0,bal:24, pct:0,     spans:{scope:25,done:0}},
    {feeder:'4',  section:'BDK 85',            km:6.5, type:'Dog', scope:130,done:53, wip:0,bal:77, pct:40.77, spans:{scope:131,done:0}},
    {feeder:'4',  section:'BDK 25',            km:1.2, type:'Dog', scope:24, done:0,  wip:0,bal:24, pct:0,     spans:{scope:25,done:0}},
  ],

  bop33:{
    lines:[
      {id:'Solar Feeder-1', km:8,  type:'solar', vendor:'TBD', poles:{scope:80,  done:30}, stringing:{scope:8,  done:0, unit:'km'}, row:1, mp:10, notes:'ITC-1 to ITC-3'},
      {id:'Solar Feeder-2', km:7,  type:'solar', vendor:'TBD', poles:{scope:70,  done:15}, stringing:{scope:7,  done:0, unit:'km'}, row:0, mp:8,  notes:'ITC-4 to ITC-6'},
      {id:'WTG Feeder-1',   km:13, type:'wtg',   vendor:'TBD', poles:{scope:130, done:95}, stringing:{scope:13, done:3.8,unit:'km'},row:3, mp:12, notes:'SPDC 352/364 + WTG sections. Stringing 3.8km'},
      {id:'WTG Feeder-2',   km:15, type:'wtg',   vendor:'TBD', poles:{scope:130, done:53}, stringing:{scope:15, done:0, unit:'km'}, row:4, mp:8,  notes:'Feeder-4 BDK-85 53/130. Others pending'},
    ]
  },

  // ── 66kV EHV (source: Excel "66kV EHV Line Exe Plan." rows 4-71) ──────────
  // Row 4 summary: Total Towers=66, ROW=66(all cleared), Excv=65, PCC=65,
  //   Foundation=65, Erection=56, Stringing(km)=3, Stringing(poles)=1
  // NOTE: ALL 66 towers have ROW CLEARED per Excel col "ROW"=Cleared for all rows
  bop66:{
    totalTowers:66,
    feeders:[
      {id:'SPDC Feeder',
       km:12.72,
       towerType:'SPDC-Panther',
       towers:{
         scope:66, row_cleared:66,    // ALL ROW CLEARED
         excv:65, pcc:65, fdn:65,     // Foundation: 65/66 = 98.5%
         erection:56,                 // Tower Erection: 56/66 = 84.8% (not 8!)
         stringing_km:0.455,          // Stringing in km: 0.455
         stringing_spans:1,           // Stringing spans: 1 completed
         done:56,                     // Use erection count as primary "done"
       },
       stringing:{scope:12.72, done:0.455, unit:'km'},
       notes:'PSS to GSS | 66 towers | ALL ROW CLEARED | Foundation 65/66 | Erection 56/66 | Stringing 0.455km'},
    ],
    vendors:[
      {n:'Krishna Electricals', towers:{scope:39,done:28}, stringing:{scope:6,done:0.3,unit:'km'}},
      {n:'Zelvo',               towers:{scope:27,done:28}, stringing:{scope:6.72,done:0.155,unit:'km'}},
    ]
  },

  // ── PSS (source: Excel SWPPL DPR rows 12-40) ─────────────────────────────
  // EXACT numbers from DPR sheet:
  // PSS 66kV: Gantry Fdn 6/6, 33kV Gantry Fdn 20/20, 66kV Equip Fdn 35/35
  //   33kV Equip Fdn 72/73, 66kV Gantry Erect 6/6, 33kV Gantry Erect 20/20
  //   66kV Equip Str 32/32, 33kV Equip Str 55/55, 66kV Equip Erect 9/35
  //   33kV Equip Erect 0/82, Main Cable Trench 60/100
  // Earth Mat: 80/100 (from PSS row 15: "Earth Mat Erection: 80/100")
  // 2x40MVA Transformer: Foundation 2/2, Erection 0/2, Testing 0/2, Commissioning 0/2
  // MCR Building: GF Foundation 100%, Raft&Column 100%, Brick GF 100%, Roof GF 100%
  //   Brick FF 65/100(WIP), Roof FF 0%, Cable Trench 0%, C&R Panel 0%
  pss:{
    mp:0, todayProg:5,
    acts:{
      '66kv Gantry Fdn':          {scope:6,   done:6,   wip:0, bal:0,   col:'#00bcd4',unit:'Nos'},  // 100%
      '33kv Gantry Fdn':          {scope:20,  done:20,  wip:0, bal:0,   col:'#00acc1',unit:'Nos'},  // 100%
      '66kv Equip Fdn':           {scope:35,  done:35,  wip:0, bal:0,   col:'#0097a7',unit:'Nos'},  // 100%
      '33kv Equip Fdn':           {scope:73,  done:72,  wip:0, bal:1,   col:'#006064',unit:'Nos'},  // 98.6%
      '66kv Gantry Erection':     {scope:6,   done:6,   wip:0, bal:0,   col:'#4dd0e1',unit:'Nos'},  // 100%
      '33kv Gantry Erection':     {scope:20,  done:20,  wip:0, bal:0,   col:'#80deea',unit:'Nos'},  // 100%
      '66kv Equip Str Erection':  {scope:32,  done:32,  wip:0, bal:0,   col:'#00e5ff',unit:'Nos'},  // 100%
      '33kv Equip Str Erection':  {scope:55,  done:55,  wip:0, bal:0,   col:'#18ffff',unit:'Nos'},  // 100%
      '66kv Equipment Erection':  {scope:35,  done:9,   wip:0, bal:26,  col:'#ff9800',unit:'Nos'},  // 25.7%
      '33kv Equipment Erection':  {scope:82,  done:0,   wip:0, bal:82,  col:'#ff6d00',unit:'Nos'},  // 0%
      'Earth Mat Erection':       {scope:100, done:80,  wip:0, bal:20,  col:'#00bfa5',unit:'%'},    // 80%
      'Main Cable Trench':        {scope:100, done:60,  wip:0, bal:40,  col:'#7c4dff',unit:'%'},    // 60%
      // 2x40MVA Transformer:
      'PSS Foundation':           {scope:2,   done:2,   wip:0, bal:0,   col:'#b39ddb',unit:'Nos'},  // 100%
      'PSS Erection':             {scope:2,   done:0,   wip:0, bal:2,   col:'#9575cd',unit:'Nos'},  // 0%
      'PSS Testing':              {scope:2,   done:0,   wip:0, bal:2,   col:'#7e57c2',unit:'Nos'},  // 0%
      'PSS Commissioning':        {scope:2,   done:0,   wip:0, bal:2,   col:'#673ab7',unit:'Nos'},  // 0%
      // MCR Building (4 milestones):
      'CRB Foundation Excavation':{scope:100, done:100, wip:0, bal:0,   col:'#66bb6a',unit:'%'},    // 100%
      'CRB Raft & Column':        {scope:100, done:100, wip:0, bal:0,   col:'#4caf50',unit:'%'},    // 100%
      'Brick Work (GF)':          {scope:100, done:100, wip:0, bal:0,   col:'#43a047',unit:'%'},    // 100%
      'Roof Slab (GF)':           {scope:100, done:100, wip:0, bal:0,   col:'#388e3c',unit:'%'},    // 100%
      'Brick Work (FF)':          {scope:100, done:65,  wip:5, bal:35,  col:'#2e7d32',unit:'%'},    // 65% WIP (manpower hold)
      'Roof Slab (FF)':           {scope:100, done:0,   wip:0, bal:100, col:'#1b5e20',unit:'%'},    // 0%
      'Cable Trench (MCR)':       {scope:100, done:0,   wip:0, bal:100, col:'#a5d6a7',unit:'%'},    // 0%
      'C&R Panel T&C':            {scope:100, done:0,   wip:0, bal:100, col:'#c8e6c9',unit:'%'},    // 0%
    }
  },

  // ── GSS (source: Excel SWPPL DPR rows 37-46) ─────────────────────────────
  // EXACT numbers: Bay Fdn 18/19, Structure erect 15/17, Equip KPTCL Insp 3/19,
  //   Equip KPTCL Deliv 3/19, Equip Erect 3/17, Testing 0/17,
  //   Cable Trench 0/100, CRB 0/100, Commissioning 0/1
  // Note: Isolator foundation work hold – structure material unavailability
  gss:{
    mp:0, todayProg:0,
    acts:{
      '66kV Bay Foundations':       {scope:19, done:18, wip:0, bal:1,   col:'#8bc34a',unit:'Nos'},  // 94.7%
      '66kV Structure Erection':    {scope:17, done:15, wip:0, bal:2,   col:'#689f38',unit:'Nos'},  // 88.2%
      '66kV Equip KPTCL Inspection':{scope:19, done:3,  wip:0, bal:16,  col:'#558b2f',unit:'Nos'},  // 15.8%
      '66kV Equip KPTCL Delivery':  {scope:19, done:3,  wip:0, bal:16,  col:'#33691e',unit:'Nos'},  // 15.8%
      '66kV Equipment Erection':    {scope:17, done:3,  wip:0, bal:14,  col:'#aed581',unit:'Nos'},  // 17.6%
      '66kV Equipment Testing':     {scope:17, done:0,  wip:0, bal:17,  col:'#c5e1a5',unit:'Nos'},  // 0%
      'Cable Trench':               {scope:100,done:0,  wip:0, bal:100, col:'#dcedc8',unit:'%'},    // 0%
      'CRB Building':               {scope:100,done:0,  wip:0, bal:100, col:'#9ccc65',unit:'%'},    // 0%
      'Commissioning':              {scope:1,  done:0,  wip:0, bal:1,   col:'#f9a825',unit:'Nos'},  // 0%
    }
  },

  // ── BOP ACTIVITY DEFINITIONS ─────────────────────────────────────────────────
  bopActDefs:{
    '33kv':[
      {n:'Survey & Design',         w:5,  col:'#9c27b0'},
      {n:'ROW Clearance',           w:8,  col:'#7b1fa2'},
      {n:'Pole Foundation',         w:15, col:'#6a1b9a'},
      {n:'Pole Erection',           w:20, col:'#4a148c'},
      {n:'Stringing',               w:25, col:'#ab47bc'},
      {n:'Insulators & Fittings',   w:10, col:'#ce93d8'},
      {n:'Earthing',                w:7,  col:'#e1bee7'},
      {n:'Testing & Commissioning', w:10, col:'#f3e5f5'},
    ],
    '66kv':[
      {n:'ROW Clearance',           w:5,  col:'#ff9800'},  // ALL CLEARED 66/66
      {n:'Excavation',              w:8,  col:'#f57c00'},  // 65/66 = 98%
      {n:'Tower Foundation',        w:15, col:'#e65100'},  // 65/66 = 98%
      {n:'Tower Erection',          w:25, col:'#ff6d00'},  // 56/66 = 84.8%
      {n:'Stringing',               w:25, col:'#ffb300'},  // 0.455km/12.72km = 3.6%
      {n:'OPGW Cable',              w:10, col:'#ffd54f'},  // 0%
      {n:'Insulators & Fittings',   w:7,  col:'#ffe082'},
      {n:'Testing & Commissioning', w:5,  col:'#fff8e1'},
    ],
  },

  // ── BOP ACTS PROGRESS (updated from DPR) ─────────────────────────────────
  // 33kV: [Survey&Design, ROWClear, PoleFdn, PoleErect, Stringing, Insulators, Earthing, T&C]
  // WTG Feeder-1 (SPDC 352/364=97%): survey done, ROW 95%, Fdn ~95%, Erect ~73%, Stringing 29%
  // Feeder-4 (BDK-85 53/130=41%): survey done, ROW 40%, Fdn 40%, Erect 41%, 0% string
  // 66kV: [ROW, Excv, Fdn, Erection, Stringing, OPGW, Insulators, T&C]
  //   ROW=100%, Excv=98%, Fdn=98%, Erect=84.8%, String=3.6%, rest=0%
  bopActs:{
    '33kv':{
      'Solar Feeder-1': [100, 80,  90,  85,  15,  0, 0, 0],
      'Solar Feeder-2': [100, 40,  15,   5,   0,  0, 0, 0],
      'WTG Feeder-1':   [100, 95,  95,  73,  29,  0, 0, 0],
      'WTG Feeder-2':   [100, 42,  41,  41,   0,  0, 0, 0],
    },
    '66kv':{
      // All ROW 100%, Excv 98%, Fdn 98%, Erection 84.8%, Stringing 3.6%
      'SPDC Feeder':         [100, 98,  98,  85,   4,  0, 0, 0],
      'Krishna Electricals': [100, 98,  98,  85,   4,  0, 0, 0],
      'Zelvo':               [100, 98,  98,  85,   4,  0, 0, 0],
    },
  },

  // ── POD & MANPOWER ──────────────────────────────────────────────────────────
  pod:{s:[],w:[],l:[],b:[]},
  mp:{sol:14, wtg:24, bop:18},  // from SWPPL DPR: total site ~56

  // ── MILESTONES (current + upcoming) ─────────────────────────────────────────
  milestones:[
    {date:'2026-04-30',label:'MBI-12 Nacelle Installed (done 29-Apr)',                mod:'WTG'},
    {date:'2026-05-01',label:'MKD-211 / MKD-52 Curing complete → Cranepad target',   mod:'WTG'},
    {date:'2026-05-01',label:'ROW Issues – Multiple WTGs expected to clear',           mod:'WTG'},
    {date:'2026-05-01',label:'PSS MCR Brick Work FF – Resume (manpower issue)',        mod:'BOP'},
    {date:'2026-05-09',label:'Solar Module Installation Start (ITC-1)',                mod:'Solar'},
    {date:'2026-05-15',label:'MKD-253 Rotor Assembly (post ROW clearance)',            mod:'WTG'},
    {date:'2026-05-26',label:'PSS 66kV Equipment Erection – target',                  mod:'BOP'},
    {date:'2026-05-30',label:'66kV Stringing – Target completion (per Excel plan)',    mod:'BOP'},
    {date:'2026-05-31',label:'Legal Cases CDP-193 / BDK-165 – Expected resolution',   mod:'WTG'},
    {date:'2026-06-30',label:'33kV Solar Feeder-1 Energisation',                      mod:'BOP'},
    {date:'2026-09-01',label:'WTG First Power – Target',                              mod:'WTG'},
    {date:'2026-12-31',label:'Solar Full Commissioning',                              mod:'Solar'},
    {date:'2027-03-31',label:'SCOD – Final COD',                                      mod:'Overall'},
  ],

  // ── BLOCKERS ─────────────────────────────────────────────────────────────────
  blockers:[
    {code:'WTG-MBI12',  text:'MBI-12: T1 Prep WIP – Rotor Assembly hold (local villagers ROW)',       level:'w'},
    {code:'WTG-MKD253', text:'MKD-253: Nacelle done – Rotor Assembly ON HOLD (villagers ROW)',        level:'d'},
    {code:'WTG-ROW',    text:'Multiple WTG ROW issues (KDK/AMK/MKD-211/52/BDK-25) – exp 01-May-26', level:'d'},
    {code:'WTG-LEGAL',  text:'CDP-193/BDK-165: Legal cases – exp clear 31-May-26',                   level:'w'},
    {code:'WTG-CANCEL', text:'BLK-400: Location CANCELLED (PTCL Land)',                              level:'i'},
    {code:'PSS-MCR',    text:'Brick Work FF 65% – Manpower not available. Exp clear 01-May-26',      level:'w'},
    {code:'GSS-MATL',   text:'Isolator foundation hold – Structure material unavailability',           level:'w'},
    {code:'66kV-STR',   text:'66kV Stringing: only 0.455km/12.72km done – acceleration needed',      level:'w'},
    {code:'SOLAR-DC',   text:'DC Cable Laying 2% (1000/56542m) – trench 51%, acceleration needed',   level:'i'},
    {code:'SOLAR-MOD',  text:'Module Installation starts 09-May-26 (0/34608 Nos)',                    level:'i'},
  ],

  landParcels:[],
  _lastSaved: null,
};

// ════════════════════════════════════════════════════════════
//  PERSISTENCE ENGINE (localStorage auto-save)
// ════════════════════════════════════════════════════════════
const DB_KEY = 'swppl_epc_db_v3';  // bump version to force fresh load of new data
const PERSIST_FIELDS = ['pod','mp','milestones','blockers','landParcels','rowIssues'];

function saveDB(){
  try{
    const snap={
      _v:3, _ts:Date.now(),
      pod:DB.pod, mp:DB.mp,
      milestones:DB.milestones, blockers:DB.blockers,
      landParcels:DB.landParcels, rowIssues:DB.rowIssues,
      schedule:DB.schedule,
      solarActs:Object.fromEntries(
        Object.entries(DB.solar.itcs).map(([id,d])=>[id,d.acts.map(a=>({done:a.done,today:a.today,subDone:a.subDone}))])
      ),
      wtgTurbs:DB.wtg.turbines.map(t=>({id:t.id,status:t.status,lp:t.lp,pp:t.pp,civil:t.civil,mech:t.mech,uss:t.uss,sup:t.sup,notes:t.notes,mechDates:t.mechDates})),
      bopActs:DB.bopActs,
      pssActs:Object.fromEntries(Object.entries(DB.pss.acts).map(([k,v])=>[k,{done:v.done,wip:v.wip}])),
      gssActs:Object.fromEntries(Object.entries(DB.gss.acts).map(([k,v])=>[k,{done:v.done,wip:v.wip}])),
      bop33feeders:DB.bop33feeders,
      bop66Towers:DB.bop66.feeders[0]?.towers?.erection||56,
      wtgLandStages:DB.wtgLand.locs.map(l=>({id:l.id,stages:l.stages,ls:l.ls,comp:l.comp,notes:l.notes})),
      solLandActs:Object.fromEntries(Object.entries(DB.solLand.blocks).map(([id,b])=>[id,b.acts])),
      solarTotalMW:DB.solar.totalMW, wtgTotalMW:DB.wtg.totalMW, wtgCount:DB.wtg.count,
      itcMW:Object.fromEntries(Object.entries(DB.solar.itcs).map(([id,d])=>[id,d.mw])),
      itcMaps:Object.fromEntries(Object.entries(ITC_MAPS).filter(([,v])=>v)),
    };
    localStorage.setItem(DB_KEY,JSON.stringify(snap));
    DB._lastSaved=snap._ts;
    const ts=document.getElementById('last-saved-ts');
    if(ts)ts.textContent='💾 Saved: '+new Date(snap._ts).toLocaleTimeString();
  }catch(e){console.warn('saveDB failed:',e);}
}

function loadDB(){
  try{
    const raw=localStorage.getItem(DB_KEY);
    if(!raw)return false;
    const snap=JSON.parse(raw);
    if(!snap||snap._v!==3)return false;  // v3 → forces re-seed on first load
    if(snap.pod)DB.pod=snap.pod;
    if(snap.mp)DB.mp=snap.mp;
    if(snap.milestones)DB.milestones=snap.milestones;
    if(snap.blockers)DB.blockers=snap.blockers;
    if(snap.landParcels)DB.landParcels=snap.landParcels;
    if(snap.rowIssues)DB.rowIssues=snap.rowIssues;
    if(snap.schedule)DB.schedule=snap.schedule;
    if(snap.solarActs){
      Object.entries(snap.solarActs).forEach(([id,acts])=>{
        if(DB.solar.itcs[id])acts.forEach((a,i)=>{
          if(DB.solar.itcs[id].acts[i]){
            DB.solar.itcs[id].acts[i].done=a.done||0;
            DB.solar.itcs[id].acts[i].today=a.today||0;
            if(a.subDone)DB.solar.itcs[id].acts[i].subDone=a.subDone;
          }
        });
      });
    }
    if(snap.wtgTurbs){
      snap.wtgTurbs.forEach(st=>{
        const t=DB.wtg.turbines.find(x=>x.id===st.id);
        if(t)Object.assign(t,st);
      });
    }
    if(snap.bopActs)DB.bopActs=snap.bopActs;
    if(snap.pssActs)Object.entries(snap.pssActs).forEach(([k,v])=>{if(DB.pss.acts[k]){DB.pss.acts[k].done=v.done;if(v.wip!==undefined)DB.pss.acts[k].wip=v.wip;}});
    if(snap.gssActs)Object.entries(snap.gssActs).forEach(([k,v])=>{if(DB.gss.acts[k]){DB.gss.acts[k].done=v.done;if(v.wip!==undefined)DB.gss.acts[k].wip=v.wip;}});
    if(snap.bop33feeders)DB.bop33feeders=snap.bop33feeders;
    if(snap.wtgLandStages)snap.wtgLandStages.forEach(st=>{const l=DB.wtgLand.locs.find(x=>x.id===st.id);if(l)Object.assign(l,st);});
    if(snap.solLandActs)Object.entries(snap.solLandActs).forEach(([id,acts])=>{if(DB.solLand.blocks[id])DB.solLand.blocks[id].acts=acts;});
    if(snap.solarTotalMW)DB.solar.totalMW=snap.solarTotalMW;
    if(snap.wtgTotalMW)DB.wtg.totalMW=snap.wtgTotalMW;
    if(snap.wtgCount)DB.wtg.count=snap.wtgCount;
    if(snap.itcMW)Object.entries(snap.itcMW).forEach(([id,mw])=>{if(DB.solar.itcs[id])DB.solar.itcs[id].mw=mw;});
    if(snap.itcMaps)Object.entries(snap.itcMaps).forEach(([id,v])=>{ITC_MAPS[id]=v;});
    DB._lastSaved=snap._ts;
    console.log('[DB v3] Loaded. Saved:',new Date(snap._ts).toLocaleString());
    return true;
  }catch(e){console.warn('loadDB failed:',e);return false;}
}

let _autoSaveTimer=null;
function scheduleSave(){clearTimeout(_autoSaveTimer);_autoSaveTimer=setTimeout(saveDB,1500);}

function addLandParcel(module,name,lat,lng,area,notes){
  DB.landParcels.push({id:'LP-'+Date.now(),module,name,lat:+lat,lng:+lng,area:+area,notes,added:new Date().toISOString().slice(0,10)});
  saveDB();if(typeof mapInst!=='undefined'&&mapInst)rndrMap();
  showToast('Land parcel added: '+name,'ok');
}
function removeLandParcel(id){
  DB.landParcels=DB.landParcels.filter(p=>p.id!==id);
  saveDB();if(typeof mapInst!=='undefined'&&mapInst)rndrMap();
}
function setActivityScope(module,entityId,actIdx,newScope){
  if(module==='solar'){const itc=DB.solar.itcs[entityId];if(itc&&itc.acts[actIdx])itc.acts[actIdx].subScope=newScope;}
  scheduleSave();
}

// ════════════════════════════════════════════════════════════
//  HSE DATA MODEL — shows CURRENT MONTH + PREVIOUS MONTH
// ════════════════════════════════════════════════════════════
const HSE_DB = {
  // Always derive current month from system date
  get month(){
    const d=new Date();
    return d.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  },
  get prevMonth(){
    const d=new Date();d.setMonth(d.getMonth()-1);
    return d.toLocaleDateString('en-IN',{month:'long',year:'numeric'});
  },
  kpis:{raised:1, open:0, closed:1, avgCloseTime:'3 Hrs'},
  pyramid:[
    {level:'Fatality',                  color:'#b71c1c', count:0},
    {level:'Lost Time Injury',          color:'#c62828', count:0},
    {level:'Minor Injury / First Aid',  color:'#f9a825', count:0},
    {level:'Near Miss',                 color:'#ff8f00', count:0},
    {level:'Unsafe Act / Condition',    color:'#1565c0', count:1},
    {level:'No Observation',            color:'#2e7d32', count:0},
  ],
  observations:[
    {loc:'MBI-12', obs:'Not Wearing Safety Shoe', photo:'', vendor:'HML',
     raisedDate:'25-04-2026', raisedBy:'Mastan Ali', status:'Closed',
     closedBy:'Laxman', closedPhoto:'', avgTime:'3 Hrs', risk:'Unsafe Act / Condition',
     branch:0, day:24},
  ],
  locations:['MBI-12','MKD-258','MKD-253','MKD-211','MKD-52','KDK-462','BDK-85','BDK-25','AMK-264','CDP-221','MOB-403','MOB-142','BDK-165','CDP-193','Solar ITC-1','PSS','EHV 66kV','33kV Line','GSS'],
  employees:[
    {code:'BE28',name:'Chandrashekhar Angadi',score:82,photo:''},
    {code:'BE27',name:'Abdul',                score:76,photo:''},
    {code:'BE32',name:'Mahesh',               score:70,photo:''},
    {code:'BE03',name:'Manjunath',            score:88,photo:''},
    {code:'BE12',name:'Shashikant',           score:74,photo:''},
    {code:'BE14',name:'Arul',                 score:79,photo:''},
    {code:'SW-01',name:'AA',                  score:53,photo:''},
    {code:'SW-02',name:'BB',                  score:56,photo:''},
    {code:'SW-03',name:'CC',                  score:71,photo:''},
    {code:'SW-05',name:'EE',                  score:81,photo:''},
    {code:'SW-10',name:'EkE',                 score:91,photo:''},
  ],
};

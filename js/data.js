//  MASTER DATA MODEL
//  Last updated: 11-May-2026
//   • WTG / BOP / PSS / GSS / 33kV / 66kV  — from Excel DPR  11-05-2026
//   • Solar (ITC-1 & ITC-2..6)              — from Solar PDF 11-05-2026
//  Sections covered: Solar acts + live activities, WTG turbines & supply,
//   33kV feeders, 66kV EHV line, PSS, GSS, ROW issues, milestones, blockers,
//   manpower, schedule, MP, daily plan-of-day, next-day plan.
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

// NOTE: The legacy USERS const (with plaintext passwords) has been removed.
// Authentication is handled by Firebase Auth (auth.js) via signInWithEmailAndPassword.
// Roles live in /users/{uid} in Realtime Database — see security/seed-users.json.

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
  // Source: Solar PDF 11-May-2026 (ITC-1 = 13.2MW, Block-2, 76.02 Acres)
  // ITC-2 to ITC-6: 0% as no progress reported in any DPR
  //
  // Piling:   Marking=6185/6185(100%), Drilling=6185/6185(100%),
  //           Casting=5985/6185(97%), Coping=3921/6185(63%)
  //   (Note PDF row 28-30: scope listed as 3612 but actuals 5985 & 3921 represent
  //    progress against ultimate 6185 scope; using 6185 for consistency.)
  // BoundaryWall (3650m total):
  //   Pole marking/drilling 720/3650 = 20%, alignment+casting 720/3650 = 20%,
  //   slab installation 720/3650 = 20%, Y-angle+barbed wire 0/3650 = 0%
  //   → average ~15% (use 20% on the Boundary Wall card as the dominant activity)
  // DC 4 sqmm: Trench 2903/5679 = 51%, Cable Laying 0 SCBs, String 0/1236
  // SCB: Channel drilling 8/3612 = 0.2%, Channel casting 0, Installation 0/1481
  // MMS:  Full Table Raft 490/580 = 84%, Full Table Purlin 380/580 = 66%
  //       Half-table Raft 33/77 = 43%, Purlin 0/77 = 0%
  //       (Combined MMS structure ~58%; Module Installation 192/34608 = 0.6%)
  // IDT:  Foundation 1/1 = 100%, grade-slab w/ catchment wall WIP,
  //       IDT BOT WIP (started), NIFPS Fdn WIP, AUX Trafo Fdn WIP — overall ~30%
  // LA:   Foundation 0/13, Install 0/13, Earthing pit 0/26 — 0%
  // F-INV: Inverter fdn/slab WIP (0% complete), canopy pending — 0%
  // F-Equip: ICOG fdn WIP, AUX trafo fdn WIP — 0%
  // DP Yard: 33kV line 0/2.5km WIP (not started) — 0%
  // MCR Building: All 4 milestones 0% (not started)
  // Pre-Commissioning: 0% (Verification of TBM 100% completed)
  // HOTO: 0%
  solar:{
    totalMW:70.4,
    itcs:{
      'ITC-1':{mw:13.2, pct:9.4, active:true, lat:14.832892, lng:76.468903,
        acts:mkSolActs({
          'Piling':            {done:Math.round((100+100+97+63)/4), subDone:[6185,6185,5985,3921]},  // ~90%
          'Road':              {done:0,   subDone:[0]},
          'Boundary Wall':     {done:20,  subDone:[720]},     // Pole alignment 720/3650m
          'DC 4 Sq.mm':        {done:Math.round((51+0+0)/3),  subDone:[2903,0,0]},   // 17%
          'DC 400 Sq.mm':      {done:0,   subDone:[0]},
          'Main Gate':         {done:0,   subDone:[0]},
          'SCB':               {done:Math.round((0+0+0)/3),   subDone:[8,0,0]},     // ~0%
          'MMS & Module':      {done:Math.round((84+43+1)/3), subDone:[490,33,192]}, // ~43%
          'IDT':               {done:Math.round((100+10+0)/3),subDone:[1,0,0]},     // ~37%
          'F INV':             {done:0,   subDone:[0,0,0]},
          'F Equip Installation':{done:0, subDone:[0,0,0]},
          'LA & Earthing':     {done:0,   subDone:[0,0,0]},
          'DP Yard':           {done:0,   subDone:[0,0,0]},
          'MCR Building':      {done:0,   subDone:[0,0,0,0]},
          'Pre-Commissioning': {done:0,   subDone:[0,0,0,0,0]},
          'HOTO':              {done:0,   subDone:[0,0,0,0]},
        }),
        // 11-May-2026 LIVE ACTIVITIES (from Solar PDF "Task Achieved" section)
        live:{
          activities:[
            'Pre-Boundary Wall — Pole alignment completed – 100 mtr',
            'DC Cable Trench — Excavation & hard-rock breaking – 200 mtr',
            'DC Trench — Dressing and sand bedding – 50 mtr',
            'MMS Erection — Tilt fixing & fastener tightening – 5 full tables',
            'Solar PV Module Installation – 100 Nos',
            'ITC Foundation — Excavation NIFPS / BOT / AUX Transformer in progress',
            'Pile Casting (200 Nos) – NOT started (Aaraa vendor mobilisation pending)',
            'LA Foundation Drilling & Casting – NOT started (vendor machinery/MP issue)'
          ],
          noWorkReason:'',
          lastByName:'Site Engineer - Solar',
          lastAt:Date.now()
        }
      },
      // ITC-2 to ITC-6: NO progress per DPR — all zeros, no work yet
      // pct:0 below mirrors the all-zero acts array — these ITCs should
      // show 0% until real progress is logged via the Update form.
      'ITC-2':{mw:13.2, pct:0, lat:null, lng:null, acts:mkSolActs({}),
        live:{activities:[], noWorkReason:'Land development pending — work not yet mobilised.', lastByName:'', lastAt:Date.now()}},
      'ITC-3':{mw:13.2, pct:0, lat:null, lng:null, acts:mkSolActs({}),
        live:{activities:[], noWorkReason:'Land development pending — work not yet mobilised.', lastByName:'', lastAt:Date.now()}},
      'ITC-4':{mw:13.2, pct:0, lat:null, lng:null, acts:mkSolActs({}),
        live:{activities:[], noWorkReason:'Land registration pending — work not yet mobilised.', lastByName:'', lastAt:Date.now()}},
      'ITC-5':{mw:8.8,  pct:0, lat:null, lng:null, acts:mkSolActs({}),
        live:{activities:[], noWorkReason:'Land registration pending — work not yet mobilised.', lastByName:'', lastAt:Date.now()}},
      'ITC-6':{mw:8.8,  pct:0, lat:null, lng:null, acts:mkSolActs({}),
        live:{activities:[], noWorkReason:'Land procurement pending — work not yet mobilised.', lastByName:'', lastAt:Date.now()}},
    }
  },

  // ── ROW ISSUES (from Excel SWPPL DPR + Solar PDF 11-May-2026) ─────────────
  rowIssues:[
    // ── SOLAR ROW ISSUES (from Solar PDF 11-May-2026) ──
    {loc:'ITC-1 South',  type:'Solar', issue:'Boundary Wall (ITC-1 South): pole drilling on hold 1 week — ROW pending',                 opened:'2026-05-04', status:'Open',   expClear:'2026-05-15'},
    {loc:'Sy.293 North', type:'Solar', issue:'Land registration pending; sibling stakeholder blocking peripheral road vehicle movement', opened:'2026-04-25', status:'Open',   expClear:'2026-05-20'},
    {loc:'Sy.293/291',   type:'Solar', issue:'11 kV and 440 V transmission lines not yet shifted — ROW clearance pending',               opened:'2026-04-20', status:'Open',   expClear:'2026-05-25'},
    {loc:'Sy.293/291',   type:'Solar', issue:'SAFETY: Live HT/LT lines pose electrical hazard, restricting safe vehicle & manpower flow', opened:'2026-04-20', status:'Open',   expClear:'2026-05-25'},

    // ── WTG ROW ISSUES (from Excel SWPPL DPR + Day-wise Location Update 11-May-2026) ──
    {loc:'MKD-253', type:'WTG', issue:'Hub Preparation hold due to High Wind; Stator & A-section cable looping next-day plan',           opened:'2026-04-20', status:'Open',   expClear:'2026-05-15'},
    {loc:'MKD-258', type:'WTG', issue:'Logistic Pathway Marum filling 500/550m hold — mining inspection by Department',                  opened:'2026-03-17', status:'Open',   expClear:'2026-05-15'},
    {loc:'MBI-12',  type:'WTG', issue:'T1 Preparation WIP; further work hold — Third-party validation under Technical Review',           opened:'2026-05-05', status:'Open',   expClear:'2026-05-15'},
    {loc:'BDK-85',  type:'WTG', issue:'Foundation under Technical Review',                                                                opened:'2026-05-01', status:'Open',   expClear:'2026-05-20'},
    {loc:'KDK-462', type:'WTG', issue:'Casting hold — Pathway ROW by Farmer & 100m Pathway Marum filling pending',                       opened:'2026-03-11', status:'Open',   expClear:'2026-05-15'},
    {loc:'AMK-264', type:'WTG', issue:'Foundation 60% shuttering hold — Vendor Manpower not available & Vendor Payment Issue',           opened:'2026-03-01', status:'Open',   expClear:'2026-05-15'},
    {loc:'MKD-211', type:'WTG', issue:'2nd GSB filling & compaction hold — Pathway ROW (Farmer Payment Issue)',                          opened:'2026-04-07', status:'Open',   expClear:'2026-05-15'},
    {loc:'MKD-52',  type:'WTG', issue:'Lease area cleaning hold — ROW (Farmer Payment Issue)',                                            opened:'2026-04-05', status:'Open',   expClear:'2026-05-15'},
    {loc:'BDK-25',  type:'WTG', issue:'Excavation (Hardrock Breaking) hold — Vendor Payment Issue',                                       opened:'2026-03-31', status:'Open',   expClear:'2026-05-15'},
    {loc:'MOB-403', type:'WTG', issue:'Logistic Pathway Marum filling 800/1300 hold — Vendor Payment Issue',                              opened:'2026-04-15', status:'Open',   expClear:'2026-05-15'},
    {loc:'MOB-142', type:'WTG', issue:'Pipe fixing & Water proofing hold — Vendor Manpower not available + Payment Issue',                opened:'2026-02-04', status:'Open',   expClear:'2026-05-15'},
    {loc:'CDP-221', type:'WTG', issue:'3rd-layer backfilling, compaction, FDD & Cranepad scrap WIP — waiting for curing',                opened:'2026-02-02', status:'Open',   expClear:'2026-05-15'},
    {loc:'CDP-193', type:'WTG', issue:'Legal case 254/2025 OS-SRCJ Kudligi Brothers — RFC pending court case',                            opened:'2026-03-01', status:'Open',   expClear:'2026-05-31'},
    {loc:'BDK-165', type:'WTG', issue:'Legal case 14/2026 OS-SRCJ Kudligi Brothers',                                                      opened:'2026-03-01', status:'Open',   expClear:'2026-05-31'},
    {loc:'BLK-400', type:'WTG', issue:'Legal Issue (PTCL Land) — Location effectively Cancelled',                                         opened:'2026-01-06', status:'Open',   expClear:'2026-06-30'},

    // ── 33kV WIND ROW (from Excel SWPPL DPR 11-May-2026) ──
    {loc:'Feeder-01 NR Infra',  type:'33kV', issue:'06-span stringing pending — ROW (Farmer not willing); 05 poles shifting & re-routing', opened:'2026-04-10', status:'Open',   expClear:'2026-05-20'},
    {loc:'Feeder-01 SLV',       type:'33kV', issue:'06 Pole Erection hold — ROW (Farmer not willing); 20 stay-concrete pending',           opened:'2026-04-12', status:'Open',   expClear:'2026-05-20'},
    {loc:'Feeder-04 Saishreeja',type:'33kV', issue:'07 Pole Erection — ROW Not Cleared (Farmer not willing)',                              opened:'2026-04-15', status:'Open',   expClear:'2026-05-20'},

    // ── EHV TOWER (from Hindrance Register) ──
    {loc:'EHV Tower-37', type:'EHV', issue:'Tower Location land ROW Issue — open since 21-Nov-2025',                     opened:'2025-11-21', status:'Open',   expClear:'2026-05-25'},
    {loc:'EHV Tower-53', type:'EHV', issue:'Tower Location ROW Issue — Farmers Demand High after Excavation',            opened:'2025-07-28', status:'Open',   expClear:'2026-05-30'},

    // ── BDK-183 (16th WTG location — newly added) ──
    {loc:'BDK-183', type:'WTG', issue:'Registration completed — Land Leased count now 16/26. Foundation work to begin.', opened:'2026-05-10', status:'Closed', expClear:'2026-05-11'},
  ],

  // ── SCHEDULE (S-curve) ────────────────────────────────────────────────────
  // Labels are generated dynamically from PROJECT_START → PROJECT_END so the
  // dashboard stays correct even years from now. No hardcoded year numbers.
  schedule: (() => {
    const PROJECT_START = new Date(2026, 0, 1);   // 1 Jan 2026
    const PROJECT_END   = new Date(2027, 4, 1);   // 1 May  2027
    const labels = [];
    const cur = new Date(PROJECT_START);
    while (cur <= PROJECT_END) {
      const m = cur.toLocaleDateString('en-GB', { month: 'short' });
      const y = cur.getFullYear() % 100;
      labels.push(cur.getFullYear() === PROJECT_START.getFullYear() ? m : (m + y));
      cur.setMonth(cur.getMonth() + 1);
    }
    // Planned curve runs full length; actual is filled as months elapse.
    // We compute "months elapsed since project start" so the actual array
    // automatically extends as time passes — no manual editing needed.
    const elapsedMonths = Math.max(0, Math.min(labels.length,
      (new Date().getFullYear()  - PROJECT_START.getFullYear()) * 12 +
      (new Date().getMonth()     - PROJECT_START.getMonth()) + 1
    ));
    const planned = [0,2,5,9,14,20,27,35,43,52,61,70,78,85,91,96,100].slice(0, labels.length);
    while (planned.length < labels.length) planned.push(100);
    const actualSeed = [0,1,3,7,11];                  // kept-for-history
    const actual = labels.map((_, i) => i < actualSeed.length && i < elapsedMonths ? actualSeed[i] : null);
    return { planned, actual, labels };
  })(),

  // ── WTG (source: Excel WTG DPR sheet + SWPPL DPR 11-May-2026) ────────────
  // Land Leased: 16/26 (BDK-183 just registered today)
  // Soil test: 15/26, Excavation: 11/26, Re-Engg Excavation: 2/26
  // PCC: 9/26, Anchor Cage Install: 9/26, Reinforcement: 9/26
  // Shuttering: 8/26, Casting: 7/26, Curing: 7/26, Backfilling: 4/26
  // WTG Erection (full set): 1/26 (MBI-12 only)
  // USS Slab: 0/26, USS Transfo: 0/26, WTG Commissioning: 0/26
  // Supply status: Steel RFM 10/26, Anchor Cage Set 16/26, WTG ready dispatch 8/26
  //   Tower Set 8/26, Blade Set 7/26, Nacelle 8/26, Hub 8/26
  //   Lift 17/26, Tower Rack 8/26, Converter panel 8/26, Hardware Set 10/26
  //   USS Transfo 3.2MVA Received 17/26, WTG Delivered 7/26
  wtg:{
    totalMW:70.2, count:26,
    civil:  [{n:'Excavation',w:6,col:'#7c4dff'},{n:'PCC',w:5,col:'#651fff'},{n:'Anchor Cage',w:5,col:'#b39ddb'},{n:'Reinforcement',w:7,col:'#9575cd'},{n:'Casting',w:7,col:'#673ab7'}],
    mech:   [{n:'Tower Erection',w:15,col:'#00c8ff'},{n:'Nacelle Install',w:15,col:'#0099cc'},{n:'Hub Install',w:12,col:'#00acc1'},{n:'Blade Assembly',w:8,col:'#00bcd4'}],
    uss:    [{n:'USS Works',w:10,col:'#00c853'}],
    supply: [{n:'Supply Complete',w:10,col:'#69f0ae'}],
    // supply counts from SWPPL DPR 11-May-2026 (received/26):
    supplyStatus:{
      steelRFM:10, anchorCage:16, wtgReadyDispatch:8,
      towerSet:8, bladeSet:7, nacelle:8, hub:8,
      lift:17, towerRack:8, converterPanel:8,
      hardwareSet:10, ussTransfo:17, wtgDelivered:7, '33kvTransformer':5,
    },
    // ── 26 Turbines — from WTG DPR rows 5-20 + SWPPL DPR Day-wise Loc Update ──
    // civil[]: [Excavation%, PCC%, AnchorCage%, Reinforcement%, Casting%]
    // mech[]:  [TowerErection%, NacelleInstall%, HubInstall%, BladeAssembly%]
    // uss: USS%  sup: Supply%
    // Status as of 11-May-2026 per Day-wise Location Update.
    turbines:[
      // ── 1. MBI-12 | HML | Feeder-02 — FOUNDATION + ERECTION COMPLETE ──
      // Per WTG DPR: T1-T5 (20-29 Apr), Nacelle 30-Apr, Rotor Assembly 03-May,
      // Rotor Erection 06-May, Boom Down 06-May.
      // 11-May POD: T5-Generator 50% cable termination completed; Stator WIP.
      // Plan: Hub Prep, A-section cable looping, Loop section crimping.
      {id:'MBI-12',  status:'wip',    lp:true,  pp:true,
       civil:[100,100,100,100,100], mech:[100,100,100,80], uss:0, sup:100,
       mechDates:{towerStart:'2026-04-07',towerEnd:'2026-04-19',
                  nacelleStart:'2026-04-20',nacelleEnd:'2026-04-30',
                  bladeStart:'2026-05-03',bladeEnd:''},
       notes:'T1-T5 + Nacelle + Rotor Assembly + Rotor Erection + Boom Down COMPLETED. T1 Preparation WIP — Third-party validation under Technical Review. 11-May: T5 Generator cable termination 50%->100% done; Stator & Hub Prep WIP'},

      // ── 2. MKD-258 | HML | Feeder-02 — Foundation done, Logistic ROW issue
      // 11-May POD: 550m Marum filling, Compaction & Main crane cabin marching.
      // Plan: 50m Marum filling hold due to mining inspection.
      {id:'MKD-258', status:'row',    lp:true,  pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Foundation Complete. Logistic Pathway Marum filling 500/550m — work hold due to mining inspection by Department. Main crane cabin marching WIP'},

      // ── 3. KDK-462 | KRR | Feeder-02
      // Excv-Cast-Cure-BackFill completed (Apr-2026). Whether coat 20-Apr.
      // 11-May POD: Pathway ROW clearance & development for foundation casting.
      // Casting work hold due to Pathway ROW by Farmer & 100m pathway pending.
      {id:'KDK-462', status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100],  mech:[0,0,0,0], uss:0, sup:0,
       notes:'Civil 100% (Casting + Curing + Backfilling done). Pathway ROW clearance & development PENDING — work hold due to Farmer issue. 100m Pathway Marum filling pending'},

      // ── 4. MOB-403 | Ashwin | Feeder-01
      // Foundation done (BackFill end 15-Apr, CP done 15-Apr).
      // 11-May POD: Logistic Pathway pending Marum filling 800/1300.
      // Hold due to Vendor Payment Issue.
      {id:'MOB-403', status:'casting',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Foundation Complete. CP done 15-Apr. Logistic Pathway Marum filling 800/1300m — work hold due to Vendor Payment Issue'},

      // ── 5. MKD-253 | HML | Feeder-02 — Tower + Nacelle DONE; Hub WIP
      // Foundation full. Tower stages (per Excel: nothing past BackFill 12-Mar).
      // 11-May POD: T5-Generator 50% cable termination remaining; Hub work hold.
      // Plan: Hub Preparation (on hold due to High Wind), A-section cable looping.
      {id:'MKD-253', status:'wip',    lp:true,  pp:true,
       civil:[100,100,100,100,100], mech:[100,100,60,0], uss:0, sup:100,
       mechDates:{towerStart:'2026-03-01',towerEnd:'2026-03-12',
                  nacelleStart:'2026-04-15',nacelleEnd:'2026-04-22',
                  bladeStart:'',bladeEnd:''},
       notes:'Tower + Nacelle COMPLETED. MCC 60% completed. Hub work hold — High Wind. 11-May: T5 Generator cable termination 50% remaining. Plan: Hub Prep, A-section cable looping, Loop crimping'},

      // ── 7. AMK-264 | Ashwin | Feeder-01
      // Cast + Cure done (10-Apr). BackFill end 13-Apr. Shuttering done 28-Mar.
      // 11-May POD: Foundation remaining 60% shuttering work.
      // Hold due to Vendor Manpower not available & Payment Issue.
      {id:'AMK-264', status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100],  mech:[0,0,0,0], uss:0, sup:0,
       notes:'Civil casting + curing completed. 11-May: Foundation remaining 60% shuttering work hold due to Vendor Manpower not available & Payment Issue'},

      // ── 8. CDP-221 | KRR | Feeder-01
      // Cast 18-Mar, Cure 28-Mar, BackFill 14-Apr. CP done WIP (20% completed).
      // 11-May POD: 3rd layer backfill+compaction+FDD completion+Cranepad.
      // Plan: water sprinkling, waiting for curing, compaction; 3rd layer scrap.
      {id:'CDP-221', status:'casting',lp:true,  pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Foundation Complete. CP done WIP 20%. 11-May: 3rd-layer backfilling + compaction + FDD completion + Cranepad WIP. Water sprinkling & curing in progress'},

      // ── 9. MOB-142 | KRR | Feeder-01
      // Cast 05-Apr, Cure 15-Apr, BackFill 18-Apr.
      // 11-May POD: Pipe fixing, Water proofing.
      // Hold due to Vendor Manpower not available & Payment Issue.
      {id:'MOB-142', status:'casting',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Civil casting + curing + backfilling completed. 11-May: Pipe fixing & Water proofing hold — Vendor Manpower & Payment Issue'},

      // ── 10. MKD-211 | HML | Feeder-02 — Re-Engg
      // Cast 21-Apr, Cure 01-May, BackFill 04-May.
      // 11-May POD: 2nd GSB filling, leveling & compaction.
      // Hold due to Pathway ROW (Farmer Payment Issue).
      {id:'MKD-211', status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Re-Engg Foundation completed (Cast 21-Apr, Cure 01-May). 11-May: 2nd GSB filling/leveling/compaction hold — Pathway ROW Farmer Payment Issue'},

      // ── 11. BDK-165 | KRR | Feeder-01 — Re-Engg + Legal case
      // Cast 10-Mar, Cure 20-Mar, BackFill 22-Mar.
      // 11-May: Legal case 14/2026 OS-SRC Kudligi Brothers.
      {id:'BDK-165', status:'pending',lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Re-Engg Foundation completed (Cast 10-Mar). LEGAL CASE 14/2026 OS-SRC Kudligi Brothers — Expected clear 31-May-2026'},

      // ── 12. MKD-52 | Ashwin | Feeder-02 — Re-Engg
      // Cast 23-Apr, Cure 03-May, BackFill 06-May.
      // 11-May POD: Lease area cleaning.
      // Hold due to ROW (Farmer Payment Issue).
      {id:'MKD-52',  status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Re-Engg Foundation completed (Cast 23-Apr, Cure 03-May, BackFill 06-May). 11-May: Lease area cleaning hold — ROW Farmer Payment Issue'},

      // ── 15. BDK-25 | HML | Feeder-01
      // Cast 18-Apr, Cure 28-Apr, BackFill 01-May.
      // 11-May POD: Excavation work (Hardrock Breaking).
      // Hold due to Vendor Payment Issue.
      {id:'BDK-25',  status:'wip',    lp:false, pp:false,
       civil:[100,100,100,100,100], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Foundation completed (Cast 18-Apr, Cure 28-Apr, BackFill 01-May). 11-May: Hardrock Breaking Excavation hold — Vendor Payment Issue'},

      // ── 16. BDK-183 | NEW LOCATION — Registration completed 10-May-2026 ──
      {id:'BDK-183', status:'pending', lp:true, pp:false,
       civil:[0,0,0,0,0], mech:[0,0,0,0], uss:0, sup:0,
       notes:'Registration completed 10-May-2026. Land leased count now 16/26. Foundation work to be mobilised'}
    ]
  },

  // ── WTG LAND ────────────────────────────────────────────────────────────────
  wtgLand:{
    stages:['Land Agreement','Land Registration','Land Demarcation','Soil Test','DGPS Survey','Permanent Pathway Agreement','Permanent Pathway Dev','Logistic Path Agreement','Logistic Pathway Dev','RFC Approval'],
    // From SWPPL DPR 11-May-2026: Land Leased 16/26 = 61.5% (BDK-183 newly registered)
    locs:[
      // 5 fully cleared (all 10 stages complete)
      ...['MBI-12','MKD-258','MKD-253','MOB-403','KDK-462'].map((id,i)=>({id,svy:`SY.${101+i}/1`,pa:1.2,la:4.2,ls:'Executed',comp:'Paid',stages:[true,true,true,true,true,true,true,true,true,true],notes:'All land stages cleared'})),
      // partial-progress (registration done, some stages pending)
      ...['AMK-264','CDP-221','MOB-142','MKD-211','BDK-165','MKD-52','BDK-25','BDK-183'].map((id,i)=>({id,svy:`SY.${110+i}/2`,pa:1.1,la:4.0,ls:'Executed',comp:'Partial',stages:[true,true,true,true,id==='BDK-183'?false:true,false,id==='BDK-183'?false:true,true,false,false],notes:id==='BDK-183'?'Registration completed 10-May-2026 (newly added)':''}))
    ]
  },

  // ── SOLAR LAND ──────────────────────────────────────────────────────────────
  // ITC-1 (Block-2, 76.02 Ac): per PDF page-2 all preliminary feasibility,
  //   legal/agreements/clearance, survey, soil investigation = 100%.
  //   Land grading & leveling 80% (some boulders pending), Boundary demarcation 0%.
  //   Periphery/internal/outer roads = 0%, Bridge activity = 0%, Street light 0%,
  //   CCTV install 0% (10 nos), Drainage 0%, Security cabin 0%.
  // ITC-2..ITC-6: Various stages of land procurement, no construction.
  solLand:{
    actDef:[
      {n:'Document Agreement',w:10},{n:'Registration',w:40},{n:'Demarcation',w:5},
      {n:'Leveling',w:5},{n:'Soil Test',w:5},{n:'DGPS Survey',w:5},
      {n:'Permanent Pathway Agreement',w:5},{n:'Permanent Pathway Dev',w:10},
      {n:'Logistic Pathway Agreement',w:5},{n:'Logistic Pathway Dev',w:10},
    ],
    blocks:{
      // ITC-1 per PDF: all early stages done, only road/pathway dev pending
      'ITC-1':{mw:13.2,area:76.02,acts:[100,100,80,80,100,100,30,10,30,10],
        leases:[{own:'Rameshu',svy:'SY.45/1',dur:'30yr',ls:'Executed',doc:'Complete',reg:'Done',rem:'Boundary demarcation 0% — pending; some boulders to be removed.'}]},
      'ITC-2':{mw:13.2,area:52.5,acts:[100,80,60,0,0,0,50,0,0,0],leases:[]},
      'ITC-3':{mw:13.2,area:52.5,acts:[100,20,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-4':{mw:13.2,area:52.5,acts:[50,0,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-5':{mw:8.8, area:35.0,acts:[30,0,0,0,0,0,0,0,0,0],leases:[]},
      'ITC-6':{mw:8.8, area:35.0,acts:[0,0,0,0,0,0,0,0,0,0],leases:[]},
    }
  },

  // ── 33kV LINE (source: Excel "33kV Line Dtls" sheet 11-May-2026) ──────────
  // Cumulative: Total poles=1042, completed=534 (51.2%), spans=92/1059 (8.7%)
  // ALL EXACT FROM EXCEL SHEET — each row has poles done out of scope.
  bop33feeders:[
    {feeder:'1&2',section:'SPDC TAP 1A & 2A', km:13.5,type:'EP',  scope:364,done:352, wip:0, bal:12,  pct:97, spans:{scope:365,done:92}},
    {feeder:'1',  section:'END Tapping',       km:2.8, type:'EP',  scope:56, done:6,   wip:0, bal:50,  pct:11, spans:{scope:57,done:0}},
    {feeder:'1',  section:'MBI 12',            km:0.2, type:'Dog', scope:4,  done:0,   wip:0, bal:4,   pct:0,  spans:{scope:5,done:0}},
    {feeder:'1',  section:'KDK 462',           km:0.2, type:'Dog', scope:4,  done:0,   wip:0, bal:4,   pct:0,  spans:{scope:5,done:0}},
    {feeder:'1',  section:'MKD 258',           km:1.8, type:'Dog', scope:36, done:26,  wip:0, bal:10,  pct:72, spans:{scope:37,done:0}},
    {feeder:'1',  section:'MKD 52',            km:2.2, type:'Dog', scope:44, done:36,  wip:0, bal:8,   pct:82, spans:{scope:45,done:0}},
    {feeder:'1',  section:'MKD 211',           km:1.2, type:'Dog', scope:24, done:18,  wip:0, bal:6,   pct:75, spans:{scope:25,done:0}},
    {feeder:'1',  section:'MKD 253',           km:1.3, type:'Dog', scope:26, done:19,  wip:0, bal:7,   pct:73, spans:{scope:27,done:0}},
    {feeder:'2',  section:'Solar Land WIP',    km:0,   type:'EP',  scope:0,  done:0,   wip:0, bal:0,   pct:0,  spans:{scope:1,done:0}},
    {feeder:'3',  section:'TAP 3A',            km:1.5, type:'EP',  scope:30, done:0,   wip:0, bal:30,  pct:0,  spans:{scope:31,done:0}},
    {feeder:'3',  section:'Block 2',           km:0.6, type:'Dog', scope:12, done:0,   wip:0, bal:12,  pct:0,  spans:{scope:13,done:0}},
    {feeder:'4',  section:'MOB 142',           km:10,  type:'EP',  scope:200,done:0,   wip:0, bal:200, pct:0,  spans:{scope:201,done:0}},
    {feeder:'4',  section:'CDP-221',           km:2.6, type:'Dog', scope:52, done:0,   wip:0, bal:52,  pct:0,  spans:{scope:53,done:0}},
    {feeder:'4',  section:'AMK 264',           km:0.6, type:'Dog', scope:12, done:0,   wip:0, bal:12,  pct:0,  spans:{scope:13,done:0}},
    {feeder:'4',  section:'MOB 403',           km:1.2, type:'Dog', scope:24, done:0,   wip:0, bal:24,  pct:0,  spans:{scope:25,done:0}},
    {feeder:'4',  section:'BDK 85',            km:6.5, type:'Dog', scope:130,done:77,  wip:0, bal:53,  pct:59, spans:{scope:131,done:0}},
    {feeder:'4',  section:'BDK 25',            km:1.2, type:'Dog', scope:24, done:0,   wip:0, bal:24,  pct:0,  spans:{scope:25,done:0}},
  ],

  // ── 33kV summary lines (3 logical feeder-groups per Excel SWPPL DPR right col) ──
  //  Feeder-1 SPDC Eco Panther:  13km / 06 WTG | Pole 352/364 (97%) | Stringing 4.77/13 km
  //  Feeder-1 SPSC DOG/Panther:  9.5km / 06 WTG | Pole 99/190 (52%)  | Stringing 0/9.5km
  //  Feeder-4 SPSC DOG-Panther: 20km / 06 WTG  | Pole 77/426 (18%)  | Stringing 0/22 km
  bop33:{
    lines:[
      {id:'Feeder-1 SPDC',   km:13,  type:'wtg', vendor:'NR Infra',
        poles:{scope:364, done:352}, stringing:{scope:13,  done:4.77, unit:'km'},
        row:0, mp:18, notes:'06 WTG (MBI-12 path). Stringing 4.77/13km (37%). 06 span stringing pending — ROW (farmer not willing); 05 poles shifting & re-routing in progress'},
      {id:'Feeder-1 SPSC',   km:9.5, type:'wtg', vendor:'SLV',
        poles:{scope:190, done:99},  stringing:{scope:9.5, done:0,    unit:'km'},
        row:91, mp:12, notes:'06 WTG (Feeder-1 SPSC group). Pole erection 52%. 06 Pole Erection & 20 stay concrete hold — ROW Farmer not willing'},
      {id:'Feeder-4 SPSC',   km:22,  type:'wtg', vendor:'Saishreeja',
        poles:{scope:426, done:77},  stringing:{scope:22,  done:0,    unit:'km'},
        row:316, mp:10, notes:'06 WTG (Feeder-4 SPSC group: MOB/CDP/AMK/BDK). Pole erection 18%. 07 Pole erection hold — ROW Not Cleared (Farmer not willing)'},
      {id:'Feeder-3 Solar',  km:2.1, type:'solar', vendor:'TBD',
        poles:{scope:42,  done:0},   stringing:{scope:2.1, done:0,    unit:'km'},
        row:0, mp:0,   notes:'TAP 3A (1.5km EP) + Block-2 (0.6km Dog) feeding Solar ITCs. Not yet started.'},
    ]
  },

  // ── 66kV EHV (source: Excel SWPPL DPR rows 4-9 + "66kV EHV Line" 11-May-2026) ──
  // Row 4 summary: Total Towers=66, ROW=66 (all cleared), Excv=65, PCC=65,
  //   Foundation=65, Erection=56, Stringing(km)=0.455 of 12.72, OPGW=0/12.72
  // Vendor split per SWPPL DPR EHV(66Tower's) section:
  //   Krishna Electricals: 39/66 - ROW 39/39, Excv 38/39, PCC 38/39, Fdn... (~36)
  //   Zelvo:               27/66 - ROW 27/27, Excv 27/27, PCC 27/27, Fdn 27, Erect ~20
  bop66:{
    totalTowers:66,
    feeders:[
      {id:'SPDC Feeder',
       km:12.72,
       towerType:'SPDC-Eco-Panther',
       towers:{
         scope:66, row_cleared:66,    // ALL ROW CLEARED
         excv:65, pcc:65, fdn:65,     // Foundation: 65/66 = 98.5%
         erection:56,                 // Tower Erection: 56/66 = 84.8%
         stringing_km:0.455,          // Stringing in km: 0.455
         stringing_spans:1,           // Stringing spans: 1 completed
         done:56,                     // Use erection count as primary "done"
       },
       stringing:{scope:12.72, done:0.455, unit:'km'},
       notes:'PSS↔GSS · 66 towers · ALL ROW CLEARED · Foundation 65/66 · Erection 56/66 · Stringing 0.455km (only 3.6%) — major acceleration needed for SCOD'},
    ],
    vendors:[
      {n:'Krishna Electricals', towers:{scope:39, done:36}, stringing:{scope:6.36,  done:0.3,   unit:'km'},
        notes:'ROW 39/39, Excv 38/39, PCC 38/39, Fdn ~36/39, Erection ~30/39. T.no-52 Erection hold — Manpower not available (Exp reach 13-May). T.no 59-60 Stringing hold — Manpower'},
      {n:'Zelvo',               towers:{scope:27, done:20}, stringing:{scope:6.36,  done:0.155, unit:'km'},
        notes:'ROW 27/27, Excv 27/27, PCC 27/27, Fdn 27/27, Erection ~20/27. T.no-01A Erection hold — less Manpower (03/08 available). T.no-02 Erection hold — Manpower (Exp reach 12-May)'},
    ]
  },

  // ── PSS (source: Excel SWPPL DPR rows 12-40, 11-May-2026) ────────────────
  // EXACT numbers from DPR sheet (11-May-2026):
  // Soil Test 1/1, Pre cast Compound Wall 250/250, Earth Mat 80/100
  // 66kV Gantry Fdn 6/6, 33kV Gantry Fdn 20/20, 66kV Equip Fdn 35/35
  //   33kV Equip Fdn 72/73, 66kV Gantry Erect 6/6, 33kV Gantry Erect 20/20
  //   66kV Equip Str 32/32, 33kV Equip Str 55/55, 66kV Equip Erect 9/35
  //   33kV Equip Erect 0/82, Main Cable Trench 60/100
  // 2x40MVA Transformer: Foundation 2/2, Erection 0/2, Testing 0/2, Commissioning 0/2
  // MCR Building: GF Foundation 100%, Raft&Column 100%, Brick GF 100%, Roof GF 100%
  //   Brick FF 70/100 (+5% today, WIP), Roof FF 0%, Cable Trench 0%, C&R Panel 0%
  // PSS POD 11-May: Lintel beam barbending 100% complete; Ring reinforcement WIP 50%
  //   (50% lagging due to 04 manpower available — instructed to vendor)
  //   20 sq/mt GF plastering work HOLD — manpower not available.
  pss:{
    mp:0, todayProg:5,
    acts:{
      'Soil Test':                {scope:1,   done:1,   wip:0, bal:0,   col:'#90caf9',unit:'Nos'},  // 100%
      'Pre cast Compound Wall':   {scope:250, done:250, wip:0, bal:0,   col:'#64b5f6',unit:'Mtr'},  // 100%
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
      'Brick Work (FF)':          {scope:100, done:70,  wip:5, bal:30,  col:'#2e7d32',unit:'%'},    // 70% (+5% today)
      'Roof Slab (FF)':           {scope:100, done:0,   wip:0, bal:100, col:'#1b5e20',unit:'%'},    // 0%
      'Cable Trench (MCR)':       {scope:100, done:0,   wip:0, bal:100, col:'#a5d6a7',unit:'%'},    // 0%
      'C&R Panel T&C':            {scope:100, done:0,   wip:0, bal:100, col:'#c8e6c9',unit:'%'},    // 0%
    }
  },

  // ── GSS (source: Excel SWPPL DPR rows 37-46, 11-May-2026) ────────────────
  // EXACT numbers: Bay Fdn 18/19, Structure erect 15/17, Equip KPTCL Insp 3/19,
  //   Equip KPTCL Deliv 3/19, Equip Erect 3/17, Testing 0/17,
  //   Cable Trench 0/100, CRB 0/100, Commissioning 0/1
  // 11-May DPR Note: Isolator Foundation work HELD due to structure material
  //   & Manpower not available. Expected to clear 13-05-2026.
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

  // ── BOP ACTS PROGRESS (updated from 11-May-2026 DPR) ─────────────────────
  // 33kV: [Survey&Design, ROWClear, PoleFdn, PoleErect, Stringing, Insulators, Earthing, T&C]
  // NOTE: For 33kV the Pole-Erection % and Stringing % are NOT stored here —
  // they are DERIVED LIVE from the pole/span counts in bop33lines below
  // (erection = polesDone/polesTotal, stringing = spansDone/spansTotal), so
  // the section can never go stale against the real feeder data. The arrays
  // below only carry the non-count activities (Survey, ROW, Foundation,
  // Insulators, Earthing, Testing); positions 3 (Erection) and 4 (Stringing)
  // are placeholders that the renderer overwrites from bop33lines.
  bopActs:{
    '33kv':{
      'SPDC (F1 & F2)': [100, 97, 97,  0,  0,  5, 60, 0],
      'SPSC Feeder-1':  [100, 91, 76,  0,  0,  0, 30, 0],
      'SPSC Feeder-2':  [ 60,  0,  0,  0,  0,  0,  0, 0],
      'SPSC Feeder-3':  [100, 85, 77,  0,  0,  0, 20, 0],
      'SPSC Feeder-4':  [100, 26, 19,  0,  0,  0, 15, 0],
    },
    '66kv':{
      // SPDC Feeder represents all 66 towers (combined Krishna 39 + Zelvo 27).
      // calc.js averages across keys of bopActs['66kv'], so keeping a single
      // entry here gives the correct site-level 66kV%.
      // Vendor breakdown still lives in DB.bop66.vendors (display-only).
      // Activity row: [ROW, Excv, Fdn, Erection, Stringing, OPGW, Insul, T&C]
      'SPDC Feeder': [100, 98, 98, 85, 4, 0, 0, 0],
    },
  },

  // ── 33kV pole + span (stringing) counts per feeder ──────────────────────
  // The 33kV project is 5 feeders: SPDC (Feeders 1 & 2 combined) on the SPDC
  // line, plus SPSC Feeders 1–4 on the SPSC line. For each feeder we store the
  // real pole and span (stringing) scope and completion. Pole-Erection % and
  // Stringing % shown in the section are computed from these counts — nothing
  // is hardcoded — so the feeder-wise analysis always matches site data.
  //   poles = structures erected; spans = conductor sections strung.
  // Editable from the 33kV "Update Progress" form.
  bop33lines:{
    'SPDC (F1 & F2)': {line:'SPDC', poleTotal:409, poleDone:352, spanTotal:411, spanDone:158},
    'SPSC Feeder-1':  {line:'SPSC', poleTotal:154, poleDone:117, spanTotal:161, spanDone:22 },
    'SPSC Feeder-2':  {line:'SPSC', poleTotal:0,   poleDone:0,   spanTotal:0,   spanDone:0  },
    'SPSC Feeder-3':  {line:'SPSC', poleTotal:43,  poleDone:33,  spanTotal:45,  spanDone:11 },
    'SPSC Feeder-4':  {line:'SPSC', poleTotal:453, poleDone:84,  spanTotal:460, spanDone:59 },
  },

  // Legacy per-feeder pole store (kept for backward compatibility with the
  // old updateBop33Poles writer; derived from bop33lines at runtime).
  bop33poles:{
    'SPDC (F1 & F2)': {total:409, done:352},
    'SPSC Feeder-1':  {total:154, done:117},
    'SPSC Feeder-2':  {total:0,   done:0},
    'SPSC Feeder-3':  {total:43,  done:33},
    'SPSC Feeder-4':  {total:453, done:84},
  },

  // ── POD & MANPOWER ──────────────────────────────────────────────────────────
  // POD/NextDayPlan: start empty — to be populated daily via the dashboard form.
  // (Initial seed entries for "today" / "tomorrow" are tied to specific dates
  // and would be wiped/overridden by Firebase listeners. The dashboard's POD
  // submit form is the canonical way to add daily entries.)
  pod:{s:[],w:[],l:[],b:[]},
  nextDayPlan:{s:[],w:[],l:[],b:[]},
  mp:{sol:14, wtg:24, bop:18},  // from SWPPL DPR 11-May-2026: total site ~56

  // ── MILESTONES (achieved + upcoming, as of 11-May-2026) ─────────────────────
  milestones:[
    // ── Recently Achieved ──
    {date:'2026-04-30',label:'MBI-12 Nacelle Installed (DONE)',                        mod:'WTG'},
    {date:'2026-05-03',label:'MBI-12 Rotor Assembly Completed (DONE)',                 mod:'WTG'},
    {date:'2026-05-06',label:'MBI-12 Rotor Erection + Boom Down Completed (DONE)',     mod:'WTG'},
    {date:'2026-05-10',label:'BDK-183 Land Registration Completed — 16th location',    mod:'WTG'},
    {date:'2026-05-11',label:'PSS MCR Brick Work FF reached 70% (+5% today)',          mod:'BOP'},

    // ── Upcoming / In-Progress ──
    {date:'2026-05-13',label:'GSS Isolator Foundation — Material & manpower expected', mod:'BOP'},
    {date:'2026-05-15',label:'Multiple WTG ROW issues — expected resolution',          mod:'WTG'},
    {date:'2026-05-15',label:'66kV EHV Line — Stringing target (currently 0.455 km)',  mod:'BOP'},
    {date:'2026-05-15',label:'Solar Module Installation Target — 1,500 Nos / day',     mod:'Solar'},
    {date:'2026-05-20',label:'33kV Feeder-1 SPDC — Span stringing target (Wind)',       mod:'BOP'},
    {date:'2026-05-25',label:'PSS MCR Roof Slab (FF) — Casting start',                 mod:'BOP'},
    {date:'2026-05-31',label:'CDP-193 / BDK-165 Legal cases — Expected resolution',    mod:'WTG'},
    {date:'2026-06-15',label:'PSS — 66kV Equipment Erection (35 Nos) target',          mod:'BOP'},
    {date:'2026-06-30',label:'33kV Solar Feeder Energisation — Target',                mod:'BOP'},
    {date:'2026-09-01',label:'WTG First Power — Target',                               mod:'WTG'},
    {date:'2026-12-31',label:'Solar Full Commissioning — Target',                      mod:'Solar'},
    {date:'2027-03-31',label:'SCOD — Final COD',                                        mod:'Overall'},
  ],

  // ── BLOCKERS (current concerns, 11-May-2026) ────────────────────────────────
  blockers:[
    // Solar
    {code:'SOL-BW',     text:'Solar Boundary Wall (ITC-1 South) — pole drilling held 1 week (ROW)',                level:'w'},
    {code:'SOL-SY293',  text:'Solar SY.293 — Sibling stakeholder blocking peripheral road vehicle movement',       level:'w'},
    {code:'SOL-LIVE',   text:'Solar SY.293/291 — Live 11kV / 440V lines not shifted; safety hazard',                level:'d'},
    {code:'SOL-DC',     text:'Solar DC 400 sqmm cable laying NOT started — vendor MP/tools short',                  level:'w'},
    {code:'SOL-PILE',   text:'Solar Pile Casting 200 Nos NOT started — Aaraa vendor mobilisation pending',         level:'w'},
    {code:'SOL-LA',     text:'Solar LA Foundation drilling NOT started — vendor machinery/MP pending',             level:'i'},
    {code:'SOL-ICOG',   text:'Solar ICOG platform fabrication — vendor material not yet supplied',                  level:'i'},

    // WTG
    {code:'WTG-MKD253', text:'MKD-253 Hub Preparation hold — High Wind. T5 generator cable termination WIP',       level:'w'},
    {code:'WTG-MBI12',  text:'MBI-12 T1 Preparation — under Third-Party Technical Review',                          level:'w'},
    {code:'WTG-BDK85',  text:'BDK-85 Foundation — under Technical Review',                                          level:'w'},
    {code:'WTG-AMK264', text:'AMK-264 Foundation 60% shuttering hold — vendor MP + payment',                       level:'w'},
    {code:'WTG-ROW',    text:'Multiple WTG ROW issues (MKD-258/211/52, KDK-462, BDK-25, MOB-403/142)',             level:'d'},
    {code:'WTG-LEGAL',  text:'CDP-193 & BDK-165 — Legal cases (Kudligi Brothers) exp 31-May-26',                   level:'w'},
    {code:'WTG-BLK400', text:'BLK-400 — PTCL Land Legal Issue (effectively cancelled)',                            level:'i'},
    {code:'WTG-VEN-MP', text:'Multiple WTG vendor manpower shortage & payment issues (Ashwin/KRR sub-cons)',       level:'d'},

    // BOP
    {code:'66kV-STR',   text:'66kV Stringing only 0.455/12.72km (3.6%) — MAJOR acceleration needed',               level:'d'},
    {code:'66kV-T52',   text:'66kV T.no-52 Erection hold — Manpower not available (exp 13-May)',                    level:'w'},
    {code:'66kV-T59',   text:'66kV T.no 59-60 Stringing hold — Manpower not available',                             level:'w'},
    {code:'66kV-T01A',  text:'66kV T.no-01A Erection hold — 03/08 manpower available',                              level:'w'},
    {code:'66kV-T02',   text:'66kV T.no-02 Erection hold — Manpower (exp 12-May)',                                  level:'w'},
    {code:'66kV-T37',   text:'66kV T.no-37 — Tower location land ROW issue (open since 21-Nov-25)',                 level:'d'},
    {code:'33kV-ROW',   text:'33kV Feeder-1 (NR Infra) — 06-span stringing pending due to ROW',                     level:'w'},
    {code:'33kV-SLV',   text:'33kV Feeder-1 SPSC (SLV) — 06 pole erection hold (ROW), 20 stay concrete pending',    level:'w'},
    {code:'33kV-SS',    text:'33kV Feeder-4 (Saishreeja) — 07 pole erection hold (ROW Not Cleared)',                level:'w'},
    {code:'PSS-MCR',    text:'PSS MCR Brick Work FF 70% — 04 manpower only; 50% lintel ring reinf lagging',         level:'w'},
    {code:'PSS-PLST',   text:'PSS MCR 20 sq.m GF plastering work hold — manpower not available',                    level:'w'},
    {code:'GSS-ISOL',   text:'GSS Isolator Foundation hold — structure material + MP. Exp clear 13-May-26',         level:'w'},
  ],

  landParcels:[],
  _lastSaved: null,
};

// ════════════════════════════════════════════════════════════
//  PERSISTENCE ENGINE
//
//  Firebase Realtime Database is the ONLY source of truth.
//  All writes go through dataApi.* (data-api.js) which writes
//  leaf-by-leaf — much safer than the v8 pattern of dumping a
//  blob to /dashboard.
//
//  saveDB() / scheduleSave() are kept as legacy aliases but
//  are now defined in state-bridge.js (where they actually
//  flush touched DB slices through dataApi). The pre-v9
//  localStorage cache has been removed: there is no cache, no
//  applySnap restore from disk, no DB_KEY. Reloads always read
//  from Firebase via realtime.* listeners.
// ════════════════════════════════════════════════════════════

// loadDB() retained as a no-op so any legacy caller (loader.js)
// doesn't crash. It always returns false — i.e. "nothing was
// restored from disk", which is correct: Firebase listeners are
// the only data path.
function loadDB(){ return false; }

let _autoSaveTimer=null;
// scheduleSave is overridden by state-bridge.js. This stub exists
// only for the brief window before state-bridge.js loads; it
// silently no-ops so nothing crashes during boot.
if (typeof scheduleSave !== 'function') {
  // Using a global function declaration would shadow the bridge's
  // override, so we use a conditional assignment.
  window.scheduleSave = function(){ /* shim until state-bridge.js loads */ };
}

function addLandParcel(module,name,lat,lng,area,notes){
  DB.landParcels.push({id:'LP-'+Date.now(),module,name,lat:+lat,lng:+lng,area:+area,notes,added:new Date().toISOString().slice(0,10)});
  if(typeof scheduleSave==='function')scheduleSave();
  if(typeof mapInst!=='undefined'&&mapInst)rndrMap();
  showToast('Land parcel added: '+name,'ok');
}
function removeLandParcel(id){
  DB.landParcels=DB.landParcels.filter(p=>p.id!==id);
  if(typeof scheduleSave==='function')scheduleSave();
  if(typeof mapInst!=='undefined'&&mapInst)rndrMap();
}
function setActivityScope(module,entityId,actIdx,newScope){
  if(module==='solar'){const itc=DB.solar.itcs[entityId];if(itc&&itc.acts[actIdx])itc.acts[actIdx].subScope=newScope;}
  if(typeof scheduleSave==='function')scheduleSave();
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
  kpis:{raised:3, open:1, closed:2, avgCloseTime:'2.5 Hrs'},
  pyramid:[
    {level:'Fatality',                  color:'#b71c1c', count:0},
    {level:'Lost Time Injury',          color:'#c62828', count:0},
    {level:'Minor Injury / First Aid',  color:'#f9a825', count:0},
    {level:'Near Miss',                 color:'#ff8f00', count:1},
    {level:'Unsafe Act / Condition',    color:'#1565c0', count:2},
    {level:'No Observation',            color:'#2e7d32', count:0},
  ],
  observations:[
    {loc:'Solar ITC-1', obs:'Live 11kV/440V transmission lines near work area — not yet shifted (electrical hazard)',
     photo:'', vendor:'Solar EPC', raisedDate:'06-05-2026', raisedBy:'Site Safety Officer',
     status:'Open', closedBy:'', closedPhoto:'', avgTime:'—', risk:'Unsafe Condition',
     branch:0, day:6},
    {loc:'MBI-12', obs:'T1 working at height — third-party harness validation under technical review',
     photo:'', vendor:'HML', raisedDate:'05-05-2026', raisedBy:'Mastan Ali',
     status:'Closed', closedBy:'Laxman', closedPhoto:'', avgTime:'2 Hrs', risk:'Near Miss',
     branch:0, day:5},
    {loc:'MKD-253', obs:'Hub Preparation — work hold due to high wind conditions (above threshold)',
     photo:'', vendor:'HML', raisedDate:'11-05-2026', raisedBy:'Site Engineer',
     status:'Closed', closedBy:'Site Manager', closedPhoto:'', avgTime:'1 Hr', risk:'Unsafe Act / Condition',
     branch:0, day:11},
  ],
  locations:['MBI-12','MKD-258','MKD-253','MKD-211','MKD-52','KDK-462','BDK-85','BDK-25','AMK-264','CDP-221','MOB-403','MOB-142','BDK-165','CDP-193','BDK-183','BLK-400','Solar ITC-1','PSS','GSS','66kV EHV','33kV Wind Feeders'],
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

// Expose to window so state-bridge.js can find them via global.DB / global.HSE_DB
window.DB = DB;
window.HSE_DB = HSE_DB;

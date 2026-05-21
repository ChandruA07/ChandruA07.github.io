// ═══════════════════════════════════════════════════════════
//  SOLAR — Activity Structure (mirrors WTG pattern)
// ═══════════════════════════════════════════════════════════
// Per-ITC activity tree, three phases:
//   • pre      → Civil & Site Development Works
//   • install  → Structure & Equipment Integration Works
//   • post     → Grid Integration & Commissioning Works
//
// Stored on each ITC as:
//   d.solActs = { pre:{actKey:{subs:[...]}}, install:{...}, post:{...} }
//
// Default tree is locked (🔒). Custom activities + sub-activities are
// stored at DB.solar.customActs and shared by ALL blocks.

const SOL_STRUCTURE = {
  pre: {
    label: 'Pre-Installation',
    icon: '🏗️',
    color: 'var(--sol)',
    activities: [
      {key:'landProc',     n:'Land Procurement',         subs:['Submit Documents for SRA','Receipt of SRA Approval','Receipt of Title Search Report','Collect Documents for Legal','Receipt of Legal Clearance','ATS & GPA / ATL & GPA','Deed in Favour of Company Name','Mutation of Sale in Favour of Continuum','Final TSR in Lenders Format']},
      {key:'landSurvey',   n:'Land Survey',              subs:['Topographical survey','Boundary marking','Layout finalization']},
      {key:'soilInv',      n:'Soil Investigation',       subs:['Borehole drilling','Sample collection','Lab testing','Report preparation']},
      {key:'landDev',      n:'Land Development',         subs:['Conduct Topo & Contour Survey','Final TOPO & Contour Reports','Land Grading & Levelling','Completion of Boundary Demarcation','Conduct Soil Test','Examine Pull Out & Lateral Test','Final Soil Test Pull Out & Lateral Report']},
      {key:'siteClearing', n:'Site Clearing',            subs:['Vegetation removal','Debris clearing','Leveling']},
      {key:'earthwork',    n:'Earthwork',                subs:['Excavation','Filling','Compaction','Grading']},
      {key:'roadDev',      n:'Road Development',         subs:['Marking','Gravel laying','Compaction']},
      {key:'roadDrain',    n:'Road & Drainage Works',    subs:['Internal Road Work Completion – Main Gate to ITC','Periphery Road Works','Water Drainage System Excavation Work','Water Drainage System Concreting Work']},
      {key:'benchmark',    n:'Benchmark Identification', subs:['Verification of TBM','Finalised and Fixed the Bench Mark Location']},
      {key:'piling',       n:'Piling Work',              subs:['Marking','Pile driving','Depth verification','Cutting']},
      {key:'pileFound',    n:'Pile Foundations',         subs:['Mobilisation of Manpower & Machineries','Execution of Pile Markings','Execution of Pile Auguring','Alignment of Piles','Obtain QC Approval','Concrete Pouring','Pile Capping']},
      {key:'foundation',   n:'Foundation Work',          subs:['Excavation','PCC','Reinforcement','Shuttering','Casting']},
      {key:'invFound',     n:'Inverter Foundations',     subs:['Manpower Mobilisation for Foundation Works','Marking','Auguring Work','Steel Work for Footing','Concrete Pouring Upto GL','Column Casting Above GL','Slab Casting','Shed Installation','Excavation Work','PCC For Footing','Raft Casting','Column Casting']},
      {key:'idtFound',     n:'IDT Foundations',          subs:['Excavation','PCC For Footing','Raft Casting','Pedestal Casting','Grid Slab with Catchment Wall','Fencing Works Completion']},
      {key:'htFound',      n:'HT Panel / ICOG Foundation', subs:['Auguring of Foundations','Pouring Concrete Upto Foundation Ground Level','Column Shuttering','Pouring Concrete','Platform Fabrication Completion','Installation of Shed']},
      {key:'mcr',          n:'Main Control Room (MCR)',  subs:['Manpower Mobilisation','Marking & Excavation of Foundation','PCC For Footing','Footing Reinforcement Works','Raft Casting','Column Casting Upto GL','Plinth Beam Shuttering','Plinth Beam Reinforcement Works','Plinth Beam Concrete Pouring','Column Casting Upto Roof','Slab Casting','Brick Work','Plastering','Flooring & Tiling Work','Sanitary Fittings','Painting Works','Panels Installations & Configured','Final Completion of MCR']},
      {key:'auxFound',     n:'Auxiliary Foundation',     subs:['Marking & Excavation','PCC','Brick Work','Brick Work Plastering','Top Slab Reinforcement & Shuttering Works','Top Slab Casting']},
      {key:'oilTankFound', n:'Burnt Oil Tank Foundation',subs:['Marking & Excavation','PCC','Footing Reinforcement Work','Raft Casting','Wall Reinforcement & Shuttering Work','Wall Concrete Pouring','Slab Steel & Shuttering Work','Slab Concrete Pouring']},
      {key:'wmsFound',     n:'WMS Foundation & Installation', subs:['Marking & Auguring','Foundation Shuttering with Concrete Pouring','Installation of WMS & Accessories']},
      {key:'nifpsFound',   n:'NIFPS Foundation & Installation', subs:['Marking & Excavation','Pedestal Casting','Panel Erection','Mobilisation of OEM Team for Pipeline Installation','Completion of Pipe Line Installation','NIFPS Engineer Mobilisation','NIFPS Commissioning']},
      {key:'scbFound',     n:'SCB Foundation & Installation', subs:['Marking & Auguring','SCB Stand Installation & Concrete Pouring','SCB Installation']},
      {key:'laFound',      n:'LA Foundation & Installation',  subs:['Marking & Auguring','Concrete Pouring','LA Installation','Earthing Pits & Connectivity Completion']},
      {key:'boundary',     n:'Boundary Wall',            subs:['Manpower Mobilisation – Boundary Wall','Marking & Auguring','Column Pole Installation','Pouring Concrete','Plank Installation','Angle & Barbed Wire Fixing Completion']},
      {key:'mainGate',     n:'Main Gate Foundation',     subs:['Marking & Excavation','PCC','Footing Shuttering & Reinforcement','Footing Casting','Column Casting']},
      {key:'compDelivery', n:'Delivery of Components',   subs:['Delivery of Components to Location – MMS, Modules, Inverters, IDT, HT & Cables']},
    ]
  },
  install: {
    label: 'Installation',
    icon: '☀️',
    color: 'var(--ac)',
    activities: [
      {key:'mountStruct', n:'Mounting Structure Installation', subs:['Material shifting','Assembly','Alignment','Bolt tightening','Torque tightening','Inspection']},
      {key:'mmsInstall',  n:'MMS Installation',                subs:['Manpower Mobilisation for Structure Installation','Rafter Bracing Installation','Purline Installation']},
      {key:'modInstall',  n:'Module Installation',             subs:['Unloading','Placement','Clamping','Tightening','Cleaning']},
      {key:'stringForm',  n:'String Formation',                subs:['Interconnection','Cable laying','MC4 connection','Continuity check']},
      {key:'dcCableLay',  n:'DC Cable Laying',                 subs:['Trenching','Cable laying','Dressing','Glanding','Lugging','Termination']},
      {key:'scbInstall',  n:'SCB Installation',                subs:['Mounting','Cable termination','Labeling','Grounding']},
      {key:'invInstall',  n:'Inverter Installation',           subs:['Placement','Alignment','Fixing','DC connection','AC connection','Grounding']},
      {key:'acCableLay',  n:'AC Cable Laying',                 subs:['Trenching','Cable laying','Jointing','Termination','Backfilling']},
      {key:'earthing',    n:'Earthing',                        subs:['Earth pit creation','Electrode installation','Strip laying','Equipment grounding','Testing']},
      {key:'lightning',   n:'Lightning Protection',            subs:['Installation','Connection','Testing']},
      {key:'equipInstall',n:'Equipment Installation',          subs:['IDT Installation','Mobilisation of Machineries – Crane Hydra etc.','HT Panel / ICOG Panel Installation','ACDB SCADA UPS Installation','Inverter Installation','Aux Trafo Installation']},
      {key:'switchYard',  n:'Switch Yard – DP',                subs:['Mobilisation of DP Yard Teams','Marking & Auguring of DP Pole Installation','Pouring Concrete','Equipments & Accessories Installation','Earthing Works for Connectivity of GRID','Completion of Fencing Work','33 KV Line Completion','ABT Meter Installation & Cabling Work Completion']},
    ]
  },
  post: {
    label: 'Post-Installation',
    icon: '🔌',
    color: 'var(--ok)',
    activities: [
      {key:'dcReady',    n:'DC Cable Readiness – 400 Sqmm', subs:['Manpower & Machinery Mobilisation for DC Side','Trench Marking & Excavation','Sand Bedding','Cable Laying Work','Brick Laying & Half Backfill']},
      {key:'stringReady',n:'String Cable Readiness – 4 Sqmm', subs:['4 Sqmm Cable Laying Work','4 Sqmm Conduit Work','Ferruling & MC4 Work Completion','Cable Tagging Work – Inverter & SCB Side','Module Series Connection','VOC Check – Ready for Charging']},
      {key:'earthDC',    n:'Earthing Readiness (DC)',     subs:['Earth Pit Installation – DC','Table to Table & SCB Earthing Interconnection of Tables','Periphery Earthing for Grid Connectivity','Trench Backfilling','Table to Table Earthing Interconnection of Tables']},
      {key:'lvReady',    n:'LV Side Readiness',           subs:['Manpower Mobilisation for AC Side','Bus Duct / Cable Tray Interconnections','LV Side Cable Laying – IDT to Inverter','LV Side Lugging & Crimping Works','Control Aux & Communication Cable Laying in LV Side','Control Aux & Communication Cable Laying']},
      {key:'hvReady',    n:'HV Side Readiness',           subs:['Trench Excavation for HT Cables','Sand Bedding Work','Cable Laying – HT (HT Panel to DP Yard + HT Panel to IDT)','Brick Laying Work','OFC & Aux Control Cablings in HV Side','Conducting HI Pot & IR Test for Cables','Backfilling']},
      {key:'earthAC',    n:'Earthing Readiness (AC)',     subs:['Earth Pit Installation – AC','Equipment Body Earthing','Grid Connectivity','Conduct ERT Test','Earthing Chamber Installation','Final Nomenclature Works']},
      {key:'preComm',    n:'Pre-Commissioning',           subs:['Mobilisation of Oil Filtration Team','Oil Filtration Work','Mobilisation of Third Party Testing Team','Testing of Equipments – Inverter IDT HT DP Yard','Mobilisation of OEM Service Check','OEM Service Check Clearance for Commissioning','Test Charging of Transformer']},
      {key:'commission', n:'Commissioning',               subs:['Commissioning of Plant','CCTV Installation & Commissioning','Street Light Installation','Handover to OMS']},
    ]
  }
};

const SOL_STATUS_VALUES = ['pending','wip','done','hold','delayed'];
const SOL_STATUS_LABELS = {
  pending:'Not Started', wip:'In Progress', done:'Completed',
  hold:'On Hold',        delayed:'Delayed'
};
const SOL_STATUS_COLORS = {
  pending:'var(--t4)', wip:'var(--wn)', done:'var(--ok)',
  hold:'var(--t3)',    delayed:'var(--er)'
};
const SOL_DELAY_REASONS = ['None','ROW','Material','Weather','Manpower','Vendor','Technical','Other'];

// ─── Custom activity / sub CRUD (global, all blocks) ───────────────────────
function _solEnsureCustomActs(){
  if(!DB.solar) return null;
  if(!DB.solar.customActs) DB.solar.customActs = {pre:[], install:[], post:[], extraSubs:{}};
  ['pre','install','post'].forEach(s => {
    if(!Array.isArray(DB.solar.customActs[s])) DB.solar.customActs[s] = [];
  });
  if(!DB.solar.customActs.extraSubs || typeof DB.solar.customActs.extraSubs !== 'object'){
    DB.solar.customActs.extraSubs = {};
  }
  return DB.solar.customActs;
}

function _solSlug(s){
  return ('cust_' + String(s||'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''))
    .slice(0,40) + '_' + Math.random().toString(36).slice(2,7);
}

// Merged list of activities for a section (defaults + custom).
function solGetActivities(sectionKey){
  const def = SOL_STRUCTURE[sectionKey];
  if(!def) return [];
  const custom = _solEnsureCustomActs();
  const out = [];
  def.activities.forEach(a => {
    const extraKey = sectionKey + '.' + a.key;
    const extras = (custom && custom.extraSubs[extraKey]) || [];
    const subs = a.subs.concat(extras.map(x => x.n));
    const subsMeta = a.subs.map(n => ({n, isDefault:true}))
                  .concat(extras.map((x,i) => ({n:x.n, isDefault:false, customIdx:i})));
    out.push({key:a.key, n:a.n, subs, subsMeta, isDefault:true});
  });
  (custom[sectionKey]||[]).forEach(a => {
    const subs = (a.subs||[]).map(s => s.n);
    const subsMeta = (a.subs||[]).map((s,i) => ({n:s.n, isDefault:false, customIdx:i}));
    out.push({key:a.key, n:a.n, subs, subsMeta, isDefault:false});
  });
  return out;
}

// Initialise a single ITC's solActs tree (idempotent).
function solInitActs(itc){
  if(!itc) return;
  if(!itc.solActs) itc.solActs = {};
  _solEnsureCustomActs();
  for(const sectionKey of Object.keys(SOL_STRUCTURE)){
    if(!itc.solActs[sectionKey]) itc.solActs[sectionKey] = {};
    const acts = solGetActivities(sectionKey);
    for(const act of acts){
      if(!itc.solActs[sectionKey][act.key]){
        itc.solActs[sectionKey][act.key] = {
          subs: act.subs.map(name => ({
            n: name,
            pStart:'', pEnd:'', aStart:'', aEnd:'',
            status:'pending', responsible:'', remarks:'',
            delayReason:'None', photo:''
          }))
        };
      } else {
        const cur = itc.solActs[sectionKey][act.key].subs || [];
        const want = act.subs.length;
        if(cur.length < want){
          for(let i=cur.length;i<want;i++){
            cur.push({n:act.subs[i],pStart:'',pEnd:'',aStart:'',aEnd:'',
                     status:'pending',responsible:'',remarks:'',delayReason:'None',photo:''});
          }
          itc.solActs[sectionKey][act.key].subs = cur;
        } else if(cur.length > want){
          itc.solActs[sectionKey][act.key].subs = cur.slice(0, want);
        }
        itc.solActs[sectionKey][act.key].subs.forEach((s,i)=>{ if(act.subs[i]) s.n = act.subs[i]; });
      }
    }
    // Prune deleted custom activity slots
    const validKeys = new Set(acts.map(a => a.key));
    Object.keys(itc.solActs[sectionKey]).forEach(k => {
      if(!validKeys.has(k)) delete itc.solActs[sectionKey][k];
    });
  }
}

// Initialise every ITC in the DB
function solInitAllItcs(){
  if(!DB.solar || !DB.solar.itcs) return;
  Object.values(DB.solar.itcs).forEach(solInitActs);
}

// ─── Roll-up: sub → activity → section → ITC ──────────────────────────────
function solActPct(itc, section, actKey){
  const a = itc.solActs && itc.solActs[section] && itc.solActs[section][actKey];
  if(!a || !a.subs || !a.subs.length) return 0;
  let pts = 0;
  a.subs.forEach(s => {
    if(s.status === 'done') pts += 1;
    else if(s.status === 'wip') pts += 0.5;
  });
  return Math.round(pts / a.subs.length * 100);
}

function solSectionPct(itc, section){
  const acts = solGetActivities(section);
  if(!acts.length) return 0;
  const sum = acts.reduce((s,a) => s + solActPct(itc, section, a.key), 0);
  return Math.round(sum / acts.length);
}

function solItcActsPct(itc){
  return {
    pre:     solSectionPct(itc,'pre'),
    install: solSectionPct(itc,'install'),
    post:    solSectionPct(itc,'post')
  };
}

// ─── CRUD: add/remove custom activities & sub-activities (global) ─────────
function solAddCustomActivity(sectionKey, name, subs){
  if(!SOL_STRUCTURE[sectionKey]) return null;
  if(!name || !String(name).trim()) return null;
  const c = _solEnsureCustomActs(); if(!c) return null;
  const key = _solSlug(name);
  const cleanSubs = (Array.isArray(subs) ? subs : [])
    .map(s => String(s||'').trim()).filter(Boolean)
    .map(n => ({n}));
  c[sectionKey].push({key, n: String(name).trim(), subs: cleanSubs});
  solInitAllItcs();
  return key;
}

function solRemoveCustomActivity(sectionKey, actKey){
  const c = _solEnsureCustomActs(); if(!c) return false;
  const isDefault = SOL_STRUCTURE[sectionKey] &&
    SOL_STRUCTURE[sectionKey].activities.some(a => a.key === actKey);
  if(isDefault) return false;
  const before = c[sectionKey].length;
  c[sectionKey] = c[sectionKey].filter(a => a.key !== actKey);
  // Delete from every ITC
  if(DB.solar && DB.solar.itcs){
    Object.values(DB.solar.itcs).forEach(itc => {
      if(itc.solActs && itc.solActs[sectionKey]) delete itc.solActs[sectionKey][actKey];
    });
  }
  return c[sectionKey].length < before;
}

function solAddCustomSub(sectionKey, actKey, subName){
  if(!subName || !String(subName).trim()) return false;
  const c = _solEnsureCustomActs(); if(!c) return false;
  const isDefault = SOL_STRUCTURE[sectionKey] &&
    SOL_STRUCTURE[sectionKey].activities.some(a => a.key === actKey);
  if(isDefault){
    const key = sectionKey + '.' + actKey;
    if(!c.extraSubs[key]) c.extraSubs[key] = [];
    c.extraSubs[key].push({n: String(subName).trim()});
  } else {
    const act = (c[sectionKey]||[]).find(a => a.key === actKey);
    if(!act) return false;
    if(!Array.isArray(act.subs)) act.subs = [];
    act.subs.push({n: String(subName).trim()});
  }
  solInitAllItcs();
  return true;
}

function solRemoveCustomSub(sectionKey, actKey, mergedIndex){
  const acts = solGetActivities(sectionKey);
  const act = acts.find(a => a.key === actKey); if(!act) return false;
  const meta = act.subsMeta[mergedIndex]; if(!meta || meta.isDefault) return false;
  const c = _solEnsureCustomActs(); if(!c) return false;
  const isDefaultAct = SOL_STRUCTURE[sectionKey] &&
    SOL_STRUCTURE[sectionKey].activities.some(a => a.key === actKey);
  if(isDefaultAct){
    const key = sectionKey + '.' + actKey;
    const arr = c.extraSubs[key] || [];
    arr.splice(meta.customIdx, 1);
    c.extraSubs[key] = arr;
  } else {
    const customAct = (c[sectionKey]||[]).find(a => a.key === actKey);
    if(!customAct) return false;
    (customAct.subs||[]).splice(meta.customIdx, 1);
  }
  solInitAllItcs();
  return true;
}

// expose
window.SOL_STRUCTURE        = SOL_STRUCTURE;
window.SOL_STATUS_VALUES    = SOL_STATUS_VALUES;
window.SOL_STATUS_LABELS    = SOL_STATUS_LABELS;
window.SOL_STATUS_COLORS    = SOL_STATUS_COLORS;
window.SOL_DELAY_REASONS    = SOL_DELAY_REASONS;
window.solGetActivities     = solGetActivities;
window.solInitActs          = solInitActs;
window.solInitAllItcs       = solInitAllItcs;
window.solActPct            = solActPct;
window.solSectionPct        = solSectionPct;
window.solItcActsPct        = solItcActsPct;
window.solAddCustomActivity = solAddCustomActivity;
window.solRemoveCustomActivity = solRemoveCustomActivity;
window.solAddCustomSub      = solAddCustomSub;
window.solRemoveCustomSub   = solRemoveCustomSub;

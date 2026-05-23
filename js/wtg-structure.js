// ═══════════════════════════════════════════════════════════
//  WTG STRUCTURE — Activity Hierarchy (3 Sections)
//  Pre-Erection → Erection → Post-Erection
//  Each section: activities → sub-activities
//  Sub-activity fields: pStart, pEnd, aStart, aEnd, status,
//                       responsible, remarks, delayReason, photo
// ═══════════════════════════════════════════════════════════

// Status values for sub-activities
const WTG_STATUS_VALUES = ['pending','wip','done','hold','delayed'];
const WTG_STATUS_LABELS = {
  pending:'Pending', wip:'In Progress', done:'Completed',
  hold:'On Hold', delayed:'Delayed'
};
const WTG_STATUS_COLORS = {
  pending:'var(--t4)', wip:'var(--wn)', done:'var(--ok)',
  hold:'var(--er)', delayed:'var(--bop)'
};

// Delay reason categories
const WTG_DELAY_REASONS = ['None','ROW','Material','Weather','Manpower','Vendor','Technical','Other'];

// ─── WTG ACTIVITY STRUCTURE — full 3-section hierarchy ─────────────────────
const WTG_STRUCTURE = {
  'pre': {
    label:'Pre-Erection',
    icon:'🏗️',
    color:'var(--wtg)',
    activities: [
      {key:'soilTest',       n:'Soil Test',                 subs:['Borehole drilling','Sample collection','Lab testing','Report preparation']},
      {key:'soilTestReport', n:'Soil Test Report',          subs:['Submission','Review','Approval']},
      {key:'excavation',     n:'Excavation',                subs:['Site marking','Excavation work','Depth verification','Safety inspection']},
      {key:'pcc',            n:'PCC',                       subs:['Surface leveling','PCC pouring','Finishing','Curing']},
      {key:'anchorCage',     n:'Anchor Cage Installation',  subs:['Placement','Alignment check','Level check','Fixing']},
      {key:'reinforcement',  n:'Reinforcement',             subs:['Steel cutting','Steel bending','Rebar placement','Binding']},
      {key:'shuttering',     n:'Shuttering Work',           subs:['Formwork installation','Alignment check','Support fixing','Leak proofing']},
      {key:'casting',        n:'Casting',                   subs:['Concrete pouring','Vibration','Level finishing','Initial curing']},
      {key:'cubeTest',       n:'Cube Test Report',          subs:['Cube sample preparation','7-day testing','28-day testing','Result verification']},
      {key:'backfilling',    n:'Backfilling',               subs:['Soil filling','Compaction','Leveling']},
      {key:'cranePad',       n:'Crane Pad Area Development',subs:['Area leveling','Soil compaction','Stone spreading','Final readiness']},
    ]
  },
  'erection': {
    label:'Erection',
    icon:'⚙️',
    color:'var(--ac)',
    activities: [
      {key:'craneAssy',  n:'Crane Assembly',     subs:['Crane mobilization','Base setup','Boom assembly','Counterweight installation','Load testing','Safety approval']},
      {key:'cabinMarch', n:'Cabin Marching',     subs:['Pathway inspection','Obstruction clearance','Ground leveling','Movement','Positioning']},
      {key:'t1',         n:'T1 Erection',        subs:['Alignment','Bolt insertion','Initial tightening','Torque tightening','Flange inspection','Internal platform fixing','Cable provision','Grounding']},
      {key:'t2',         n:'T2 Erection',        subs:['Alignment','Bolt insertion','Initial tightening','Torque tightening','Ladder fixing','Cable tray fixing','Grounding check']},
      {key:'t3',         n:'T3 Erection',        subs:['Alignment','Bolt insertion','Torque tightening','Aviation light provision','Cable routing','Platform fixing','Earthing']},
      {key:'t4',         n:'T4 Erection',        subs:['Alignment','Bolt insertion','Torque tightening','Cable tray fixing','Ladder fixing','Inspection','Grounding']},
      {key:'t5',         n:'T5 Erection',        subs:['Alignment','Bolt insertion','Torque tightening','Nacelle interface preparation','Inspection','Grounding verification']},
      {key:'nacelle',    n:'Nacelle Installation',subs:['Lifting','Positioning','Yaw alignment','Bolt tightening','High torque tightening','Power cable connection','Control cable connection','Hydraulic connection','Grounding']},
      {key:'hub',        n:'Hub Installation',   subs:['Lifting','Mounting','Bolt tightening','Torque tightening','Pitch system connection','Cable connection','Lubrication','Grounding']},
      {key:'blade',      n:'Blade Installation', subs:['Blade lifting','Positioning','Bolt tightening','Torque tightening','Pitch alignment','Safety locking']},
      {key:'rotorUp',    n:'Rotor Up Completion',subs:['Rotor lifting','Mounting','Alignment','Bolt tightening','Final torque verification','Clearance check','Safety inspection']},
    ]
  },
  'post': {
    label:'Post-Erection',
    icon:'⚡',
    color:'var(--ok)',
    activities: [
      {key:'intElec',  n:'Internal Electrical',          subs:['Cable laying — loop','Cable laying — control','Cable laying — auxiliary','Cable routing T1-T5','Cable dressing','Glanding','Lugging','Crimping','Sleeve heating','Continuity test','IR test']},
      {key:'wtgEquip', n:'WTG Equipment',                subs:['Converter panel installation','Control panel installation','PCH box fixing','Junction box mounting','Wiring','Terminal tightening','Labeling','Grounding']},
      {key:'earthing', n:'Earthing',                     subs:['Earth pit excavation','Electrode installation','Charcoal and salt filling','Earthing strip laying','Connection','Continuity test','Earth resistance test']},
      {key:'extCable', n:'External Cable',               subs:['Trenching','Sand bedding','Cable laying','Jointing','Termination','Route marking','Backfilling']},
      {key:'ussCivil', n:'USS Civil Works',              subs:['Site clearing','Leveling','Excavation','PCC','Reinforcement','Shuttering','Foundation casting','Anchor bolt fixing','Cube testing','Backfilling','Cable trench work','Plinth construction','Oil pit construction','Drainage system','Fencing','Final readiness']},
      {key:'ussEquip', n:'USS Equipment',                subs:['Transformer installation','RMU installation','HT panel installation','Alignment','Bolt tightening','Grounding','Cable termination','Oil filling','Testing']},
      {key:'sys33kv',  n:'33kV System',                  subs:['Line/cable work','Structure erection','Conductor stringing','Breaker installation','Isolator installation','Termination','Relay wiring','Protection setup']},
      {key:'testing',  n:'Testing & Pre-Commissioning',  subs:['IR test','Continuity test','Transformer testing','Panel testing','Relay testing','SCADA communication']},
      {key:'commiss',  n:'Commissioning',                subs:['Trial run','Synchronization','Load test','Output verification','Final approval']},
      {key:'qcAudit',  n:'QC & Audit',                   subs:['Internal QC audit','Customer audit','Punch point identification','Punch closure']},
      {key:'docs',     n:'Documentation',                subs:['Test reports','As-built drawings','Commissioning reports','Handover']},
    ]
  }
};

// ─── ZERO POINT (Store Yard) materials — WTG only ─────────────────────────
const ZERO_POINT_MATERIALS_TAGGED = [
  {name:'Tower Set',                        module:'wtg'},
  {name:'Blade Set',                        module:'wtg'},
  {name:'Nacelle',                          module:'wtg'},
  {name:'Hub',                              module:'wtg'},
  {name:'Converter',                        module:'wtg'},
  {name:'Service Lift',                     module:'wtg'},
  {name:'Cable Drum',                       module:'wtg'},
  {name:'Tower Hardware',                   module:'wtg'},
  {name:'Tower Rack (L1 Module)',           module:'wtg'},
  {name:'WTG Transformer',                  module:'wtg'},
  {name:'Anchor Cage Set',                  module:'wtg'},
  {name:'Steel RFM Tower Staircase Shaft',  module:'wtg'},
  {name:'SCADA Panel',                      module:'wtg'},
  {name:'LIU Cabinet',                      module:'wtg'},
];

// Legacy flat list (used by callers that don't need module tagging)
const ZERO_POINT_MATERIALS = ZERO_POINT_MATERIALS_TAGGED.map(m => m.name);

// Sub-tracking checklist for each material (arrival → readiness)
const ZP_MATERIAL_STAGES = [
  'arrival','unloading','inspection','mddc','approval','storage','readiness'
];
const ZP_MATERIAL_STAGE_LABELS = {
  arrival:'Material Arrival',
  unloading:'Unloading',
  inspection:'Inspection',
  mddc:'MDDC Check',
  approval:'Approval',
  storage:'Storage Location',
  readiness:'Readiness Status'
};
const ZP_MDDC_STATUSES = ['Pending','Received','Inspected','Approved','Rejected'];

// ─── LP / PP Pathway tracking ─────────────────────────────────────────────
// Each turbine carries t.pathways = {
//   lp: { stages:[{key,n,done,date,remarks}], targetDate, responsible, remarks },
//   pp: { ... }
// }
// LP = Logistic Pathway (temporary access road for component transport)
// PP = Permanent Pathway (final permanent access road)
const WTG_LP_STAGES = [
  {key:'survey',     n:'Route Survey & Marking'},
  {key:'row',        n:'ROW / Land Clearance'},
  {key:'earthwork',  n:'Earthwork & Cutting'},
  {key:'grading',    n:'Grading & Levelling'},
  {key:'gravel',     n:'Gravel / Murrum Laying'},
  {key:'compaction', n:'Compaction'},
  {key:'culvert',    n:'Culverts / Cross-Drainage'},
  {key:'loadtest',   n:'Load Trial (Trailer Movement)'},
  {key:'handover',   n:'Pathway Ready for Logistics'},
];
const WTG_PP_STAGES = [
  {key:'survey',     n:'Final Alignment Survey'},
  {key:'subgrade',   n:'Sub-grade Preparation'},
  {key:'gsb',        n:'Granular Sub-Base (GSB)'},
  {key:'wmm',        n:'Wet Mix Macadam (WMM)'},
  {key:'culvert',    n:'Permanent Culverts & Drains'},
  {key:'edge',       n:'Edge Protection / Shoulders'},
  {key:'surfacing',  n:'Surfacing / Black-topping'},
  {key:'qc',         n:'QC Inspection & Punch Closure'},
  {key:'handover',   n:'Permanent Pathway Handover'},
];

function _makePathwayStages(defs){
  return defs.map(d => ({key:d.key, n:d.n, done:false, date:'', remarks:''}));
}

// Idempotently ensure a turbine has the detailed pathway structure.
// Back-fills from the legacy boolean t.lp / t.pp (a true boolean → all stages done).
function wtgInitPathways(t){
  if(!t) return;
  if(!t.pathways) t.pathways = {};
  ['lp','pp'].forEach(which => {
    const defs = which === 'lp' ? WTG_LP_STAGES : WTG_PP_STAGES;
    if(!t.pathways[which]){
      t.pathways[which] = {
        stages: _makePathwayStages(defs),
        targetDate: '',
        responsible: '',
        remarks: ''
      };
      // Seed from the legacy boolean
      if((which === 'lp' && t.lp) || (which === 'pp' && t.pp)){
        t.pathways[which].stages.forEach(s => { s.done = true; });
      }
    } else {
      // heal: make sure all defined stages exist & in order
      const cur = t.pathways[which].stages || [];
      const byKey = {};
      cur.forEach(s => { byKey[s.key] = s; });
      t.pathways[which].stages = defs.map(d =>
        byKey[d.key] || {key:d.key, n:d.n, done:false, date:'', remarks:''}
      );
      // keep names current
      t.pathways[which].stages.forEach((s,i)=>{ s.n = defs[i].n; });
      if(typeof t.pathways[which].targetDate  !== 'string') t.pathways[which].targetDate  = '';
      if(typeof t.pathways[which].responsible !== 'string') t.pathways[which].responsible = '';
      if(typeof t.pathways[which].remarks     !== 'string') t.pathways[which].remarks     = '';
    }
  });
}

// % complete for one pathway
function wtgPathwayPct(t, which){
  const pw = t.pathways && t.pathways[which];
  if(!pw || !pw.stages || !pw.stages.length) return 0;
  const done = pw.stages.filter(s => s.done).length;
  return Math.round(done / pw.stages.length * 100);
}

// Roll the detailed pathway state back into the legacy boolean so the
// fleet KPIs (which count t.lp / t.pp) stay accurate.
function wtgSyncPathwayLegacy(t){
  if(!t || !t.pathways) return;
  t.lp = wtgPathwayPct(t,'lp') >= 100;
  t.pp = wtgPathwayPct(t,'pp') >= 100;
}

// ─── Global custom activities & sub-activities ────────────────────────────
// Custom additions are stored at DB.wtg.customActs and shared by ALL turbines:
//   DB.wtg.customActs = {
//     pre: [{key, n, subs:[{n}, ...]}],      // user-added activities
//     erection: [...],
//     post: [...],
//     extraSubs: {                            // user-added sub-activities for default acts
//       'pre.soilTest': [{n:'New sub-name'}, ...],
//       ...
//     }
//   }
function _ensureCustomActs(){
  if(!DB.wtg) return null;
  if(!DB.wtg.customActs) DB.wtg.customActs = {pre:[], erection:[], post:[], extraSubs:{}};
  ['pre','erection','post'].forEach(s => {
    if(!Array.isArray(DB.wtg.customActs[s])) DB.wtg.customActs[s] = [];
  });
  if(!DB.wtg.customActs.extraSubs || typeof DB.wtg.customActs.extraSubs !== 'object'){
    DB.wtg.customActs.extraSubs = {};
  }
  return DB.wtg.customActs;
}

// Return the merged activity list for a section, with .isDefault and .isCustom flags.
// Each activity also exposes .subs as a flat array of sub-names AND .subsMeta
// which marks each sub as default or custom for the lock UI.
function wtgGetActivities(sectionKey){
  const def = WTG_STRUCTURE[sectionKey];
  if(!def) return [];
  const custom = _ensureCustomActs();
  const out = [];
  // Defaults first (locked)
  def.activities.forEach(a => {
    const extraKey = sectionKey + '.' + a.key;
    const extras = (custom && custom.extraSubs[extraKey]) || [];
    const subs = a.subs.concat(extras.map(x => x.n));
    const subsMeta = a.subs.map(n => ({n, isDefault:true}))
                  .concat(extras.map((x,i) => ({n:x.n, isDefault:false, customIdx:i})));
    out.push({key:a.key, n:a.n, subs, subsMeta, isDefault:true});
  });
  // Custom activities (deletable)
  (custom[sectionKey]||[]).forEach(a => {
    const subs = (a.subs||[]).map(s => s.n);
    const subsMeta = (a.subs||[]).map((s,i) => ({n:s.n, isDefault:false, customIdx:i}));
    out.push({key:a.key, n:a.n, subs, subsMeta, isDefault:false});
  });
  return out;
}

// ─── Initialize per-turbine activity tree (idempotent — preserves existing data) ──
// Stored on turbine as t.acts = { pre:{soilTest:{subs:[...],...}, ...}, erection:{...}, post:{...} }
function wtgInitActs(t){
  if(!t) return;
  if(!t.acts) t.acts = {};
  _ensureCustomActs();
  for(const sectionKey of Object.keys(WTG_STRUCTURE)){
    if(!t.acts[sectionKey]) t.acts[sectionKey] = {};
    const acts = wtgGetActivities(sectionKey);
    for(const act of acts){
      if(!t.acts[sectionKey][act.key]){
        t.acts[sectionKey][act.key] = {
          subs: act.subs.map(name => ({
            n: name,
            pStart:'', pEnd:'', aStart:'', aEnd:'',
            status:'pending', responsible:'', remarks:'',
            delayReason:'None', photo:''
          }))
        };
      } else {
        // Make sure sub count matches definition (handle re-deploys + custom additions)
        const cur = t.acts[sectionKey][act.key].subs || [];
        const want = act.subs.length;
        if(cur.length < want){
          for(let i=cur.length;i<want;i++){
            cur.push({n:act.subs[i],pStart:'',pEnd:'',aStart:'',aEnd:'',
                     status:'pending',responsible:'',remarks:'',delayReason:'None',photo:''});
          }
          t.acts[sectionKey][act.key].subs = cur;
        } else if(cur.length > want){
          // Trim if a sub was deleted by an admin
          t.acts[sectionKey][act.key].subs = cur.slice(0, want);
        }
        // ensure names match (definition is authoritative)
        t.acts[sectionKey][act.key].subs.forEach((s,i)=>{ if(act.subs[i]) s.n = act.subs[i]; });
      }
    }
    // Prune turbine acts for activities that no longer exist (deleted custom)
    const validKeys = new Set(acts.map(a => a.key));
    Object.keys(t.acts[sectionKey]).forEach(k => {
      if(!validKeys.has(k)) delete t.acts[sectionKey][k];
    });
  }
  // Seed from legacy progress so existing data is reflected in the new tree (one-time).
  if(!t._actsSeeded){
    wtgSeedActsFromLegacy(t);
    t._actsSeeded = true;
  }
}

// One-shot legacy → new-structure seed.
// civil[] (5)   → pre.excavation, pre.pcc, pre.anchorCage, pre.reinforcement, pre.casting
// mech[] (4)    → erection.t1 (rolled over T1-T5 as tower group), erection.nacelle, erection.hub, erection.blade
// uss           → post.ussCivil + post.ussEquip
// sup           → erection.crane mob hint + post.wtgEquip
// lp, pp        → not in activity tree (kept at turbine level)
function wtgSeedActsFromLegacy(t){
  const civilMap = ['excavation','pcc','anchorCage','reinforcement','casting'];
  if(Array.isArray(t.civil)){
    t.civil.forEach((pct,i)=>{
      const k = civilMap[i]; if(!k) return;
      _seedActFromPct(t,'pre',k,pct);
    });
  }
  // Tower (T1-T5): driven by mech[0]
  if(Array.isArray(t.mech)){
    const towerPct = t.mech[0]||0;
    ['t1','t2','t3','t4','t5'].forEach(k=>_seedActFromPct(t,'erection',k,towerPct));
    _seedActFromPct(t,'erection','nacelle', t.mech[1]||0);
    _seedActFromPct(t,'erection','hub',     t.mech[2]||0);
    _seedActFromPct(t,'erection','blade',   t.mech[3]||0);
    // Rotor-up: derived as min of nacelle/hub/blade
    const rotorPct = Math.min(t.mech[1]||0, t.mech[2]||0, t.mech[3]||0);
    _seedActFromPct(t,'erection','rotorUp', rotorPct);
  }
  _seedActFromPct(t,'post','ussCivil', t.uss||0);
  _seedActFromPct(t,'post','ussEquip', t.uss||0);
  _seedActFromPct(t,'post','wtgEquip', t.sup||0);
}

function _seedActFromPct(t, section, actKey, pct){
  const act = t.acts[section] && t.acts[section][actKey];
  if(!act || !act.subs || !act.subs.length) return;
  if(pct >= 100){
    act.subs.forEach(s => { s.status='done'; });
  } else if(pct > 0){
    // Mark proportional subs as done, last in-progress
    const n = act.subs.length;
    const doneCount = Math.floor(pct/100*n);
    act.subs.forEach((s,i)=>{
      if(i < doneCount) s.status='done';
      else if(i === doneCount) s.status='wip';
      else s.status='pending';
    });
  }
}

// ─── Roll-up helpers: sub → act → section → turbine → fleet ──────────────
function wtgActPct(t, section, actKey){
  const act = t.acts && t.acts[section] && t.acts[section][actKey];
  if(!act || !act.subs || !act.subs.length) return 0;
  const total = act.subs.length;
  let pts = 0;
  act.subs.forEach(s=>{
    if(s.status==='done') pts += 1;
    else if(s.status==='wip') pts += 0.5;
  });
  return Math.round(pts/total*100);
}

function wtgSectionPct(t, section){
  const acts = wtgGetActivities(section);
  if(!acts.length) return 0;
  const sum = acts.reduce((s,a)=>s + wtgActPct(t, section, a.key), 0);
  return Math.round(sum/acts.length);
}

// Returns {overall, pre, erection, post}
function wtgTurbActsPct(t){
  return {
    pre:      wtgSectionPct(t,'pre'),
    erection: wtgSectionPct(t,'erection'),
    post:     wtgSectionPct(t,'post'),
  };
}

// Roll new-structure progress back into legacy fields so existing
// dashboards (home, charts, calc.js, etc.) keep working.
function wtgRollupToLegacy(t){
  // Civil legacy: 5 activities under pre
  const civilMap = ['excavation','pcc','anchorCage','reinforcement','casting'];
  t.civil = civilMap.map(k => wtgActPct(t,'pre',k));
  // Mech legacy: 4 activities under erection (Tower = min of T1-T5, then nacelle/hub/blade)
  const towerPct = Math.min(
    wtgActPct(t,'erection','t1'), wtgActPct(t,'erection','t2'),
    wtgActPct(t,'erection','t3'), wtgActPct(t,'erection','t4'),
    wtgActPct(t,'erection','t5'));
  t.mech = [
    towerPct,
    wtgActPct(t,'erection','nacelle'),
    wtgActPct(t,'erection','hub'),
    wtgActPct(t,'erection','blade')
  ];
  // USS legacy: avg of ussCivil + ussEquip
  t.uss = Math.round((wtgActPct(t,'post','ussCivil') + wtgActPct(t,'post','ussEquip'))/2);
  // Supply legacy: wtgEquip (proxy)
  t.sup = wtgActPct(t,'post','wtgEquip');
}

// ─── Custom activity / sub CRUD (global, affects all turbines) ────────────
function _slug(s){
  return ('cust_' + String(s||'').toLowerCase()
    .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,''))
    .slice(0,40) + '_' + Math.random().toString(36).slice(2,7);
}

// Add a new ACTIVITY to a section (global)
// returns the generated key on success, or null on failure
function wtgAddCustomActivity(sectionKey, name, subs){
  if(!WTG_STRUCTURE[sectionKey]) return null;
  if(!name || !String(name).trim()) return null;
  const c = _ensureCustomActs(); if(!c) return null;
  const key = _slug(name);
  const cleanSubs = (Array.isArray(subs) ? subs : [])
    .map(s => String(s||'').trim()).filter(Boolean)
    .map(n => ({n}));
  c[sectionKey].push({key, n: String(name).trim(), subs: cleanSubs});
  // Initialise the new activity slot on every turbine
  (DB.wtg.turbines||[]).forEach(t => wtgInitActs(t));
  return key;
}

// Remove a custom activity (only allowed if not default)
function wtgRemoveCustomActivity(sectionKey, actKey){
  const c = _ensureCustomActs(); if(!c) return false;
  // Block if this key belongs to a default activity
  const isDefault = WTG_STRUCTURE[sectionKey] &&
    WTG_STRUCTURE[sectionKey].activities.some(a => a.key === actKey);
  if(isDefault) return false;
  const before = c[sectionKey].length;
  c[sectionKey] = c[sectionKey].filter(a => a.key !== actKey);
  // Also delete any sub-activity data on turbines for this key
  (DB.wtg.turbines||[]).forEach(t => {
    if(t.acts && t.acts[sectionKey]) delete t.acts[sectionKey][actKey];
  });
  return c[sectionKey].length < before;
}

// Add a sub-activity to ANY activity (default or custom). New subs are always custom.
function wtgAddCustomSub(sectionKey, actKey, subName){
  if(!subName || !String(subName).trim()) return false;
  const c = _ensureCustomActs(); if(!c) return false;
  const isDefault = WTG_STRUCTURE[sectionKey] &&
    WTG_STRUCTURE[sectionKey].activities.some(a => a.key === actKey);
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
  // Reflect on every turbine
  (DB.wtg.turbines||[]).forEach(t => wtgInitActs(t));
  return true;
}

// Remove a custom sub-activity (default subs are locked)
// subIndex is the index in the MERGED list returned by wtgGetActivities
function wtgRemoveCustomSub(sectionKey, actKey, mergedIndex){
  const acts = wtgGetActivities(sectionKey);
  const act = acts.find(a => a.key === actKey); if(!act) return false;
  const meta = act.subsMeta[mergedIndex]; if(!meta || meta.isDefault) return false;
  const c = _ensureCustomActs(); if(!c) return false;
  const isDefaultAct = WTG_STRUCTURE[sectionKey] &&
    WTG_STRUCTURE[sectionKey].activities.some(a => a.key === actKey);
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
  // Reflect on every turbine (this trims the deleted index out of t.acts subs)
  (DB.wtg.turbines||[]).forEach(t => wtgInitActs(t));
  return true;
}

// ─── Initialize Zero Point store yard data ────────────────────────────────
// New material shape:
//   { name, module, totalQty,
//     units: [
//       { unitNo, deliveryDate, mddcStatus, storageLocation, assignedSite,
//         stages: { arrival:{done,date,remarks}, ... } },
//       ...
//     ] }
function _makeStages(){
  const out = {};
  ZP_MATERIAL_STAGES.forEach(s => {
    out[s] = {done:false, date:'', remarks:''};
  });
  return out;
}

function _makeUnit(unitNo){
  return {
    unitNo: unitNo,
    deliveryDate: '',
    mddcStatus: 'Pending',
    storageLocation: 'Zero Point Yard',
    assignedSite: 'Unassigned',
    stages: _makeStages()
  };
}

function _defaultTotalQty(name, module){
  // All materials default to # of turbines (one per WTG location)
  const nTurb = (DB && DB.wtg && Array.isArray(DB.wtg.turbines)) ? DB.wtg.turbines.length : 26;
  return nTurb;
}

// Build a fresh material with N units pre-allocated.
function _buildMaterial(entry){
  const qty = _defaultTotalQty(entry.name, entry.module);
  const units = [];
  for(let i = 1; i <= qty; i++) units.push(_makeUnit(i));
  return {
    name: entry.name,
    module: entry.module,
    totalQty: qty,
    units: units
  };
}

// One-time migration: convert old single-record material to the new units[] shape.
// Preserves whatever was tracked previously by writing it into Unit #1.
function _migrateMaterialToUnits(m){
  if(Array.isArray(m.units) && m.units.length > 0) return; // already migrated
  const qty = m.totalQty || _defaultTotalQty(m.name, m.module);
  const units = [];
  for(let i = 1; i <= qty; i++){
    if(i === 1){
      units.push({
        unitNo: 1,
        deliveryDate:    m.deliveryDate    || '',
        mddcStatus:      m.mddcStatus      || 'Pending',
        storageLocation: m.storageLocation || 'Zero Point Yard',
        assignedSite:    m.assignedTurbine || 'Unassigned',
        stages:          m.stages          || _makeStages()
      });
    } else {
      units.push(_makeUnit(i));
    }
  }
  m.units = units;
  // Drop legacy single-record fields so the data shape stays clean
  delete m.deliveryDate;
  delete m.mddcStatus;
  delete m.storageLocation;
  delete m.assignedTurbine;
  delete m.receivedQty;
  delete m.stages;
}

function zeroPointInit(){
  if(!DB.wtg) return;
  // Authoritative set of allowed material names (WTG only)
  const allowed = new Set(ZERO_POINT_MATERIALS_TAGGED.map(m => m.name));

  if(!DB.wtg.zeroPoint){
    DB.wtg.zeroPoint = {
      materials: ZERO_POINT_MATERIALS_TAGGED.map(_buildMaterial),
      mobilizations: []  // {id, material, unitNo, source, destination, destType:'wtg', status, date}
    };
    return;
  }

  // ── Prune any non-WTG materials that may have been added in earlier builds ──
  if(Array.isArray(DB.wtg.zeroPoint.materials)){
    DB.wtg.zeroPoint.materials = DB.wtg.zeroPoint.materials.filter(m => allowed.has(m.name));
  } else {
    DB.wtg.zeroPoint.materials = [];
  }

  // Backfill any missing materials (idempotent on re-deploy)
  const have = DB.wtg.zeroPoint.materials.map(m => m.name);
  ZERO_POINT_MATERIALS_TAGGED.forEach(entry => {
    if(!have.includes(entry.name)){
      DB.wtg.zeroPoint.materials.push(_buildMaterial(entry));
    }
  });

  // ── Migrate / heal every material to per-unit shape ──
  DB.wtg.zeroPoint.materials.forEach(m => {
    // tag module if missing
    if(typeof m.module === 'undefined'){
      const tag = ZERO_POINT_MATERIALS_TAGGED.find(x => x.name === m.name);
      m.module = tag ? tag.module : 'wtg';
    }
    // totalQty
    if(typeof m.totalQty === 'undefined' || m.totalQty <= 0){
      m.totalQty = _defaultTotalQty(m.name, m.module);
    }
    // legacy → units
    if(!Array.isArray(m.units) || m.units.length === 0){
      _migrateMaterialToUnits(m);
    }
    // grow/shrink units array to match totalQty
    while(m.units.length < m.totalQty){
      m.units.push(_makeUnit(m.units.length + 1));
    }
    if(m.units.length > m.totalQty) m.units.length = m.totalQty;
    // heal each unit (missing stages, etc.)
    m.units.forEach((u, i) => {
      if(!u.unitNo) u.unitNo = i + 1;
      if(typeof u.deliveryDate    !== 'string') u.deliveryDate    = '';
      if(typeof u.mddcStatus      !== 'string') u.mddcStatus      = 'Pending';
      if(typeof u.storageLocation !== 'string') u.storageLocation = 'Zero Point Yard';
      if(typeof u.assignedSite    !== 'string') u.assignedSite    = 'Unassigned';
      if(!u.stages || typeof u.stages !== 'object') u.stages = _makeStages();
      ZP_MATERIAL_STAGES.forEach(s => {
        if(!u.stages[s]) u.stages[s] = {done:false, date:'', remarks:''};
      });
    });
  });

  // Mobilization log clean-up
  if(!Array.isArray(DB.wtg.zeroPoint.mobilizations)) DB.wtg.zeroPoint.mobilizations = [];
  DB.wtg.zeroPoint.mobilizations = DB.wtg.zeroPoint.mobilizations.filter(mob =>
    !mob.destType || mob.destType === 'wtg'
  );
  DB.wtg.zeroPoint.mobilizations.forEach(mob => {
    mob.destType = 'wtg';
    if(typeof mob.qty !== 'number') mob.qty = 1;
  });
}

// Helpers used by render/UI code
function zpInStore(material){
  // In Store = totalQty − mobilizations of this material that haven't been returned
  if(!material) return 0;
  const out = (DB.wtg.zeroPoint.mobilizations||[])
    .filter(mob => mob.material === material.name && mob.status !== 'returned')
    .reduce((s, mob) => s + (mob.qty || 1), 0);
  return Math.max(0, (material.totalQty || 0) - out);
}

function zpUnitStagePct(unit){
  if(!unit || !unit.stages) return 0;
  const total = ZP_MATERIAL_STAGES.length;
  const done = ZP_MATERIAL_STAGES.filter(s => unit.stages[s] && unit.stages[s].done).length;
  return Math.round(done / total * 100);
}

// expose
window.WTG_STRUCTURE = WTG_STRUCTURE;
window.WTG_STATUS_VALUES = WTG_STATUS_VALUES;
window.WTG_STATUS_LABELS = WTG_STATUS_LABELS;
window.WTG_STATUS_COLORS = WTG_STATUS_COLORS;
window.WTG_DELAY_REASONS = WTG_DELAY_REASONS;
window.ZERO_POINT_MATERIALS = ZERO_POINT_MATERIALS;
window.ZERO_POINT_MATERIALS_TAGGED = ZERO_POINT_MATERIALS_TAGGED;
window.ZP_MATERIAL_STAGES = ZP_MATERIAL_STAGES;
window.ZP_MATERIAL_STAGE_LABELS = ZP_MATERIAL_STAGE_LABELS;
window.ZP_MDDC_STATUSES = ZP_MDDC_STATUSES;
window.wtgInitActs = wtgInitActs;
window.wtgActPct = wtgActPct;
window.wtgSectionPct = wtgSectionPct;
window.wtgTurbActsPct = wtgTurbActsPct;
window.wtgRollupToLegacy = wtgRollupToLegacy;
window.wtgGetActivities = wtgGetActivities;
window.wtgAddCustomActivity = wtgAddCustomActivity;
window.wtgRemoveCustomActivity = wtgRemoveCustomActivity;
window.wtgAddCustomSub = wtgAddCustomSub;
window.wtgRemoveCustomSub = wtgRemoveCustomSub;
window.zeroPointInit = zeroPointInit;
window.zpInStore = zpInStore;
window.WTG_LP_STAGES = WTG_LP_STAGES;
window.WTG_PP_STAGES = WTG_PP_STAGES;
window.wtgInitPathways = wtgInitPathways;
window.wtgPathwayPct = wtgPathwayPct;
window.wtgSyncPathwayLegacy = wtgSyncPathwayLegacy;
window.zpUnitStagePct = zpUnitStagePct;

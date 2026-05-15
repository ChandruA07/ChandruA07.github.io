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
      {key:'rowIssue',       n:'ROW Issue',                 subs:['Issue identification','Remarks entry','Delay tagging','Closure tracking'], dynamic:true},
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

// ─── ZERO POINT (Store Yard) materials ─────────────────────────────────────
const ZERO_POINT_MATERIALS = [
  'Tower Set','Blade Set','Nacelle','Hub','Converter','Service Lift',
  'Cable Drum','Tower Hardware','Tower Rack (L1 Module)','WTG Transformer',
  'Anchor Cage Set','Steel RFM Tower Staircase Shaft','SCADA Panel','LIU Cabinet'
];

// ─── Initialize per-turbine activity tree (idempotent — preserves existing data) ──
// Stored on turbine as t.acts = { pre:{soilTest:{subs:[...],...}, ...}, erection:{...}, post:{...} }
function wtgInitActs(t){
  if(!t) return;
  if(!t.acts) t.acts = {};
  for(const sectionKey of Object.keys(WTG_STRUCTURE)){
    if(!t.acts[sectionKey]) t.acts[sectionKey] = {};
    for(const act of WTG_STRUCTURE[sectionKey].activities){
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
        // Make sure sub count matches definition (handle re-deploys gracefully)
        const cur = t.acts[sectionKey][act.key].subs || [];
        const want = act.subs.length;
        if(cur.length < want){
          for(let i=cur.length;i<want;i++){
            cur.push({n:act.subs[i],pStart:'',pEnd:'',aStart:'',aEnd:'',
                     status:'pending',responsible:'',remarks:'',delayReason:'None',photo:''});
          }
          t.acts[sectionKey][act.key].subs = cur;
        }
        // ensure names match (definition is authoritative)
        cur.forEach((s,i)=>{ if(act.subs[i]) s.n = act.subs[i]; });
      }
    }
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
  const acts = WTG_STRUCTURE[section].activities;
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

// ─── Initialize Zero Point store yard data ────────────────────────────────
function zeroPointInit(){
  if(!DB.wtg) return;
  if(!DB.wtg.zeroPoint){
    DB.wtg.zeroPoint = {
      materials: ZERO_POINT_MATERIALS.map(m => ({
        name: m,
        deliveryDate: '',
        storageLocation: 'Zero Point Yard',
        mddcStatus: 'Pending',
        assignedTurbine: ''
      })),
      mobilizations: []  // {id, material, source, destination, status, date}
    };
  } else {
    // Backfill any missing materials (idempotent on re-deploy)
    const haveNames = (DB.wtg.zeroPoint.materials||[]).map(m=>m.name);
    ZERO_POINT_MATERIALS.forEach(name=>{
      if(!haveNames.includes(name)){
        DB.wtg.zeroPoint.materials.push({
          name, deliveryDate:'', storageLocation:'Zero Point Yard',
          mddcStatus:'Pending', assignedTurbine:''
        });
      }
    });
    if(!Array.isArray(DB.wtg.zeroPoint.mobilizations)) DB.wtg.zeroPoint.mobilizations = [];
  }
}

// expose
window.WTG_STRUCTURE = WTG_STRUCTURE;
window.WTG_STATUS_VALUES = WTG_STATUS_VALUES;
window.WTG_STATUS_LABELS = WTG_STATUS_LABELS;
window.WTG_STATUS_COLORS = WTG_STATUS_COLORS;
window.WTG_DELAY_REASONS = WTG_DELAY_REASONS;
window.ZERO_POINT_MATERIALS = ZERO_POINT_MATERIALS;
window.wtgInitActs = wtgInitActs;
window.wtgActPct = wtgActPct;
window.wtgSectionPct = wtgSectionPct;
window.wtgTurbActsPct = wtgTurbActsPct;
window.wtgRollupToLegacy = wtgRollupToLegacy;
window.zeroPointInit = zeroPointInit;

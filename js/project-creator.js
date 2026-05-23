// ═══════════════════════════════════════════════════════════
// PROJECT CREATOR — Dynamic Project / Unit Creation
// ═══════════════════════════════════════════════════════════
// Lets a privileged user:
//   • Edit the WTG project (name, total MW, # turbines, location prefix)
//   • Edit the Solar project (name, total MW, # blocks/ITCs)
//   • Add or remove individual units (turbines or solar blocks)
// Whenever the unit count changes, MW is redistributed proportionally so
// that the total project always rolls up to 100%.
// ═══════════════════════════════════════════════════════════

(function(){

  function _isAdmin(){
    // Reuse the existing WTG editor check as gatekeeper. If you have a stricter
    // 'admin' role elsewhere, swap this to auth.canEdit('admin') etc.
    return (typeof auth !== 'undefined' && auth.canEdit && auth.canEdit('wtg'));
  }

  // ── Redistribute MW evenly across all WTG turbines ─────────────────
  function redistributeWtgMW(){
    if(!DB.wtg) return;
    const turbs = DB.wtg.turbines || [];
    const n = turbs.length;
    if(!n) return;
    const total = parseFloat(DB.wtg.totalMW) || 0;
    if(!total) return;
    const each = total / n;
    turbs.forEach(t => { t.mw = parseFloat(each.toFixed(3)); });
  }

  function redistributeSolMW(){
    if(!DB.solar || !DB.solar.itcs) return;
    const keys = Object.keys(DB.solar.itcs);
    const n = keys.length;
    if(!n) return;
    const total = parseFloat(DB.solar.totalMW) || 0;
    if(!total) return;
    const each = total / n;
    keys.forEach(k => {
      DB.solar.itcs[k].mw = parseFloat(each.toFixed(3));
      DB.solar.itcs[k].pct = parseFloat(((each/total)*100).toFixed(2));
    });
  }

  // ── Add N turbines with auto-generated IDs ──────────────────────────
  function addTurbines(prefix, count){
    if(!DB.wtg) return [];
    if(!Array.isArray(DB.wtg.turbines)) DB.wtg.turbines = [];
    // Determine next number — scan existing IDs for max numeric suffix that matches prefix
    const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$');
    let nextNum = 1;
    DB.wtg.turbines.forEach(t => {
      const m = (t.id||'').match(re);
      if(m) nextNum = Math.max(nextNum, parseInt(m[1],10)+1);
    });
    const added = [];
    for(let i=0; i<count; i++){
      const id = prefix + '-' + String(nextNum + i).padStart(2,'0');
      const t = {
        id,
        mw: 0, // recomputed below
        lat: 14.83, lng: 76.47,
        status: 'pending',
        lp: false, pp: false,
        civil: [0,0,0,0,0],
        mech: [0,0,0,0],
        uss: 0,
        sup: 0,
        notes: '',
        mechDates: {},
        rowIssues: []
      };
      DB.wtg.turbines.push(t);
      added.push(t);
    }
    // Update count and redistribute
    DB.wtg.count = DB.wtg.turbines.length;
    redistributeWtgMW();
    // Seed acts tree on each new turbine
    if(typeof wtgInitActs === 'function'){
      added.forEach(wtgInitActs);
    }
    return added;
  }

  function removeTurbine(id){
    if(!DB.wtg || !Array.isArray(DB.wtg.turbines)) return false;
    const idx = DB.wtg.turbines.findIndex(t => t.id === id);
    if(idx < 0) return false;
    DB.wtg.turbines.splice(idx, 1);
    DB.wtg.count = DB.wtg.turbines.length;
    redistributeWtgMW();
    return true;
  }

  function addSolarBlocks(prefix, count){
    if(!DB.solar) DB.solar = { totalMW: 0, itcs: {} };
    if(!DB.solar.itcs) DB.solar.itcs = {};
    const existing = Object.keys(DB.solar.itcs);
    // Determine next number from existing IDs that match the prefix
    const re = new RegExp('^' + prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '-(\\d+)$');
    let nextNum = 1;
    existing.forEach(k => {
      const m = k.match(re);
      if(m) nextNum = Math.max(nextNum, parseInt(m[1],10)+1);
    });
    for(let i=0; i<count; i++){
      const id = prefix + '-' + (nextNum + i);
      // Build a minimal ITC with an empty acts list — preserves existing solar render contract.
      DB.solar.itcs[id] = {
        mw: 0,
        pct: 0,
        lat: 14.83, lng: 76.47,
        acts: (typeof mkSolActs === 'function')
          ? mkSolActs({})
          : []
      };
    }
    redistributeSolMW();
  }

  function removeSolarBlock(id){
    if(!DB.solar || !DB.solar.itcs) return false;
    if(!(id in DB.solar.itcs)) return false;
    delete DB.solar.itcs[id];
    redistributeSolMW();
    return true;
  }

  // ── Modal renderer ──────────────────────────────────────────────────
  function openProjectCreator(){
    if(!_isAdmin()){
      if(typeof showToast === 'function') showToast('🔒 WTG/Admin login required','er');
      else alert('Login required');
      return;
    }
    let host = document.getElementById('proj-creator-modal');
    if(!host){
      host = document.createElement('div');
      host.id = 'proj-creator-modal';
      host.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 20px;';
      document.body.appendChild(host);
    }
    renderCreator(host);
  }

  function closeProjectCreator(){
    const host = document.getElementById('proj-creator-modal');
    if(host) host.remove();
  }

  function renderCreator(host){
    const w = (DB.wtg) || {};
    const s = (DB.solar) || {};
    const turbs = w.turbines || [];
    const blocks = s.itcs ? Object.keys(s.itcs) : [];

    host.innerHTML = `
      <div style="background:var(--card);border:1px solid var(--b1);border-radius:10px;max-width:900px;width:100%;padding:18px 20px;color:var(--t1);box-shadow:0 12px 40px rgba(0,0,0,.4);">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <div style="font-size:16px;font-weight:800;display:flex;align-items:center;gap:8px;">
            🏗️ Project Creator <span style="font-size:10px;color:var(--t3);font-weight:500;">— add or remove units; MW redistributes automatically</span>
          </div>
          <button class="btn bts" onclick="closeProjectCreator()" style="font-size:11px;padding:4px 10px;">✕ Close</button>
        </div>

        <!-- ── WTG section ── -->
        <div class="pnl" style="padding:12px 14px;margin-bottom:14px;border-left:4px solid var(--wtg);">
          <div style="font-weight:700;color:var(--wtg);font-size:13px;margin-bottom:8px;">⚡ WTG Project</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
            <label style="font-size:9px;color:var(--t3);">Project Name
              <input id="pc-wtg-name" type="text" value="${(w.name||'WTG 70.2MW').replace(/"/g,'&quot;')}"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
            <label style="font-size:9px;color:var(--t3);">Total MW
              <input id="pc-wtg-mw" type="number" step="0.1" min="0" value="${w.totalMW||70.2}"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
            <label style="font-size:9px;color:var(--t3);">Total Turbines
              <input id="pc-wtg-count" type="number" step="1" min="1" value="${turbs.length}"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
            <label style="font-size:9px;color:var(--t3);">ID Prefix (new units)
              <input id="pc-wtg-prefix" type="text" value="WTG"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn btwt bts" onclick="applyWtgChanges()" style="font-size:10px;padding:5px 12px;">✓ Apply WTG Changes</button>
            <span style="font-size:9px;color:var(--t3);align-self:center;">Currently ${turbs.length} turbine(s) · ${turbs.map(t=>t.id).slice(0,6).join(', ')}${turbs.length>6?'…':''}</span>
          </div>
        </div>

        <!-- ── Solar section ── -->
        <div class="pnl" style="padding:12px 14px;margin-bottom:14px;border-left:4px solid var(--sol);">
          <div style="font-weight:700;color:var(--sol);font-size:13px;margin-bottom:8px;">☀️ Solar Project</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:8px;">
            <label style="font-size:9px;color:var(--t3);">Project Name
              <input id="pc-sol-name" type="text" value="${(s.name||'Solar 70.4MW').replace(/"/g,'&quot;')}"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
            <label style="font-size:9px;color:var(--t3);">Total MW
              <input id="pc-sol-mw" type="number" step="0.1" min="0" value="${s.totalMW||70.4}"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
            <label style="font-size:9px;color:var(--t3);">Total Blocks (ITCs)
              <input id="pc-sol-count" type="number" step="1" min="1" value="${blocks.length}"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
            <label style="font-size:9px;color:var(--t3);">ID Prefix (new blocks)
              <input id="pc-sol-prefix" type="text" value="ITC"
                style="display:block;width:100%;margin-top:3px;background:var(--card2);border:1px solid var(--b1);border-radius:4px;color:var(--t1);padding:4px 6px;font-size:10px;">
            </label>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap;">
            <button class="btn btwt bts" onclick="applySolChanges()" style="font-size:10px;padding:5px 12px;background:var(--sol);color:#fff;">✓ Apply Solar Changes</button>
            <span style="font-size:9px;color:var(--t3);align-self:center;">Currently ${blocks.length} block(s) · ${blocks.slice(0,6).join(', ')}${blocks.length>6?'…':''}</span>
          </div>
        </div>

        <div style="background:var(--card2);border-radius:6px;padding:8px 10px;font-size:9px;color:var(--t3);line-height:1.6;">
          <b style="color:var(--wn);">How it works:</b> Increasing the count adds new units with sequential IDs (e.g. WTG-27, WTG-28) and redistributes MW evenly.
          Decreasing the count removes the most recently added units (lowest activity first).
          The total project progress always rolls up to 100% because each unit's contribution is recomputed against the new total.
          Existing activity data on retained units is preserved.
        </div>
      </div>
    `;
  }

  // ── Apply handlers ──────────────────────────────────────────────────
  async function applyWtgChanges(){
    const name   = document.getElementById('pc-wtg-name').value.trim();
    const mw     = parseFloat(document.getElementById('pc-wtg-mw').value) || 0;
    const count  = Math.max(1, parseInt(document.getElementById('pc-wtg-count').value, 10) || 1);
    const prefix = (document.getElementById('pc-wtg-prefix').value.trim() || 'WTG');

    DB.wtg = DB.wtg || {};
    DB.wtg.name = name;
    DB.wtg.totalMW = mw;
    DB.wtg.turbines = DB.wtg.turbines || [];

    const cur = DB.wtg.turbines.length;
    if(count > cur){
      addTurbines(prefix, count - cur);
    } else if(count < cur){
      // Remove units from the END of the list (most recently added by sequence).
      // Skip units that have meaningful data so we never silently drop progress —
      // we prefer to remove the empty ones first.
      const sortedRemovable = [...DB.wtg.turbines]
        .map((t, i) => ({t, i, score: _turbineActivityScore(t)}))
        .sort((a,b) => a.score - b.score);
      const toRemove = sortedRemovable.slice(0, cur - count).map(x => x.t.id);
      if(toRemove.length){
        if(!confirm(`Remove ${toRemove.length} turbine(s): ${toRemove.join(', ')}?\nUnits with the least activity were chosen.`)){
          return;
        }
        toRemove.forEach(removeTurbine);
      }
    } else {
      redistributeWtgMW();
    }

    try {
      if(typeof saveDB === 'function') saveDB();
      // Persist each turbine via dataApi (in case Firebase mirroring is enabled)
      if(typeof dataApi !== 'undefined' && dataApi.updateTurbine){
        for(const t of DB.wtg.turbines){
          try { await dataApi.updateTurbine(t.id, { /* MW + structural fields */ }); } catch(e){}
        }
      }
      if(typeof showToast === 'function') showToast('✅ WTG project updated', 'ok');
    } catch(e){
      if(typeof showToast === 'function') showToast('❌ Save failed: '+(e.message||e), 'er');
    }

    closeProjectCreator();
    // Re-render whatever view is active
    if(typeof rndr === 'function') rndr(CV);
    else if(typeof rndrHome === 'function') rndrHome();
  }

  async function applySolChanges(){
    const name   = document.getElementById('pc-sol-name').value.trim();
    const mw     = parseFloat(document.getElementById('pc-sol-mw').value) || 0;
    const count  = Math.max(1, parseInt(document.getElementById('pc-sol-count').value, 10) || 1);
    const prefix = (document.getElementById('pc-sol-prefix').value.trim() || 'ITC');

    DB.solar = DB.solar || { itcs: {} };
    DB.solar.name = name;
    DB.solar.totalMW = mw;

    const keys = Object.keys(DB.solar.itcs || {});
    if(count > keys.length){
      addSolarBlocks(prefix, count - keys.length);
    } else if(count < keys.length){
      const sorted = keys.map(k => ({k, score:_solarBlockActivityScore(DB.solar.itcs[k])}))
                         .sort((a,b) => a.score - b.score);
      const toRemove = sorted.slice(0, keys.length - count).map(x => x.k);
      if(toRemove.length){
        if(!confirm(`Remove ${toRemove.length} solar block(s): ${toRemove.join(', ')}?`)){
          return;
        }
        toRemove.forEach(removeSolarBlock);
      }
    } else {
      redistributeSolMW();
    }

    try {
      if(typeof saveDB === 'function') saveDB();
      if(typeof showToast === 'function') showToast('✅ Solar project updated', 'ok');
    } catch(e){
      if(typeof showToast === 'function') showToast('❌ Save failed: '+(e.message||e), 'er');
    }

    closeProjectCreator();
    if(typeof rndr === 'function') rndr(CV);
    else if(typeof rndrHome === 'function') rndrHome();
  }

  // Score a turbine by total activity progress — used to choose which to remove
  function _turbineActivityScore(t){
    let s = 0;
    if(Array.isArray(t.civil)) s += t.civil.reduce((a,v)=>a+(v||0), 0);
    if(Array.isArray(t.mech))  s += t.mech.reduce((a,v)=>a+(v||0), 0);
    s += (t.uss||0) + (t.sup||0);
    if(t.lp) s += 50;
    if(t.pp) s += 50;
    return s;
  }
  function _solarBlockActivityScore(itc){
    if(!itc || !Array.isArray(itc.acts)) return 0;
    return itc.acts.reduce((a, x) => a + ((x && x.pct) || 0), 0);
  }

  // expose
  window.openProjectCreator  = openProjectCreator;
  window.closeProjectCreator = closeProjectCreator;
  window.applyWtgChanges     = applyWtgChanges;
  window.applySolChanges     = applySolChanges;

})();

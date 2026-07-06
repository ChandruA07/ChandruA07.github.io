'use strict';
/**
 * loader.js – Injects all HTML partials and boots the app.
 *
 * SINGLE-FILE MODE: every partial from views/ is inlined into index.html
 * as an inert <template data-partial="views/…"> element (see the
 * "INLINED VIEW PARTIALS" block in index.html). fetchPartial() reads the
 * template's innerHTML — NO network request, NO local web server needed.
 * The dashboard works opened straight from the file system (file://),
 * from GitHub Pages, Netlify, Firebase Hosting, or any static host.
 *
 * A fetch() fallback is kept purely for development convenience: if you
 * delete a template from index.html while editing, the loader will try
 * the network path (which then requires a local server, as before).
 */

const PARTIALS = {
  'overlay-login':  ['views/login.html'],
  'overlay-modals': ['views/modal-pov.html','views/modal-tov.html','views/modal-lov.html'],
  'sidebar-mount':  ['views/sidebar.html'],
  'topbar-mount':   ['views/topbar.html'],
  'views-mount': [
    'views/view-home.html','views/view-solar.html','views/view-itc.html',
    'views/view-wtg.html','views/view-zp.html','views/view-land.html','views/view-landwtg.html',
    'views/view-landsol.html','views/view-bop.html','views/view-bop-33kv.html',
    'views/view-bop-66kv.html','views/view-bop-pss.html','views/view-bop-gss.html',
    'views/view-pod.html','views/view-safety.html','views/view-manpower.html',
    'views/view-map.html','views/view-procurement.html','views/view-vendors.html',
    'views/view-inventory.html','views/view-planning.html','views/view-documents.html',
    'views/view-reports.html','views/view-audit.html',
  ],
  'footer-mount': ['views/footer.html'],
};

async function fetchPartial(url){
  // 1) Inline template — the normal path. Zero network, zero server.
  const tpl = document.querySelector('template[data-partial="' + url + '"]');
  if (tpl) return tpl.innerHTML;
  // 2) Dev fallback — fetch over the network (needs a web server).
  console.warn('[loader] inline template missing for ' + url + ' — falling back to fetch()');
  const res = await fetch(url);
  if(!res.ok)throw new Error(`Failed: ${url} (${res.status})`);
  return res.text();
}

async function bootApp(){
  const ldr=document.getElementById('ldr');
  if(ldr){ldr.style.width='40%';}
  try{
    const ids=Object.keys(PARTIALS);
    const htmls=await Promise.all(ids.map(id=>Promise.all(PARTIALS[id].map(fetchPartial)).then(p=>p.join('\n'))));
    ids.forEach((id,i)=>{const el=document.getElementById(id);if(el)el.innerHTML=htmls[i];});

    if(ldr){ldr.style.width='90%';}

    // Wire event listeners now that DOM exists
    const tbt=document.getElementById('tbt');if(tbt)tbt.onclick=toggleSB;
    document.addEventListener('keydown',e=>{if(e.key==='Escape')['pov','tov','lov'].forEach(cov);});
    ['pov','tov','lov'].forEach(id=>{
      const el=document.getElementById(id);
      if(el)el.addEventListener('click',function(e){if(e.target===this)cov(id);});
    });

    // Set date
    const now=new Date();
    const ds=now.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});
    document.querySelectorAll('#today-date,#ft-date').forEach(el=>{el.textContent=ds;});

    // Populate footer Firebase project badge (was previously a dead <script> in footer.html
    // — scripts injected via innerHTML are silently ignored by browsers).
    (function startFooterRefresh() {
      const ftInfo = document.getElementById('ft-fb-info');
      if (!ftInfo) return;
      const code = ftInfo.querySelector('code');
      if (!code) return;
      function refreshFooter() {
        if (!window.backendInfo) return;
        const ok = document.documentElement.dataset.fbConnected === '1';
        code.textContent = 'supabase:' + (window.backendInfo.projectRef || '?') + ' · ' + (ok ? '☁️ connected' : '⚠️ offline');
        code.style.color = ok ? 'var(--ok,#3ddc84)' : 'var(--wn,#ffb74d)';
      }
      refreshFooter();
      setInterval(refreshFooter, 2000);
    })();

    if(ldr){ldr.style.transition='width .4s';ldr.style.width='100%';setTimeout(()=>ldr.style.width='0',400);}

    // Firebase Realtime DB listeners (set up in state-bridge.js) are the
    // ONLY source of truth. The UI mounts with the schema's default values
    // from data.js and gets hydrated as soon as Firebase fires its first
    // 'value' / 'child_added' callback. No localStorage cache.
    loadDB(); // legacy no-op; safe to call

    nav('home');

    // Signal to state-bridge that the app is fully rendered and listeners
    // can start triggering re-renders.
    window._appBooted = true;

    // PWA — register the offline-shell service worker (Phase 3.8).
    // RTDB's own offline write-queue is separate and always on.
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('sw.js').then(
        r => console.log('[pwa] service worker registered, scope:', r.scope),
        e => console.warn('[pwa] service worker registration failed:', e));
    }

  }catch(err){
    console.error('Boot failed:',err);
    document.body.innerHTML=`
      <div style="padding:40px;font-family:sans-serif;background:#07101f;color:#ff5252;min-height:100vh;">
        <h2>⚠️ Dashboard failed to load</h2>
        <p style="color:#8aaccf;margin-top:12px;">${err.message}</p>
        <p style="color:#4a6a8a;font-size:13px;margin-top:8px;">
          The view templates inlined in index.html could not be read. Re-download the
          project ZIP, or (developer mode) serve the folder from a local web server so
          the fetch() fallback can load the views/ partials.
        </p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootApp);

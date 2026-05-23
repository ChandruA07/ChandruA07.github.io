'use strict';
/**
 * loader.js – Fetches all HTML partials and injects them, then boots the app.
 * ⚠️ Requires a local web server (Live Server / npx serve / python -m http.server)
 */

const PARTIALS = {
  'overlay-login':  ['views/login.html'],
  'overlay-modals': ['views/modal-pov.html','views/modal-tov.html','views/modal-lov.html'],
  'sidebar-mount':  ['views/sidebar.html'],
  'topbar-mount':   ['views/topbar.html'],
  'views-mount': [
    'views/view-home.html','views/view-solar.html','views/view-itc.html',
    'views/view-wtg.html','views/view-land.html','views/view-landwtg.html',
    'views/view-landsol.html','views/view-bop.html','views/view-bop-33kv.html',
    'views/view-bop-66kv.html','views/view-bop-pss.html','views/view-bop-gss.html',
    'views/view-pod.html','views/view-safety.html','views/view-manpower.html',
    'views/view-map.html',
  ],
  'footer-mount': ['views/footer.html'],
};

async function fetchPartial(url){
  const res=await fetch(url);
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
    const lp=document.getElementById('l-p');
    if(lp)lp.addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});

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
        if (!window.firebaseConfig) return;
        const ok = document.documentElement.dataset.fbConnected === '1';
        code.textContent = (window.firebaseConfig.projectId || '?') + ' · ' + (ok ? '☁️ connected' : '⚠️ offline');
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

  }catch(err){
    console.error('Boot failed:',err);
    document.body.innerHTML=`
      <div style="padding:40px;font-family:sans-serif;background:#07101f;color:#ff5252;min-height:100vh;">
        <h2>⚠️ Dashboard failed to load</h2>
        <p style="color:#8aaccf;margin-top:12px;">${err.message}</p>
        <p style="color:#4a6a8a;font-size:13px;margin-top:8px;">
          You must serve this project from a <b>local web server</b> — not by opening index.html directly.<br><br>
          <b>Options:</b><br>
          • VS Code → Right-click index.html → <b>Open with Live Server</b><br>
          • Terminal: <code>npx serve swppl-v8</code><br>
          • Terminal: <code>cd swppl-v8 &amp;&amp; python3 -m http.server 8080</code>
        </p>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', bootApp);

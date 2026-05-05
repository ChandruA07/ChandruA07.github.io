'use strict';

// ═══════════════════════════════════════════════════════════
// main.js  —  Firebase real-time sync
//
// How it works:
//   • dataRef.on('value') fires every time data changes in Firebase
//     (on page load AND whenever another device saves)
//   • applySnap() correctly maps the cloud snapshot into DB
//   • if the app is already rendered (_appBooted), we call rndr()
//     to refresh the screen immediately — no page reload needed
// ═══════════════════════════════════════════════════════════

(function () {

  const dataRef = window.firebaseDB.ref('dashboard');

  dataRef.on('value', function (snapshot) {
    const remoteData = snapshot.val();

    if (!remoteData || remoteData._v !== 3) {
      console.warn('[Firebase] No valid data at "dashboard". Save data from the dashboard first.');
      return;
    }

    // 1. Apply cloud snapshot properly into all DB nested structures
    applySnap(remoteData);

    // 2. Keep localStorage fresh so offline fallback is always up to date
    try { localStorage.setItem('swppl_epc_db_v3', JSON.stringify(remoteData)); } catch(e) {}

    // 3. Re-render the current view IF the app is already on screen.
    //    _appBooted is set to true by loader.js after nav('home') completes.
    //    - Firebase responds BEFORE nav('home'): _appBooted is false → skip rndr
    //      (nav will render with the already-applied fresh data) ✅
    //    - Firebase responds AFTER nav('home'): _appBooted is true → rndr runs
    //      (screen refreshes with the new cloud data) ✅
    //    - Another device saves later: _appBooted is true → rndr runs → real-time sync ✅
    if (window._appBooted) {
      console.log('[Firebase] Remote data received — refreshing view:', CV);
      try { rndr(CV, {}); } catch(e) { console.warn('[Firebase] rndr error:', e); }
    }

    const ts = document.getElementById('last-saved-ts');
    if (ts) ts.textContent = '☁️ Synced: ' + new Date(remoteData._ts).toLocaleTimeString();
    console.log('[Firebase] DB synced from cloud. Saved at:', new Date(remoteData._ts).toLocaleString());
  });

  // Connection status
  window.firebaseDB.ref('.info/connected').on('value', function (snap) {
    console.log('[Firebase]', snap.val() ? '✅ Connected' : '⚠️ Disconnected');
  });

})();

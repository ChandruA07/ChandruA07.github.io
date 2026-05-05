'use strict';

// ═══════════════════════════════════════════════════════════
// main.js  —  Firebase ↔ DB sync + app entry point
//
// FIX: Firebase listener now:
//   1. Applies the cloud snapshot via applySnap() (same logic as loadDB)
//   2. Also writes it to localStorage so offline fallback stays fresh
//   3. Re-renders the current view so the UI actually updates
// ═══════════════════════════════════════════════════════════

(function () {

  const dataRef = window.firebaseDB.ref('dashboard');

  // Track whether this is the very first Firebase load (page open)
  // vs a subsequent real-time update from another device.
  let _firstLoad = true;

  // ── Listen for live Firebase data ──────────────────────────
  dataRef.on('value', function (snapshot) {
    const remoteData = snapshot.val();
    console.log('[Firebase] Data received:', remoteData ? '✅ has data' : '⚠️ empty');

    if (remoteData && remoteData._v === 3) {

      // 1. Apply the snapshot properly into DB (handles all nested structures)
      applySnap(remoteData);

      // 2. Keep localStorage in sync with the latest cloud data
      try { localStorage.setItem('swppl_epc_db_v3', JSON.stringify(remoteData)); } catch(e) {}

      // 3. Re-render the current view so the screen shows updated data.
      //    On first load, bootApp -> nav('home') handles rendering.
      //    On subsequent updates (from another device) we must refresh manually.
      if (!_firstLoad) {
        console.log('[Firebase] Remote update detected — refreshing view:', CV);
        try { rndr(CV, {}); } catch(e) { console.warn('[Firebase] rndr failed:', e); }
      }

      _firstLoad = false;
      console.log('[Firebase] DB applied from cloud. Saved at:', new Date(remoteData._ts).toLocaleString());

    } else {
      _firstLoad = false;
      console.warn('[Firebase] No valid data at "dashboard". ' +
        'Make sure you have saved data at least once from the dashboard.');
    }
  });

  // ── Connection status indicator ────────────────────────────
  window.firebaseDB.ref('.info/connected').on('value', function (snap) {
    const connected = snap.val() === true;
    const ts = document.getElementById('last-saved-ts');
    if (!connected && ts && !ts.textContent.includes('Saved')) {
      ts.textContent = '⚠️ Offline — changes will sync when reconnected';
    }
    console.log('[Firebase]', connected ? '✅ Connected' : '⚠️ Disconnected');
  });

})();

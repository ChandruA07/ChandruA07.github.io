'use strict';

// ═══════════════════════════════════════════════════════════
// main.js  —  Firebase ↔ DB sync + app entry point
//
// This file runs AFTER all other scripts are loaded (see index.html order).
// At this point:
//   • window.firebaseDB  is ready  (from firebase.js)
//   • DB                 is ready  (from data.js)
//   • bootApp            is ready  (from loader.js)
// ═══════════════════════════════════════════════════════════

(function () {

  const dataRef = window.firebaseDB.ref('dashboard');

  // ── Listen for live Firebase data ──────────────────────────
  dataRef.on('value', function (snapshot) {
    const remoteData = snapshot.val();
    console.log('[Firebase] Data received:', remoteData);

    if (remoteData) {
      // Merge the Firebase fields into the local DB object.
      // Object.assign does a shallow merge — top-level keys from Firebase
      // overwrite the matching keys in DB (e.g. DB.pod, DB.mp, DB.schedule).
      // Nested objects (solar, wtg, bop, land) are replaced in full.
      Object.assign(DB, remoteData);
      console.log('[Firebase] DB updated from remote data.');
    } else {
      console.warn('[Firebase] No data found at path "dashboard". ' +
        'Make sure you have uploaded your DB snapshot to Firebase.');
    }
  });

  // ── Error handling ─────────────────────────────────────────
  dataRef.on('child_changed', function (snapshot) {
    console.log('[Firebase] Remote change detected — key:', snapshot.key);
  });

  window.firebaseDB.ref('.info/connected').on('value', function (snap) {
    if (snap.val() === true) {
      console.log('[Firebase] ✅ Connected to Realtime Database.');
    } else {
      console.warn('[Firebase] ⚠️  Disconnected from Realtime Database.');
    }
  });

})();

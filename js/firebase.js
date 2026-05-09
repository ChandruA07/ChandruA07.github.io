'use strict';
// =============================================================
//  firebase.js  (v9 — replaces the old DB-only init)
//
//  Initialises three Firebase services the app needs:
//    - Realtime Database (live data)
//    - Authentication    (real login + role lookup)
//    - Storage           (image uploads, NOT base64 in DB)
//
//  Globals exposed for the rest of the app:
//    window.fbDB, window.fbAuth, window.fbStorage, window.fbServerTs
//
//  ⚠️  apiKey is NOT a secret. Security comes from
//      security/rules.json + security/storage.rules,
//      enforced server-side by Firebase.
// =============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyCVJdgzJcJHtyHWRVWbHYtTv2PnWN9nhtw",
  authDomain:        "dashboard-project-8db91.firebaseapp.com",
  databaseURL:       "https://dashboard-project-8db91-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         "dashboard-project-8db91",
  storageBucket:     "dashboard-project-8db91.firebasestorage.app",
  messagingSenderId: "776376164251",
  appId:             "1:776376164251:web:efc95c5501d701c558cb3e",
  measurementId:     "G-MZYRV2RPSW"
};

firebase.initializeApp(firebaseConfig);

// New canonical names — used by auth.js / data-api.js / realtime.js / storage.js
window.fbDB       = firebase.database();
window.fbAuth     = firebase.auth();
window.fbStorage  = firebase.storage();
window.fbServerTs = firebase.database.ServerValue.TIMESTAMP;

// Backwards-compat alias so any leftover legacy code that still references
// `firebaseDB` keeps working until you finish migrating it.
window.firebaseDB = window.fbDB;

// Connection status pill (driven by /.info/connected; the badge with id="fb-status-pill" lives in topbar.html)
firebase.database().ref('.info/connected').on('value', s => {
  const ok = s.val() === true;
  document.documentElement.dataset.fbConnected = ok ? '1' : '0';
  console.log('[firebase] connected:', ok);
  const pill = document.getElementById('fb-status-pill');
  if (pill) {
    pill.textContent = ok ? '☁️ Online' : '⚠️ Offline';
    pill.style.color = ok ? 'var(--ok,#3ddc84)' : 'var(--wn,#ffb74d)';
  }
});

console.log('[firebase] init OK, project:', firebaseConfig.projectId);

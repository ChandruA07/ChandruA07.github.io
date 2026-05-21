'use strict';
// =============================================================
//  firebase.js  (v9 — DB + Storage init)
//
//  Initialises the two Firebase services this app actually uses:
//    - Realtime Database (live data)
//    - Storage           (image uploads, NOT base64 in DB)
//
//  Globals exposed for the rest of the app:
//    window.fbDB, window.fbStorage, window.fbServerTs
//
//  ⚠️  apiKey is NOT a secret. Security comes from
//      database.rules.json + security/storage.rules,
//      enforced server-side by Firebase.
//
//  FIX 4 — Firebase Authentication is NOT used here.
//  The "login" is a hardcoded password handled entirely in
//  js/auth.js (sessionStorage unlock). We deliberately do NOT
//  initialise firebase.auth() — there is no user record, no
//  onAuthStateChanged subscriber, and no auth.currentUser reader
//  anywhere in the app. The firebase-auth-compat.js <script>
//  tag has also been removed from index.html.
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
// Expose project ID so the footer diagnostic can render which Firebase
// project this device is connected to (handy for verifying multi-device sync).
window.firebaseConfig = firebaseConfig;

// Canonical names — used by data-api.js / realtime.js / storage.js.
// Note: NO window.fbAuth — see header.
window.fbDB       = firebase.database();
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

console.log('[firebase] init OK (DB + Storage only — no Firebase Auth), project:', firebaseConfig.projectId);

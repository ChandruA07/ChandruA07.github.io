'use strict';
// =============================================================
//  firebase.js  (v10 — public dashboard, anonymous-auth model)
//
//  Initialises:
//    - Realtime Database  (live data sync)
//    - Anonymous Auth     (invisible — gives Firebase a uid so
//                          rules can reject random-internet writes)
//
//  No Storage — base64 fallback for HSE photos so the app stays
//  on the free Spark plan.
//
//  Globals exposed:
//    window.fbDB, window.fbServerTs
//    window.firebaseDB                    (legacy alias)
//    window.fbReady : Promise<void>       (resolves when anon-auth completes)
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

window.fbDB       = firebase.database();
window.fbServerTs = firebase.database.ServerValue.TIMESTAMP;
window.firebaseDB = window.fbDB;          // backwards-compat
window.fbAuth     = firebase.auth();

// -----------------------------------------------------------
//  Anonymous authentication
//  Every visitor gets an invisible Firebase uid. Security rules
//  use it to reject anyone who isn't going through the website.
//  No login screen — runs silently on page load.
// -----------------------------------------------------------
window.fbReady = new Promise((resolve) => {
  fbAuth.onAuthStateChanged(user => {
    if (user) {
      window.fbAnonUid = user.uid;
      console.log('[Firebase v10] Anonymous session:', user.uid.slice(0, 8) + '…');
      resolve();
    }
  });
  fbAuth.signInAnonymously().catch(err => {
    console.error('[Firebase v10] Anonymous sign-in failed:', err);
    // The site will still render from localStorage; writes will fail until
    // the user enables Anonymous Auth in Firebase Console.
    resolve();
  });
});

// Connection-status pill (id="fb-status-pill" if you add one to the topbar)
firebase.database().ref('.info/connected').on('value', s => {
  const ok = s.val() === true;
  document.documentElement.dataset.fbConnected = ok ? '1' : '0';
  const pill = document.getElementById('fb-status-pill');
  if (pill) {
    pill.textContent = ok ? '☁️ Online' : '⚠️ Offline';
    pill.style.color = ok ? 'var(--ok,#3ddc84)' : 'var(--wn,#ffb74d)';
  }
});

console.log('[Firebase v10] Initialised — project:', firebaseConfig.projectId);

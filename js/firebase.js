// ═══════════════════════════════════════════════════════════
// firebase.js  —  Firebase Realtime Database initialisation
//
// Uses the COMPAT SDK (loaded via <script> tags in index.html)
// so it works as a plain global script — no ES module imports needed.
//
// ⚠️  Replace the placeholder values below with your actual
//     Firebase project credentials from:
//     Firebase Console → Project Settings → Your apps → SDK setup
// ═══════════════════════════════════════════════════════════

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCVJdgzJcJHtyHWRVWbHYtTv2PnWN9nhtw",
  authDomain: "dashboard-project-8db91.firebaseapp.com",
  databaseURL: "https://dashboard-project-8db91-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "dashboard-project-8db91",
  storageBucket: "dashboard-project-8db91.firebasestorage.app",
  messagingSenderId: "776376164251",
  appId: "1:776376164251:web:efc95c5501d701c558cb3e",
  measurementId: "G-MZYRV2RPSW"
};

// Initialise the Firebase app (compat SDK uses the global `firebase` object
// injected by the CDN <script> tags in index.html)
firebase.initializeApp(firebaseConfig);

// Expose the database instance as a global so main.js can use it
window.firebaseDB = firebase.database();

console.log("[Firebase] Initialised — connected to:", firebaseConfig.projectId);

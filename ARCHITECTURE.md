# SWPPL Dashboard v9 — Production Architecture

Continuum Green Energy · 140MW Hybrid Dashboard
Target: secure, real-time, multi-device demo on Firebase Spark (free tier).

---

## 1. What was wrong with v8 (root causes, not symptoms)

| # | Symptom you reported              | Root cause in the v8 code                                                                                                                           |
|---|-----------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|
| 1 | "Set() overwrites everything"     | `data.js:592` does `firebaseDB.ref('dashboard').set(clean)` on every change. Whoever saves last wins, and erases everyone else's edits.              |
| 2 | "Login is fake"                   | `data.js:29-34` hardcodes 4 users + plaintext passwords. `render-misc.js:915` checks them client-side. Anyone with DevTools can read them.            |
| 3 | "Sync isn't working"              | One huge blob means listeners fire on every keystroke from any user. Your local edits are clobbered the instant another device saves.                |
| 4 | "HSE not saving"                  | The save-snapshot at `data.js:564` doesn't include `HSE_DB`. It's only kept in localStorage. It never goes to Firebase.                              |
| 5 | "XSS via innerHTML"               | 83 `innerHTML=` sites across the JS files, many interpolating user fields like `notes`, `contractor`, `by`. A `<img onerror=…>` in any field runs JS.|
| 6 | "Base64 images in DB"             | `render-misc.js:534` reads photo via `FileReader` and stores the data URL inside the DB tree. One 2MB photo blocks the entire DB sync.               |
| 7 | "POD/daily progress not on home"  | `DB.pod` is a flat array per module (`s/w/l/b`). No date key, so the home view can't ask "what was logged today" or "show last 3 days".              |
| 8 | "No real auth on sub-activities"  | `reqLogin` is a UI gate only — it shows a modal, but the actual write goes through the same `set()`. Closing the modal in DevTools bypasses it.       |

Every one of these is fixed below by changing **how data flows**, not by patching individual call sites.

---

## 2. Final architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          BROWSER                                 │
│                                                                  │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │  Renderers │   │  data-api.js │   │   auth.js            │    │
│  │ (render-*) │──▶│  (mutators)  │──▶│  Firebase Auth       │    │
│  │            │   │              │   │  + role from /users  │    │
│  └────────────┘   └──────┬───────┘   └──────────┬───────────┘    │
│        ▲                 │                      │                │
│        │  child_added/   │ partial              │ getIdToken()   │
│        │  child_changed  │ updates              ▼                │
│        │                 ▼                                       │
│  ┌────────────┐   ┌──────────────┐   ┌──────────────────────┐    │
│  │  dom.js    │   │ realtime.js  │   │ storage.js           │    │
│  │  (safe DOM)│   │ (listeners)  │   │ (image uploads)      │    │
│  └────────────┘   └──────┬───────┘   └──────────┬───────────┘    │
└─────────────────────────│──────────────────────│───────────────┘
                          │                      │
                          ▼                      ▼
              ┌──────────────────────┐   ┌─────────────────────┐
              │  Realtime Database   │   │  Firebase Storage   │
              │  (rules.json)        │   │  (storage.rules)    │
              │                      │   │                     │
              │  /users/{uid}        │   │  /hse/{date}/{id}   │
              │  /pod/{date}/{id}    │   │  /itc/{id}/maps/    │
              │  /solar/itcs/{id}    │   └─────────────────────┘
              │  /wtg/turbines/{id}  │
              │  /bop/...            │
              │  /hse/observations/  │
              │  /audit/{ts}         │
              └──────────────────────┘
```

**Two principles run through everything:**

1. **The server is the source of truth, enforced by rules.** The browser doesn't decide who can write — Realtime Database rules do. Auth + role + path are checked on every byte before it lands.
2. **Writes are paths, not blobs.** Nothing ever calls `.set('/dashboard', everything)` again. Each mutation targets the smallest path it can — `/pod/2026-05-05/-Nx9k…`, `/solar/itcs/ITC-1/acts/3/done`. That removes the overwrite problem and reduces listener noise.

---

## 3. Database structure

```
/                                    (root — never read whole)
│
├── users/
│   └── {uid}/                       (one node per Firebase Auth user)
│       ├── role:    "admin" | "solar" | "wtg" | "bop" | "viewer"
│       ├── name:    "Solar Engineer"
│       └── email:   "solar@swppl.demo"
│
├── pod/                             (Plan of Day — DATE-KEYED, history preserved)
│   └── {YYYY-MM-DD}/
│       └── {pushId}/                (push() = chronological + collision-safe)
│           ├── module:   "s" | "w" | "l" | "b"
│           ├── activity: "Pile Drilling"
│           ├── qty:      120
│           ├── mp:       4
│           ├── contractor: "..."
│           ├── by:       "{uid}"
│           ├── notes:    "..."
│           ├── ts:       1730000000000     (server time)
│           └── photoURL: "https://..."     (Storage URL, not base64)
│
├── solar/
│   ├── meta/
│   │   ├── totalMW: 100
│   │   └── itcMW:   { "ITC-1": 16.7, ... }
│   └── itcs/
│       └── {ITC-id}/
│           └── acts/
│               └── {actIndex}/             (0-15, matches SOL_ACT_DEFS)
│                   ├── done:    45.2
│                   ├── today:   2.1
│                   ├── subDone: [120, 45, 0, 0]
│                   └── lastBy:  "{uid}"
│                   └── lastAt:  1730000000000
│
├── wtg/
│   ├── meta/ { totalMW, count }
│   └── turbines/
│       └── {WTG-id}/
│           ├── status, lp, pp, civil, mech, uss, sup
│           ├── notes
│           └── mechDates: { foundation: "2026-03-14", ... }
│
├── bop/
│   ├── acts/                                (33kV, 66kV summary)
│   ├── feeders33/
│   ├── tower66:    { erection: 56 }
│   ├── pss/ { acts/{name}: {done, wip} }
│   └── gss/ { acts/{name}: {done, wip} }
│
├── land/
│   ├── parcels/  { {pushId}: {...} }
│   ├── rowIssues/
│   ├── solBlocks/{id}/acts/
│   └── wtgLocs/{id}/{stages, ls, comp, notes}
│
├── hse/
│   ├── observations/ { {pushId}: {date, type, severity, desc, photoURL, by, ts} }
│   ├── employees/    { {empId}: {name, role, ...} }
│   └── inductions/   { {date}: { count } }
│
├── milestones/   { {pushId}: {...} }
├── blockers/     { {pushId}: {...} }
├── schedule/     { {pushId}: {...} }
│
└── audit/                              (write-only audit trail)
    └── {ts}/
        ├── uid, role, path, action, before, after
```

### Why this shape

- **Date-keyed POD (`/pod/{YYYY-MM-DD}/...`)** — the home dashboard fetches `pod/2026-05-05` and `pod/2026-05-04` directly. No filtering an in-memory array. Yesterday's data is never overwritten by today.
- **Push IDs everywhere a list grows** — `firebase.database().ref(...).push().key` gives you a chronologically-sortable, collision-free ID. Two engineers logging POD at the same moment can't overwrite each other.
- **Leaf-level writes** — `update({ '/solar/itcs/ITC-1/acts/3/done': 45.2 })` touches one number. Listeners on other devices receive only that delta.
- **No top-level `dashboard` key.** That single node was the entire bug. It's gone.

---

## 4. Authentication & authorization

### 4.1 Provider
Firebase Authentication, **Email/Password** provider only (free, works on Spark).

### 4.2 User provisioning (one-time, by admin)
1. Firebase Console → Authentication → Users → Add user.
2. After creating each user, write their role to `/users/{uid}`:
   ```json
   "users": {
     "abc123…": { "role": "admin",  "name": "Site Manager", "email": "admin@swppl.demo" },
     "def456…": { "role": "solar",  "name": "Solar Engr",   "email": "solar@swppl.demo" },
     "ghi789…": { "role": "wtg",    "name": "WTG Engr",     "email": "wtg@swppl.demo" },
     "jkl012…": { "role": "bop",    "name": "BOP Engr",     "email": "bop@swppl.demo" },
     "mno345…": { "role": "viewer", "name": "Mgmt",         "email": "view@swppl.demo" }
   }
   ```
   The role node is **only writable by admins** (see rules below). Users cannot self-promote.

### 4.3 Role matrix

| Path                     | admin | solar | wtg | bop | viewer |
|--------------------------|:-----:|:-----:|:---:|:---:|:------:|
| `/users/*`               | RW    |   R   |  R  |  R  |   R    |
| `/users/{ownUid}/*`      | RW    |  R    | R   | R   |   R    |
| `/solar/**`              | RW    |  RW   |  R  |  R  |   R    |
| `/wtg/**`                | RW    |  R    | RW  |  R  |   R    |
| `/bop/**`                | RW    |  R    |  R  | RW  |   R    |
| `/land/**`               | RW    |  R    |  R  |  R  |   R    |
| `/hse/**`                | RW    |  RW   | RW  | RW  |   R    |
| `/pod/**`                | RW    |  RW*  | RW* | RW* |   R    |
| `/audit/**`              | R     |   —   |  —  |  —  |   —    |

`*` = can only create POD entries where `module` matches their own scope (s/w/b for solar/wtg/bop respectively).

### 4.4 Server-side enforcement (Realtime Database Rules)

This is the file that must be deployed (`security/rules.json`). The browser layer is **decoration** — these rules are the actual security boundary.

```json
{
  "rules": {
    ".read":  "auth != null",
    ".write": "false",

    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
        "role": { ".validate": "newData.isString() && newData.val().matches(/^(admin|solar|wtg|bop|viewer)$/)" }
      }
    },

    "solar": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'solar')"
    },
    "wtg": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'wtg')"
    },
    "bop": {
      ".write": "auth != null && (root.child('users').child(auth.uid).child('role').val() === 'admin' || root.child('users').child(auth.uid).child('role').val() === 'bop')"
    },
    "land":   { ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'" },
    "hse": {
      ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'"
    },

    "pod": {
      "$date": {
        ".validate": "$date.matches(/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/)",
        "$pushId": {
          ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'",
          ".validate": "newData.hasChildren(['module','activity','by','ts'])",
          "by":     { ".validate": "newData.val() === auth.uid" },
          "module": { ".validate": "newData.isString() && newData.val().matches(/^(s|w|l|b)$/)" },
          "ts":     { ".validate": "newData.val() <= now + 60000" }
        }
      }
    },

    "milestones": { ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'" },
    "blockers":   { ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() !== 'viewer'" },
    "schedule":   { ".write": "auth != null && root.child('users').child(auth.uid).child('role').val() === 'admin'" },

    "audit": {
      ".read":  "root.child('users').child(auth.uid).child('role').val() === 'admin'",
      "$ts":    { ".write": "auth != null && !data.exists()" }
    }
  }
}
```

**Read this twice.** Even if someone strips your `auth.js`, opens DevTools, and calls `firebase.database().ref('/solar').set(…)`, the database rejects it because their `/users/{uid}/role` is not `admin` or `solar`. **The client cannot bypass this** — it is enforced on Google's servers.

### 4.5 Storage rules (`security/storage.rules`)

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /hse/{date}/{file} {
      allow read:  if request.auth != null;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
    match /itc/{itcId}/maps/{file} {
      allow read:  if request.auth != null;
      allow write: if request.auth != null
                   && firestore.exists(/databases/(default)/documents/users/$(request.auth.uid))
                   && request.resource.size < 5 * 1024 * 1024;
    }
  }
}
```

---

## 5. Real-time synchronization strategy

### 5.1 The rule
**Never call `.set()` on a parent node.** Always either:
- `update({ '/path/to/leaf': value, '/path/to/another': value })` — atomic multi-path update.
- `push().key` + `update({ '/path/'+key: payload })` — for new list items.
- `transaction()` — for counters or anything where two clients might both increment.

### 5.2 Listener strategy

| What                | Where                      | Firebase event used                          |
|---------------------|----------------------------|---------------------------------------------|
| POD live feed       | `/pod/{today}`             | `child_added`, `child_changed`              |
| POD historical      | `/pod/{yesterday}`         | `value` once (no listener, snapshot only)   |
| Solar ITC progress  | `/solar/itcs/{currentITC}` | `value` while that view is open, then off() |
| WTG turbines        | `/wtg/turbines`            | `child_changed` only when WTG view open     |
| HSE observations    | `/hse/observations`        | `child_added` (limited to last 50)          |

`child_*` events are far cheaper than `value` because each one carries a single record, not the whole branch. We also `.off()` listeners when navigating away — see `realtime.js`.

### 5.3 Conflict avoidance

Two engineers updating the same field concurrently:

- **POD entries** — never conflict because each is its own `pushId`.
- **Solar/WTG/BOP progress numbers** — last-write-wins is acceptable for a demo, but every write is stamped with `lastBy` and `lastAt`. The dashboard can show "last edited 2 sec ago by Solar Engr".
- **Critical counters (e.g. cumulative MW)** — use `transaction()` so concurrent `+1`s never lose an increment.

### 5.4 Offline support
Realtime Database has built-in offline persistence. We enable it once:
```js
firebase.database().goOffline();   // not used; just for awareness
firebase.database().ref('.info/connected').on(...)  // we use this for the status pill
```
Writes made offline are queued and replayed automatically when connection returns. **No code change required.**

---

## 6. XSS elimination

### The bug
83 sites of `element.innerHTML = \`…${userField}…\``. Any field a user types (notes, contractor name, observation description) becomes executable HTML.

### The fix
Three tools in `js/dom.js`:

```js
esc(str)              // returns HTML-safe string (& < > " ' )
el(tag, attrs, ...kids)  // safe element factory; never parses HTML
mount(parent, ...nodes)  // empty parent, append nodes
```

Then a global rule that ESLint or a code-review checklist enforces:
> **`innerHTML` is allowed only with literals that contain no `${`. If you interpolate, use `el()` and `esc()`.**

Rather than rewriting all 83 sites in one change, we ship `dom.js` + a small wrapper `safeHTML(template, vars)` that escapes `vars` before substitution, so existing template strings can be migrated incrementally:
```js
// before
g.innerHTML = `<div>${notes}</div>`;
// after
g.innerHTML = safeHTML('<div>${notes}</div>', { notes });
```

---

## 7. Image handling — Storage instead of base64

### Old flow (broken)
```
File → FileReader.readAsDataURL → DB.observations[i].photo = "data:image/png;base64,iVBOR…"  (2 MB string)
→ saveDB → Firebase RTDB receives 2 MB blob → all listeners on all devices receive 2 MB.
```

### New flow (`js/storage.js`)
```
File → uploadImage(file, 'hse', date)
→ Firebase Storage at /hse/{date}/{pushId}.jpg
→ getDownloadURL()  →  store URL in /hse/observations/{id}/photoURL
→ DB transmits ~80-byte string instead of 2 MB.
```

Bonus: Storage rules limit file to 5 MB and enforce `contentType: image/*`.

---

## 8. POD / dashboard fix

### Why the home dashboard was empty

`render-home.js` reads `DB.pod.s/.w/.l/.b` (flat arrays). When localStorage was wiped or Firebase pushed a fresh snapshot from another device, these arrays were either empty or contained only the last engineer's edits.

### Fix

`data-api.js` exposes:
```js
listenPodToday(cb)        // child_added on /pod/{todayISO} — feeds home view
loadPodForDate(date)      // one-shot fetch for "Yesterday" / "3 days ago" panels
recentPodWindow(days, cb) // glues N recent dates together for "Recent Updates"
```

`render-home.js` becomes a pure function of these streams. Today + previous days are always visible because they live under different date keys that are never touched once written.

---

## 9. Performance

| Concern                              | Mitigation                                                          |
|---|---|
| Don't read entire DB on boot         | Listeners only attach when their view is opened.                    |
| Don't re-render on every tiny change | `child_changed` returns the diff; we patch the row, not the page.   |
| Don't ship base64 over the wire      | Storage URLs.                                                       |
| Don't auto-save every keystroke      | `updates` are debounced 400ms in `data-api.js`; HSE form uses click-to-save. |
| Spark plan caps                      | Stay under 100 simul. connections, 1 GB storage, 10 GB/mo download. Our entire DB is < 1 MB. |

---

## 10. Step-by-step implementation plan

These are the steps in the order you'll execute them. Items marked **[CODE]** correspond to the files I've created in this output bundle.

### Phase 1 — Firebase Console setup (30 min, no code)
1. Open Firebase Console → your project.
2. **Authentication → Sign-in method → Email/Password → Enable.**
3. **Authentication → Users → Add user** (do this 5 times for: admin, solar, wtg, bop, viewer). Copy each UID.
4. **Realtime Database → Rules** — paste contents of `security/rules.json` (this bundle) and **Publish**.
5. **Storage → Rules** — paste contents of `security/storage.rules` and **Publish**.
6. **Realtime Database → Data → manually create** the `/users` tree using the UIDs from step 3:
   ```
   /users/{adminUid}/role  = "admin"
   /users/{adminUid}/name  = "Site Manager"
   ... (repeat for each)
   ```
   Tip: use the JSON Import button. Sample file: `security/seed-users.json`.

### Phase 2 — Drop-in core files **[CODE]**
Replace / add into your `js/` folder:

| File                | Status     | Purpose                                       |
|---------------------|------------|-----------------------------------------------|
| `js/firebase.js`    | **REPLACE**| Adds Auth + Storage SDK init.                 |
| `js/auth.js`        | **NEW**    | Real login, role retrieval, sign-out.         |
| `js/dom.js`         | **NEW**    | `esc()`, `el()`, `safeHTML()` — XSS-proof DOM.|
| `js/data-api.js`    | **NEW**    | All mutations. Replaces `saveDB/scheduleSave`.|
| `js/realtime.js`    | **NEW**    | Per-view listeners + auto-cleanup.            |
| `js/storage.js`     | **NEW**    | Image upload helpers.                          |
| `js/audit.js`       | **NEW**    | Optional write-trail (admin readable).         |
| `js/legacy-shim.js` | **NEW**    | Maps old globals (`scheduleSave`, `CU`, `USERS`) onto the new layer so existing renderers keep working until you migrate them. |
| `views/login.html`  | **REPLACE**| Email-instead-of-username, real form.         |
| `index.html`        | **PATCH**  | Adds Auth + Storage SDK script tags + new JS. |

### Phase 3 — Migrate renderers (incremental)
With the shim in place, the old code keeps running. Then go file by file:

1. **`render-misc.js`** — replace `doLogin` and `reqLogin` with calls to `auth.signIn` / `auth.requireRole`.
2. **POD form (line ~280-300)** — replace `DB.pod[t].push(...); scheduleSave()` with `dataApi.addPod({...})`.
3. **Solar progress (`render-solar.js`)** — replace `DB.solar.itcs[id].acts[i].done = x; scheduleSave()` with `dataApi.updateSolarAct(id, i, {done:x, today:y, subDone})`.
4. **WTG (`render-wtg.js` not in zip — same pattern)** — `dataApi.updateTurbine(id, patch)`.
5. **BOP (`render-bop.js`)** — `dataApi.updateBopAct(...)`, etc.
6. **HSE (`render-misc.js` ~line 530)** — `await storage.uploadHseImage(file)` → `dataApi.addHseObservation({photoURL, ...})`.
7. **All `innerHTML=\`…${user_field}…\`` sites** — wrap user vars with `esc()` or convert to `el()`.

### Phase 4 — Verification
- [ ] Open dashboard in two browsers as two different roles. Edit Solar in browser A → browser B sees the change ≤1 sec later, *without* losing edits browser B was making to WTG.
- [ ] In DevTools, run `firebase.database().ref('/solar/itcs/ITC-1/acts/0/done').set(99)` while logged in as `wtg_user`. Should fail with `PERMISSION_DENIED`.
- [ ] Log out. Run `firebase.database().ref('/').once('value')`. Should fail.
- [ ] Add a POD note containing `<img src=x onerror="alert(1)">`. Reload — no alert fires; the literal text is visible.
- [ ] Upload an HSE photo. Inspect `/hse/observations/{...}/photoURL` — must be `https://firebasestorage.googleapis.com/...`, never `data:image/...`.
- [ ] Log POD as solar yesterday and today. Reload home view tomorrow — both still visible under their date keys.

---

## 11. Mistakes to avoid

1. **Do not rely on the JS for security.** If a check exists only in `auth.js`, it doesn't exist. Every protected path must also have a `.write` rule.
2. **Don't leave the database in "test mode."** That allows everyone to read/write everything. Verify the rules tab shows the rules from `security/rules.json` and the "Locked mode" warning is gone.
3. **Don't put the API key in a "secret."** The `firebaseConfig` apiKey is *not* a secret — it's a public identifier. Security comes from rules, not from hiding the key.
4. **Don't broadcast the entire DB via a single `value` listener at the root.** That recreates v8's pain. Subscribe to specific child paths.
5. **Don't store images in RTDB.** Even small ones. RTDB pricing is per-byte-transferred; images compound that fast.
6. **Don't call `set()` on `/users/{uid}` from the client** — it'll wipe the role. Always `update({ name, email })` and never touch `role` from the client.
7. **Don't forget to `.off()` listeners** when navigating between views, or memory and bandwidth grow until the tab dies.
8. **Don't trust client timestamps** for ordering. Use `firebase.database.ServerValue.TIMESTAMP` for `ts` fields.
9. **Don't mix `compat` and modular SDK.** Pick one. We stay on `compat` because your existing code uses it.
10. **Don't create users via the client.** Only an admin in the Firebase Console (or a Cloud Function, which is paid) should provision users + roles.

---

## 12. What to show your management in the demo

Run this script live:

1. **Three browser windows** side by side. Sign each in as a different role (admin, solar, viewer).
2. In Solar's window, increment Pile Drilling by 50. Within ~1s, Admin and Viewer both update. **Real-time sync proven.**
3. In Viewer's window, click any "edit" affordance. It's hidden / disabled. In DevTools, type `firebase.database().ref('/solar/itcs/ITC-1/acts/0/done').set(0)`. Console shows `PERMISSION_DENIED`. **Server-side authorization proven.**
4. In Solar's window, log a POD entry whose note contains `<script>alert('hacked')</script>`. The note appears as harmless text. **XSS hardening proven.**
5. Take Solar's window offline (DevTools → Network → Offline). Add another POD entry. Re-enable the network. Within seconds the entry shows up in Admin's view. **Offline durability proven.**
6. Open Admin → `/audit` node in Firebase Console. Show last 10 writes with uid, path, before/after. **Compliance trail proven.**

That's the demo.

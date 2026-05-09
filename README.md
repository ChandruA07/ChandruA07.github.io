# SWPPL Dashboard v10 — Public dashboard with edit-lock

## What changed from v9

| Area | v9 (email/password auth) | v10 (this version) |
|---|---|---|
| **Login wall** | Modal blocks app until valid email + password | **None.** Site opens straight to dashboard. |
| **Auth provider** | Firebase Email/Password (5 user accounts) | **Anonymous only.** Invisible to users. |
| **`/users` tree** | Required (UID → role mapping) | Removed. Not used. |
| **Edit gating** | Per-role rules (admin, solar, wtg, bop, viewer) | Single shared password (`Site@123`) gates Solar/WTG/BOP/HSE writes. POD is open. |
| **Edit-mode persistence** | Until logout | **Until tab is closed** (sessionStorage). |
| **Storage / Blaze plan** | Required for HSE photos | Removed — HSE photos use base64 fallback. **Spark plan only.** |
| **DPR view** | Did not exist | **New `/dpr` page** auto-generates bullet list from POD. |
| **DPR window** | n/a | Today + Yesterday |
| **DPR bullet format** | n/a | `14:32 · Solar · Pile Drilling · 50 units` |

## Files in this bundle

```
swppl-v10/
├── index.html                   ← REPLACE
├── README.md                    ← this file
├── js/
│   ├── firebase.js              ← REPLACE (anon-auth instead of email/pw)
│   ├── dom.js                   ← unchanged from v9
│   ├── edit-lock.js             ← NEW (replaces v9 auth.js)
│   ├── data-api.js              ← REPLACE (POD open, others gated by editLock)
│   ├── realtime.js              ← REPLACE (adds listenPodWindow)
│   ├── legacy-shim.js           ← REPLACE
│   ├── nav.js                   ← REPLACE (adds DPR route)
│   ├── loader.js                ← REPLACE (loads view-dpr.html, no login wiring)
│   └── render-dpr.js            ← NEW
├── views/
│   ├── login.html               ← REPLACE (edit-lock modal, no email field)
│   ├── sidebar.html             ← REPLACE (DPR item + edit-mode pill)
│   └── view-dpr.html            ← NEW
└── security/
    └── rules.json               ← REPLACE (anon-auth model)
```

The v8 `js/main.js` remains absent (deleted in v9 — do not re-add).
The `seed-users.json` and `storage.rules` from v9 are no longer used and are removed.

## Firebase Console setup — 5 minutes

This is dramatically simpler than v9. You need three things in Firebase: enable Anonymous Auth, deploy the new database rules, that's it.

### Step 1 — Enable Anonymous Authentication (1 min)

1. Open https://console.firebase.google.com/ → project **dashboard-project-8db91**.
2. Left sidebar → **Build** → **Authentication**.
3. **Sign-in method** tab → click **Anonymous** in the providers list.
4. Toggle **Enable** ON → **Save**.

If you previously enabled Email/Password for v9, **leave it on** — it doesn't matter, v10 just won't use it. You can also disable it for cleanliness.

### Step 2 — Deploy the v10 database rules (2 min)

1. Left sidebar → **Build** → **Realtime Database** → **Rules** tab.
2. Open `security/rules.json` from this bundle in a text editor.
3. Select all → copy.
4. In the Firebase Rules editor, select all → paste, replacing what's there.
5. Click **Publish**.

These rules require `auth != null` for read and write. Since every visitor gets an invisible anonymous uid (step 1), this just means "must come from an actual browser visiting the site, not a curl script that doesn't go through anon-auth".

The rules also validate structure: POD entries must have `module` matching `s|w|l|b`, timestamps can't be in the future, strings have length limits, etc. If someone tries to write malformed data, the rule rejects it.

### Step 3 — Optional cleanup (1 min)

If you no longer need the `/users` tree from v9:

1. **Realtime Database** → **Data** tab.
2. Hover over the `users` node → click **×** → confirm.

### Step 4 — Disable Storage (if you enabled it for v9) — Optional

If you upgraded to Blaze for v9 and want to stay on Spark for v10:

1. Console → ⚙ Settings → **Usage and billing** → **Modify plan** → switch back to **Spark**.

You don't need to delete the bucket; just stop using it.

## That's the entire Firebase setup.

No user accounts to create.
No `/users` tree to seed.
No Storage rules to deploy.
No Blaze upgrade.

## Test it (5 min)

1. Drop the bundle into your project folder, replacing files.
2. Live Server → open the page.
3. **Hard reload (Ctrl+Shift+R)** to clear v9 caches.
4. Console should show:
   ```
   [Firebase v10] Initialised — project: dashboard-project-8db91
   [shim v10] Legacy globals re-mapped onto editLock + dataApi.
   [Firebase v10] Anonymous session: aB3xK9pQ…
   ```
   No login modal should appear.
5. Click **POD** in the sidebar → click **Submit Solar POD** → fill in fields → submit. Entry should save without any password prompt.
6. Click **DPR (Auto)** in the sidebar → see the entry as a bullet under "Today".
7. Open the same page in a second browser/device. Submit a POD entry there. Watch the first device — the new bullet appears in DPR within 1-2 seconds. Real-time sync confirmed.
8. Try editing Solar progress (any module page with sliders/inputs). The edit-lock modal pops up asking for the password. Enter `Site@123` → unlocked. Sidebar pill changes to "🔓 Edit mode". Edit goes through, syncs to other device.
9. Close the tab, reopen → back in view-only. Pill reads "🔒 View mode".

## Customising the password

Open `js/edit-lock.js`, find:

```js
const DEMO_PASSWORD = 'Site@123';
```

Change to whatever you want. Anyone with DevTools can read this string — it's a UX gate, not real security. For a demo it's fine; for production you'd switch back to Firebase Auth + per-user accounts (i.e., go back to v9).

## Hosting on GitHub Pages

1. Push the project folder to a GitHub repo.
2. Repo → **Settings** → **Pages** → Source: `Deploy from branch`, Branch: `main` / `(root)` → Save.
3. Wait ~1 min. URL: `https://<username>.github.io/<repo>/`
4. **Important:** In Firebase Console → Authentication → **Settings** → **Authorized domains** tab → click **Add domain** → enter `<username>.github.io` → Save. Otherwise anonymous sign-in will be blocked when the site is opened from the GitHub URL.

## Common issues

| Symptom | Cause | Fix |
|---|---|---|
| Console: `Anonymous sign-in failed: auth/admin-restricted-operation` | Anonymous Auth not enabled | Step 1 above |
| Console: `auth/unauthorized-domain` when opening from GitHub Pages | Domain not whitelisted | "Hosting on GitHub Pages" step 4 |
| Console: `PERMISSION_DENIED` on writes after deploying rules | Rules deployed but Anon Auth disabled | Step 1 above |
| Site opens but "Edit mode" pill missing | Old sidebar.html cached | Hard reload (Ctrl+Shift+R) |
| Edit-lock asks for password but none works | Wrong DEMO_PASSWORD or stale JS | Verify `js/edit-lock.js` line 21, hard reload |
| POD entries don't sync between devices | Anon Auth disabled, OR rules are wrong | Console → Auth → Anonymous enabled? Then check Rules tab matches `rules.json` |
| DPR page is empty even though POD has entries | DB.pod hydration didn't happen | Check console for `[shim v10]` line; if missing, `legacy-shim.js` failed to load |

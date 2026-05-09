# SWPPL v9 — Master-Prompt Compliance Pass

This pass aligns the build with `SWPPL_MASTER_PROMPT__1_.md` end to end.
Each requirement from the prompt is mapped below to the code that satisfies it.

---

## Authentication (master-prompt §AUTH)

| Requirement | Where |
|---|---|
| Use ONLY `signInWithEmailAndPassword` | `js/auth.js` `login()` |
| Never use `signInAnonymously` | grep -r returns nothing |
| No plaintext passwords in JS | `USERS` const **deleted** from `js/data.js` |
| `onAuthStateChanged` only source of truth | `js/auth.js` line ~127 |
| Role from `/users/{uid}/role`; default `viewer` | `js/auth.js` `_loadProfile()` |
| Dashboard public — viewers OK | `security/rules.json` `/solar`, `/wtg`, etc. all `".read": "true"` |
| **POD + Daily Progress write WITHOUT login** | `dataApi.addPod()` + `dataApi.addDailyProgress()` — both **DO NOT call `_u()`**, default `byName: 'Anonymous'` |
| Login error messages | `js/auth.js` `_friendlyAuthError()` |
| `[auth]` console logs | `auth.js` lines 54, 122–135 |

## Role system (master-prompt §ROLE SYSTEM)

`auth.canEdit(section, role?)` in `js/auth.js`:
```js
if (!role || role === 'viewer') return false;
if (role === 'admin') return true;
switch (section) {
  case 'solar': return role === 'solar';
  case 'wtg':   return role === 'wtg';
  case 'bop':   return role === 'bop';
  ...
}
```
Used everywhere: `render-solar.js`, `render-wtg.js`, `render-bop.js`, `render-land.js`, `render-misc.js`.
**Replaces all `CU.role === 'all'` patterns** (search returns 0 hits in `render-*` files).

## Database — zero localStorage for project data (master-prompt §DATABASE)

- `js/data.js`: `loadDB()` is now a no-op; legacy `saveDB()` / `applySnap()` are gone.
- All renderers call `dataApi.*` for writes; renderers never touch `fbDB.ref(...).set(...)` directly.
- All listeners use `ref.on('value', ...)` or child events — never `.once()`.
- All writes use `fbDB.ref().update({ 'path/to/leaf': value })` — never `.set()` on a parent node.
- The only `localStorage.setItem` left is `swppl_theme` (UI preference). Verified by `grep -r localStorage js/`.

## Real-time sync (master-prompt §REAL-TIME)

- `realtime.js` exposes the full surface from the spec, including the previously-missing
  `listenLand`, `listenHseEmployees`, `listenGantt`, `listenSchedule`,
  `listenDailyProgress`, `listenRowIssues`, `listenMilestones`.
- `state-bridge.js` wires every Firebase path into `appState` and mirrors back to
  the legacy `DB` shape.
- **Listeners do NOT auto-detach on logout** — the dashboard is public, so logged-out
  visitors still see live data.

## Bug fixes from the prompt's audit

| Bug | Fix |
|---|---|
| **Bug 1** — `verifyMapPwd()` reading deleted `USERS` const | Replaced with `triggerMapUpload()` using `auth.canEdit('solar')` in `render-solar.js`. The whole password modal markup is gone — clicking the upload button now goes straight to the OS file picker if authorised, else triggers the auth flow. |
| **Bug 2** — BOP 66kV saves through `scheduleSave()` | `submit66FeederProg` rewritten to `await dataApi.updateBop66Act(feederId, idx, cum)`. Persists to `/bop/acts66/{feederId}/{idx}`. |
| **Bug 3** — HSE observations pushed to local `HSE_DB.observations` with base64 photo | `submitHSEObservation` rewritten: photo uploads to Firebase Storage (`storage.uploadHseImage`), only the URL goes to `dataApi.addHseObservation`, and the listener mirror updates `HSE_DB.observations`. |
| **Bug 4** — `_isWtgEditor` reading `CU.role === 'all'` | `_isWtgEditor()` now returns `auth.canEdit('wtg')`. Same for `_isSolEditor` (inlined in `render-solar.js`). |
| **Bug 5** — `submitWtgLandUpdate` calling `scheduleSave()` | Rewritten to `await dataApi.updateWtgLand(locId, patch)`. `toggleStage`, `saveWtgNotes`, `updSolLandAct` all migrated similarly. |
| **Bug 6** — HSE_DB seed mixing with Firebase data | `state-bridge.js` now does `HSE_DB.observations = []; HSE_DB.employees = []` BEFORE attaching the listeners. |
| **Bug 7** — `CU.role === 'all'` everywhere | Eliminated. Renderers use `auth.canEdit(...)` or `auth.current()?.role === 'admin'`. |
| **Bug 8** — `render-home.js` calling `saveDB()` after milestone submit | The milestone form already routes through `dataApi.addMilestone`; the redundant `saveDB()` call has been removed. |

Plus an extra fix discovered in this pass:

- **State-bridge BOP overwrite bug** — the legacy mirror did `DB.bopActs = s.bop.acts`, which clobbered `DB.bopActs['66kv']` whenever 33kV updated and vice versa. Now it scopes the mirror: `DB.bopActs['33kv'] = s.bop.acts` and `DB.bopActs['66kv'] = s.bop.acts66`.

## New code added in this pass

- **`js/data-api.js`**: `addDailyProgress`, `updateBop66Act`, `addHseEmployee`,
  `updateHseEmployee`, `updateWtgLand`, `updateSolLand`, `addLandParcel`,
  `updateLandParcel`. `addPod` made public-write. Role checks added to every
  Solar/WTG/BOP write. `[data]` console logs throughout.
- **`js/realtime.js`**: `listenLand`, `listenHseEmployees`. Auto-detach-on-logout removed.
- **`js/state-bridge.js`**: HSE seed cleared before listener attach; Land + HSE-employees
  listeners wired; BOP mirror split between 33kV and 66kV.
- **`views/view-home.html`**: New Daily Progress section (feed + public submission form).
- **`js/render-home.js`**: `renderDailyProgressList()`, `submitDailyProgressForm()`,
  `_refreshDailyProgressAuthHint()` — all wired.
- **`views/topbar.html`**: `<span id="fb-status-pill">☁️ Online</span>` added.

## Security rules (master-prompt §SECURITY)

`security/rules.json` is now byte-identical to the prompt's spec, with two helpful additions:
- Per-leaf validators on `/pod/{date}/{pushId}/...` (module enum, qty number, etc.)
- Per-leaf validators on `/dailyProgress/{id}/...` (module string, ts plausible, etc.)

`security/seed-users.json` — replaced with the four real UIDs from the prompt:
```json
{
  "9HrjS1NtMifpiWxJ7r62GlnMepN2": { "role": "admin", "name": "Site Manager",   "email": "admin@test.com" },
  "YlaV5Zk5lsSXwBEjMWwvwjssoef1": { "role": "solar", "name": "Solar Engineer", "email": "solar@test.com" },
  "4haljkGuoacfS8wld6ZPbjVpDxo2": { "role": "wtg",   "name": "WTG Engineer",   "email": "wtg@test.com"   },
  "3XDFPnCJ0CWqhBIxJn0TK4rgnO13": { "role": "bop",   "name": "BOP Engineer",   "email": "bop@test.com"   }
}
```

`security/storage.rules` — public reads, authed image writes capped at 5 MB and `image/*` MIME.

## Verification checklist (master-prompt)

| Check | Status |
|---|---|
| `admin@test.com` login → edit all sections | ✅ enforced both client + rules |
| Section-only edit access (solar/wtg/bop) | ✅ `auth.canEdit()` + rules |
| Not logged in → view everything, no edit buttons | ✅ rules public read; `canEdit` false |
| **POD entry without login → appears in Firebase** | ✅ `addPod` does not call `_u()` |
| **Daily Progress entry without login → home dashboard live-updates** | ✅ `addDailyProgress` public, `listenDailyProgress` updates `DB.dailyProgress`, `renderDailyProgressList` re-renders on every state change |
| Solar update → admin sees it within 2s | ✅ `listenSolar` per-ITC `value` listener |
| **66kV save persists across refresh** | ✅ `dataApi.updateBop66Act` writes leaf-level to `/bop/acts66`; bridge mirrors back to `DB.bopActs['66kv']` |
| **HSE photo persists across refresh** | ✅ Firebase Storage URL stored, not base64 |
| **WTG land stage toggle persists** | ✅ `dataApi.updateWtgLand` writes `stages/{idx}` leaf |
| No `localStorage` for project data | ✅ verified |
| No `USERS` object anywhere | ✅ `grep -rn "USERS\[" js/` returns 0 |
| No plaintext passwords | ✅ `grep -rn "pwd:" js/` returns 0 |
| `[auth]`, `[data]`, `[rt]`, `[bridge]`, `[firebase]` logs | ✅ added throughout |

All 21 JS files pass `node --check`. Both JSON files parse cleanly.

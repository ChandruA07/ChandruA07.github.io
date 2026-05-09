# SWPPL Dashboard v9 — Quickstart

This bundle is a **drop-in upgrade** for your existing `swppl-v8` project. Read `ARCHITECTURE.md` for the full design; this file is just "what to do next."

## What's in this bundle

```
swppl-v9/
├── ARCHITECTURE.md          ← THE PLAN (read this first)
├── README.md                ← this file
├── index.html               ← REPLACE the v8 index.html
├── js/
│   ├── firebase.js          ← REPLACE
│   ├── dom.js               ← NEW (XSS-safe helpers)
│   ├── auth.js              ← NEW (real Firebase Auth)
│   ├── data-api.js          ← NEW (all writes)
│   ├── realtime.js          ← NEW (listeners)
│   ├── storage.js           ← NEW (image uploads)
│   └── legacy-shim.js       ← NEW (bridges old code to new layer)
├── views/
│   └── login.html           ← REPLACE (email instead of username)
└── security/
    ├── rules.json           ← Realtime DB rules → paste in console
    ├── storage.rules        ← Storage rules     → paste in console
    └── seed-users.json      ← Template for /users tree
```

You **add** these to your existing `swppl-v8/js/` and `swppl-v8/views/` folders, **replacing** `firebase.js`, `index.html`, and `views/login.html`.

The other v8 files (`render-*.js`, `data.js`, `calc.js`, etc.) keep working unchanged — the `legacy-shim.js` translates old globals into the new layer.

## 30-minute setup checklist

1. **Firebase Console → Authentication → Sign-in method**: enable **Email/Password**.
2. **Firebase Console → Authentication → Users → Add user** (×5):
   - `admin@swppl.demo`  / strong password
   - `solar@swppl.demo`
   - `wtg@swppl.demo`
   - `bop@swppl.demo`
   - `view@swppl.demo`

   Copy each generated UID.
3. **Firebase Console → Realtime Database → Rules**: paste contents of `security/rules.json` → **Publish**.
4. **Firebase Console → Storage → Rules**: paste contents of `security/storage.rules` → **Publish**.
5. **Firebase Console → Realtime Database → Data**: at the root, hover ⋮ → **Import JSON**.
   Open `security/seed-users.json`, replace the five `REPLACE_WITH_*_UID` placeholders with the real UIDs from step 2, then import that file into the `/users` path.

   *Critical:* import at `/users`, not at root. If you import at root you'll wipe everything else.
6. Copy this bundle into your project:
   ```
   cp -r swppl-v9/js/*       swppl-v8/js/
   cp    swppl-v9/views/login.html swppl-v8/views/
   cp    swppl-v9/index.html swppl-v8/
   ```
7. Open `swppl-v8/js/firebase.js` (the new one you just copied) and verify the `firebaseConfig` matches your project. The values from your old `firebase.js` are preserved by default.
8. Serve and open: `cd swppl-v8 && python3 -m http.server 8080` → `http://localhost:8080`.

## What you'll see immediately (no renderer migration needed)

- Login modal asks for **email** (not username). Real Firebase Auth runs.
- The topbar shows the role next to the user's name.
- POD entries persist date-by-date — yesterday's data is visible.
- Multi-device sync works correctly: open in two browsers, edit on one, see the change on the other within ~1 second.
- Audit trail accumulates under `/audit` (admin-readable).

## What you should migrate next (incremental)

The shim makes everything work today, but to fully realize the architecture you should migrate the renderers one at a time. In rough priority order:

1. **HSE form** in `render-misc.js` (~line 530) — replace base64 photo write with `await storage.uploadHseImage(file)` then `await dataApi.addHseObservation({photoURL, …})`.
2. **POD form** (~line 280-300) — replace the array push + `scheduleSave()` with `await dataApi.addPod({module, activity, qty, mp, contractor, notes})`.
3. **Solar progress** in `render-solar.js` — replace direct `DB.solar.itcs[id].acts[i].done = x` with `dataApi.updateSolarAct(id, i, {done, today, subDone})`.
4. **WTG / BOP** progress writes — same pattern.
5. **`innerHTML` interpolation sites** — wrap interpolated user fields with `esc(…)` from `dom.js`. Search `js/` for `innerHTML.*\$\{` to find them.

After each migration, search the JS for the old global (`scheduleSave`, `CU.pwd`, `USERS[`, `FileReader.readAsDataURL`) — when none remain, you can delete `legacy-shim.js`.

## Verifying security in the demo

| Test                              | Expected                                          |
|-----------------------------------|---------------------------------------------------|
| Open page, do not sign in.        | `firebase.database().ref('/').once('value')` from DevTools fails with `PERMISSION_DENIED`. |
| Sign in as `viewer`. Try to write to `/solar`. | `PERMISSION_DENIED`. |
| Sign in as `solar`. Write to `/wtg/turbines/T-1/notes`. | `PERMISSION_DENIED`. |
| Sign in as `solar`. Write to `/users/{adminUid}/role` with value `'solar'`. | `PERMISSION_DENIED`. |
| Sign in as `solar`. Edit a Solar ITC sub-activity. | Succeeds; visible on every other device within 1s. |
| POD entry with note `<img src=x onerror=alert(1)>`. | Renders as literal text; no alert. |
| HSE photo upload. | Goes to `gs://…/hse/{date}/…`; DB stores `https://…` URL only. |

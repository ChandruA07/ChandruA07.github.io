# Deployment Guide — v11 (Phase 7)

Prereqs: `npm i -g firebase-tools`, `firebase login`, and `firebase use <your-project-id>` from the project root (a `firebase.json` is already present and maps hosting/database/storage).

## Step 1 — One-time Console provisioning (required before the app is usable under the new rules)

1. **Enable auth:** Firebase Console → Authentication → Sign-in method → **Email/Password → Enable**.
2. **Create users:** Authentication → Users → *Add user*, once per account in `security/seed-users.json` (admin, solar, wtg, bop, land, proc, store, plan, view — use your own strong passwords). Copy each UID.
3. **Seed roles:** edit `security/seed-users.json`, replacing each `REPLACE_WITH_UID_*` key with the real UID (delete the `_comment` line), then Realtime Database → Data → `⋮` on root → *Import JSON* targeted at `/users`. Users can never change their own role afterwards — the rules only let admin write `role`.

## Step 2 — Deploy rules FIRST, then the app

```bash
# database rules (the actual security boundary)
firebase deploy --only database

# storage rules
firebase deploy --only storage

# static app (Hosting)
firebase deploy --only hosting
```

Verify in the Console that Realtime Database → Rules now shows the role-based ruleset (root `.write: false`) and the "public rules" warning is gone.

## Step 3 — Post-deploy verification (5 minutes, from TESTING.md §C)

1. Open the hosted URL logged out → data does not load (reads require auth). Sign in as `viewer` → everything renders read-only.
2. Sign in as `solar@…`; in DevTools run
   `firebase.database().ref('/wtg/meta/count').set(0)` → must print **PERMISSION_DENIED**.
3. Sign in as `proc@…` and walk the vendor→PO flow; approve must fail until you sign in as admin.
4. Install the PWA (address-bar install icon) and reload with DevTools → Network → Offline: the shell must open.

## Rollback plan

The pre-change state is fully recoverable:

1. **App:** redeploy the original ZIP — unzip `swppl-v10_14-final.zip` into a clean folder and `firebase deploy --only hosting` from there (Hosting keeps prior releases too: Console → Hosting → *Rollback* is one click).
2. **Rules:** the old public rules are archived in this bundle at `security/rules.demo-public.json`. Copy them over `database.rules.json` and `firebase deploy --only database` (or paste into Console → Rules → Publish). **Warning:** that restores world-writable data — only for reverting a broken demo, never with real data present.
3. **Data:** the new modules only *added* nodes (`/vendors`, `/purchaseOrders`, `/inventory`, `/planning`, `/documents`); no existing node's shape changed, so rolling the app back leaves old features reading exactly the data they always did. The new nodes can be deleted from the Console if a clean slate is wanted.
4. **Auth:** created users can be disabled/deleted in Console → Authentication with no effect on the v10 demo gate.

## Alternative static hosts
The app remains a self-contained static bundle (views inlined into `index.html`), so GitHub Pages/Netlify still work for Hosting — but rules and Storage rules must still be deployed to Firebase itself, and the service worker requires https (or localhost).

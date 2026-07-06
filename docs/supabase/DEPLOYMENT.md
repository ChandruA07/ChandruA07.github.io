# DEPLOYMENT.md — Supabase build

## 0. What you need
A Supabase project (free tier works) and any static host (Vercel, Netlify,
GitHub Pages, or Firebase **Hosting** kept as a static host only — the
Firebase *database* is no longer used).

## 1. Create the Supabase project
supabase.com → New project → note the **Project URL** and **anon public
key** (Settings → API).

## 2. Run the SQL (order matters)
In the Supabase SQL editor, run each file in full:

1. `sql/schema.sql` — tables, views, RPCs, triggers, realtime publication.
2. `sql/seed.sql` — demo data (generated from `firebase-seed.json`;
   regenerate any time with `npm run seed:generate`).
3. `sql/storage-buckets.sql` — `photos` + `documents` buckets and policies.
4. **Phase 6 only** — `sql/rls-policies.sql`. Until you run this, the
   project behaves like the old public demo (open read/write). Running it
   enables RLS, arms the RPC guards, and flips `security_enforced`.

All four files are idempotent.

## 3. Point the app at your project
Edit **`js/supabase-config.js`** (the only file you edit):

```js
window.SUPABASE_CONFIG = {
  url:     'https://abcd1234.supabase.co',
  anonKey: 'eyJ…',
};
```

The anon key is not a secret; RLS is the security boundary (SECURITY.md).

## 4. Create the users (Phase 6)
Supabase dashboard → Authentication → Providers → enable **Email** (and
disable public signups if you want invite-only).

Then Authentication → Users → *Add user* for each account. The suggested
demo set matches the login modal's hints:

| Email | Role to assign |
|---|---|
| solar@swppl.demo | solar |
| wtg@swppl.demo | wtg |
| bop@swppl.demo | bop |
| land@swppl.demo | land |
| proc@swppl.demo | procurement |
| store@swppl.demo | store |
| plan@swppl.demo | planner |
| admin@swppl.demo | admin |

Every signup lands in `public.users` as `viewer` (trigger). Promote them by
running `sql/seed-users.sql` (edit the emails/roles at the top) in the SQL
editor, or later from the app's Team panel as an admin.

Pick strong passwords — these are real credentials now, not the demo list.

## 5. Static hosting
The app is plain static files. Examples:

* **Netlify/Vercel:** drag the project folder (or connect the repo). No
  build step, no environment variables — config is `js/supabase-config.js`.
* **GitHub Pages:** push and enable Pages.
* **Firebase Hosting (static only):** `firebase deploy --only hosting`
  using `legacy/firebase.json` as a starting point if you must stay there.

Serve over HTTPS (the service worker and installable PWA require it).

## 6. Post-deploy checklist
Run TESTING.md **§C** — the live checks that cannot run in CI
(auth round-trip, realtime over websocket, storage upload, PWA install).

## Rollback plan
The migration never touched the Firebase project; it is still intact.

1. Redeploy the pre-migration ZIP (`swppl-v11-firebase-hardening.zip`) to
   your static host — that build points at Firebase and works immediately.
2. Data written to Supabase after cut-over is **not** back-synced to
   Firebase; export it first if needed
   (`copy (select * from pod_entries) to stdout with csv header`, or the
   dashboard's CSV exports).
3. The Supabase project can be paused, not deleted, until you're sure.
4. Everything Firebase-specific this migration replaced is preserved under
   `legacy/` for diffing.

## Local development / CI
`tools/run-tests.sh` reproduces the entire verification against a local
PostgreSQL 16 (`npm i` first; see TESTING.md). The local `auth` schema stub
in `schema.sql` makes the same SQL run on plain Postgres and on Supabase.

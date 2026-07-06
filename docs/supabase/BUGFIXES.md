# BUGFIXES.md — bugs found and fixed in the Supabase-migration round

Per the brief: only real bugs actually found, with where, how found, and
the fix. Bugs fixed in earlier rounds are in `docs/BUGFIXES.md` (v11) and
are not repeated. Each fix below has a regression assertion in the suites.

## 1. `window.sb` shadowed by the sidebar element — boot crash when the SDK fails to load
* **Where:** `js/supabase-init.js` (early-return path) + every `global.sb`
  consumer. `index.html`/`views/sidebar.html` define `<div id="sb">`;
  browser *named access* makes `window.sb` resolve to that DIV whenever no
  script assigned the global.
* **How found:** `tools/test-new-modules.js` §10 (fallback boot without
  supabase-js) crashed with `_sb(...).from is not a function` instead of
  degrading to demo mode.
* **Impact if shipped:** a CDN hiccup or ad-blocker would hard-crash boot
  instead of falling back to the read-only baseline UI.
* **Fix:** `supabase-init.js` now explicitly defines `window.sb = null` in
  every path (an own property shadows named access), and all consumers
  (`data-api.js`, `realtime.js`, `storage.js`, `auth.js`) verify
  `typeof sb.from === 'function'` rather than mere truthiness. `realtime.js`
  additionally degrades to no-op listeners with a single loud warning.

## 2. `shapeMap.planTaskVal` dropped every task dependency in listener payloads
* **Where:** `js/shape-map.js` `planTaskVal(r, predecessorIds)` — written to
  accept an id *array*, while `realtime.listenPlanTasks` passes an
  `{id:true}` *map*; objects have no `.length`, so `predecessorIds` was
  silently emitted as `null`.
* **How found:** `tools/test-new-modules.js` critical-path check — with no
  edges, "Cabling" appeared on the critical path.
* **Impact if shipped:** the Gantt would render tasks without dependency
  arrows and critical-path highlighting would be wrong, while the database
  itself was correct.
* **Fix:** mapper accepts array or map; new assertion in
  `tools/test-migration.js` ("listenPlanTasks val carries predecessorIds
  map") locks it in.

## 3. `createPO` wrote `po_status_history` directly — dead on arrival under Phase-6 RLS
* **Where:** `js/data-api.js` `createPO` + `sql/rls-policies.sql`, which
  (by design) revokes direct writes on the history table.
* **How found:** `SECURITY=1` run of the migration suite: permission denied
  on the very first PO created under RLS.
* **Fix:** the initial `draft` history row is now written by an
  `AFTER INSERT` trigger on `purchase_orders` (`po_on_create`), matching
  the "history is RPC/trigger-only" invariant; the client insert was
  removed. Verified in both suite modes.

## 4. WTG offline-fallback writes keyed turbines by ARRAY INDEX, canonical data by ID
* **Where:** original `js/render-wtg.js` `_persistPathways` /
  `_persistTurbineIssues` fallbacks: `fbDB.ref('wtg/turbines/' + tIdx)`
  (the array index in the local `DB.wtg.turbines`), while every other
  write path keys `/wtg/turbines/{id}` (e.g. `MBI-12`). If the fallback
  ever fired, it would create a parallel numeric-keyed record and corrupt
  the tree.
* **How found:** Phase-0 file-by-file read while porting the 12 stray
  Firebase call-sites.
* **Fix:** fallbacks now call the new `dataApi.setTurbine(id, t)` (id-keyed,
  audited, stamped). The zero-point and custom-acts raw fallbacks, which
  bypassed audit stamping, were removed for the same reason.

## 5. Solar `subScope` leaf write bypassed the data layer entirely
* **Where:** original `js/render-solar.js` (~line 710) wrote
  `solar/itcs/{id}/acts/{i}/subScope` straight to `fbDB` — no role gate, no
  `lastBy/lastAt`, no audit — with a comment admitting it sidestepped the
  "strict dataApi schema".
* **Fix:** first-class `dataApi.setSolarActSubScope(itcId, idx, scope)`
  (gated, stamped, audited, and a plain column in `solar_activities`).
  Same treatment for the ITC-map URL write (`dataApi.setItcMap`) and the
  land location delete (`dataApi.deleteWtgLandLoc`), which had the same
  bypass pattern.

## 6. Test-harness bugs caught while validating (not app bugs, recorded for honesty)
* `record_transfer`'s first draft updated the OUT leg's `transfer_id`
  after insert — correctly rejected by our own append-only trigger; the
  shipped version pre-assigns a shared `transfer_id` at INSERT time.
* The pg driver returns `date`/`timestamptz` as JS `Date` objects while
  PostgREST returns strings; the shim now matches PostgREST so the code
  under test sees production value types (this *masked* nothing — it made
  the tests faithful).

## Carried-forward guarantees re-verified (no regressions)
Root-blob overwrites (20 concurrent POD writes → 20 rows), date-keyed POD,
Storage-URLs-not-base64, stock strictly Σ(ledger), dependents guard,
XSS-escaping at render (payloads stored verbatim, escaped exactly once by
`dom.js esc()` — asserted in suites 3, 7 and 8).

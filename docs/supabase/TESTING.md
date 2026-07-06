# TESTING.md — what was tested, how, and the results

## A. Automated suites (all run against real PostgreSQL 16)

The test environment stands up a **real Postgres 16**, runs `sql/schema.sql`
and `sql/seed.sql` on it, and exercises the **actual shipped JavaScript**
(`js/data-api.js`, `js/realtime.js`, `js/shape-map.js`, plus full app boots
in jsdom) through `tools/supabase-mock.js`, a PostgREST-subset shim that
translates supabase-js query-builder calls into parameterized SQL. Dates and
timestamps are returned as strings to match PostgREST exactly.

One command: `npm test` (= `tools/run-tests.sh`). Final results:

| # | Suite | Checks | Result |
|---|---|---|---|
| 1 | `sql/schema.sql` clean install (empty DB) | 38 tables, 31 audit triggers, views, RPCs | ✅ |
| 2 | `sql/seed.sql` install | 6 ITCs · 96 solar acts · 26 turbines · 40 BOP acts · 17 BOP assets · 25 ROW · 17 milestones · 3+11 HSE · 243 trigger-audit rows | ✅ |
| 3 | `tools/test-migration.js` (permissive, Phase-2 parity) | **106** | ✅ all pass |
| 4 | `SECURITY=1 tools/test-migration.js` (RLS applied, run as `authenticated` with JWT claims — the brief's Phase-6 step 4) | **106** | ✅ all pass |
| 5 | `tools/test-rls.sh` role-by-role allow/deny matrix | **32** | ✅ all pass |
| 6 | `tools/smoke-test.js` — the v11 UI suite (100+ assertions: loader, nav, POD form, contractors dropdown, activity search, marquee, XSS-escaping, map intro…), adapted only in its stub layer | all | ✅ all pass |
| 7 | `tools/smoke-test-supabase.js` — full app boot in jsdom over the pg-backed client: real seed data hydrates listeners → state-bridge → renderers; POD submitted through the booted app lands in Postgres; XSS-escaped in output | **21** | ✅ all pass |
| 8 | `tools/test-new-modules.js` — v11 modules end-to-end in jsdom over real Postgres (PO lifecycle, ledger math, DAG + critical path, documents, audit, all 7 views render, PWA assets, demo fallback) | **67** | ✅ all pass |

**Baseline:** before migration, the original `tools/smoke-test.js` and
`tools/test-new-modules.js` were run on the pristine ZIP contents — both
fully green — anchoring the "existing features intact" comparisons.

## B. What the suites specifically cover (brief's Phase 5 list)

* **Existing features after migration** — POD round-trip incl. resources
  jsonb, status flow + DPR auto-log; solar act/live/meta/subScope; WTG
  patch + whole-doc save; all four BOP sections incl. array-index parity;
  land locs/blocks/leases/parcels tree; HSE by legacy id AND uuid;
  milestones/ROW/blockers; gantt/schedule/zero-point/custom-acts/KPI
  singletons; snapshots; notifications with legacy `readBy` shape; the
  hydration of all of it into the untouched render layer (suites 6–8).
* **Every new module** — vendors (validation, archive guard), PO lifecycle
  (state machine, Σ line items, freeze after approval, history), inventory
  (stock = Σ ledger, low-stock case, transfers atomic + stock-neutral,
  append-only at trigger level), planning (dates, self-dep, dependent-delete
  guard at app AND FK level, critical path, baseline), documents
  (version pointer), audit (both layers), reports/audit views render,
  PWA assets complete.
* **Concurrent writes** — 20 simultaneous POD writes from two users → 20
  rows (no overwrite regression); 5 concurrent line-item adds → exact
  total; two racing PO approvals → row lock lets exactly one through with
  exactly one history row.
* **Security** — the whole feature suite re-run under enforced RLS (#4),
  the explicit allow/deny matrix (#5), anonymous fully denied, ledger
  immutable even for admin, self-promotion blocked, module_state key
  scoping, PO approval admin-only server-side.
* **Regression guards for bugs found during this round** — see BUGFIXES.md
  (each has an assertion that now fails if reintroduced).

## C. NOT tested here — requires a hosted Supabase project (post-deploy checklist)

Stated plainly per the brief's "do not claim a feature works if it was not
actually tested": this sandbox has no network access to a live Supabase
instance, so the following were **not** executed and must be checked once
after deployment:

1. **Auth round-trip** — sign in as each of the 8 accounts; wrong-password
   and role-mismatch messages; session survives reload; logout detaches
   channels.
2. **Live websocket delivery** — open two browsers; a POD submit in one
   appears in the other without reload; same for a PO status change and a
   notification bell increment. (The row→payload→callback mapping *is*
   tested with synthetic events; the transport is not.)
3. **Storage uploads** — HSE photo, POD photo, ITC map, document file;
   verify public URLs render and >5 MB/>10 MB rejections.
4. **PWA install** — Lighthouse installability over HTTPS; shell loads
   offline; data resumes on reconnect.
5. **Realtime publication** — confirm `supabase_realtime` includes the
   tables (schema.sql adds them; the dashboard → Database → Replication
   page shows the list).

## D. Running it yourself

```bash
npm i                      # pg + jsdom (test-only deps)
# have PostgreSQL 16 reachable (defaults: socket /tmp, user postgres)
npm test                   # everything, ~2 minutes
```
Individual suites: `npm run test:migration | test:rls | test:ui | test:boot | test:modules`.

# SECURITY.md — Supabase build

## The model in one paragraph
Authentication is **Supabase Auth** (email/password). Authorization is
**Row Level Security in Postgres** (`sql/rls-policies.sql`) plus role
guards inside the SQL RPCs. The client-side `auth.canEdit()` gates are
**UX only** — a tampered client gets its writes rejected by the database.
The anon key in `js/supabase-config.js` is not a secret (same as the old
Firebase apiKey); RLS is the boundary.

## Phased security (why the app works before Phase 6)
`app_settings.security_enforced` starts `false`:
* RLS is not enabled yet, so behaviour matches the old public demo
  (Phases 2–5 build and test features first, per the brief).
* Every guarded RPC calls `rpc_require(...)`, which **no-ops while the
  switch is off** and enforces once it's on.

Running `sql/rls-policies.sql` is Phase 6: it enables RLS on every table,
creates the policies, flips `merge_module_state`/`set_module_state` to
SECURITY INVOKER (so key-prefix policies govern them), and sets
`security_enforced = 'true'`. One file = the whole switch.

## Role & permission matrix (post-Phase-6)

| Capability | solar | wtg | bop | land | procurement | store | planner | viewer | admin |
|---|---|---|---|---|---|---|---|---|---|
| Read all project data | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| POD / daily progress / next-day plan | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✖ | ✔ |
| Solar tables + `solar/*` state | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| WTG turbines + `wtg/*` state | ✖ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| BOP activities/assets | ✖ | ✖ | ✔ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| Land locs/blocks/leases/parcels | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ | ✖ | ✖ | ✔ |
| HSE observations/employees | ✔* | ✔* | ✔* | ✔* | ✔* | ✔* | ✔* | ✖ | ✔ |
| Milestones / ROW / blockers / gantt / schedule | any editor | | | | | | | ✖ | ✔ |
| Vendors + POs (create, line items while draft) | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ | ✖ | ✔ |
| **Approve PO** | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | **✔ (RPC-enforced)** |
| Inventory items + ledger INSERT | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ | ✖ | ✔ |
| Ledger UPDATE/DELETE | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | **✖ (trigger blocks even admin)** |
| Plan tasks + dependencies | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ | ✖ | ✔ |
| Set baseline | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| Documents (file/version) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✖ | ✔ |
| Archive documents | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| Read audit_log | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| Assign roles (`users.role`) | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✖ | ✔ |
| Anonymous (no session) | **no read, no write** (default-deny) | | | | | | | | |

\* HSE writes are open to any editor role (matching v11 behaviour: any
engineer can raise/close an observation).

Self-promotion is blocked: the `users` UPDATE policy lets a user change
their own `name` but a non-admin cannot change any `role` (verified in the
RLS matrix suite).

## What Phase 6 changed, exactly
1. `alter table … enable row level security` on all 31 business tables +
   `force row level security` (the table owner is not exempt).
2. Read policy: `authenticated` only. Anonymous gets nothing.
3. Write policies per the matrix above (`write_scoped` per table).
4. `po_line_items`, `po_status_history`, `plan_baselines`,
   `document_versions`: direct writes **revoked** — they change only through
   the transactional RPCs/triggers.
5. `stock_movements`: INSERT-only policy; UPDATE/DELETE are additionally
   blocked by a trigger *below* RLS, so even a superuser console session
   can't silently rewrite the ledger.
6. `module_state` writes scoped by key prefix (`solar/%` → solar, …).
7. `merge_module_state`/`set_module_state` become SECURITY INVOKER.
8. `security_enforced` flips to `true`, arming every `rpc_require` guard
   (PO approval = admin, transfers = store, baseline = admin, doc RPCs =
   any editor, jsonb-patch RPCs = owning module role).
9. `js/auth.js` contains **no credential list** in supabase mode. The
   `ACCOUNTS` array holds shorthand→email mapping for the login modal and
   demo-fallback credentials that only function when supabase-js is absent
   (a clearly-labelled non-security preview mode, unchanged from v11's
   documented behaviour).
10. Storage: bucket policies in `sql/storage-buckets.sql` — upload needs a
    signed-in non-viewer; delete needs uploader or admin; size/MIME limits
    enforced in bucket config (server) and js/storage.js (UX).

## Auth plumbing
* `handle_new_user` trigger inserts a `users` row (`role='viewer'`) on
  signup — new accounts can read, not write, until an admin assigns a role
  in the Team panel (`auth.adminAssignRole` → `users.role`, admin-only by
  policy).
* `auth.onAuthStateChange` restores sessions; `realtime.detachAll()` runs
  on logout.
* Login-modal role hints and `requireRole` behaviour are unchanged from
  the Firebase build.

## Verification
* `tools/test-rls.sh` — executable role-by-role allow/deny matrix
  (32 checks) against real Postgres.
* `SECURITY=1 tools/test-migration.js` — the full 106-check feature suite
  re-run as the `authenticated` role with RLS on (the brief's Phase 6
  step 4). Both pass; see TESTING.md.

# PERFORMANCE-SCALABILITY.md

## Optimizations made in this round (with reasoning)

1. **Per-day fan-out reads → single range queries.** The RTDB build read
   `/pod/{date}` once per day (N reads for "recent POD") and the inventory
   ledger once per day for a 30-day window. Now `loadRecentPod` and
   `listenStockMovements` are one indexed `BETWEEN` query each
   (`pod_entries(pod_date desc, ts)`, `stock_movements(mv_date desc)`).
2. **Client-side aggregations → SQL views.** Current stock and vendor
   performance were full-collection scans in the browser; they are now
   `current_stock` and `vendor_performance` views computed where the data
   lives.
3. **Read-then-write sequences → transactional RPCs.** PO totals, PO
   status transitions, stock transfers, document version pointers, and the
   baseline snapshot are single round-trips with row locks — fewer network
   hops *and* no lost-update window (proven by the concurrency tests).
4. **Manual reverse index removed.** `/planning/dependents` (two writes +
   drift risk per dependency change) is replaced by the
   `task_dependencies` FK with `ON DELETE RESTRICT` — zero maintenance
   cost, database-guaranteed.
5. **Debounced tree re-fetches.** Burst writes (e.g. a 16-row `setSolarItc`)
   trigger one assembled re-fetch per 150 ms window instead of one render
   per row; `debouncedUpdate` batches meta-field edits into a single
   `merge_module_state` call per 400 ms.
6. **Channel pooling.** One realtime channel per table regardless of how
   many listeners attach; reference-counted teardown.
7. **Indexes** on every hot path (see SCHEMA.md §Indexes), including a
   generated `status` column on `wtg_turbines` so status filters don't
   scan jsonb.
8. **Payload hygiene preserved** — photos/documents are Storage URLs only;
   base64 never enters Postgres rows (rule carried over from v10).

## Future scalability (genuine next steps, in order of likely need)

1. **Project scoping in queries.** The schema is multi-project now
   (`project_id` everywhere). First real second project: add
   `.eq('project_id', …)` in the data layer's shared helpers and a
   composite index `(project_id, <hot column>)` per large table; add
   `project_id` to RLS policies.
2. **Pagination for unbounded feeds.** `daily_progress`, `audit_log`, and
   `notifications` currently use LIMIT windows; move to keyset pagination
   (`where ts < $cursor order by ts desc limit 50`) in the viewers when
   history grows past tens of thousands of rows.
3. **Partitioning the append-only tables.** `stock_movements` and
   `audit_log` are natural monthly range partitions once they reach
   millions of rows; both already key on a date column.
4. **Materialize the rollups.** If `vendor_performance` or dashboard KPIs
   get slow, convert to materialized views refreshed by pg_cron (Supabase
   supports it) — the read paths don't change.
5. **Read replicas / connection pooling.** Supabase's pooled connection
   string (PgBouncer) first; paid-tier read replicas if the dashboard's
   read volume outgrows the primary. The client is read-heavy and
   replica-friendly because writes all go through RPCs/tables on the
   primary.
6. **Realtime fan-out.** postgres_changes is fine at this team's scale;
   at hundreds of concurrent dashboards, move the chattiest feeds
   (notifications, POD) to Supabase Broadcast topics fed by triggers to
   take load off logical decoding.
7. **Snapshot compaction.** `snapshots` stores one jsonb per day; after a
   few years, archive rows older than N months to Storage as JSON files
   and lazy-load them in the history view.

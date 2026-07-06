# REALTIME.md — what updates live, and how

## Architecture
`js/realtime.js` keeps the exact listener surface and payload shapes of the
Firebase build, so `state-bridge.js` and every renderer are untouched.
Under the hood:

* **One Supabase channel per table**, shared by all listeners on that table
  and reference-counted — the last unsubscribe removes the channel.
  `detachAll()` (called on logout) drops everything.
* **Collection listeners** (`listenPodToday`, `listenWtg`, `listenHse`,
  `listenRowIssues`, `listenMilestones`, `listenDailyProgress`,
  `listenNextDayPlan`, `listenVendors`, `listenInventoryItems`,
  `listenNotifications`) replay every existing row as `{kind:'add', id,
  val}` — matching RTDB `child_added` replay — then stream INSERT/UPDATE/
  DELETE as `add/change/remove`. Row→val mapping lives in one place:
  `js/shape-map.js`.
* **Tree listeners** (`listenSolar`, `listenBop`, `listenLand`,
  `listenHseEmployees`, `listenSnapshots`, and the `module_state`
  singletons: gantt, schedule, zero-point, custom acts, KPI overrides,
  itcMaps, solar meta) assemble the legacy tree from one or more tables,
  deliver it immediately, and re-fetch (debounced to one burst / 150 ms)
  whenever any underlying table changes.
* **Composite listeners** (`listenPurchaseOrders` embeds line items +
  history; `listenDocuments` embeds versions; `listenPlanTasks` embeds the
  predecessor map) re-fetch only the affected parent row's children on a
  child-table event.

## What updates live (unchanged UX)
POD feed and work table · notifications bell + hero marquee · solar ITC
cards and detail · WTG grid/turbine detail · all four BOP sections · land
tabs · HSE board · milestones/gantt/schedule · procurement (vendors, PO
list/detail) · inventory ledger + stock · planning gantt · documents list ·
admin audit stream (`listenAuditLive`).

## Connection pill
supabase-js has no `/.info/connected`; the header pill is driven by channel
status events (`SUBSCRIBED` / `CHANNEL_ERROR` / `TIMED_OUT` / `CLOSED`)
reported to `window.__sbSetConnected` (supabase-init.js), with
`navigator.onLine` as a coarse fallback. Supabase Realtime reconnects
automatically with backoff; on `SUBSCRIBED` after a drop, tree listeners
re-fetch, restoring state — this plus the PWA shell is the offline story.

## Ordering & consistency notes
* `postgres_changes` delivers committed rows; the debounce on tree
  listeners coalesces bursts (e.g. `setSolarItc` writing 16 activity rows)
  into one re-fetch instead of 16.
* Events for tables you can't read (RLS) simply don't arrive — no client
  filtering needed.
* Requirement for streaming: tables must be in the `supabase_realtime`
  publication; `schema.sql` adds all of them idempotently.

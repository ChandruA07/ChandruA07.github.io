# WORKFLOWS.md — vendor→PO walkthrough & dashboard data map

## Vendor workflow, end to end

1. **Create the vendor** — Vendors → *Add Vendor* (procurement or admin).
   Name and category required; email format validated. Row lands in
   `vendors` (`status='active'`).
2. **Raise a PO** — Procurement → *New PO*: pick the vendor (archived
   vendors are refused), module, description, expected date. `createPO`
   inserts `purchase_orders` as **draft**; a trigger writes the first
   `po_status_history` row; `vendor_name` is denormalized as-of-issue.
3. **Add line items** — while (and only while) the PO is a draft. Each
   `po_add_line_item` RPC inserts the item and bumps `total_value` in the
   same transaction; deleting adjusts it back. Qty must be > 0.
4. **Approve** — Site Manager only, enforced inside `po_set_status`
   (client role gates are UX; the RPC checks `my_role()` under a row
   lock). draft → approved. Line items are frozen from here.
5. **Delivered → Closed** — procurement records delivery and close-out;
   each transition appends to `po_status_history`. Invalid jumps
   (draft→closed, approved→approved) are rejected by the state machine;
   `cancelled` is reachable from draft/approved.
6. **Receive stock (optional)** — Inventory → *Stock In* referencing the
   PO number; the ledger row's `ref` ties GRN to PO.
7. **Vendor performance** — the Vendors view reads the
   `vendor_performance` SQL view: PO counts, spend, on-time % (first
   `delivered` timestamp vs `expected_date`).
8. **Everything is audited twice** — semantic events (`po.create`,
   `po.status`) for the Audit viewer, plus row-level trigger audit.

## Dashboard walkthrough — what each view shows and where its data comes from

| View | Shows | Data source |
|---|---|---|
| Home | KPI cards, S-curve, marquee, milestones, work table | `snapshots`, `module_state('schedule','ganttRows')`, `milestones`, `pod_entries` (recent range), computed KPIs from module tables |
| POD | today's plan feed, submit form, next-day plan | `pod_entries` (by `pod_date`), `next_day_plans` |
| Solar | ITC cards, activity detail, live activities, ITC maps | `solar_itcs` + `solar_activities`, `module_state('solar/meta','solar/customActs','solar/itcMaps')` |
| WTG | turbine grid/detail, zero point, KPI tiles | `wtg_turbines`, `module_state('wtg/…')` |
| BOP | 33 kV / 66 kV / PSS / GSS boards | `bop_activities`, `bop_assets`, `module_state('bop/meta')` |
| Land | WTG locations, solar blocks, leases, parcels | `land_wtg_locs`, `land_sol_blocks`, `land_leases`, `land_parcels` |
| HSE | observations board, employee scoreboard | `hse_observations`, `hse_employees` |
| Map | site map with layers | module tables + `land_parcels` coordinates |
| Procurement | PO pipeline by status, PO detail | `purchase_orders` (+ embedded `po_line_items`, `po_status_history`) |
| Vendors | searchable directory, performance | `vendors`, `vendor_performance` view |
| Inventory | items, current stock, ledger, transfers, low-stock | `inventory_items`, `stock_movements`, `current_stock` view |
| Planning | Gantt, critical path, baseline variance | `plan_tasks`, `task_dependencies`, `plan_baselines` |
| Documents | filed documents + version history | `documents`, `document_versions` (files in the `documents` bucket) |
| Reports | cross-module analytics, CSV export | SQL reads across the above (export = real query results to CSV, not print-the-page) |
| Audit (admin) | who did what, when, before/after | `audit_log` (RLS: admin-only) |
| Notifications bell | recent events, per-user read state | `notifications` (`read_by` map, marked via RPC) |

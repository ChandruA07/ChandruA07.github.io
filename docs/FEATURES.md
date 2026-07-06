# Feature List — v11 New Modules

Everything below reuses the existing visual language (`css/styles.css` + `advanced.css` + `ui-polish.css` classes: `.kpi`, `.tbl`, `.fg/.fl/.fi/.fs/.fta`, `.btn/.bta/.bts`, `.stabs`) and the existing composition pattern (view fragment in `views/`, renderer in `js/render-*.js`, wired through `nav.js`). No new framework.

## 1. Procurement (sidebar → Supply Chain → Procurement)
- **PO list** with status filter chips (all / draft / approved / delivered / closed / cancelled) and per-row expand.
- **New PO** tab: vendor picker (active vendors only), module, expected date, description, optional attachment (uploaded to Firebase Storage, URL stored on the header).
- **Line items** — add/remove while the PO is a **draft only**; the header `totalValue` is kept in sync with a Firebase `transaction()` so two people adding items concurrently can't lose an amount.
- **Workflow**: draft → approved → delivered → closed, plus draft/approved → cancelled. Illegal transitions are rejected in `data-api.js` *and* the `approved` transition is admin-gated again in `database.rules.json` (defense in depth). Every transition is appended to an in-record `history` map and to `/audit`.
- **Approval requires Site Manager**; the button says so.

## 2. Vendor Directory (sidebar → Vendors)
- Vendor CRUD (name, category, contact, phone, email, GSTIN, address, 0–5 rating), archive/restore (soft — PO history keeps the denormalized `vendorName`).
- Live search + category filter. **Filtering is client-side over the full vendor+PO caches — RTDB has no joins or LIKE queries; stated here per the brief, and fine at this data volume (see SCALABILITY.md).**
- Per-vendor drawer: PO count, total spend, linked PO history with jump-to-PO.

## 3. Inventory / Store (sidebar → Inventory)
- **Item master** with unit, location, and `minStock` threshold.
- **Append-only ledger** at `/inventory/movements/{YYYY-MM-DD}/{pushId}` — the same date-keyed pattern that fixed POD. There is **no mutable running-total field anywhere**; current stock is Σ(ledger) computed client-side over a 90-day window (live listener on today only, one-shot reads for past days).
- **Low-stock alerts** — red banner + per-row flag whenever computed stock < `minStock`.
- **Transfers** — one atomic multi-path `update()` writing the OUT@from and IN@to rows together (they succeed or fail as a pair; verified in the test suite).
- Movement validation: type ∈ {in, out, adjust}, qty > 0 (signed only for adjust), date ≤ today.

## 4. Planning (sidebar → PMO → Planning)
- Task CRUD with start/end validation and multi-select **predecessors**.
- **Gantt**: `frappe-gantt` lazy-loaded from CDN on first open; if the CDN is unreachable, a built-in pure-CSS bar chart renders instead (so the module works offline/file://).
- **Critical path** highlighted in red — computed client-side as the longest path over the predecessor DAG (Kahn topological sort + DP). A dependency cycle is detected and flagged instead of hanging.
- **Reverse index** `/planning/dependents/{taskId}` is maintained in the same atomic update as the forward edges — this is the denormalization RTDB requires to answer "what depends on X" (used to block deletes of depended-on tasks).
- **Baseline**: Site Manager freezes every task's current dates; the table then shows per-task Δdays vs baseline (late red / early green).

## 5. Document Management (sidebar → Documents)
- Upload PDF/Word/Excel/PPT/CSV/TXT/images (≤10 MB) → **Firebase Storage**; RTDB stores metadata + a **version chain** with a `currentVersion` pointer.
- New versions per document with a note; full history drawer; archive (admin).
- Search over title/category.

## 6. Reports & Analytics (sidebar → Reports)
- KPI strip (open POs, total PO value, low-stock count, schedule stats, critical-path size) + three Chart.js charts (PO pipeline, top-8 vendor spend, site execution progress).
- Every figure is assembled **in the browser** from the module caches; the page itself says so and points to SCALABILITY.md for the Cloud-Function path — RTDB has no aggregation engine.

## 7. Audit Log viewer (sidebar → Audit Log)
- Newest 200 entries of `/audit` (who / role / action / path / payload), text filter, live prepend while open. Under the production rules this node is **admin-read-only**; other roles see an access note instead of an error.

## 8. PWA
- `manifest.json` (standalone, icons, theme color) → installable on desktop/mobile.
- `sw.js` pre-caches the app shell (all local css/js/images) cache-first; CDN assets network-first with cached fallback; **never intercepts** RTDB/Storage traffic. Offline *data* was already handled by RTDB's write queue and is untouched.

## Existing features — intact
Solar/ITC, WTG, BOP (33kV/66kV/PSS/GSS), Land, POD, HSE/Safety, Manpower, Map, notifications, snapshots, back-dating, exports, search, theme: all verified by the original smoke suite (`tools/smoke-test.js`, 100+ assertions), which still passes unmodified.

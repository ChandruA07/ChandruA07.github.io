# Change Log — v11 "firebase-hardening"

Every file created, modified, or removed relative to `swppl-v10_14-final.zip`, and why.

## Created

| File | Why |
|---|---|
| `js/render-procurement.js` | Procurement (PO list/detail/workflow, New-PO form) + Vendor Directory renderers. |
| `js/render-inventory.js` | Store: item master, ledger view, computed current stock, low-stock alerts, movement/transfer forms. |
| `js/render-planning.js` | Task table, frappe-gantt (CDN, with built-in fallback bars), client-side critical path, baseline variance. |
| `js/render-documents.js` | Document list, upload, version chain viewer. |
| `js/render-reports.js` | Cross-module analytics (PO pipeline, vendor spend, low stock, schedule, site progress). |
| `js/render-audit.js` | Admin-facing viewer of `/audit` (newest 200 + live prepend). |
| `views/view-procurement.html` … `views/view-audit.html` | Seven new view fragments (same fragment pattern as the rest of `views/`). |
| `manifest.json` | PWA installability (Phase 3.8). |
| `sw.js` | Offline app-shell service worker (data offline is RTDB's own queue, untouched). |
| `security/rules.demo-public.json` | Archived copy of the OLD public-R/W rules — the rollback artifact for Phase 7. |
| `tools/test-new-modules.js` | New jsdom test harness with a stateful RTDB stub (72 assertions). |
| `docs/*` | This documentation set. |
| `CHANGES-firebase-hardening.md` | Top-level summary in the style of the existing `CHANGES*.md`. |

## Modified

| File | What changed |
|---|---|
| `js/data-api.js` | **Appended** an extension block (same file, same IIFE pattern): mutators for vendors, POs (+workflow guard), inventory ledger, transfers, planning tasks (+reverse dependency index, baselines), documents (+versions). Bug fix: PO history keys are now `ts_rand`, not bare `Date.now()` (same-millisecond transitions used to overwrite each other). |
| `js/realtime.js` | **Appended** listeners for the new nodes — `child_added/changed/removed` collection listeners, date-windowed stock-movement loader (live listener on today only), `loadAudit`/`listenAuditLive`, `loadBaselines`. |
| `js/storage.js` | **Appended** `uploadDocument` / `uploadPoAttachment` (PDF/Office/CSV/image, 10 MB, progress callback). Binaries still never enter RTDB. |
| `js/auth.js` | **Rewritten** (Phase 6). Real Firebase Authentication (Email/Password) with role from `/users/{uid}/role`; same public API surface as v10 so no renderer changed. Explicit `demo` fallback mode only when the Auth SDK is absent, loudly logged. Login modal shows a busy state and friendly auth error mapping. |
| `js/firebase.js` | Header comment updated (the "no Firebase Auth" note was made stale by Phase 6). No logic change. |
| `js/loader.js` | Registers the 7 new partials; registers `sw.js` (https/localhost only); **bug fix:** removed the duplicate Enter-key login handler that double-fired sign-in. |
| `js/nav.js` | New views added to the render map and breadcrumb labels. |
| `js/render-home.js` | **Bug fix:** `${cu.name}` / `${cu.role}` escaped with `esc()` in three modal templates (user-settable display name was an XSS hole). |
| `js/render-misc.js` | **Dead code removed:** duplicate `toggleTheme` and duplicate ~45-line `exportExcel` (both permanently shadowed by `advanced.js`, which loads later). |
| `js/render-bop.js` | **Dead code removed:** first (shadowed) trio of `toggle66TowerTable`/`show66TowerTable`/`show66Vendor`. |
| `js/advanced.js` | **Bug fix:** `toggleTheme` now also flips the sidebar `th-i` icon, which previously never updated. |
| `js/render-procurement.js` (post-fix) | History rows sorted by `parseInt(key)` and rendered from `entry.ts`. |
| `views/login.html` | Email-first copy for Firebase Auth; lists the seeded role accounts; drops the "not real authentication" warning (now real) while keeping the honest "rules are the lock" framing. |
| `views/sidebar.html` | New "Supply Chain" (Procurement, Vendors, Inventory) and "PMO" (Planning, Documents, Reports, Audit Log) sections. |
| `index.html` | Auth-compat SDK tag restored; manifest + theme-color + apple-touch-icon links; 6 new render script tags; 7 new inline `<template>` blocks (regenerated via `tools/inline_views.py`). |
| `database.rules.json` | **Replaced** with the production role-enforced ruleset (full text in `docs/SECURITY.md`). Old public rules archived at `security/rules.demo-public.json`. |
| `security/rules.json` | Kept in sync with `database.rules.json`. |
| `security/storage.rules` | Extended: POD photos, `/documents/**`, `/po/**` (10 MB, doc allow-list), default-deny catch-all, auth required everywhere. |
| `security/seed-users.json` | All nine roles with step-by-step provisioning instructions embedded. |
| `tools/inline_views.py` | New views added to `ORDER`. |

## Removed

No files were removed. No currently working feature was removed or replaced.

# Testing — Phase 5 record

## A. Automated, EXECUTED in this build environment (results are facts)

**1. Legacy smoke suite — `node tools/smoke-test.js`** (shipped with v10, unmodified logic): boots the full app headlessly in jsdom with a stubbed Firebase and asserts 100+ behaviors across Home, POD (all four module tabs, forms, contractor dropdown, activity search, photos), Solar, WTG, BOP 33kV/66kV (poles/spans tables, derived analysis), back-dating, notifications, live charts, single-file loader, and map. **Status after all v11 changes: ✅ ALL SMOKE TESTS PASSED.** This is the "every existing feature still works" gate — it ran green before changes (baseline) and after.

**2. New-module suite — `node tools/test-new-modules.js`** (new; stateful in-memory RTDB stub, 72 assertions): **✅ ALL PASSED.** Coverage includes:
- Vendor CRUD + validation (empty name, bad email rejected); PO created as draft with denormalized vendorName; PO against unknown vendor rejected.
- PO line items: header total = Σ items via transaction; qty ≤ 0 rejected; edits blocked once not draft.
- Full status flow draft→approved→delivered→closed; illegal draft→closed rejected; per-transition history recorded (this test caught and now guards bug #7).
- Inventory: date-keyed append-only ledger; computed stock 100−70=30; low-stock case; negative/future-dated movements rejected; **transfer writes an atomic OUT+IN pair**; same-location transfer rejected.
- Planning: reverse `/planning/dependents` index consistent with forward edges; end<start and self-dependency rejected; delete blocked while dependents exist; critical path = longest chain (off-path task excluded); cycle detection; baseline freeze.
- Documents: two-version chain with `currentVersion` pointing at the latest; missing fileURL rejected.
- ≥1 audit entry per mutation; all seven new views render through `nav()`; vendor name containing `<img onerror>` renders **escaped** (XSS check); solar role blocked from store mutators (client gate).
- PWA: manifest installable; **every file in the sw.js pre-cache list exists on disk**; manifest linked.
- Rules (static): root default-deny; all new nodes covered; no planner-wide parent `.write` (cascade trap); `/audit` admin-read; ledger rows append-only at rule level.

**3. Concurrent-write scenarios (Phase 5.3)** are covered structurally by the executed tests: two "users" on the same PO can only collide on `totalValue`, which is a `transaction()` (asserted); on the same stock item they only ever **append** distinct pushIds (asserted date-keyed append-only); POD/HSE remain pushId-per-entry (unchanged, smoke-covered). There is no shared mutable field left in the new modules for last-write-wins to corrupt.

## B. NOT executed here — requires a live Firebase project (be aware before claiming production)

This environment has no network access to Firebase, so the following were implemented and code-reviewed but **not run end-to-end**, and this document does not claim otherwise:

1. Real Email/Password sign-in round-trip (`auth.js` firebase mode) including role fetch, session restore, wrong-password/too-many-requests error mapping.
2. Rules enforcement by the live rules engine (the DevTools `PERMISSION_DENIED` probes).
3. Real Storage uploads (documents / PO attachments / photos) against the deployed `storage.rules`.
4. Real two-browser live-sync latency and RTDB offline write replay.
5. PWA install + offline shell in a real browser over https (service workers don't exist in jsdom).

## C. Post-deploy manual checklist (run once after docs/DEPLOYMENT.md Step 2 — ~15 min)

1. [ ] Logged out → no data loads. Sign in as `viewer` → all views render, every edit affordance prompts and every forced write fails.
2. [ ] Two browsers (solar + admin): solar edits Pile Drilling → admin sees it ≤1 s without losing admin's in-flight WTG edit.
3. [ ] As solar in DevTools: `firebase.database().ref('/wtg/meta/count').set(0)` → PERMISSION_DENIED. Same for `/vendors`, `/inventory/items`, `/planning/baselines`, `/users/<ownUid>/role`.
4. [ ] proc: vendor → draft PO → items; approve fails as proc, succeeds as admin; delivered → closed; item-add now rejected; history complete; audit rows present (admin) and unreadable as proc.
5. [ ] store: IN 100 / OUT 70 → stock 30 + low-stock banner (min 50); transfer → paired rows; back-dated OK; future-dated rejected.
6. [ ] planner: 3 tasks with dependencies → critical chain red in frappe-gantt; admin sets baseline; slip a task +3d → "+3d late".
7. [ ] Upload a 2 MB PDF document + a v2; download both; try a 12 MB file → rejected; confirm RTDB holds URLs only.
8. [ ] Reports totals match the modules; Audit filter works; live prepend on new writes.
9. [ ] Install PWA; DevTools → offline → app shell opens; add a POD entry offline as a signed-in user; reconnect → it appears on the second device.
10. [ ] Existing modules spot-check (Solar/WTG/BOP/Land/POD/HSE/Manpower/Map/notifications) signed in per role.

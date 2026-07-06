# Performance Notes — v11

| Optimization | Reasoning |
|---|---|
| `.indexOn` added: `purchaseOrders` [status, vendorId, ts]; `inventory/movements/$date` [itemId, ts]; `planning/tasks` [start, module]; `documents` [module, category] (existing ts indexes kept) | Keeps `orderByChild()` server-side-indexed and silences the "consider adding .indexOn" runtime warning; costs nothing on the free tier. |
| Collection listeners are `child_*`, never root `value` | Each event carries one record; a PO edit ships ~200 bytes, not the whole node. Same discipline that fixed v8. |
| Stock ledger: live listener on today only + one-shot 90-day window | Historical date keys are immutable; re-listening to them is pure waste. Mirrors the POD fix. |
| Re-render debounce (120–150 ms) in every new renderer; renders skipped when the view isn't open | A burst of `child_added` on first attach paints once, not N times. |
| PO/document listeners capped `limitToLast(300)`, audit `limitToLast(200)` | Bounded first-load payload regardless of node growth. |
| frappe-gantt lazy-loaded on first Planning open (with local fallback) | ~80 KB not paid by users who never open Planning; module never hard-fails offline. |
| PO header total via `transaction()` | Two concurrent item-adders can't lose an increment (v9 §5.3 counter rule). |
| Dead code removed (duplicate `toggleTheme`, `exportExcel`, 66kV trio) | Less parse weight; removes shadowing traps for maintainers. |
| PWA shell cache-first | Repeat loads serve all local assets from CacheStorage; the network is only touched for data and CDN revalidation. |
| Uploads stay in Storage (10 MB cap, typed) | RTDB bills per byte transferred to every listener; a single inlined PDF would multiply across devices. |

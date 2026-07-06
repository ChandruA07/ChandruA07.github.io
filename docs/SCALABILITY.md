# Future Scalability Notes — honest limits of staying on RTDB

This build is correct and comfortable at the demo/site scale (≲ a few thousand records per node, ≲100 concurrent connections — the Spark caps). These are the real ceilings and what to do at each, as guidance rather than padding:

**1. No server-side aggregation.**
Reports, vendor spend, and current stock are computed in the browser from cached nodes. Cost grows linearly with node size; around ~10k movements or ~5k POs, first-paint of Reports/Inventory will noticeably lag on mobile. *Path:* move rollups to a scheduled/triggered **Cloud Function** (requires Blaze) writing `/rollups/stock/{itemId}`, `/rollups/vendorSpend/{vendorId}`; the UI then reads one small node. The append-only ledger was designed so a trigger-maintained total is a pure add — no client change to write paths.

**2. Denormalization maintenance is on the client.**
`vendorName` on POs and `/planning/dependents` are maintained by `data-api.js`. Multi-path atomic updates keep them consistent today, but every future writer must remember to. *Path:* a Cloud Function `onWrite('/planning/tasks/{id}/predecessorIds')` that owns the reverse index, making it impossible to forget.

**3. Query poverty.**
No joins, no LIKE, one `orderByChild` per query, no OR. Vendor search and PO filtering are client-side; "all POs for vendor X with status Y" cannot be a single indexed query. Fine now; painful at ~10× data. *Path:* **Firestore** offers compound queries and per-document reads — the module boundaries here (each `render-*` + its `data-api` mutators) were kept narrow so nodes can migrate one at a time.

**4. Download-billing amplification.**
RTDB bills bytes sent to *every* listener. `limitToLast` caps and today-only ledger listeners keep this bounded, but 50 simultaneous dashboards on a large `purchaseOrders` node multiply traffic. *Path:* tighter windows (`orderByChild('ts').startAt(...)`) then Firestore per-document reads.

**5. Single-region, single-tree.**
The Asia-Southeast RTDB instance is one tree; no sharding, ~200k concurrent-connection hard ceiling far above this use.

**Triggers for migrating (any one):** need for enforced server-side invariants beyond rules' expressiveness (multi-node transactions with logic), full-text search, reporting over >50k rows, or external/vendor-facing portals needing row-level security per vendor. Firestore first for query needs; a relational store (e.g. Postgres + an API) only if reporting/BI becomes the dominant workload.

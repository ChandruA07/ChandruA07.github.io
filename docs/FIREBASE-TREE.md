# RTDB Tree Reference — post-v11

Existing nodes (unchanged — see ARCHITECTURE.md §3): `/users`, `/pod/{date}`, `/solar`, `/wtg`, `/bop`, `/land`, `/hse`, `/milestones`, `/blockers`, `/schedule`, `/snapshots/{date}`, `/dailyProgress`, `/notifications`, `/audit`.

## New nodes

```
/vendors/{vendorId}
    name, category, contact, phone, email, gstin, address,
    rating (0–5), status ("active"|"archived"),
    by, byName, ts, lastBy, lastAt

/purchaseOrders/{poId}
    poNumber, vendorId,
    vendorName          ← DENORMALIZED (see below)
    module, description, expectedDate (YYYY-MM-DD|null),
    currency, totalValue, status
        ("draft"|"approved"|"delivered"|"closed"|"cancelled"),
    attachmentURL (Storage URL | null),
    history/{ts_rand}/  { ts, status, by, byName, note }
    lineItems/{itemId}/ { itemName, itemId?, unit, qty, rate, amount, by, ts }
    by, byName, ts, lastBy, lastAt

/inventory/
    items/{itemId}/     { name, category, unit, minStock, location, status, … }
    movements/{YYYY-MM-DD}/{pushId}/          ← APPEND-ONLY ledger
        { itemId, type ("in"|"out"|"adjust"), qty,
          ref, to, notes, location?, transferId?, by, byName, ts }

/planning/
    tasks/{taskId}/     { name, module, start, end, progress,
                          predecessorIds: {taskId:true}|null, … }
    dependents/{taskId}/{dependentTaskId}: true   ← REVERSE index
    baselines/{taskId}/ { start, end, setBy, setAt }

/documents/{docId}/
    title, category, module, status, currentVersion,
    versions/{verId}/   { fileURL (Storage), fileName, size, note, by, byName, ts }
    by, byName, ts, lastBy, lastAt
```

## Denormalization decisions (deliberate, not accidental)

| What | Why | Maintenance burden |
|---|---|---|
| `purchaseOrders/{id}/vendorName` | RTDB has no joins; the PO table would otherwise need a per-row `/vendors` lookup. It is also commercially correct: a PO document keeps the vendor name as of issue date, so vendor renames intentionally do **not** rewrite history. | None (write-once at PO creation). |
| `/planning/dependents/{X}` | RTDB cannot query "which tasks list X as a predecessor". The reverse index is written **in the same atomic multi-path update** as the forward `predecessorIds`, so it can never drift. | Zero drift by construction; delete/update paths covered by tests. |
| No `currentStock` field | A maintained total needs either a client mutating shared state (the exact overwrite class of bug v9 eliminated) or a Cloud Function trigger (Blaze plan). Stock = Σ(ledger), computed client-side. | Recompute cost grows with ledger size — see SCALABILITY.md for the trigger-maintained `/rollups` path. |
| PO `history` embedded in the PO | One read renders the whole PO drawer. | Grows with transitions (bounded: max 4–5 per PO). |

## Where RTDB is materially weaker than a relational store (stated plainly)

- **"Vendor performance across all POs"** (Reports, Vendor drawer): requires pulling the whole `purchaseOrders` node and grouping client-side — there is no GROUP BY.
- **Vendor search**: no LIKE/contains query; the full (small) vendor list is cached and filtered in the browser.
- **Stock as of an arbitrary past date**: needs a client-side scan of the date-keyed ledger; SQL would be one `SUM … WHERE date <= ?`.
- **Cross-module reports**: assembled in the browser; no server-side aggregation exists on RTDB.

These are acceptable at this project's volume (thousands of records) and each has a documented migration path (SCALABILITY.md).

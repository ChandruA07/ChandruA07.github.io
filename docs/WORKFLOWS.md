# Walkthroughs

## Vendor workflow — creation to PO close-out

1. **Create the vendor.** Sidebar → *Vendors* → **＋ Add vendor**. Name is required; email is format-validated. Sign-in as `procurement` (or admin) is prompted if needed. The record lands at `/vendors/{pushId}`; an audit row and a notification are written.
2. **Raise a PO.** Sidebar → *Procurement* → **New PO** tab. Pick the vendor (archived vendors are excluded and `createPO` re-checks server data), module, expected date, description; optionally attach a file (uploaded to Storage `/po/…`, only the URL is stored). The PO is created as **draft** with an auto number `PO-YYYY-xxxxx` and the vendor's name denormalized onto the header.
3. **Add line items** on the expanded PO (draft only): item, unit, qty > 0, rate ≥ 0. The header total is maintained by a `transaction()`. Items can be deleted while draft.
4. **Approve** — **✅ Approve (Site Manager)**. Only admin credentials pass (client gate *and* rule-level validate). The transition is appended to the PO's `history` and to `/audit`.
5. **🚚 Mark delivered** when material arrives (procurement or admin). Optionally post the receipt into Inventory (*Inventory → Movement*, type IN, ref = PO number) — deliberately a separate, explicit step.
6. **✔ Close out** — terminal state; line items and status are frozen. **✖ Cancel** is available from draft/approved with an optional note.
7. **Review anytime** — vendor drawer in the Directory shows PO count, spend, and jump-links; Reports shows the pipeline; Audit Log shows every step with who/when.

## Dashboard walkthrough — what each view shows and its data source

| View | Shows | Data comes from |
|---|---|---|
| Home | KPIs, marquee, recent POD, charts | `/pod/{today,past}`, `/solar`, `/wtg`, `/bop`, `/dailyProgress`, `/snapshots` via `state-bridge.js` listeners → legacy `DB` mirror |
| Solar / ITC | ITC activity progress | `/solar/itcs/{id}` (`value` while open, then `off()`) |
| WTG / Zero Point | Turbine stages, dates | `/wtg/turbines` (`child_changed`) |
| BOP 33kV/66kV/PSS/GSS | Feeders, poles/spans, substation acts | `/bop/*` leaf nodes |
| Land (+WTG/Solar land) | Parcels, ROW issues, blocks | `/land/*` |
| POD | Plan-of-day entries per module | `/pod/{date}/{pushId}` (`child_added/changed`, `.indexOn ts`) |
| Safety / HSE | Observations, employees, inductions | `/hse/*` (`child_added`, last 50) |
| Manpower / Map | Headcount, GIS | `DB` mirror + `solar-gis-data.js` |
| **Procurement** | PO table + workflow | `/purchaseOrders` (`child_*`, limit 300) |
| **Vendors** | Directory + PO history | `/vendors` (`child_*`) joined client-side with the PO cache |
| **Inventory** | Stock, ledger, transfers | `/inventory/items` (`child_*`); `/inventory/movements/{today}` live + 90-day one-shot window |
| **Planning** | Gantt, critical path, variance | `/planning/tasks` (`child_*`); `/planning/baselines` one-shot |
| **Documents** | Files + version chains | `/documents` (`child_*`); binaries from Storage URLs |
| **Reports** | Cross-module rollups | The caches above, computed in-browser |
| **Audit Log** | Mutation trail (admin) | `/audit` `orderByKey().limitToLast(200)` + 1-item live listener |

## Real-time sync — what updates live, and how

Unchanged principles from ARCHITECTURE.md §5 (leaf writes, `child_*` listeners, `.off()` on navigation), extended to the new nodes:

- `vendors`, `purchaseOrders`, `inventory/items`, `planning/tasks`, `documents`: `child_added` + `child_changed` + `child_removed` collection listeners feeding per-module `Map` caches; re-renders are debounced 120 ms and only run if that view is open.
- `inventory/movements`: live listener on **today's date key only** (the POD pattern); past days are one-shot reads — history never re-fires.
- `audit`: one-shot `limitToLast(200)` + a `limitToLast(1)` `child_added` for live prepend, detached when leaving the view.
- Writes remain multi-path `update()` / `push()` / `transaction()`; there is still no parent-node `.set()` anywhere (grep-verified), so the v8 overwrite class of bug cannot recur.

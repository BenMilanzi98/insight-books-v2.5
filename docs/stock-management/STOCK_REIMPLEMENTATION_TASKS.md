# Stock Reimplementation Tasks

| Field | Value |
|---|---|
| Date | 2026-07-22 |
| Phase | Forensic complete → **blocked on design approval** |
| Rule | Status values: `pending` \| `in_progress` \| `blocked` \| `done` \| `waived` |

---

## Workstream status board

| ID | Workstream | Status | Notes |
|---|---|---|---|
| A | Current implementation review | **done** | `CURRENT_STOCK_IMPLEMENTATION.md` |
| B | Existing-data analysis | **blocked** | Code risks documented; prod-copy scan pending |
| C | Stock domain model | **pending** | Awaits FORK-01..05 |
| D | Item master | **pending** | |
| E | Warehouses and locations | **pending** | FORK-04 |
| F | Inventory batches | **pending** | Extend existing `InventoryBatch` |
| G | Expiry tracking | **pending** | |
| H | Stock Movement Ledger | **pending** | Extend `InventoryTransaction` or new model |
| I | Inventory valuation | **pending** | FORK-01 |
| J | Basic Excel template (4 cols) | **done** | `/api/stock/basic-import/template` |
| K | Stock import | **in_progress** | Preview/confirm shipped; GL clearing journal next |
| L | Stock export | **done** | `/stock/export` + `/api/stock/basic-export` |
| M | Duplicate item matching | **done** | Normalized name match + AMBIGUOUS block |
| N | Weighted-average cost | **done** | Exact WAC helper + import apply |
| O | Opening stock | **pending** | |
| P | Stock receipts | **pending** | |
| Q | Purchase integration | **pending** | Preserve GR path |
| R | Sales integration | **pending** | |
| S | POS integration | **pending** | |
| T | Cost of Sales integration | **pending** | Keep V2 adapter |
| U | Customer returns | **pending** | |
| V | Supplier returns | **pending** | |
| W | Stock adjustments | **pending** | Kill direct PUT qty |
| X | Physical counts | **pending** | |
| Y | Stock write-offs | **pending** | |
| Z | Expired-stock accounting | **pending** | FORK-03 |
| AA | Damaged-stock accounting | **pending** | |
| AB | Inter-business transfer | **pending** | FORK-02 |
| AC | Inter-business accounting | **pending** | FORK-02 |
| AD | Low-stock alerts | **pending** | |
| AE | Out-of-stock alerts | **pending** | |
| AF | Expiry-soon alerts | **pending** | |
| AG | Expired-stock alerts | **pending** | |
| AH | Alert delivery | **pending** | |
| AI | Movement reports | **pending** | |
| AJ | Valuation reports | **pending** | |
| AK | Expiry reports | **pending** | |
| AL | Transfer reports | **pending** | |
| AM | Write-off reports | **pending** | |
| AN | Report exports | **pending** | |
| AO | Dashboard | **pending** | |
| AP | Item details | **pending** | |
| AQ | Batch details | **pending** | |
| AR | Search and filters | **pending** | |
| AS | Permissions | **pending** | |
| AT | Approval workflows | **pending** | |
| AU | Audit Trail | **pending** | |
| AV | Background Jobs | **pending** | |
| AW | API and Server Actions | **pending** | |
| AX | Database migrations | **blocked** | Need design + backup |
| AY | Historical-data migration | **blocked** | After AX |
| AZ | Concurrency and idempotency | **pending** | |
| BA | Performance | **pending** | |
| BB | Responsive UI | **pending** | |
| BC | Accessibility | **pending** | |
| BD | Automated tests | **pending** | |
| BE | Controlled rollout | **pending** | |
| BF | Final documentation | **pending** | Full docs tree after implementation |

---

## Immediate next tasks (after approval)

| Task | Depends | Deliverable |
|---|---|---|
| Approve FORK-01..05 | User | Written design spec |
| Domain model ADR | FORKs | `STOCK_DOMAIN_MODEL.md` |
| Additive Prisma migration draft | Domain | `STOCK_DATABASE_CHANGES.md` |
| Ban direct stockLevel financial writes | Domain | Service + API guard + tests |
| 4-column import/export MVP | Domain | `/stock/import`, `/stock/export` |
| WAC + movement on import | Import | Invariants tests |
| Expiry write-off uniqueness | Write-off | Concurrency tests |
| Inter-business transfer accounting | FORK-02 | Dual-journal tests |

---

## Task template (use for each implementation ticket)

```
ID:
Title:
Status:
Module:
Route:
Business scope:
Database entities:
Accounting effect:
Stock effect:
Permission:
Approval requirement:
Files affected:
Migration impact:
Tests:
Evidence:
Completion notes:
Remaining risk:
```

---

## Execution order (master prompt §71)

Forensic Steps 1–9: **complete** (docs created).  
Step 10 onward: **not started** — requires design approval and verified backup before destructive migration work.

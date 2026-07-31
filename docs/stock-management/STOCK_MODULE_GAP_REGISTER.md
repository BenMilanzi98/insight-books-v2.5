# Stock Module Gap Register

| Field | Value |
|---|---|
| Date | 2026-07-22 |
| Status | Open — design forks must be decided before coding |

Severity: **CRITICAL** / **HIGH** / **MEDIUM** / **LOW**

---

## Design forks (block implementation until decided)

| ID | Decision | Options | Recommendation |
|---|---|---|---|
| FORK-01 | Costing method | A Hybrid / B Pure WAC / C FIFO-only | **A APPROVED** — FIFO authoritative for COGS; WAC for Order Price / product valuation display |
| FORK-02 | Inter-business transfer GL | A Expense / B Due-To-From / C Configurable | **C** with default **A** (pending impl) |
| FORK-03 | Expiry write-off | Auto / Manual / Config | **C** (pending impl) |
| FORK-04 | Warehouse / Branch | | **APPROVED: Business = hidden primary branch**; users never create/select branches |
| FORK-05 | Import Selling Price | | Default update + optional disable per batch (**shipped** on `/stock/import`) |

---

## Functional gaps

| ID | Title | Severity | Current | Required | Status |
|---|---|---|---|---|---|
| STK-GAP-001 | Direct quantity update without movement/journal | **CRITICAL** | `PUT /api/stock/[id]` writes `stockLevel` | Every qty change → Stock Movement + Journal when financial | Open |
| STK-GAP-002 | Basic 4-column Excel import missing | **CRITICAL** | Multi-column CSV + SKU required | Item Name, Quantity, Order Price, Selling Price only | Open |
| STK-GAP-003 | Basic 4-column Excel export missing | **HIGH** | Wide CSV export | Same 4 columns; re-importable | Open |
| STK-GAP-004 | Normalized Item Name matching missing | **CRITICAL** | SKU / loose name | Case/whitespace normalize; Business-scoped; ambiguous blocked | Open |
| STK-GAP-005 | Duplicate active Item names allowed | **HIGH** | No unique normalized name | Prevent or resolve AMBIGUOUS | Open |
| STK-GAP-006 | Weighted-average import math not enforced | **HIGH** | FIFO layers; `averageCost` field exists but not import-driven | Exact WAC on matched import | Open |
| STK-GAP-007 | Import clearing accounting missing | **HIGH** | Opening/create paths vary | Dr Inventory / Cr Import Clearing via Posting Engine | Open |
| STK-GAP-008 | Import batch idempotency / file hash missing | **CRITICAL** | Per-row create can duplicate | StockImportBatch + file/row hash | Open |
| STK-GAP-009 | Incomplete Stock Movement ledger | **CRITICAL** | Partial `InventoryTransaction` | All movement types + before/after qty/value + journal link | Open |
| STK-GAP-010 | Movement report incomplete | **HIGH** | Exists but limited types/fields | Full report + export agreement | Open |
| STK-GAP-011 | Warehouse model missing | **MEDIUM** | Branch + location string | Warehouse or explicit Branch-as-warehouse policy | Open |
| STK-GAP-012 | Batch FEFO sale enforcement incomplete | **HIGH** | Expiry on batch; sale path may not always block expired | Block expired/quarantined; FEFO recommend | Open |
| STK-GAP-013 | Durable stock alerts missing | **HIGH** | Computed in UI/API | StockAlert entity + lifecycle + jobs | Open |
| STK-GAP-014 | Duplicate expiry expense concurrency risk | **CRITICAL** | Some idempotency keys | DB unique active write-off event | Open |
| STK-GAP-015 | Inter-business Expense Transfer Mode missing | **HIGH** | Branch/tenant transfer without specified dual Journals | Source Expense + Dest Inventory once each | Open |
| STK-GAP-016 | Transfer partial-failure recovery missing | **HIGH** | Status workflow only | Recovery service + unique transfer identity | Open |
| STK-GAP-017 | Physical stock count workflow missing/weak | **MEDIUM** | Adjustments exist | Count → variance → approve → post | Open |
| STK-GAP-018 | Reservation model missing | **MEDIUM** | Not first-class | On-hand / reserved / available | Open |
| STK-GAP-019 | Dedicated routes for import/export/expiry/movements | **MEDIUM** | Tabs inside monolith | Dedicated UX routes | Open |
| STK-GAP-020 | Permissions granularity | **MEDIUM** | `inventory.*` / some `stock.*` | Prompt permission matrix | Open |
| STK-GAP-021 | Approval integration for write-off/transfer/adjust | **HIGH** | Partial status fields | Central Approval Policy Engine | Open |
| STK-GAP-022 | Inventory ↔ GL reconciliation automation | **HIGH** | Diagnostics endpoint | Continuous reconcile service + report | Open |
| STK-GAP-023 | Mobile/a11y of import preview | **MEDIUM** | Monolith tables | Responsive preview + keyboard | Open |
| STK-GAP-024 | Automated invariant tests thin | **HIGH** | Few stock tests | Import/WAC/expiry/transfer/concurrency suite | Open |
| STK-GAP-025 | Historical qty without movements | **CRITICAL** | Likely in production data | Controlled migration movements | Open |

---

## Integration gaps

| Integration | Gap |
|---|---|
| Sales / POS | Must ensure single issue + single COGS; expired batch block |
| Purchases / GR | Prevent bill double-receiving stock (partially handled) |
| Expenses | Write-off expense once; no invent payable on simple import |
| Accounting periods | Closed-period denial on financial stock posts |
| Multi-business | No Item ID reuse across businesses; transfer mapping required |

---

## Gap counts

| Severity | Count |
|---|---:|
| CRITICAL | 7 |
| HIGH | 12 |
| MEDIUM | 6 |
| LOW | 0 (tracked in tasks) |
| **Total** | **25** |

---

## Closure rule

A gap closes only with: code change + tests + reconciliation evidence (where financial) + update to this register.

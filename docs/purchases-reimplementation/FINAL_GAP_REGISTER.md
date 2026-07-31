# Final Gap Register

Prioritised gaps from the forensic audit. Severity: Critical / High / Medium / Low.

## Critical

| ID | Gap | Area | Disposition |
|----|-----|------|-------------|
| G-C01 | Receipt posts Cr AP instead of GRNI | Accounting | `REIMPLEMENT` template + CoA purpose |
| G-C02 | Inventory bill can re-debit inventory / re-credit AP | Accounting | `REIMPLEMENT` matched-bill template |
| G-C03 | No three-way matching | Matching | New service + UI |
| G-C04 | No line-level bill↔receipt links | Data model | Schema EXTEND |
| G-C05 | Duplicate inventory on concurrent/retry paths | Inventory | Unique movement + locks |

## High

| ID | Gap | Area | Disposition |
|----|-----|------|-------------|
| G-H01 | Weak payment/document idempotency | Payments | Keys + DB unique |
| G-H02 | Supplier invoice duplicate detection missing | Bills | Constraint + detector |
| G-H03 | Coarse permissions / no SoD | Security | EXTEND matrix |
| G-H04 | Approved PO silently editable | Orders | State machine |
| G-H05 | No receipt reversal / return / AP credit note | Returns | New workflows |
| G-H06 | Rejected qty not excluded from stock | Inventory | Inspection model |
| G-H07 | Denormalised supplier balance drift | Data | Derive from ledger |
| G-H08 | Global unique codes/numbers | Multi-tenant | Tenant-scope |
| G-H09 | Almost zero automated tests | QA | Build matrix |
| G-H10 | Auto-bill couples liability document to GR journal | Bills | Decouple |

## Medium

| ID | Gap | Disposition |
|----|-----|-------------|
| G-M01 | No purchases dashboard with correct labels | Build after posting |
| G-M02 | Export UI disconnected | Wire + permission re-check |
| G-M03 | Float/Decimal inconsistency | Migration plan |
| G-M04 | Missing warehouse/branch on documents | Schema EXTEND |
| G-M05 | Landed cost / WHT / FX incomplete | Phased |
| G-M06 | Dual supplier UIs | Consolidate |
| G-M07 | Approval workflow missing | Commands + notifications |
| G-M08 | UOM / serial / lot incomplete | EXTEND receipt lines |

## Low

| ID | Gap | Disposition |
|----|-----|-------------|
| G-L01 | Unused `SupplierSelect` | Remove or wire |
| G-L02 | Requisition / RFQ absent | Later phase if required |
| G-L03 | PDF document pack incomplete | After core posting |

## Counts (initial)

| Severity | Count |
|----------|-------|
| Critical | 5 |
| High | 10 |
| Medium | 8 |
| Low | 3 |

## Readiness

**Not production-ready** for true procure-to-pay with GRNI and three-way match.  
Operational CRUD exists; accounting semantics are **AP-at-receipt** hybrid with duplicate risks.

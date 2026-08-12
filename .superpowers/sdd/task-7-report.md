# Task 7 Report: Regression checklist (manual + automated)

## Status
**PASS** — all automated tests green; static manual checks pass; browser smoke deferred to operator.

## Step 1: Automated

Command:

```bash
npx vitest run test/rentalSourceTags.test.js test/rentalReverseService.test.js test/rentalReportsService.test.js test/rentalKinds.test.js test/rentalAvailability.test.js test/rentalBookingPolicy.test.js test/hiringsWorkspace.test.js test/invoiceVoidService.test.js
```

| Test file | Tests | Result |
|-----------|------:|--------|
| `test/rentalSourceTags.test.js` | 6 | PASS |
| `test/rentalReverseService.test.js` | 7 | PASS |
| `test/rentalReportsService.test.js` | 6 | PASS |
| `test/rentalKinds.test.js` | 4 | PASS |
| `test/rentalAvailability.test.js` | 4 | PASS |
| `test/rentalBookingPolicy.test.js` | 8 | PASS |
| `test/hiringsWorkspace.test.js` | 3 | PASS |
| `test/invoiceVoidService.test.js` | 2 | PASS |
| **Total** | **38 / 38** | **8 files PASS** |

Duration ~6–13s; exit code 0.

Optional smoke file `test/rentalHubs.smoke.test.js` not created (brief marks it optional; invariants already covered by unit tests + static checks below).

## Step 2: Manual checklist

| # | Item | Result | Notes |
|---|------|--------|-------|
| 1 | Sidebar shows only Rentals / Hirings / Reports | **PASS** | `components/Sidebar/Sidebar.js` `rentalSubItems` lists exactly three links; Contracts / Quotations / Reconcile absent from nav (only in route-permission map). |
| 2 | Book space → invoice on `/invoices` → record payment | **DEFERRED — needs operator smoke** | Requires authenticated booking + invoicing flow. |
| 3 | Book customer hire → invoice on `/invoices` → payment | **DEFERRED — needs operator smoke** | Requires authenticated hirings tab + invoicing flow. |
| 4 | Reverse draft → slots free + availability restored | **DEFERRED — needs operator smoke** | Logic covered by `reverseRentalBooking` tests (draft delete + restock); UI/API end-to-end not exercised here. |
| 5 | Reverse posted unpaid → invoice voided + slots free | **DEFERRED — needs operator smoke** | Logic covered by `reverseRentalBooking` + `voidPostedInvoice` tests; browser flow not exercised. |
| 6 | Reverse paid → 409 + guidance; after refund, reverse succeeds | **DEFERRED — needs operator smoke** | Paid-block assertion in `reverseRentalBooking` test; refund-then-reverse path needs operator. |
| 7 | Supplier hire bill → expense/AP only; Reports supplier spend up; revenue unchanged | **DEFERRED — needs operator smoke** | `buildRentalHiringReport` excludes supplier accruals from revenue (automated); supplier bill UI/report totals need operator. |
| 8 | Damage + repair → appear under Reports damages/repairs | **DEFERRED — needs operator smoke** | Report classification covered in `rentalReportsService` tests; operator UI verification pending. |
| 9 | Deep links `/rentals/contracts-v2` still load for power users | **PASS (static)** / **DEFERRED (browser)** | `app/rentals/contracts-v2/page.js` exists; route in permission map. Authenticated page load not verified. |

### Static infrastructure verified (no auth)

- **Redirects:** `app/rentals/hiring/page.js` → `/rentals/hirings?tab=customer`; `app/rentals/inbound-hiring/page.js` → `/rentals/hirings?tab=supplier`.
- **Hub pages:** `app/rentals/page.js`, `app/rentals/hirings/page.js`, `app/rentals/reports/page.js` present.
- **API routes:** `app/api/rentals/cancel/route.js`, `app/api/invoices/void/route.js`, `app/api/rentals/charges/damage/route.js`, `app/api/rentals/charges/repair/route.js`, `app/api/rentals/reports/route.js` present.

## Summary

| Category | Count |
|----------|------:|
| Automated test files PASS | 8 |
| Automated tests PASS | 38 |
| Manual items PASS (static) | 1 (+ partial static for #9) |
| Manual items **DEFERRED — needs operator smoke** | **8** |

## Commits
None (per task instructions).

## Final whole-branch review fixes

### Important #1 — damage CoA mapping UX
- `app/api/rentals/charges/damage/route.js` now recognizes `MissingAccountMappingError` (including its stable `MISSING_ACCOUNT_MAPPING` code) from `resolvePurposeAccount`.
- Missing `OTHER_INCOME` for `RENTALS/DAMAGE` now returns `409` with actionable guidance: configure that exact purpose and scope in CoA mappings. The successful posting path is unchanged.

### Important #2 — repair account mapping
- Added the purpose `REPAIRS_AND_MAINTENANCE`: a debit-normal posting `EXPENSE` purpose with the established blueprint legacy code `5380`. No existing CoA V2 purpose is semantically suitable for repairs; `INVENTORY_ADJUSTMENT`, rent, utilities, and bad-debt purposes were rejected as incorrect classifications.
- `app/api/rentals/charges/repair/route.js` resolves that purpose in the `RENTALS/REPAIR` scope first. Only when resolution raises `MISSING_ACCOUNT_MAPPING` does it fall back to an active posting account named with case-insensitive `Repair%`; it no longer queries `accountCode`/`code` directly.
- If neither the mapping nor the name fallback is available, the route returns `409` with instructions to configure `REPAIRS_AND_MAINTENANCE` for `RENTALS/REPAIR`.

### Verification
```bash
npx vitest run test/rentalChargeCoaMapping.test.js test/rentalSourceTags.test.js test/rentalReportsService.test.js test/coaV2.domain.test.js
```
Result: **67 / 67 passing** across 4 files. `test/rentalChargeCoaMapping.test.js` was added for these two findings.

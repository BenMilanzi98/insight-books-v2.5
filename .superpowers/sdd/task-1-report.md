# Task 1 Report: Source tags + operator labels

**Status:** DONE  
**Date:** 2026-08-11  
**Commits:** none (WORKING_TREE)

---

## Summary

Implemented outbound invoice source tagging (`RENTAL_SPACE` / `CUSTOMER_HIRE`), stable rental trace event constants, operator-facing label rename for quantity pool (`Customer hire`), and rental invoice title/notes stamping on create via `resolveOutboundInvoiceSource`. No schema migration.

---

## TDD Evidence

### RED (Step 2)

Command:
```bash
npx vitest run test/rentalSourceTags.test.js test/rentalKinds.test.js
```

Result: **FAIL** (exit code 1)

- `test/rentalSourceTags.test.js` — suite failed: `Cannot find module '../lib/rentalSourceTags.js'`
- `test/rentalKinds.test.js` — 1 failed: `expected 'Quantity rental' to be 'Customer hire'`

### GREEN (Step 4)

Command:
```bash
npx vitest run test/rentalSourceTags.test.js test/rentalKinds.test.js
```

Result: **PASS** — 2 files, 8 tests, all passed (951ms)

---

## Files Changed

| File | Action | Purpose |
|------|--------|---------|
| `lib/rentalSourceTags.js` | Created | `OUTBOUND_INVOICE_SOURCE`, `RENTAL_TRACE_EVENT`, `resolveOutboundInvoiceSource()` |
| `test/rentalSourceTags.test.js` | Created | Unit tests for source resolution and trace constants |
| `lib/rentalKinds.js` | Modified | `outboundKindLabel()` returns `'Customer hire'` for quantity pool |
| `test/rentalKinds.test.js` | Modified | Updated label expectation |
| `app/api/rentals/route.js` | Modified | Invoice create uses source tags for title/notes |

---

## Implementation Notes

### `lib/rentalSourceTags.js`

- Delegates kind normalization to existing `normalizeOutboundRentalKind` / `OUTBOUND_RENTAL_KIND` from `rentalKinds.js`.
- `resolveOutboundInvoiceSource('rental'|'space')` → `RENTAL_SPACE`
- `resolveOutboundInvoiceSource('hiring'|'quantity_pool')` → `CUSTOMER_HIRE`
- Unknown/inbound kinds (`supplier_hire`, `null`) → `null`
- `RENTAL_TRACE_EVENT` exports all eight constants per brief (REVENUE, TAX, REVERSAL, DAMAGE, DAMAGE_LOSS, REPAIR, SUPPLIER_HIRE_SPEND, UTILIZATION)

### `lib/rentalKinds.js`

- Single-line change: quantity pool operator label `'Quantity rental'` → `'Customer hire'`

### `app/api/rentals/route.js`

- Imports `resolveOutboundInvoiceSource`, `OUTBOUND_INVOICE_SOURCE`
- Invoice title:
  - `RENTAL_SPACE` → `'Room / space rental'`
  - otherwise → `'Customer hire (equipment pool)'`
- Notes append `source=<SOURCE>` on second line when source resolves; user notes preserved
- `isRentalInvoice: true` unchanged
- No new Prisma fields

---

## Self-Review

| Check | Result |
|-------|--------|
| Matches brief interfaces verbatim | Yes |
| TDD order (fail → implement → pass) | Yes |
| No schema migration | Yes |
| `isRentalInvoice: true` preserved | Yes |
| Linter errors on touched files | None |
| Downstream deps (`resolveOutboundInvoiceSource`, `RENTAL_TRACE_EVENT`) exported | Yes |

### Route behaviour delta

- Quantity-pool invoice title changed from `'Quantity rental (equipment pool)'` to `'Customer hire (equipment pool)'` — intentional per brief.
- Notes now include `source=RENTAL_SPACE` or `source=CUSTOMER_HIRE` when applicable; previously notes were user-only.

### Out of scope (later tasks)

- No API route tests for invoice create stamping (brief only specified unit tests).
- `RENTAL_TRACE_EVENT` constants exported but not yet consumed — expected for Task 2+.

---

## Concerns

None blocking. Minor note: any UI or docs still referencing `'Quantity rental'` operator label may need alignment in later tasks; grep of `test/` and `lib/` shows no remaining references.

---

## Verification Commands

```bash
npx vitest run test/rentalSourceTags.test.js test/rentalKinds.test.js
```

Expected: 8/8 pass.

# Task 5 Report: Cloud bind, unbind, heartbeat

## Status

DONE

## Scope implemented

- Added `allocateNumberPrefix`, allocating the first unused prefix from `TILL1` through `TILL99`.
- Added application-enforced one-active-device binding per tenant.
- Added idempotent binding for the currently active device.
- Added a 403 rejection when a device ID belongs to another tenant.
- Added unbinding by setting `unboundAt` on the active tenant/device row.
- Added heartbeat updates to `lastHeartbeatAt`.
- Added heartbeat subscription reporting for `active`, `trial`, and inactive states.
- Added authenticated bind, unbind, and heartbeat POST routes.
- Added the exact `/api/desktop` operational permission rule requested in the brief.

## TDD evidence

### RED

The test file was created before production modules and run with:

`npx vitest run test/desktop/bind.test.js`

Result: exit code 1. Vitest failed because `lib/desktop/cloud/bind.js` did not exist:

`Cannot find module '/lib/desktop/cloud/bind.js'`

This was the expected missing-feature failure before implementation.

### GREEN

After implementing the cloud modules and routes, the same command was run again.

Result: exit code 0; 1 test file passed and all 9 tests passed.

Coverage includes:

- Initial and skipped prefix allocation.
- Rejection of a second active device.
- Same-device bind idempotency.
- Cross-tenant device rejection with HTTP status metadata 403.
- Unbind timestamping.
- Heartbeat timestamping and active/trial subscription response.
- Missing-device heartbeat rejection with `DEVICE_NOT_BOUND` and 403.
- Inactive subscription heartbeat response with `SUBSCRIPTION_INACTIVE`.

## Verification

- Focused test: `npx vitest run test/desktop/bind.test.js` — 9/9 passed.
- Focused lint: `npx eslint` over all seven Task 5 files — exit code 0 with no output.
- IDE diagnostics over all seven Task 5 files — no linter errors.

## Self-review

- Confirmed bind checks active rows using `unboundAt: null`; no unique tenant constraint was added.
- Confirmed bind results expose only `deviceId`, `numberPrefix`, and `boundAt`.
- Confirmed unbind is tenant-scoped and only modifies an active row.
- Confirmed heartbeat rejects missing/unbound devices before subscription lookup and writes `lastHeartbeatAt`.
- Confirmed inactive subscriptions still return a normal result carrying `SUBSCRIPTION_INACTIVE`.
- Confirmed all three routes return 401 when the session has no tenant.
- Confirmed bind maps `DEVICE_ALREADY_BOUND` to 409 and cross-tenant ownership to 403.
- Confirmed only the seven brief-listed implementation/test files are intended for staging; this report remains uncommitted.

## Concerns

None.
# Task 5 Report: Rental reports service, API, and page

## Status
Complete. Implemented the tenant-scoped rental and hiring reporting service, authenticated API, and reports hub UI. No commit was created.

## Delivered
- `lib/rentalReportsService.js` aggregates recognised outbound invoice revenue/tax, void reversals, damage/loss charges, repair-tagged expenses, utilisation, and supplier hire cost.
- Supplier hire spending uses the real hiring-v2 `HireAccrual` model. The action route writes accruals there and associates an existing `SupplierBill` only during clearing, so a direct bill query cannot reliably identify hire costs without double-counting.
- `GET /api/rentals/reports?from=&to=&type=` requires `rentals.view`, validates filters, and scopes every query to the session tenant.
- `/rentals/reports` now supplies date/type filters, glass metric cards, utilisation/source panels, invoice links, activity rows, and the repair note convention (`source=REPAIR` or `RENTAL_REPAIR`).

## Tests and smoke checks
- `npx vitest run test/rentalReportsService.test.js` — PASS, 1 file / 2 tests.
- `npx eslint "lib/rentalReportsService.js" "app/api/rentals/reports/route.js" "app/rentals/reports/page.js" "test/rentalReportsService.test.js"` — PASS, exit 0.
- Unauthenticated `GET /api/rentals/reports` against the running development server — 401, confirming the auth boundary responds.

## Concerns
- Browser/API data rendering was not authenticated manually; the service unit tests cover the aggregation behavior, while the smoke request deliberately exercised the unauthenticated path.

## Important findings fixes
- Voided rental invoices now create reversals only when `voidedAt` is within the requested period, preventing an August-issued/September-voided invoice from being counted in both months.
- Added regression coverage for that cross-month case: the August report has no reversal and the September report records the reversal without revenue.
- The reports page now builds initial calendar defaults from local date fields rather than UTC ISO serialization.
- `npx vitest run test/rentalReportsService.test.js` — PASS, 1 file / 3 tests.

## Task 5 important review fixes
- Wrapped desktop bind lookup and create/rebind behavior in `prisma.$transaction`, with active devices re-read inside the transaction.
- Rebinding a tenant's unbound device now updates the existing unique `deviceId` row, restores `boundAt`/`unboundAt`, and reuses its prefix when available.
- Invalid unbind attempts (missing, foreign-tenant, or already-unbound devices) now throw `DEVICE_NOT_BOUND` with status 403.
- Added coverage for same-device rebind, invalid unbind cases, the transaction-compatible fake Prisma client, and retained second-active-device rejection coverage.
- Command: `npx vitest run test/desktop/bind.test.js`
- Output: PASS — 1 test file passed, 13 tests passed, exit code 0.

## Task 5 advisory lock fix
- Added a transaction-scoped Postgres advisory lock keyed by `tenantId` before the active-device query, serializing concurrent first-bind attempts while retaining application-enforced one-active-device behavior.
- Added regression coverage verifying the advisory lock executes before active devices are read; the fake transaction client now includes `$executeRaw`.
- Command: `npx vitest run test/desktop/bind.test.js`
- Output: PASS — 1 test file passed, 14 tests passed, exit code 0.

## Task 5 DEVICE_BOUND precedence fix
- Reordered bind checks after the advisory lock: tenant already has a different active device now throws `DEVICE_ALREADY_BOUND` (409) before cross-tenant device ownership (403).
- Added regression coverage: tenant t1 with active pc-a binding pc-b (owned by t2) rejects with `DEVICE_BOUND`, not a generic 403.
- Command: `npx vitest run test/desktop/bind.test.js`
- Output: PASS — 1 test file passed, 15 tests passed, exit code 0.

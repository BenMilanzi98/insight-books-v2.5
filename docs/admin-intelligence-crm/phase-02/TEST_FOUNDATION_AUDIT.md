# Test Foundation Audit

## Present

Vitest + many `test/systemAdmin*.test.js` (nav, COA, billing, support access, email safety).

## Phase 2 required tests

| Suite | Focus |
|-------|-------|
| COA regression | Desktop/mobile nav keys, search, breadcrumbs, tenant CoA intact |
| NAV_PERMISSION_MAP | Every adminNav href has a map entry |
| i18n | en/ny key parity for new admin-shell / admin-foundation |
| adminApi | Envelope parse, correlation header, error mapping |
| AdminPermissionGate | Renders children only when permitted |
| Shell a11y smoke | aria on menu / breadcrumbs (RTL where feasible) |

## Visual regression

No Playwright visual suite assumed. If none exists, document as `INSTRUMENTATION_REQUIRED` — do not block Phase 2 on new tooling unless already installed.

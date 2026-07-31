# Phase 7 Final Report — Customer Intelligence Workbench

**Decision:** **READY_FOR_PHASE_8_WITH_BLOCKERS**

Customer Intelligence (Tenant = Customer) is shippable for authorised CS / management users with explicit UNAVAILABLE / NOT_INSTRUMENTED / NOT_SUPPORTED envelopes where adoption, support, and unique-user engagement are insufficient. Deterministic signals only — no probability, expected revenue, or opaque health scores.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Audits + matrix + handoff | Done |
| 1 | Catalogue + 360 + lifecycle + directory APIs | Done |
| 2 | Workbench UI + detail tabs + i18n | Done |
| 3 | Portfolios / ownership / segments | Done |
| 4 | Signals / recon / export / Phase 8 pack | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/customers/signalCatalogue.js` — codes, severity, `ruleVersion` `customer-signals-2026-07-28`
- `lib/admin/customers/signals.js` — `evaluateTenantSignals`, `evaluateAttentionQueue`, acknowledge/dismiss
- `lib/admin/customers/reconciliation.js` — light tenant vs directory + ownership orphans
- `lib/admin/customers/export.js` — directory/overview JSON|CSV foundation
- Prisma `CustomerSignal` (+ SQL fallback `scripts/sql/customer-signals-phase07.sql`); ephemeral evaluation when table/client unavailable

### Verified signal codes (only)

| Code | Source |
|------|--------|
| `NO_MEANINGFUL_ACTIVITY` | `User.lastLogin` inactivity proxy |
| `RENEWAL_DUE_SOON` | `AccountSubscription.expiresAt` |
| `HIGH_OUTSTANDING_BALANCE` | `PlatformInvoice.outstanding` |
| `SUBSCRIPTION_SUSPENDED` | `Tenant.status` / subscription status |
| `MRA_EIS_ENTITLEMENT_PENDING` | `MraEisTenantEntitlement` pending/incomplete |
| `CUSTOMER_OWNER_MISSING` | No ACTIVE `CustomerOwnership` |

**Never emitted:** adoption / `FEATURE_USED` (NOT_SUPPORTED); support escalation (NOT_INSTRUMENTED); probability / expected revenue / health score.

### APIs

- `GET /api/admin/intelligence/customers/signals?queue=`
- `POST /api/admin/intelligence/customers/signals/[id]` (`acknowledge` | `dismiss` + reason)
- `GET /api/admin/intelligence/customers/reconciliation`
- `GET /api/admin/intelligence/customers/export?format=json|csv` (+ audit log)

### UI

Unstubbed Signals (queue table), Reconciliation (status cards), Reports (export buttons). Customer 360 signals section wired to evaluated buckets.

## Hard rules preserved

- Deterministic signals only
- Portfolio scope on list/evaluate APIs
- No Tenant Sale as commercial/export truth
- No false zeroes — UNAVAILABLE stays null
- Platform billing only for outstanding / commercial money

## Known blockers for Phase 8

1. **Adoption / FEATURE_USED** — still UNAVAILABLE / NOT_SUPPORTED; no product-usage facts
2. **Unique-user DAU/WAU/MAU** — login proxies only
3. **Support / onboarding / training** — NOT_INSTRUMENTED (no CS case models)
4. **Signal persistence** — requires `CustomerSignal` migrate/SQL + `prisma generate`; otherwise ephemeral
5. **Export** — foundation only (capped directory / overview); XLSX/PDF → 501
6. **Reconciliation** — light inventory/ownership only; not full commercial or engagement recon
7. **Opportunity catalogue** — mostly empty (USER_LIMIT / MRA_EIS_ELIGIBLE deferred until sources certified)

## Verification

```bash
npx vitest run test/systemAdmin.customer*.test.js test/systemAdmin.navPermissionMap.test.js
```

Expected: PASS.

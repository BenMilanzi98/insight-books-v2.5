### Task 1: Wave 1 — Catalogue + reliability gate + commerce producers

**Files:**
- Create: `lib/admin/productCatalogue/*` (areas, modules, features, cadence, lifecycle, entitlements resolve)
- Create: `lib/admin/productAnalytics/reliabilityGate.js`, `authz.js`, `catalogue.js`
- Extend: `lib/admin/analytics/emit.js` + producers for Invoice posted, POS completed, MRA accepted (idempotent)
- Permissions: `intel.productAnalytics.*` in `lib/admin/permissions.js` + NAV map stubs for product-analytics routes
- Test: `test/systemAdmin.productAnalytics.catalogue.test.js`, `test/systemAdmin.productAnalytics.producers.test.js`
- Optional SQL notes if schema changes needed (prefer reuse AnalyticsEvent — no parallel event store)

**Interfaces:**
- `listProductModules() → ModuleDef[]`
- `resolveFeatureEntitlement(prisma, { tenantId, featureCode, asOf }) → { status, planVersion, limitations }`
- `emitProductMeaningfulAction(prisma, { eventCode, tenantId, featureCode, sourceType, sourceId, idempotencyKey, … })`
- `evaluateProductReliability(metricCode, ctx) → AVAILABLE | NOT_INSTRUMENTED | …`

**v1 instrumented features (only these get producers):**
| Feature code | Event | Source |
|--------------|-------|--------|
| `invoices.post` | `SALES_INVOICE_POSTED` | Invoice/Sale post path |
| `sales.pos.complete` | `POS_TRANSACTION_COMPLETED` | POS complete |
| `eis.fiscal.accept` | `MRA_EIS_TRANSACTION_ACCEPTED` | Accepted fiscal only |

**Matrices to honor:**
- `docs/admin-intelligence-crm/phase-09/MODULE_FEATURE_MATRIX.md`
- `MEANINGFUL_ACTION_MATRIX.md`, `FIRST_VALUE_MATRIX.md`, `PRODUCT_RELIABILITY_MATRIX.md`
- Spec: `docs/superpowers/specs/2026-07-29-product-analytics-phase-09-design.md`

- [ ] Failing tests: gate returns NOT_INSTRUMENTED for uninstrumented feature; invoice producer idempotent; FEATURE_USED still not a free-for-all
- [ ] Implement catalogue + 3 commerce producers + gate + permissions
- [ ] Vitest PASS for the two test files above

## Global Constraints

- Strict events only — domain tables are candidates; live metrics NOT_INSTRUMENTED until producers exist.
- Page views / login alone ≠ value / activation / adoption.
- Retries / reprints / workers ≠ new usage; association ≠ causation.
- Never Tenant Sale; CoA admin route stays removed; no invasive tracking.
- Repo-backed catalogue; PRD extras NOT_APPLICABLE.
- **Do not git commit.**
- Wire producers at real post/complete/accept call sites if identifiable; if call sites are too tangled, provide `emit*` helpers + clear integration hooks and document exact files to wire — but prefer real wiring for the 3 commerce paths.
- Reuse Phase 4 outbox/emit patterns in `lib/admin/analytics/*`. No parallel event store.
- Event payloads: IDs/classifications only — no Tenant GL line text, no MRA credentials/payloads.

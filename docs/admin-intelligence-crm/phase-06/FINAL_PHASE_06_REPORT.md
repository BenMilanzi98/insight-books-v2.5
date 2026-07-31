# Phase 6 Final Report — Revenue Intelligence Workbench

**Decision:** **CONDITIONAL GO** for later CRM / engagement fact phases.

Platform billing revenue intelligence is shippable for authorised Finance / Audit / management users with explicit UNAVAILABLE / NOT_SUPPORTED envelopes where reconstruct, FX, or dimensions are insufficient. Do not treat estimated MRR or deterministic renewal exposure as GAAP recognised revenue.

## Delivered

| Wave | Focus | Status |
|------|-------|--------|
| 0 | Audits + matrix + handoff | Done |
| 1 | Catalogue + reconstruct + snapshots + APIs | Done |
| 2 | Workbench shell + recurring UI | Done |
| 3 | Billing / collections / ageing | Done |
| 4 | Cohorts / forecast / recon / reports | Done |

## Surfaces (Wave 4)

### Libraries

- `lib/admin/revenue/cohorts.js` — start-month cohorts + retention (count / contracted MRR); gated on reconstruct confidence
- `lib/admin/revenue/concentration.js` — top tenants by estimated MRR; HHI + top-10 share; name masking
- `lib/admin/revenue/forecast.js` — deterministic renewal exposure + 0.9 / 1.0 / 1.1 scenarios
- `lib/admin/revenue/wave4KpiPack.js` — section packs, definitions/settings payloads, export helper

### APIs

- `GET /api/admin/intelligence/revenue/cohorts`
- `GET /api/admin/intelligence/revenue/retention` (aliases cohorts retention)
- `GET /api/admin/intelligence/revenue/customers`
- `GET /api/admin/intelligence/revenue/segments`
- `GET /api/admin/intelligence/revenue/concentration`
- `GET /api/admin/intelligence/revenue/forecast`
- `GET /api/admin/intelligence/revenue/export` (JSON/CSV + audit log)
- `GET /api/admin/intelligence/revenue/definitions`
- `GET|POST /api/admin/intelligence/revenue/settings` (POST → 501 read-only)
- `GET /api/admin/intelligence/revenue/plans`
- `GET /api/admin/intelligence/revenue/subscriptions`

### UI

Unstubbed Wave 4 sections under `/insightbooks/intelligence/revenue/*` (cohorts, retention, customers, segments, concentration, forecast, reports with export, definitions, settings, subscriptions, plans). Reconciliation polish: attention links + notes. Phase 5 executive attention soft-links payment recon / MRR failures toward revenue overview or reconciliation.

## Hard rules preserved

- Platform billing only — no Tenant Sale / tenant GL / fiscal EISInvoice as SaaS revenue
- No false zeroes — UNAVAILABLE / FORBIDDEN / NOT_SUPPORTED keep `value: null`
- Per-currency money; `currency=ALL` → UNAVAILABLE (`fx_unavailable`)
- Forecast = deterministic renewal exposure only (documented multipliers; no ML)
- Cohorts only when reconstruct confidence is HIGH or MIXED; thin history → UNAVAILABLE
- Industry / region / acquisition → NOT_SUPPORTED
- Auth aligned with revenue pack (`dashboard.view` OR `intel.revenue.read`; finance metrics gated)

## Known limitations

- Estimated MRR/ARR remain approximate (yearly ÷ 12; CORE+EIS coexistence)
- Reconstruct history is best-effort from live `AccountSubscription` rows — sparse `startedAt` lowers confidence
- Cohorts / bridge components frequently UNAVAILABLE until snapshot coverage matures
- No certified FX source — cross-currency totals stay UNAVAILABLE
- XLSX/PDF export formats return 501; JSON/CSV foundation only
- Settings are read-only (default MWK; FX unavailable)
- Tenant display names require `tenants.view`; otherwise masked ids/labels
- Deterministic renewal exposure is not churn prediction or recognised revenue

## Verification

```bash
npx vitest run test/systemAdmin.revenue*.test.js test/systemAdmin.navPermissionMap.test.js test/systemAdmin.executiveKpiPack.test.js
```

Expected: PASS.

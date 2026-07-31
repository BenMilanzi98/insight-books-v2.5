# Feature Flag Inventory — System Audit

| Status | **STUB — see source for full list** |
| Source | `lib/accountingV2/infrastructure/featureFlags.js` |

## Storage

Database table `AcctV2FeatureFlag` — scope precedence: tenant+module+event > tenant > global > default (**OFF**).

## Accounting V2 flags (sample)

| Flag | Purpose |
|---|---|
| `accountingV2Enabled` | Master V2 switch |
| `accountingV2ShadowMode` | Shadow write/compare |
| `accountingV2NewJournalSchema` | V2 journal tables |
| `accountingV2LedgerProjection` | Summary projection |
| `accountingV2StrictIdempotency` | Strict idempotency |
| `accountingV2StrictTenantValidation` | Tenant line checks |

## CoA V2 flags (sample)

`coaV2Enabled`, `coaV2SalaryAccountEnforcement`, `coaV2CanonicalMappings`, etc.

## Reporting V2 flags (sample)

`trialBalanceV2Enabled`, `financialReportsV2Enabled`, `reportDrillDownV2Enabled`, etc.

## TO FILL

- Per-environment flag matrix (dev/staging/prod)
- Flag change audit trail samples

## Related

`docs/production-cutover/FEATURE_FLAG_ACTIVATION.md`

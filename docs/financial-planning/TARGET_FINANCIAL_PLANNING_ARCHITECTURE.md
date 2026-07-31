# Target Financial Planning Architecture

## Separation

| Layer | Storage | Posts to GL? |
|---|---|---|
| Actuals | Canonical JE / GL / report snapshots | Yes (via Posting Engine) |
| Historical planning dataset | Derived read models | No |
| Budget (`PlanV2Budget*`) | Planning tables | No |
| Forecast (`PlanV2Forecast*`) | Planning tables | No |
| Assumptions / Scenarios | Planning tables | No |
| Projection results | `resultPayload` JSON on forecast version | No |
| Snapshots | `PlanV2ForecastSnapshot` | No |

## Controlled flow

```
Canonical GL / closed-period snapshots
  → Historical Financial Dataset Service
  → Planning configuration + assumption set + scenario
  → Three-Statement Projection Engine (server, exact decimals)
  → Validation (FPL-00x)
  → Forecast version (draft → review → approve)
  → Immutable snapshot
  → Variance / rolling / Phase 14 KPI inputs
```

## Engine policy

- Monthly is the canonical calculation grain.
- Cash is residual from Balance Sheet identity (indirect CF) so CF cash ≡ BS cash.
- Imbalance → `integrityStatus = INVALID` → approval blocked.
- Capital ≠ revenue; loan proceeds ≠ revenue; principal ≠ expense; drawings/dividends ≠ opex.

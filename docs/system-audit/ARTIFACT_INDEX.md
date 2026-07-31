# Artifact Index — System Audit

| Status | **STUB — key generated artifacts** |

## System audit

| Artifact | Path | Refresh |
|---|---|---|
| Inventory counts + full route lists | `artifacts/system-audit/inventory-counts.json` | `node scripts/generate-system-audit-inventory.cjs` |

## Accounting forensic (git-ignored when contains prod data)

| Artifact | Path | Refresh |
|---|---|---|
| Forensic JSON/CSV | `artifacts/accounting-audit/` | `npm run audit:forensic` |

## QA / release

| Artifact | Path |
|---|---|
| Release certification | `artifacts/quality-assurance/release-certification-latest.json` |
| Platform performance readiness | `artifacts/performance-reliability/platform-performance-readiness.csv` |
| Capacity certification | `artifacts/performance-reliability/capacity-certification-latest.json` |

## Cutover

| Artifact | Path |
|---|---|
| Manifest | `artifacts/production-cutover/manifest-latest.json` |
| Inventory snapshot | `artifacts/production-cutover/inventory/inventory-latest.json` |

## Module readiness CSVs

`artifacts/accounting-coa/`, `artifacts/bank-reconciliation/`, `artifacts/equity-management/`, etc.

## TO FILL

- Production forensic run ID + timestamp
- npm test CI artifact URL

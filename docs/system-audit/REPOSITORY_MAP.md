# Repository Map — System Audit

| Status | **STUB — inventory in artifact** |

## Top-level layout

| Path | Contents |
|---|---|
| `app/` | UI pages + API routes (681 handlers) |
| `lib/` | Domain logic — 17 top-level modules + shared utilities |
| `prisma/` | Schema + 109 migrations |
| `test/` | 106 Vitest test files |
| `scripts/` | Forensic, integrity, cutover, inventory generators |
| `docs/` | Phase and module documentation |
| `artifacts/` | Generated audit/cutover/QA artifacts (partial gitignore) |

## Financial write surfaces

See `docs/accounting-audit/REPOSITORY_ACCOUNTING_MAP.md` for every file that touches GL data.

## V2 lib packages

`accountingV2`, `coaV2`, `bankReconciliation`, `equityManagement`, `accountingClose`, `financialPlanning`, `loanReadiness`, `securityGovernance`, `productionCutover`, `performanceReliability`.

## Refresh

```bash
node scripts/generate-system-audit-inventory.cjs
```

Output: `artifacts/system-audit/inventory-counts.json`

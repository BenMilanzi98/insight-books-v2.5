# Frontend Surface Audit — System Audit

| Status | **STUB — inventory only; no manual UI pass** |

## Page count

**157** pages — full list in `artifacts/system-audit/inventory-counts.json` → `pages[]`.

## V2 UI entry points

| Page | Module |
|---|---|
| `/general-ledger-v2` | Ledger |
| `/financial-calendar-v2` | Periods |
| `/reports-v2` | Reports |
| `/chart-of-accounts/governance` | CoA V2 |
| `/bank-reconciliation` | Bank recon |
| `/equity-management` | Equity |
| `/accounting-close` | Close |
| `/financial-planning` | Planning |
| `/loan-readiness` | Loan readiness |
| `/security-governance` | Security |

## Gaps

- **No Playwright E2E** in CI (GAP-QA-015)
- Accessibility audit not in scope — see `.cursor/skills/accessibility-helper` if needed

## TO FILL

- Critical path UI checklist (login → TB → invoice → payment)
- Browser compatibility matrix

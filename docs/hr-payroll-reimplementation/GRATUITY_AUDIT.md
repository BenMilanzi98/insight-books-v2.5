# Gratuity Audit

Routes: `/hr/gratuity` · APIs: `/api/gratuity/**`, payments, clear · Models: GratuityAccount, GratuityPayment

## Findings

| Topic | Status | Classification |
|-------|--------|----------------|
| Per-employee account | Present (1:1) | `EXTEND` |
| Accrual rate Float default 5 | Present | Policy versioning `INCOMPLETE` |
| totalAccrued / paid / outstanding | Present Float | Decimal migrate |
| Payroll stores `gratuityAccruedAmount` for reversal | Present | `REUSE` idea |
| GratuityPayment.tenantId | Missing | `CROSS_TENANT_RISK` |
| Provision journal distinct from settlement | Weak | `INCOMPLETE` / `INCORRECT_ACCOUNTING` risk |
| Eligibility / service period engine | Thin | `INCOMPLETE` |
| Tax treatment | Unclear | `INCOMPLETE` |
| Duplicate expense protection | Unclear | `DUPLICATE_POSTING_RISK` |

## Disposition

`EXTEND` models; accrual/settlement posting `REIMPLEMENT` per posting matrix.

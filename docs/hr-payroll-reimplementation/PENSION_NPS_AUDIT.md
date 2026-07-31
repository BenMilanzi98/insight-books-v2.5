# Pension (NPS) Audit

Routes: `/hr/pension` · APIs: `/api/pension`, `settings`, `clear` · Config: `TenantSettings.nps*RatePercent` · Calc: `calculateNPS`

## Findings

### Strengths

- Tenant-configurable employee/employer %.  
- Null rates treated carefully in comments (`npsTenantRates.js`).  
- Employer contribution excluded from net pay.  
- Remittance “clear” UI/API exists.  
- Totals stored on Payroll (`totalNpsAmount`).

### Gaps

| Gap | Classification |
|-----|----------------|
| No PensionContribution / Remittance ledger models | `INCOMPLETE` |
| Rates not effective-dated versions (single TenantSettings pair) | `INCOMPLETE` |
| Pensionable earnings = gross in calculatePayroll (not component-based) | `INCORRECT_CALCULATION` risk |
| Caps / min / max not modeled | `INCOMPLETE` |
| Employee pension identifier not first-class | `INCOMPLETE` |
| Duplicate remittance protection unclear | `DUPLICATE_POSTING_RISK` |
| Float rates and amounts | `INCORRECT_CALCULATION` |

### Disposition

| Piece | Classification |
|-------|----------------|
| UI + settings API | `EXTEND` |
| Rate helper | `REUSE` |
| Contribution/remittance engine | `REIMPLEMENT` |
| Liability posting via payroll lines | `EXTEND` with idempotency |

# Period Close Checklist

`lib/accountingV2/periods/periodCloseChecklist.js`.

## Template framework

Templates are versioned and frozen (`Object.freeze`): task key, name,
description, module, kind (AUTOMATIC | MANUAL), blocking flag, required flag,
responsible role, evidence requirement, display order and template version.
A published version is immutable — changes require a new version. Each close
run records the template ID + version it materialized.

## STANDARD_MONTHLY_CLOSE v1 (21 tasks)

**Automatic, blocking:** Trial Balance balances (TB_BALANCED); no journals in
POSTING state; no unresolved failed postings; GL agrees with journal lines
(GL_JE_RECON); Balance Sheet equation; AR control reconciliation; AP control
reconciliation; no material unmapped accounts; no blocking period exceptions;
required reports generate with acceptable integrity (INCOME_STATEMENT,
BALANCE_SHEET, CASH_FLOW, EQUITY_STATEMENT).

**Automatic, warning:** draft journal review; inventory control difference;
payroll liability difference; loan control difference.

**Manual (evidence required):** bank reconciliation review; suspense/rounding
account review; unusual transaction review; tax submission readiness;
management approval evidence.

Manual tasks cannot be auto-completed: `updateManualCloseTask` requires a
comment/evidence payload and records user + timestamp. `waiveCloseTask`
requires a reason, and waiving a **blocking** task additionally requires
`accountingPeriods.overrideMateriality`.

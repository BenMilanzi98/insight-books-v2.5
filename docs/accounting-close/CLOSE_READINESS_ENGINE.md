# Close Readiness Engine

Service: `readinessService.js` + `moduleCloseChecks.js`

Assesses configuration, period statuses, TB, journals in POSTING, bank recon, and module feeds:

- AR / AP via `glReconciliation`
- Inventory / payroll / assets / loans / tax via GL mappings + unposted source heuristics
- Equity via live `runEquityReconciliation`

Statuses: READY | READY_WITH_WARNINGS | BLOCKED | REQUIRES_*  

Blocking material exceptions prevent READY.

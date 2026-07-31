# Report Validation Rules

`lib/accountingV2/reporting/reportValidationService.js` implements the
REP-001..REP-040 catalogue. Each rule carries an enforcement class:

- **RUNTIME** — evaluated against generated results (equations, control
  reconciliation, drill-down sampling, envelope structure).
- **STRUCTURAL** — impossible by construction (canonical source, single
  assignment, no stored balances); each has a regression test proving the
  guarantee.
- **PROCESS** — enforced by workflow (immutable snapshots, approval gates).

| Rule | Class | Enforcement |
| --- | --- | --- |
| REP-001 TB debits ≠ credits | RUNTIME | TB equations; reconciliation finding |
| REP-002 Net Profit ≠ CYE | RUNTIME | IS internal equation + IS-vs-BS check |
| REP-003 BS unbalanced | RUNTIME | equation with exact difference, no plug |
| REP-004 CF cash mismatch | RUNTIME | two cash equations |
| REP-005 Equity stmt ≠ BS equity | RUNTIME | reconciliation |
| REP-006/007 AR/AP aging ≠ control | RUNTIME | subledger vs control totals |
| REP-008..012 Inventory/Assets/Payroll/Loans/Tax ≠ GL | RUNTIME | module reports read GL directly; register differences via reconciliation |
| REP-013 parent/child double count | RUNTIME | duplicate-account scan per envelope (+ structural single assignment) |
| REP-014 incompatible sections | RUNTIME | same scan |
| REP-015 CYE counted twice | STRUCTURAL | single calculated line; P&L excluded from position lines (tested) |
| REP-016 RE incorrect | STRUCTURAL | calculated from prior-year P&L only |
| REP-017 opening counted twice | RUNTIME | TB opening equation |
| REP-018..021 draft/cancelled/failed/shadow included | STRUCTURAL | posted-only canonical union; shadow tables never queried (tested) |
| REP-022 reversal mishandled | STRUCTURAL | reversals are ordinary posted lines |
| REP-023 legacy+V2 double count | STRUCTURAL | mirror exclusion (`transactionId IS NULL`) (tested) |
| REP-024 line lacks source accounts | RUNTIME | envelope scan (aging buckets carry document detail instead) |
| REP-025 drill-down ≠ line | RUNTIME | drill-down comparison + sampling |
| REP-026 export ≠ screen | RUNTIME/STRUCTURAL | exports consume the same envelope; export tests |
| REP-027/028/029 business/period/currency scope | RUNTIME | envelope scan + contract validation |
| REP-030 cache ≠ canonical | RUNTIME | cache reconciliation |
| REP-031 unsupported historical balance | STRUCTURAL | stored balances never read; open exceptions disclosed |
| REP-032 operational totals in statements | STRUCTURAL | engine has no operational reads in statement amounts |
| REP-033 join multiplication | STRUCTURAL | grouped canonical totals, no fan-out joins |
| REP-034 normal-balance sign wrong | RUNTIME | unconfigured normal balances surfaced |
| REP-035 comparative mismatch | RUNTIME | contract rejection + envelope scan |
| REP-036/038 unmapped/unassigned material balance | RUNTIME | disclosure + VERIFIED block |
| REP-037 account on incompatible lines | STRUCTURAL | first-match single assignment |
| REP-039 definition version missing | RUNTIME | envelope scan |
| REP-040 closed-period report changed | PROCESS | immutable snapshots + supersession with reason |

`runReportReconciliation` (§69) regenerates TB, IS, BS, CF, Equity, AR and AP
for a scope, cross-checks them, scans envelopes, samples drill-downs and
returns findings with expected/actual amounts, severity and an overall status.
Exposed at `POST /api/accounting-v2/reports/reconciliation`.

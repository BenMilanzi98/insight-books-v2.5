# Final Gap Register

| Generated | 2026-07-23T10:22:17.109Z |
| Initial gap count | **10** (this pack) + carry-forward from `docs/system-audit` and MRA EIS G19–G21 |
| Resolved this pass | Inventory + audit pack + CoA capital regression confirmation |
| Fresh-books cutover (2026-07-24) | FSA-GAP-001, FSA-GAP-009 marked CLOSED/REMEDIATED — see `docs/accounting-integrations/FRESH_BOOKS_CUTOVER_EVIDENCE.md` |
| Remaining material gaps | **8** |

| ID | Gap | Severity | State | Notes |
| --- | --- | --- | --- | --- |
| FSA-GAP-001 | Dual financial report stacks (legacy /api/reports vs accounting-v2) | CRITICAL | CLOSED/REMEDIATED | 2026-07-24 fresh-books cutover: V2 reports + GL SoT; legacy writers fail-closed (`LEGACY_POSTING_REMOVED`); gate `scripts/forbid-legacy-gl-writers.cjs` |
| FSA-GAP-002 | AcctV2 outbox dispatcher missing | HIGH | OPEN | SYS-DEF-004 |
| FSA-GAP-003 | Production tenant forensic reconciliation not executed | HIGH | OPEN | Scripts exist; no prod extract in this pass |
| FSA-GAP-004 | Every-route E2E + responsive + a11y certification incomplete | HIGH | OPEN | Inventory only |
| FSA-GAP-005 | Phase 17 capacity NOT CERTIFIED | HIGH | OPEN | docs/performance-reliability |
| FSA-GAP-006 | Phase 18 cutover NOT EXECUTED | HIGH | OPEN | docs/production-cutover |
| FSA-GAP-007 | MRA EIS production enablement blocked | HIGH | OPEN | G21-001…007; 0 prod terminals |
| FSA-GAP-008 | Legacy Account.balance / header-only JE residual risk | HIGH | OPEN | capitalEquityAudit READ-ONLY; balance mutations throw `LEGACY_BALANCE_MUTATION_DISABLED` |
| FSA-GAP-009 | Operational sources not 100% cut over to executePosting | HIGH | CLOSED/REMEDIATED | 2026-07-24 fresh-books: `postGlEntry` / `transaction.create` / balance writers gated; adapters → `executePosting` |
| FSA-GAP-010 | Reconciliation Centre UI incomplete | MEDIUM | OPEN | Domain audits exist |

## Ordered remediation

1. Force financial UI/exports onto Accounting V2 report APIs; quarantine legacy report routes.
2. Ship outbox dispatcher with idempotent handlers.
3. Run production forensic: unbalanced journals, capital double-count, AR/AP/inventory/bank.
4. Complete posting-matrix cutover for invoices, POS, payments, expenses, payroll, assets.
5. Capacity + cutover + MRA sandbox/pilot gates.
6. Responsive / a11y / security pen-test certification.

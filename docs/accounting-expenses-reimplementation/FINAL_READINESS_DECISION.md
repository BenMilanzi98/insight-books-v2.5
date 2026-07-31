# Final Readiness Decision — Accounting + Expenses Reimplementation

**Date:** 2026-07-25  
**Decision:** CONDITIONALLY_READY for continued rollout (core SoT + expense posting + Excel foundation)

## Confirmed

1. Chart of Accounts (`Account` + purpose mappings) is the authoritative account master.
2. Posted `JournalEntryLine` rows are the authoritative Debit/Credit evidence.
3. Canonical posting engine is `executePosting` only (`postGlEntry` fail-closed).
4. Expense recognition posts via `postExpenseAccounting` with CoA account IDs.
5. Expense payments no longer re-debit expense accounts (AP/employee/CC settle only).
6. Anti-blueprint `ensureExpenseAccountsForTenant` is a no-op; blueprint expense leaves expanded.
7. Purpose `legacyCode`s corrected (VAT 1240, COGS 5110, bank leaf, FX/corporate tax).
8. Excel export/import dry-run foundation exists; dry-run does not mutate.
9. Boundary + expense unit tests pass (26 related tests green); legacy GL writer gate OK.

## Remaining (not blocking core SoT)

- Multi-line ExpenseLine model / split allocations (still single-line)
- Formal DB enum state machine on Expense.status
- Full BACKUP_RESTORE posted-expense reconstruction
- CoA merge route still rewrites historical lines (prefer V2 consolidation)
- Tenant gap-provisioning UI (Account Template Upgrade Workbench)
- Full responsive/a11y/E2E matrix and production build certification

## Honest conclusion

The forensic audit pack is complete. The posting foundation and expense recognition path are V2/CoA-aligned. Expense categories and the default CoA expense tree are substantially expanded. Excel backup/import dry-run is implemented. Full multi-line expenses, posted restore, and the entire acceptance checklist (130+ items) are **not** all closed in this pass — continue via IMPLEMENTATION_PLAN phases for remaining OPEN gaps.

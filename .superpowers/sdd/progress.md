# Wave A — Invoice Payment Deferred Full Tax

Branch: `feat/wave-a-invoice-deferred-tax` (worktree)
Worktree: `.worktrees/wave-a-invoice-deferred-tax`
Plan: `docs/superpowers/plans/2026-08-22-invoice-payment-deferred-tax.md`
Spec: `docs/superpowers/specs/2026-08-22-invoice-payment-deferred-tax-design.md`

Notes:
- Implementers commit only files for their task.
- Match existing `lib/accountingV2` APIs (`resolvePurpose`, `requiredPurposes`, `buildDraft`, `money`, `createJournalLineDraft`, `AccountingEventType.INVOICE_POSTED`).

## Ledger


- Task 1: complete (commits 59d89eb78..86a8eec20, review clean; minor: stale v1 header comment)


- Task 2: complete (commits 86a8eec20..26ca81d24, review clean)


- Task 3: complete (commits 26ca81d24..8837a6ad2, review clean)


- Task 4: complete (commits 8837a6ad2..54598ff32, review clean; minor: payments route pre-existing non-atomic accounting)


- Task 5: complete (commits 54598ff32..d4e60ed94, review clean)


- Task 6: complete (commits d4e60ed94..4aa4c744b, review clean; note: removed dead aggregate + regression guards)


- Task 7: complete (no code commit; 26/26 vitest PASS; manual smoke NOT RUN)


- Final review: Important I-1 fixed (d7f71d6a2, re-review clean); I-2 manual smoke still NOT RUN


- Verification after I-1: 28/28 Wave A vitest PASS at d7f71d6a2


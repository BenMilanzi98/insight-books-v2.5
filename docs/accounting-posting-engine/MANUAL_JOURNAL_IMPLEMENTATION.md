# Manual Journal Implementation (controlled pilot)

Implementation: `lib/accountingV2/application/manualJournalService.js` +
`MANUAL_JOURNAL` template + engine. API:
`app/api/accounting-v2/journals/*`.

## Workflow

1. `POST /api/accounting-v2/journals` — create draft (`journal.create`).
   Lines validated immediately: balanced, valid accounts, no negatives,
   decimal strings. Draft persists as a V2 `JournalEntry` in `Draft` status
   with `architectureVersion = 'ACCOUNTING_V2'`.
2. `PATCH /api/accounting-v2/journals/{id}` — edit while `DRAFT` only.
3. `POST …/{id}/submit` — `DRAFT → PENDING_APPROVAL` (`journal.submit`).
4. `POST …/{id}/approve` | `…/reject` — approver action (`journal.approve`);
   separation of duties enforced (creator cannot approve — tested).
5. `POST …/{id}/preview` — read-only engine preview (no claim, no number).
6. `POST …/{id}/post` — (`journal.post`) delegates to the central engine:
   claim event → validation pipeline → atomic posting → journal number
   (`MJ-YYYY-NNNNNN`) → immutable `Posted` journal with full trace (template,
   event, approver, audit, outbox).
7. `POST …/{id}/cancel` — before posting only.

Posting only proceeds when the resolved posting mode permits it (feature
flag `NEW_ENGINE` scope for `MANUAL_JOURNAL_POSTED`); in `LEGACY` mode the
engine refuses (tested).

## Restrictions enforced

No cross-business, inactive, deprecated or header accounts; no protected
control accounts without permission; no Current Year Earnings; no Retained
Earnings outside the authorized adjustment process; no system-clearing
accounts without permission; no closed-period posting; no negative lines; no
unbalanced posting (rejected at draft creation and re-checked at posting); no
editing after posting (annotation-only, audited).

## End-to-end evidence

Integration scenarios 1–3 are covered in
`test/accountingV2.postingEngine.test.js`: full draft→approve→post trace
(journal + event + audit + outbox + source state), duplicate post replaying
the original result with exactly one journal, and failed posting leaving no
partial effect with a durable failure record.

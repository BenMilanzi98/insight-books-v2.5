# Duplicate Journal Repair

## Detection

`P6-DUP-001` groups active posted legacy transactions by `(sourceType,
sourceId)` (reversals and `gl_posting` internals excluded). Two or more active
postings for one source is a candidate. Identical line totals →
`HIGH_CONFIDENCE`; differing totals → `MEDIUM_CONFIDENCE` (may be a legitimate
partial/installment/split — investigation required). Legacy-vs-V2 duplication is
detected separately (GL-117 → `LEGACY_V2_DUPLICATION`). Reversal pairs are never
flagged as duplicates.

Classification during investigation distinguishes: confirmed duplicate, highly
probable, possible, legitimate repeated event, reversal pair,
installment/partial, split settlement, batch settlement. Only confirmed
duplicates (evidence: matching source identity, external reference, amounts,
accounts, dates, audit events; proof neither is a legitimate repeat) proceed.

## Repair (`DUPLICATE_EFFECT_REPAIR`)

1. The investigator identifies the **authoritative** journal and proposes a
   reversal of the duplicate (exact opposite lines) on the anomaly.
2. Finance approves (Finance Manager, separation of duties).
3. Execution posts one `HREP-` reversal journal through the posting engine —
   exactly the approved lines; both original journals are preserved; the
   duplicate anomaly, action and journal are linked.
4. Verification: ledger rebuild + reconciliation + snapshot delta must show the
   net effect of exactly one economic event.

Deletion of either journal is impossible (the Prisma stub, the engine and the
verification service all treat a missing repair journal as a violation:
"posted journals must never be deleted").

## Duplicate journal LINES

Actual duplicated posted lines → reversal + corrected repost (approved).
Projection-only duplication → `PROJECTION_REBUILD` (no journal). Report-join
duplication → `REPORT_ONLY_REPAIR` (no journal). See `ANOMALY_CLASSIFICATION.md`
(`DUPLICATE_JOURNAL_LINE` permits exactly these three classes).

End-to-end coverage: `accountingV2.repair.test.js` — confirmed duplicate
reversed once, originals preserved, net ledger effect corrected, replay creates
no second reversal, legitimate single postings not flagged.

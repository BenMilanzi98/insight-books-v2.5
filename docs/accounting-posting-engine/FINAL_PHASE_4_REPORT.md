# FINAL PHASE 4 REPORT — Central Accounting Posting Engine

Date: 2026-07-20 · Status: **COMPLETE** · Default posting mode: **LEGACY**
(engine not globally activated).

## 1. Executive summary

Phase 4 delivered the centralized Accounting Posting Engine as the only
approved architecture for new accounting writes. Every posting flows through
one controlled path — command validation, source validation, idempotency,
approvals, mapping/account/period validation, template-driven draft
generation, double-entry validation, atomic persistence, source-state update,
audit and outbox — and produces exactly one balanced, immutable, traceable
journal. Three pilots run through the engine (Manual Journal, Adjustment
Journal, Opening Balance) plus a shadow-only Customer Invoice comparison.
Legacy posting remains authoritative by default; a bidirectional guard makes
double-posting impossible in either direction. All 48 engine tests pass; the
production build succeeds; the additive migration is deployed.

## 2. Previous-phase evidence reviewed

`PHASE_1_TO_3_EVIDENCE_INDEX.md` — 14 Phase 1 findings, 14 Phase 2 decisions,
9 Phase 3 decisions catalogued with the posting-engine control each one binds.

## 3. Existing posting architecture findings

`CURRENT_POSTING_ARCHITECTURE.md` — dual journal stores
(`Transaction`/`TransactionLine` and `JournalEntry`/`JournalEntryLine`),
`postGlEntry` + `journalService` posting services, module-local bypasses, and
the Phase 2/3 controls already in place.

## 4–5. Target engine and database changes

Engine: `lib/accountingV2/engine/` (13 modules), orchestrated by
`postingEngine.js` (`previewPosting`, `executePosting`, `retryPosting`).
Database (migration `20260720160000_acctv2_posting_engine`, all additive):

- `JournalEntry` +20 columns (number, totals, currency trio, posting date,
  period, template, architecture, event linkage, approval, adjustment fields,
  metadata); uniques `(tenantId, journalNumber)`, `accountingEventId`.
- `JournalEntryLine` +5 columns (base amounts, currency, taxCode, dimensions);
  non-negative CHECKs.
- `AcctV2EventRegistry` +5 columns (approval/template linkage,
  `failureRetryable`).
- New `AcctV2JournalSequence`, `AcctV2OpeningBalanceBatch`.
- CHECK `je_v2_posted_requirements` for V2 posted journals.

## 6–7. Contracts

Posting Command (`postingCommand.js`): strictly typed, decimal-string money,
canonical idempotency key, command hash, client overrides rejected.
Posting Result (`postingResult.js`): standardized, replay-aware
(`wasExistingPosting`), shadow-aware (`wasShadowPosting`, `comparisonStatus`).

## 8–10. Registry, idempotency, concurrency

Registry statuses + enforced transitions (`eventStatus.js`); DB-backed
idempotency (unique key + hash comparison + two-phase claim); concurrency via
unique constraints, atomic sequence increments and guarded state transitions.
Exactly one financial effect survives every tested race.

## 11–14. Source validation, approvals, accounts, periods

Typed source-validator framework with four pilot validators; native approval
contract with separation of duties; per-line account validation against CoA V2
(header/deprecated/inactive/cross-tenant/control-dimension/manual-restriction
rules); explicit period resolution with closed/backdate/future/gap/overlap
errors (no silent skips).

## 15–20. Templates, validation, persistence, numbering, immutability, source state

24 versioned templates (4 ACTIVE, 20 DEFINED for Phase 9), immutable once
registered; deterministic validation pipeline shared by preview and posting;
single-transaction persistence with full rollback; `MJ/ADJ/OB-YYYY-NNNNNN`
concurrency-safe numbering; posted journals frozen (annotation-only, audited);
source posting state derived centrally from the event registry.

## 21–23. Audit, outbox, errors

Append-only audit records with full trace; same-transaction outbox events
(`JOURNAL_POSTED`, `SOURCE_ACCOUNTING_STATUS_CHANGED`, …) with no pre-commit
external side effects; 33 typed errors with retryability classification and
capped backoff retries.

## 24–25. Legacy guard and shadow posting

Bidirectional guard wired into `postGlEntry.js` and `journalService.js`
(legacy side) and the posting transaction (V2 side); legacy void/reversal of
V2 journals refused. Shadow postings run identical logic into isolated tables,
never touch production balances, and produce 12-way classified comparisons
(pilot: customer invoices, EXACT_MATCH verified in tests).

## 26–28. Manual journals, adjustments, opening balances

Full lifecycle services + APIs: draft → submit → approve → post →
immutable, with separation of duties, restricted accounts, closed-period
refusal, idempotent replay. Adjustments add mandatory reason/category/related
journal. Opening balances add unique batch identity, evidence requirement, and
subledger-dimension enforcement. No historical opening balances were migrated.

## 29–32. APIs, diagnostics, security, observability

Ten journal routes, six opening-balance routes, events history and diagnostics
endpoints, all behind `routeGuard` permissions; read-only diagnostics page at
`/system/accounting-posting-engine`; 19 permissions enforced server-side;
structured logs + in-process metrics + durable attempt records.

## 33–34. Tests and results

- `test/accountingV2.postingEngine.test.js`: **48/48 pass** — command
  validation, template registry, numbering, period resolution, account
  validation, approvals, manual-journal end-to-end (incl. duplicate replay,
  failure rollback, immutability, LEGACY-mode refusal, preview isolation),
  shadow invoice (match/difference/missing/invalid), legacy↔new guard,
  opening balances (all 7 scenarios).
- Companion suites (`accountingV2.posting`, `accountingV2.domain`,
  `accountingV2.boundaries`, `coaV2.services`): **78/78 pass** (boundary rule
  extended to whitelist the two approved V2 journal writers).
- Full suite: **541 passed, 3 skipped, 8 failed** — all 8 failures verified
  identical on a clean tree (pre-existing UI/report issues in
  `journalAccountSelect`, `incomeStatementOperating*`,
  `expenseCoaCategoryPicker`, `salaryAdvanceGlAccount`, `taxRateValidation`;
  unrelated to accounting V2).
- One genuine Phase 4 regression found and fixed: the legacy guard now
  degrades safely when handed a narrowed legacy transaction client without V2
  delegates (`payrollReversalLegacyRoot` now passes).

## 35–36. Migration and performance validation

Migration deployed; `prisma migrate status` clean (98 migrations); additive
only; NOT VALID constraints avoid historical scans (details in
`MIGRATION_VALIDATION.md`). Performance: indexed identity/source/period/number
lookups, batched line creation, no external calls in transactions, no
full-table duplicate scans, paginated diagnostics.

## 37–39. Blockers, deferrals, Phase 5

No blockers. Deferred to Phase 9: activation of the 20 DEFINED operational
templates and their source validators/adapters. Phase 8: period framework
replacement (resolver seam ready). Phase 5 inputs documented in
`PHASE_5_READINESS.md` (canonical structures, ledger filters, dual legacy
store decision).

## 40–41. Deployment and rollback

Deploy: `npx prisma migrate deploy && npx prisma generate && npm run build`.
Activation (per business/event, post-checklist): grant `NEW_ENGINE` flag scope
via the audited flag API. Rollback: flip scope to `LEGACY` (or `DISABLED`);
never delete posted journals — see `ROLLBACK_STRATEGY.md`.

## 42–45. Confirmations

- **Historical accounting data preserved** — no historical journal was read,
  rewritten or reclassified by any Phase 4 change; all DDL is additive.
- **No unsupported balancing journals** — unbalanced drafts are rejected;
  no suspense auto-balancing exists anywhere in the engine.
- **No duplicate active financial effects** — DB-backed idempotency, unique
  event/journal constraints and the bidirectional legacy guard are all tested.
- **No unauthorized global activation** — default mode is LEGACY; NEW_ENGINE
  requires an explicit, audited, per-scope flag grant plus the readiness
  checklist; nothing was activated in this phase.

## Verification summary

| Check | Result |
| --- | --- |
| Engine tests (48) | PASS |
| V2 companion tests (78) | PASS |
| Full suite | 541 pass / 8 pre-existing failures (clean-tree verified) |
| Production build (`next build`) | PASS |
| Migration status | Up to date |
| Lint (`next lint`) | Pre-existing config failure (`@next/next` plugin missing) — identical on clean tree; not introduced by Phase 4 |
| Type checking | JS project (no `tsc` step); build-time SWC checks pass |

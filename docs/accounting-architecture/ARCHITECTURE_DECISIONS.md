# Architecture Decision Records

Format per ADR: Context / Decision / Alternatives / Reason / Consequences / Risks /
Follow-up phase / Evidence.

## ADR-001 — General Ledger as the financial source of truth
**Context**: Phase 1 proved reports read operational tables, stored balances, and two ledgers
inconsistently (R-16, `FINANCIAL_REPORT_LINEAGE.md`). **Decision**: financial statements
derive exclusively from posted journal lines; operational tables remain operational.
**Alternatives**: reconcile stored balances (rejected: drift is structural); keep mixed
sources with labels (rejected: labeling failed in practice). **Consequences**: Phases 5/7
rebuild reads; boundary tests forbid new operational-total statements. **Risks**: legacy
reports diverge until Phase 7 — mitigated by lineage tagging. **Follow-up**: 5, 7.
**Evidence**: boundary tests; `SERVICE_BOUNDARIES.md`.

## ADR-002 — Immutable posted journals
**Context**: legacy journals are editable/deletable; JRN-009 header rows were mutated
historically. **Decision**: posted = permanent; corrections via reversal/adjustment only;
repositories expose no update/delete. **Alternatives**: soft-lock flag (rejected: bypassable).
**Consequences**: `JournalImmutableError`; UI must offer reversal flows (Phase 9).
**Risks**: user friction — mitigated by proper adjustment workflows. **Follow-up**: 5.
**Evidence**: `journalRepository` contract + test asserting absence of mutation methods.

## ADR-003 — Centralized accounting event identity
**Context**: duplicates arose from inconsistent, caller-invented source keys (R-23).
**Decision**: every financial event gets one `SourceReference` identity registered in
`AcctV2EventRegistry`. **Alternatives**: per-module dedup conventions (rejected: that is the
current failure). **Consequences**: modules must adopt the catalogue (Phase 9).
**Risks**: identity misuse (wrong eventVersion) — mitigated by content hash + review.
**Follow-up**: 4, 9. **Evidence**: `ACCOUNTING_EVENT_CATALOGUE.md`, registry constraints.

## ADR-004 — Database-backed idempotency
**Context**: `assertNoDuplicatePostedSource` is TOCTOU-racy application code.
**Decision**: unique constraints on idempotency key and identity tuple are the guarantee;
application checks are optimizations. **Alternatives**: advisory locks (rejected: complexity,
connection-pool hazards); Redis (rejected: new infrastructure, weaker guarantee).
**Consequences**: concurrent duplicates fail with P2002 → typed 409. **Risks**: constraint
blocks legitimate re-posting — handled via eventVersion and FAILED-reopen. **Follow-up**: 4.
**Evidence**: `IDEMPOTENCY_DESIGN.md`, concurrency test.

## ADR-005 — Business-scoped accounting context
**Context**: SEC-1/SEC-2 showed tenant scope inferred or client-supplied. **Decision**:
explicit `AccountingContext` built from the session, required by every command; repositories
assert row ownership. **Alternatives**: middleware-injected globals (rejected: hidden state);
RLS (deferred: larger migration, revisit Phase 5). **Consequences**: no context-free entry
points. **Risks**: verbose call signatures — accepted. **Follow-up**: 4 hardens legacy engine.
**Evidence**: cross-tenant tests.

## ADR-006 — Exact decimal arithmetic
**Context**: 48 legacy models use Float (R-14). **Decision**: integer minor units in domain
logic (reusing `lib/money.js`), decimal strings at API boundaries, `Decimal` columns in all V2
tables. **Alternatives**: decimal.js everywhere (rejected: Prisma already ships Decimal;
minor-unit ints are simpler and proven in this repo). **Consequences**: floats rejected by V2
schemas. **Risks**: magnitude limits — guarded by safe-integer checks. **Follow-up**: 6
migrates legacy Float columns. **Evidence**: money tests, schema.

## ADR-007 — Legacy compatibility through adapters
**Context**: legacy must keep operating; conditionals scattered through new code would rot.
**Decision**: all legacy access via `infrastructure/legacy/*`; defects documented per adapter.
**Alternatives**: branch-in-place (rejected). **Consequences**: single removal point per
phase. **Risks**: adapters mask defects — countered by defect documentation and comparison
severities. **Follow-up**: 3/4/5/7/8 remove adapters. **Evidence**: `LEGACY_COMPATIBILITY.md`,
boundary tests.

## ADR-008 — Controlled feature-flag rollout
**Context**: switching accounting behaviour globally is unacceptable risk. **Decision**:
server-side DB flags scoped tenant/module/event with deny-by-default and specificity
precedence; no percentage rollout for financial behaviour. **Alternatives**: env vars
(rejected: not per-tenant); third-party flag service (rejected: new dependency for financial
control). **Consequences**: auditable, per-business activation. **Risks**: flag sprawl —
fixed catalogue, unknown keys rejected. **Follow-up**: 4+. **Evidence**:
`FEATURE_FLAG_STRATEGY.md`, flag tests.

## ADR-009 — Shadow accounting before cutover
**Context**: the new engine must prove equivalence before touching balances. **Decision**:
isolated shadow store + line-level comparison with 11 statuses; activation gated on
thresholds. **Alternatives**: big-bang cutover with reconciliation after (rejected).
**Consequences**: extra write volume when enabled; review workflow needed. **Risks**:
shadow leakage into reports — separate tables + boundary tests. **Follow-up**: 4 populates
templates. **Evidence**: `SHADOW_ACCOUNTING.md`, shadow tests.

## ADR-010 — Transactional outbox
**Context**: future async effects (notifications, projections) must not fire on rolled-back
postings; no queue exists today. **Decision**: outbox rows written in the posting transaction;
dispatcher publishes post-commit. **Alternatives**: direct event emission (rejected: dual-write
problem); full queue adoption now (rejected: premature). **Consequences**: dispatcher is
Phase 4 work; table + contract exist. **Risks**: backlog — ARCH-005 monitors. **Follow-up**: 4.
**Evidence**: outbox atomicity covered by rollback test.

## ADR-011 — Posted journal lines as authoritative financial records
**Context**: stored balances (`Account.balance`, `AccountBalance`,
`TenantSettings.ownerContributedCapital`) drift and double-count (R-04, R-05, R-25).
**Decision**: balances are derived read models; stored balances become caches with defined
invalidation, then retire. **Alternatives**: keep incremental balances authoritative
(rejected: proven drift). **Consequences**: Phase 5 read model must be performant
(indexed, paginated contracts prepared). **Risks**: query cost — mitigated by read-model
design. **Follow-up**: 5, 6. **Evidence**: ledger contract; Phase 1 GL audit.

## ADR-012 — No direct operational-table financial statements
**Context**: AR aging, dashboards, and capital summaries read operational tables and present
them as accounting balances (R-16, AR-001, CAP-005). **Decision**: new financial reports must
read posted lines (or reconciled subledger contracts); operational queries must be labelled
operational. **Alternatives**: none acceptable. **Consequences**: Phase 7 rewrites the
remaining reports; boundary tests police new code. **Risks**: legacy reports stay wrong until
then — documented, monitored. **Follow-up**: 7. **Evidence**: report lineage audit + tests.

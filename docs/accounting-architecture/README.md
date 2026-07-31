# Accounting Architecture (Phase 2)

Phase 2 established the permanent foundation for the Accounting V2 backend without changing
any production accounting behaviour. The legacy engine remains authoritative; the new kernel
observes, registers identities, and shadow-compares under server-controlled flags.

## Code map

| Location | Contents |
|---|---|
| `lib/accountingV2/domain/` | Enums, errors, money value object, accounting context, source reference + idempotency key, journal draft, dimension policies |
| `lib/accountingV2/application/` | Transition posting coordinator (`postAccountingEvent`) |
| `lib/accountingV2/contracts/` | Service contracts + registered implementations; Zod API schemas |
| `lib/accountingV2/infrastructure/` | Transaction boundary, event registry repository, outbox, feature flags, audit trail |
| `lib/accountingV2/infrastructure/legacy/` | The ONLY approved bridge to legacy accounting (6 adapters) |
| `lib/accountingV2/shadow/` | Shadow journal store + legacy comparison engine |
| `lib/accountingV2/observability/` | Structured logger + in-process metrics |
| `lib/accountingV2/permissions.js` | Accounting permission catalogue |
| `lib/accountingAudit/architectureIntegrityAudit.js` | ARCH-* integrity monitor (audit engine module `architecture`) |
| `app/api/system/accounting-architecture/` | Audited admin API (status, flags, configuration) |
| `app/system/accounting-architecture/` | Internal read-only status page |
| `prisma/migrations/20260720110000_acctv2_foundation/` | Additive migration (8 new tables) |

## Commands

```bash
npm test                                   # full suite (includes accountingV2.* suites)
npx vitest run test/accountingV2.domain.test.js test/accountingV2.posting.test.js test/accountingV2.boundaries.test.js
npm run audit:forensic -- --module architecture   # ARCH-* integrity monitor
npx prisma migrate deploy                  # applies the additive foundation
```

## Documents

Start with `FINAL_PHASE_2_REPORT.md`. Design docs: `TARGET_ACCOUNTING_ARCHITECTURE.md`,
`ACCOUNTING_DOMAIN_MODEL.md`, `SERVICE_BOUNDARIES.md`, `DATABASE_FOUNDATION.md`,
`IDEMPOTENCY_DESIGN.md`, `TRANSACTION_BOUNDARY.md`, `LEGACY_COMPATIBILITY.md`,
`SHADOW_ACCOUNTING.md`, `FEATURE_FLAG_STRATEGY.md`, `SECURITY_ARCHITECTURE.md`,
`OBSERVABILITY_GUIDE.md`. Strategy: `DATA_TRANSITION_STRATEGY.md`,
`ACCOUNTING_CUTOVER_STRATEGY.md`. Decisions: `ARCHITECTURE_DECISIONS.md` (ADR-001…012).
Readiness: `PHASE_3_READINESS.md`, `PHASE_4_READINESS.md`. Evidence:
`PHASE_1_EVIDENCE_INDEX.md`, `MIGRATION_VALIDATION.md`, `RISK_REGISTER.md`.

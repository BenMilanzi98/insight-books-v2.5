# Phase 4 — Central Accounting Posting Engine

This folder documents the Phase 4 implementation of the InsightBooks V2 central
accounting posting engine: the single approved architecture for new accounting
writes. The engine converts a validated accounting event into exactly one
balanced, immutable, traceable journal entry.

## Scope

Phase 4 delivers the engine, its validation framework, idempotency and
concurrency protection, approvals, versioned posting templates, atomic
persistence, journal numbering, immutability, source posting states, audit +
outbox integration, error/retry architecture, the legacy posting guard, shadow
posting/comparison, and three controlled pilots (Manual Journal, Adjustment
Journal, Opening Balance) plus a shadow-only Customer Invoice template.

Module-by-module operational integration is deferred to Phase 9. The engine is
**not** activated globally; posting mode defaults to `LEGACY` and is resolved
server-side per business/event via feature flags.

## Code map

| Layer | Location |
| --- | --- |
| Domain (pure rules, no framework/DB) | `lib/accountingV2/domain/` |
| Engine (orchestrated posting logic) | `lib/accountingV2/engine/` |
| Templates (versioned catalogue) | `lib/accountingV2/templates/` |
| Application services (manual journal, opening balance) | `lib/accountingV2/application/` |
| Infrastructure (registry, flags, outbox, audit, legacy adapters) | `lib/accountingV2/infrastructure/` |
| API routes | `app/api/accounting-v2/` |
| Diagnostics UI | `app/system/accounting-posting-engine/page.js` |
| Tests | `test/accountingV2.postingEngine.test.js` and companions |

## Document index

Start with:

- `PHASE_4_TASKS.md` — workstream plan and status
- `PHASE_1_TO_3_EVIDENCE_INDEX.md` — binding prior-phase findings
- `CURRENT_POSTING_ARCHITECTURE.md` — legacy posting inventory
- `TARGET_POSTING_ENGINE_ARCHITECTURE.md` — the implemented design
- `FINAL_PHASE_4_REPORT.md` — completion report
- `PHASE_5_READINESS.md` — what Phase 5 (General Ledger reconstruction) can rely on

Each remaining document covers one subsystem and names the real source files it
describes. Documentation reflects the actual implementation; where the prompt
allowed alternatives, the chosen approach is recorded with its rationale.

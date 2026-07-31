# Phase 4 Readiness — Posting Engine Activation Gate

Phase 3 delivers the account dictionary the Phase 4 posting engine requires. This report
states what Phase 4 can rely on and what must be completed before activation.

## 1. Guarantees Phase 4 can rely on

| Guarantee | Mechanism |
|---|---|
| Every posting target resolves through one contract | `AccountMappingService.resolveMappedAccount` → `resolvePurposeAccount` (registry-first, typed errors, no fallback guessing) |
| Resolved accounts are always postable | Resolution-time validation: business-scoped, active, non-deprecated, non-header, `accountAcceptsNewPostings` |
| Categories/normal balances are trustworthy | 540/540 accounts classified; derivation rules enforced; COA-004/COA-018/COA-019 checks watch drift |
| No duplicate system accounts | Unique purpose-per-business constraint + COA-002 check |
| Headers can never receive lines | Behaviour matrix + COA-003 check + selector exclusions |
| Salary postings land on 5200 | SALARIES_AND_WAGES purpose constraints + COA-017 |
| Hierarchy math is safe | Cycle detection, depth cap, descendants-only derived totals (CAP-002 closed) |
| Lifecycle is enforced | DEPRECATED/ARCHIVED accounts rejected at resolution and validated by COA-006 |
| Every governance change is attributable | `coa.*` audit actions on `AuditLog` with request/correlation ids |

## 2. Activation checklist (per business, before NEW_ENGINE posting mode)

- [ ] Purpose mappings assigned in the registry for every purpose the business's modules
      use (start from the legacy-code seeds; `GET /api/coa-v2/mappings` should cover the
      module's purposes).
- [ ] `npm run audit:forensic:coa-v2` → 0 CRITICAL/HIGH findings for the business.
- [ ] Business readiness status READY (Insight Books: execute the pending 5301→5200
      consolidation plan first).
- [ ] `coaV2CanonicalMappings` flag enabled (registry authoritative; legacy fallback off).
- [ ] Shadow-mode comparison (Phase 2 machinery) clean for the target modules.

## 3. Known gaps deliberately left for later phases

| Gap | Phase |
|---|---|
| Posting engine integration of the resolver into transaction flows | Phase 4 |
| Report/statement generation from FS/CF mappings | Phase 5/7 |
| Historical journal reclassification (none currently required — all duplicates have zero activity) | Phase 6 |
| `Account.tenantId NOT NULL` + duplicate legacy column retirement | Post-verification migration |
| Registry mapping seeds per business (currently resolved via legacy fallback) | Phase 4 rollout step |

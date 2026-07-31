# Phase 18 Tasks

Implementation plan for production cutover framework. **Scaffolding DONE; production execution BLOCKED on gates.**

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **DRAFT** |
| Cutover execution | **NOT EXECUTED** |
| Branch | `v2` |
| Latest Prisma migration | `20260721200000_security_governance_v2` (~109 folders) |
| Last updated | July 2026 |

---

## Workstreams

| ID | Task | Deliverable | Status |
|---|---|---|---|
| P18-A | Documentation tree | `docs/production-cutover/**` (114 files) | **DONE** |
| P18-B | Evidence index | `PHASE_1_TO_17_EVIDENCE_INDEX.md` | **DONE** |
| P18-C | Runtime module | `lib/productionCutover/` | **IN PROGRESS** |
| P18-D | Cutover APIs | `/api/system/cutover/*` | **IN PROGRESS** |
| P18-E | CLI scripts | `scripts/cutover-*.cjs` | **IN PROGRESS** |
| P18-F | Maintenance enforcement | Middleware + flags | **IN PROGRESS** |
| P18-G | Pre-migration diagnostic | Template + script | **DRAFT** |
| P18-H | Production inventory | Fill from prod access | **BLOCKED** |
| P18-I | Rehearsal #1 | `FINAL_MIGRATION_REHEARSAL_REPORT.md` | **PENDING** |
| P18-J | Rehearsal #2 | Sign-off artifact | **PENDING** |
| P18-K | Scope freeze | `MIGRATION_SCOPE_FREEZE.md` | **BLOCKED** |
| P18-L | Cutover execution | Window plan | **BLOCKED** |
| P18-M | Acceptances | `*_ACCEPTANCE.md` | **BLOCKED** |
| P18-N | Final report | `FINAL_PHASE_18_REPORT.md` | **DRAFT** |

---

## Blocking gates

| Gate | Source | Status |
|---|---|---|
| Phase 16 QA scaffolding | `FINAL_PHASE_16_REPORT.md` | **GREEN** |
| Phase 16 full certification | Same | **PARTIAL / UNKNOWN** |
| Phase 17 capacity | `CAPACITY_CERTIFICATION.md` | **NOT CERTIFIED** |
| Phase 15 security exit | `PHASE_18_READINESS.md` (QA) | **NOT MET** |
| Rehearsal ×2 | `MIGRATION_REHEARSAL_RUNBOOK.md` | **NOT STARTED** |

---

## Definition of done

**Framework (current phase):**

- [x] Document scaffold complete
- [ ] Runtime cutover module verified on staging
- [ ] Production inventory filled

**Production execution (future — explicitly gated):**

- [ ] Rehearsal signed
- [ ] Scope freeze approved
- [ ] Cutover executed
- [ ] Acceptances signed

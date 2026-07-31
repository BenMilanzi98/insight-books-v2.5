# Current Training Architecture Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Dual-entity Request + Program | CORRECT_AND_REUSABLE | `requests.js` / `programs.js` + Prisma CustomerTrainingRequest/Program |
| Domain public surface | CORRECT_AND_REUSABLE | `lib/admin/customerSuccess/training/index.js` exports Waves 1–4 modules |
| Domain contract phase label | MISLABELLED_PHASE / EXTEND | `catalogue.js` TRAINING_DOMAIN_CONTRACT.phase = 18 (needs 22 + treePhaseAlias) |
| Numbering TRQ/TRN/COH/TRS/IB-TRN-CERT | CORRECT_AND_REUSABLE | `numbering.js` + catalogue regexes; session = TRS- (not SES-) |
| UI hubs | FOUNDATION / EXTEND | `app/insightbooks/customer-success/training/**` (~23 pages) |
| API routes | FOUNDATION / EXTEND | training-requests, training-programs, training-sessions routes only |
| Second Training domain | FORBIDDEN | Design locks Approach 1 — no parallel domain |
| Demo confusion | WRONG_DOMAIN | `lib/admin/crm/demos/**` is PRD 18 Demo — preserved |

**Implication:** Architecture is Approach 1 dual-entity under tree-18; Phase 22 hardens labels + thin APIs, does not invent a second domain.


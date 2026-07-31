# Current Onboarding Project Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| `CustomerOnboardingProject` model | NOT_FOUND | — |
| `ONB-YYYY-######` numbering | NOT_FOUND | Note: MRA activation uses endpoint keys `EP-ONB-01/02` (`lib/mraEis/...`) — WRONG_DOMAIN / do not confuse with Project numbers |
| `createOnboardingProject` | NOT_FOUND | — |
| One Request → one Project | NOT_FOUND | Concurrency / `CONVERTED_TO_PROJECT` not implemented |
| `templateVersionId` pin | NOT_FOUND | — |
| Project status / phase machines | NOT_FOUND | Spec phases `REQUEST_AND_VALIDATION`…`COMPLETION` absent |
| Progress / health on Project | NOT_FOUND | Phase 8 foundations explicitly set `progressPercent: null` — CORRECT honesty; Project calcs Wave 3 |
| Optimistic locking | NOT_FOUND | — |
| Link from `CsOnboardingRecord` | NOT_FOUND | Model has no `onboardingProjectId` column yet (`prisma/schema.prisma` ~11256) |
| UI Project detail | NOT_FOUND | Foundations page only |

**Implication:** Wave 1 Project create + convert; Wave 2+ materialisation/readiness; Wave 4 Phase 8 link column.

# Current Training Material Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Material model + service | PARTIAL / EXTEND | `materials.js` + CustomerTrainingMaterial |
| Classification PUBLIC/INTERNAL/RESTRICTED | CORRECT_AND_REUSABLE | TRAINING_MATERIAL_CLASSIFICATION in catalogue.js |
| Answer keys to Participants | SECURITY / EXTEND | Exports/search strip restricted/answer keys — deepen download reauth |
| Private storage | PARTIAL | storageRef field; provider wiring thin |

**Implication:** Materials foundations reusable; Wave 2 hardens restricted download reauthorisation.


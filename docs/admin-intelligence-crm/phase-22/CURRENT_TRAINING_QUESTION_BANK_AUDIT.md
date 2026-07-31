# Current Training Question Bank Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| First-class question bank model | NOT_FOUND | No CustomerTrainingQuestionBank entity |
| Answers in assessment version JSON | PARTIAL / RISK | content may live in AssessmentVersion — must not leak |
| Search/export strip questionBank | CORRECT_AND_REUSABLE | `search.js` / `exports.js` strip keys include questionBank |
| Rich LMS authoring | CARRY / FUTURE | phase-18 gap G18-35 NOT_AVAILABLE |

**Implication:** Question-bank security strip exists; first-class bank is High Wave 3 / CARRY rich LMS — do not invent banks.


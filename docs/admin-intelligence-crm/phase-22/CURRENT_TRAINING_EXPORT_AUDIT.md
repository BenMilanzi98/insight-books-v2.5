# Current Training Export Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| Export strip answers/tokens | CORRECT_AND_REUSABLE | `exports.js` STRIP_KEYS includes answers/questionBank/credentials |
| Search credential strip | CORRECT_AND_REUSABLE | `search.js` sensitive regex |
| Portfolio scope fail-closed | PARTIAL / EXTEND | `listScope.js` resolveTrainingListScope |
| Permission recheck at download | EXTEND | canView/canManage checks present — prove |

**Implication:** Export/search honesty foundations good; Wave 4 hardens portfolio empty-scope behaviour.


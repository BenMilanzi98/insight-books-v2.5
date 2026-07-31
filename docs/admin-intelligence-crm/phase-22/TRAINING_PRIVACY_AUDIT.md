# Training Privacy Audit

**Audited:** 2026-07-31  
**Lens:** PRD Phase 22 Customer Training (tree phase-18 code alias)

| Check | Class | Evidence |
|-------|-------|----------|
| PII on Participant | PARTIAL / EXTEND | displayName/contactId/tenantUserId — projections needed |
| Export/search strip | CORRECT_AND_REUSABLE | exports.js / search.js |
| Public certificate verify | EXTEND | serializeTrainingCertificatePublic |
| Feedback anonymity | NOT_FOUND | Feedback module absent |
| Marketing consent boundary | GAP | Phase 23 prep — Training consent ≠ Marketing |
| Credentials in materials/notes | FORBIDDEN / EXTEND | Strip patterns; deepen material body |

**Implication:** Privacy strip foundations good; invitation/feedback surfaces must ship PII-safe.


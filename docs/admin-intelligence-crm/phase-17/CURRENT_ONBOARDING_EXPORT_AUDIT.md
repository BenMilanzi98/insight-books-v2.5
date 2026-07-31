# Current Onboarding Export Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Onboarding Project/Request export | NOT_FOUND | Spec `exports.js` under onboarding |
| CS export pack | EXTEND pattern / WRONG_SCOPE today | `lib/admin/customerSuccess/export.js` — cases/tasks/plans/expansion handoffs only; explicitly never invents onboarding progress |
| CS export API | EXTEND | `app/api/admin/customer-success/export/route.js` |
| Export migration file contents / credentials | FILE_SECURITY_RISK / FORBIDDEN | Must strip in Wave 4 |
| Permission recheck on export | EXTEND | CS export uses `resolveCsAccess`; onboarding needs `onboarding.export` SoD |

**Implication:** Wave 4 CSV/XLSX with permission recheck; no credentials/migration payloads/Contact dumps in broad exports.

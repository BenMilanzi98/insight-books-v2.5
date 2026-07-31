# Conversion Privacy Audit

**Audited:** 2026-07-31

| Check | Class | Evidence |
|-------|-------|----------|
| Conversion privacy projections | NOT_FOUND | — |
| CRM consent / eligibility | CORRECT_AND_REUSABLE | Phase 11–13 fail-closed UNKNOWN |
| Temporary password in API responses | PRIVILEGED_USER_RISK | Admin user create returns plaintext temporaryPassword |
| Customer review tokens | CORRECT_AND_REUSABLE / EXTEND | Commercial review — not conversion invite |
| Public enumerable conversion links | NOT_FOUND (avoid) | Must not introduce |

**Implication:** Wave 2–4 hash-only invites; restricted report projections; no raw tokens stored.

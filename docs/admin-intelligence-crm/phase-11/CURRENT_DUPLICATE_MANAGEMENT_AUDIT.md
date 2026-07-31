# Current Duplicate Management Audit

**Audited:** 2026-07-30

| Check | Class | Evidence |
|-------|-------|----------|
| Duplicate candidate detection | NOT_FOUND | — |
| Merge review workflow | NOT_FOUND | — |
| SoD on merge approval | NOT_FOUND | — |
| Silent merge prevention | N/A | No merge path |
| Idempotent capture (exact retry) | NOT_FOUND | Contact API re-emails on every POST |
| Customer dedupe as Lead dedupe | WRONG_DOMAIN | Customer identity ≠ Lead duplicate plane |
| Support ticket merge as Lead merge | WRONG_DOMAIN | Phase 10 merge permission is tickets |

**Implication:** Wave 2 candidates + Wave 4 controlled merge with SoD. Capture idempotency keys prevent exact duplicate creates on retry.

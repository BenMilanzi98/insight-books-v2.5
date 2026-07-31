# Documentation Discrepancy Register

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

| ID | Severity | Conflict | Source A | Source B | Impact | Temporary position | Clarification |
|---|---|---|---|---|---|---|---|
| D-001 | BLOCKING | x-eis-message-hash required? | Master prompt / inferred | OpenAPI/guide absent | Security/signing | Do not send | Q-010 |
| D-002 | BLOCKING | Fiscal number format | Guide Base64/Julian | Legacy IB decimal | Fiscal reject | Prefer guide; block code | Q-021 |
| D-003 | CRITICAL | x-signature sample JWT vs HMAC | Guide curl | Guide prose+KAT | Activation fail | Prose+KAT | Q-013 |
| D-004 | CRITICAL | statusCode 0 vs 1 | Sales sample | Activation sample | False success/fail | Endpoint-specific | Q-002 |
| D-005 | CRITICAL | Authorization Bearer vs raw | Common practice | Guide raw JWT | 401s | Test both in sandbox | Q-007 |
| D-006 | HIGH | get-latest-configs GET vs POST | Guide GET | OpenAPI POST | Wrong method | POST | — |
| D-007 | HIGH | get-terminal-site-products GET vs POST | Pre-int guide GET | OpenAPI POST | Sync fail | Prefer POST; clarify | Q-003 |
| D-008 | HIGH | MAC mandatory vs optional | Guide | OpenAPI | Activation reject | Send MAC; clarify SaaS | Q-017 |
| D-009 | MEDIUM | /api/v1/api/v1 samples | Guide | OpenAPI | Wrong URL | Single /api/v1 | Q-005 |
| D-010 | MEDIUM | Line requiredness | Guide comments | OpenAPI optional | Validation | Sandbox | Q-027 |
| D-011 | LOW | maxCummulativeAmount spelling | OpenAPI | — | Serialization | Preserve spelling | — |
| D-012 | HIGH | Offline signature unreproduced | Guide | Independent calc | Offline blocked | Block offline | Q-040 |
| D-013 | MEDIUM | Legacy OAuth docs in repo | docs/MRA_EIS_Documentation.md | Current API | Wrong integration | Ignore legacy | — |
| D-014 | EDITORIAL | Certificate image TODO in guide | certification_process.htm | — | None | Ignore | — |

**Blocking discrepancy count:** 2 primary (message-hash, fiscal numbering) + offline KAT + SaaS terminal model + corrections.

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*

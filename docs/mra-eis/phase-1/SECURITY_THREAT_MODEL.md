# Security Threat Model

**Phase:** 1 — Official Research & Contract Verification
**Access / research date:** 2026-07-22
**Classification labels:** Verified official facts · Documentation statements · Swagger statements · Sandbox results (none in Phase 1) · Engineering conclusions · Unresolved questions · Legal interpretation requiring counsel

| Threat ID | Actor | Asset | Attack | Impact | MRA control | IB control (later) | Phase |
|---|---|---|---|---|---|---|---|
| T-001 | External | JWT/secretKey | Theft from logs | Fiscal fraud | TLS | Encrypt, no log | 3+ |
| T-002 | Tenant admin | Terminal creds | Cross-tenant use | Multi-tenant breach | Terminal binding | Strict tenant isolation | 3+ |
| T-003 | Attacker | Payload | Tamper without hash | Invalid invoice | Server validation | Optional hash if proven | 3+ |
| T-004 | Insider | Fiscal numbers | Collision/reuse | Duplicate fiscal | Server reject? | Strong sequencer | 3+ |
| T-005 | Operator | Offline queue | Tamper/omit | Tax evasion | Offline sig | Signed queue, audit | Cert |
| T-006 | Attacker | VAT5 | Overuse | Tax loss | Validate endpoint | Concurrency locks | 3+ |
| T-007 | Attacker | QR | Substitution | Fake receipt | Validation site | Print from accepted URL only | 3+ |
| T-008 | Support | Secrets | Impersonation | Full compromise | — | Break-glass audit | 3+ |

---
*Phase 1 research document. No production EIS implementation. No fiscal transactions submitted.*

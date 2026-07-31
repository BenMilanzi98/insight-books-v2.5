# Threat Model

Phase 15 threat catalogue for InsightBooks tenant platform and admin panel. Format: **Threat ID**, asset, entry point, required control, residual risk (after Phase 15 target controls).

Scale: **Critical / High / Medium / Low**.

---

## Authentication & session

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-001 | Tenant session cookie | MITM on non-HTTPS | `secure` cookie in production; HSTS at edge | Low |
| THR-002 | Session payload integrity | Attacker edits base64 `tenantId` or `role` | Signed sessions (GAP-SEC-001); DB reload of membership | Medium until Wave 2 |
| THR-003 | Stolen session cookie | XSS (mitigated by httpOnly), physical access | Short TTL, rotation, revocation (GAP-SEC-002) | Medium |
| THR-004 | Credential stuffing | `/api/auth/login` | Rate limit + lockout (GAP-SEC-020) | Medium |
| THR-005 | Weak password | User accounts | bcrypt hashing (existing); admin password policy UI | Low |
| THR-006 | MFA bypass | Accounts with `mfaEnabled=true` | Enforce MFA challenge (GAP-SEC-024) | High until implemented |

---

## Authorization & tenancy

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-007 | Cross-business financial data | SEC-2 query `tenantId` on supplier APIs | Session-only tenant (GAP-SEC-013) | Critical until hotfix |
| THR-008 | Cross-business GL lines | SEC-1 foreign account IDs to `postGlEntry` | Tenancy assertion (GAP-SEC-014); V2 adapter pre-check interim | Critical on legacy path |
| THR-009 | Cross-business read via NULL tenant | TEN-002 nullable `tenantId` | NOT NULL + monitoring (GAP-SEC-026) | Medium |
| THR-010 | Privilege escalation via role JSON | Compromised admin edits `Role.permissions` | Role change audit + least privilege | Medium |
| THR-011 | Unauthorized journal reversal | SEC-3 `/api/transactions/reverse` | Permission gate (GAP-SEC-016) | High |
| THR-012 | Unauthorized capital view/post | SEC-4 capital routes | `requireStandardAccess` or policy (GAP-SEC-015) | High |
| THR-013 | Middleware bypass unlisted API | Unknown `/api/*` route | Default deny + catalogue test (GAP-SEC-012) | Medium |
| THR-014 | V2 API prefix middleware gap | Module routes without `tenantApiAccess` rule | Register prefixes (GAP-SEC-011); handler guards interim | Medium |
| THR-015 | AUTHZ_AUDIT_MODE misconfiguration | Prod env allows denied actions | Prod guardrail (GAP-SEC-021) | High if mis-set |

---

## Separation of duties & approvals

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-016 | Self-approval fraud | User creates + approves same payment/journal | Unified SoD registry (GAP-SEC-005) | High |
| THR-017 | Repair batch self-execute | Approver runs repair they approved | Existing repair SoD + central registry | Medium |
| THR-018 | Year-end close self-certify | Sole admin closes own books | Hard SoD or break-glass with audit | Medium |
| THR-019 | Equity dividend self-approve | Creator approves contribution/dividend | Module SoD today; unify (GAP-SEC-004) | Medium |
| THR-020 | Loan assessment self-approve | Preparer marks reviewed + approved | `separationOfDuties.js` — enforce hard | Medium |

---

## Data confidentiality & uploads

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-021 | File exfiltration via /uploads | Guess `/uploads/{tenantId}/...` URL | Signed URLs + auth gateway (GAP-SEC-009) | High |
| THR-022 | Employee document leak | HR uploads publicly cached | Move to private bucket; short-lived links | High |
| THR-023 | Invoice PDF disclosure | Invoice attachment paths | Tenant-scoped signed download | High |
| THR-024 | Directory traversal | `/api/uploads/[...path]` | Path normalize (existing); add auth | Medium |

---

## Audit & repudiation

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-025 | Audit tamper | DB admin or bug deletes `AuditLog` | Append-only store (GAP-SEC-007) | High |
| THR-026 | Audit tamper by app | `deleteMany` cleanup routes | Replace with tombstone events | Medium |
| THR-027 | Repudiation of admin action | Shared admin credentials | Per-admin JWT + AdminAuditLog | Low |
| THR-028 | Insufficient security logging | Silent deny without record | Policy engine deny events (GAP-SEC-029) | Medium |

---

## Integrations & webhooks

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-029 | Webhook forge | Future payment callback | HMAC signature + replay idempotency (GAP-SEC-022) | Low today (no live webhook GL) |
| THR-030 | Webhook replay | Retried provider event | `webhookEventId` registry (schema exists) | Medium when enabled |
| THR-031 | Cron endpoint abuse | Guess `/api/cron/*` | CRON_SECRET (existing) | Low |
| THR-032 | Integration over-privilege | Stolen user session for API | Service accounts scoped (GAP-SEC-017) | Medium |

---

## AI & automation

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-033 | AI bypass of financial controls | Prompt to post journal via assistant | AI cannot call posting APIs; tool allowlist (GAP-SEC-018) | Medium |
| THR-034 | PII leakage to LLM | Paste customer data in ai-assistant | PII scrub + tenant boundary | Medium |
| THR-035 | Unreviewed AI financial advice | loan-readiness / planning AI | Review gate + disclaimer (partial today) | Medium |
| THR-036 | AI-assisted cross-tenant inference | Model context mixing | Per-request tenant isolation in RAG | Medium |

---

## Admin plane

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-037 | Admin JWT theft | XSS on insightbooks panel | httpOnly cookie; short admin session | Medium |
| THR-038 | Cross-tenant admin overreach | AdminTenantAccess misuse | Access level audit; no impersonation | Low |
| THR-039 | Fake session terminate UI | Mock sessions API | Real session store (GAP-SEC-002) | Low impact today |

---

## Availability & abuse

| Threat ID | Asset | Entry | Required control | Residual risk |
|---|---|---|---|---|
| THR-040 | API abuse / DoS | High-volume authenticated calls | Rate limits (GAP-SEC-020) | Medium |
| THR-041 | Subscription check fail-open | Middleware subscription API error | Documented fail-open (`middleware.js:218`) — business choice | Low |

---

## Threat ↔ gap mapping (selected)

| Threat | Primary gap |
|---|---|
| THR-007 | GAP-SEC-013 |
| THR-008 | GAP-SEC-014 |
| THR-016 | GAP-SEC-005, GAP-SEC-006 |
| THR-021–023 | GAP-SEC-009, GAP-SEC-010 |
| THR-025–026 | GAP-SEC-007, GAP-SEC-008 |
| THR-029–030 | GAP-SEC-022, GAP-SEC-023 |
| THR-033–036 | GAP-SEC-018, GAP-SEC-019 |

---

## Assumptions

1. Deployment uses HTTPS in production (`secure` cookies).  
2. Database credentials are not exposed to tenant users.  
3. Attackers may hold **any authenticated tenant user** account — not only anonymous.  
4. Legacy routes remain reachable until hotfixed or wrapped by policy engine.  

---

## Out of scope (Phase 16+)

- Physical datacenter compromise  
- Supply-chain attacks on npm dependencies  
- PostgreSQL RLS (tracked as GAP-SEC-025 deferred)  
- SOC 2 / ISO certification evidence packs  

See `PHASE_16_READINESS.md`.

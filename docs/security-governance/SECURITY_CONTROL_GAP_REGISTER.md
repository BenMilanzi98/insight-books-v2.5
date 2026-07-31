# Security Control Gap Register

Phase 15 gap register. IDs are **new to Phase 15** (GAP-SEC-*). Linked finding IDs (SEC-*, R-*, TEN-*, ADR-005, P2-02) come from prior phases only.

| Gap ID | Title | Linked findings | Current state | Target control | Owner workstream | Severity | Status |
|---|---|---|---|---|---|---|---|
| GAP-SEC-001 | Unsigned tenant sessions | — | Base64 JSON cookie without signature (`lib/sessionCookie.js`) | HMAC-signed payload or server-side session ID + store | B, H | Critical | PENDING |
| GAP-SEC-002 | No session revocation | — | Logout clears client cookie only; admin sessions API returns **mock data** | Session registry, revoke-on-password-change, admin force-logout | I, J | High | PENDING |
| GAP-SEC-003 | Session field tampering trust gap | P2-02 | Cookie `tenantId` applied before DB membership reload | Bind businessId to signed session; reconcile on every request | B, H | High | PENDING |
| GAP-SEC-004 | No unified approval engine | — | Per-module approval tables and ad hoc status fields | `lib/securityGovernance/application/approvalEngine` | O–T | High | PENDING |
| GAP-SEC-005 | Incomplete separation of duties | SEC-3, SEC-4 | SoD in V2 modules only; legacy routes open; close has soft warnings | Central SoD registry + hard deny with break-glass audit | U–Z | High | PENDING |
| GAP-SEC-006 | Self-approval on legacy flows | SEC-3 | Reversal: any session user | Approver ≠ initiator policy | U, V | High | PENDING |
| GAP-SEC-007 | Audit log mutability | — | `AuditLog` / `AdminAuditLog` support delete; no append-only enforcement | Immutable audit table or trigger; soft-delete with tombstone events | AA–AD | High | PENDING |
| GAP-SEC-008 | Audit tamper detection | GAP-SEC-007 | No hash chain or WORM storage | Optional hash chain + alert on mutation attempt | AD | Medium | PENDING |
| GAP-SEC-009 | Public upload exposure | — | `/uploads` skipped in middleware; public cache headers | Auth gateway or signed URLs; virus scan hook | AE–AH | High | PENDING |
| GAP-SEC-010 | Upload path enumeration | GAP-SEC-009 | Predictable paths under `public/uploads/{tenantId}/...` | Opaque object keys + time-limited tokens | AF | High | PENDING |
| GAP-SEC-011 | Missing V2 API middleware rules | — | No `tenantApiAccess` entries for accounting-v2, coa-v2, equity, bank-reconciliation, accounting-close, financial-planning, loan-readiness | Register prefixes aligned to module permission keys | K–N | High | PENDING |
| GAP-SEC-012 | Middleware default-deny ambiguity | — | Unlisted paths get `no_rule` 403 — good — but inconsistent with handler-only modules | Explicit catalogue + generated test from route tree | K, L | Medium | PENDING |
| GAP-SEC-013 | Cross-tenant supplier IDOR | SEC-2, R-20, TEN-003 | Query-string `tenantId` in supplier financial routes | Session-derived tenant only; policy engine deny override | P, Q | Critical | PENDING |
| GAP-SEC-014 | Legacy GL cross-tenant posting | SEC-1, R-19, TEN-001 | `postGlEntry` no line-account tenancy check | Engine assertion or block direct callers | Q | Critical | PENDING |
| GAP-SEC-015 | Capital route weak RBAC | SEC-4, R-21 | `requireStandardAccess` unused | Enforce via policy engine | R | High | PENDING |
| GAP-SEC-016 | Reversal route weak RBAC | SEC-3, R-21 | Session-only | `journalEntries.update` or dedicated reversal permission | R | High | PENDING |
| GAP-SEC-017 | No service accounts / API keys | — | CRON_SECRET only for cron | Scoped service identities with rotation | AI–AM | Medium | PENDING |
| GAP-SEC-018 | AI governance incomplete platform-wide | — | loan-readiness + planning have flags/review; **ai-assistant** does not | Unified AI policy: flags, PII scrub, review, logging | AN–AS | Medium | PENDING |
| GAP-SEC-019 | AI prompt injection / data exfil | GAP-SEC-018 | General assistant exposes broad system context | Tool allowlist, tenant data boundary, output filtering | AN, AO | Medium | PENDING |
| GAP-SEC-020 | Rate limit gaps on tenant API | — | No login/API throttling in app layer | Edge + application rate limits | AT–AV | Medium | PENDING |
| GAP-SEC-021 | AUTHZ_AUDIT_MODE soft allow | — | Denied permissions allowed when env true | Disallow in prod; emit metric instead | AW | Medium | PENDING |
| GAP-SEC-022 | Webhook signature / replay gaps | E25 (Phase 9) | Schema supports `webhookEventId`; no live signed webhooks | HMAC verification + idempotency mandatory on enable | AX–BA | Medium | PENDING |
| GAP-SEC-023 | Webhook forge → future GL post | GAP-SEC-022 | No posting webhooks today | Policy engine + service account for integrators | BA | Medium | PENDING |
| GAP-SEC-024 | MFA column unused | — | `User.mfaEnabled` not enforced at login | TOTP/WebAuthn challenge when enabled | BB–BD | Medium | PENDING |
| GAP-SEC-025 | No PostgreSQL RLS | TEN-002 | Application filters only | Evaluate RLS for financial tables (Phase 16 candidate) | — | Medium | DEFERRED |
| GAP-SEC-026 | Nullable financial tenantId | TEN-002 | Schema allows NULL tenant on some rows | NOT NULL migration + backfill | Q | Critical | PENDING |
| GAP-SEC-027 | No tenant impersonation controls | — | Feature absent (good) but no break-glass design | Document prohibition; design if ever required | — | Low | DONE (policy) |
| GAP-SEC-028 | Dual admin/tenant auth confusion | — | Separate cookies — correct | Document operational procedures | C | Low | DONE (docs) |
| GAP-SEC-029 | Security monitoring placeholders | — | Admin security pages partly mock | Wire real metrics from policy engine | BE–BH | Medium | PENDING |
| GAP-SEC-030 | Cross-business repair detection only | P6-XTEN-001 | Detect after the fact | Prevent at policy + engine layers | Q | Critical | PENDING |

---

## Gap severity summary

| Severity | Count | Must fix before production hardening |
|---|---|---|
| Critical | 5 | GAP-SEC-001, 013, 014, 026, 030 |
| High | 12 | GAP-SEC-002, 003, 004, 005, 006, 007, 009, 010, 011, 015, 016 |
| Medium | 11 | Remaining open gaps |
| Low / Done | 2 | GAP-SEC-027, 028 |

---

## Remediation sequencing

### Wave 1 — Stop bleeding (code)

1. GAP-SEC-013 — SEC-2 supplier routes hotfix  
2. GAP-SEC-016 / 015 — SEC-3/4 permission gates  
3. GAP-SEC-011 — middleware prefix registration  
4. GAP-SEC-009 — upload auth gateway  

### Wave 2 — Platform foundation (`lib/securityGovernance/`)

1. GAP-SEC-001 / 002 / 003 — session hardening  
2. GAP-SEC-004 / 005 — approval + SoD engines  
3. GAP-SEC-007 — immutable audit writer  

### Wave 3 — Integration & assurance

1. GAP-SEC-017 / 022 — service accounts + webhooks  
2. GAP-SEC-018 / 019 — AI governance  
3. GAP-SEC-020 / 029 — rate limits + monitoring  

---

## Verification

Each closed gap requires:

1. Unit test in `test/securityGovernance.*.test.js` (Phase 15 code phase)  
2. Entry in `PHASE_15_TASKS.md` moved to **DONE**  
3. Threat model residual risk updated in `THREAT_MODEL.md`  

No gap may be marked closed on documentation alone.

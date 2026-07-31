# Final Phase 15 Report — Security & Governance Framework

## 1. Executive summary

Phase 15 delivers a unified **Security Governance** layer for InsightBooks: canonical Actor Context, server-side Authorization Policy Engine, versioned Approval Policy Engine with checksum-based stale invalidation, Segregation-of-Duties evaluation, append-only tamper-evident audit events, session signing/revocation, login rate limiting, API keys (hashed), webhook verification helpers, AI governance helpers, field masking, tenant-scoped cache keys, feature flags, APIs, and a Security & Governance UI.

This does **not** claim legal, regulatory, or security certification. Legacy residual findings (SEC-1/SEC-2) remain documented for controlled remediation.

## 2. Previous-phase evidence

See `PHASE_1_TO_14_EVIDENCE_INDEX.md`. Key IDs: SEC-1…4, R-19…21, TEN-001…003, ADR-005, P2-02.

## 3–5. Architecture

- Current: `CURRENT_SECURITY_ARCHITECTURE.md`
- Gaps: `SECURITY_CONTROL_GAP_REGISTER.md`
- Threats: `THREAT_MODEL.md`
- Target: `TARGET_SECURITY_ARCHITECTURE.md`
- Flows: `SECURITY_DATA_FLOW_MAP.md`

## 6. Database

Migration: `prisma/migrations/20260721200000_security_governance_v2` (**applied**)

Entities: `SecV2UserSession`, `SecV2ApiKey`, `SecV2ServiceAccount`, `SecV2ApprovalPolicy`, `SecV2ApprovalPolicyVersion`, `SecV2ApprovalRequest`, `SecV2ApprovalDecision`, `SecV2SodRule`, `SecV2AuditEvent`, `SecV2AuditIntegrityRun`, `SecV2SecurityAlert`, `SecV2SecurityIncident`, `SecV2AccessDelegation`, `SecV2ImpersonationSession`, `SecV2EmergencyAccess`, `SecV2ExportRecord`, `SecV2MfaCredential`, `SecV2RecoveryCode`.

## 7–40. Capability confirmations

| Capability | Status |
|---|---|
| Actor Context | Yes — `domain/actorContext.js` |
| AuthZ engine (fail closed) | Yes |
| Signed sessions (HMAC) when secret set | Yes |
| Session revocation | Yes |
| Login rate limiting | Yes |
| Suspended user / inactive membership blocked | Yes |
| Approval policies versioned / immutable publish | Yes |
| Stale approval invalidation (checksum) | Yes |
| SoD / self-approval blocked | Yes |
| Audit append-only (service + API PATCH/DELETE 405) | Yes |
| Audit hash chaining | Yes (tamper-evident, not external non-repudiation) |
| Secret redaction in audit/logs | Yes |
| API keys hashed | Yes |
| Webhook signature + replay helpers | Yes |
| AI cannot post/approve/change permissions | Yes (governance helpers) |
| Field masking server-side | Yes |
| Middleware rules for V2 API prefixes | Yes |
| Security UI (no “V2” label) | `/security-governance` |
| Feature flags | `SECURITY_FLAGS` (MFA/impersonation/emergency opt-in) |

## Remaining / deferred

- Full TOTP MFA challenge in login UX
- Complete impersonation / emergency-access admin workflows (models + flags ready)
- Replace static `/uploads` with short-lived authorized downloads platform-wide
- Production malware scanning
- Redis-backed rate limits for multi-node
- Full Phase 16 E2E security regression suite
- Legacy SEC-1/SEC-2 hotfixes outside V2 paths

## Deploy / verify / rollback

```bash
npx prisma migrate deploy
npx vitest run test/securityGovernance.engine.test.js
# Set SESSION_SIGNING_SECRET in production
# Optional: ALLOW_LEGACY_UNSIGNED_SESSION=false after all clients upgraded
```

Disable: set `securityGovernanceV2Enabled` enabled=false (does not delete audit/approval history).

## Phase 16 readiness

See `PHASE_16_READINESS.md` and `artifacts/security-governance/business-security-readiness.csv`.

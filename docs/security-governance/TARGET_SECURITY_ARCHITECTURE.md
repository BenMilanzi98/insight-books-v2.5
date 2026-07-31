# Target Security Architecture

Phase 15 target design for platform security and governance. Implementation module: **`lib/securityGovernance/`**.

Builds on **ADR-005** (business-scoped context from session) and **P2-02** (reject client-supplied business IDs) — extending those patterns from accounting to the whole tenant API surface.

---

## Design principles

1. **Single actor context** — every handler receives `ActorContext`; no parallel `tenantId` from query/body.  
2. **Policy evaluation once** — middleware and domain services call the same engine.  
3. **Deny by default** — unlisted API prefixes fail CI and runtime catalogue checks.  
4. **SoD is not optional** — module-local checks register rules; engine enforces hard deny with audited break-glass.  
5. **Audit is append-only** — security and domain mutations emit events through one writer.  
6. **Dual auth planes preserved** — tenant sessions and admin JWT remain separate; no impersonation bridge.

---

## Module layout

```
lib/securityGovernance/
├── domain/
│   ├── actorContext.js          # Canonical request identity
│   ├── policyDecision.js        # ALLOW | DENY | REQUIRE_APPROVAL
│   ├── approvalRequest.js       # Unified approval entity
│   ├── sodRule.js               # Duty conflict definitions
│   └── securityEvent.js         # Audit / SIEM payload shape
├── application/
│   ├── policyEngine.js          # authorize(context, action, resource)
│   ├── approvalEngine.js        # submit / approve / reject / escalate
│   ├── sodRegistry.js           # Rule registration + evaluation
│   ├── sessionService.js        # Create / validate / revoke sessions
│   ├── uploadAccessService.js   # Signed URL mint + verify
│   ├── aiPolicyService.js       # Feature flags + PII + review gates
│   └── securityEventPublisher.js
├── infrastructure/
│   ├── sessionStore.js          # Prisma or Redis adapter
│   ├── signedSessionCodec.js    # HMAC cookie codec (replaces raw base64)
│   ├── immutableAuditRepository.js
│   ├── rateLimitAdapter.js
│   └── webhookVerifier.js       # HMAC for future integrations
└── api/
    ├── routeGuard.js            # guardSecureRoute(request, actionSpec)
    └── approvalsRoute.js        # Optional central approval inbox API
```

---

## ActorContext

Extends accounting `AccountingContext` concepts to non-financial modules.

```javascript
/**
 * @typedef {Object} ActorContext
 * @property {string} actorType        'user' | 'service_account' | 'system'
 * @property {string} userId           nullable for service/system
 * @property {string} businessId       from session — NEVER from client
 * @property {string|null} branchId
 * @property {string[]} permissions    flattened effective permissions
 * @property {string} roleName
 * @property {string} sessionId        server-side session reference
 * @property {string} requestId
 * @property {string} correlationId
 * @property {string} sourceChannel    'api' | 'webhook' | 'job' | 'admin'
 */
```

Factory: `contextFromRequest(request)` — replaces ad hoc `getUserFromSession` + manual tenant checks in new code. Legacy modules wrap existing guards:

```javascript
// Transition pattern
export async function guardAccountingRoute(request, permissions) {
  const secure = await guardSecureRoute(request, { anyOf: permissions, module: 'accounting' });
  if (secure.response) return secure;
  return {
    user: secure.user,
    context: accountingContextFromActor(secure.actor),
    can: (key) => secure.actor.permissions.includes(key),
  };
}
```

---

## Policy engine

Central API:

```javascript
/**
 * @param {ActorContext} actor
 * @param {Object} spec
 * @param {string} spec.action       e.g. 'suppliers.viewFinancials'
 * @param {Object} [spec.resource]   { type, id, businessId }
 * @returns {PolicyDecision}
 */
export async function authorize(actor, spec);
```

Responsibilities:

| Check | Source |
|---|---|
| Authentication | `sessionService.validate` |
| RBAC | Existing `hasPermissionInSet` logic — moved here |
| Tenancy | `resource.businessId === actor.businessId` |
| SoD | `sodRegistry.evaluate(actor, spec)` |
| Approval pending | `approvalEngine.hasPending(spec.resource)` |
| Feature flags | Module flags (bank recon, close, AI) — read-only consult |

**SEC-2 remediation:** Policy rejects any request where `searchParams.tenantId` or body `businessId` ≠ `actor.businessId` with `CrossTenantSecurityError` (403) — same spirit as `CrossTenantAccountingError`.

---

## Approval engine

Unified state machine:

```
DRAFT → PENDING_APPROVAL → APPROVED → EXECUTED
                         ↘ REJECTED
                         ↘ ESCALATED
```

Module adapters map existing tables:

| Module | Current | Adapter |
|---|---|---|
| Equity | `eqV2EquityApproval` | `registerApprovalBackend('equity', ...)` |
| Repair | repair batch approval fields | same |
| Manual journals V2 | inline approval | same |
| Bank recon | status + approver id | same |
| Loan readiness | assessment workflow | same |

Self-approval: **DENY** at policy layer unless `breakGlassReason` provided and actor has `security.breakGlass` permission (audited).

---

## Session service

Replace unsigned base64 cookie:

**Option A (recommended):** Server session ID in cookie → row in `UserSession` with `userId`, `businessId`, `expiresAt`, `revokedAt`, `userAgent`, `ipHash`.

**Option B:** Signed opaque cookie (HMAC-SHA256 over payload + expiry) without server store — simpler but no instant revocation.

Phase 15 implements **Option A** for GAP-SEC-002; Option B documented as fallback in rollback.

Login flow changes:

1. Validate bcrypt password (unchanged).  
2. Create `UserSession` row.  
3. Set cookie `session=<sessionId>` (opaque, httpOnly).  
4. MFA step-up when `mfaEnabled` (GAP-SEC-024).

`applyTenantMembershipRole` runs at session create and refresh.

---

## Middleware integration

`lib/tenantApiAccess.js` becomes **generated or validated** from:

1. Static legacy prefixes (maintained).  
2. Module manifest exported by each `lib/*/permissions.js`.  

New entries (minimum):

```javascript
{ prefix: '/api/accounting-v2', anyOf: ['accounting.view', 'journalEntries.view', /* ... */] },
{ prefix: '/api/coa-v2', anyOf: ['coa.view', 'accounts.view', /* ... */] },
{ prefix: '/api/equity-management', anyOf: ['equity.view', /* ... */] },
{ prefix: '/api/bank-reconciliation', anyOf: ['bankReconciliation.view', /* ... */] },
{ prefix: '/api/accounting-close', anyOf: ['accountingClose.view', /* ... */] },
{ prefix: '/api/financial-planning', anyOf: ['financialPlanning.view', /* ... */] },
{ prefix: '/api/loan-readiness', anyOf: ['loanReadiness.view', /* ... */] },
```

`api-guard` calls `policyEngine.authorize` for matched routes instead of only `hasPermission`.

---

## Immutable audit

New table `SecurityAuditEvent` (append-only):

- `id`, `timestamp`, `businessId`, `actorId`, `action`, `resourceType`, `resourceId`, `decision`, `correlationId`, `metadata` (JSON), `prevHash` (optional chain)

Legacy `AuditLog` continues read-only during migration; new security events write here only.

Application code **never** UPDATE/DELETE — enforced by DB role or trigger.

---

## Upload access

`uploadAccessService.mintSignedUrl(businessId, objectKey, ttlSeconds)` → `/api/security-governance/download?token=...`

Middleware removes blanket `/uploads` skip; static serving disabled for sensitive classes.

---

## AI policy service

Central gate for all LLM routes:

| Check | ai-assistant | planning AI | loan AI |
|---|---|---|---|
| Feature flag | required (new) | existing | existing |
| Permission | existing | RUN_AI / REVIEW_AI | same |
| PII scrub | required | required | required |
| Human review before financial action | N/A | required for apply | required for lender pack |

AI **cannot** invoke posting engine or policy mutations directly — read-only tools only.

---

## Service accounts

```prisma
model ServiceAccount {
  id          String   @id
  businessId  String
  name        String
  scopes      String[] // permission keys
  keyHash     String
  expiresAt   DateTime?
  revokedAt   DateTime?
}
```

Used for cron, future webhooks, EDI — replaces shared secrets where possible.

---

## Webhook verifier (future-ready)

When payment webhooks post GL (Phase 9+ integrations):

1. Verify HMAC signature header.  
2. Resolve `ServiceAccount` or provider registry entry.  
3. Build `ActorContext` with `sourceChannel: 'webhook'`.  
4. Require `webhookEventId` idempotency (schema field exists on posting registry).  
5. Policy engine authorize before `executePosting`.

---

## Error taxonomy

| Code | HTTP | When |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No session |
| `PERMISSION_DENIED` | 403 | RBAC fail |
| `CROSS_TENANT_DENIED` | 403 | SEC-2 class |
| `SOD_VIOLATION` | 403 | Self-approval |
| `APPROVAL_REQUIRED` | 409 | Pending approval |
| `SESSION_REVOKED` | 401 | Revoked session |
| `RATE_LIMITED` | 429 | Throttled |

All errors include `correlationId`; stack traces never sent to client (align with `AccountingV2Error.toSafeJSON()`).

---

## Migration strategy

1. **Phase 15a — docs + gap register** (current).  
2. **Phase 15b — hotfixes** SEC-2, SEC-3, SEC-4, middleware prefixes (Wave 1).  
3. **Phase 15c — `lib/securityGovernance` scaffold** behind `SECURITY_GOVERNANCE_ENABLED` flag.  
4. **Phase 15d — module guard delegation** one module at a time.  
5. **Phase 15e — session store cutover** with dual-read period.  

See `ROLLBACK_STRATEGY.md`.

---

## Non-goals (Phase 15)

- PostgreSQL RLS (Phase 16 candidate — GAP-SEC-025).  
- Full SOC 2 control matrix.  
- Hardware security module / KMS integration.  
- Tenant impersonation / support login.

---

## References

- `docs/accounting-architecture/ARCHITECTURE_DECISIONS.md` — ADR-005  
- `lib/accountingV2/domain/accountingContext.js` — P2-02 implementation  
- `docs/accounting-architecture/SECURITY_ARCHITECTURE.md` — V2 accounting controls (subset)

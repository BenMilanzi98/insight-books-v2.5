# Current Security Architecture

As-built authentication, authorization, audit, and governance controls in the InsightBooks monolith (Next.js App Router + Prisma/PostgreSQL). Evidence is from repo inspection, July 2026.

## Executive summary

InsightBooks uses **two parallel authentication planes**:

1. **Tenant users** — custom **base64-encoded JSON session cookie** (`session`), resolved on every request via `getUserFromSession`.
2. **InsightBooks admin panel** (`/insightbooks`) — **signed JWT** in `admin_token` cookie.

Authorization for tenant APIs combines **middleware** (session presence + central guard fetch), a **prefix permission map** (`tenantApiAccess`), and **per-route guards** in newer modules. Separation of duties and approvals exist **per module** but are not unified. Audit logs are **application-writable and deletable**. There is **no row-level security**, **no session revocation store**, **no tenant impersonation**, and **no first-party API key model**.

---

## 1. Authentication

### 1.1 Tenant session (unsigned base64)

Login (`app/api/auth/login/route.js`) validates email/password, then sets:

```javascript
const sessionData = { userId, tenantId, branchId, role: roleName };
const session = Buffer.from(JSON.stringify(sessionData)).toString('base64');
```

Parsing (`lib/sessionCookie.js` → `parseSessionPayload`) decodes base64 JSON and requires `userId`. There is **no HMAC, JWT signature, or server-side session record**.

Implications:

| Property | Behavior |
|---|---|
| Integrity | Client could tamper cookie bytes; **effective trust** comes from reloading user + membership from DB on each `getUserFromSession` call |
| `tenantId` in cookie | Applied to user object before membership lookup — switch-tenant flows depend on cookie payload |
| `role` in cookie | Middleware sets `x-user-role` header from cookie; **permissions are not in cookie** |
| Expiry | Cookie `maxAge` 7 days (`SESSION_COOKIE_MAX_AGE`); no sliding refresh or rotation |
| Bearer token | Same payload accepted via `Authorization: Bearer` (`lib/auth.js`) |
| Revocation | **None** — deactivate user stops new lookups; existing cookie works until expiry unless password change (no session invalidation hook) |

Cookie flags (`getSessionCookieOptions`): `httpOnly`, `sameSite: 'lax'`, `secure` in production, `path: '/'`.

### 1.2 Password storage

Tenant and admin passwords hashed with **bcrypt** (cost 10–12 depending on route):

- Login: `bcrypt.compare` — `app/api/auth/login/route.js`
- Signup/register/admin create: `bcrypt.hash` — various `app/api/auth/*`, `app/api/admin/users/*`

Plaintext passwords are never stored. OAuth fields exist on `User` but password path is primary for tenants.

### 1.3 MFA

`User.mfaEnabled` exists in schema (`prisma/schema.prisma:299`) with default `false`. Admin security settings UI exposes MFA toggles (`app/insightbooks/security/page.js`, `app/api/admin/security/settings/route.js`). **Login does not challenge MFA** when enabled — column is currently **unused** in the auth path.

### 1.4 Admin JWT (signed)

Admin login issues JWT stored as `admin_token`. Individual admin API routes verify with `jsonwebtoken` + `getJwtSecret()`. Middleware for `/insightbooks` checks cookie presence only (not signature at edge).

### 1.5 Affiliate JWT

Separate affiliate token flow (`app/api/affiliate/profile/route.js`) — third auth plane, out of tenant RBAC.

---

## 2. Multi-business membership

Model: `TenantMembership` (`userId`, `tenantId`, `roleId`, `status`).

On session load, `applyTenantMembershipRole` (`lib/auth.js:52-82`) replaces `user.role` with the **membership role** when status is `active`. This aligns RBAC when users belong to multiple businesses.

Login and tenant-switch update session cookie `tenantId`. Global `User.roleId` remains fallback when membership missing.

---

## 3. Authorization (RBAC)

### 3.1 Role.permissions JSON

`Role.permissions` is JSON (nested module → action booleans). Evaluated via:

- `flattenPermissions` / `hasPermissionInSet` — `lib/permissionUtils.js`
- `hasPermission(user, permission)` — `lib/auth.js:172-191`

Rules:

- **Full-access tenant roles** (`isFullAccessTenantRole`) bypass all checks.
- POS roles may be denied `dashboard.view` explicitly.
- Permission aliases and POS grants handled in `permissionAliases` / `posPermissions`.

### 3.2 Middleware + tenantApiAccess

`middleware.js`:

- **Skips** `/_next`, `/static`, **`/uploads`**, favicon, sitemap.
- **API routes:** requires `session` cookie unless `isApiPublicPath`; delegates to `/api/auth/api-guard`.
- **Tenant pages:** session required; subscription check; then `/api/auth/page-guard`.

`lib/tenantApiAccess.js` defines ~100 prefix rules mapping to `anyOf` permission keys. Longest prefix wins.

**Gap:** No entries for module API prefixes added in Phases 2–14:

- `/api/accounting-v2`
- `/api/coa-v2`
- `/api/equity-management`
- `/api/bank-reconciliation`
- `/api/accounting-close`
- `/api/financial-planning`
- `/api/loan-readiness`

For these paths, `api-guard` returns `{ allowed: false, reason: 'no_rule' }` **403** — but handlers that do not rely solely on middleware still attach their own guards. Any route missing a handler guard would be blocked at middleware; routes that bypass middleware matcher are not affected.

Public API prefixes include `/api/auth`, `/api/admin`, `/api/cron`, etc.

### 3.3 Handler-level guards

| Guard | Path | Notes |
|---|---|---|
| `requirePermission` / `requireAnyPermission` | Legacy routes | Honors `AUTHZ_AUDIT_MODE` |
| `guardAccountingRoute` | `/api/accounting-v2/*` | Session tenant + permission + `AccountingContext` (ADR-005 / P2-02) |
| `guardCoaRoute` | `/api/coa-v2/*` | Same pattern |
| `guardEquityRoute` | `/api/equity-management/*` | Feature flag + permissions |
| `guardBankReconRoute` | `/api/bank-reconciliation/*` | Feature flag + permissions |
| `guardCloseRoute` | `/api/accounting-close/*` | Feature flag + permissions |
| `guardPlanningRoute` | `/api/financial-planning/*` | Feature flag + permissions |
| `guardLoanReadinessRoute` | `/api/loan-readiness/*` | Feature flag + permissions |

V2 guards **do not** honor `AUTHZ_AUDIT_MODE` — they hard-fail 403.

### 3.4 AUTHZ_AUDIT_MODE (soft mode)

When `AUTHZ_AUDIT_MODE=true`, `requirePermission` logs a warning and **returns null** (allows request). Intended for rollout diagnostics; **must not be enabled in production** without compensating monitoring.

### 3.5 Known weak legacy routes (Phase 1 audit)

| ID | Route pattern | Issue |
|---|---|---|
| SEC-2 / R-20 | `/api/suppliers/[id]/summary` | Query-string `tenantId`, no handler auth |
| SEC-3 / R-21 | `/api/transactions/reverse` | Session only |
| SEC-4 / R-21 | `/api/capital-account/*` | `requireStandardAccess` unused |

Middleware may still require session for `/api/suppliers`, but **cross-tenant IDOR** remains if attacker passes another `tenantId`.

---

## 4. Separation of duties and approvals

**No unified approval engine.** Module-local patterns:

| Module | SoD rule | Storage |
|---|---|---|
| Manual journals V2 | Approver ≠ creator | `approvalValidation.js` |
| Period close / reopen | Initiator ≠ approver | `periodCloseService.js`, `periodReopenService.js` |
| Opening balances | Approver ≠ batch creator | `openingBalanceService.js` |
| Repair batches | Requester ≠ approver; approver ≠ executor | `repairBatchService.js`, `repairExecutionService.js` |
| Bank reconciliation | Preparer ≠ approver/completer | `reconciliationService.js` |
| Equity transactions | Creator ≠ approver (when approval required) | `transactionService.js`, `eqV2EquityApproval` |
| Loan readiness | Preparer ≠ reviewer ≠ approver | `separationOfDuties.js` |
| Year-end close | Soft warning if same user | `closeRunService.js` |

Legacy UI workflow form exists (`components/ApprovalWorkFlowForm.js`) for configurable steps — not wired to a central engine.

---

## 5. Tenancy isolation

- **Application-level:** Prisma queries scoped by `tenantId` / `AccountingContext.businessId` (ADR-005).
- **V2 hardening:** `assertSameBusiness`, `CrossTenantAccountingError`, adapter pre-checks for SEC-1 on V2 paths.
- **Legacy SEC-1:** `postGlEntry` still lacks line-account tenancy assertion (R-19).
- **Monitoring:** TEN-001, TEN-002 audit rules in `lib/accountingAudit/*`.
- **Database:** No PostgreSQL RLS policies. Nullable `tenantId` on some financial tables (TEN-002).

---

## 6. Audit

### 6.1 Tenant AuditLog

```prisma
model AuditLog {
  id, action, entityType, entityId, userId, timestamp, details, ipAddress, tenantId
}
```

Created across many flows (login, mutations). **Not append-only:**

- `prisma.auditLog.deleteMany` in attendance finalize cleanup
- Cascade delete on user removal (`app/api/admin/users/delete/route.js`)

No hash chain or immutability trigger.

### 6.2 AdminAuditLog

Separate table for admin panel actions — same mutability characteristics.

### 6.3 V2 accounting observability

Structured logging via `accountingLogger.js`; V2 docs claim no V2 path updates/deletes `AuditLog` — **legacy paths still can**.

---

## 7. Uploads and static exposure

Files stored under `public/uploads/`. Middleware **does not authenticate** `/uploads` requests.

Two serving paths:

1. **Direct static** — Next.js serves `public/uploads` with long cache headers (`next.config.mjs`).
2. **API proxy** — `/api/uploads/[...path]` reads filesystem with traversal guard but **no auth check**.

Tenant branding, invoices, employee documents, stock images use predictable URL patterns — **confidentiality relies on obscurity**.

---

## 8. Integrations, webhooks, background jobs

- **Cron routes:** gated by `CRON_SECRET` (per Phase 1 audit).
- **Webhooks:** schema supports `webhookEventId` on posting registry; **no live payment webhook GL posting** (Phase 9 evidence E25).
- **Idempotency:** V2 event registry for replay safety when integrations arrive.
- **Service accounts:** none — integrations would use user session or shared secrets ad hoc.

---

## 9. AI surfaces

| Surface | Gate |
|---|---|
| `/api/financial-planning/ai` | `guardPlanningRoute` + `PLANNING_FLAGS.AI` (generate may run heuristics when flag off on GET) |
| `/api/loan-readiness/ai` | Flag required for generate; review permission for accept/reject |
| `/api/ai-assistant/chat` | Middleware rule: `reports.view` OR `dashboard.view` — **no feature flag, no review gate** |

Platform-wide AI governance (PII handling, prompt injection defenses, output review) is **incomplete**.

---

## 10. Rate limiting and monitoring

- **Implemented:** mobile telemetry (`lib/mobileAppTelemetryRateLimit.js`), Android app center PHP rate limits.
- **Not implemented:** tenant API rate limiting, login throttling (beyond generic infra).
- **Admin security UI:** mock session list, configurable settings — not backed by live session store.

---

## 11. Admin ↔ tenant boundary

- Admin users are separate `Admin` model — no shared session with tenants.
- `AdminTenantAccess` grants admin visibility to tenant metadata — **not end-user impersonation**.
- `/api/admin` paths are public to middleware (admin JWT checked per route).

---

## 12. Architecture diagram (logical)

```
[Browser]
   |  session cookie (base64 JSON)
   v
[middleware.js] --skip--> /uploads (public)
   |  API: api-guard (tenantApiAccess rules)
   v
[Route handler]
   |  getUserFromSession -> TenantMembership role
   |  hasPermission / guard*Route
   v
[Domain service] --optional--> module SoD / approval
   v
[Prisma] --tenantId scope--> PostgreSQL (no RLS)
   |
   +--> AuditLog.create (mutable)
```

---

## 13. Phase 15 implications

The current architecture is **adequate for single-business trust models** where all authenticated users are semi-trusted, but **insufficient** for:

- Strict SoD regulatory environments
- Cross-tenant attack resistance on legacy routes (SEC-2, SEC-1)
- Session tamper/eviction requirements
- Confidential document handling (uploads)
- Integration identity (API keys / service accounts)
- Forensic-grade audit immutability

See `SECURITY_CONTROL_GAP_REGISTER.md` and `TARGET_SECURITY_ARCHITECTURE.md` for remediation design.

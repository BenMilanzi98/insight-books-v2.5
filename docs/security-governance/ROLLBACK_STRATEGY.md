# Rollback Strategy — Phase 15 Security & Governance

Safe deployment and revert procedures for Phase 15 security controls. Assumes feature-flagged rollout per `TARGET_SECURITY_ARCHITECTURE.md`.

---

## Feature flags

| Flag | Default | Scope | Rollback effect |
|---|---|---|---|
| `SECURITY_GOVERNANCE_ENABLED` | `false` | Master switch for `lib/securityGovernance` | Handlers use legacy guards only |
| `SECURITY_SIGNED_SESSIONS` | `false` | Session store / signed cookies | Revert to base64 cookie codec |
| `SECURITY_POLICY_ENGINE` | `false` | Middleware + handler policy calls | `api-guard` uses current `hasPermission` only |
| `SECURITY_IMMUTABLE_AUDIT` | `false` | New audit writer | Legacy `AuditLog.create` only |
| `SECURITY_UPLOAD_GATEWAY` | `false` | Auth-wrapped downloads | Public `/uploads` behavior restored |
| `SECURITY_HARD_SOD` | `false` | Deny self-approval | Module soft warnings / local rules only |
| `SECURITY_RATE_LIMITS` | `false` | Login/API throttling | No app-level limits |

Flags stored in existing tenant/system flag infrastructure (`lib/accountingV2/infrastructure/featureFlags.js` pattern) or env vars for global killswitch:

```bash
# Emergency disable all Phase 15 code paths
SECURITY_GOVERNANCE_ENABLED=false
```

---

## Rollback tiers

### Tier 0 — Documentation only (current state)

**Risk:** None. No production behavior change.

**Action:** N/A.

---

### Tier 1 — Legacy hotfixes (SEC-2, SEC-3, SEC-4, middleware prefixes)

| Change | Rollback | Data impact |
|---|---|---|
| Supplier routes use session tenant | Revert route commit; restore query param | None |
| Reversal/capital permission gates | Revert route commit | None |
| New `tenantApiAccess` prefixes | Remove prefix lines | May widen middleware block — handlers still guard |

**Verification after rollback:** Run `test/authz.test.js`; manual supplier summary with foreign `tenantId`.

**Blast radius:** Low — isolated route files.

---

### Tier 2 — Policy engine facade

| Change | Rollback | Risk if left partially on |
|---|---|---|
| Module guards call `guardSecureRoute` | Set `SECURITY_POLICY_ENGINE=false`; revert guard imports | Inconsistent deny/allow between modules |

**Procedure:**

1. Disable `SECURITY_POLICY_ENGINE` env.  
2. Redeploy previous build **or** revert guard files to call `hasPermission` directly.  
3. Confirm `/api/accounting-v2` routes respond identically to pre-cutover baseline.

**Do not** rollback Tier 2 without disabling flag — half-migrated guards may double-evaluate or skip checks.

---

### Tier 3 — Session store cutover

Highest user impact.

| Phase | Forward | Rollback |
|---|---|---|
| Dual-read | Accept old base64 + new session ID | Stop issuing new sessions; read base64 only |
| Cutover | Issue session IDs only | Emergency: re-enable base64 login path behind flag |

**Rollback procedure:**

1. Set `SECURITY_SIGNED_SESSIONS=false`.  
2. Deploy login route that writes legacy base64 cookie (keep session table writes optional).  
3. Invalidate all `UserSession` rows (`revokedAt = now()`) — forces re-login once.  
4. Communicate maintenance window.

**Data retention:** Keep `UserSession` table for forensics; do not drop in rollback.

---

### Tier 4 — Immutable audit

| Change | Rollback |
|---|---|
| Writes to `SecurityAuditEvent` | Disable flag; write only to `AuditLog` |
| Triggers blocking AuditLog DELETE | Drop trigger in emergency migration |

**Never rollback by deleting audit events.** If immutable pipeline fails, **queue events locally** and fix forward.

---

### Tier 5 — Upload gateway

| Change | Rollback |
|---|---|
| Middleware blocks `/uploads` | Remove middleware skip change; restore public static |
| Signed URL API | Disable flag; direct paths work again |

**Risk:** Brief window where uploaded files inaccessible — prefer flag off over partial deploy.

---

## Database migrations

| Migration | Rollback SQL strategy |
|---|---|
| `UserSession` table | Leave table; stop using (soft rollback) |
| `SecurityAuditEvent` table | Leave table; stop writing |
| `ServiceAccount` table | Revoke all keys; disable integrations |
| AuditLog triggers | `DROP TRIGGER` script in migration down |

**Rule:** Phase 15 migrations must be **additive**. No destructive drops in up migration until Phase 16 cleanup.

---

## Deployment order (forward)

1. Deploy code with all flags **off**.  
2. Enable `SECURITY_POLICY_ENGINE` in staging; run authz + module tests.  
3. Enable middleware prefix fixes (Tier 1) in production.  
4. Enable legacy hotfixes (Tier 1) in production.  
5. Pilot `SECURITY_SIGNED_SESSIONS` on internal tenant.  
6. Enable immutable audit for new events only.  
7. Enable upload gateway for new uploads first; migrate old paths async.

---

## Monitoring during rollout

Alert on (via GAP-SEC-029):

- Spike in 403 `CROSS_TENANT_DENIED`  
- Spike in 401 after session cutover  
- `AUTHZ_AUDIT_MODE` true in production (should never fire)  
- Audit writer failure queue depth  
- Rate limit 429 rate on `/api/auth/login`

**Automatic rollback trigger (recommended):**

- If 401 rate > 5× baseline for 10 minutes after session cutover → disable `SECURITY_SIGNED_SESSIONS`.

---

## Communication

| Audience | When | Message |
|---|---|---|
| All tenants | Session cutover | Re-login required; sessions improved |
| Admins | Immutable audit | New security event log; old logs retained |
| Integrators | Service accounts | API key rotation schedule |

---

## Testing before production

Required suites (Phase 15 code — **PENDING** until implemented):

- `test/securityGovernance.policy.test.js`  
- `test/securityGovernance.sod.test.js`  
- `test/authz.test.js` (extended)  
- SEC-2 regression (BY in task list)

**No production flag enable without green CI on above.**

---

## Related documents

- `PHASE_15_TASKS.md` — workstream ownership  
- `PHASE_16_READINESS.md` — blockers if rollback fails repeatedly  
- `SECURITY_CONTROL_GAP_REGISTER.md` — gap ↔ control mapping

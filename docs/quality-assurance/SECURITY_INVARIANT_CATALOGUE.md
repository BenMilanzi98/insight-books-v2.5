# Security Invariant Catalogue

Invariants **SEC-INV-001** through **SEC-INV-035** for platform security and governance. Linked to Phase 1 findings (SEC-*, TEN-*), Phase 15 gaps (GAP-SEC-*), and threats (THR-*).

**Legend:** ✅ tested | ⚠️ partial | ❌ not tested

---

## Session & authentication (SEC-INV-001 – SEC-INV-007)

| ID | Invariant | Linked | Test evidence | Status |
|---|---|---|---|---|
| SEC-INV-001 | Tenant session cookie is integrity-protected (signed or server-stored) | GAP-SEC-001, THR-002 | `encodeSessionToken`/`decodeSessionToken` in `securityGovernance.engine.test.js` | ⚠️ unit only; production cookie unsigned |
| SEC-INV-002 | Tampered `tenantId` in session rejected before handler | GAP-SEC-003, P2-02 | engine decode tests | ⚠️ |
| SEC-INV-003 | Logout invalidates server-side session when store enabled | GAP-SEC-002, THR-003 | — | ❌ `session.test.js` NOT_STARTED |
| SEC-INV-004 | Admin force-logout revokes tenant sessions | GAP-SEC-002 | — | ❌ |
| SEC-INV-005 | Login rate-limited per IP + account | GAP-SEC-020, THR-004 | `checkRateLimit` in engine test | ⚠️ |
| SEC-INV-006 | MFA required when `User.mfaEnabled=true` | GAP-SEC-024, THR-006 | — | ❌ |
| SEC-INV-007 | Passwords stored with bcrypt only | THR-005 | — | ❌ (code review) |

---

## Authorization & tenancy (SEC-INV-008 – SEC-INV-015)

| ID | Invariant | Linked | Test evidence | Status |
|---|---|---|---|---|
| SEC-INV-008 | `ActorContext.businessId` from session only — never client body/query | ADR-005, P2-02, THR-007 | `securityGovernance.engine.test.js` (`CrossTenantAccessError`) | ✅ domain |
| SEC-INV-009 | Supplier financial routes ignore query `tenantId` | SEC-2, R-20, GAP-SEC-013 | — | ❌ GAP-QA-003 |
| SEC-INV-010 | `postGlEntry` / legacy GL verifies line-account tenancy | SEC-1, R-19, GAP-SEC-014 | V2 adapter pre-check in postingEngine | ⚠️ legacy path open |
| SEC-INV-011 | Journal reversal requires explicit permission | SEC-3, GAP-SEC-016 | `authz.test.js` helper only | ❌ |
| SEC-INV-012 | Capital view/post requires capital permissions | SEC-4, GAP-SEC-015 | — | ❌ |
| SEC-INV-013 | V2 module APIs registered in middleware catalogue | GAP-SEC-011, THR-014 | — | ❌ GAP-QA-005 |
| SEC-INV-014 | Unlisted `/api/*` paths default-deny (403) | GAP-SEC-012, THR-013 | — | ❌ |
| SEC-INV-015 | `AUTHZ_AUDIT_MODE` cannot be true in production | GAP-SEC-021, THR-015 | — | ❌ |

---

## Separation of duties (SEC-INV-016 – SEC-INV-020)

| ID | Invariant | Linked | Test evidence | Status |
|---|---|---|---|---|
| SEC-INV-016 | Preparer ≠ sole approver on financial mutations | GAP-SEC-005, THR-016 | `evaluateMakerChecker` in engine test | ⚠️ |
| SEC-INV-017 | Self-approval denied on legacy reversal/capital | GAP-SEC-006, SEC-3/4 | — | ❌ `sod.test.js` |
| SEC-INV-018 | Repair batch: approver ≠ requester | Phase 6 | domain in repair tests | ⚠️ |
| SEC-INV-019 | Bank recon: preparer ≠ approver | Phase 10 | `bankReconciliation.domain.test.js` | ⚠️ |
| SEC-INV-020 | Loan assessment: preparer ≠ reviewer ≠ approver | LRD-017 class, THR-020 | — | ❌ GAP-QA-010 |

---

## Audit & monitoring (SEC-INV-021 – SEC-INV-025)

| ID | Invariant | Linked | Test evidence | Status |
|---|---|---|---|---|
| SEC-INV-021 | Security audit events append-only | GAP-SEC-007, THR-025 | `buildAuditEvent`, `verifyAuditChain` in engine test | ⚠️ |
| SEC-INV-022 | Audit tamper attempt generates alert | GAP-SEC-008 | — | ❌ |
| SEC-INV-023 | Policy deny emits structured security event | GAP-SEC-029, THR-028 | — | ❌ |
| SEC-INV-024 | Cross-tenant deny counted in metrics | GAP-SEC-029 | — | ❌ |
| SEC-INV-025 | PII redacted in audit payload | — | `redactForAudit` in engine test | ✅ |

---

## Data exposure & uploads (SEC-INV-026 – SEC-INV-029)

| ID | Invariant | Linked | Test evidence | Status |
|---|---|---|---|---|
| SEC-INV-026 | `/uploads` not publicly cacheable without auth | GAP-SEC-009, THR-021 | — | ❌ GAP-QA-020 |
| SEC-INV-027 | Download URLs time-limited and signed | GAP-SEC-010, THR-023 | — | ❌ |
| SEC-INV-028 | Upload path traversal blocked | THR-024 | `assertSafeUpload` in engine test | ⚠️ |
| SEC-INV-029 | HR/loan documents not in public static tree | THR-022 | — | ❌ |

---

## Integrations & AI (SEC-INV-030 – SEC-INV-033)

| ID | Invariant | Linked | Test evidence | Status |
|---|---|---|---|---|
| SEC-INV-030 | Webhook requests HMAC-verified | GAP-SEC-022, THR-029 | `verifyWebhookSignature` in engine test | ⚠️ |
| SEC-INV-031 | Webhook replay returns 409 | GAP-SEC-023, THR-030 | `_resetWebhookNonces` tests | ⚠️ |
| SEC-INV-032 | AI cannot invoke posting APIs directly | GAP-SEC-018, THR-033 | `assertAiActionAllowed` in engine test | ⚠️ |
| SEC-INV-033 | AI prompt payload minimized / PII scrubbed | GAP-SEC-019, THR-034 | `minimizeAiPromptPayload` in engine test | ⚠️ |

---

## Platform & schema (SEC-INV-034 – SEC-INV-035)

| ID | Invariant | Linked | Test evidence | Status |
|---|---|---|---|---|
| SEC-INV-034 | Financial `tenantId` columns NOT NULL after migration | GAP-SEC-026, TEN-002, R-14 | audit TEN-002 rule | 🔍 |
| SEC-INV-035 | Cross-tenant GL prevented at policy + engine (not detection-only) | GAP-SEC-030, P6-XTEN-001 | V2 posting engine | ⚠️ |

---

## Phase 1 finding cross-reference

| Finding | SEC-INV coverage |
|---|---|
| SEC-1 | SEC-INV-010, SEC-INV-035 |
| SEC-2 | SEC-INV-009 |
| SEC-3 | SEC-INV-011, SEC-INV-017 |
| SEC-4 | SEC-INV-012 |
| TEN-001 | SEC-INV-010, ACC-INV-043 |
| TEN-002 | SEC-INV-034 |
| TEN-003 | SEC-INV-009, SEC-INV-008 |

---

## Verification target

Phase 16 exit: **≥90% of SEC-INV-008–SEC-INV-020** have automated tests (maps to THR-007–THR-016 bar in `PHASE_16_READINESS.md`).

Planned suites:
- `test/securityGovernance.policy.test.js`
- `test/securityGovernance.sod.test.js`
- `test/securityGovernance.session.test.js`
- `test/qa/*.test.js`

See `AUTHORIZATION_TEST_MATRIX.md` and `MULTI_TENANT_ISOLATION_MATRIX.md`.

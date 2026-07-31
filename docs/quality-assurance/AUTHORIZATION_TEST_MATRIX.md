# Authorization Test Matrix

Maps **permissions**, **routes**, and **test coverage** for RBAC and the security governance engine. Findings: **SEC-3**, **SEC-4**, **R-21**, **GAP-SEC-005–016**.

---

## Core RBAC helper

**File:** `test/authz.test.js` (10 cases)  
**Module:** `lib/auth.js` → `hasPermission()`

| Scenario | Covered | Status |
|---|---|---|
| Missing user/role denies | ✅ | EXISTS |
| MASTER_ADMIN allow-all | ✅ | EXISTS |
| Owner/Admin empty permissions allow | ✅ | EXISTS |
| Nested permission maps | ✅ | EXISTS |
| Flat permission maps | ✅ | EXISTS |
| employees.* → hr.* mapping | ✅ | EXISTS |
| Sales denied dashboard.view | ✅ | EXISTS |
| POS supporting permissions from sales.* | ✅ | EXISTS |

**Limitation:** Helper only — **no HTTP route tests**.

---

## Security governance engine

**File:** `test/securityGovernance.engine.test.js` (27 cases)  
**Module:** `lib/securityGovernance/index.js`

| Capability | Test describe block | Status |
|---|---|---|
| ActorContext build/freeze | `actor context` | ✅ |
| Session user → permissions flatten | same | ✅ |
| Same-business ALLOW | `authorization engine` | ✅ |
| Cross-business DENY (`CrossTenantAccessError`) | same | SEC-INV-008 | ✅ |
| Missing permission DENY | same | ✅ |
| Maker-checker / self-approval | maker-checker tests | SEC-INV-016 | ✅ |
| Approval checksum / stale | approval tests | ✅ |
| Audit chain / redact | audit tests | ✅ |
| Session encode/decode | session token tests | SEC-INV-001 | ⚠️ |
| Rate limit | rate limit tests | SEC-INV-005 | ⚠️ |
| Field access / mask bank | field access tests | ✅ |
| AI governance block | AI tests | SEC-INV-032 | ⚠️ |
| Webhook signature | webhook tests | SEC-INV-030 | ⚠️ |
| Upload safety | upload tests | SEC-INV-028 | ⚠️ |

---

## Pending suites (Phase 15 / 16)

| Suite | Workstream | THR | GAP-SEC | Status |
|---|---|---|---|---|
| `test/securityGovernance.policy.test.js` | BW / BI | THR-007–016 | 004, 013–016 | **NOT_STARTED** |
| `test/securityGovernance.sod.test.js` | BX / BJ | THR-016–020 | 005, 006 | **NOT_STARTED** |
| `test/securityGovernance.session.test.js` | BY / BK | THR-002, 003 | 001–003 | **NOT_STARTED** |
| `test/qa/reversal-authz.test.js` | BG | THR-011 | 016 | **NOT_STARTED** |
| `test/qa/capital-authz.test.js` | BG | THR-012 | 015 | **NOT_STARTED** |
| `test/qa/middleware-catalogue.test.js` | BH / BZ | THR-013, 014 | 011, 012 | **NOT_STARTED** |

---

## Route × permission matrix (target HTTP tests)

| Route prefix | Expected permission | Finding | Test | Status |
|---|---|---|---|---|
| `/api/transactions/reverse` | `journalEntries.update` or reversal key | SEC-3 | `reversal-authz.test.js` | ❌ |
| `/api/capital-account` | capital view/post keys | SEC-4 | `capital-authz.test.js` | ❌ |
| `/api/suppliers/[id]/summary` | session tenant only — **no query tenantId** | SEC-2 | `supplier-idor.test.js` | ❌ |
| `/api/accounting-v2/*` | `accountingV2.*` keys | middleware gap | middleware catalogue | ❌ |
| `/api/coa-v2/*` | CoA permissions | GAP-SEC-011 | middleware catalogue | ❌ |
| `/api/equity-management/*` | equity permissions | Phase 11 | `equity-approval.test.js` | ❌ |
| `/api/bank-reconciliation/*` | bank recon permissions | Phase 10 | partial domain | ⚠️ |
| `/api/accounting-close/*` | close permissions | Phase 12 | domain only | ⚠️ |
| `/api/financial-planning/*` | planning permissions | Phase 13 | domain only | ⚠️ |
| `/api/loan-readiness/*` | loan permissions + SoD | Phase 14, LRD-017 | `loan-readiness-sod.test.js` | ❌ |

---

## Module-local authorization (domain tests exist)

| Module | Guard | Test file | HTTP |
|---|---|---|---|
| Accounting V2 | `routeGuard.js` | `accountingV2.boundaries.test.js` | ❌ |
| Bank recon | `guardBankReconRoute` | `bankReconciliation.domain.test.js` | ❌ |
| Accounting close | `guardCloseRoute` | `accountingClose.domain.test.js` | ❌ |
| Equity | approval service | `equityManagement.workflows.test.js` | ❌ |
| Loan readiness | `separationOfDuties.js` | `loanReadiness.engine.test.js` | ❌ |
| POS | role permissions | `posPermissions.test.js` | ❌ |

---

## AUTHZ_AUDIT_MODE

| Check | Test | Status |
|---|---|---|
| Prod boot fails if AUTHZ_AUDIT_MODE=true | env guard test | ❌ GAP-SEC-021 |
| Deny logged but allowed in audit mode | — | ❌ |

---

## Coverage target

**Phase 16 exit:** ≥90% of THR-007–THR-016 rows in this matrix marked ✅ or ⚠️ with HTTP test; ❌ only with approved W-SEC (not permitted for SEC-2).

---

## Related

- `SECURITY_INVARIANT_CATALOGUE.md` SEC-INV-008–020
- `REQUIREMENT_TEST_TRACEABILITY_MATRIX.md`
- `docs/security-governance/PHASE_15_TASKS.md` (BW–BZ)
- `docs/accounting-audit/MULTI_TENANT_AND_SECURITY_AUDIT.md` — SEC-1..4

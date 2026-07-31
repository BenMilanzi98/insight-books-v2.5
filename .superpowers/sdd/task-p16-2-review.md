# Task P16-2 Review — Wave 2 Customer/Tenant/Business/Branch/invitations

**Mode:** Spec + quality (read-only)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p16-2-review-package.diff`  
**Brief / report:** `task-p16-2-brief.md` / `task-p16-2-report.md`  
**Date:** 2026-07-31  
**Vitest:** Not re-run (per instructions); claimed 7 Wave 2 + 11 Wave 1 = 18; source has **7** `it(...)` matching brief TDD list  

---

### Spec Compliance: ✅ (with honesty caveats)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Interfaces (match/decide/create/link/invite/boundary/isolation) | ✅ | Exported via `lib/admin/crm` + conversions barrel |
| POSSIBLE_MATCH / CONFLICT block create; no auto-merge | ✅ | `decideCustomerCreateOrLink` + provision; duplicate-review stub refuses merge |
| Exact link → no duplicate Customer | ✅ | Tested; resource LINK path |
| Tenant slug reserved / unique blocked | ✅ | Enforced even if loose `decision` passed |
| Tenant not ACTIVE before Wave 3 | ✅ | `status: PROVISIONING` on create; test asserts not active/ACTIVE |
| Invitation hash-only; exact retry; no default password | ✅ | Persists/returns `tokenHash` only; mock forbids raw/password fields |
| Accounting boundary (no journals/balances) | ✅ | Assert after create; CoA init does not post journals |
| Cross-tenant Business denied | ✅ | `assertTenantIsolation` + `createPrimaryBusinessBranch` |
| Orchestrator runs Wave 2 after Closed Won (not SKIPPED) | ✅ | `ensureWave2Steps` reactivates Wave 1 SKIPPED; `runWave2ProvisionSpine` |
| Decisions audited | ✅ | `CrmConversionMatchDecision` on customer/tenant decide (when model present) |
| Reuse / typed NOT_AVAILABLE | ⚠️ | Tenant via `prisma.tenant` (avoids admin ACTIVE path) OK; Business proxy invents success id (Important #2); PlatformCustomer is new plane (reported) |
| No Subscription/Invoice; no commit | ✅ | Wave 3 steps stay SKIPPED; honesty flags false; WORKING_TREE |
| Vitest Wave 2 PASS (claim) | ✅ | Report 7/7 (+ Wave 1 → 18); source case list matches brief TDD |

### Global constraints spot-check

- POSSIBLE_MATCH blocks create; no auto-merge — **held**
- Invitation hash-only; no default passwords — **held**
- No Tenant GL journals; Tenant not ACTIVE — **held**
- Reuse or typed NOT_AVAILABLE — **mostly**; Business proxy honesty gap
- No Subscription/Invoice this wave; no commit — **held**

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

1. **Customer/Tenant step exceptions soft-complete without blocking the saga** — `lib/admin/crm/conversions/wave2Runner.js` (~207–218, ~338–348)  
   `catch` marks the step `COMPLETED_WITH_WARNING` and does **not** set `blocked`. Customer exception → Tenant create can still run without `customerId`. Tenant exception → dependents skipped and spine returns `ok: true`. Fail closed (or block + FAILED_*) on unexpected exceptions so Wave 2 cannot silently continue after a hard error.

2. **No first-class Business model returns a fabricated `biz-proxy:*` success** — `lib/admin/crm/conversions/businessBranch.js` (~79–83, ~165–172)  
   Hard rule is reuse existing services or typed `NOT_AVAILABLE`. Missing `conversionBusiness` still sets `businessId = biz-proxy:${conversionId}`, `ok: true`, and Wave 2 sets `businessCreated: true`. Prefer `status: 'NOT_AVAILABLE'`, `ok: false` (or `skippedBusiness: true` + warning), and do not treat the proxy string as a created Business.

3. **Tenant create orphans on post-create accounting-boundary failure** — `lib/admin/crm/conversions/tenantProvision.js` (~212–262)  
   Tenant row is committed before boundary check; on failure no resource row is written and no compensation runs. Exact retry (same slug/idempotency) then hits `tenant_slug_collision` / BLOCKED with a stranded `PROVISIONING` tenant. On boundary failure: record the resource as FAILED for idempotent replay, or compensate/delete, or link the existing orphaned tenant on retry.

#### Minor (Nice to Have)

1. **`executeClosedWonConversion` returns `ok: true` when `blocked: true`** — Closed Won retained by design; callers must check `blocked` / step status or POSSIBLE_MATCH looks like success.
2. **`audited: Boolean(args.conversionId)`** even when match-decision model is absent (no row written).
3. **Invite isolation assert is tautological** (`lockedTenantId === requestedTenantId` always); rely on Wave 2 passing conversion tenant only.
4. **Invitation raw token discarded** — hash-only meets Wave 2 TDD; delivery/send helper still needed before invites are usable.
5. **`matchPlatformCustomer` loads all `platformCustomer` rows** — fine for unit mocks; needs indexed query before production volume.
6. **PlatformCustomer vs CustomerPortfolio CS plane** — report concern #1; reconcile before cutover.
7. **Prisma EPERM / SQL fallback** — apply `scripts/sql/crm-conversion-phase16-wave2.sql` before runtime.
8. **Dead ternary in `finalizeConversionStatus`** — both branches `PARTIALLY_COMPLETED` (Wave 2 intentional; simplify later).

---

### Acceptance checklist (brief)

- [x] Vitest Wave 2 PASS (claimed 7/7; not re-run; source matches TDD)
- [x] Match/create-link decisions audited (when model present)
- [~] Isolation + invitation security — invite hash-only OK; Business NOT_AVAILABLE honesty gap (Important #2)
- [x] No Subscription/Invoice; no commit
- [x] Tenant PROVISIONING / not ACTIVE; POSSIBLE_MATCH blocks create

### Assessment

Wave 2 match/provision/invite/accounting-boundary modules, SQL/Prisma, orchestrator wiring, and claimed TDD coverage meet the brief on the happy path and hard security rules (no auto-merge, hash-only invites, no ACTIVE tenant, no GL/Subscription). Quality is **not** approved until exception handling cannot soft-continue, Business absence is typed `NOT_AVAILABLE` (not a success proxy), and tenant create+boundary failure is idempotent without orphans.

**Spec:** ✅ (caveat: Business NOT_AVAILABLE honesty)  
**Task quality:** Not approved  
**Findings:** Critical 0 · Important 3 · Minor 8  

**Review path:** `.superpowers/sdd/task-p16-2-review.md`

---

## RE-REVIEW (post Important fixes)

**Date:** 2026-07-31  
**Scope:** Important #1–#3 only + Wave 2 source test count; modules `customerProvision.js`, `tenantProvision.js`, `businessBranch.js`, `orchestrator.js`, `wave2Runner.js`, `test/systemAdmin.crm.conversionWave2.test.js`  
**Vitest:** Not re-run; report claims 10/10; source has **10** `it(...)`  

### Important remediation

| # | Prior defect | Status | Evidence |
|---|--------------|--------|----------|
| 1 | Customer/Tenant `catch` → `COMPLETED_WITH_WARNING`, no `blocked` | **Fixed** | `wave2Runner.js` catch → `FAILED_RETRYABLE` + `blocked: true`; early return prevents Tenant without Customer / dependents after Tenant exception. Test: `Customer step exception fails closed…` |
| 2 | Missing Business → `biz-proxy:*` success | **Fixed** | `businessBranch.js` returns `{ ok: false, status: 'NOT_AVAILABLE', skippedBusiness: true, businessId: null }`; runner never sets `businessCreated` on failure/proxy. Test: `missing Business model returns typed NOT_AVAILABLE…` |
| 3 | Boundary fail orphans Tenant (slug collision on retry) | **Fixed** | `tenantProvision.js` marks `FAILED_PROVISIONING` + resource row; exact retry resumes same tenant via failed-resource / claim-orphan path. Test: `accounting-boundary fail after Tenant create is compensatable…` |

### Spec / acceptance (re-check)

- Interfaces, POSSIBLE_MATCH block, exact link, slug reserved/unique, PROVISIONING not ACTIVE, invite hash-only + idempotent, accounting boundary, cross-tenant deny, orchestrator after Closed Won, audited decisions — **held**
- Reuse or typed `NOT_AVAILABLE` — **held** (Business honesty gap closed)
- Vitest Wave 2 at source — **10/10** (7 brief TDD + 3 Important regression cases)
- Minors from prior review (orchestrator `ok`+`blocked`, audited flag without model, invite delivery, PlatformCustomer plane, etc.) — **unchanged residual**; not blockers

### Assessment

Important #1–#3 are fixed at source with matching regression tests. Quality approved.

**Spec:** ✅  
**Quality Approved?** Yes  
**Findings:** Critical 0 · Important 0 (remediated) · Minor 8 (prior residual)  
**Review path:** `.superpowers/sdd/task-p16-2-review.md`

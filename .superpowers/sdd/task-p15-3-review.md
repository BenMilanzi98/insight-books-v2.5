# Task P15-3 Review — Wave 3 Templates, PDF, issue, delivery, review, acceptance

**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p15-3-review-package.diff`  
**Brief / report:** `task-p15-3-brief.md` / `task-p15-3-report.md`  
**Mode:** Read-only (spec + quality); Vitest not re-run; claimed 7/7 verified by source  
**Date:** 2026-07-31  

**Spot-check:** customer review route + page; Prisma Wave 3 models; acceptance / reviewAccess / issue / signatureBoundary / templates projection.

---

### Spec Compliance: ✅ (with Important gaps on secure accept path)

| Criterion | Status | Notes |
|-----------|--------|-------|
| Required libs (templates→signatureBoundary) | ✅ | Present under `lib/admin/crm/commercial/`; barrel exports |
| Interfaces: render / issue / view / comment / revision / accept / reject / e-sign / expiry | ✅ | `(prisma, args)` pattern; `getESignatureProviderStatus` → `NOT_CONFIGURED` |
| Deterministic render + checksum; no silent replace | ✅ | Fixed PDF 1.4 (no `/ID`/dates); idempotent artifact key returns existing; new key → new row |
| Issue/delivery idempotent; delivery ≠ view ≠ acceptance | ✅ | Delivery idempotency; issue does not call `recordCustomerView`; accept separate |
| Acceptance binds version + artifact + checksum + recipient + authority | ~ | Lib requires all five; **API accept/reject does not bind token**; authority weak when recipient role empty |
| Superseded / expired acceptance default block | ~ | SUPERSEDED/WITHDRAWN/EXPIRED/REJECTED blocked; **accept ignores `reviewAccess.expiresAt`** |
| E-sign NOT_CONFIGURED; no fabricated sig/delivery/view/accept | ✅ | `signatureBoundary.js`; delivery `viewCreated: false`; invent flags remain |
| Customer-safe projection | ✅ | `projectContentForAudience` strips internals; GET uses ISSUED |
| Prisma + SQL + hasCrm*Model; thin APIs; customer route; no commit | ✅ | Models + `crm-commercial-phase15-wave3.sql`; WORKING_TREE |
| Vitest Wave 3 PASS (claim) | ✅ | Source has **7** `it(...)` matching report list (not re-run) |

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

1. **Customer review POST `accept`/`reject` never resolve the token** — `app/api/crm/customer-commercial-review/route.js`  
   Only checks `token.length >= 16`, then calls `acceptCommercialDocument` / `rejectCommercialDocument` with body IDs. Unlike `view`/`comment`/`revision`, a random 16+ char string works if `documentVersionId` / `artifactId` / `checksumSha256` / `recipientId` / `authorityRole` are known (e.g. from a prior GET). Secure review requires `resolveReviewAccessByToken` and binding accept/reject to that access’s version/recipient/artifact/checksum.

2. **Acceptance ignores review-access expiry** — `lib/admin/crm/commercial/acceptance.js`  
   Access check is `revokedAt: null` only — no `expiresAt` gate. A past-due link remains acceptable until the expiry job marks the version `EXPIRED` and revokes access. Default expired policy should fail closed at accept time (`review_access_expired`).

3. **Authority defaults to caller-claimed `SIGNATORY` when recipient has no role** — `acceptance.js` + customer page  
   Empty `recipient.authorityRole` accepts any `authorityRole === 'SIGNATORY'`; the page hardcodes that role. Authority is not source-backed for unset recipients. Require a stored role match (or fail closed when role missing).

#### Minor (Nice to Have)

1. **`CrmCommercialReviewAccess.tokenPlain` column** — null in non-test create path, but schema allows plaintext persistence; prefer omit column or encrypt-at-rest if ever needed.
2. **Expiry job is delivery-`validUntil`-driven only** — access rows with `expiresAt` but no delivery `validUntil` are not auto-expired until revoke/supersede.
3. **Prisma generate / db push not run** — reported; `hasCrm*Model` + SQL mitigate until regenerate.
4. **Hand-rolled PDF is checksum-stable, not layout-complete** — reported; acceptable for Wave 3 spine.
5. **EMAIL delivery records evidence without forcing SMTP** — reported; honest (no fabricated sent mail).

---

### Acceptance checklist (brief)

- [x] Vitest Wave 3 PASS (claimed 7/7; not re-run; source matches)
- [x] Checksummed artifacts; no silent replace
- [x] Issue/delivery idempotent
- [~] Secure review + acceptance source-backed — **GET/view OK; POST accept/reject token unbound (Important #1)**
- [x] E-sign boundary explicit `NOT_CONFIGURED`
- [x] No commit

---

### Assessment

Wave 3 delivers deterministic PDF/artifacts, idempotent issue/delivery, supersession+withdrawal revoke, customer-safe projection, e-sign boundary, Prisma/SQL, and the seven TDD cases at source. Quality is **not** approved until customer accept/reject is token-bound, expired review access fails closed at accept, and authority is recipient-sourced.

**Spec:** ✅  
**Task quality:** Not approved  
**Findings:** Critical 0 · Important 3 · Minor 5  
**Review path:** `.superpowers/sdd/task-p15-3-review.md`

---

## RE-REVIEW (after Important fixes)

**Date:** 2026-07-31  
**Mode:** Read-only; Vitest not re-run; package AFTER FIX + live source  
**Trigger:** Fix wave for Important #1–3  

### Important fix verification

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | Token resolve on accept/reject | **Fixed** | Customer POST calls `resolveReviewAccessByToken` → 401 on failure; binds version/artifact/checksum/recipient from access; lib accept/reject resolve `args.token` and mismatch-fail |
| 2 | Honour `expiresAt` / revocation | **Fixed** | `resolveReviewAccessByToken` → `review_access_expired`; accept/reject active-access check gates `expiresAt`; revoked still fail-closed |
| 3 | No SIGNATORY default | **Fixed** | `evaluateAcceptanceAuthority`: empty role → `authority_unverified` / `UNVERIFIED`; GET returns recipient `authorityRole`; page uses `review?.authorityRole` (no hardcode) |

### Tests at source

`test/systemAdmin.crm.commercialWave3.test.js`: **10** `it(...)` (original 7 + unknown token, expired access, empty authority). Report claim 10/10; not re-run.

### Spec / acceptance (post-fix)

| Criterion | Status |
|-----------|--------|
| Acceptance binds version+artifact+checksum+recipient+authority via token | ✅ |
| Expired/revoked review access fails closed at accept | ✅ |
| Secure review + acceptance source-backed | ✅ |
| Vitest Wave 3 (source) | ✅ 10/10 |

### Residual

Prior **Minor 1–5** unchanged (tokenPlain column, expiry-job scope, Prisma generate, PDF layout, EMAIL evidence). No new Critical/Important.

### Assessment

Important #1–3 verified fixed in source and AFTER FIX package. Quality approved.

**Spec:** ✅  
**Quality Approved?** Yes  
**Findings:** Critical 0 · Important 0 (prior 3 resolved) · Minor 5 (residual)  
**Review path:** `.superpowers/sdd/task-p15-3-review.md`

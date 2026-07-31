# Task P15-1 Review — Wave 1 Proposal Request + Commercial Document Spine

**Head:** `WORKING_TREE` (base `7d9709a`; no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p15-1-review-package.diff` (includes post-fix `requests.js`)  
**Brief / report:** `task-p15-1-brief.md` / `task-p15-1-report.md`  
**Mode:** Read-only re-review after Important fixes (Vitest not re-run; claimed 7/7 verified by source)  
**Date:** 2026-07-31  

---

## RE-REVIEW (post Important fix wave)

### Prior Important disposition

| # | Finding | Status | Evidence |
|---|---------|--------|----------|
| 1 | `rejectProposalRequest` bypasses transition table | **Resolved** | Reject routes through `transitionProposalRequestStatus` → `canTransitionProposalRequestStatus`. Illegal `APPROVED→REJECTED` returns `{ ok: false, error: 'invalid_request_status_transition', fromStatus, toStatus }`. Idempotent already-`REJECTED` and `CONVERTED` gates preserved. |
| 2 | `convertProposalRequest` skips status history | **Resolved** | First-time convert to `CONVERTED` uses `transitionProposalRequestStatus` (status update + `CrmProposalRequestStatusHistory` + convert patch). Already-`CONVERTED` retry patches document links only (no duplicate history). |

### Covering tests (claimed 7/7)

Source `test/systemAdmin.crm.commercialWave1.test.js` has **7** `it(...)` cases including new:

- `illegal request reject from APPROVED fails visibly` — qualifies → APPROVED → reject → expects `invalid_request_status_transition`.

Report GREEN claim: `Tests 7 passed (7)`. Not re-run this re-review; case count and assertions match the claim.

### Spec Compliance: ✅

Unchanged from initial review; hard rules still met (Proposal ≠ Quotation; no tenant Quotation; no Opp auto-mutation; issued immutability foundation; invalid transitions fail for documents **and** request reject; no PDF/Price Book; no commit).

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None remaining._ Prior Important #1 and #2 resolved.

#### Minor (Nice to Have) — residual from initial review

1. **Document + version (+ typed extension) create not one transaction** — orphan document / burned PROP\|QUO number possible if version/extension create fails after document insert.
2. **Demo/Opp PRQ seed `catch {}` swallows non-EPERM errors** — handoff/readiness continue silently on unexpected failures; log or surface `seedError` without fabricating documents.
3. **`createQuotation: false` cannot opt out when `requestedDocumentType` is `BOTH`** — asymmetric with `createProposal !== false`; document if intentional.
4. **Prisma generate / db push not run** — reported; guards + SQL mitigate; regenerate when safe.
5. **UI stub i18n keys may render raw** — reported; stubs OK for Wave 1.
6. **`prisma/schema.prisma` vs package base is +~3390 lines** — includes large pre-existing CRM/analytics surface beyond Wave 1 commercial models; isolate commercial hunks before commit.

_(Prior Minor #7 — no illegal-reject test — resolved by the new Vitest case.)_

### Acceptance checklist (brief)

- [x] Vitest Wave 1 PASS (claimed 7/7; not re-run)
- [x] Numbers server-allocated and unique
- [x] Request convert + Demo handoff idempotent
- [x] Proposal ≠ Quotation distinct models
- [x] Issued immutability foundation guard present
- [x] Thin routes exist (stubs OK)
- [x] No tenant Quotation alias; no Opp auto-mutation; no commit
- [x] Request reject honors transition table (fix wave)
- [x] Convert appends request status history via shared helper (fix wave)

### Assessment

Fix wave closes both Important defects: reject is fail-closed against the request transition table, convert writes status history through the shared helper on first convert, and the new Vitest case covers illegal APPROVED→REJECTED. Residual Minors are non-blocking for Wave 1 quality approval.

**Spec:** ✅  
**Task quality:** Approved  
**Findings:** Critical 0 · Important 0 · Minor 6  

---

## Initial review (superseded for Important; kept for history)

### Spec Compliance: ✅

| Criterion | Status | Notes |
|-----------|--------|-------|
| Required interfaces (PRQ create/qualify/reject/convert; createProposal/Quotation; createDocumentVersion; transitionDocumentStatus) | ✅ | `(prisma, args)` matches prior CRM Wave pattern; exported from `lib/admin/crm` + commercial barrel |
| Numbers `PRQ-/PROP-/QUO-YYYY-######` + `…-V{n}` | ✅ | `allocateCrmNumber` + catalogue prefixes; version label helper |
| Convert + Demo handoff idempotent | ✅ | Idempotency keys on request/docs; handoff → `prq-from-handoff:…`; convert retry returns same |
| Proposal ≠ Quotation distinct models | ✅ | `CrmProposal` / `CrmQuotation` + documentFamily; no tenant Quotation import |
| Issued immutability foundation | ✅ | `updateDocumentVersionContent` / `assertVersionMutable` throw when issued/immutable; status marks immutable on ISSUED-or-beyond |
| Invalid document transitions throw | ✅ | `transitionDocumentStatus` throws; Vitest covers DRAFT→ISSUED |
| APPROVED ≠ ISSUED foundations | ✅ | Distinct statuses + transition table; domain contract flags |
| Thin API/UI stubs | ✅ | proposal-requests / proposals / quotations / commercial routes + CrmStubView pages |
| Demo handoff → PRQ; Opp readiness seeds request only | ✅ | `emitDemoProposalHandoff` seeds PRQ (`skipProposalRequest` opt-out); readiness seeds only when `seedProposalRequest: true`; `proposalCreated` stays false until convert |
| hasCrm*Model + SQL fallback script | ✅ | Guards return UNAVAILABLE; `scripts/sql/crm-commercial-phase15-wave1.sql` present |
| No tenant Quotation alias; no Opp auto-mutation | ✅ | Domain WRONG_DOMAIN; no `crmOpportunity.update` in commercial; convert asserts `opportunityMutated: false` |
| No Price Book / PDF / delivery / acceptance | ✅ | Out of scope; not shipped |
| No git commit | ✅ | WORKING_TREE |
| Vitest Wave 1 PASS (claim) | ✅ | Was 6/6; now 7/7 after fix wave |

### Issues (initial — Important now resolved)

#### Critical (Must Fix)

_None._

#### Important (Should Fix) — resolved in re-review

1. **`rejectProposalRequest` bypasses request transition table** — **RESOLVED** (see RE-REVIEW).
2. **`convertProposalRequest` does not append request status history** — **RESOLVED** (see RE-REVIEW).

#### Minor (Nice to Have)

See residual list in RE-REVIEW (6 remaining; prior #7 closed).

### Initial assessment (superseded)

Wave 1 spine met acceptance; quality was **not** approved until request reject honored the transition table and convert wrote status history. Those are now fixed — see RE-REVIEW verdict above.

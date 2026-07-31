# Task 1 Review — Phase 20 Wave 1 (RE-REVIEW AFTER FIX)

**Reviewer:** SDD review subagent  
**Date:** 2026-07-31  
**Mode:** READ-ONLY (this review file only)  
**Scope (LIVE):** `prisma/schema.prisma` `CrmCommercialAcceptance`; `lib/admin/crm/commercial/{readiness,acceptance,model}.js`; `opportunities/close.js`; `conversions/readiness.js`; `scripts/sql/crm-commercial-phase20-wave1.sql`; `test/systemAdmin.crm.conversionPhase20Wave1.test.js`  
**Vitest (LIVE):** `npx vitest run test/systemAdmin.crm.conversionPhase20Wave1.test.js` → **14/14 PASS**

## Focus checklist (LIVE re-verify)

| Focus | Result |
|-------|--------|
| `authorityStatus` in schema | **PASS** — `CrmCommercialAcceptance.authorityStatus` `@default("UNKNOWN")` + index; SQL fallback `crm-commercial-phase20-wave1.sql`; accept path refuses if field unavailable; create persists `VERIFIED` |
| Close gate | **PASS** — `resolveClosedWonAcceptanceId` from `acceptanceId` **or** `ACCEPTANCE` / `COMMERCIAL_ACCEPTANCE` evidence; readiness not opt-in-only |
| Discount PENDING-only | **PASS** — `isPendingUnapprovedDiscount`: REJECTED/CANCELLED/APPROVED do not block; PENDING/blank do |
| SoD at readiness | **PASS** — `violatesDiscountApprovalSod` blocks APPROVED when missing approver or requester===approver (`discount_approval_sod`) |
| Discount query | **PASS** — production `findMany({ where: { documentVersionId } })`; Wave 1 mock implements real `OR` + `documentVersionId` filter; test asserts scoped where (no silent all-rows) |

## Prior issues — disposition

### Critical (was 1) — resolved
1. ~~`authorityStatus` not in Prisma schema~~ → **FIXED** (schema + SQL + runtime guard + persist test).

### Important (was 4) — resolved
1. ~~Close commercial gate opt-in~~ → **FIXED** (evidence→acceptanceId).
2. ~~REJECTED/CANCELLED blocked READY~~ → **FIXED** (PENDING/open only).
3. ~~SoD not re-validated at readiness~~ → **FIXED**.
4. ~~Discount `findMany` mock ignored `OR`~~ → **FIXED** (mock + production query + assertions).

## Remaining notes (non-blocking)

### Minor
1. Close retry still `ok: false` + `ALREADY_TERMINAL` + `idempotent: true` — acceptable per G20-07 Wave 2 deepen.
2. `HANDED_OFF` short-circuit may skip re-check of current version expiry/supersede.
3. Comment on “unrecognized open status” vs code (only PENDING/blank block); catalogue has only PENDING/APPROVED/REJECTED/CANCELLED — no practical gap.

## Assessment

**Approved with notes**

All prior Critical/Important findings are fixed in LIVE code; Wave 1 Vitest 14/14 green. Residual items are Minor / Wave-2 deepen only. SDD review gate clear for Wave 2.

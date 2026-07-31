# Phase 15 Final Review — Commercial Documents

**Head:** `WORKING_TREE` (no commits since base `7d9709a`; dirty with Phases 7–15)  
**Scope:** Phase 15 CRM Commercial Documents (Approach B Waves 0–4)  
**Spec / plan:** `docs/superpowers/specs/2026-07-31-commercial-documents-phase-15-design.md` · `docs/superpowers/plans/2026-07-31-commercial-documents-phase-15.md`  
**Progress:** `.superpowers/sdd/progress-phase15.md`  
**Review package:** `.superpowers/sdd/phase15-final-review-package.diff`  
**Claimed exit:** `READY_FOR_PHASE_16_WITH_BLOCKERS` (`docs/admin-intelligence-crm/phase-15/FINAL_READINESS_DECISION.md`)  
**Prior task reviews:** P15-T0…T4 all **Approved** (T1–T3 after Important fix waves)  
**Mode:** Read-only whole-phase review (this file is the only write); Vitest **not** re-run (controller claim **35/35** accepted)  
**Date:** 2026-07-31  

---

## Verification (controller claim — not re-run)

```bash
npx vitest run \
  test/systemAdmin.crm.commercialWave1.test.js \
  test/systemAdmin.crm.commercialWave2.test.js \
  test/systemAdmin.crm.commercialWave3.test.js \
  test/systemAdmin.crm.commercialWave4.test.js
```

**Controller result (accepted):** Tests **35** passed (35) · Wave1 7 + Wave2 11 + Wave3 10 + Wave4 7.  
Source case counts match claims. This final review did not re-execute the suite.

---

## Hard rules matrix

| # | Rule | Status | Evidence |
|---|------|--------|----------|
| 1 | Proposal ≠ Quotation ≠ Contract ≠ Invoice | ✅ Pass | Distinct `CrmProposal` / `CrmQuotation` extensions on `CrmCommercialDocument`; domain contract |
| 2 | Acceptance ≠ Closed Won ≠ Subscription ≠ Tenant provision | ✅ Pass | `acceptCommercialDocument` returns `closedWon: false`; readiness/handoff honesty flags |
| 3 | Quoted MRR/ARR/TCV ≠ contracted / Revenue | ✅ Pass | Currency-explicit totals labels; reports invent-zeroes forbidden |
| 4 | Issued immutable; accept binds version+artifact+checksum+recipient+authority | ✅ Pass | `versions.js` throws on issued mutate; acceptance checksum + `evaluateAcceptanceAuthority` fail-closed |
| 5 | Price Book line identity + snapshots | ✅ Pass | Wave 2 pricing + immutable ACTIVE books; snapshot by idempotency key |
| 6 | No silent FX; no fabricated commercial evidence | ✅ Pass | `currencyFx.js` → `FX_CONTEXT_MISSING`/`STALE`; same-currency `rate:1` only |
| 7 | APPROVED ≠ ISSUED ≠ DELIVERED ≠ VIEWED ≠ ACCEPTED | ✅ Pass | Discrete status machine + issue/delivery/view/accept services |
| 8 | Material change → new version / invalidate approvals | ⚠️ Partial | Helper `applyMaterialDocumentChange` + Vitest; **content update path does not auto-call** (Minor carry) |
| 9 | SoD on protected discounts/exceptions/approvals | ✅ Pass | T2 Important fixes: DB-only discount/exception approval; self-approve blocked |
| 10 | Customer-safe projections | ✅ Pass | `projectContentForAudience`; customer GET uses ISSUED |
| 11 | Gate fail → never false zero | ✅ Pass | metrics/reports/DQ/recon → `value: null` + `inventZeroesForbidden` |
| 12 | Phase 16 handoff creates nothing | ✅ Pass | `rejectProvisionFlags`; serialize `*Created: false`; no Customer/Tenant/Subscription/Invoice create |
| 13 | No Opp auto-mutation | ✅ Pass | No `crmOpportunity.update` under commercial; handoff comment + Wave4 test |
| 14 | E-sign NOT_CONFIGURED | ✅ Pass | `signatureBoundary.js` constant; Wave4 honesty case |
| 15 | Tenant Quotation = WRONG_DOMAIN | ✅ Pass | CRM `quotations.js` / catalogue; no alias to `app/quotations` / tenant models |
| 16 | No AI commercial fabrication | ✅ Pass | Out of scope; no AI pricing/proposal surfaces started |

---

## Wave / surface coverage (WORKING_TREE)

| Wave | Delivered | Notes |
|------|-----------|--------|
| 0 | Forensic pack + CONDITIONAL GO under `docs/admin-intelligence-crm/phase-15/` | T0 Approved; thin matrices Minor |
| 1 | PRQ + CrmCommercialDocument spine; PROP/QUO; numbering; status; Demo/Opp seed | T1 Approved after transition/history fixes; SQL wave1 |
| 2 | Price Books + calculate + tax/FX + discounts/exceptions + approvals/SoD | T2 Approved after discount/exception/inclusive-tax fixes; 11 tests |
| 3 | Templates/PDF/checksum/issue/delivery/review/accept/reject/expiry/e-sign boundary | T3 Approved after token-bound accept + expiresAt + authority fixes; 10 tests |
| 4 | Thin hubs; reports/schedules; DQ/recon; Closed-Won readiness; Phase 16 handoff + exit pack | T4 Approved; exit `READY_FOR_PHASE_16_WITH_BLOCKERS` |

Libraries: ~45 files under `lib/admin/crm/commercial/*` (requests → phase16Handoff / reports / reliabilityGate).  
SQL: `scripts/sql/crm-commercial-phase15-wave{1..4}.sql`.  
UI: thin stubs under `/insightbooks/crm/{commercial,proposal-requests,proposals,quotations,price-books,customer-commercial-review,…}`.  
Exit docs: `FINAL_PHASE_15_REPORT.md`, `FINAL_READINESS_DECISION.md`, `PHASE_16_INPUTS.md`, `PHASE_16_READINESS_CHECKLIST.md`.

---

## Findings

### Critical / P0

_None._

### Important / P1

_None new at whole-phase level._ In-wave Importants (T1 transition/history; T2 discount/exception/inclusive tax; T3 token/expiry/authority) were fixed and re-approved before this gate. Spot-check confirms fixes remain in source.

### Ordinary / P2

_None that reopen hard-rule exit._ Residual risks below are Minor with triage.

### Low / P3 — Minor carry triage

| Item | Source | Before Phase 16? | Disposition |
|------|--------|------------------|-------------|
| **`acceptanceId` not unique on handoff** | T4 | **Yes — early P16** | App `findFirst` mitigates sequential dupes; concurrent distinct keys can emit two payloads. Add `@@unique([acceptanceId])` (or fail-closed) **before conversion consumes handoffs**. Does not block exit. |
| **Material invalidation opt-in** | T2 | **Yes — early P16 / before production issue** | Wire `updateDocumentVersionContent` (and pricing path) → `applyMaterialDocumentChange`, or require new version after APPROVED. Spec-aligned hardening; helper+test exist. |
| Tax rate from caller `taxContext` (models unused) | T2 | Defer | Harden when tax-rule productization lands |
| Tax `overrideApproved` bare boolean | T2 | Defer | Documented stub strength |
| Annual recurring label / TCV seed polish | T2 | Defer | Label honesty; not hard-rule break |
| Multi-create not one transaction | T1 | Defer | Orphan/number burn race; ops polish |
| Demo/Opp PRQ seed `catch {}` | T1 | Defer | Log/surface without fabricating |
| BOTH / `createQuotation: false` asymmetry | T1 | Defer | Document intentional or align |
| `tokenPlain` column on review access | T3 | Defer (prefer before public review prod) | Prefer omit/encrypt; create path nulls it |
| Expiry job delivery-`validUntil`-only | T3 | Defer | Access `expiresAt` already gates accept |
| Hand-rolled PDF layout incomplete | T3 | Defer | Checksum-stable spine OK |
| EMAIL delivery without SMTP send | T3 | Defer | Honest evidence; no fabricated mail |
| Thin commercial hubs | T4 | Defer | Intentional Wave 4; services SoT |
| `resolveCrmScope` `all` stub | T4 / prior | Defer | Documented carry blocker |
| Prisma generate / Windows EPERM | T1–T4 | Defer (known blocker) | SQL + `hasCrm*Model` continue |
| UI stub i18n raw keys | T1–T2 | Defer | Polish |
| Schema diff noise / commit hygiene | T1 | Defer | Isolate commercial hunks when committing |
| Wave 0 thin matrices / package mojibake / dirty-tree note | T0 | Defer | Docs hygiene only |

---

## Spec / plan alignment

Approach B Waves 0–4 match the design and plan: forensic CONDITIONAL GO → PRQ + shared commercial spine → Price Books/pricing/tax/FX/discounts/approvals → PDF/issue/delivery/customer review/acceptance with e-sign boundary → hubs/reports/DQ/recon/Closed-Won readiness/Phase 16 handoff payloads + exit pack.

Exit claim `READY_FOR_PHASE_16_WITH_BLOCKERS` matches locked expectation (e-sign NOT_CONFIGURED, thin UI, scope stub, EPERM, no provision). Plan Task checkboxes may still show `[ ]` (docs hygiene only — same class as Phase 14).

---

## Spec / exit assessment

Phase 15 delivers a trustworthy commercial-document plane: versioned PROP/QUO spine, deterministic pricing with fail-closed FX, SoD-backed approvals (post-fix), checksummed artifacts, token-bound acceptance with authority/expiry gates, Closed-Won readiness, and Phase 16 handoff payloads that create nothing and never auto-mutate Opportunity.

P3 carry items do **not** reopen handoff-as-create, Opp auto-mutation, silent FX, acceptance-without-checksum, e-sign fabrication, tenant Quotation reuse, or false report zeroes. They do not invalidate `READY_FOR_PHASE_16_WITH_BLOCKERS`.

**Must-address early Phase 16 (not exit blockers):** handoff `acceptanceId` uniqueness; material-change → approval invalidation wiring before production issue/conversion.

---

## Overall verdict

**Phase quality:** Approved  

**Exit `READY_FOR_PHASE_16_WITH_BLOCKERS`:** **Confirmed** — hard rules held under whole-phase spot-check; Waves 0–4 surfaces + exit pack present; controller Vitest **35/35**; known blockers explicit.  

**Findings:** Critical **0** · Important **0** · Minor **~20** (carry; triage above)  

**Review path:** `.superpowers/sdd/phase15-final-review.md`

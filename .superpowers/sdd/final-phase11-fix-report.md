# Final Phase 11 Fix Report — P2 in-scope items

**Date:** 2026-07-30  
**Source review:** `.superpowers/sdd/final-phase-11-review.md`  
**Scope:** Phase 11 foundation Important/P2 items only (no commit)

---

## Fixed

### 1. QUALIFIED fail-closed (`lib/admin/crm/qualification/evaluate.js`)

**Before:** `assertLeadQualificationForQualifiedStatus` returned `{ ok: true, skipped: true }` when `crmQualificationResponse.findMany` was missing; load errors fell through to empty responses (could still block via INCOMPLETE, but model-missing was fail-open).

**After:**
- Missing response model → `{ ok: false, error: 'QUALIFICATION_UNAVAILABLE', status: 'UNAVAILABLE' }`
- `findMany` throw → same `QUALIFICATION_UNAVAILABLE` (reason `qualification_responses_load_failed`)
- Present model + incomplete responses → unchanged `QUALIFICATION_INCOMPLETE`

Override path unchanged (still requires permission + reason).

**Tests:** `test/systemAdmin.crm.qualification.test.js` — fail-closed model-missing + load-fail cases.  
`test/systemAdmin.crm.leads.test.js` — happy-path QUALIFIED steps seed qualifying responses (fixture no longer relied on soft-skip).

### 2. Public capture consent snapshot (`lib/admin/crm/capture.js`)

**Before:** Non-empty client `consentPurposes` set capture `consentStatus = GRANTED` (including off-catalogue strings like `SALES_FOLLOW_UP`); no evidence / no `CrmConsentRecord`.

**After:**
- Capture snapshot **always** `UNKNOWN` for public intake checkbox arrays
- Purposes filtered to `CRM_CONSENT_PURPOSE` catalogue and stored as interest flags only (`consentPurposes`)
- Off-catalogue strings dropped
- Legal `GRANTED` remains Wave 3 `recordConsent` path (purpose + source/evidence + contact)

**Tests:** `test/systemAdmin.crm.capture.test.js` — UNKNOWN retained; allowlist interest only.

---

## Documented only (not fixed this pass)

| Item | Disposition |
|------|-------------|
| Owner scope `mode: 'all'` (`resolveCrmScope` stub) | **Accepted Phase 12 blocker** — list/export still see all leads for any `viewLeads` holder. Do not ship multi-rep CRM until real owner/team/territory filters land. |
| `editLeads` permission bundling (transition / qualify / score / consent / assign / merge-request) | **Note only** — fine-grained perms exist but runtime ORs with `editLeads`. No trivial split stub present; tighten before broader CRM roles. SoD at `canApproveMerge` remains merge-only. |
| Dirty-tree isolation (~1020 paths) | **Commit hygiene** — isolate CRM Phase 11 paths at commit time; out of scope for this fix pass. |

---

## Residual (unchanged P3 / blockers)

In-process throttle, handoff `@crm.internal`, lead create FK / non-transactional status+history, no HTTP route tests — unchanged from final review.

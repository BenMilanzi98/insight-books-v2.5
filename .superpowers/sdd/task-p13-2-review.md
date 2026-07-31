# Task P13-2 Review — Wave 2 Calls + Email (SMTP) + email templates foundations

**Mode:** RE-REVIEW (after Important fix: outbound Contact required before eligibility/SMTP)  
**Prior:** REVIEW → **Needs fixes** (Important #1: outbound Call/Email skipped eligibility when `contactId` omitted)  
**Head:** `WORKING_TREE` (no commit, per brief)  
**Diff:** `.superpowers/sdd/task-p13-2-review-package.diff` (+ post-review Contact-gate fixes in working tree)  
**Brief / report:** `task-p13-2-brief.md` / `task-p13-2-report.md`  
**Read-only** (spec compliance + code quality; vitest re-run)  
**Date:** 2026-07-30  

**Vitest (re-run):**  
- `activityWave2` + `activityWave1` → **2 files, 18/18 passed**

---

### Prior Important #1 — disposition

| Finding | Status | Evidence |
|---------|--------|----------|
| Outbound Call/Email skip eligibility when `contactId` omitted | **Fixed** | `requireOutboundContact` in `lib/admin/crm/calls/service.js` and `lib/admin/crm/emails/service.js`: missing id → `CONTACT_REQUIRED`; Contact model present but unresolved → `CONTACT_IDENTITY_UNRESOLVED`. Wired into `planCall` / `logManualCall` / `completeCall` (OUTBOUND only) and `requestEmailSend` (always before eligibility/SMTP). INBOUND Call may still omit Contact. |
| Tests for omitted-`contactId` fail-closed | **Fixed** | Wave 2: outbound plan/log/complete without contact → `CONTACT_REQUIRED`, no `crmCall.create` / status stays PLANNED; Email send without contact → `CONTACT_REQUIRED`, `smtpCalled: false`, `sendFn` not called, no send-request create. |

---

### Spec Compliance

| Criterion | Status | Notes |
|-----------|--------|-------|
| Call Activity link fail-closed | ✅ | Unchanged; Activity create failure blocks Call create (tested). |
| No future Call logged as completed | ✅ | `future_call_cannot_be_completed` on log/complete. |
| DNC enforced (when contact present) | ✅ | Outbound + Contact → `checkCommunicationEligibility` (CALL + DNC). |
| Telephony / recording NOT_AVAILABLE | ✅ | Serialize never fabricates connect/recording. |
| Email send-request idempotent | ✅ | Exact key retry returns existing; `sendFn` not re-invoked. |
| Accept ≠ delivered | ✅ | SMTP SENT / ACCEPTED_BY_PROVIDER / FAILED only; `delivered: false`. |
| No fabricated opens / replies | ✅ | Null opens/replies; honesty flags false. |
| No tracking pixels | ✅ | `CRM_EMAIL_TRACKING_PIXELS_ENABLED = false`. |
| Eligibility before outbound; UNKNOWN ≠ granted; Contact required | ✅ | Outbound Call plan/log/complete and Email SMTP require Contact first, then eligibility; UNKNOWN/DENIED/DNC block with no SMTP; omitted contact fail-closed (tested). |
| No Meetings / Calendar this task | ✅ | Still out of scope. |
| Vitest Wave 2 claimed PASS | ✅ | Re-run **18/18** (Wave 2 + Wave 1). |
| Required interfaces | ✅ | Same surface as prior review. |
| Prisma + SQL + model guards | ✅ | Unchanged. |
| APIs + thin UI stubs | ✅ | Routes delegate to gated services. |
| No git commit | ✅ | Per brief/report. |

---

### Verify checklist (detailed)

1. **Call Activity fail-closed; no future-as-completed; DNC; telephony/recording NOT_AVAILABLE** — Still solid. Outbound now **always** resolves Contact before eligibility; INBOUND may omit Contact.
2. **Email SMTP idempotent; accept ≠ delivered; no fabricated opens/replies; no pixels** — Unchanged honesty. Send path gates Contact → eligibility → SMTP.
3. **Eligibility before outbound; UNKNOWN ≠ granted; Contact required** — Prior Important closed. Draft without `contactId` remains allowed; **send** fails closed (`CONTACT_REQUIRED`, `smtpCalled: false`).
4. **No Meetings / Calendar** — Confirmed.
5. **Vitest Wave 2 PASS** — **18/18** re-confirmed.

---

### Strengths

- Contact gate is shared-shaped on Calls and Emails (`requireOutboundContact`) with clear error codes.
- Legacy/seeded outbound PLANNED Call without contact cannot complete-as-connected.
- Consent-blocked and missing-contact paths both keep `smtpCalled` / `sendFn` false.
- Wave 2 tests grew to cover the Important scenario without weakening prior honesty coverage.

---

### Issues

#### Critical (Must Fix)

_None._

#### Important (Should Fix)

_None._ (Prior Important #1 fixed and verified.)

#### Minor (Nice to Have)

1. **Activity + child not one transaction** — Same Wave 1 pattern; orphan Activity + burned numbers possible on child create failure.
2. **Stuck send-request retry** — Idempotent lookup returns any existing row for the key (including `REQUESTED`) without re-attempting SMTP.
3. **Prisma generate not run** — Report concern; model guards + SQL mitigate EPERM.
4. **UI hubs are stubs** — Expected; APIs live.
5. **Pixel strip regex is best-effort** — Foundations rely on flag off more than HTML sanitization.
6. **`CONTACT_IDENTITY_UNRESOLVED` untested in Wave 2** — Code path exists when Contact model is present; Wave 2 harness omits `crmContact`, so only `CONTACT_REQUIRED` is exercised. Optional follow-up test only.

---

### Acceptance checklist (brief)

- [x] Call numbers; planned + manual log; DNC; no fabricated connect/recording
- [x] Email draft → eligibility → SMTP send-request; retries idempotent
- [x] Accept ≠ delivered; no fabricated replies; no tracking pixels
- [x] Each Call/Email linked to CrmActivity; fail-closed on Activity failure
- [x] **Outbound eligibility always enforced (contact required)** — prior Important closed
- [x] Vitest PASS (Wave 2 + Wave 1) — 18/18
- [x] No Meetings / Calendar

---

### Assessment

Prior Important (outbound without `contactId` skipping eligibility/SMTP) is fixed: Calls and Emails require a Contact before eligibility evaluation and before SMTP/complete-as-connected; omitted contact fail-closed is covered by Wave 2 tests; vitest re-run is 18/18. Remaining items are minor/non-blocking. Ready to proceed.

**Task quality:** Approved

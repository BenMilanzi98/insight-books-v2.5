# Task P11-2 Report — Wave 2 Public capture + handoffs → Lead + duplicate candidates

**Branch:** `v2`  
**Workspace:** in-place WORKING_TREE (no git commit)  
**Date:** 2026-07-30  
**Status:** COMPLETE (acceptance criteria met; Vitest green)

## Summary

Implemented Phase 11 Wave 2 idempotent Lead capture for public forms and CS/Support/Product handoff intake, plus duplicate-candidate detect/list/review (no auto-merge). Wired existing `/api/contact/demo-request` to persist a Lead before email send; added dedicated `/request-demo`, `/start-trial`, `/sales-enquiry` pages + APIs. EMAIL/WHATSAPP ingest remains `NOT_AVAILABLE`. Wave 1 CRM tests still pass.

## Deliverables

| Area | Path / change |
|------|----------------|
| Capture service | `lib/admin/crm/capture.js` |
| Duplicate candidates | `lib/admin/crm/duplicates.js` |
| Handoff intake | `lib/admin/crm/handoffIntake.js` |
| Public API helper | `lib/admin/crm/publicFormApi.js` |
| Catalogue / authz / index | `lib/admin/crm/catalogue.js`, `authz.js`, `index.js`; `leads.js` capture mode + P2002 replay |
| Prisma | `CrmCaptureRecord`, `CrmDuplicateCandidate` (+ Admin/Lead relations) |
| SQL fallback | `scripts/sql/crm-core-phase11-wave2.sql` |
| Contact wire | `app/api/contact/demo-request/route.js` → `captureLead` then email |
| Public pages/APIs | `app/request-demo`, `app/start-trial`, `app/sales-enquiry` + matching `/api/*` |
| Admin APIs | `app/api/admin/crm/duplicates` (GET list / POST review), `app/api/admin/crm/handoff-intake` |
| UI form | `components/crm/PublicLeadCaptureForm.js` (honeypot `website`) |
| Tests | `test/systemAdmin.crm.capture.test.js`, `test/systemAdmin.crm.duplicates.test.js` |

## Capture rules (implemented)

- Required field validation; free-text sanitize; `normalizeEmail` / `normalizePhone`
- Stable `sourceIdempotencyKey`; exact retries → existing Lead (`idempotent: true`)
- Distinct source codes: `WEBSITE_CONTACT_FORM`, `REQUEST_DEMO`, `START_TRIAL`, `SALES_ENQUIRY`, `CUSTOMER_SUCCESS_HANDOFF`, `SUPPORT_HANDOFF`, `PRODUCT_SIGNAL`
- Channels: public `WEB_FORM`; handoffs `INTERNAL_HANDOFF` (both `AVAILABLE`). `EMAIL` / `WHATSAPP` → `NOT_AVAILABLE`
- Public callers cannot set owner/team/priority (`capture: true` forces `ownerAdminId: null`; no Account/Contact auto-link)
- Spam guards: payload size (`CRM_CAPTURE_MAX_PAYLOAD_BYTES`), honeypot (`website` / `companyUrl` / `hp_field`), process-local email throttle (8/60s) — documented in `publicFormApi.js` (no existing Next middleware reused)
- Consent: `UNKNOWN` unless explicit `consentPurposes[]`; never inferred from email/phone alone
- Account/Contact **candidates** returned as suggestions only

## Handoffs

- `intakeHandoffAsLead` reads `CsExpansionHandoff` / `SupportHandoff` (PRODUCT may reuse support handoff id or synthetic ref)
- Creates Lead with `EXPANSION` type; links via capture `handoffRefType` / `handoffRefId` + payload tenant/feature
- Exact retry on same handoff identity → same Lead
- **Does not** call update on handoff / case / ticket / subscription

## Duplicates

- Detect: same normalized email, phone, handoff ref; optional low-confidence `DOMAIN` (never auto-merge)
- States: `NEW`, `UNDER_REVIEW`, `LIKELY_DUPLICATE`, `CONFIRMED_DUPLICATE`, `CONFIRMED_DISTINCT`
- Review API requires `editLeads` (or createLeads / Super Admin); records status + reason + `reviewedByAdminId` / `reviewedAt`
- List requires `viewLeads` (or view / Super Admin)

## Acceptance checklist

- [x] Idempotent capture (exact retries return existing Lead)
- [x] Distinct source codes per form/handoff
- [x] Email/WhatsApp marked NOT_AVAILABLE
- [x] No auto-merge; duplicate candidates only
- [x] Vitest PASS (+ Wave 1 CRM tests still green)

## Test summary

```
npx vitest run test/systemAdmin.crm.capture.test.js \
  test/systemAdmin.crm.duplicates.test.js \
  test/systemAdmin.crm.leads.test.js

Test Files  3 passed (3)
Tests       25 passed (25)
```

| File | Coverage |
|------|----------|
| `systemAdmin.crm.capture.test.js` | channel availability; EMAIL/WA reject; public capture; idempotency; ignore owner; consent; honeypot/size; candidate suggest; CS/Support/Product intake without mutation |
| `systemAdmin.crm.duplicates.test.js` | email/phone candidates; no auto-merge; domain non-merge; list/review authz + reason; detect idempotency |
| `systemAdmin.crm.leads.test.js` | Wave 1 regression (unchanged green) |

## Self-review

### Strengths
- Capture path separated from admin `createLead` via `capture: true` (authz bypass + channel/owner rules) without breaking Wave 1 admin create
- P2002 on `sourceIdempotencyKey` treated as idempotent replay
- SQL + `hasCrmCaptureRecordModel` / `hasCrmDuplicateCandidateModel` guards for EPERM generate failures
- Hard domain boundaries preserved (no Opportunity, no CS/Support mutation, no inferred consent)

### Concerns / follow-ups
1. **Prisma generate** — schema updated; if Windows EPERM blocks generate, apply `scripts/sql/crm-core-phase11-wave2.sql` and rely on model guards until generate succeeds.
2. **Handoff synthetic email** — when handoff lacks email/phone, capture uses `handoff+…@crm.internal` solely for identity/idempotency; not a real contact address.
3. **Domain duplicate match** — uses Prisma `endsWith` on email; may be sparse in mocks/DB without partial indexes; LOW confidence only.
4. **Process-local throttle** — not multi-instance safe; adequate Wave 2 baseline.
5. **Contact `/contact` vs `/request-demo`** — contact demo-request uses `WEBSITE_CONTACT_FORM`; dedicated demo page uses `REQUEST_DEMO` (intentional distinct codes).

### Explicitly out of scope (deferred)
- Email/WhatsApp ingest producers
- Auto-merge / merge SoD (Wave 4)
- Opportunity create, scoring, qualification engines
- Full consent/DNC eligibility service (Wave 3)

## WORKING_TREE note

No git commit created (per brief). Changes remain in the working tree on branch `v2`.

## Fix pass

**Date:** 2026-07-30  
**Status:** FIXED (P2s + cheap P3s)  
**Commit:** none (WORKING_TREE only)

### Fixes applied

1. **[P2] Public client `sourceIdempotencyKey` no longer overrides identity** — `buildIdempotencyKey` always derives `crm-capture:${sourceCode}:${email}|${phone}` (or handoff ref). Client keys ignored in `captureLead`; public routes (`publicFormApi.js`, `demo-request/route.js`) no longer forward them.
2. **[P2] Idempotent replay before throttle** — `loadExistingByKey` runs before `checkThrottle`; exact retries return existing Lead with `idempotent: true` even when the email bucket is exhausted.
3. **[P3] `SOURCE_IDENTITY`** — `detectDuplicateCandidates` now emits `SOURCE_IDENTITY` when another capture shares the same `sourceCode` and overlapping email/phone; `sourceCode` passed from `captureLead`.
4. **[P3] CRCRLF** — normalized `capture.js`, `duplicates.js`, `handoffIntake.js`, `index.js` (`\r\r\n` → `\n`).

### Tests added

- Client-minted keys for same email+source → one Lead (server-derived key)
- After throttle exhaustion, exact replay of first capture still succeeds (`idempotent: true`)

### Verification

```
npx vitest run test/systemAdmin.crm.capture.test.js \
  test/systemAdmin.crm.duplicates.test.js \
  test/systemAdmin.crm.leads.test.js

Test Files  3 passed (3)
Tests       27 passed (27)
```

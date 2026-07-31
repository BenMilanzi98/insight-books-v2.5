# Task P13-2 Report — Wave 2 Calls + Email (SMTP) + email templates foundations

**Status:** DONE_WITH_CONCERNS  
**Date:** 2026-07-30  
**Branch:** v2 WORKING_TREE  
**Commit:** none (per brief)

## Acceptance

| Item | Result |
|------|--------|
| Call numbers; planned + manual log; DNC enforced; no fabricated connect/recording | PASS |
| Email draft → eligibility → SMTP send-request; retries idempotent | PASS |
| Accept ≠ delivered; no fabricated replies; no tracking pixels | PASS |
| Each Call/Email linked to CrmActivity; fail-closed on Activity failure | PASS |
| Vitest PASS (Wave 2 + Wave 1) | PASS |

## Interfaces delivered

- `allocateCallNumber`, `planCall`, `logManualCall`, `completeCall`, `listCalls`
- `getTelephonyProviderContract` / `getCallRecordingStatus` → `NOT_AVAILABLE`
- `createEmailDraft`, `evaluateEmailSendEligibility` / `evaluateEmailEligibility`, `requestEmailSend` (idempotent), `listEmailActivities`
- `sendCrmSmtpMail` adapter → `ACCEPTED_BY_PROVIDER` / `SENT` / `FAILED` (never invents `DELIVERED`)
- Template foundations: `createEmailTemplateVersion`, `getActiveEmailTemplate`, `renderEmailTemplateSafe` (allowlisted `{{var}}` only)

## Files (primary)

**Lib**
- `lib/admin/crm/calls/*` — catalogue, numbering, model, service, index
- `lib/admin/crm/emails/*` — catalogue, model, templates, smtpAdapter, service, index
- Extended: `catalogue.js`, `activities/create.js`, `activities/catalogue.js`, `foundations.js`, `index.js`, `crmNav.js`, `permissions.js`

**Prisma / SQL**
- `prisma/schema.prisma` — `CrmCall`, `CrmEmailActivity`, `CrmEmailSendRequest`, `CrmEmailDeliveryEvent`, `CrmEmailTemplate`
- `scripts/sql/crm-activity-phase13-wave2.sql`

**APIs**
- `app/api/admin/crm/calls/` (+ `[id]/complete`)
- `app/api/admin/crm/emails/` (+ `[id]/send`, `eligibility`)

**UI (thin stubs)**
- `/insightbooks/crm/calls`, `/emails`, `/emails/compose`
- en/ny locale keys (`admin-pages`, `admin-shell`)

**Tests**
- `test/systemAdmin.crm.activityWave2.test.js` (new)

## Tests run

```text
npx vitest run test/systemAdmin.crm.activityWave2.test.js test/systemAdmin.crm.activityWave1.test.js
→ 2 files, 18 tests PASS
```

## Self-review

- Manual/planned Calls only; `telephonyConnected: false` always; recording `NOT_AVAILABLE`.
- Future `completedAt` blocked (`future_call_cannot_be_completed`).
- Outbound Call/Email eligibility + DNC persisted; UNKNOWN ≠ granted; consent-blocked → no SMTP.
- SMTP mapping honesty: accept/sent/failed only; `delivered: false` unless evidence path (not invented this wave).
- No tracking pixels (`CRM_EMAIL_TRACKING_PIXELS_ENABLED = false`); opens/replies null.
- Call/Email create fail-closed when Activity create fails (no orphan children when Activity model present).
- CRM Email Activity distinct from Support threads / transactional `lib/emailService` templates.

## Concerns (non-blocking)

1. **Prisma client generate not run** — schema + SQL shipped; Windows EPERM may require SQL apply + `hasCrm*Model` guards (already used).
2. **UI hubs are stubs** — Calls/Emails/compose use `CrmStubView`; APIs are live.
3. **SMTP in tests** — injectable `sendFn`; production uses nodemailer + `EMAIL_*` env (same stack as `lib/email.js`).
4. **Meetings / Calendar / ICS** — correctly out of scope for Wave 2.

## Not done (explicit)

- Git commit
- Wave 3 Meetings / Calendar
- Live telephony, Google/Outlook sync, reminders/automation/reports, AI content

## Post-review fixes

**Finding:** Outbound Call `planCall` / `logManualCall` / `completeCall` and Email `requestEmailSend` skipped eligibility when `contactId` was omitted, allowing SMTP/completion without Contact/consent/DNC.

**Fix:** Outbound Call and Email send paths now require a resolvable Contact before eligibility / SMTP / complete-as-connected. Missing `contactId` → `CONTACT_REQUIRED`; Contact model present but unresolved → `CONTACT_IDENTITY_UNRESOLVED`. INBOUND Call may still omit Contact. Eligibility is always evaluated for outbound once Contact is present.

**Tests:** Wave 2 covers omitted-`contactId` fail-closed for outbound Call plan/log/complete and Email send (`smtpCalled: false`, no Call completed / no send request).

```text
npx vitest run test/systemAdmin.crm.activityWave2.test.js test/systemAdmin.crm.activityWave1.test.js
→ 2 files, 18 tests PASS
```

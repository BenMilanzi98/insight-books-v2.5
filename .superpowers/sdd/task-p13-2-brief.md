### Task 2: Wave 2 — Calls + Email (SMTP) + email templates foundations

**Depends on:** Wave 1 CrmActivity spine + Task/Follow-Up (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/crm/calls/` — catalogue, numbering (`CALL-YYYY-######`), plan/log/complete; direction; outcomes; DNC/eligibility; telephony boundary NOT_AVAILABLE; recording NOT_AVAILABLE
- `lib/admin/crm/emails/` — draft, eligibility, send-request (idempotent), SMTP adapter via `lib/email.js` / `lib/emailService.js`, delivery events; accept ≠ delivered; no fabricated opens/replies; no tracking pixels
- Email template foundations (versioned codes; no executable template expressions)
- Link each Call/Email to parent `CrmActivity` (types CALL / EMAIL); fail-closed if Activity create fails (match Task Wave 1)
- Prisma + `scripts/sql/crm-activity-phase13-wave2.sql`
- APIs under `app/api/admin/crm/calls/**`, `emails/**`
- UI thin hubs: `/insightbooks/crm/calls`, `/emails` (+ compose stub)
- Tests: `test/systemAdmin.crm.activityWave2.test.js` (+ Wave 1 green)

**Do NOT:** Meetings, Calendar, ICS, Google/Outlook sync, live telephony, reminders/automation/reports, AI content, git commit.

## Rules

- Manual/planned Calls only; no future Call logged as completed
- Connected ≠ fabricated; recording always NOT_AVAILABLE this wave
- Telephony provider contract status NOT_AVAILABLE (typed boundary)
- Email send server-side only; exact retries return existing send request
- SMTP accept → ACCEPTED_BY_PROVIDER / SENT / FAILED — never invent DELIVERED/opens/replies without evidence
- Eligibility + DNC before outbound Call/Email; UNKNOWN consent ≠ granted; persist decision
- Consent-blocked → no provider/SMTP call
- Activity ≠ Audit ≠ Analytics; never alias Support email threads as CRM Email Activity

## Interfaces (produce)

- `planCall`, `logManualCall`, `completeCall` (idempotent where applicable)
- `createEmailDraft`, `evaluateEmailSendEligibility` (or reuse eligibility), `requestEmailSend` (idempotent)
- Foundations/telephony helpers exposing NOT_AVAILABLE / recording NOT_AVAILABLE

## Acceptance

- [ ] Call numbers; planned + manual log; DNC enforced; no fabricated connect/recording
- [ ] Email draft → eligibility → SMTP send-request; retries idempotent
- [ ] Accept ≠ delivered; no fabricated replies; no tracking pixels
- [ ] Each Call/Email linked to CrmActivity; fail-closed on Activity failure
- [ ] Vitest PASS (Wave 2 + Wave 1)

## Report

`.superpowers/sdd/task-p13-2-report.md` — no commit.

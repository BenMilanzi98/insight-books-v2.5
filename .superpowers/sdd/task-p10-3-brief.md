### Task 3: Wave 3 — SLA + My Work / list / detail UI

**Depends on:** Wave 1 tickets + Wave 2 messages/assignment (WORKING_TREE).

**Files (create / extend):**
- `lib/admin/support/sla/catalogue.js` — clock types, default policy version ids
- `lib/admin/support/sla/calendars.js` — business calendar (timezone + working hours + holidays); elapsed business-ms helper
- `lib/admin/support/sla/policies.js` — versioned SLA policy (targets for FIRST_RESPONSE / RESOLUTION at minimum; NEXT_RESPONSE optional stub)
- `lib/admin/support/sla/clocks.js` — start/pause/stop/breach evaluation; pin `policyVersion` + `calendarVersion` on clock rows
- `lib/admin/support/sla/index.js` — exports
- Wire hooks: on ticket create → start FIRST_RESPONSE (+ RESOLUTION per policy); on first **public human** reply → stop FIRST_RESPONSE; SYSTEM_EVENT / ACK alone must **not** stop FIRST_RESPONSE; on RESOLVED/CLOSED → stop RESOLUTION; WAITING_* pause per policy flags
- Prisma: `SupportSlaPolicy`, `SupportSlaCalendar`, `SupportSlaClock`, `SupportSlaEvent` (or equivalent minimal set)
- SQL: `scripts/sql/support-ops-phase10-wave3.sql` with FK parity
- APIs: `app/api/admin/support/tickets/[id]/sla` GET; optional policy list GET
- UI under `app/insightbooks/support/**`:
  - `page.js` — overview / My Work (assigned to me + queue stub)
  - `tickets/page.js` — list (paged; status filters)
  - `tickets/[id]/page.js` — detail (status, messages, assign, SLA clocks)
  - thin pages + components under `components/admin/support/` following CS pattern (`CustomerSuccessCasesView`)
- Nav: extend `lib/admin/adminNav.js` (+ optional `supportNav.js`) for Support section; i18n keys en/ny if project uses them for admin nav
- Permissions: `manageSla` already stubbed — use for policy mutations if any; view clocks with `viewTickets`
- Tests: `test/systemAdmin.support.sla.test.js` (+ nav map test if pattern exists); keep Waves 1–2 green

**Do NOT implement:** email-to-ticket, portal, WhatsApp, full CSAT/KB UI, AI routing, XLSX/PDF export.

## SLA hard rules (SLA_MATRIX)

1. FIRST_RESPONSE starts on eligible create; stops on first valid **public human** agent reply (`PUBLIC_AGENT_REPLY` from Wave 2).
2. Acknowledgements / SYSTEM_EVENT / status→ACKNOWLEDGED alone do **not** stop FIRST_RESPONSE unless policy version explicitly sets `ackCountsAsFirstResponse: true` (default **false**).
3. RESOLUTION clock starts per policy (create or assign); stops on verified RESOLVED (or CLOSED if policy says).
4. Breach records are **immutable** once recorded (append event; do not delete/alter breach facts).
5. Pause on WAITING_FOR_CUSTOMER / WAITING_FOR_INTERNAL_TEAM / WAITING_FOR_VENDOR when policy pause flags say so.
6. Historical clock evaluation uses pinned policy+calendar versions — never silently recompute with latest policy.
7. Reliability: if SLA tables unavailable → NOT_AVAILABLE / UNAVAILABLE envelope — **never fake 0% breach**.

## UI expectations

- Match existing AdminShell / CS visual patterns (no new marketing landing).
- My Work: tickets where `assigneeAdminId === current admin` (and optionally unassigned in GENERAL_SUPPORT) — empty states honest.
- List: server pagination via existing listTickets API.
- Detail: show ticketNumber, status transitions (if permitted), message thread (admin view), assign control, SLA clock cards with state (RUNNING/PAUSED/STOPPED/BREACHED) and due-at.
- Channel badges: EMAIL/WHATSAPP/PORTAL show NOT_AVAILABLE if displayed — never invent inbound volume.

## Pattern references

- CS UI: `app/insightbooks/customer-success/**`, `components/admin` CustomerSuccess* views
- Nav: `lib/admin/adminNav.js`, `lib/admin/customerSuccessNav.js`
- Matrices: `SLA_MATRIX.md`, `SUPPORT_SECURITY_MATRIX.md`
- Wave 2 messages: `addPublicReply` must integrate with SLA stop hook

## Global Constraints (binding)

- Support Ticket ≠ CsCase ≠ Platform Incident ≠ CRM Lead.
- Public ≠ internal ≠ restricted notes (API-enforced).
- No billing/MRA fiscal/Tenant GL mutation from Support.
- SLA deterministic; ack ≠ human first response by default.
- No fabricated tickets/CSAT; no false zeroes; no AI replies.
- Email/WhatsApp/portal deferred.
- CoA admin route stays removed.
- **Do not git commit.** WORKING_TREE only.
- Prisma EPERM → SQL + guards.

## Acceptance

- [ ] First-response / resolution clocks with business calendar
- [ ] Ack does not satisfy human first-response by default
- [ ] Breach immutable
- [ ] Nav map + vitest PASS (SLA + prior support suites still green)

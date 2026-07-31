# Task P10-3 Report — Wave 3 SLA Clocks + My Work / List / Detail UI

**Status:** DONE_WITH_CONCERNS  
**Commits:** `WORKING_TREE` (no commits, per brief)  
**Branch:** `v2`  
**Date:** 2026-07-30  
**Base:** Wave 1 tickets + Wave 2 messages/assignment already in working tree

---

## What was implemented

Extends Phase 10 Support Ops with versioned SLA policies/calendars/clocks, message/status hooks, and AdminShell Support UI (My Work, ticket list, ticket detail) — without email-to-ticket, WhatsApp, portal inbound, full CSAT/KB, AI routing, or XLSX/PDF export.

### Library (`lib/admin/support/sla/*`)

| File | Responsibility |
|------|----------------|
| `catalogue.js` | Clock types/states/events; `sla-policy-default-v1` / `sla-calendar-default-v1` |
| `calendars.js` | Default Africa/Blantyre Mon–Fri 08:00–17:00; `elapsedBusinessMs` / `addBusinessMs` |
| `policies.js` | Default policy (`ackCountsAsFirstResponse: false`); pause flags; `listSlaPolicies` |
| `clocks.js` | start / pause / resume / stop / breach; pin policy+calendar versions; immutable BREACHED events |
| `index.js` | Public SLA exports |

### Hooks

- `createTicket` → `startClocksOnTicketCreate` (FIRST_RESPONSE + RESOLUTION; soft-fail if SLA model missing)
- `addPublicReply` → `stopFirstResponseOnPublicReply` (`PUBLIC_AGENT_REPLY` only)
- `transitionTicketStatus` → `onTicketStatusChangeForSla` (ack optional; WAITING_* pause; RESOLVED/CLOSED stop RESOLUTION)
- `listTickets` → `assigneeAdminId` + `myWork` (assigned to me ∪ unassigned `GENERAL_SUPPORT`)

### Prisma

- `SupportSlaPolicy`, `SupportSlaCalendar`, `SupportSlaClock`, `SupportSlaEvent`
- Relations on `SupportTicket` + `Admin`

### SQL fallback

- `scripts/sql/support-ops-phase10-wave3.sql` — IF NOT EXISTS tables/indexes, FK `DO $$` blocks (Wave 1–2 parity)

### APIs

| Method | Route |
|--------|-------|
| GET | `/api/admin/support/tickets/[id]/sla` |
| GET | `/api/admin/support/sla/policies` |
| GET | `/api/admin/support/tickets` — added `myWork` / `assigneeAdminId` |

### UI

- `app/insightbooks/support/page.js` — My Work
- `app/insightbooks/support/tickets/page.js` — paged list + status filters
- `app/insightbooks/support/tickets/[id]/page.js` — detail (status, assign, messages, SLA clocks)
- `components/admin/support/*` + exports from `components/admin/index.js`
- `lib/admin/supportNav.js` + `adminNav.js` Support entry (`LifeBuoy` icon in AdminSidebar)
- i18n en/ny: `admin-shell.nav.items.support`, `admin-pages.support.*`

### Not implemented (correctly deferred)

Email-to-ticket, WhatsApp, portal inbound, full CSAT/KB UI, AI routing, XLSX/PDF export, NEXT_RESPONSE live clock (catalogue stub only), System CoA admin UI (stays removed).

---

## Acceptance checklist

- [x] First-response / resolution clocks with business calendar
- [x] Ack does not satisfy human first-response by default
- [x] Breach immutable (append BREACHED event; no delete/duplicate)
- [x] Nav map + vitest PASS (SLA + prior support suites still green)
- [x] UNAVAILABLE envelope when SLA tables missing — never fake 0% breach
- [x] Channel badges EMAIL/WHATSAPP/PORTAL show NOT_AVAILABLE

---

## Test commands + results

```bash
npx vitest run test/systemAdmin.support.sla.test.js test/systemAdmin.support.tickets.test.js test/systemAdmin.support.messages.test.js test/systemAdmin.support.attachments.test.js test/systemAdmin.support.assignment.test.js
```

```
Test Files  5 passed (5)
     Tests  47 passed (47)
```

Also:

```bash
npx vitest run test/systemAdmin.navPermissionMap.test.js test/systemAdmin.supportAccess.test.js
```

```
Test Files  2 passed (2)
     Tests  8 passed (8)
```

| Suite | Focus | Count |
|-------|--------|-------|
| `systemAdmin.support.sla.test.js` | SLA core + nav + My Work filters | 13 |
| `systemAdmin.support.tickets.test.js` | Wave 1 regression | 10 |
| `systemAdmin.support.messages.test.js` | Wave 2 messages | 7 |
| `systemAdmin.support.attachments.test.js` | Wave 2 attachments | 6 |
| `systemAdmin.support.assignment.test.js` | Wave 2 assignment | 11 |

**Support Wave suites total: 47 / 47 PASS** (+ 8 nav/access)

---

## TDD evidence

1. **Red:** Authored `test/systemAdmin.support.sla.test.js` against SLA_MATRIX contracts before production SLA modules existed.
2. **Green:** Implemented `lib/admin/support/sla/*` → hooks in tickets/messages → Prisma/SQL → APIs → UI/nav/i18n.
3. **Verify:** Vitest 47/47 support suites + nav permission map green (see above).

---

## Self-review

### Correctness

- FIRST_RESPONSE stops only on `PUBLIC_AGENT_REPLY` (or policy `ackCountsAsFirstResponse: true`).
- SYSTEM_EVENT / ACK alone do not stop by default.
- Clocks pin `policyVersion` + `calendarVersion` at start.
- Breach: single BREACHED event; re-eval does not duplicate; event delete rejected in tests.
- `listClocksForTicket` returns `UNAVAILABLE` without inventing `breachRate` / `breachPercent`.
- My Work empty states are honest (no fabricated tickets).
- Channel NOT_AVAILABLE shown for EMAIL/WHATSAPP/PORTAL in UI.

### Risks / concerns

1. **Prisma generate EPERM (inherited):** Client methods may be missing until `npx prisma generate` succeeds; runtime `hasSupportSlaClockModel` degrades to UNAVAILABLE. Apply `scripts/sql/support-ops-phase10-wave3.sql` after Wave 1–2 SQL.
2. **Default policy/calendar are in-code catalogue:** DB `SupportSlaPolicy` / `SupportSlaCalendar` tables exist for future `manageSla` mutations; Wave 3 reads catalogue fallback when DB empty.
3. **Pause resume extends dueAt via business-ms of pause window:** Reasonable for Wave 3; may need finer wall-clock vs business-pause accounting later.
4. **NEXT_RESPONSE** is catalogue stub only — not started/stopped in this wave.
5. **Detail assign UI** takes raw admin id / queue code strings (API-backed); no admin picker yet.
6. **Did not run `prisma generate` / `db push`** in this session (EPERM risk on Windows); SQL + guards provided.

### Wave 1–2 compatibility

- Additive exports via `lib/admin/support/index.js`.
- Soft-fail SLA hooks preserve create/reply/transition when SLA model absent.
- Prior support test suites remain green.

---

## Files changed / created

**Created:**
- `lib/admin/support/sla/catalogue.js`
- `lib/admin/support/sla/calendars.js`
- `lib/admin/support/sla/policies.js`
- `lib/admin/support/sla/clocks.js`
- `lib/admin/support/sla/index.js`
- `lib/admin/supportNav.js`
- `scripts/sql/support-ops-phase10-wave3.sql`
- `app/api/admin/support/tickets/[id]/sla/route.js`
- `app/api/admin/support/sla/policies/route.js`
- `app/insightbooks/support/page.js`
- `app/insightbooks/support/tickets/page.js`
- `app/insightbooks/support/tickets/[id]/page.js`
- `components/admin/support/SupportSectionNav.jsx`
- `components/admin/support/SupportMyWorkView.jsx`
- `components/admin/support/SupportTicketsView.jsx`
- `components/admin/support/SupportTicketDetailView.jsx`
- `test/systemAdmin.support.sla.test.js`

**Modified:**
- `lib/admin/support/index.js`
- `lib/admin/support/tickets.js`
- `lib/admin/support/messages.js`
- `lib/admin/adminNav.js`
- `lib/admin/permissions.js` (nav map already stubbed Wave 1 — verified)
- `prisma/schema.prisma`
- `app/api/admin/support/tickets/route.js`
- `components/admin/index.js`
- `components/AdminSidebar/AdminSidebar.js`
- `locales/en/admin-shell.json`, `locales/ny/admin-shell.json`
- `locales/en/admin-pages.json`, `locales/ny/admin-pages.json`

---

## Exact values used (verbatim)

- Policy version id: `sla-policy-default-v1`
- Calendar version id: `sla-calendar-default-v1`
- Clock types: `FIRST_RESPONSE`, `RESOLUTION`, `NEXT_RESPONSE` (stub)
- Clock states: `RUNNING`, `PAUSED`, `STOPPED`, `BREACHED`
- Default `ackCountsAsFirstResponse`: `false`
- Availability envelopes: `UNAVAILABLE` / `NOT_AVAILABLE`

---

## Fix pass

**Date:** 2026-07-30  
**Commits:** `WORKING_TREE` (no commits, per brief)

### P2 findings addressed

1. **`listClocksForTicket` query failure:** when Prisma model exists but `findMany` throws (missing table / query fail), returns `{ ok: false, status: 'UNAVAILABLE', items: [], meta: { unavailable, reason } }` — never empty AVAILABLE with `count: 0` / fake breach %.
2. **Pinned versions on resume/status hooks:** `onTicketStatusChangeForSla` / `resumeClock` resolve each clock’s pinned `policyVersion` / `calendarVersion` via `getSlaPolicyByVersion` / `getSlaCalendarByVersion`. Missing pin → soft-fail `UNAVAILABLE` without inventing dueAt/elapsed math. No silent fallback to latest catalogue defaults.
3. **P3:** post-breach-eval refresh `findMany` guarded the same way (UNAVAILABLE, not uncaught 500).

### Commands + results

```bash
npx vitest run test/systemAdmin.support.sla.test.js test/systemAdmin.support.tickets.test.js test/systemAdmin.support.messages.test.js
```

```
Test Files  3 passed (3)
     Tests  33 passed (33)
```

| Suite | Result |
|-------|--------|
| `systemAdmin.support.sla.test.js` | PASS (incl. findMany-throw UNAVAILABLE + pinned calendar resume) |
| `systemAdmin.support.tickets.test.js` | PASS |
| `systemAdmin.support.messages.test.js` | PASS |

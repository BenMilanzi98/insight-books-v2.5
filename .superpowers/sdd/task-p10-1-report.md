# Task P10-1 Report — Wave 1 Support Ticket Model + Numbering + State Machine + APIs

**Status:** DONE_WITH_CONCERNS  
**Commits:** `WORKING_TREE` (no commits, per plan/user rule)  
**Branch:** `v2`  
**Date:** 2026-07-30

---

## What was implemented

Dedicated Support Ops domain (Architecture B), distinct from `CsCase` and `PlatformSupportAccess`:

### Library (`lib/admin/support/*`)
| File | Responsibility |
|------|----------------|
| `catalogue.js` | Statuses, types, impact/urgency/priority/severity, transition table, channel availability, PRIORITY_MATRIX helper, list bounds |
| `numbering.js` | Concurrency-safe `SUP-YYYY-######` via `SupportTicketNumberSeq` CAS (documentSequences pattern); UTC year |
| `stateMachine.js` | `canTransition` / `assertTransition` — invalid → `{ ok: false, error: 'INVALID_TRANSITION' }`; RESOLVED needs `resolutionCategory`; CLOSED→REOPENED needs reason; terminal-ish needs reason |
| `authz.js` | `resolveSupportAccess` (view/create/transition); `resolveSupportQueueScope` stub (Wave 2) |
| `tickets.js` | `createTicket` / `listTickets` / `getTicket` / `transitionTicketStatus` + `hasSupportTicketModel` guard; status history append |
| `index.js` | Public exports |

### Prisma
- `SupportTicketNumberSeq` (year PK, `lastIssued`)
- `SupportTicket` (+ Tenant/Admin/CustomerPortfolio relations)
- `SupportTicketStatusHistory` (append-only)

### SQL fallback
- `scripts/sql/support-ops-phase10-wave1.sql` — apply-friendly; header documents EPERM path

### APIs
- `GET/POST /api/admin/support/tickets`
- `GET /api/admin/support/tickets/[id]` (id or ticketNumber)
- `POST /api/admin/support/tickets/[id]/status` body `{ toStatus, reason?, resolutionCategory? }`

### Permissions + nav
- `SYSTEM_ADMIN_PERMISSIONS.support.*` including active keys + SECURITY_MATRIX stubs
- `NAV_PERMISSION_MAP` for `/insightbooks/support` and children stubs → `viewTickets`
- Super Admin: break-glass via existing authorizeAdminDecision; Platform Support: JSON grants (same pattern as CS)

### Not implemented (correctly deferred)
Messages, attachments, queues/teams UI, SLA clocks, handoffs, customer portal, email-to-ticket. Channel constants mark EMAIL/WHATSAPP/PORTAL as `NOT_AVAILABLE`.

---

## Test commands + results

```bash
npx vitest run test/systemAdmin.support.tickets.test.js
```

```
Test Files  1 passed (1)
     Tests  10 passed (10)
  Duration  8.34s
```

Covered behaviors:
1. Unique sequential `SUP-YYYY-######` numbering  
2. Create starts `NEW`; invalid transition rejected  
3. Happy path NEW→…→IN_PROGRESS→RESOLVED (with resolutionCategory)→CLOSED  
4. CLOSED only → REOPENED with reason  
5. Authz forbidden without permissions  
6. List pagination bounded (max 100)  
7. EMAIL/WHATSAPP/PORTAL → NOT_AVAILABLE  
8. Permissions + nav map  
9. Priority matrix helper  
10. Get by id or ticketNumber; SupportTicket create does not create CsCase  

---

## TDD evidence

1. **Red (authored first):** `test/systemAdmin.support.tickets.test.js` written before `lib/admin/support/*` existed (would fail on module resolution / missing exports).  
2. **Green:** Implemented catalogue → stateMachine → numbering → authz → tickets → permissions → Prisma/SQL → APIs to satisfy tests.  
3. **Verify:** Vitest 10/10 PASS (see above).  

Note: A separate “watch fail then green” vitest run was not captured mid-flight; test file preceded production modules in the working tree.

---

## Prisma generate EPERM

```
npx prisma generate
→ EPERM: operation not permitted, rename ...\query_engine-windows.dll.node.tmp* -> query_engine-windows.dll.node
```

**Mitigation shipped:**
1. SQL: `scripts/sql/support-ops-phase10-wave1.sql`  
   Apply: `psql "$DATABASE_URL" -f scripts/sql/support-ops-phase10-wave1.sql`  
2. Runtime guard: `hasSupportTicketModel(prisma)` in `tickets.js` (returns UNAVAILABLE / empty list when client methods missing)  
3. Retry `npx prisma generate` when the query-engine DLL lock clears (stop `next dev` / other Node processes holding the file)

Unit tests use mocked Prisma and do not require a regenerated client.

---

## Files changed / created

**Created:**
- `lib/admin/support/catalogue.js`
- `lib/admin/support/numbering.js`
- `lib/admin/support/stateMachine.js`
- `lib/admin/support/authz.js`
- `lib/admin/support/tickets.js`
- `lib/admin/support/index.js`
- `app/api/admin/support/tickets/route.js`
- `app/api/admin/support/tickets/[id]/route.js`
- `app/api/admin/support/tickets/[id]/status/route.js`
- `scripts/sql/support-ops-phase10-wave1.sql`
- `test/systemAdmin.support.tickets.test.js`

**Modified:**
- `prisma/schema.prisma` (Support* models + Tenant/Admin/CustomerPortfolio relations)
- `lib/admin/permissions.js` (support permissions, nav stubs, INTEL_CRM scaffold)

---

## Self-review vs brief

| Acceptance | Result |
|------------|--------|
| Unique SUP-YYYY-###### concurrency-safe | PASS (seq table + CAS; sequential uniqueness tested) |
| Canonical statuses + invalid rejection | PASS (transition table + assertTransition) |
| Distinct from CsCase | PASS (separate models/APIs; test asserts no CsCase create) |
| Vitest PASS | PASS (10/10) |

Transition rules match brief (happy path, WAITING_*→IN_PROGRESS|RESOLVED documented, CLOSED immutable except REOPENED+reason, terminal-ish from early statuses with reason + history).

---

## Concerns

1. **Prisma client not regenerated** — EPERM on Windows; SQL fallback + `hasSupportTicketModel` guards documented. Live API create against DB needs SQL apply + successful generate (or a process restart that allows generate).  
2. **No default Platform Support role pack grant** — follows CS pattern (permissions in Admin JSON; Super Admin break-glass). Role seeding/UI grant wiring not in Wave 1 brief.  
3. **Queue scope stub** — intentional Wave 2; Wave 1 viewers with `viewTickets` see unscoped list (mode `all`).  

No large unplanned file splits. No git commit.

---

## Fix pass

Addressed Important review finding #1 (SQL FK parity) and elevated Minors #5/#6 from `task-p10-1-review.md`. Out of scope: schema/permissions churn (controller process note).

### What changed

1. **SQL FK parity** — `scripts/sql/support-ops-phase10-wave1.sql` now adds idempotent `DO $$ … ADD CONSTRAINT … FOREIGN KEY` blocks matching Prisma `onDelete` and CS Phase 8 style:
   - `SupportTicket.tenantId` → `Tenant` (CASCADE)
   - `SupportTicket.portfolioId` → `CustomerPortfolio` (SET NULL)
   - `SupportTicket.createdByAdminId` / `assigneeAdminId` → `Admin` (SET NULL)
   - `SupportTicketStatusHistory.ticketId` → `SupportTicket` (CASCADE)
   - `SupportTicketStatusHistory.changedByAdminId` → `Admin` (SET NULL)
2. **Create-time enum validation** — `createTicket` rejects unknown `impact` / `urgency` / `priority` / `severity` (and type) against catalogue sets with `invalid_*` errors.
3. **REOPENED clears resolutionCategory** — alongside `resolvedAt` / `closedAt`, so a later RESOLVED cannot reuse a stale category via `??`.

### Tests

Command: `npx vitest run test/systemAdmin.support.tickets.test.js`

```
RUN  v4.1.2 C:/laragon/www/insight-books-v2.5

Test Files  1 passed (1)
     Tests  11 passed (11)
  Start at  00:27:52
  Duration  2.05s (transform 1.01s, setup 0ms, import 1.07s, tests 29ms, environment 0ms)
```

exit_code: 0

Added/adjusted coverage: unknown enum rejection on create; REOPENED clears `resolutionCategory` and blocks RESOLVED without a fresh category.

### Files touched

- `scripts/sql/support-ops-phase10-wave1.sql`
- `lib/admin/support/tickets.js`
- `test/systemAdmin.support.tickets.test.js`
- `.superpowers/sdd/task-p10-1-report.md` (this section)

No git commit.

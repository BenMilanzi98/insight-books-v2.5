# Task P10-2 Report — Wave 2 Messages + Attachments Boundary + Queues/Teams/Assignment

**Status:** DONE_WITH_CONCERNS  
**Commits:** `WORKING_TREE` (no commits, per brief)  
**Branch:** `v2`  
**Date:** 2026-07-30  
**Base:** Wave 1 SupportTicket domain already in working tree

---

## What was implemented

Extends Phase 10 Support Ops (Architecture B) with messaging, attachment security boundary, queue catalogue, team stubs, and assignment history — without touching SLA, My Work UI, email-to-ticket, WhatsApp, customer portal, KB/CSAT, or AI replies.

### Library (`lib/admin/support/*`)

| File | Responsibility |
|------|----------------|
| `catalogue.js` (extended) | Message types, attachment scan states, MIME allow-list, QUEUE_TEAM_MATRIX codes, team stubs |
| `authz.js` (extended) | `replyPublicly`, `addInternalNotes`, `addRestrictedNotes` / view restricted, `assignTickets` |
| `ticketLookup.js` | Shared find by cuid / `SUP-YYYY-######` |
| `messages.js` | `addPublicReply` / `addInternalNote` / `addRestrictedNote` / `listMessages` (permission-filtered) / **`projectForCustomer`** (never INTERNAL/RESTRICTED) |
| `attachments.js` | Upload metadata → default **`PENDING_SCAN`**; private storage under `storage/support-attachments/` (env override); `markScanResult`; download gate CLEAN+ACL only |
| `queues.js` | `listQueues` (catalogue sync / DB merge) + `seedQueueCatalogue`; `liveStatus: NOT_FOUND` always — no staffing metrics |
| `teams.js` | Team definition stubs + optional membership eligibility (empty membership ⇒ not locked out) |
| `assignment.js` | `assignTicket` with history; same assignee+queue → `{ ok: true, noop: true }`; status → ASSIGNED only via state machine when allowed |
| `index.js` | Wave 1 + Wave 2 public exports |

### Prisma

- `SupportMessage`
- `SupportAttachment` (opaque `storageKey`, unique)
- `SupportQueue` (catalogue table for assignment FK / seed)
- `SupportTeam` / `SupportTeamMembership` (stubs)
- `SupportAssignmentHistory` (append-only)
- Relations on `SupportTicket` + `Admin`

### SQL fallback

- `scripts/sql/support-ops-phase10-wave2.sql` — IF NOT EXISTS tables/indexes, FK `DO $$` blocks (Wave 1 parity), optional queue seed with `liveStatus = NOT_FOUND`
- Header documents private storage choice + EPERM apply path

### APIs

| Method | Route |
|--------|-------|
| GET/POST | `/api/admin/support/tickets/[id]/messages` |
| GET/POST | `/api/admin/support/tickets/[id]/attachments` |
| GET | `/api/admin/support/tickets/[id]/attachments/[attachmentId]/download` |
| POST | `/api/admin/support/tickets/[id]/assign` |
| GET | `/api/admin/support/queues` |

### Other

- `.gitignore`: `/storage/support-attachments/`
- Permissions already stubbed in Wave 1 `SYSTEM_ADMIN_PERMISSIONS.support.*` — wired in authz

### Not implemented (correctly deferred)

SLA clocks, My Work UI pages, email-to-ticket, WhatsApp, customer portal UI, full KB/CSAT, AI replies, fabricated staffing/open-ticket metrics.

---

## Acceptance checklist

- [x] Internal notes never in customer projections (`projectForCustomer` + tests)
- [x] Attachment PENDING_SCAN (and non-CLEAN) not downloadable
- [x] Assignment history; no silent reassign loops (noop on same assignee+queue)
- [x] Vitest PASS for Wave 2 test files
- [x] Wave 1 `test/systemAdmin.support.tickets.test.js` still PASS

---

## Test commands + results

```bash
npx vitest run test/systemAdmin.support.messages.test.js test/systemAdmin.support.attachments.test.js test/systemAdmin.support.assignment.test.js test/systemAdmin.support.tickets.test.js
```

```
Test Files  4 passed (4)
     Tests  34 passed (34)
  Duration  10.93s
```

| Suite | Focus | Count (approx) |
|-------|--------|----------------|
| `systemAdmin.support.tickets.test.js` | Wave 1 regression | 10 |
| `systemAdmin.support.messages.test.js` | Public/internal/restricted + customer projection | 7 |
| `systemAdmin.support.attachments.test.js` | MIME, PENDING_SCAN, non-CLEAN gate, CLEAN+ACL | 6 |
| `systemAdmin.support.assignment.test.js` | Queues, teams, assign/noop/reassign, SM respect | 11 |

**Total: 34 / 34 PASS**

---

## TDD evidence

1. **Red:** Authored `test/systemAdmin.support.messages.test.js`, `attachments.test.js`, `assignment.test.js` against the Wave 2 brief contracts before production modules existed.
2. **Green:** Implemented catalogue → authz → messages/attachments/queues/teams/assignment → Prisma/SQL → APIs → gitignore.
3. **Verify:** Vitest 34/34 including Wave 1 regression (see above).

---

## Self-review

### Correctness

- Message visibility enforced in service layer (`listMessages` type filter + `projectForCustomer`).
- Attachments fail closed: default `PENDING_SCAN`; download requires `CLEAN` + `viewTickets`.
- Assignment noop prevents history spam; reassign always appends history; reason optional.
- `NEW`/`ACKNOWLEDGED` → assign updates assignee/queue but does **not** force illegal `ASSIGNED` transition (state machine respected). `TRIAGE` → `ASSIGNED` when allowed.

### Risks / concerns

1. **Prisma generate EPERM (inherited):** Client methods may be missing until `npx prisma generate` succeeds; runtime `has*Model` guards degrade safely. Apply `scripts/sql/support-ops-phase10-wave2.sql` after Wave 1 SQL.
2. **Team membership is a stub:** Empty membership rows do not lock out assignees (by design for Wave 2). Tighten when real org roster exists.
3. **Queue `liveStatus` always `NOT_FOUND`:** Intentional per QUEUE_TEAM_MATRIX — do not treat catalogue seed as live ops.
4. **Upload ACL:** Attachment create requires `replyPublicly` or `createTickets` (or Super Admin), not a dedicated upload permission — acceptable for Wave 2; may want a dedicated perm later.
5. **Storage is local filesystem:** Documented choice (`storage/support-attachments/` or `SUPPORT_ATTACHMENT_STORAGE_ROOT`). No virus scanner wired — `markScanResult` is the hook for future scanner/tests.
6. **SQL queue seed IDs:** Uses `md5(random()…)` placeholders; app `seedQueueCatalogue` upserts by `code` for runtime seeding.

### Wave 1 compatibility

- Did not revert Phase 7–9 files.
- Wave 1 ticket APIs/tests unchanged in behavior; exports additive via `index.js`.

---

## Files changed / created

**Created:**
- `lib/admin/support/messages.js`
- `lib/admin/support/attachments.js`
- `lib/admin/support/queues.js`
- `lib/admin/support/teams.js`
- `lib/admin/support/assignment.js`
- `lib/admin/support/ticketLookup.js`
- `app/api/admin/support/tickets/[id]/messages/route.js`
- `app/api/admin/support/tickets/[id]/attachments/route.js`
- `app/api/admin/support/tickets/[id]/attachments/[attachmentId]/download/route.js`
- `app/api/admin/support/tickets/[id]/assign/route.js`
- `app/api/admin/support/queues/route.js`
- `scripts/sql/support-ops-phase10-wave2.sql`
- `test/systemAdmin.support.messages.test.js`
- `test/systemAdmin.support.attachments.test.js`
- `test/systemAdmin.support.assignment.test.js`

**Modified:**
- `lib/admin/support/catalogue.js`
- `lib/admin/support/authz.js`
- `lib/admin/support/index.js`
- `prisma/schema.prisma`
- `.gitignore`

**Unchanged (Wave 1):**
- `lib/admin/support/tickets.js`, `numbering.js`, `stateMachine.js`
- Wave 1 ticket API routes
- `test/systemAdmin.support.tickets.test.js` (still green)

---

## Prisma generate / SQL apply notes

If `npx prisma generate` hits Windows EPERM on `query_engine-windows.dll.node`:

1. Apply Wave 1 SQL if needed, then Wave 2:  
   `psql "$DATABASE_URL" -f scripts/sql/support-ops-phase10-wave2.sql`
2. Rely on `hasSupportMessageModel` / `hasSupportAttachmentModel` / `hasSupportQueueModel` / `hasSupportAssignmentHistoryModel` guards.
3. Retry generate when the DLL lock clears (stop `next dev` / Node processes holding the engine).

Unit tests use mocked Prisma and do not require a regenerated client.

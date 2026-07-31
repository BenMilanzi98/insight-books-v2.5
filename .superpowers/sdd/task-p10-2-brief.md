### Task 2: Wave 2 — Messages + attachments boundary + queues/teams/assignment

**Depends on:** Task 1 SupportTicket model/APIs (WORKING_TREE already present under `lib/admin/support/*`).

**Files (create / extend):**
- `lib/admin/support/messages.js` — add public reply / internal note / restricted note; customer projection helper that **never** includes INTERNAL or RESTRICTED
- `lib/admin/support/attachments.js` — upload metadata + scan states; download gate (PENDING_SCAN / QUARANTINED / INFECTED / SCAN_FAILED / REJECTED / DELETED not downloadable; CLEAN only with ACL)
- `lib/admin/support/queues.js` — seed queue catalogue + list queues; honor QUEUE_TEAM_MATRIX codes without inventing ownerless queues as “live ops”
- `lib/admin/support/teams.js` — team membership stubs / list (enough for assignment eligibility)
- `lib/admin/support/assignment.js` — assign / reassign with **assignment history**; no silent reassign loops (same assignee no-op; require reason on reassign optional but history always appended)
- Extend `lib/admin/support/catalogue.js`, `authz.js`, `index.js` for message visibility + attachment states + queue permissions
- Prisma: `SupportMessage`, `SupportAttachment`, `SupportQueue` (or catalogue-only if justified — prefer table if assignment needs FK), `SupportTeam` / membership as needed, `SupportAssignmentHistory`
- SQL fallback: `scripts/sql/support-ops-phase10-wave2.sql` (FK parity like Wave 1)
- APIs under `app/api/admin/support/`:
  - `tickets/[id]/messages` GET/POST
  - `tickets/[id]/attachments` GET/POST (+ download route that enforces scan state)
  - `queues` GET
  - `tickets/[id]/assign` POST
- Permissions: wire `replyPublicly`, `addInternalNotes`, `addRestrictedNotes`, `assignTickets` from SECURITY_MATRIX (already stubbed in Wave 1)
- Tests: `test/systemAdmin.support.messages.test.js`, `test/systemAdmin.support.attachments.test.js`, `test/systemAdmin.support.assignment.test.js` (or one file if clearer — prefer focused files)

**Do NOT implement:** SLA clocks, My Work UI pages, email-to-ticket ingest, WhatsApp, customer portal, full KB/CSAT, AI replies.

## Message visibility (COMMUNICATION_VISIBILITY_MATRIX)

| Type | In admin agent view | In `projectForCustomer(messages)` |
|------|---------------------|-----------------------------------|
| CUSTOMER_MESSAGE / PUBLIC_AGENT_REPLY | Yes | Yes |
| INTERNAL_NOTE | Yes (if permitted) | **Never** |
| RESTRICTED_INTERNAL_NOTE | Yes (if `addRestrictedNotes` / view restricted) | **Never** |
| SYSTEM_EVENT | Yes (filtered) | Filtered / limited |

Enforcement in service/API layer — never CSS-only. Even though portal is deferred, `projectForCustomer` must exist and be tested.

## Attachments (ATTACHMENT_SECURITY_MATRIX)

States: `UPLOADED` | `PENDING_SCAN` | `CLEAN` | `QUARANTINED` | `INFECTED` | `SCAN_FAILED` | `REJECTED` | `DELETED`

- Storage key/path must be **private** (not under `public/uploads`). Prefer opaque object key + metadata in DB.
- Wave 2 may use a local private directory under something like `storage/support-attachments/` (gitignored) or an abstract storage interface — document choice in SQL/module header.
- MIME validated server-side on create; download returns 403/404 when not CLEAN (or not ACL).
- Optional: `markScanResult` helper for tests / future scanner; default new uploads → `PENDING_SCAN` (fail closed).

## Queues / teams (QUEUE_TEAM_MATRIX)

Seed codes (catalogue and/or DB seed helper): GENERAL_SUPPORT, ACCOUNT_ACCESS, BILLING, MRA_EIS, PRODUCT, TECHNICAL, ANDROID, SECURITY, ESCALATIONS — only as definitions; do not invent fake staffing metrics.

## Assignment

- `assignTicket({ ticketId, assigneeAdminId, queueCode?, reason? })`
- Append `SupportAssignmentHistory` every change of assignee and/or queue
- Same assignee + same queue → `{ ok: true, noop: true }` (no duplicate history spam)
- AuthZ: `assignTickets` required; viewers without assign cannot mutate
- Optionally move status toward ASSIGNED when currently TRIAGE/NEW/ACKNOWLEDGED via existing state machine (if transition allowed) — do not bypass state machine

## Pattern references

- Wave 1: `lib/admin/support/tickets.js`, `authz.js`, `catalogue.js`
- Matrices: `COMMUNICATION_VISIBILITY_MATRIX.md`, `ATTACHMENT_SECURITY_MATRIX.md`, `QUEUE_TEAM_MATRIX.md`, `SUPPORT_SECURITY_MATRIX.md`
- Design: `docs/superpowers/specs/2026-07-30-support-ops-phase-10-design.md`

## Global Constraints (binding)

- Support Ticket ≠ CsCase ≠ Platform Incident ≠ CRM Lead.
- Public ≠ internal ≠ restricted notes (API-enforced).
- No billing/MRA fiscal/Tenant GL mutation from Support.
- No fabricated tickets/CSAT; no false zeroes; no AI replies.
- Email-to-ticket / WhatsApp / customer portal deferred.
- CoA admin route stays removed.
- **Do not git commit.** Report WORKING_TREE.
- Prisma EPERM: SQL fallback + model guards (same as Wave 1).

## Acceptance

- [ ] Internal notes never in customer projections
- [ ] Attachment PENDING_SCAN (and non-CLEAN) not downloadable
- [ ] Assignment history; no silent reassign loops
- [ ] Vitest PASS for Wave 2 test files

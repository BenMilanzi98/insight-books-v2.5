### Task 1: Wave 1 — Ticket model + numbering + state machine + APIs

**Files (create):**
- `lib/admin/support/catalogue.js` — statuses, types, impact/urgency/priority/severity enums, transition table, channel availability constants
- `lib/admin/support/numbering.js` — concurrency-safe `SUP-YYYY-######`
- `lib/admin/support/stateMachine.js` — `assertTransition(from, to, ctx)` / `canTransition`
- `lib/admin/support/authz.js` — permission checks; queue scope stub (full queues Wave 2)
- `lib/admin/support/tickets.js` — create / list / get / transitionStatus
- `lib/admin/support/index.js` — public exports
- Prisma: `SupportTicket`, `SupportTicketStatusHistory` (+ optional `SupportTicketNumberSeq` if needed for numbering)
- SQL fallback: `scripts/sql/support-ops-phase10-wave1.sql` (apply-friendly; document if `prisma generate` EPERM)
- APIs:
  - `app/api/admin/support/tickets/route.js` — GET list, POST create
  - `app/api/admin/support/tickets/[id]/route.js` — GET detail
  - `app/api/admin/support/tickets/[id]/status/route.js` — POST transition
- Permissions + nav stubs in `lib/admin/permissions.js` for `/insightbooks/support` (and children stubs)
- Tests: `test/systemAdmin.support.tickets.test.js` (and split files if clearer)

**Do NOT implement in this task:** messages, attachments, queues/teams UI, SLA clocks, handoffs, customer portal, email-to-ticket. Stubs/constants for NOT_AVAILABLE channels are OK in catalogue.

## Canonical ticket number

- Format: `SUP-YYYY-######` (6-digit zero-padded sequence **per calendar year**)
- Must be unique; concurrency-safe under parallel creates (transaction / advisory lock / dedicated sequence table — pick one pattern and test race-ish sequential creates)
- Year = UTC year of create time unless catalogue documents otherwise

## Statuses (from TICKET_STATE_MATRIX)

`NEW`, `ACKNOWLEDGED`, `TRIAGE`, `ASSIGNED`, `IN_PROGRESS`, `WAITING_FOR_CUSTOMER`, `WAITING_FOR_INTERNAL_TEAM`, `WAITING_FOR_VENDOR`, `RESOLVED`, `CUSTOMER_CONFIRMED`, `CLOSED`, `REOPENED`, `DUPLICATE`, `MERGED`, `CANCELLED`, `SPAM`

**Transition rules (v1 — enforce in stateMachine):**
- Create → status `NEW` only
- Happy path: NEW → ACKNOWLEDGED → TRIAGE → ASSIGNED → IN_PROGRESS
- From IN_PROGRESS: WAITING_* and RESOLVED (RESOLVED requires `resolutionCategory` string)
- WAITING_* → IN_PROGRESS (and optionally RESOLVED if justified — document in catalogue)
- RESOLVED → CUSTOMER_CONFIRMED | CLOSED | REOPENED
- CUSTOMER_CONFIRMED → CLOSED | REOPENED
- CLOSED → REOPENED only (requires reason); CLOSED otherwise immutable
- REOPENED → TRIAGE | ASSIGNED | IN_PROGRESS
- Terminal-ish: DUPLICATE | MERGED | CANCELLED | SPAM from early statuses (NEW/ACKNOWLEDGED/TRIAGE/ASSIGNED) with reason; preserve evidence (status history rows)
- Invalid transitions return `{ ok: false, error: 'INVALID_TRANSITION', ... }` — never silent coerce

Every successful transition appends `SupportTicketStatusHistory` (`fromStatus`, `toStatus`, `changedByAdminId`, `reason`, `at`).

## Ticket fields (minimum)

- `id` (cuid), `ticketNumber`, `tenantId` (required), optional `portfolioId`
- `status`, `type` (e.g. QUESTION, ACCOUNT_ACCESS, BILLING_*, PRODUCT_DEFECT, MRA_EIS_ISSUE, OTHER — catalogue enums)
- `impact`, `urgency`, `priority`, `severity` (keep distinct; default priority from PRIORITY_MATRIX helper OK)
- `title`, `description` (text), `resolutionCategory` nullable
- `createdByAdminId`, `assigneeAdminId` nullable (assignment history Wave 2 — field OK)
- `queueCode` nullable stub (Wave 2)
- `sourceChannel` = `ADMIN_MANUAL` for create; catalogue marks EMAIL/WHATSAPP/PORTAL as `NOT_AVAILABLE`
- timestamps: createdAt, updatedAt, resolvedAt, closedAt as appropriate
- **Never** store Tenant GL lines, MRA credentials, payment secrets

## Permissions (Wave 1)

Add under `SYSTEM_ADMIN_PERMISSIONS.support` (or equivalent):
- `view` / `viewTickets` → `systemAdmin.support.viewTickets`
- `createTickets` → `systemAdmin.support.createTickets`
- `transitionStatus` (or reuse manage) → `systemAdmin.support.transitionStatus`
- Stub remaining keys from SUPPORT_SECURITY_MATRIX for later waves (replyPublicly, addInternalNotes, …) without wiring unused APIs

Map NAV for `/insightbooks/support` (+ optional children stubs) to `viewTickets`.
Grant Super Admin + Platform Support roles appropriately (follow CS/product-analytics patterns in permissions.js).

## APIs

Follow `app/api/admin/customer-success/cases/route.js` patterns (`getAdminFromRequest`, `{ success, ... }`).
- List: server-side pagination (`limit`/`cursor` or `offset`); filter status/tenantId; never load all tickets unbounded
- Create: requires createTickets; returns ticketNumber
- Get: by id **or** ticketNumber; 404 if missing; 403 if no view
- Status POST: body `{ toStatus, reason?, resolutionCategory? }`

## Distinct from CsCase

- Separate Prisma models and API paths (`/api/admin/support/*` ≠ `/api/admin/customer-success/*`)
- Tests must assert SupportTicket create does **not** create CsCase rows (and vice-versa naming)
- Comments/docs in catalogue: Support ≠ CS Case ≠ PlatformSupportAccess

## Tests (Vitest) — required behaviors

1. Numbering unique across sequential creates; format `SUP-\d{4}-\d{6}`
2. Create starts NEW; invalid transition rejected
3. Valid path NEW→…→IN_PROGRESS→RESOLVED (with resolutionCategory)→CLOSED
4. CLOSED cannot transition except REOPENED with reason
5. Authz: missing permission → forbidden
6. List pagination bounded
7. Gate/helper: EMAIL/WHATSAPP/PORTAL channels report NOT_AVAILABLE (catalogue)

## Pattern references

- Cases: `lib/admin/customerSuccess/cases.js`, `authz.js`, `catalogue.js`
- Permissions: `lib/admin/permissions.js`
- Matrices: `docs/admin-intelligence-crm/phase-10/TICKET_STATE_MATRIX.md`, `PRIORITY_MATRIX.md`, `SUPPORT_SECURITY_MATRIX.md`, `SUPPORT_DOMAIN_MATRIX.md`
- Design: `docs/superpowers/specs/2026-07-30-support-ops-phase-10-design.md`

## Global Constraints (binding)

- Support Ticket ≠ CsCase ≠ Platform Incident ≠ CRM Lead.
- Public ≠ internal ≠ restricted notes (API-enforced) — Wave 2; do not fake messages in Wave 1.
- No billing/MRA fiscal/Tenant GL mutation from Support.
- SLA deterministic; ack ≠ human first response by default — Wave 3.
- No fabricated tickets/CSAT; no false zeroes; no AI replies.
- Email-to-ticket / WhatsApp / customer portal deferred (contracts only).
- CoA admin route stays removed.
- **Do not git commit** (user/plan rule). Report `WORKING_TREE` instead of commit SHAs.
- If Prisma client generate fails with EPERM on Windows, ship SQL fallback + `hasSupportTicketModel` guards (same pattern as CS Phase 8) and document apply steps in the SQL file header.

## Acceptance

- [ ] Unique SUP-YYYY-###### numbering (concurrency-safe)
- [ ] Canonical statuses + invalid transition rejection
- [ ] Distinct from CsCase
- [ ] Vitest PASS for support ticket tests

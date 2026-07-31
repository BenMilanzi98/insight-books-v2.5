### Task 1: Wave 1 — Account / Contact / Lead + numbering + state machine + APIs

**Files (create):**
- `lib/admin/crm/catalogue.js` — lead types/sources/channels (stubs OK), account types/statuses, contact roles (minimal), lead statuses + transition table, EMAIL/WHATSAPP channel `NOT_AVAILABLE`
- `lib/admin/crm/numbering.js` — concurrency-safe `LEAD-YYYY-######`, `ACC-YYYY-######`, `CON-YYYY-######` (UTC year, 6-digit seq per prefix/year)
- `lib/admin/crm/stateMachine.js` — Lead status `canTransition` / `assertTransition`
- `lib/admin/crm/authz.js` — view/create/edit/transition stubs; owner/team/territory scope stubs (full routing Wave 3)
- `lib/admin/crm/accounts.js` — create / list / get
- `lib/admin/crm/contacts.js` — create / list / get (+ optional account link on create)
- `lib/admin/crm/leads.js` — create / list / get / transitionStatus
- `lib/admin/crm/index.js` — public exports
- Prisma: `CrmAccount`, `CrmContact`, `CrmLead`, `CrmLeadStatusHistory`, number seq table(s) as needed
- SQL: `scripts/sql/crm-core-phase11-wave1.sql` (FK `DO $$` parity like Support Wave 1)
- APIs under `app/api/admin/crm/`:
  - `accounts` GET/POST; `accounts/[id]` GET
  - `contacts` GET/POST; `contacts/[id]` GET
  - `leads` GET/POST; `leads/[id]` GET; `leads/[id]/status` POST
- Permissions: promote live `SYSTEM_ADMIN_PERMISSIONS.crm.*` from scaffold keys needed for Wave 1 (`view`, `viewLeads`, `createLeads`, `editLeads`, `viewAccounts`, `createAccounts`, `viewContacts`, `createContacts`, `transitionStatus` or equivalent); leave rest stubbed
- Nav: `NAV_PERMISSION_MAP` stubs for `/insightbooks/crm` (+ children stubs); optional `lib/admin/crmNav.js` entry in `adminNav.js`
- Tests: `test/systemAdmin.crm.leads.test.js` (+ accounts/contacts coverage in same or split files)

**Do NOT implement:** public forms, handoff capture, scoring, qualification engine, teams/territories UI, consent, merge, Opportunity, Email/WhatsApp ingest.

## Numbering

- `LEAD-YYYY-######`, `ACC-YYYY-######`, `CON-YYYY-######`
- Unique, immutable after create, concurrency-safe (seq table + CAS / transaction)
- Never recycle

## Lead statuses (canonical Wave 1 — prefer this list over simplified Wave 0 sketch)

`NEW`, `UNASSIGNED`, `ASSIGNED`, `ACCEPTED`, `ATTEMPTING_CONTACT`, `CONTACTED`, `ENGAGED`, `QUALIFICATION_IN_PROGRESS`, `QUALIFIED`, `NURTURE`, `ON_HOLD`, `DISQUALIFIED`, `OPPORTUNITY_READY`, `CONVERTED_TO_OPPORTUNITY`, `DUPLICATE`, `MERGED`, `SPAM`, `CANCELLED`, `ARCHIVED`

**v1 transition rules (enforce):**
- Manual create → `NEW` (or `UNASSIGNED` if no owner — prefer `NEW` then optional assign later)
- Happy path subset for Wave 1 tests: NEW → ASSIGNED → ACCEPTED → ATTEMPTING_CONTACT → CONTACTED → QUALIFICATION_IN_PROGRESS → QUALIFIED → OPPORTUNITY_READY
- DISQUALIFIED requires `disqualificationReason`
- CONVERTED_TO_OPPORTUNITY **blocked in Wave 1 service** (`NOT_IMPLEMENTED` / invalid) — Phase 12
- Invalid transitions → `{ ok: false, error: 'INVALID_TRANSITION' }` never silent coerce
- Every success appends `CrmLeadStatusHistory`

## Minimum fields

**CrmAccount:** accountNumber, type (PROSPECT default), displayName, status, country/region optional, ownerAdminId optional, customerId/tenantId nullable (no auto-link), timestamps  
**CrmContact:** contactNumber, firstName, lastName, email normalized optional, phone normalized optional, accountId optional, ownerAdminId optional, timestamps — **no** national ID / bank / passwords  
**CrmLead:** leadNumber, type (e.g. NEW_BUSINESS / DEMO_REQUEST / OTHER), personOrOrganisation, accountId/contactId optional, source, channel (`ADMIN_MANUAL` for create), sourceIdempotencyKey optional unique, status, title/summary, ownerAdminId optional, disqualificationReason nullable, timestamps  

Never store Tenant GL, payment secrets, MRA credentials.

## Distinctness

- Separate models/API paths from Customer, SupportTicket, CsCase, Tenant Client
- Tests: creating CrmLead does not create CsCase/SupportTicket; POS `sales.*` unused

## Permissions / nav

Follow Support Wave 1 pattern in `lib/admin/permissions.js`. Map `/insightbooks/crm` → view permission. Super Admin break-glass; Platform Support / sales-like roles via JSON grants pattern if used elsewhere — do not invent POS grants.

## APIs

Follow `app/api/admin/support/tickets/route.js` patterns. List: server pagination bounded. Get by id or number.

## Tests (required)

1. Unique LEAD/ACC/CON numbering format  
2. Create Lead starts NEW; invalid transition rejected  
3. Valid path through QUALIFIED (and optionally OPPORTUNITY_READY)  
4. DISQUALIFIED requires reason  
5. CONVERTED_TO_OPPORTUNITY blocked  
6. Authz forbidden without permission  
7. List pagination bounded  
8. EMAIL/WHATSAPP channels NOT_AVAILABLE in catalogue  
9. Distinct from CsCase/SupportTicket  

## Pattern references

- Support Wave 1: `lib/admin/support/{catalogue,numbering,stateMachine,authz,tickets}.js`
- Matrices: `docs/admin-intelligence-crm/phase-11/LEAD_STATE_MATRIX.md`, `CRM_DOMAIN_MATRIX.md`, `CRM_SECURITY_MATRIX.md`
- Spec/plan: `docs/superpowers/specs|plans/2026-07-30-crm-core-phase-11*`

## Global Constraints (binding)

- Lead ≠ Opportunity ≠ Customer ≠ Support Ticket ≠ CsCase.
- CRM Account ≠ canonical Customer (link fields OK; no billing copy).
- Contact ≠ Platform User.
- Capture idempotent / consent / scoring — later waves; do not fake.
- Email/WhatsApp Lead ingest deferred.
- CoA admin route stays removed.
- **Do not git commit.** Report WORKING_TREE.
- Prisma EPERM → SQL + `hasCrm*Model` guards.

## Acceptance

- [ ] Unique LEAD/ACC/CON numbering (concurrency-safe)
- [ ] Canonical statuses + invalid transition rejection
- [ ] Distinct from Customer / SupportTicket / CsCase
- [ ] Vitest PASS

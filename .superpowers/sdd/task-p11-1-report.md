# Task P11-1 Report — Wave 1 CRM Account / Contact / Lead

**Status:** DONE  
**Commits:** WORKING_TREE (no git commit, per brief)  
**Branch:** `v2` (in-place)  
**Date:** 2026-07-30

## Summary

Implemented Phase 11 Wave 1 greenfield CRM core: `CrmAccount` / `CrmContact` / `CrmLead` + concurrency-safe numbering + Lead status state machine + admin APIs + live `systemAdmin.crm.*` permissions + nav stubs. Followed Support Wave 1 patterns. Distinct from Customer, SupportTicket, and CsCase. POS `sales.*` unused.

## Files created

### Library (`lib/admin/crm/`)
| File | Role |
|------|------|
| `catalogue.js` | Lead statuses/types/sources/channels; account types/statuses; contact roles; transition table; EMAIL/WHATSAPP `NOT_AVAILABLE`; number regexes; list limits |
| `numbering.js` | `allocateCrmNumber` — `LEAD\|ACC\|CON-YYYY-######` via `CrmNumberSeq` CAS |
| `stateMachine.js` | `canTransition` / `assertTransition` (DISQUALIFIED requires reason; CONVERTED_TO_OPPORTUNITY → `NOT_IMPLEMENTED`) |
| `authz.js` | view/create/edit/transition; owner/team/territory scope stubs (Wave 3) |
| `accounts.js` | create / list / get + `hasCrmAccountModel` |
| `contacts.js` | create / list / get (+ optional account link, email normalize) + `hasCrmContactModel` |
| `leads.js` | create / list / get / `transitionLeadStatus` + history + `hasCrmLeadModel` |
| `index.js` | Public exports |

### Other
| File | Role |
|------|------|
| `lib/admin/crmNav.js` | CRM nav stub entry |
| `scripts/sql/crm-core-phase11-wave1.sql` | Tables + indexes + idempotent FK `DO $$` blocks |
| `app/api/admin/crm/accounts/route.js` | GET/POST |
| `app/api/admin/crm/accounts/[id]/route.js` | GET |
| `app/api/admin/crm/contacts/route.js` | GET/POST |
| `app/api/admin/crm/contacts/[id]/route.js` | GET |
| `app/api/admin/crm/leads/route.js` | GET/POST |
| `app/api/admin/crm/leads/[id]/route.js` | GET |
| `app/api/admin/crm/leads/[id]/status/route.js` | POST |
| `test/systemAdmin.crm.leads.test.js` | Required Wave 1 coverage |

## Files modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `CrmNumberSeq`, `CrmAccount`, `CrmContact`, `CrmLead`, `CrmLeadStatusHistory`; Admin + Tenant relations |
| `lib/admin/permissions.js` | Live `SYSTEM_ADMIN_PERMISSIONS.crm.*` Wave 1 keys + stubs; `NAV_PERMISSION_MAP` for `/insightbooks/crm` (+ children); scaffold aliases retained |
| `lib/admin/adminNav.js` | CRM nav item from `crmNav.js` |

## Behaviour delivered

### Numbering
- Formats: `LEAD-YYYY-######`, `ACC-YYYY-######`, `CON-YYYY-######`
- UTC year; 6-digit seq per prefix/year
- `CrmNumberSeq` compound PK `(prefix, year)` + optimistic CAS (`updateMany` on `lastIssued`)
- Never recycled; immutable after create

### Lead state machine
Canonical statuses per brief (NEW … ARCHIVED). Happy path enforced:

`NEW → ASSIGNED → ACCEPTED → ATTEMPTING_CONTACT → CONTACTED → QUALIFICATION_IN_PROGRESS → QUALIFIED → OPPORTUNITY_READY`

- Manual create → `NEW`, channel `ADMIN_MANUAL`
- Invalid transitions → `{ ok: false, error: 'INVALID_TRANSITION' }` (no silent coerce)
- `DISQUALIFIED` requires `disqualificationReason`
- `CONVERTED_TO_OPPORTUNITY` blocked (`NOT_IMPLEMENTED`) — Phase 12
- Every successful create/transition appends `CrmLeadStatusHistory`

### Permissions (live Wave 1)
`view`, `viewLeads`, `createLeads`, `editLeads`, `viewAccounts`, `createAccounts`, `viewContacts`, `createContacts`, `transitionStatus`  
Stubs: `assignLeads`, `mergeLeads`, `manageConsent`, `export`, `runReconciliation`, `pipelineView`, `pipelineManage`  
Nav: `/insightbooks/crm` → `crm.view`; children → viewLeads / viewAccounts / viewContacts  
Super Admin break-glass via existing authz.

### APIs
Mirror Support ticket route shapes: auth via `getAdminFromRequest`, 401/403/404/400/503, bounded list pagination (max 100).

### Guards / EPERM
`hasCrmAccountModel` / `hasCrmContactModel` / `hasCrmLeadModel` + SQL fallback script for Windows EPERM on `prisma generate`.

## Explicitly not implemented (per brief)

- Public forms, handoff capture, scoring, qualification engine
- Teams/territories UI, consent, merge
- Opportunity create / CONVERTED_TO_OPPORTUNITY
- Email/WhatsApp Lead ingest
- Full CRM UI pages (nav stubs only)

## Tests

```text
npx vitest run test/systemAdmin.crm.leads.test.js
→ Test Files  1 passed (1)
→ Tests  11 passed (11)
```

Coverage mapped to brief requirements:

1. Unique LEAD/ACC/CON numbering format  
2. Create Lead starts NEW; invalid transition rejected  
3. Valid path through QUALIFIED and OPPORTUNITY_READY  
4. DISQUALIFIED requires reason  
5. CONVERTED_TO_OPPORTUNITY blocked  
6. Authz forbidden without permission  
7. List pagination bounded (leads/accounts/contacts)  
8. EMAIL/WHATSAPP channels NOT_AVAILABLE  
9. Distinct from CsCase/SupportTicket (+ POS sales.* unused)

## Self-review

- No Customer / SupportTicket / CsCase conflation in models or services.
- No Tenant GL / payment secrets / MRA credentials fields.
- Contact create has no national ID / bank / password fields.
- Account `customerId` / `tenantId` optional; no auto-link.
- Unrelated Phases 7–10 working-tree files left untouched.
- Did not run `prisma generate` / `db push` (EPERM risk); SQL + model guards ready.

## Concerns / follow-ups (non-blocking)

1. **Prisma client generate** — schema added; operators should run `npx prisma generate` + `db push` (or apply SQL) when file locks clear. Until then, live APIs degrade via `hasCrm*Model` → UNAVAILABLE/empty lists.
2. **Scope stubs** — owner/team/territory filtering is Wave 3; Wave 1 viewers with permission see all.
3. **Nav icon** — `Briefcase` assumed available in admin icon map; verify when CRM UI pages land.
4. **Idempotency on create** — optional `sourceIdempotencyKey` replay supported in service (Wave 2 capture will lean on this); not a full capture pipeline.

## Acceptance checklist

- [x] Unique LEAD/ACC/CON numbering (concurrency-safe)
- [x] Canonical statuses + invalid transition rejection
- [x] Distinct from Customer / SupportTicket / CsCase
- [x] Vitest PASS

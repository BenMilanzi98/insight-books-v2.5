# Task P12-1 Report — Wave 1 Pipeline + Opportunity + READY handoff create + transitions

**Status:** DONE (Important review findings fixed)  
**Commits:** WORKING_TREE (no git commit, per brief)  
**Branch:** `v2` (in-place)  
**Date:** 2026-07-30

## Summary

Implemented Phase 12 Wave 1: versioned ACTIVE `NEW_BUSINESS` Pipeline catalogue + stages, concurrency-safe `OPP-YYYY-######` numbering, Opportunity create from Phase 11 `CRM_OPPORTUNITY_HANDOFF` when `READY` (idempotent), server-governed stage transitions with immutable history, and Lead `CONVERTED_TO_OPPORTUNITY` gated solely to the Opportunity create success path. Followed Support/CRM Wave patterns (numbering CAS, state machines, SQL FK `DO $$` blocks, `has*Model` guards). Distinct from CrmLead, Customer, SupportTicket, CsCase, Subscription, Invoice, Tenant POS `sales.*`.

## Files created

### Library (`lib/admin/crm/pipeline/`)
| File | Role |
|------|------|
| `catalogue.js` | Pipeline/stage/opportunity status codes; ordered stages; handoff type |
| `definitions.js` | ACTIVE NEW_BUSINESS v1 definition; entry/exit stubs; `canTransitionStage` (sequential + terminal) |
| `stages.js` | Stage list helpers + DB/catalogue fallback |
| `transition.js` | `transitionOpportunityStage` + serialize + history + optimistic lock |
| `index.js` | `listPipelines` / `getPipeline` + public exports |

### Library (`lib/admin/crm/opportunities/`)
| File | Role |
|------|------|
| `numbering.js` | OPP prefix via `allocateCrmNumber` |
| `create.js` | `createOpportunityFromHandoff` (READY only, idempotent) |
| `leads.js` | `convertLeadAfterOpportunityCreate` (`fromOpportunityCreate` gate) |
| `get.js` / `list.js` | Get + bounded list |
| `index.js` | Public exports |

### Other new
| File | Role |
|------|------|
| `scripts/sql/crm-pipeline-phase12-wave1.sql` | Tables + indexes + seed NEW_BUSINESS + FK `DO $$` |
| `app/api/admin/crm/pipelines/route.js` | GET list |
| `app/api/admin/crm/pipelines/[id]/route.js` | GET by id/code |
| `app/api/admin/crm/opportunities/route.js` | GET list / POST create from handoff |
| `app/api/admin/crm/opportunities/[id]/route.js` | GET |
| `app/api/admin/crm/opportunities/[id]/stage/route.js` | POST `{ toStageCode, reason?, evidence?, idempotencyKey? }` |
| `test/systemAdmin.crm.pipeline.test.js` | Pipeline catalogue + transitions + OPP numbering |
| `test/systemAdmin.crm.opportunities.test.js` | READY create, idempotency, Lead convert gate, no billing invent |

## Files modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | `CrmPipeline`, `CrmPipelineVersion`, `CrmPipelineStage`, `CrmOpportunity`, `CrmOpportunityStageHistory`; Admin relations |
| `lib/admin/crm/catalogue.js` | `OPP` prefix + `CRM_OPPORTUNITY_NUMBER_RE`; transition table allows convert from QUALIFIED / OPPORTUNITY_READY |
| `lib/admin/crm/stateMachine.js` | `CONVERTED_TO_OPPORTUNITY` only when `fromOpportunityCreate` |
| `lib/admin/crm/leads.js` | Passes `fromOpportunityCreate` into assert |
| `lib/admin/crm/authz.js` | Pipeline / opportunities permissions + opportunities scope stub (`mode: 'all'`) |
| `lib/admin/crm/numbering.js` | OPP in prefix set |
| `lib/admin/crm/index.js` | Wave 1 exports |
| `lib/admin/crm/foundations.js` | Opportunity pipeline foundation status (Wave 1 honesty) |
| `lib/admin/permissions.js` | Live keys + nav map for `/pipeline` + `/opportunities` |
| `lib/admin/crmNav.js` | Nav stubs for Pipeline + Opportunities |

## Behaviour delivered

### Pipeline v1 (NEW_BUSINESS)
- ACTIVE catalogue definition with 10 stable stage codes (OPPORTUNITY_IDENTIFIED → … → CLOSED_WON / CLOSED_LOST)
- Terminal stages: CLOSED_WON, CLOSED_LOST
- Wave 1 transitions: sequential forward among open stages **or** jump to either terminal; skip-forward / same-stage / post-terminal → `INVALID_TRANSITION`
- Entry/exit criteria + `defaultProbability` stubbed on stage defs for Wave 2
- Weighted UI flag always `false`

### Opportunity create
- Requires `handoffPayload.type === 'CRM_OPPORTUNITY_HANDOFF'` and `readinessStatus === 'READY'`
- Idempotent on `handoffPayload.idempotencyKey` → existing row, `idempotent: true`
- Number: `OPP-YYYY-######` via `CrmNumberSeq` CAS (UTC year)
- Initial stage: `OPPORTUNITY_IDENTIFIED`
- Copies lead/account/contact refs; does **not** invent amount / probability / closeDate
- Never creates Tenant / Subscription / Invoice
- On success: Lead → `CONVERTED_TO_OPPORTUNITY` (history preserved)

### Lead convert gate
- Public `canTransition(..., CONVERTED_TO_OPPORTUNITY)` → `false`
- `assertTransition` / `transitionLeadStatus` without `fromOpportunityCreate` → `NOT_IMPLEMENTED`
- Opportunity create path sets `fromOpportunityCreate: true` only

### Transition service
```js
transitionOpportunityStage({ prisma, admin, opportunityId, toStageCode, reason, evidenceReferences, idempotencyKey })
```
- AuthZ: `pipeline.transitionStages` or `opportunities.edit` (Super Admin break-glass)
- Scope: Wave 1 `all` stub (documented on results)
- Optimistic lock via `version` / `updateMany`
- Exact retry on transition `idempotencyKey` → same result, no duplicate history
- Client-side stage persist forbidden (API only)

### Permissions / nav (live)
- `systemAdmin.crm.pipeline.view`
- `systemAdmin.crm.pipeline.manageDefinitions` (stub manage; no publish UI)
- `systemAdmin.crm.pipeline.transitionStages`
- `systemAdmin.crm.opportunities.view` / `create` / `edit`
- Nav + `NAV_PERMISSION_MAP`: `/insightbooks/crm/pipeline`, `/insightbooks/crm/opportunities` (UI stubs)

### Guards / EPERM
`hasCrmOpportunityModel` / `hasCrmPipelineModel` / `hasCrmPipelineStageModel` / `hasCrmOpportunityStageHistoryModel` + SQL fallback script.

## Explicitly not implemented (per brief)

- Products / commercial UI, probability overrides UI, board Kanban
- Win/loss close evidence flows, import/reports
- EXPANSION Pipeline, weighted Pipeline UI, Tenant provisioning
- Full Pipeline/Opportunity UI pages (nav stubs only)

## Tests

```text
npx vitest run test/systemAdmin.crm.pipeline.test.js test/systemAdmin.crm.opportunities.test.js test/systemAdmin.crm.leads.test.js test/systemAdmin.crm.wave4.test.js
→ Test Files  4 passed (4)
→ Tests  41 passed (41)
```

Coverage mapped to acceptance:

1. Versioned NEW_BUSINESS Pipeline + stages + entry/exit basics  
2. Unique OPP numbering; READY handoff create idempotent  
3. Server transition; invalid denied; history appended; transition idempotency  
4. Lead `CONVERTED_TO_OPPORTUNITY` only after Opp create (direct path still blocked)  
5. Create does not create Subscription / Invoice / Tenant  
6. Existing Lead convert-block + Wave 4 readiness tests still PASS  

## Self-review

| Check | Result |
|-------|--------|
| Acceptance checklist | Met |
| Distinctness (Lead/Customer/Support/CS/POS/billing) | Preserved |
| No invented amounts / weighted UI | Confirmed |
| Scope stub documented | `scopeMode: 'all'`, `scopeStub: true` |
| Prisma EPERM path | SQL + has*Model guards |
| Unrelated Phase 7–11 files | Not reverted |
| Git commit | None (WORKING_TREE) |

## Concerns / follow-ups

1. **Prisma generate / db push** may still hit Windows EPERM — apply `scripts/sql/crm-pipeline-phase12-wave1.sql` then retry generate; app degrades via model guards until client methods exist.
2. **Owner/team/territory scope** remains permissive `all` stub for opportunities (Wave 1 documented); real filtering later.
3. **UI pages** for `/pipeline` and `/opportunities` are nav stubs only — board/list land in Wave 3.
4. **`pipeline.manage`** legacy scaffold key retained alongside live `manageDefinitions`.
5. **Lead convert** (fixed in Fix pass): create path elevates via `canCreateOpportunities` after Opp verification; convert failure fails the create and compensates.

## Acceptance

- [x] Versioned NEW_BUSINESS Pipeline + stages + entry/exit basics
- [x] Unique OPP numbering; READY handoff create idempotent
- [x] Server transition service; invalid denied; history appended
- [x] Lead CONVERTED_TO_OPPORTUNITY only after Opp create
- [x] Vitest PASS

## Fix pass

**Date:** 2026-07-30  
**Source:** Important findings in `task-p12-1-review.md`  
**Commits:** WORKING_TREE (no git commit)

### Fixes

1. **Opportunity-gated Lead convert** (`lib/admin/crm/opportunities/leads.js`)
   - `convertLeadAfterOpportunityCreate` requires `opportunityId`, loads the Opportunity, and rejects unless `opportunity.leadId === leadId` (`OPPORTUNITY_REQUIRED` / `OPPORTUNITY_LEAD_MISMATCH`).
   - Convert no longer relies solely on a caller-supplied `fromOpportunityCreate` boolean via public `transitionLeadStatus`.
   - Helper removed from CRM public exports (`lib/admin/crm/index.js`, `opportunities/index.js`); importable only from `create.js` (module-private surface).
   - AuthZ elevated for create path: `canTransitionStatus` **or** `canCreateOpportunities` after Opp verification.

2. **Create fail-closed on Lead conversion failure** (`lib/admin/crm/opportunities/create.js`)
   - If convert returns not-ok or throws, create compensates (delete stage history + Opportunity) and returns `ok: false` with `error: 'lead_conversion_failed'` / `code: 'LEAD_CONVERSION_FAILED'`.
   - No bare success leaving Lead unconverted after Opp create.

3. **Exact transition idempotency** (`lib/admin/crm/pipeline/transition.js`)
   - On history key hit for the same Opportunity, requires `prior.toStageCode === toStageCode`.
   - Mismatched target → `ok: false`, `error: 'IDEMPOTENCY_KEY_CONFLICT'` (does not return prior success for wrong stage).

### Tests added/adjusted

- Opp: convert without/mismatched Opportunity blocked; create compensates when convert fails.
- Pipeline: same idempotencyKey with different `toStageCode` → conflict; mocks gained `crmLead.findMany` + delete helpers for fail-closed create path.

### Verify

```text
npx vitest run test/systemAdmin.crm.pipeline.test.js test/systemAdmin.crm.opportunities.test.js test/systemAdmin.crm.leads.test.js
→ Test Files  3 passed (3)
→ Tests  33 passed (33)
```

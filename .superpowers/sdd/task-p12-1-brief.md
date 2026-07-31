### Task 1: Wave 1 — Pipeline + Opportunity + handoff create + transitions

**Depends on:** Phase 11 CRM WORKING_TREE (`lib/admin/crm/opportunityReadiness.js` → `CRM_OPPORTUNITY_HANDOFF`).

**Files (create / extend):**
- `lib/admin/crm/pipeline/{catalogue,definitions,stages,transition,index}.js` — NEW_BUSINESS Pipeline v1; stages; entry/exit criteria; `transitionOpportunityStage`
- `lib/admin/crm/opportunities/{numbering,create,leads,get,list,index}.js` — OPP-YYYY-######; create from READY handoff; list/get
- Extend `lib/admin/crm/authz.js`, `catalogue.js`, `index.js`, permissions/nav for pipeline + opportunities
- Prisma: `CrmPipeline`, `CrmPipelineVersion`, `CrmPipelineStage`, `CrmOpportunity`, `CrmOpportunityStageHistory` (+ number seq)
- SQL: `scripts/sql/crm-pipeline-phase12-wave1.sql` (FK DO $$ parity)
- APIs under `app/api/admin/crm/`:
  - `pipelines` GET; `pipelines/[id]` GET
  - `opportunities` GET/POST (create from handoff); `opportunities/[id]` GET
  - `opportunities/[id]/stage` POST `{ toStageCode, reason?, evidence?, idempotencyKey? }`
- Wire Lead status → `CONVERTED_TO_OPPORTUNITY` only after successful Opportunity create (use existing state machine; unblock conversion path for this transition only)
- Tests: `test/systemAdmin.crm.pipeline.test.js`, `test/systemAdmin.crm.opportunities.test.js`

**Do NOT:** products/commercial UI, probability overrides UI, board Kanban, win/loss close, import/reports, EXPANSION Pipeline, weighted Pipeline UI, Tenant provisioning.

## Pipeline v1 (NEW_BUSINESS)

Seed one ACTIVE Pipeline version with ordered stages (codes stable):

1. `OPPORTUNITY_IDENTIFIED`
2. `DISCOVERY`
3. `NEED_CONFIRMED`
4. `SOLUTION_FIT`
5. `COMMERCIAL_SCOPING`
6. `DECISION_PROCESS`
7. `PROPOSAL_READY`
8. `CUSTOMER_DECISION`
9. `CLOSED_WON` (terminal)
10. `CLOSED_LOST` (terminal)

Entry to later stages may require: Account linked, primary Contact linked, reason on skip-forward if allowed. Minimal v1: sequential forward only + terminal CLOSED_*; invalid transitions → `INVALID_TRANSITION`. Every success appends immutable stage history.

Default stage probabilities may be stored on stage defs for Wave 2 — optional stub fields OK in Wave 1.

## Opportunity create

- Only from Phase 11 readiness result with `status === 'READY'` and valid `handoffPayload` (`type: 'CRM_OPPORTUNITY_HANDOFF'`)
- Idempotency: same `handoffPayload.idempotencyKey` → return existing Opportunity (`idempotent: true`)
- Number: `OPP-YYYY-######` concurrency-safe (UTC year)
- Initial stage: `OPPORTUNITY_IDENTIFIED`
- Copy lead/account/contact refs from payload; do not invent amounts/probability/close dates
- After create: transition Lead to `CONVERTED_TO_OPPORTUNITY` (history preserved)
- Reject unqualified / not READY with clear error
- Never create Tenant/Subscription/Invoice

## Transition service

```js
transitionOpportunityStage({ prisma, admin, opportunityId, toStageCode, reason, evidenceReferences, idempotencyKey })
```

- AuthZ: pipeline.transitionStages / opportunities.edit (as defined)
- Validate scope (Wave 1 may still be `all` stub — document)
- Optimistic locking if `version`/`updatedAt` available
- Exact retry on transition idempotencyKey → same result, no duplicate history
- Drag-and-drop clients must call this API; no client-side stage persist

## Permissions / nav

Promote live keys:
- `systemAdmin.crm.pipeline.view`, `manageDefinitions` (stub manage), `transitionStages`
- `systemAdmin.crm.opportunities.view`, `create`, `edit`
Map `/insightbooks/crm/pipeline`, `/insightbooks/crm/opportunities` (+ stubs). Add nav items in `crmNav.js` / `adminNav.js`.

## Distinctness

- Separate from CrmLead, Customer, SupportTicket, CsCase, POS sales
- Tests: Opportunity create does not create Subscription/Invoice; Lead convert only after Opp create

## Pattern references

- Phase 11: `opportunityReadiness.js`, `numbering.js`, `stateMachine.js`, Support transition patterns
- Matrices: `docs/admin-intelligence-crm/phase-12/STAGE_TRANSITION_MATRIX.md`, `OPPORTUNITY_DOMAIN_MATRIX.md`
- Spec/plan Phase 12

## Global Constraints (binding)

- Opportunity value ≠ Revenue; no amounts invented in Wave 1
- Stage history immutable; no silent FX; CoA stays removed
- Weighted UI disabled (do not expose)
- **Do not git commit.** WORKING_TREE
- Prisma EPERM → SQL + `hasCrmOpportunityModel` guards

## Acceptance

- [ ] Versioned NEW_BUSINESS Pipeline + stages + entry/exit basics
- [ ] Unique OPP numbering; READY handoff create idempotent
- [ ] Server transition service; invalid denied; history appended
- [ ] Lead CONVERTED_TO_OPPORTUNITY only after Opp create
- [ ] Vitest PASS

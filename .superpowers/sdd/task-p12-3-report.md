# Task P12-3 Report — Wave 3 Board/UI + risks/tasks/timeline + win/loss + readiness

**Status:** DONE  
**Commits:** WORKING_TREE (no git commit, per brief)  
**Branch:** in-place workspace  
**Date:** 2026-07-30

## Summary

Implemented Phase 12 Wave 3 on Waves 1–2: bounded Pipeline board (accessible stage selector; server-authorised transitions; restore on failure), Opportunity list/detail/new + My Pipeline UI, deterministic Opportunity risk signals, Opportunity-scoped tasks + paginated timeline, Closed Won (evidence + win reason + decision date) / Closed Lost (loss reason) with reopen policy and `assertNoProvision()`, and proposal/conversion readiness checklists that emit typed handoff payloads only (never create Proposal or execute Tenant conversion). Weighted UI remains dark.

## Files created

### Library (`lib/admin/crm/opportunities/`)
| File | Role |
|------|------|
| `board.js` | Bounded per-column board (`BOARD_COLUMN_PAGE_SIZE=25`) |
| `risks.js` | Deterministic risk signals + optional `CrmOpportunityRisk` persist |
| `tasks.js` | Opportunity-scoped CrmTask wrappers (no Lead auto-clone) |
| `timeline.js` | Paginated stage history + OPPORTUNITY timeline merge |
| `close.js` | CLOSED_WON / CLOSED_LOST / reopen + `assertNoProvision` |
| `proposalReadiness.js` | Checklist + `CRM_PROPOSAL_HANDOFF` (never creates Proposal) |
| `conversionReadiness.js` | Checklist + `CRM_CONVERSION_HANDOFF` (never provisions) |

### SQL / APIs / UI / tests
| File | Role |
|------|------|
| `scripts/sql/crm-pipeline-phase12-wave3.sql` | Close columns + `CrmOpportunityRisk` + FK `DO $$` |
| `app/api/admin/crm/pipeline/board/route.js` | GET board |
| `app/api/admin/crm/opportunities/[id]/close/route.js` | POST WON/LOST/REOPEN |
| `app/api/admin/crm/opportunities/[id]/risks/route.js` | GET/POST risks |
| `app/api/admin/crm/opportunities/[id]/tasks/route.js` | GET/POST tasks |
| `app/api/admin/crm/opportunities/[id]/timeline/route.js` | GET timeline |
| `app/api/admin/crm/opportunities/[id]/proposal-readiness/route.js` | POST evaluate |
| `app/api/admin/crm/opportunities/[id]/conversion-readiness/route.js` | POST evaluate |
| `app/insightbooks/crm/pipeline/**` | overview, board, list, my-pipeline |
| `app/insightbooks/crm/opportunities/**` | list, detail, new |
| `components/admin/crm/CrmPipelineBoardView.jsx` | Board + accessible stage select |
| `components/admin/crm/CrmOpportunitiesView.jsx` | List |
| `components/admin/crm/CrmOpportunityDetailView.jsx` | Detail / close / risks / readiness |
| `components/admin/crm/CrmOpportunityNewView.jsx` | Create from READY handoff |
| `test/systemAdmin.crm.opportunityWave3.test.js` | Wave 3 acceptance coverage |

## Files modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Close fields on Opportunity + `CrmOpportunityRisk` + Admin relations |
| `lib/admin/crm/pipeline/transition.js` | Terminal stages require `closeServiceAuthorized` (`USE_CLOSE_SERVICE`) |
| `lib/admin/crm/opportunities/model.js` | Serialize close/reopen fields |
| `lib/admin/crm/opportunities/list.js` | `myPipeline` / owner / status filters |
| `lib/admin/crm/opportunities/index.js` + `lib/admin/crm/index.js` | Wave 3 exports |
| `lib/admin/crm/catalogue.js` | `OPPORTUNITY` subject + timeline event types |
| `lib/admin/crm/tasks.js` | Authz allows Opportunity view/edit |
| `lib/admin/crm/foundations.js` | Wave 3 foundation contract |
| `lib/admin/crmNav.js` | Pipeline/Opportunities `live` |
| `lib/admin/permissions.js` | Route gates for new pages |
| `components/admin/index.js` | Export new views |
| `locales/en|ny/admin-pages.json` + `admin-shell.json` | Pipeline/Opportunity i18n |
| `app/api/admin/crm/opportunities/route.js` | List filters |
| `test/systemAdmin.crm.pipeline.test.js` | Terminal close via close service |

## Behaviour delivered

### Board / UI
- Bounded columns; permission-scoped; My Pipeline owner filter
- Accessible `<select>` stage change (non-drag); POSTs `/stage`; restores on failure; surfaces `missingCriteria`
- List + detail + new; weighted amounts not shown (`weightedUiEnabled: false`)

### Close
- Direct `CLOSED_*` transitions denied (`USE_CLOSE_SERVICE`)
- Won: evidence + winReason + decisionDate; optional approval stub
- Lost: lossReason required
- Terminal status sync; reopen with reason → `CUSTOMER_DECISION`
- `assertNoProvision()` — never Tenant/Subscription/Invoice/Payment

### Risks / tasks / timeline
- Deterministic signals (no ML / not Support-CS health)
- Tasks use `subjectType=OPPORTUNITY`; no Lead task auto-clone
- Timeline merges immutable stage history + activity; no Support/CS threads

### Readiness
- Proposal / conversion checklists + idempotent handoff payloads
- `proposalCreated` / `conversionExecuted` always false

## Explicitly not implemented (per brief)

- Weighted UI enablement (Phase 16)
- Import / reports / EXPANSION Pipeline (Wave 4)
- ML scoring; auto outbound; Tenant provisioning

## Tests

```text
npx vitest run test/systemAdmin.crm.pipeline.test.js test/systemAdmin.crm.opportunities.test.js test/systemAdmin.crm.leads.test.js test/systemAdmin.crm.opportunityWave2.test.js test/systemAdmin.crm.opportunityWave3.test.js
→ Test Files  5 passed (5)
→ Tests  54 passed (54)
```

Coverage mapped to acceptance:

1. Board bounded; accessible non-drag; server transition denial without close service  
2. Closed Won evidence; no provision  
3. Proposal/conversion readiness payloads only  
4. Risks + Opportunity tasks  
5. Prior pipeline / opportunities / leads / Wave 2 suites remain green  

## Self-review

| Check | Result |
|-------|--------|
| Acceptance checklist | Met |
| No Tenant/Subscription/Invoice on close | Confirmed |
| Weighted UI flag false | Confirmed |
| Prisma EPERM path | SQL + has*Model guards |
| Git commit | None (WORKING_TREE) |

## Concerns / follow-ups

1. **Prisma generate / db push** may still hit Windows EPERM — apply `scripts/sql/crm-pipeline-phase12-wave3.sql` after Wave 1–2 SQL, then retry generate.
2. **Owner scope** still `mode: 'all'` stub for non–My Pipeline viewers (Phase 12 blocker carried).
3. **Close update + stage transition** are not a single DB transaction (same pattern as Wave 1 history).
4. **Import/reports/EXPANSION** remain Wave 4.

## Acceptance

- [x] Board bounded; accessible non-drag; server transition
- [x] Closed Won evidence; no provision
- [x] Proposal/conversion readiness payloads only
- [x] Vitest PASS (+ prior opp suites green)

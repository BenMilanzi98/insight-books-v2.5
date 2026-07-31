# Task P14-2 Report — Wave 2 Agenda / Script / Scenario / Content versioning

**Status:** DONE  
**Date:** 2026-07-30  
**Branch:** v2 WORKING_TREE  
**Commit:** none (per brief)

## Acceptance

| Item | Result |
|------|--------|
| Versioned Agenda/Script/Scenario/Content; ACTIVE immutable in place | PASS |
| SoD approve where material (author ≠ approver) | PASS (`demo_content_self_approval_blocked`) |
| Restricted Script projection protected | PASS (CUSTOMER/INVITATION fail-closed) |
| Demo pins versions; historical pin retained | PASS |
| Vitest PASS (Wave 2 + Wave 1 green) | PASS |

## Interfaces delivered

- `createAgendaVersion` / `updateAgendaVersion` / `requestAgendaApproval` / `approveAgendaVersion` / `listAgendaVersions` / `projectAgendaForSurface` / `pinAgendaToDemo`
- `createScriptVersion` / `updateScriptVersion` / `requestScriptApproval` / `approveScriptVersion` / `listScriptVersions` / `projectScriptForSurface` / `pinScriptToDemo`
- `createScenarioVersion` / `updateScenarioVersion` / `requestScenarioApproval` / `approveScenarioVersion` / `listScenarioVersions` / `pinScenarioToDemo`
- `createContentVersion` / `updateContentVersion` / `requestContentApproval` / `approveContentVersion` / `listContentVersions` / `pinContentToDemo`
- Shared helpers in `demos/versioning.js` (safe text/JSON, SoD, retire prior ACTIVE)
- Catalogue: `CRM_DEMO_VERSION_STATUS`, `CRM_DEMO_CONTENT_CLASSIFICATION`, `CRM_DEMO_CONTENT_KIND`, `CRM_DEMO_PROJECTION_SURFACE`
- `getDemoDomainContract()` → `wave: 2`, `restrictedScriptOnCustomerForbidden`, `activeDirectlyEditable: false`

## Files (primary)

**Lib**
- `lib/admin/crm/demos/versioning.js`, `agendas.js`, `scripts.js`, `scenarios.js`, `content.js`
- Updated: `catalogue.js`, `model.js`, `readiness.js`, `index.js`
- Extended: `lib/admin/crm/catalogue.js`, `index.js`, `foundations.js`

**Prisma / SQL**
- `prisma/schema.prisma` — `CrmDemoAgenda`, `CrmDemoScript`, `CrmDemoScenario`, `CrmDemoContent` + Demo pin columns + Admin relations
- `scripts/sql/crm-demo-phase14-wave2.sql`

**APIs**
- `app/api/admin/crm/demo-agendas/`, `demo-scripts/`, `demo-scenarios/`, `demo-content/`
- Demo actions: `pin-agenda` | `pin-script` | `pin-scenario` | `pin-content` on `demos/[id]/[action]`

**UI (thin stubs)**
- `/insightbooks/crm/demos/[id]/agenda|script|content`
- en/ny locale keys

**Tests**
- `test/systemAdmin.crm.demoWave2.test.js` (new)

## Tests run

```text
npx vitest run test/systemAdmin.crm.demoWave2.test.js test/systemAdmin.crm.demoWave1.test.js
→ 2 files, 19 tests PASS
```

## Self-review

- ACTIVE rows reject in-place edit; create new version + SoD approve to replace ACTIVE (prior → RETIRED).
- SoD mirrors Phase 13 automation/templates pattern: author ≠ approver on material approve.
- RESTRICTED Script never returned on CUSTOMER/INVITATION surfaces; Internal needs restricted privilege.
- Agenda invitation projection exposes `customerSafeSummary` only (no `itemsJson`).
- Demo pin stores version ids; approving a newer ACTIVE for same code does not rewrite historical pins.
- No executable template expressions (`${}`, backticks, script tags, eval).
- en/ny script `labelsJson` foundations OK; AI script generation forbidden in contract.
- Environments / delivery / recording / Proposal create out of scope (Wave 3–4).

## Concerns (non-blocking)

1. **Prisma client generate not run** — schema + SQL shipped; Windows EPERM may require SQL apply + `hasCrm*Model` guards (already used).
2. **UI hubs are stubs** — agenda/script/content pages use `CrmStubView`; APIs are live.
3. **Readiness agenda/script pins remain INFO** — not blockers for READY_TO_DELIVER (honesty; Env/checklist still Wave 3).

## Not done (explicit)

- Git commit
- Environments / checklists / rehearsals (Wave 3)
- Delivery / recording / feedback / outcome / Proposal create (Wave 4)

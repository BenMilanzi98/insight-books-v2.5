# Task P14-3 Report — Wave 3 Logical Environment + data packs + checklist/rehearsal



**Status:** DONE  

**Date:** 2026-07-30  

**Branch:** v2 WORKING_TREE  

**Commit:** none (per brief)



## Acceptance



| Item | Result |

|------|--------|

| DENV numbers; provision/reset idempotent; expiry; DEMO banner | PASS |

| Production data/credentials rejected | PASS |

| Checklist/rehearsal block readiness on Critical fails | PASS (when configured) |

| Vitest PASS (Wave 3 + Waves 1–2 green) | PASS |



## Interfaces delivered



- `allocateDemoEnvironmentNumber` — `DENV-YYYY-######`

- `requestDemoEnvironment` / `approveDemoEnvironment` (SoD) / `provisionDemoEnvironment` / `runDemoEnvironmentHealthCheck` / `resetDemoEnvironment` / `deprovisionDemoEnvironment` / `getDemoEnvironment` / `listDemoEnvironments`

- `evaluateLogicalEnvironmentHealth` — READY only after approved provision path + health; never invent READY

- `validateDataPackSource` / `createDataPackVersion` / `updateDataPackVersion` / `requestDataPackApproval` / `approveDataPackVersion` / `listDataPackVersions`

- `createChecklistVersion` … `approveChecklistVersion` / `pinChecklistToDemo` / `executeDemoChecklist`

- `recordDemoRehearsal` / `listDemoRehearsals`

- `configureDemoReadinessRequirements` + readiness gates: `logical_environment`, `checklist_gate`, `rehearsal_gate` (opt-in via Demo flags)

- Catalogue: `CRM_DEMO_ENVIRONMENT_*`, `CRM_DEMO_DATA_PACK_SOURCE_KIND`, `CRM_DEMO_CHECKLIST_EXECUTION_*`, `CRM_DEMO_REHEARSAL_*`, `CRM_DEMO_ISSUE_SEVERITY`, `CRM_NUMBER_PREFIX.DENV`

- `getDemoDomainContract()` → `wave: 3`, `cloudDemoInfra: NOT_AVAILABLE`, `inventEnvironmentReadyForbidden`, `productionDataPackForbidden`, `demoBannerRequired`, `expiryRequired`



## Files (primary)



**Lib**

- `lib/admin/crm/demos/environments.js`, `dataPacks.js`, `checklists.js`, `rehearsals.js`

- Updated: `catalogue.js`, `numbering.js`, `model.js`, `readiness.js`, `service.js`, `index.js`

- Extended: `lib/admin/crm/catalogue.js`, `index.js`, `foundations.js`



**Prisma / SQL**

- `prisma/schema.prisma` — `CrmDemoEnvironment`, `CrmDemoDataPack`, `CrmDemoChecklist`, `CrmDemoChecklistExecution`, `CrmDemoRehearsal` + Demo gate columns + Admin relations

- `scripts/sql/crm-demo-phase14-wave3.sql`



**APIs**

- `app/api/admin/crm/demo-environments/`, `demo-data-packs/`, `demo-checklists/`, `demo-rehearsals/`

- Demo actions: `configure-readiness` | `pin-checklist` | `execute-checklist` | `record-rehearsal`



**UI (thin stubs)**

- `/insightbooks/crm/demos/[id]/environment|checklist`

- `/insightbooks/crm/demos/environments`, `data-packs`

- en/ny locale keys



**Tests**

- `test/systemAdmin.crm.demoWave3.test.js` (new)

- Wave 2 domain-contract assertion updated for `wave: 3`



## Tests run



```text

npx vitest run test/systemAdmin.crm.demoWave3.test.js test/systemAdmin.crm.demoWave2.test.js test/systemAdmin.crm.demoWave1.test.js

→ 3 files, 27 tests PASS

```



## Self-review



- Logical READY only via REQUESTED → APPROVED → PROVISIONING → health → READY; direct READY invent forbidden.

- Expiry required on request; expired health → EXPIRED status (blocks READY).

- DEMO banner always true on provision/reset; cloud status always `NOT_AVAILABLE`; MRA EIS / Production Tenant alias rejected.

- Provision/reset/deprovision idempotent via dedicated idempotency keys.

- Data packs: versioned + checksum; Production source kinds, credential keys, production signals rejected.

- Checklist Critical fails and rehearsal Critical issues block readiness when `requires*` configured; unconfigured demos keep Wave 1–2 readiness (gates INFO).

- Never aliases MRA EIS sandbox as Demo Environment.



## Concerns (non-blocking)



1. **Prisma client generate not run** — schema + SQL shipped; Windows EPERM may require SQL apply + `hasCrm*Model` guards (already used).

2. **UI hubs are stubs** — environment/checklist/data-packs pages use `CrmStubView`; APIs are live.

3. **Readiness gates opt-in** — `requiresLogicalEnvironment` / `requiresChecklist` / `requiresRehearsal` default false so Waves 1–2 demos stay green; configure via create flags or `configureDemoReadinessRequirements`.



## Not done (explicit)



- Git commit

- Real cloud/container Demo infra

- Recording provider

- Delivery / attendance / feedback / outcome reports

- Proposal create



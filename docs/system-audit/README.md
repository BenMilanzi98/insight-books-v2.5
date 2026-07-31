# InsightBooks V2 — System-Wide Forensic Audit

| Field | Value |
|---|---|
| Audit type | Repository discovery + code review + artifact cross-reference |
| Scope | Full application (UI, API, lib, Prisma, jobs, flags, tests) |
| Branch | `v2` |
| Inventory generated | 2026-07-22 (`artifacts/system-audit/inventory-counts.json`) |
| Document status | **DRAFT — baseline in progress** |

---

## Purpose

This folder documents a **system-wide forensic audit** of InsightBooks V2: what exists in the repository, how major modules connect, known defects, and release readiness — without claiming exhaustive manual end-to-end verification of every screen and API.

Phase 1 accounting forensic audit (`docs/accounting-audit/`) remains the authoritative deep dive on GL/journal integrity. This audit **extends** that work to the whole product surface.

---

## Honesty about scope

**What this audit claims**

- Accurate **inventory counts** from `artifacts/system-audit/inventory-counts.json` (regeneratable via `node scripts/generate-system-audit-inventory.cjs`).
- **Code-presence** assessment for V2 modules (routes, lib packages, migrations, tests exist).
- **Known defect seeding** from regression catalogue and phase evidence indexes.
- Cross-links to existing phase frameworks (16 QA, 17 performance, 18 cutover).

**What this audit does NOT claim**

- The entire application was **manually tested end-to-end** in a browser or against production.
- **Full green `npm test`** — baseline failure count is **UNKNOWN** until a fresh CI run is recorded in `SYSTEM_DEFECT_REGISTER.md`.
- **Production cutover executed** — Phase 18 status is **NOT EXECUTED**.
- **Zero-defect certification** — see `RELEASE_READINESS_REPORT.md` and `FINAL_SYSTEM_AUDIT_REPORT.md`.
- **Phase 17 capacity certified** — status is **NOT CERTIFIED** per `docs/performance-reliability/CAPACITY_CERTIFICATION.md`.

---

## Methodology

1. **Inventory generation** — glob walk of `app/**/page.js`, `app/api/**/route.js`, Prisma models/migrations, `test/**`, top-level `lib/*` modules; output to `artifacts/system-audit/inventory-counts.json`.
2. **Route sampling** — major V2 namespaces enumerated in `ROUTE_AND_ENDPOINT_MATRIX.md`; full list lives in the inventory artifact.
3. **Feature matrix** — CRUD / approve / post columns filled from **static code review** (`REVIEWED_CODE`), partial wiring (`PARTIAL`), or gaps (`UNKNOWN`). Not from live QA sign-off.
4. **Integration matrix** — required cross-module links marked **PENDING** until full e2e rehearsal.
5. **Defect register** — seeded with evidenced items only; baseline npm test run to append findings.
6. **Database forensics** — schema/migration review + existing scripts (`scripts/accounting-forensic-audit.mjs`, `scripts/validate-data-integrity.js`); production run **PENDING**.
7. **Regression linkage** — permanent regressions in `test/qa/regression/defect.regressions.test.js` documented in `KNOWN_DEFECT_REGRESSION_REPORT.md`.

---

## Document index

### Core deliverables

| Document | Description |
|---|---|
| [COMPLETE_SYSTEM_INVENTORY.md](./COMPLETE_SYSTEM_INVENTORY.md) | Pages, APIs, models, migrations, lib, jobs, flags |
| [ROUTE_AND_ENDPOINT_MATRIX.md](./ROUTE_AND_ENDPOINT_MATRIX.md) | Methodology + V2 route samples |
| [COMPLETE_FEATURE_MATRIX.md](./COMPLETE_FEATURE_MATRIX.md) | Module × CRUD/approve/post (code presence) |
| [MODULE_INTEGRATION_MATRIX.md](./MODULE_INTEGRATION_MATRIX.md) | Cross-module integration validation |
| [SYSTEM_DEFECT_REGISTER.md](./SYSTEM_DEFECT_REGISTER.md) | Open/closed defects (evidence-based) |
| [DATABASE_FORENSIC_REPORT.md](./DATABASE_FORENSIC_REPORT.md) | Prisma PG schema forensics |
| [DATA_INTEGRITY_REPORT.md](./DATA_INTEGRITY_REPORT.md) | FK/orphan/balance validation status |
| [ACCOUNTING_ENGINE_VALIDATION.md](./ACCOUNTING_ENGINE_VALIDATION.md) | Posting engine paths + test coverage |
| [KNOWN_DEFECT_REGRESSION_REPORT.md](./KNOWN_DEFECT_REGRESSION_REPORT.md) | Permanent QA regressions |
| [RELEASE_READINESS_REPORT.md](./RELEASE_READINESS_REPORT.md) | Gate status — **NOT READY** |
| [REMAINING_RISK_REGISTER.md](./REMAINING_RISK_REGISTER.md) | Residual risks |
| [FINAL_SYSTEM_AUDIT_REPORT.md](./FINAL_SYSTEM_AUDIT_REPORT.md) | Executive conclusion |

### Supporting stubs (§48 scaffold)

| Document | Description |
|---|---|
| [EXECUTIVE_SUMMARY.md](./EXECUTIVE_SUMMARY.md) | Management summary stub |
| [CURRENT_ARCHITECTURE.md](./CURRENT_ARCHITECTURE.md) | Runtime architecture stub |
| [REPOSITORY_MAP.md](./REPOSITORY_MAP.md) | Source tree map stub |
| [API_SECURITY_AUDIT.md](./API_SECURITY_AUDIT.md) | API authz review stub |
| [AUTHENTICATION_AUTHORIZATION_AUDIT.md](./AUTHENTICATION_AUTHORIZATION_AUDIT.md) | Auth model stub |
| [MULTI_TENANT_AUDIT.md](./MULTI_TENANT_AUDIT.md) | Tenant isolation stub |
| [FRONTEND_SURFACE_AUDIT.md](./FRONTEND_SURFACE_AUDIT.md) | UI page inventory stub |
| [BACKGROUND_JOBS_AUDIT.md](./BACKGROUND_JOBS_AUDIT.md) | Cron/job review stub |
| [FEATURE_FLAG_INVENTORY.md](./FEATURE_FLAG_INVENTORY.md) | Server flags stub |
| [TEST_COVERAGE_REPORT.md](./TEST_COVERAGE_REPORT.md) | Test inventory stub |
| [PERFORMANCE_BASELINE_REPORT.md](./PERFORMANCE_BASELINE_REPORT.md) | Latency/load stub |
| [PHASE_16_17_18_FRAMEWORK_STATUS.md](./PHASE_16_17_18_FRAMEWORK_STATUS.md) | Phase gate summary stub |
| [ARTIFACT_INDEX.md](./ARTIFACT_INDEX.md) | Generated artifacts index stub |

---

## Related phase documentation

| Phase | Folder |
|---|---|
| 1 Accounting audit | `docs/accounting-audit/` |
| 16 QA | `docs/quality-assurance/` |
| 17 Performance | `docs/performance-reliability/` |
| 18 Cutover | `docs/production-cutover/` |

---

## Refresh inventory

```bash
node scripts/generate-system-audit-inventory.cjs
```

Re-read `artifacts/system-audit/inventory-counts.json` after generation before updating count tables in this folder.

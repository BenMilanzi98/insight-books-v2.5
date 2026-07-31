#!/usr/bin/env node
/**
 * Generates docs/production-cutover/ Phase 18 documentation scaffold.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'docs', 'production-cutover');
fs.mkdirSync(ROOT, { recursive: true });

const META = {
  phase: 18,
  branch: 'v2',
  cutoverStatus: 'NOT EXECUTED',
  latestMigration: '20260721200000_security_governance_v2',
  migrationCount: '~109',
  capacityCert: 'NOT CERTIFIED',
  phase16Test: 'PARTIAL — test/qa scaffolding green; full npm test / rehearsal sign-off UNKNOWN',
  productionEnv: 'UNKNOWN (no production SSH from developer workspace)',
  date: 'July 2026',
};

function H(title, status = 'DRAFT') {
  return `# ${title}

| Field | Value |
|---|---|
| Phase | 18 — Production cutover |
| Document status | **${status}** |
| Cutover execution | **${META.cutoverStatus}** |
| Branch | \`${META.branch}\` |
| Latest Prisma migration | \`${META.latestMigration}\` (${META.migrationCount} folders) |
| Last updated | ${META.date} |

---

`;
}

function stub(title, purpose, sectionRef) {
  return `${H(title, 'STUB — pending production inputs')}## Purpose

${purpose}

## Scope

Applies to InsightBooks V2 production migration on branch \`${META.branch}\`. **No production hostnames, backup IDs, migration run IDs, row counts, or financial totals are recorded until filled from live execution.**

## Prerequisites

- Phase 16 QA scaffolding: **green** (\`test/qa/**\`); full \`npm test\` / rehearsal: **${META.phase16Test}**
- Phase 17 capacity: **${META.capacityCert}** — see \`docs/performance-reliability/CAPACITY_CERTIFICATION.md\`
- Migration scope freeze: **DRAFT** — see \`MIGRATION_SCOPE_FREEZE.md\`

## TO FILL FROM PRODUCTION

| Field | Value |
|---|---|
| Environment | _PENDING_ |
| Migration Run ID | _PENDING_ |
| Executed by | _PENDING_ |
| Evidence artifact path | _PENDING_ |

## Procedure (outline)

1. Complete \`PRE_MIGRATION_DIAGNOSTIC_REPORT.md\` on a production copy.
2. Execute governed steps in \`MIGRATION_GOVERNANCE.md\`.
3. Record deviations in \`MIGRATION_EXCEPTION_REGISTER.md\`.
4. Update \`*_CONTROL_TOTALS.md\` as applicable.

## Related documents

- \`README.md\` · \`STOP_CONDITIONS.md\` · \`ROLLBACK_STRATEGY.md\`
- Phase 18 master prompt section **§${sectionRef}**
`;
}

const ALL_FILES = [
  'README.md', 'PHASE_1_TO_17_EVIDENCE_INDEX.md', 'PRODUCTION_ENVIRONMENT_INVENTORY.md',
  'PRODUCTION_DATA_FLOW_MAP.md', 'PRODUCTION_DEPENDENCY_MAP.md', 'PHASE_18_TASKS.md',
  'MIGRATION_GOVERNANCE.md', 'MIGRATION_SCOPE_FREEZE.md', 'PRODUCTION_DATA_INVENTORY.md',
  'DATA_DOMAIN_CLASSIFICATION.md', 'MIGRATION_MANIFEST.md', 'LEGACY_ID_MAPPING.md',
  'DATA_TRANSFORMATION_REGISTRY.md', 'SOURCE_DATA_SNAPSHOT.md', 'PRE_MIGRATION_DIAGNOSTIC_REPORT.md',
  'MIGRATION_EXCEPTION_REGISTER.md', 'FINANCIAL_CONTROL_TOTALS.md', 'SECURITY_CONTROL_TOTALS.md',
  'DOCUMENT_CONTROL_TOTALS.md', 'PRODUCTION_BACKUP_PLAN.md', 'BACKUP_EXECUTION_REPORT.md',
  'BACKUP_INTEGRITY_VERIFICATION.md', 'BACKUP_RESTORE_VERIFICATION.md',
  'FINAL_MIGRATION_REHEARSAL_REPORT.md', 'CUTOVER_STRATEGY.md', 'BUSINESS_MIGRATION_WAVES.md',
  'CUTOVER_WINDOW_PLAN.md', 'MAINTENANCE_MODE.md', 'LEGACY_WRITE_FREEZE.md',
  'DELTA_MIGRATION_STRATEGY.md', 'INTEGRATION_PAUSE_AND_RESUME.md', 'BACKGROUND_JOB_FREEZE.md',
  'OUTBOX_RECONCILIATION.md', 'SCHEMA_MIGRATION_PLAN.md', 'DATABASE_MIGRATION_SAFETY.md',
  'BUSINESS_MASTER_DATA_MIGRATION.md', 'USER_AND_IDENTITY_MIGRATION.md',
  'BUSINESS_MEMBERSHIP_MIGRATION.md', 'ROLE_AND_PERMISSION_MIGRATION.md', 'APPROVAL_MIGRATION.md',
  'AUDIT_EVENT_MIGRATION.md', 'CHART_OF_ACCOUNTS_MIGRATION.md', 'ACCOUNT_MAPPING_MIGRATION.md',
  'FINANCIAL_CALENDAR_MIGRATION.md', 'JOURNAL_MIGRATION.md', 'JOURNAL_LINE_MIGRATION.md',
  'SOURCE_ACCOUNTING_LINK_MIGRATION.md', 'GENERAL_LEDGER_REBUILD.md', 'RECEIVABLES_MIGRATION.md',
  'PAYABLES_MIGRATION.md', 'EXPENSE_MIGRATION.md', 'PAYROLL_MIGRATION.md', 'INVENTORY_MIGRATION.md',
  'BANKING_MIGRATION.md', 'BANK_RECONCILIATION_MIGRATION.md', 'FIXED_ASSET_MIGRATION.md',
  'LOAN_MIGRATION.md', 'TAX_MIGRATION.md', 'EQUITY_MIGRATION.md', 'PERIOD_AND_YEAR_END_MIGRATION.md',
  'REPORT_SNAPSHOT_MIGRATION.md', 'FORECAST_MIGRATION.md', 'LOAN_READINESS_MIGRATION.md',
  'DOCUMENT_AND_FILE_MIGRATION.md', 'REBUILDABLE_DATA_PLAN.md', 'MIGRATION_BATCHING.md',
  'MIGRATION_IDEMPOTENCY.md', 'MIGRATION_TRANSACTION_POLICY.md', 'MIGRATION_CHECKSUMS.md',
  'APPLICATION_DEPLOYMENT.md', 'VERSION_COMPATIBILITY.md', 'FEATURE_FLAG_ACTIVATION.md',
  'PRODUCTION_SMOKE_TESTS.md', 'CONTROLLED_FINANCIAL_TEST.md', 'POST_MIGRATION_DATABASE_VALIDATION.md',
  'POST_MIGRATION_FINANCIAL_RECONCILIATION.md', 'TRIAL_BALANCE_RECONCILIATION.md',
  'FINANCIAL_STATEMENT_RECONCILIATION.md', 'SUBLEDGER_RECONCILIATION.md',
  'KNOWN_DEFECT_PRODUCTION_VALIDATION.md', 'POST_MIGRATION_SECURITY_VALIDATION.md',
  'FILE_AND_DOCUMENT_VALIDATION.md', 'INTEGRATION_VALIDATION.md', 'BACKGROUND_JOB_VALIDATION.md',
  'PERFORMANCE_VALIDATION.md', 'PRODUCTION_OBSERVABILITY_ACTIVATION.md', 'USER_ACCEPTANCE_TESTING.md',
  'FINANCE_ACCEPTANCE.md', 'SECURITY_ACCEPTANCE.md', 'TECHNICAL_ACCEPTANCE.md',
  'BUSINESS_ACCEPTANCE.md', 'GO_LIVE_DECISION.md', 'STOP_CONDITIONS.md',
  'ROLLBACK_DECISION_FRAMEWORK.md', 'ROLLBACK_STRATEGY.md', 'FORWARD_RECOVERY_STRATEGY.md',
  'TRAFFIC_ACTIVATION.md', 'HYPERCARE_PLAN.md', 'HYPERCARE_SEVERITY_LEVELS.md',
  'DAILY_FINANCIAL_RECONCILIATION.md', 'PRODUCTION_DEFECT_MANAGEMENT.md',
  'EMERGENCY_PRODUCTION_CORRECTIONS.md', 'LEGACY_ARCHIVAL_PLAN.md', 'LEGACY_SYSTEM_SHUTDOWN.md',
  'KNOWLEDGE_TRANSFER_PLAN.md', 'OPERATIONAL_HANDOVER.md', 'FINAL_PRODUCTION_BASELINE.md',
  'MIGRATION_OBSERVABILITY.md', 'MIGRATION_DASHBOARD.md', 'COMMUNICATION_PLAN.md',
  'FINAL_ACCEPTANCE_CRITERIA.md', 'FINAL_PRODUCTION_ACCEPTANCE.md', 'RISK_REGISTER.md',
  'FINAL_PHASE_18_REPORT.md',
];

const SECTION_BY_FILE = {
  BACKUP_EXECUTION_REPORT: 21,
  BACKUP_INTEGRITY_VERIFICATION: 22,
  BUSINESS_MIGRATION_WAVES: 26,
  DATABASE_MIGRATION_SAFETY: 35,
  BUSINESS_MASTER_DATA_MIGRATION: 36,
  USER_AND_IDENTITY_MIGRATION: 37,
  BUSINESS_MEMBERSHIP_MIGRATION: 38,
  ROLE_AND_PERMISSION_MIGRATION: 39,
  APPROVAL_MIGRATION: 40,
  AUDIT_EVENT_MIGRATION: 41,
  CHART_OF_ACCOUNTS_MIGRATION: 42,
  ACCOUNT_MAPPING_MIGRATION: 43,
  FINANCIAL_CALENDAR_MIGRATION: 44,
  JOURNAL_LINE_MIGRATION: 46,
  SOURCE_ACCOUNTING_LINK_MIGRATION: 47,
  RECEIVABLES_MIGRATION: 49,
  PAYABLES_MIGRATION: 50,
  EXPENSE_MIGRATION: 51,
  PAYROLL_MIGRATION: 52,
  INVENTORY_MIGRATION: 53,
  BANKING_MIGRATION: 54,
  BANK_RECONCILIATION_MIGRATION: 55,
  FIXED_ASSET_MIGRATION: 56,
  LOAN_MIGRATION: 57,
  TAX_MIGRATION: 58,
  EQUITY_MIGRATION: 59,
  PERIOD_AND_YEAR_END_MIGRATION: 60,
  REPORT_SNAPSHOT_MIGRATION: 61,
  FORECAST_MIGRATION: 62,
  LOAN_READINESS_MIGRATION: 63,
  DOCUMENT_AND_FILE_MIGRATION: 64,
  REBUILDABLE_DATA_PLAN: 65,
  MIGRATION_BATCHING: 66,
  MIGRATION_IDEMPOTENCY: 67,
  MIGRATION_TRANSACTION_POLICY: 68,
  MIGRATION_CHECKSUMS: 69,
  APPLICATION_DEPLOYMENT: 70,
  VERSION_COMPATIBILITY: 71,
  FEATURE_FLAG_ACTIVATION: 72,
  PRODUCTION_SMOKE_TESTS: 73,
  CONTROLLED_FINANCIAL_TEST: 74,
  POST_MIGRATION_DATABASE_VALIDATION: 75,
  FINANCIAL_STATEMENT_RECONCILIATION: 78,
  SUBLEDGER_RECONCILIATION: 79,
  POST_MIGRATION_SECURITY_VALIDATION: 81,
  FILE_AND_DOCUMENT_VALIDATION: 82,
  INTEGRATION_VALIDATION: 83,
  BACKGROUND_JOB_VALIDATION: 84,
  PERFORMANCE_VALIDATION: 85,
  PRODUCTION_OBSERVABILITY_ACTIVATION: 86,
  USER_ACCEPTANCE_TESTING: 87,
  ROLLBACK_DECISION_FRAMEWORK: 94,
  TRAFFIC_ACTIVATION: 97,
  HYPERCARE_SEVERITY_LEVELS: 99,
  DAILY_FINANCIAL_RECONCILIATION: 100,
  PRODUCTION_DEFECT_MANAGEMENT: 101,
  EMERGENCY_PRODUCTION_CORRECTIONS: 102,
  LEGACY_SYSTEM_SHUTDOWN: 104,
  KNOWLEDGE_TRANSFER_PLAN: 105,
  FINAL_PRODUCTION_BASELINE: 107,
  MIGRATION_OBSERVABILITY: 111,
  MIGRATION_DASHBOARD: 112,
  FINAL_ACCEPTANCE_CRITERIA: 114,
  INTEGRATION_PAUSE_AND_RESUME: 31,
  BACKGROUND_JOB_FREEZE: 32,
};

function acceptanceDoc(title, track, extras) {
  return `${H(title, 'TEMPLATE — UNSIGNED')}${track} sign-off template. **Not signed.**

---

## Acceptance record

${extras}

## Attestation

- [ ] _Criteria to be confirmed at execution_

| Signatory | Name | Date | Signature |
|---|---|---|---|
| Owner | _PENDING_ | — | **UNSIGNED** |
`;
}

function controlTotalsDoc(title, intro, rows) {
  return `${H(title, 'TEMPLATE')}${intro}

---

## Worksheet

| Control ID | Description | Pre | Post | Pass? |
|---|---|---|---|---|
${rows}

---

## TO FILL FROM PRODUCTION

All numeric values _PENDING_. **Do not pre-fill totals.**
`;
}

const BUILDERS = {
  'README.md': () => `${H('Phase 18 — Production Migration & Cutover', 'DRAFT')}InsightBooks V2 **production cutover framework**. **Actual cutover has NOT been executed.**

## Status summary

| Item | Status |
|---|---|
| Cutover execution | **NOT EXECUTED** |
| Documentation scaffold | **DELIVERED** |
| Runtime module | **IN PROGRESS** — \`lib/productionCutover/\`, \`/api/system/cutover/*\`, \`scripts/cutover-*.cjs\` |
| Phase 16 QA | Scaffolding **green**; full \`npm test\` / rehearsal **PARTIAL / UNKNOWN** |
| Phase 17 capacity | **NOT CERTIFIED** |
| Production environment | **UNKNOWN** (no production SSH) |
| Branch | \`v2\` |
| Latest migration | \`${META.latestMigration}\` (~109 folders) |

## Non-negotiable rules

1. Do not invent production hostnames, backup IDs, migration run IDs, row counts, financial totals, or go-live dates.
2. Inventory docs include **TO FILL FROM PRODUCTION** sections.
3. Scope freeze **DRAFT** until rehearsal (\`MIGRATION_SCOPE_FREEZE.md\`).
4. Go-live **NOT DECIDED** (\`GO_LIVE_DECISION.md\`).

## Start here

| Track | Document |
|---|---|
| Evidence | \`PHASE_1_TO_17_EVIDENCE_INDEX.md\` |
| Tasks | \`PHASE_18_TASKS.md\` |
| Governance | \`MIGRATION_GOVERNANCE.md\` |
| Closure | \`FINAL_PHASE_18_REPORT.md\` |

## Deploy tooling (workspace)

\`deploy.sh\`, \`deploy-to-production.sh\`, \`scripts/safe-deploy-production.sh\`, \`scripts/backup-database.sh\`, PM2 \`insight-books\`

## Cross-phase readiness

- \`docs/quality-assurance/PHASE_18_READINESS.md\`
- \`docs/performance-reliability/PHASE_18_READINESS.md\`
`,

  'PHASE_1_TO_17_EVIDENCE_INDEX.md': () => `${H('Phases 1–17 — Evidence Index for Production Cutover', 'DRAFT')}Cross-phase index. **NOT FOUND** where missing — no invented IDs or execution results.

| Phase | Final report | Status |
|---|---|---|
| 1 Audit | \`docs/accounting-audit/FINAL_PHASE_1_REPORT.md\` | Found |
| 2 Architecture | \`docs/accounting-architecture/FINAL_PHASE_2_REPORT.md\` | Found |
| 3 CoA | \`docs/accounting-coa/FINAL_PHASE_3_REPORT.md\` | Found |
| 4 Posting | \`docs/accounting-posting-engine/FINAL_PHASE_4_REPORT.md\` | Found |
| 5 Ledger | \`docs/accounting-ledger/FINAL_PHASE_5_REPORT.md\` | Found |
| 6 Repair | \`docs/accounting-repair/FINAL_PHASE_6_REPORT.md\` | Found |
| 7 Reports | \`docs/accounting-reports/FINAL_PHASE_7_REPORT.md\` | Found |
| 8 Periods | \`docs/accounting-periods/FINAL_PHASE_8_REPORT.md\` | Found |
| 9 Integrations | \`docs/accounting-integrations/FINAL_PHASE_9_REPORT.md\` | Found |
| 10 Bank recon | \`docs/bank-reconciliation/FINAL_PHASE_10_REPORT.md\` | Found |
| 11 Equity | \`docs/equity-management/FINAL_PHASE_11_REPORT.md\` | Found |
| 12 Close | \`docs/accounting-close/FINAL_PHASE_12_REPORT.md\` | Found |
| 13 Planning | \`docs/financial-planning/FINAL_PHASE_13_REPORT.md\` | Found |
| 14 Loan readiness | \`docs/loan-readiness/FINAL_PHASE_14_REPORT.md\` | Found |
| 15 Security | \`docs/security-governance/FINAL_PHASE_15_REPORT.md\` | Found |
| 16 QA | \`docs/quality-assurance/FINAL_PHASE_16_REPORT.md\` | Found — full cert **PARTIAL/UNKNOWN** |
| 17 Performance | \`docs/performance-reliability/FINAL_PHASE_17_REPORT.md\` | Found — capacity **NOT CERTIFIED** |

## Missing / pending evidence

| Item | Status |
|---|---|
| Staging rehearsal sign-off | \`artifacts/quality-assurance/rehearsal-*-signoff.md\` — **NOT FOUND** |
| Production data findings (live) | **NOT FOUND** — use templates in this folder |
| Measured baseline / capacity | **NOT MET** |
| Timed DR restore | **NOT MET** |
`,

  'PRODUCTION_ENVIRONMENT_INVENTORY.md': () => `${H('Production Environment Inventory', 'TEMPLATE')}**${META.productionEnv}**

## TO FILL FROM PRODUCTION

| Field | Value |
|---|---|
| Hostname(s) | _PENDING_ |
| Public URL | _PENDING_ |
| PM2 process | \`insight-books\` (verify on server) |
| Node / PostgreSQL versions | _PENDING_ |
| Prisma migration applied | _PENDING_ (workspace target: \`${META.latestMigration}\`) |
| Upload storage root | _PENDING_ |
| Backup location | _PENDING_ |
| Observability endpoints | _PENDING_ |

## Known from workspace only

Deploy: \`deploy.sh\`, \`deploy-to-production.sh\`, \`scripts/safe-deploy-production.sh\`; backup: \`scripts/backup-database.sh\`; branch \`v2\`.
`,

  'PRODUCTION_DATA_FLOW_MAP.md': () => `${H('Production Data Flow Map', 'DRAFT')}Operational modules → Posting Engine → Journals → GL / TB / Reports. Forecasts and loan readiness **must not post** to GL.

See module table in \`PRODUCTION_DEPENDENCY_MAP.md\`. Production volumes: **TO FILL FROM PRODUCTION**.
`,

  'PRODUCTION_DEPENDENCY_MAP.md': () => `${H('Production Dependency Map', 'DRAFT')}| Dependency | Production value |
|---|---|
| PostgreSQL | **TO FILL FROM PRODUCTION** |
| PM2 \`insight-books\` | Verify on server |
| V2 APIs | \`/api/accounting-v2\`, \`/api/coa-v2\`, \`/api/bank-reconciliation\`, etc. |
| Cutover API | \`/api/system/cutover/*\` (scaffolding) |

## Blocking gates

| Gate | Status |
|---|---|
| Capacity cert | **NOT CERTIFIED** |
| QA Phase 18 entry | **NOT MET** |
| Phase 15 exit | **NOT MET** |
`,

  'MIGRATION_GOVERNANCE.md': () => `${H('Migration Governance', 'DRAFT')}Roles: sponsor, migration lead, finance, security, technical, QA, ops. Migration ledger fields: name, run ID, environment, commit, migration head, counts, rollback status — **no executed runs yet**.

Runtime: \`lib/productionCutover/\`, \`/api/system/cutover/runs\`. Scripts: \`scripts/cutover-*.cjs\`, \`scripts/safe-deploy-production.sh\`.
`,

  'MIGRATION_SCOPE_FREEZE.md': () => `${H('Migration Scope Freeze', 'DRAFT — NOT APPROVED')}**Freeze not approved until rehearsal sign-off.**

| Field | Value |
|---|---|
| Approved | **NO** |
| Rehearsal ref | \`FINAL_MIGRATION_REHEARSAL_REPORT.md\` — **PENDING** |

In scope (proposed): Prisma through \`${META.latestMigration}\`, V2 posting/ledger, CoA V2. Legacy direct writes **frozen** per \`LEGACY_WRITE_FREEZE.md\`.
`,

  'PRODUCTION_DATA_INVENTORY.md': () => `${H('Production Data Inventory', 'TEMPLATE')}~100 Prisma models — classify via \`DATA_DOMAIN_CLASSIFICATION.md\`. Row counts: **TO FILL FROM PRODUCTION**.
`,

  'DATA_DOMAIN_CLASSIFICATION.md': () => `${H('Data Domain Classification', 'DRAFT')}Codes: AUTH, FIN-CORE, FIN-SUB, FIN-SNAP, OPS, PLAN, DOC, REBUILD, AUDIT. Mapping table: **TO FILL FROM PRODUCTION**.
`,

  'MIGRATION_MANIFEST.md': () => `${H('Migration Manifest', 'DRAFT')}Ordered steps M-001..M-050 (schema, CoA, journals, GL rebuild, outbox, flags). **Migration Run ID: assign at execution only.** All steps **NOT STARTED**.
`,

  'LEGACY_ID_MAPPING.md': () => `${H('Legacy ID Mapping', 'DRAFT')}Templates for accounts, journals, users/businesses. Bridge: \`lib/accountingV2/adapters/cutoverBridge.js\`. **TO FILL FROM PRODUCTION**.
`,

  'DATA_TRANSFORMATION_REGISTRY.md': () => `${H('Data Transformation Registry', 'DRAFT')}Approved transforms only (e.g. expense remaps, header journal exclusion). Ad-hoc prod SQL forbidden.
`,

  'SOURCE_DATA_SNAPSHOT.md': () => `${H('Source Data Snapshot', 'TEMPLATE')}Snapshot ID, backup file, commit, scrub status — all _PENDING_. No snapshot registered.
`,

  'PRE_MIGRATION_DIAGNOSTIC_REPORT.md': () => `${H('Pre-Migration Diagnostic Report', 'TEMPLATE')}Run via \`scripts/cutover-pre-migration-diagnostic.cjs\` or \`GET /api/system/cutover/diagnostics\`. Checks: unbalanced journals, duplicates, NULL tenantId, TB diff, outbox — all _PENDING_.
`,

  'MIGRATION_EXCEPTION_REGISTER.md': () => `${H('Migration Exception Register', 'DRAFT')}No exceptions recorded. Materiality: **TO FILL FROM PRODUCTION** in \`FINANCIAL_CONTROL_TOTALS.md\`.
`,

  'FINANCIAL_CONTROL_TOTALS.md': () => controlTotalsDoc(
    'Financial Control Totals',
    'Pre/post cutover finance controls. **Cutover NOT EXECUTED.**',
    '| CT-TB-001 | Trial balance balance | _PENDING_ | _PENDING_ | _PENDING_ |\n| CT-AR-001 | AR subledger | _PENDING_ | _PENDING_ | _PENDING_ |'
  ),

  'SECURITY_CONTROL_TOTALS.md': () => controlTotalsDoc(
    'Security Control Totals',
    'Security counts/checks. Phase 15 exit **NOT MET**.',
    '| SC-TEN-001 | Cross-tenant tests | _PENDING_ | _PENDING_ | _PENDING_ |\n| SC-AUD-001 | Audit append-only | _PENDING_ | _PENDING_ | _PENDING_ |'
  ),

  'DOCUMENT_CONTROL_TOTALS.md': () => controlTotalsDoc(
    'Document Control Totals',
    'Attachment/file counts.',
    '| DC-FILE-001 | Files on disk | _PENDING_ | _PENDING_ | _PENDING_ |'
  ),

  'PRODUCTION_BACKUP_PLAN.md': () => `${H('Production Backup Plan', 'DRAFT')}Use \`scripts/backup-database.sh\` + \`scripts/safe-deploy-production.sh\`. Restore must pass \`BACKUP_RESTORE_VERIFICATION.md\` before migrate. **NOT EXECUTED on production.**
`,

  'BACKUP_RESTORE_VERIFICATION.md': () => `${H('Backup Restore Verification', 'TEMPLATE')}Backup ID, restore duration, smoke checks — _PENDING_. Phase 17 RTO drill **NOT MET**.
`,

  'FINAL_MIGRATION_REHEARSAL_REPORT.md': () => `${H('Final Migration Rehearsal Report', 'PENDING')}**No rehearsal signed.** Target ×2 per \`docs/quality-assurance/MIGRATION_REHEARSAL_RUNBOOK.md\`. Sign-off artifact **NOT FOUND**.
`,

  'CUTOVER_STRATEGY.md': () => `${H('Cutover Strategy', 'DRAFT')}Proposed: maintenance window, legacy write freeze, \`prisma migrate deploy\` to \`${META.latestMigration}\`, manifest steps, GL rebuild, outbox recon, controlled traffic. **NOT EXECUTED.**
`,

  'CUTOVER_WINDOW_PLAN.md': () => `${H('Cutover Window Plan', 'TEMPLATE')}Planned start/end UTC — _PENDING_. No go-live date set. RACI in \`COMMUNICATION_PLAN.md\`.
`,

  'MAINTENANCE_MODE.md': () => `${H('Maintenance Mode', 'DRAFT')}OFF / READONLY / FULL modes via \`lib/productionCutover/\` + \`/api/system/cutover/maintenance\`. Activation timestamps: **TO FILL FROM PRODUCTION**.
`,

  'LEGACY_WRITE_FREEZE.md': () => `${H('Legacy Write Freeze', 'DRAFT')}Block direct \`postGlEntry\`, legacy balance updates, bypass posting paths during window.
`,

  'DELTA_MIGRATION_STRATEGY.md': () => `${H('Delta Migration Strategy', 'DRAFT')}Delta after snapshot, before traffic. Timestamps _PENDING_. Idempotent apply per \`MIGRATION_IDEMPOTENCY.md\`.
`,

  'OUTBOX_RECONCILIATION.md': () => `${H('Outbox Reconciliation', 'DRAFT')}Pending/failed outbox must be 0 before sign-off. See \`docs/accounting-posting-engine/TRANSACTIONAL_OUTBOX.md\`.
`,

  'SCHEMA_MIGRATION_PLAN.md': () => `${H('Schema Migration Plan', 'DRAFT')}\`npx prisma migrate deploy\` → \`${META.latestMigration}\`. Post-check: \`POST_MIGRATION_DATABASE_VALIDATION.md\`.
`,

  'JOURNAL_MIGRATION.md': () => `${H('Journal Entry Migration', 'DRAFT')}Idempotent journal migrate; exclude header double-count (TB-003). Lines: \`JOURNAL_LINE_MIGRATION.md\`.
`,

  'GENERAL_LEDGER_REBUILD.md': () => `${H('General Ledger Rebuild — Cutover', 'DRAFT')}Per-tenant rebuild via \`lib/accountingV2/ledger/\`. Module doc: \`docs/accounting-ledger/GENERAL_LEDGER_REBUILD.md\`. Totals _PENDING_.
`,

  'POST_MIGRATION_FINANCIAL_RECONCILIATION.md': () => `${H('Post-Migration Financial Reconciliation', 'TEMPLATE')}Master recon matrix linking TB, FS, subledgers — all _PENDING_. Finance sign-off: \`FINANCE_ACCEPTANCE.md\`.
`,

  'TRIAL_BALANCE_RECONCILIATION.md': () => `${H('Trial Balance Reconciliation', 'TEMPLATE')}Legacy vs V2 TB per tenant — **do not pre-fill balances**. Gate for go-live.
`,

  'KNOWN_DEFECT_PRODUCTION_VALIDATION.md': () => `${H('Known Defect Production Validation', 'DRAFT')}Validate REG-CAP-005, REG-SAL-5200, TB-003, ACC-INV-047/048 in prod — _PENDING_. See \`docs/quality-assurance/DEFECT_REGRESSION_CATALOGUE.md\`.
`,

  'STOP_CONDITIONS.md': () => `${H('Stop Conditions', 'DRAFT')}STOP-FIN (TB/duplicate/AR), STOP-SEC (cross-tenant/audit), STOP-OPS (restore/migrate failures). Triggers \`ROLLBACK_DECISION_FRAMEWORK.md\`.
`,

  'ROLLBACK_STRATEGY.md': () => `${H('Rollback Strategy', 'DRAFT')}Tier 1: restore backup; Tier 2: domain reverse; Tier 3: forward recovery. Rollback drill **NOT MET** (<4h target per QA readiness).
`,

  'FORWARD_RECOVERY_STRATEGY.md': () => `${H('Forward Recovery Strategy', 'DRAFT')}When rollback unsafe: posting engine / repair batches only; finance sign-off; never delete audit events.
`,

  'GO_LIVE_DECISION.md': () => `${H('Go-Live Decision', 'NOT DECIDED')}| Field | Value |
|---|---|
| Decision | _PENDING_ |
| Go-live date | _PENDING_ |
| Migration Run ID | _PENDING_ |

Capacity **NOT CERTIFIED**. Rehearsal **PENDING**. Approvals blank.
`,

  'FINANCE_ACCEPTANCE.md': () => acceptanceDoc('Finance Acceptance', 'Finance', '| TB ref | `TRIAL_BALANCE_RECONCILIATION.md` |\n| Control totals | `FINANCIAL_CONTROL_TOTALS.md` |'),

  'SECURITY_ACCEPTANCE.md': () => acceptanceDoc('Security Acceptance', 'Security', '| Validation | `POST_MIGRATION_SECURITY_VALIDATION.md` |\n| Phase 15 exit | _PENDING_ |'),

  'TECHNICAL_ACCEPTANCE.md': () => acceptanceDoc('Technical Acceptance', 'Technical', '| Smoke | `PRODUCTION_SMOKE_TESTS.md` |\n| PM2 | `insight-books` |'),

  'BUSINESS_ACCEPTANCE.md': () => acceptanceDoc('Business Acceptance', 'Business', '| UAT | `USER_ACCEPTANCE_TESTING.md` |\n| Hypercare | `HYPERCARE_PLAN.md` |'),

  'HYPERCARE_PLAN.md': () => `${H('Hypercare Plan', 'DRAFT')}H0: 0–48h; H1: 3–7d; H2: 8–30d. **Not active** — cutover not executed. Roster **TO FILL FROM PRODUCTION**.
`,

  'LEGACY_ARCHIVAL_PLAN.md': () => `${H('Legacy System Archival Plan', 'DRAFT')}Post acceptance: retain backups & release tags. **NOT STARTED.**
`,

  'OPERATIONAL_HANDOVER.md': () => `${H('Operational Handover', 'DRAFT')}Hand over runbooks (\`docs/performance-reliability/OPERATIONAL_RUNBOOKS.md\`), monitoring, PM2. Date _PENDING_.
`,

  'COMMUNICATION_PLAN.md': () => `${H('Communication Plan', 'DRAFT')}T-14, T-7, T-0, T+48h templates — dates **TO FILL**. No go-live date set.
`,

  'FINAL_PRODUCTION_ACCEPTANCE.md': () => `${H('Final Production Acceptance', 'UNSIGNED')}All roles **UNSIGNED**. Capacity **NOT CERTIFIED**. Migration Run ID _PENDING_.
`,

  'RISK_REGISTER.md': () => `${H('Risk Register — Production Cutover', 'DRAFT')}| ID | Risk | Status |
|---|---|---|
| P18-R-001 | Capacity NOT CERTIFIED | OPEN |
| P18-R-002 | Phase 16 tests PARTIAL/UNKNOWN | OPEN |
| P18-R-003 | Phase 15 exit NOT MET | OPEN |
| P18-R-008 | Production env UNKNOWN | OPEN |
`,

  'PHASE_18_TASKS.md': () => `${H('Phase 18 Tasks', 'DRAFT')}| Stream | Status |
|---|---|
| Documentation tree | **DONE** |
| Runtime/API/scripts | **IN PROGRESS** |
| Production inventory | **BLOCKED** |
| Rehearsal / cutover | **BLOCKED** on gates |

Scaffolding **DONE**; production execution **BLOCKED** on Phase 16/17/15 gates and rehearsal.
`,

  'FINAL_PHASE_18_REPORT.md': () => `${H('Final Phase 18 Report — Production Cutover', 'DRAFT')}## Executive summary

Phase 18 delivered the **cutover documentation framework** (${ALL_FILES.length} files) and **in-progress runtime scaffolding**. **Cutover NOT EXECUTED.** No invented production metrics.

**Roadmap closure is CONDITIONAL** on rehearsal, certifications, signed acceptances, and successful cutover.

## Gate status

| Phase | Status |
|---|---|
| 16 | Scaffolding green; full cert **PARTIAL/UNKNOWN** |
| 17 | Capacity **NOT CERTIFIED** |
| 15 | Exit **NOT MET** (QA readiness) |

## Verified workspace facts

Branch \`v2\`; ~109 migrations; latest \`${META.latestMigration}\`; deploy/backup scripts as documented; PM2 \`insight-books\`.

**FRAMEWORK DELIVERED — CUTOVER NOT EXECUTED — CLOSURE CONDITIONAL**
`,
};

for (const file of ALL_FILES) {
  const base = file.replace(/\.md$/, '');
  const title = base.replace(/_/g, ' ');
  let content;
  if (BUILDERS[file]) {
    content = BUILDERS[file]();
  } else {
    const key = base;
    const sec = SECTION_BY_FILE[key] || ALL_FILES.indexOf(file) + 1;
    content = stub(title, `Phase 18 cutover document: **${title}**.`, sec);
  }
  fs.writeFileSync(path.join(ROOT, file), content, 'utf8');
}

console.log(`Created ${ALL_FILES.length} files in docs/production-cutover/`);

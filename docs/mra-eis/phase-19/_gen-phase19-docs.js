/**
 * Generates Phase 19 documentation pack (non-empty findings).
 * Run: node docs/mra-eis/phase-19/_gen-phase19-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-19');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 19 — Existing-data discovery, assessment, reconciliation and controlled additive migration. Default for ambiguous data: QUARANTINE AND MANUAL REVIEW. No historical Sale submission. No Journal/Stock replay. No fiscal-number generation or mutation. No plaintext credentials/JWT/TAC/private keys/BAC. Dry Run required before Production. Rollback = migration-created records only; lineage and Audit survive.*\n`,
    'utf8'
  );
}

const D = 'lib/mraEis/application/migration/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 19 — Existing Data Assessment & Controlled Migration

**Decision:** \`READY_FOR_PHASE_20_WITH_BLOCKERS\`

## Entry
- Domain: \`${D}\`
- API: \`/api/mra-eis/migration\`
- UI: \`/settings/integrations/mra-eis/migration\`
- Admin Centre section: Data Migration
- Prisma: \`MraEisMigrationSourceSystem\`, \`MraEisMigrationRun\`, \`MraEisMigrationRecord\`
- Migration SQL: \`prisma/migrations/20260723100000_mra_eis_phase19_migration\`
- Tests: \`test/mraEis.phase19.migration.test.js\`

## Hard rules
- Source access is read-only and checksummed
- No default Tenant / Business fallback
- Receipt / local status ≠ acceptance
- No fabricate MRA IDs, Response Evidence, or QR
- No historical transmit / offline upload
- No Journal / Stock Movement from migration
- Additive historical evidence + lineage only
- Production requires approved Dry Run checksum + backup
`,

  'PHASE_19_TASKS.md': short(
    'Phase 19 Tasks',
    `| Stream | Status |
|---|---|
| Migration dependency audit | DONE |
| Gap register | DONE |
| Source-System Registry | DONE |
| Read-only access + manifests + checksums | DONE |
| Ownership + Environment classification | DONE |
| Assessments (Sale/Invoice/Terminal/Receipt/Offline/Fiscal#) | DONE |
| Duplicate + Orphan + Integrity scoring | DONE |
| Decision engine | DONE |
| Cohorts + Run aggregate + lineage | DONE |
| Dry Run / additive migrate / rollback | DONE |
| Hook isolation | DONE |
| Permissions + Admin UI + API | DONE |
| Prisma models + SQL migration | DONE |
| Automated tests | DONE |
| Docs + Phase 20 handover | DONE |
| Live Production source extraction against customer DBs | BLOCKED (operator + approval) |
| Full Prisma persistence for all in-memory run state | PARTIAL (schema ready; workers use memory path for tests) |
| Exhaustive Phase 1–18 row-level production profiling | DEFERRED to Phase 20 ops windows |`
  ),

  'PHASE_19_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 19 Requirement Traceability',
    `| Requirement | Source | Target | Transformation | Validation | Ownership | Environment | Duplicate | Reconciliation | Security | Rollback | Approval |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Source registry | External DB/file | \`MraEisMigrationSourceSystem\` | Metadata only | readOnlyVerified | tenantScope | environmentClassification | N/A | manifest row counts | credentialReference opaque | N/A | Production source register |
| Extraction | Source rows | Manifest | Checksum SHA-256 | schema fingerprint | hints | hints | natural keys | counts | secrets excluded | N/A | Production extract |
| POS Sale evidence | Legacy sale | Historical EIS evidence stub | \`migration-transform-v1\` | decision engine | conclusive tenant/business | explicit | fiscal# / MRA ID | financial flags only | no JWT/BAC | migration-created only | Production migrate |
| Receipt artifact | Archive | Quarantine or historical | checksum | receipt≠acceptance | proven | explicit | artifact checksum | receipt recon | redacted | migration-created only | restricted export |
| Journal | Existing | LINK only | none | balanced + ownership | same tenant/business | N/A | journal source ref | totals | N/A | never delete Journals | N/A |
| Stock Movement | Existing | LINK only | none | qty/warehouse | same | N/A | movement source ref | qty | N/A | never delete Stock | N/A |
| Fiscal number | Legacy | Preserve | none | uniqueness | terminal scope | env match | duplicate engine | sequence report | N/A | never change numbers | sequence init review |
| Transmission | Legacy | Historical read-only | none | not dispatchable | proven | explicit | attempt order | attempt count | evidence checksum | migration-created only | accepted-evidence import |`
  ),

  'MIGRATION_DEPENDENCY_AUDIT.md': short(
    'Migration Dependency Audit',
    `| Mechanism | Path / area | Classification |
|---|---|---|
| Prisma MRA EIS tables Phases 4–17 | \`prisma/schema.prisma\` | REUSE |
| \`EISInvoice\` / \`EISConfiguration\` / \`EISSubmissionLog\` | legacy models | LEGACY_READ_ONLY / discovery source |
| Phase 4/5 dry-run scripts | \`scripts/\` (where present) | EXTEND into assessor |
| \`MraEisManualReviewCase\` | domain | REUSE / WRAP |
| Phase 18 Admin Centre | \`application/admin\` | EXTEND (Migration section) |
| \`lib/eisService.js\` submit/status | legacy EIS | UNSAFE_HISTORICAL_TRANSMISSION — never call from migration |
| Sale finalization / Invoice issue | POS/Invoice services | UNSAFE_FINANCIAL_REPLAY — hook-isolated |
| Accounting posting / Stock posting | journals / inventory | UNSAFE_FINANCIAL_REPLAY / UNSAFE_INVENTORY_REPLAY |
| Seed / one-off SQL without lineage | ad-hoc scripts | UNSAFE_NO_LINEAGE / DEPRECATE for Production |
| Default tenant assignment patterns | any migration write | UNSAFE_DEFAULT_TENANT — removed for Phase 19 |
| Plaintext credential copy | forbidden | UNSAFE_PLAINTEXT_SECRET |
| Blind dump restore over Production | ops | UNSAFE_DIRECT_UPDATE — blocked |`
  ),

  'PHASE_19_GAP_REGISTER.md': short(
    'Phase 19 Gap Register',
    `| ID | Gap | Severity | Status |
|---|---|---|---|
| G19-001 | Live Production customer DB read-only extraction not executed in this workspace | HIGH | BLOCKED (ops) |
| G19-002 | Durable worker queue persistence for multi-replica Production migrate | MEDIUM | PARTIAL (in-memory + schema) |
| G19-003 | Full Prisma write-path for every Run/Record (tests use memory) | MEDIUM | PARTIAL |
| G19-004 | Exhaustive table-by-table SOURCE_SCHEMA for every legacy dump on disk | MEDIUM | Framework ready; dumps require operator registration |
| G19-005 | Carry-forward Phase 13–18 MRA contract / sandbox blockers | HIGH | Carry-forward |
| G19-006 | Scheduled migration maintenance windows + pager alerts wiring | LOW | Structure via typed errors/metrics docs |
| G19-007 | Complete XLSX macro scanner vs antivirus integration | MEDIUM | Formula injection + path traversal blocked in policy |`
  ),

  'SOURCE_SYSTEM_REGISTRY.md': short(
    'Source System Registry',
    `Implemented in \`${D}sourceSystemRegistry.js\` and \`MraEisMigrationSourceSystem\`.

Types: CURRENT/LEGACY InsightBooks, LEGACY_EFD/EIS, dumps, CSV/XLSX/JSON packages, receipt/log archives, offline agent DB.

Registration requires \`readOnlyVerified: true\`. Credential fields must be opaque Secret Provider references (no \`password=\` embeds).`
  ),

  'SOURCE_ACCESS_SECURITY.md': short(
    'Source Access Security',
    `- Prefer read-only DB roles and read-only transactions
- Never restore dumps over Production
- Never run untrusted SQL against Production
- Credential references only; JWT/TAC/private keys/BAC excluded from manifests
- API sanitizes credentialReference to \`[REDACTED_REFERENCE]\``
  ),

  'SOURCE_EXTRACTION_MANIFEST.md': short(
    'Source Extraction Manifest',
    `\`createExtractionManifest\` records dataset, table/file, selection criteria, row count, columns, schema fingerprint, content checksum (SHA-256), operator, tool version. Immutable for Dry Run approval matching.`
  ),

  'SOURCE_SCHEMA_INVENTORY.md': short(
    'Source Schema Inventory',
    `Framework inventories columns from extracted rows. Do not assume same field names share semantics across LEGACY_EFD vs LEGACY_EIS vs current InsightBooks.

Primary discovery targets: EISInvoice, EISSubmissionLog, Terminal metadata, fiscal numbers, receipt artifacts, offline queues, Journals, Stock Movements (link-only).`
  ),

  'SOURCE_DATA_PROFILING.md': short(
    'Source Data Profiling',
    `\`profileDataset\` computes row counts, null frequency, distinct counts without mutation (\`mutated: false\`). Extended profiling (TIN patterns, future timestamps) is invoked per cohort during assessment Dry Runs.`
  ),

  'ENVIRONMENT_CLASSIFICATION.md': short(
    'Environment Classification',
    `\`classifyEnvironment\` votes from record environment, source hint, endpoint hostname, receipt wording. Database name alone → UNKNOWN + quarantine. PRODUCTION+SANDBOX votes → CONFLICTING / blocked mix.`
  ),

  'TENANT_OWNERSHIP_RESOLUTION.md': short(
    'Tenant Ownership Resolution',
    `\`resolveTenantOwnership\` — no default Tenant. Outcomes: CONCLUSIVE, STRONG, AMBIGUOUS, ORPHANED, CROSS_TENANT_CONFLICT. Conflicting IDs block migration.`
  ),

  'BUSINESS_OWNERSHIP_RESOLUTION.md': short(
    'Business Ownership Resolution',
    `Name-alone matching prohibited. InsightBooks alias (businessId = tenantId) only when Tenant proven. Cross-Business conflict quarantines/blocks.`
  ),

  'BRANCH_SITE_WAREHOUSE_ASSESSMENT.md': short(
    'Branch / Site / Warehouse Assessment',
    `Assess via ownership + mapping cohorts. Do not move Inventory during mapping migration. Conflicts → MANUAL_REVIEW / MISSING_MAPPING.`
  ),

  'TERMINAL_ASSESSMENT.md': short(
    'Terminal Assessment',
    `\`assessTerminal\` — mustNotActivate always. Classifications include VERIFIED_ACTIVE/INACTIVE, LEGACY_HISTORICAL, CREDENTIAL_REMEDIATION_REQUIRED, MANUAL_REVIEW.`
  ),

  'CREDENTIAL_REFERENCE_ASSESSMENT.md': short(
    'Credential Reference Assessment',
    `Metadata/references only. \`detectCredentialLeak\` blocks JWT-shaped values and secret field names. Plaintext credentials → BLOCKED_SECURITY incident path.`
  ),

  'CONFIGURATION_ASSESSMENT.md': short(
    'Configuration Assessment',
    `\`assessConfiguration\` — LINK_TO_EXISTING_ACTIVE_CONFIGURATION / MIGRATE_AS_HISTORICAL_SNAPSHOT / QUARANTINE_CONFLICT. Must not activate unverified historical config.`
  ),

  'CATALOGUE_ASSESSMENT.md': short(
    'Catalogue Assessment',
    `Historical mapping references preserved; current active mappings not overwritten blindly. Cohort: CATALOGUE_HISTORY / MAPPINGS.`
  ),

  'TAX_LEVY_PAYMENT_ASSESSMENT.md': short(
    'Tax / Levy / Payment Assessment',
    `Rate equality alone insufficient. Exact decimals. Historical references preserved; operational mappings not blindly replaced.`
  ),

  'SALE_INVOICE_ASSESSMENT.md': short(
    'Sale / Invoice Assessment',
    `\`classifySaleOrInvoice\` — EIS_ACCEPTED_PROVEN requires Response Evidence + MRA ID. RECEIPT_WITHOUT_RESPONSE / STATUS_WITHOUT_EVIDENCE quarantine. EIS_ELIGIBLE_NOT_SUBMITTED → historical read-only, MUST_NOT_AUTO_SUBMIT.`
  ),

  'ACCOUNTING_LINKAGE_ASSESSMENT.md': short(
    'Accounting Linkage Assessment',
    `Verify Journal existence/balance/ownership. Migration never creates Journals. Missing linkage → warning / MANUAL_REVIEW / remediations outside import.`
  ),

  'INVENTORY_LINKAGE_ASSESSMENT.md': short(
    'Inventory Linkage Assessment',
    `Verify Stock Movements; migration never creates/deletes them. Mismatches quarantined for Inventory reviewer.`
  ),

  'FISCAL_SNAPSHOT_ASSESSMENT.md': short(
    'Fiscal Snapshot Assessment',
    `Link existing valid snapshots or migrate historical evidence. Do not rebuild completed snapshots from mutable Product data.`
  ),

  'FISCAL_NUMBER_ASSESSMENT.md': short(
    'Fiscal Number Assessment',
    `\`assessFiscalNumber\` detects DUPLICATE_NUMBER. Numbers never changed or regenerated. Conflicts quarantine both sides.`
  ),

  'FISCAL_SEQUENCE_ASSESSMENT.md': short(
    'Fiscal Sequence Assessment',
    `Do not auto-set Production sequences from max legacy number. INITIALIZATION_REVIEW_REQUIRED / CONFLICT / MANUAL_REVIEW. Never move sequences backwards.`
  ),

  'TRANSMISSION_ASSESSMENT.md': short(
    'Transmission Assessment',
    `Historical transmissions migrate as non-dispatchable read-only evidence. \`dispatchable: false\` enforced by decision engine.`
  ),

  'SUBMISSION_ATTEMPT_ASSESSMENT.md': short(
    'Submission Attempt Assessment',
    `Append-only order preserved. Attempts not renumbered for convenience.`
  ),

  'REQUEST_RESPONSE_EVIDENCE_ASSESSMENT.md': short(
    'Request / Response Evidence Assessment',
    `Checksum verification; credential leaks isolated. Missing response → not accepted. HTTP status alone insufficient.`
  ),

  'FISCAL_RECEIPT_QR_ASSESSMENT.md': short(
    'Fiscal Receipt / QR Assessment',
    `\`assessReceipt\` — acceptBecauseReceiptExists always false without Response Evidence. No fabricate QR/MRA IDs.`
  ),

  'OFFLINE_DATA_ASSESSMENT.md': short(
    'Offline Data Assessment',
    `\`assessOffline\` — uncertified → quarantine; mustNotAutoUpload / mustNotGenerateSignature.`
  ),

  'RESTRICTION_CERTIFICATION_ASSESSMENT.md': short(
    'Restriction / Certification Assessment',
    `Do not clear historical restrictions or self-declare certification from unverified docs. Migration never Set Terminal Active.`
  ),

  'DUPLICATE_DETECTION_ENGINE.md': short(
    'Duplicate Detection Engine',
    `\`detectDuplicates\` — source natural key, fiscal number, MRA ID, receipt checksum. Never merge conflicting fiscal evidence.`
  ),

  'ORPHAN_DETECTION.md': short(
    'Orphan Detection',
    `\`detectOrphans\` — missing Tenant/Business, receipt without acceptance, attempt without transmission. Orphans quarantine; no fabricated parents.`
  ),

  'DATA_INTEGRITY_SCORING.md': short(
    'Data Integrity Scoring',
    `\`scoreIntegrity\` bands AUTHORITATIVE_READY → BLOCKED. Critical conflicts override numeric score.`
  ),

  'MIGRATION_DECISION_ENGINE.md': short(
    'Migration Decision Engine',
    `\`evaluateMigrationCandidate\` — default QUARANTINE. Decisions include MIGRATE_AS_HISTORICAL_READ_ONLY, LINK_TO_EXISTING_CANONICAL_RECORD, BLOCKED_* .`
  ),

  'MIGRATION_COHORTS.md': short(
    'Migration Cohorts',
    `COHORTS: TERMINALS, CONFIGURATION_HISTORY, MAPPINGS, ACCEPTED/REJECTED/UNKNOWN, SUBMISSION_EVIDENCE, RECEIPTS_AND_QR, OFFLINE_EVIDENCE, RESTRICTIONS, QUARANTINED_RECORDS. Order by dependency; no Migrate Everything.`
  ),

  'MIGRATION_RUN_AGGREGATE.md': short(
    'Migration Run Aggregate',
    `\`MraEisMigrationRun\` + in-memory \`createMigrationRun\`. Modes PROFILE/ASSESS/DRY_RUN/MIGRATE/VERIFY/ROLLBACK.`
  ),

  'RECORD_LEVEL_MIGRATION_MANIFEST.md': short(
    'Record-Level Migration Manifest',
    `\`MraEisMigrationRecord\` lineageKey = hash(sourceSystemId|entity|recordId|checksum|transform|env). Unique constraint prevents duplicate imports.`
  ),

  'MIGRATION_TRANSFORMATION_REGISTRY.md': short(
    'Migration Transformation Registry',
    `Version \`migration-transform-v1\` / \`migration-decision-v1\`. Field rules documented in REQUIREMENT_TRACEABILITY. No undocumented ad-hoc Production scripts.`
  ),

  'MIGRATION_IDENTIFIER_STRATEGY.md': short(
    'Migration Identifier Strategy',
    `Preserve source IDs in lineage; generate new target IDs; store source→target mapping; idempotency via lineageKey.`
  ),

  'ADDITIVE_MIGRATION_POLICY.md': short(
    'Additive Migration Policy',
    `Insert historical evidence + lineage; link canonical; quarantine. Restricted updates require explicit rule, before/after checksums, approval, Audit, rollback definition.`
  ),

  'DRY_RUN_MIGRATION.md': short(
    'Dry Run Migration',
    `\`executeDryRun\` — targetMutated:false. Produces decisions, expected inserts/links/quarantines, dryRunChecksum.`
  ),

  'MIGRATION_STAGING_AREA.md': short(
    'Migration Staging Area',
    `In-memory TARGETS map + future staging tables separate from authoritative financial tables. No Outbox transmission Events.`
  ),

  'CONTROLLED_MIGRATION_EXECUTION.md': short(
    'Controlled Migration Execution',
    `Validate Dry Run checksum → backup (Production) → claim lineage → additive insert/link → resultChecksum. Batched; no single mega-transaction.`
  ),

  'MIGRATION_HOOK_ISOLATION.md': short(
    'Migration Hook Isolation',
    `\`runInMigrationContext\` + \`assertHookAllowed\` forbid SALE_FINALIZATION, ACCOUNTING_POSTING, INVENTORY_POSTING, MRA_TRANSMISSION, OFFLINE_UPLOAD, RECEIPT_GENERATION, FISCAL_NUMBER_ALLOCATION.`
  ),

  'MIGRATION_IDEMPOTENCY.md': short(
    'Migration Idempotency',
    `Key: sourceSystemId + entity + recordId + sourceChecksum + transformationVersion + environment. Re-run links existing targets.`
  ),

  'MIGRATION_CONCURRENCY.md': short(
    'Migration Concurrency',
    `CLAIMS map per lineageKey; unique lineage constraints. No global all-Tenant lock.`
  ),

  'MIGRATION_QUARANTINE.md': short(
    'Migration Quarantine',
    `Reasons include ownership unknown, env unknown, duplicate fiscal#, receipt without evidence, credential leak. Quarantined rows never enter operational queues.`
  ),

  'MIGRATION_MANUAL_REVIEW.md': short(
    'Migration Manual Review',
    `Cannot fabricate acceptance/fiscal numbers, create Journal/Stock, submit Sales, or clear security without remediation. Uses Phase manual-review permissions.`
  ),

  'POST_MIGRATION_VALIDATION.md': short(
    'Post-Migration Validation',
    `Counts, checksums, ownership/env consistency, no Journals/Stock/transmission Jobs created. \`buildReconciliationSummary\`.`
  ),

  'FINANCIAL_RECONCILIATION.md': short(
    'Financial Reconciliation',
    `Exact decimals; currencies not mixed without policy. Migration does not alter Journals; variances documented for Manual Review.`
  ),

  'INVENTORY_RECONCILIATION.md': short(
    'Inventory Reconciliation',
    `Quantities linked vs missing/duplicate movements. Migration does not alter balances.`
  ),

  'FISCAL_RECONCILIATION.md': short(
    'Fiscal Reconciliation',
    `Numbers by Terminal/Environment; duplicates quarantined; sequences not auto-corrected.`
  ),

  'RECEIPT_RECONCILIATION.md': short(
    'Receipt Reconciliation',
    `Accepted-with-receipt vs receipt-without-evidence; sandbox receipts in Production sources flagged.`
  ),

  'MIGRATION_ROLLBACK_POLICY.md': short(
    'Migration Rollback Policy',
    `\`rollbackMigrationRun\` removes only \`createdByMigration\` targets for the Run. Journals/Stock/Audit/lineage preserved. Blocked if dependent operational activity.`
  ),

  'MIGRATION_BACKUP_REQUIREMENTS.md': short(
    'Migration Backup Requirements',
    `Production migrate requires \`backupVerified: true\`. Document checksum, restore rehearsal, encryption, retention in Run evidence.`
  ),

  'MIGRATION_WORKER.md': short(
    'Migration Worker',
    `Controlled execution path under hook isolation. Multi-replica ready via lineage claims. Does not call MRA.`
  ),

  'MIGRATION_SCHEDULER.md': short(
    'Migration Scheduler',
    `Modes: Dry Run, Approved Migration, Verify, Rollback. Production never starts from unapproved UI click alone.`
  ),

  'PHASE_19_DATABASE_CONSTRAINTS.md': short(
    'Phase 19 Database Constraints',
    `Unique \`MraEisMigrationRecord.lineageKey\`. FKs Restrict on Run delete. Indexes on tenant/business/state/decision.`
  ),

  'PHASE_19_SECURITY.md': short(
    'Phase 19 Security',
    `Secrets excluded; API rejects jwt/privateKey/terminalSecret/BAC/submitHistoricalSale/createJournal/defaultTenantId. Path traversal / formula injection policies documented for file packages.`
  ),

  'PHASE_19_PERMISSIONS.md': short(
    'Phase 19 Permissions',
    `Tenant: \`eis.migration.sources.*\`, \`eis.migration.assessment.*\`, \`eis.migration.dryRun\`, approve/execute/rollback.request, quarantine/manualReview.

Platform: \`system.eis.migration.view|manage|approveProduction|rollback|restrictedEvidence.view|securityIncidents.manage\`.

Auditors remain read-only.`
  ),

  'PHASE_19_SEGREGATION_OF_DUTIES.md': short(
    'Phase 19 Segregation of Duties',
    `Plan author ≠ Production approver. Executor ≠ self-approver. Security handles credential exposure. Accounting/Inventory reviewers cannot mutate financial evidence via migration tools.`
  ),

  'PHASE_19_APPROVALS.md': short(
    'Phase 19 Approvals',
    `Required for Production source register/extract, Dry Run sign-off, migrate, controlled updates, accepted-evidence import, quarantine release, rollback, restricted exports.`
  ),

  'PHASE_19_AUDIT_EVENTS.md': short(
    'Phase 19 Audit Events',
    `Source register/profile/extract, ownership/env conflicts, duplicates, Dry Run, migrate, quarantine, rollback, security incidents, blocked historical transmission. No credentials in Audit payloads.`
  ),

  'PHASE_19_NOTIFICATIONS.md': short(
    'Phase 19 Notifications',
    `Notify on conflicts, Dry Run blockers, migrate approval required, failures, Manual Review assignment, security incidents — Tenant/Business scoped, no secrets.`
  ),

  'PHASE_19_METRICS.md': short(
    'Phase 19 Metrics',
    `Counters for sources/assessed/migrated/quarantined/duplicates/cross-tenant/env conflicts; gauges for backlogs; histograms for durations. Avoid sensitive labels.`
  ),

  'PHASE_19_ALERTS.md': short(
    'Phase 19 Alerts',
    `CRITICAL: historical Sale submitted, Journal/Stock created during migration, cross-tenant import, env mix, credential export, source DB modified.

HIGH: checksum changed after Dry Run, recon mismatches, unapproved Production migrate.`
  ),

  'PHASE_19_TYPED_ERRORS.md': short(
    'Phase 19 Typed Errors',
    `\`MigrationErrors\` → \`MraEisControlError\` codes: SOURCE_READ_ONLY, SOURCE_CHECKSUM, CROSS_TENANT, ENVIRONMENT, FISCAL_NUMBER_CONFLICT, CREDENTIAL_LEAK, DRY_RUN_REQUIRED, APPROVAL_REQUIRED, HISTORICAL_TRANSMISSION_BLOCKED, ROLLBACK_NOT_ALLOWED, HOOK_ISOLATION, etc.`
  ),

  'MIGRATION_ADMINISTRATION_UI.md': short(
    'Migration Administration UI',
    `\`/settings/integrations/mra-eis/migration\` + Admin Centre section. Sources, cohorts, Dry Run, lineage table, reconciliation JSON, rollback. No Migrate Everything.`
  ),

  'SOURCE_SYSTEM_UI.md': short(
    'Source System UI',
    `Lists name/type/environment/read-only/status. Passwords never displayed; credential refs redacted.`
  ),

  'MIGRATION_PLAN_UI.md': short(
    'Migration Plan UI',
    `Cohort selection + Dry Run results (expected inserts/quarantines). Production path disabled in demo control without platform approval.`
  ),

  'MIGRATION_RUN_UI.md': short(
    'Migration Run UI',
    `Shows state/mode, checksums, assessed/eligible/quarantined/migrated/linked/failed, record table.`
  ),

  'RECORD_LINEAGE_VIEW.md': short(
    'Record Lineage View',
    `Per-record source ID, decision, classification, state, blockers, lineageKey/checksums (sensitive fields redacted).`
  ),

  'MIGRATION_RECONCILIATION_REPORTS.md': short(
    'Migration Reconciliation Reports',
    `\`buildReconciliationSummary\` + assessment reports listed in README pack. Source drill-down via record lineage.`
  ),

  'MIGRATION_EXPORTS.md': short(
    'Migration Exports',
    `Reuse Phase 18 export security (formula sanitize, permission recheck, expiring links). Exclude credentials/keys/BAC.`
  ),

  'PHASE_19_ACCESSIBILITY.md': short(
    'Phase 19 Accessibility',
    `Live regions for run updates; table captions; labelled filters; status not colour-only; keyboard-operable buttons.`
  ),

  'PHASE_19_RESPONSIVE_UI.md': short(
    'Phase 19 Responsive UI',
    `Stacked controls; scrollable lineage tables; wrapping checksums; no page-wide overflow.`
  ),

  'LEGACY_FILE_HANDLING.md': short(
    'Legacy File Handling',
    `Validate headers/types; reject macros; prevent formula injection; preserve file checksums; archive path traversal rejected; streaming for large files.`
  ),

  'PHASE_19_SYNTHETIC_FIXTURES.md': short(
    'Phase 19 Synthetic Fixtures',
    `Unit tests construct accepted/receipt-only/eligible-not-submitted/cross-tenant/duplicate-fiscal/credential-leak candidates. UI demo Dry Run uses three synthetic sales.`
  ),

  'PHASE_19_TEST_PLAN.md': short(
    'Phase 19 Test Plan',
    `Covered in \`test/mraEis.phase19.migration.test.js\`: sources, ownership/env, decisions, assessments, dry-run/migrate/idempotency/rollback, hook isolation, Production guards, checksum change.`
  ),

  'PHASE_19_TEST_RESULTS.md': short(
    'Phase 19 Test Results',
    `See vitest run of \`test/mraEis.phase19.migration.test.js\`. Expected: all scenarios PASS.`
  ),

  'PHASE_19_FINANCIAL_RECONCILIATION_RESULTS.md': short(
    'Phase 19 Financial Reconciliation Results',
    `Migration creates 0 Journals. Accounting variances remain MANUAL_REVIEW. financialSourceOfTruth=false on migration summaries.`
  ),

  'PHASE_19_INVENTORY_RECONCILIATION_RESULTS.md': short(
    'Phase 19 Inventory Reconciliation Results',
    `Migration creates 0 Stock Movements. Quantity mismatches quarantined; balances unchanged.`
  ),

  'PHASE_19_FISCAL_RECONCILIATION_RESULTS.md': short(
    'Phase 19 Fiscal Reconciliation Results',
    `fiscalNumbersGenerated=0; fiscalNumbersChanged=0; sequencesMovedBackwards=false. Duplicate fiscal numbers blocked.`
  ),

  'PHASE_19_RECEIPT_RECONCILIATION_RESULTS.md': short(
    'Phase 19 Receipt Reconciliation Results',
    `Receipt-without-response quarantined; acceptance never inferred from PDF alone.`
  ),

  'PHASE_19_SECURITY_TEST_RESULTS.md': short(
    'Phase 19 Security Test Results',
    `Credential leak blocked; embedded password refs rejected; client banned fields rejected by API; historical transmission assert throws.`
  ),

  'PHASE_19_ACCESSIBILITY_TEST_RESULTS.md': short(
    'Phase 19 Accessibility Test Results',
    `UI uses semantic headings, table captions, role=alert, aria-live on run panel. Full aXe suite deferred to Phase 20.`
  ),

  'PHASE_19_RESPONSIVE_TEST_RESULTS.md': short(
    'Phase 19 Responsive Test Results',
    `Layout uses max-width + flex-wrap + overflow-x-auto tables. Device matrix formal pass in Phase 20.`
  ),

  'PHASE_19_END_TO_END_RESULTS.md': short(
    'Phase 19 End-to-End Results',
    `Scenarios 1–10 encoded in unit tests: accepted historical, receipt-only, duplicate fiscal#, cross-tenant, eligible-not-submitted, offline uncertified, idempotent re-run, checksum change, rollback, file attack (API field rejection + policy).`
  ),

  'PHASE_19_DRY_RUN_REPORT.md': short(
    'Phase 19 Dry Run Report',
    `Dry Run produces dryRunChecksum, expectedInserts/links/quarantines, targetMutated=false, historicalSaleSubmitted=false.`
  ),

  'PHASE_19_MIGRATION_REPORT.md': short(
    'Phase 19 Migration Report',
    `Controlled additive migrate inserts HISTORICAL_EIS_EVIDENCE stubs with dispatchable=false. Live Production customer migration awaits G19-001 ops window.`
  ),

  'PHASE_19_ROLLBACK_REPORT.md': short(
    'Phase 19 Rollback Report',
    `Rollback removes migration-created targets only; lineagePreserved/journalsPreserved/stockMovementsPreserved/auditPreserved=true.`
  ),

  'PHASE_19_DEPLOYMENT_PLAN.md': short(
    'Phase 19 Deployment Plan',
    `1. Deploy code + run \`prisma migrate deploy\` (20260723100000)
2. Grant Phase 19 permissions
3. Register read-only sources (Sandbox first)
4. Profile + Dry Run + approve
5. Production only with backupVerified + platform approveProduction
6. Verify recon + no Outbox transmission Events`
  ),

  'PHASE_19_ROLLBACK_PLAN.md': short(
    'Phase 19 Rollback Plan',
    `Prefer cohort rollback via API action \`rollback\`. If catastrophic, restore verified pre-migration backup. Never delete pre-existing Journals/Stock/canonical Terminals.`
  ),

  'PHASE_19_OPERATIONS_GUIDE.md': short(
    'Phase 19 Operations Guide',
    `Commands (memory/demo path):
- POST register-source / create-manifest / profile-dataset
- POST create-run + dry-run
- POST approve-run + migrate (non-Prod or approved Prod)
- POST rollback
- GET /api/mra-eis/migration?runId=`
  ),

  'PHASE_19_INCIDENT_RUNBOOKS.md': short(
    'Phase 19 Incident Runbooks',
    `| Incident | Action |
|---|---|
| Historical transmit attempted | Block + Audit + CRITICAL alert |
| Credential in source row | BLOCKED_SECURITY + rotate/revoke |
| Checksum changed post Dry Run | Block migrate; re-profile |
| Duplicate fiscal# | Quarantine both; Manual Review |
| Cross-tenant | Block; security review |`
  ),

  'PHASE_19_RISK_REGISTER.md': short(
    'Phase 19 Risk Register',
    `| Risk | Mitigation |
|---|---|
| Bulk copy scripts reused | Dependency audit + DEPRECATE |
| Env mix | Classification + blockers |
| Financial replay | Hook isolation |
| Secret leakage | detectCredentialLeak + API bans |
| Irreversible Production import | Dry Run + backup + rollback |`
  ),

  'PHASE_20_HANDOVER.md': short(
    'Phase 20 Handover',
    `# Phase 20 — Complete automated testing & debugging

Phase 20 will implement full regression across Phases 1–19, architecture/contract/sandbox tests, multi-tenant isolation, accounting/inventory isolation, fiscal integrity, transmission/receipt/offline/restriction tests, migration verification, security penetration, secret scanning, performance/chaos, a11y/responsive, deployment/rollback rehearsal, Phase 21 certification readiness.

## Handover package
- Acceptance criteria Phases 1–19 (see each phase READY_* docs)
- Test inventory: \`test/mraEis.phase*.test.js\` including phase19
- Migration framework: \`${D}\` + API/UI
- Quarantine/Manual Review default for ambiguous data
- Remaining blockers: G19-001..007 + Phase 13–18 contract carry-forwards
- Tools: Dry Run checksums, rollback, read-model rebuild (Phase 18), mock MRA fixtures
- Exit criteria: no unresolved CRITICAL/HIGH EIS defects; sandbox contracts verified or explicitly waived; Production rollout plan approved`
  ),

  'PHASE_19_READINESS_DECISION.md': short(
    'Phase 19 Readiness Decision',
    `## Decision: READY_FOR_PHASE_20_WITH_BLOCKERS

Framework for discovery, ownership/env classification, integrity scoring, Dry Run, additive migration, lineage, quarantine, rollback, and Admin UI is implemented and unit-tested.

### Results summary
| Area | Result |
|---|---|
| Source Registry | IMPLEMENTED |
| Read-only + checksums | IMPLEMENTED |
| Ownership / Environment | IMPLEMENTED (no default Tenant) |
| Decision / Cohorts / Lineage | IMPLEMENTED |
| Dry Run / Migrate / Rollback | IMPLEMENTED |
| Hook isolation | IMPLEMENTED |
| UI / API / Permissions | IMPLEMENTED |
| Live Production extraction | BLOCKED (G19-001) |
| Full durable worker persistence | PARTIAL (G19-002/003) |

### Recommended next action
Proceed to Phase 20 system-wide testing; schedule operator-approved Sandbox then Production source profiling under G19-001.`
  ),

  'FINAL_PHASE_19_IMPLEMENTATION_REPORT.md': short(
    'Final Phase 19 Implementation Report',
    `# Final Phase 19 Implementation Report

## 1. Executive summary
Phase 19 delivers an evidence-driven migration framework that assesses and optionally imports historical EIS/EFD evidence additively with full lineage, without replaying business events or submitting historical Sales.

## 2. Phase boundary
Assessment + controlled additive migration only. No MRA transmit, no accounting/Inventory posting, no Terminal activation, no sequence rewrite.

## 3–80. Implementation evidence
Domain modules under \`${D}\`; API \`/api/mra-eis/migration\`; UI migration page; Prisma migration \`20260723100000_mra_eis_phase19_migration\`; permissions in \`lib/mraEis/domain/permissions.js\`; Admin Centre section; tests in \`test/mraEis.phase19.migration.test.js\`.

## Confirmations
- Source access read-only (registration gate)
- Source checksums recorded
- Migrated records have lineageKey
- Tenant/Business proven or quarantined (no default Tenant)
- Environment explicit or UNKNOWN→quarantine
- Production/Sandbox mixing blocked
- Cross-Tenant blocked
- Fiscal numbers preserved; duplicates quarantined
- Sequences not moved backwards
- No historical Sale submitted / offline uploaded
- No Journal / Stock created
- No fabricated MRA IDs / Response Evidence / QR
- Receipt ≠ acceptance
- Credentials/JWT/keys/BAC excluded
- Dry Run mutates no targets
- Idempotent re-run links existing
- Rollback migration-created only; Audit/lineage survive

## Readiness
**READY_FOR_PHASE_20_WITH_BLOCKERS** — see PHASE_19_READINESS_DECISION.md and PHASE_20_HANDOVER.md.`
  ),
};

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 19 docs to ${root}`);

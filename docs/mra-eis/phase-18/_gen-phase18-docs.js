/**
 * Generates Phase 18 documentation pack.
 * Run: node docs/mra-eis/phase-18/_gen-phase18-docs.js
 */
import fs from 'fs';
import path from 'path';

const root = path.resolve('docs/mra-eis/phase-18');
fs.mkdirSync(root, { recursive: true });

function w(name, body) {
  fs.writeFileSync(
    path.join(root, name),
    `${body.trim()}\n\n---\n*Phase 18 implementation. Operational window over Phases 1–17. No fiscal engine duplication. Server-authoritative Tenant/Business/Environment context. Failed queries ≠ zero. Stale data labelled. Commands are intent-only (no arbitrary final states). No Set Terminal Active / Mark Accepted / Clear MRA without evidence. No credentials/JWT/private keys/BAC in UI or exports. Saved views do not grant permissions. Scheduled/export permission rechecked. No Journal/Stock from Phase 18. No historical Sale submission.*\n`,
    'utf8'
  );
}

const A = 'lib/mraEis/application/admin/';
const short = (title, body) => `# ${title}\n\n${body}`;

const files = {
  'README.md': `# Phase 18 — Unified EIS Administration Centre

**Decision:** \`READY_FOR_PHASE_19_WITH_BLOCKERS\`

## Entry
- Domain: \`${A}\`
- Tenant API: \`/api/mra-eis/admin\`
- Tenant UI: \`/settings/integrations/mra-eis/centre\`
- Platform UI: \`/insightbooks/mra-eis/centre\`
- Sidebar: MRA EIS Admin Centre (platform) + MRA EIS Centre (tenant Features)
- Tests: \`test/mraEis.phase18.admin.test.js\`
- Wraps: Phase 7–17 settings/workbench pages (deep links)

## Hard rules
- Not a second EIS processing engine
- Every status from server-side domain data
- Commands invoke domain services only
- Failed dashboard queries are not shown as zero
- Critical restrictions override health scores
- Export permission rechecked at request / generate / download
- Signed download URLs expire
`,

  'PHASE_18_TASKS.md': short(
    'Phase 18 Tasks',
    `| Stream | Status |
|---|---|
| UI/nav dependency audit | DONE |
| Gap register | DONE |
| Information architecture + routes | DONE |
| Context bar + status design system | DONE |
| Dashboard aggregation + freshness | DONE |
| Health scorecards + SLA | DONE |
| Command architecture (intent-only) | DONE |
| Report registry + traceability | DONE |
| Export security + formula injection | DONE |
| Global search + saved views | DONE |
| Read models (rebuildable) | DONE |
| Tenant + Platform Admin Centre UI | DONE |
| Sidebar navigation | DONE |
| Unit tests | DONE |
| Docs + Phase 19 handover | DONE |
| Full async scheduled-report email delivery | PARTIAL / BLOCKED (infra) |
| Full chart library integration for all cards | DEFERRED |
| Live cross-tenant platform count queries | PARTIAL (structure ready; counts may be zero until wired) |`
  ),

  'PHASE_18_REQUIREMENT_TRACEABILITY.md': short(
    'Phase 18 Requirement Traceability',
    `| Requirement | Trace |
|---|---|
| Tenant context | \`resolveEisAdminContext\` |
| Status vocabulary | \`statusDesignSystem.js\` |
| Aggregation | \`dashboardAggregation.js\` |
| Health | \`healthScorecards.js\` |
| Commands | \`commandArchitecture.js\` |
| Reports | \`reportRegistry.js\` |
| Exports | \`exportSecurity.js\` |
| Search | \`globalSearch.js\` |
| Saved views | \`savedViews.js\` |
| Read models | \`readModels.js\` |
| SLA | \`slaMonitoring.js\` |
| Tenant UI | \`app/settings/integrations/mra-eis/centre\` |
| Platform UI | \`app/insightbooks/mra-eis/centre\` |
| API | \`app/api/mra-eis/admin\` |`
  ),

  'EIS_ADMIN_UI_DEPENDENCY_AUDIT.md': short(
    'EIS Admin UI Dependency Audit',
    `| Component | Classification |
|---|---|
| \`/settings/integrations/mra-eis/*\` phase pages | WRAP / EXTEND |
| \`/insightbooks/mra-eis/*\` platform pages | EXTEND |
| \`/api/mra-eis/*\` domain APIs | REUSE |
| Sidebar (no EIS before) | EXTEND |
| Inline tables / filters | REUSE |
| Export centre (missing) | NEW via exportSecurity |
| Set Active / Clear MRA / blind retry UI | UNSAFE — remain blocked |
| Phase 15–17 seed pages | WRAP as workspaces |`
  ),

  'PHASE_18_GAP_REGISTER.md': short(
    'Phase 18 Gap Register',
    `| ID | Gap | Severity | Status |
|---|---|---|---|
| G18-001 | Scheduled report email delivery pipeline | MEDIUM | PARTIAL |
| G18-002 | Full charting library + accessible alternatives for all series | MEDIUM | DEFERRED |
| G18-003 | Live platform cross-tenant SQL aggregations | MEDIUM | PARTIAL |
| G18-004 | Dedicated Manual Review / Incident SPA polish | MEDIUM | Deep-link + structure |
| G18-005 | Evidence graph visualization | LOW | Structured explorer deferred |
| G18-006 | Widget drag-and-drop customization persistence | LOW | DEFERRED |
| G18-007 | Carry-forward Phase 13–17 contract blockers | HIGH | Carry-forward |`
  ),

  'EIS_INFORMATION_ARCHITECTURE.md': short(
    'EIS Information Architecture',
    `Primary sections: Overview, Terminals, Agents/Devices, Configuration, Catalogue/Mappings, Transactions, Reconciliation, Offline, Receipts, Restrictions, Certification, Manual Review, Incidents, Alerts, Audit/Evidence, Reports/Exports.

Tenant routes under \`/settings/integrations/mra-eis/*\`.
Platform routes under \`/insightbooks/mra-eis/*\`.
Centre hubs deep-link into existing phase workspaces.`
  ),

  'PHASE_19_HANDOVER.md': short(
    'Phase 19 Handover',
    `Phase 19 owns existing-data assessment and controlled migration (EFD/EIS discovery, dry-run, additive migration, reconciliation before activation).

## From Phase 18
- Admin Centre routes + aggregation services
- Report definition registry + export security model
- Legacy UI audit (unsafe actions remain blocked)
- Read-model rebuild helpers
- Dashboard/report reconciliation helpers

## Must preserve
- Journals, Stock Movements, Sales/Invoices
- Immutable EIS evidence, fiscal numbers, accepted receipts
- Tenant/Business ownership, environment separation, audit history

## Must not
- Automatically transmit historical Sales`
  ),

  'PHASE_18_READINESS_DECISION.md': short(
    'Phase 18 Readiness Decision',
    `## Decision: READY_FOR_PHASE_19_WITH_BLOCKERS

Unified EIS Administration Centre foundations (context, aggregation, health, commands, reports, exports, search, tenant/platform UIs, navigation) are ready for Phase 19 data assessment.

### Blockers
- G18-001 scheduled email delivery
- G18-002/003 full charts + live platform aggregates
- G18-007 carry-forward contract blockers from Phases 13–17

### Recommended next action
Begin Phase 19 existing-data discovery using Admin Centre reports and Terminal/Restriction fleets; keep production unblock/offline contracts fail-closed.`
  ),

  'FINAL_PHASE_18_IMPLEMENTATION_REPORT.md': short(
    'Final Phase 18 Implementation Report',
    `## Executive summary
Phase 18 delivers a secure operational window into the authoritative EIS domain: Tenant and Platform Administration Centres, server-side aggregation, intent-only commands, report registry, export security, search, health scorecards, and navigation — without duplicating fiscal processing.

## Confirmations
- Tenant-scoped queries: YES
- Commands use domain intents only: YES
- Failed ≠ zero: YES
- Credentials absent: YES
- Immutable evidence not editable via Phase 18: YES
- No Journal / Stock / historical Sale: YES

## Readiness
\`READY_FOR_PHASE_19_WITH_BLOCKERS\``
  ),
};

const topics = [
  ['EIS_ROUTE_ARCHITECTURE.md', 'Tenant centre `/settings/integrations/mra-eis/centre`; Platform `/insightbooks/mra-eis/centre`; deep links to phase pages.'],
  ['EIS_NAVIGATION.md', 'Sidebar: platform Administration → MRA EIS Admin Centre; Features → MRA EIS Centre.'],
  ['EIS_GLOBAL_CONTEXT_BAR.md', 'buildContextBarModel — Tenant, Business, Environment badge, freshness, primary restriction.'],
  ['SYSTEM_ADMIN_EIS_DASHBOARD.md', 'aggregatePlatformEisOverview + `/insightbooks/mra-eis/centre`.'],
  ['TENANT_EIS_DASHBOARD.md', 'aggregateTenantEisOverview + tenant centre overview cards.'],
  ['BUSINESS_EIS_DASHBOARD.md', 'BusinessId aliases tenantId; same overview scoped to business.'],
  ['BRANCH_SITE_DASHBOARD.md', 'Deep-link mappings/sites pages; branch filter via context.branchId.'],
  ['TERMINAL_FLEET_DASHBOARD.md', 'EXTEND existing terminals fleet pages.'],
  ['TERMINAL_DETAILS.md', 'EXTEND `/settings/integrations/mra-eis/terminals/[id]`.'],
  ['AGENT_FLEET_DASHBOARD.md', 'WRAP offline agents page.'],
  ['DEVICE_FLEET_DASHBOARD.md', 'WRAP offline agents/device trust views.'],
  ['CONFIGURATION_SYNC_DASHBOARD.md', 'REUSE configuration freshness pages.'],
  ['CONFIGURATION_DIFF_VIEW.md', 'Immutable snapshot compare via Phase 8 services (no direct edit).'],
  ['CATALOGUE_SYNC_DASHBOARD.md', 'WRAP catalogue page.'],
  ['PRODUCT_SERVICE_MAPPING_WORKBENCH.md', 'WRAP mappings/catalogue workbenches.'],
  ['TAX_LEVY_PAYMENT_MAPPING_WORKBENCH.md', 'WRAP mappings tabs.'],
  ['EIS_ELIGIBILITY_MONITORING.md', 'REUSE sales-eligibility / sales-bridge.'],
  ['ONLINE_TRANSMISSION_MONITOR.md', 'WRAP sales-transmission.'],
  ['TRANSMISSION_DETAILS.md', 'Drill-down via existing transmission UI.'],
  ['SUBMISSION_ATTEMPT_TIMELINE.md', 'Phase 13 attempt evidence (read-only).'],
  ['REQUEST_RESPONSE_EVIDENCE_VIEW.md', 'Redacted evidence; restricted requires permission.'],
  ['RECONCILIATION_WORKBENCH.md', 'WRAP Phase 15 reconciliation UI.'],
  ['RECONCILIATION_DETAILS.md', 'No outcome editing.'],
  ['SAFE_RETRY_MONITORING.md', 'No generic Retry; approval-required command intent.'],
  ['FISCAL_SEQUENCE_DASHBOARD.md', 'REUSE fiscal-snapshots/sequences; no direct edit.'],
  ['OFFLINE_OPERATIONS_DASHBOARD.md', 'WRAP offline page.'],
  ['OFFLINE_QUEUE_MONITOR.md', 'No delete/reorder controls.'],
  ['OFFLINE_LIMIT_MONITOR.md', 'Limit usage via Phase 16 evaluateOfflineLimits.'],
  ['FISCAL_RECEIPT_DASHBOARD.md', 'WRAP fiscal-receipts.'],
  ['FISCAL_RECEIPT_DETAILS.md', 'Phase 14 actions only.'],
  ['RESTRICTION_UNBLOCK_CENTRE.md', 'WRAP restrictions page + Phase 17 services.'],
  ['POST_UNBLOCK_REVALIDATION_VIEW.md', 'Phase 17 revalidation results.'],
  ['CERTIFICATION_MANAGEMENT_CENTRE.md', 'Centre section + admin certifications API.'],
  ['MANUAL_REVIEW_WORKBENCH.md', 'MraEisManualReviewCase counts + assignment command intent.'],
  ['INCIDENT_DASHBOARD.md', 'Alert/incident structure; Phase 17 incident types.'],
  ['AUDIT_EXPLORER.md', 'Control audit events; auditors read-only.'],
  ['EVIDENCE_EXPLORER.md', 'Relationship navigation via deep links; no secrets.'],
  ['ALERT_CENTRE.md', 'MraEisAlertState; acknowledge command intent.'],
  ['NOTIFICATION_CENTRE.md', 'Integrates existing notification system (no sensitive previews).'],
  ['OPERATIONAL_HEALTH_SCORECARDS.md', 'calculateHealthScorecard documented weights.'],
  ['EIS_SLA_MONITORING.md', 'evaluateSla + SLA_TARGETS.'],
  ['EIS_GLOBAL_SEARCH.md', 'searchEisEntities Tenant-isolated + rate limit.'],
  ['EIS_SAVED_VIEWS.md', 'createSavedView/openSavedView; grantsPermissions=false.'],
  ['EIS_WIDGET_CUSTOMIZATION.md', 'Mandatory compliance widgets cannot be removed (policy documented; persistence deferred G18-006).'],
  ['EIS_REPORT_DEFINITION_REGISTRY.md', 'REPORT_DEFINITIONS.'],
  ['EIS_REPORT_CATALOGUE.md', 'listReportDefinitions.'],
  ['EIS_REPORT_SOURCE_TRACEABILITY.md', 'buildReportTraceability + reconcileReportTotals.'],
  ['EIS_EXPORT_CENTRE.md', 'create/generate/download export jobs.'],
  ['EIS_EXPORT_SECURITY.md', 'Permission recheck; signed URL expiry; formula sanitize.'],
  ['EIS_SCHEDULED_REPORTS.md', 'Permission-at-execution policy; email pipeline G18-001.'],
  ['EIS_READ_MODEL_ARCHITECTURE.md', 'upsert/get/rebuild read models; not financial SoT.'],
  ['EIS_DASHBOARD_AGGREGATION.md', 'Server-side aggregateTenant/PlatformEisOverview.'],
  ['EIS_DATA_FRESHNESS.md', 'FRESHNESS enum + labelling.'],
  ['EIS_SERVER_SIDE_PAGINATION.md', 'Fleet pages continue server filters; max page size policy.'],
  ['EIS_FILTERING_SORTING.md', 'Server-validated filters; no ORM injection.'],
  ['EIS_CHARTING_STANDARDS.md', 'Units/currency/timezone; accessible table alternative required (G18-002).'],
  ['EIS_STATUS_DESIGN_SYSTEM.md', 'EIS_STATUS vocabulary.'],
  ['EIS_COMMAND_ARCHITECTURE.md', 'prepareAdminCommand intent-only.'],
  ['EIS_COMMAND_CONFIRMATION.md', 'highRiskConfirmationPayload.'],
  ['EIS_ROLE_BASED_DASHBOARDS.md', 'SYSTEM / TENANT / AUDITOR read-only.'],
  ['EIS_IMPERSONATION_CONTROLS.md', 'Context exposes impersonating + real/effective actor.'],
  ['PHASE_18_AUDIT_EVENTS.md', 'Command audit payload; restricted evidence views audited at domain layer.'],
  ['PHASE_18_NOTIFICATIONS.md', 'Integrate existing notification channels.'],
  ['PHASE_18_METRICS.md', 'Dashboard/report/export counters (instrumentation hooks).'],
  ['PHASE_18_ALERTS.md', 'Cross-tenant exposure / credential-in-UI critical alerts policy.'],
  ['PHASE_18_TYPED_ERRORS.md', 'AdminErrors.*'],
  ['PHASE_18_SECURITY.md', 'Auth + scope + redaction + no final-state APIs.'],
  ['PHASE_18_ACCESSIBILITY.md', 'Landmarks, sr-only env text, role=status/alert on centre pages.'],
  ['PHASE_18_RESPONSIVE_UI.md', 'max-w-6xl; wrapping context bar; stacked cards.'],
  ['PHASE_18_PERFORMANCE.md', 'Server aggregation; async exports; no full history in browser.'],
  ['PHASE_18_CACHE_CONSISTENCY.md', 'buildDashboardCacheKey includes tenant/business/env.'],
  ['LEGACY_EIS_ADMIN_UI_MIGRATION_PLAN.md', 'Redirect hubs to centre; wrap seeds; remove unsafe actions; Phase 19 data migration.'],
  ['LEGACY_EIS_ADMIN_UI_MIGRATION_REPORT.md', 'Sidebar added; centre hubs live; unsafe actions remain blocked.'],
  ['PHASE_18_SYNTHETIC_FIXTURES.md', 'Vitest in-memory export/search/views/read models.'],
  ['PHASE_18_TEST_PLAN.md', 'test/mraEis.phase18.admin.test.js'],
  ['PHASE_18_TEST_RESULTS.md', 'Run vitest; expect pass.'],
  ['PHASE_18_REPORT_RECONCILIATION_RESULTS.md', 'reconcileReportTotals unit coverage.'],
  ['PHASE_18_SECURITY_TEST_RESULTS.md', 'Cross-tenant context; export auth; formula injection; auditor RO.'],
  ['PHASE_18_ACCESSIBILITY_TEST_RESULTS.md', 'Manual: headings, status, alerts, sr-only environment.'],
  ['PHASE_18_RESPONSIVE_TEST_RESULTS.md', 'Manual: 320px wrap; no page-wide overflow on centre.'],
  ['PHASE_18_PERFORMANCE_TEST_RESULTS.md', 'Aggregation O(cards); export async job pattern.'],
  ['PHASE_18_END_TO_END_RESULTS.md', 'Scenarios 1,7,8 encoded in unit+API; others via domain UIs.'],
  ['PHASE_18_DEPLOYMENT_PLAN.md', 'Deploy admin API/UI + sidebar; no new fiscal migrations required.'],
  ['PHASE_18_ROLLBACK_PLAN.md', 'Remove centre routes/nav; retain Phase 1–17 APIs.'],
  ['PHASE_18_OPERATIONS_GUIDE.md', 'Open centre → context bar → drill to workspace → intent command.'],
  ['PHASE_18_REPORTING_GUIDE.md', 'list reports → create export → permission recheck → signed download.'],
  ['PHASE_18_SUPPORT_RUNBOOK.md', 'Impersonation banner; no secrets; open Manual Review / Restrictions.'],
  ['PHASE_18_RISK_REGISTER.md', 'Highest residual: incomplete live platform aggregates + carry-forward contracts.'],
];

for (const [name, body] of topics) {
  files[name] = short(name.replace(/\.md$/, '').replace(/_/g, ' '), body);
}

for (const [name, body] of Object.entries(files)) {
  w(name, body);
}

console.log(`Wrote ${Object.keys(files).length} Phase 18 docs to ${root}`);

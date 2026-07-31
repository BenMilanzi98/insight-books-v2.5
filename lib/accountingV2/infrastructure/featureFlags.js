/**
 * Accounting V2 — server-controlled feature flags and posting-mode resolution.
 *
 * Flags live in the database (`AcctV2FeatureFlag`) with scope precedence:
 *   tenant+module+event > tenant+module > tenant > global(module/event) > global > default(false)
 * Sentinel "*" means "any". Frontend input is never consulted.
 *
 * Fresh-books V2-only: NEW_ENGINE is the only posting mode (or DISABLED).
 */

import { PostingMode } from '../domain/enums.js';

export const FLAG = Object.freeze({
  V2_ENABLED: 'accountingV2Enabled',
  SHADOW_MODE: 'accountingV2ShadowMode',
  NEW_JOURNAL_SCHEMA: 'accountingV2NewJournalSchema',
  NEW_LEDGER_QUERY: 'accountingV2NewLedgerQuery',
  NEW_TRIAL_BALANCE: 'accountingV2NewTrialBalance',
  STRICT_IDEMPOTENCY: 'accountingV2StrictIdempotency',
  STRICT_TENANT_VALIDATION: 'accountingV2StrictTenantValidation',
  AUDIT_ONLY: 'accountingV2AuditOnly',
  /** Phase 5: ledger summary projection maintained/consulted for summaries. */
  LEDGER_PROJECTION: 'accountingV2LedgerProjection',
  /** Phase 5: scheduled ledger integrity monitoring surfaces findings. */
  LEDGER_INTEGRITY_MONITORING: 'accountingV2LedgerIntegrityMonitoring',
});

/** Chart of Accounts governance flags (Phase 3). All default OFF. */
export const COA_FLAGS = Object.freeze({
  V2_ENABLED: 'coaV2Enabled',
  STRICT_VALIDATION: 'coaV2StrictValidation',
  CANONICAL_MAPPINGS: 'coaV2CanonicalMappings',
  EXPENSE_CATEGORY_FILTERING: 'coaV2ExpenseCategoryFiltering',
  SALARY_ACCOUNT_ENFORCEMENT: 'coaV2SalaryAccountEnforcement',
  HIERARCHY_VALIDATION: 'coaV2HierarchyValidation',
  SYSTEM_ACCOUNT_PROTECTION: 'coaV2SystemAccountProtection',
  FINANCIAL_STATEMENT_MAPPINGS: 'coaV2FinancialStatementMappings',
  LEGACY_ALIAS_RESOLUTION: 'coaV2LegacyAliasResolution',
  IMPORT_VALIDATION: 'coaV2ImportValidation',
});

/** Phase 7 — reporting engine rollout flags. All default OFF (server-controlled). */
export const REPORT_FLAGS = Object.freeze({
  TRIAL_BALANCE_V2: 'trialBalanceV2Enabled',
  FINANCIAL_REPORTS_V2: 'financialReportsV2Enabled',
  INCOME_STATEMENT_V2: 'incomeStatementV2Enabled',
  BALANCE_SHEET_V2: 'balanceSheetV2Enabled',
  CASH_FLOW_V2: 'cashFlowV2Enabled',
  EQUITY_STATEMENT_V2: 'equityStatementV2Enabled',
  DRILL_DOWN_V2: 'reportDrillDownV2Enabled',
  EXPORTS_V2: 'reportExportsV2Enabled',
  INTEGRITY_V2: 'reportIntegrityV2Enabled',
  SNAPSHOTS_V2: 'reportSnapshotsV2Enabled',
  CACHE_V2: 'reportCacheV2Enabled',
  DASHBOARD_CANONICAL: 'dashboardCanonicalReportsEnabled',
});

/** Phase 8 — financial calendar / period control rollout flags. Default OFF. */
export const PERIOD_FLAGS = Object.freeze({
  CALENDAR_V2: 'financialCalendarV2Enabled',
  PERIODS_V2: 'accountingPeriodsV2Enabled',
  RESOLVER_V2: 'periodResolverV2Enabled',
  STRICT_POSTING: 'strictPeriodPostingEnabled',
  CLOSE_WORKFLOW: 'periodCloseWorkflowEnabled',
  REOPEN_WORKFLOW: 'periodReopenWorkflowEnabled',
  BACKDATING_APPROVAL: 'backdatingApprovalEnabled',
  FUTURE_DATING_CONTROL: 'futureDatingControlEnabled',
  CLOSE_CHECKLIST_V2: 'closeChecklistV2Enabled',
  CLOSE_SNAPSHOTS: 'closeSnapshotsEnabled',
  INTEGRITY_MONITORING: 'periodIntegrityMonitoringEnabled',
});

/** Phase 10 — bank reconciliation rollout flags. Default OFF. */
export const BANK_RECON_FLAGS = Object.freeze({
  ENABLED: 'bankReconciliationV2Enabled',
  AUTO_MATCH: 'bankReconciliationAutoMatchEnabled',
  PERIOD_CLOSE_FEED: 'bankReconciliationPeriodCloseFeedEnabled',
  OFX_IMPORT: 'bankReconciliationOfxImportEnabled',
});

/** Phase 11 — equity management rollout flags. Default OFF. */
export const EQUITY_FLAGS = Object.freeze({
  ENABLED: 'equityManagementV2Enabled',
  OWNERS: 'ownerManagementV2Enabled',
  SHAREHOLDERS: 'shareholderManagementV2Enabled',
  SHARE_CAPITAL: 'shareCapitalV2Enabled',
  CONTRIBUTIONS: 'capitalContributionV2Enabled',
  DRAWINGS: 'ownerDrawingV2Enabled',
  DIVIDENDS: 'dividendManagementV2Enabled',
  RECONCILIATION: 'equityReconciliationV2Enabled',
  SNAPSHOTS: 'equitySnapshotsV2Enabled',
  OWNERSHIP_REGISTER: 'ownershipRegisterV2Enabled',
  LEGACY_READ: 'equityLegacyReadEnabled',
});

/** Phase 12 — month-end / year-end close rollout flags. Default OFF. */
export const CLOSE_FLAGS = Object.freeze({
  ENABLED: 'accountingCloseV2Enabled',
  MONTH_END: 'monthEndCloseV2Enabled',
  YEAR_END: 'yearEndCloseV2Enabled',
  ADJUSTMENTS: 'yearEndAdjustmentsV2Enabled',
  ATB: 'adjustedTrialBalanceV2Enabled',
  CLOSING_JOURNALS: 'closingJournalV2Enabled',
  PCTB: 'postClosingTrialBalanceV2Enabled',
  ANNUAL_SNAPSHOTS: 'annualSnapshotsV2Enabled',
  FY_CLOSURE: 'financialYearClosureV2Enabled',
  FY_REOPEN: 'financialYearReopenV2Enabled',
  FY_RECLOSE: 'financialYearRecloseV2Enabled',
  INTEGRITY: 'closeIntegrityMonitoringV2Enabled',
  LEGACY_READ: 'legacyCloseReadEnabled',
});

/** Phase 13 — financial planning / three-statement forecasting flags. */
export const PLANNING_FLAGS = Object.freeze({
  ENABLED: 'financialPlanningV2Enabled',
  BUDGETING: 'budgetingV2Enabled',
  FORECASTING: 'forecastingV2Enabled',
  ASSUMPTIONS: 'assumptionsEngineV2Enabled',
  SCENARIOS: 'scenarioPlanningV2Enabled',
  ROLLING: 'rollingForecastV2Enabled',
  THREE_STATEMENT: 'threeStatementProjectionV2Enabled',
  VARIANCE: 'varianceAnalysisV2Enabled',
  TREND: 'trendAnalysisV2Enabled',
  AI: 'aiForecastSuggestionsEnabled',
  SNAPSHOTS: 'forecastSnapshotsV2Enabled',
  IMPORTS: 'planningImportsV2Enabled',
  LEGACY_READ: 'legacyPlanningReadEnabled',
});

/** Phase 14 — loan readiness / debt capacity / lender packs. */
export const LOAN_READINESS_FLAGS = Object.freeze({
  ENABLED: 'loanReadinessV2Enabled',
  DEBT_CAPACITY: 'debtCapacityV2Enabled',
  PROPOSED_FACILITY: 'proposedFacilityModellingV2Enabled',
  STRESS: 'stressTestingV2Enabled',
  COVENANTS: 'covenantMonitoringV2Enabled',
  DOCUMENTS: 'documentReadinessV2Enabled',
  COLLATERAL: 'collateralReadinessV2Enabled',
  SCORING: 'readinessScoringV2Enabled',
  LENDER_PACKAGE: 'lenderPackageV2Enabled',
  EXEC_DASHBOARD: 'executiveFinancialDashboardV2Enabled',
  BOARD_PACK: 'boardPackV2Enabled',
  AI: 'aiLoanReadinessCommentaryEnabled',
  LEGACY_READ: 'legacyLoanReadinessReadEnabled',
});

/** Phase 15 — platform security governance. */
export const SECURITY_FLAGS = Object.freeze({
  ENABLED: 'securityGovernanceV2Enabled',
  AUTHORIZATION: 'authorizationV2Enabled',
  MEMBERSHIP: 'businessMembershipV2Enabled',
  SCOPED_PERMISSIONS: 'scopedPermissionsV2Enabled',
  APPROVAL_POLICY: 'approvalPolicyV2Enabled',
  SOD: 'segregationOfDutiesV2Enabled',
  AUDIT_TRAIL: 'auditTrailV2Enabled',
  AUDIT_INTEGRITY: 'auditIntegrityV2Enabled',
  SECURE_FILES: 'secureFileAccessV2Enabled',
  EXPORT_SECURITY: 'exportSecurityV2Enabled',
  SESSION_SECURITY: 'sessionSecurityV2Enabled',
  MFA_POLICY: 'mfaPolicyV2Enabled',
  IMPERSONATION: 'impersonationControlsV2Enabled',
  EMERGENCY_ACCESS: 'emergencyAccessV2Enabled',
  MONITORING: 'securityMonitoringV2Enabled',
  AI_GOVERNANCE: 'aiGovernanceV2Enabled',
  RATE_LIMITING: 'rateLimitingV2Enabled',
  LEGACY_AUTHZ_READ: 'legacyAuthorizationReadEnabled',
});

/** Purchases procure-to-pay — GRNI / three-way match cutover. Default OFF (legacy AP-at-receipt). */
export const PURCHASES_FLAGS = Object.freeze({
  GRNI_V2: 'purchasesGrniV2Enabled',
  MATCHING_V2: 'purchasesThreeWayMatchV2Enabled',
});

/** Phase 17 — performance / reliability controls. */
export const PERFORMANCE_FLAGS = Object.freeze({
  ENABLED: 'performanceReliabilityV2Enabled',
  OBSERVABILITY: 'observabilityV2Enabled',
  TENANT_QUOTA: 'tenantQuotaV2Enabled',
  BACKPRESSURE: 'backpressureV2Enabled',
  CIRCUIT_BREAKER: 'circuitBreakerV2Enabled',
  REPORT_CACHING: 'reportCachingV2Enabled',
  BACKGROUND_EXPORT: 'backgroundExportV2Enabled',
  BACKGROUND_IMPORT: 'backgroundImportV2Enabled',
  ALERTING: 'performanceAlertingV2Enabled',
  READ_REPLICA: 'readReplicaV2Enabled',
});

const KNOWN_FLAGS = new Set([
  ...Object.values(FLAG),
  ...Object.values(COA_FLAGS),
  ...Object.values(REPORT_FLAGS),
  ...Object.values(PERIOD_FLAGS),
  ...Object.values(BANK_RECON_FLAGS),
  ...Object.values(EQUITY_FLAGS),
  ...Object.values(CLOSE_FLAGS),
  ...Object.values(PLANNING_FLAGS),
  ...Object.values(LOAN_READINESS_FLAGS),
  ...Object.values(SECURITY_FLAGS),
  ...Object.values(PERFORMANCE_FLAGS),
  ...Object.values(PURCHASES_FLAGS),
]);

/**
 * Flags that are ON when no DB row exists (Phase 12 close + Phase 13 planning pre-enabled).
 * An explicit `enabled: false` row still disables them per tenant/global scope.
 */
const DEFAULT_ENABLED_FLAGS = new Set([
  CLOSE_FLAGS.ENABLED,
  CLOSE_FLAGS.MONTH_END,
  CLOSE_FLAGS.YEAR_END,
  CLOSE_FLAGS.ADJUSTMENTS,
  CLOSE_FLAGS.ATB,
  CLOSE_FLAGS.CLOSING_JOURNALS,
  CLOSE_FLAGS.PCTB,
  CLOSE_FLAGS.ANNUAL_SNAPSHOTS,
  CLOSE_FLAGS.FY_CLOSURE,
  CLOSE_FLAGS.FY_REOPEN,
  CLOSE_FLAGS.FY_RECLOSE,
  CLOSE_FLAGS.INTEGRITY,
  PLANNING_FLAGS.ENABLED,
  PLANNING_FLAGS.BUDGETING,
  PLANNING_FLAGS.FORECASTING,
  PLANNING_FLAGS.ASSUMPTIONS,
  PLANNING_FLAGS.SCENARIOS,
  PLANNING_FLAGS.ROLLING,
  PLANNING_FLAGS.THREE_STATEMENT,
  PLANNING_FLAGS.VARIANCE,
  PLANNING_FLAGS.TREND,
  PLANNING_FLAGS.SNAPSHOTS,
  LOAN_READINESS_FLAGS.ENABLED,
  LOAN_READINESS_FLAGS.DEBT_CAPACITY,
  LOAN_READINESS_FLAGS.PROPOSED_FACILITY,
  LOAN_READINESS_FLAGS.STRESS,
  LOAN_READINESS_FLAGS.COVENANTS,
  LOAN_READINESS_FLAGS.DOCUMENTS,
  LOAN_READINESS_FLAGS.COLLATERAL,
  LOAN_READINESS_FLAGS.SCORING,
  LOAN_READINESS_FLAGS.LENDER_PACKAGE,
  LOAN_READINESS_FLAGS.EXEC_DASHBOARD,
  LOAN_READINESS_FLAGS.BOARD_PACK,
  // Phase 15 — core security surfaces default ON; MFA/impersonation/emergency remain opt-in
  SECURITY_FLAGS.ENABLED,
  SECURITY_FLAGS.AUTHORIZATION,
  SECURITY_FLAGS.MEMBERSHIP,
  SECURITY_FLAGS.APPROVAL_POLICY,
  SECURITY_FLAGS.SOD,
  SECURITY_FLAGS.AUDIT_TRAIL,
  SECURITY_FLAGS.AUDIT_INTEGRITY,
  SECURITY_FLAGS.SECURE_FILES,
  SECURITY_FLAGS.EXPORT_SECURITY,
  SECURITY_FLAGS.SESSION_SECURITY,
  SECURITY_FLAGS.MONITORING,
  SECURITY_FLAGS.AI_GOVERNANCE,
  SECURITY_FLAGS.RATE_LIMITING,
  // Phase 17 — core fairness/observability default ON; replica/background workers opt-in
  PERFORMANCE_FLAGS.ENABLED,
  PERFORMANCE_FLAGS.OBSERVABILITY,
  PERFORMANCE_FLAGS.TENANT_QUOTA,
  PERFORMANCE_FLAGS.BACKPRESSURE,
  PERFORMANCE_FLAGS.ALERTING,
  // Purchases — true GRNI (Dr Inventory / Cr GRNI at receipt; bill clears GRNI → AP)
  PURCHASES_FLAGS.GRNI_V2,
  PURCHASES_FLAGS.MATCHING_V2,
]);

/** Specificity score: more specific scopes win. */
function specificity(row) {
  let score = 0;
  if (row.tenantId !== '*') score += 4;
  if (row.moduleKey !== '*') score += 2;
  if (row.eventType !== '*') score += 1;
  return score;
}

async function matchingFlagRows(prisma, flagKey, scope) {
  if (!KNOWN_FLAGS.has(flagKey)) return [];
  if (typeof prisma?.acctV2FeatureFlag?.findMany !== 'function') return [];
  const rows = await prisma.acctV2FeatureFlag.findMany({
    where: {
      flagKey,
      tenantId: { in: [scope.tenantId, '*'] },
      moduleKey: { in: [scope.moduleKey ?? '*', '*'] },
      eventType: { in: [scope.eventType ?? '*', '*'] },
    },
  });
  rows.sort((a, b) => specificity(b) - specificity(a));
  return rows;
}

/**
 * Evaluate a flag for a scope.
 * Default deny, except DEFAULT_ENABLED_FLAGS which are ON when no row matches.
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {string} flagKey
 * @param {{tenantId: string, moduleKey?: string, eventType?: string}} scope
 * @returns {Promise<boolean>}
 */
export async function isFlagEnabled(prisma, flagKey, scope) {
  const rows = await matchingFlagRows(prisma, flagKey, scope);
  if (rows.length === 0) return DEFAULT_ENABLED_FLAGS.has(flagKey);
  return rows[0].enabled === true;
}

/**
 * Upsert a flag (admin-only paths; callers must have already authorized and audited).
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {object} params
 */
export async function setFlag(prisma, params) {
  if (!KNOWN_FLAGS.has(params.flagKey)) {
    throw new RangeError(`Unknown accounting flag: ${params.flagKey}`);
  }
  const scope = {
    tenantId: params.tenantId ?? '*',
    flagKey: params.flagKey,
    moduleKey: params.moduleKey ?? '*',
    eventType: params.eventType ?? '*',
  };
  return prisma.acctV2FeatureFlag.upsert({
    where: { tenantId_flagKey_moduleKey_eventType: scope },
    create: { ...scope, enabled: params.enabled, reason: params.reason ?? null, updatedBy: params.updatedBy ?? null },
    update: { enabled: params.enabled, reason: params.reason ?? null, updatedBy: params.updatedBy ?? null },
  });
}

/**
 * Resolve the effective posting mode for a business event — entirely server-side.
 *
 * Fresh-books V2-only:
 *   - DISABLED when config says DISABLED or AUDIT_ONLY is on
 *   - otherwise always NEW_ENGINE (LEGACY/SHADOW/DUAL are not runtime modes)
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{tenantId: string, moduleKey?: string, eventType?: string}} scope
 * @returns {Promise<string>} PostingMode value
 */
export async function resolvePostingMode(prisma, scope) {
  const hasConfigDelegate = typeof prisma?.acctV2Configuration?.findUnique === 'function';
  const config = hasConfigDelegate
    ? await prisma.acctV2Configuration.findUnique({ where: { tenantId: scope.tenantId } })
    : null;

  if (config?.defaultPostingMode === PostingMode.DISABLED) {
    return PostingMode.DISABLED;
  }

  if (await isFlagEnabled(prisma, FLAG.AUDIT_ONLY, scope)) {
    return PostingMode.DISABLED;
  }

  return PostingMode.NEW_ENGINE;
}

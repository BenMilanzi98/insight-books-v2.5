/**
 * Accounting V2 — permission catalogue.
 *
 * Single definition of accounting permission keys, layered on the existing
 * permission framework (`hasPermission` in lib/auth.js). Full-access tenant roles
 * (Owner/Admin) pass through the existing role logic; these keys let granular roles
 * be granted specific accounting capabilities.
 */

import { hasPermission } from '../auth.js';

export const ACCOUNTING_PERMISSIONS = Object.freeze({
  VIEW: 'accounting.view',
  CONFIGURE: 'accounting.configure',
  COA_VIEW: 'coa.view',
  COA_MANAGE: 'coa.manage',
  COA_CREATE: 'coa.create',
  COA_UPDATE: 'coa.update',
  COA_MOVE: 'coa.move',
  COA_ACTIVATE: 'coa.activate',
  COA_DEPRECATE: 'coa.deprecate',
  COA_ARCHIVE: 'coa.archive',
  COA_RESTORE: 'coa.restore',
  COA_MAP_ACCOUNTS: 'coa.mapAccounts',
  COA_MANAGE_SYSTEM_ACCOUNTS: 'coa.manageSystemAccounts',
  COA_MANAGE_CONTROL_ACCOUNTS: 'coa.manageControlAccounts',
  COA_MANAGE_TEMPLATES: 'coa.manageTemplates',
  COA_IMPORT: 'coa.import',
  COA_EXPORT: 'coa.export',
  COA_VIEW_AUDIT: 'coa.viewAudit',
  COA_APPROVE_CONSOLIDATION: 'coa.approveConsolidation',
  COA_RUN_VALIDATION: 'coa.runValidation',
  JOURNAL_VIEW: 'journal.view',
  JOURNAL_CREATE: 'journal.create',
  JOURNAL_SUBMIT: 'journal.submit',
  JOURNAL_APPROVE: 'journal.approve',
  JOURNAL_POST: 'journal.post',
  JOURNAL_REVERSE: 'journal.reverse',
  JOURNAL_CREATE_ADJUSTMENT: 'journal.createAdjustment',
  JOURNAL_POST_ADJUSTMENT: 'journal.postAdjustment',
  POSTING_VIEW: 'accountingPosting.view',
  POSTING_PREVIEW: 'accountingPosting.preview',
  POSTING_SUBMIT: 'accountingPosting.submit',
  POSTING_RETRY: 'accountingPosting.retry',
  POSTING_VIEW_FAILURES: 'accountingPosting.viewFailures',
  POSTING_CONFIGURE: 'accountingPosting.configure',
  POSTING_MANAGE_MODES: 'accountingPosting.manageModes',
  POSTING_BACKDATE: 'accountingPosting.backdate',
  POSTING_CONTROL_ACCOUNTS: 'accountingPosting.postControlAccounts',
  OPENING_BALANCES_CREATE: 'openingBalances.create',
  OPENING_BALANCES_APPROVE: 'openingBalances.approve',
  OPENING_BALANCES_POST: 'openingBalances.post',
  SHADOW_VIEW: 'accountingShadow.view',
  DIAGNOSTICS_VIEW: 'accountingDiagnostics.view',
  LEDGER_VIEW: 'ledger.view',
  LEDGER_EXPORT: 'ledger.export',
  LEDGER_REBUILD: 'ledger.rebuild',
  LEDGER_RECONCILE: 'ledger.reconcile',
  LEDGER_VIEW_INTEGRITY: 'ledger.viewIntegrity',
  JOURNAL_EXPORT: 'journal.export',
  TRIAL_BALANCE_VIEW: 'trialBalance.view',
  RECEIVABLES_VIEW: 'receivables.view',
  PAYABLES_VIEW: 'payables.view',
  PERIODS_VIEW: 'periods.view',
  PERIODS_CLOSE: 'periods.close',
  PERIODS_REOPEN: 'periods.reopen',
  // Phase 8 — financial calendar and period control framework.
  FY_VIEW: 'financialYears.view',
  FY_CREATE: 'financialYears.create',
  FY_CONFIGURE: 'financialYears.configure',
  FY_OPEN: 'financialYears.open',
  PERIODS_BEGIN_CLOSE: 'accountingPeriods.beginClose',
  PERIODS_COMPLETE_TASKS: 'accountingPeriods.completeTasks',
  PERIODS_ADD_EVIDENCE: 'accountingPeriods.addEvidence',
  PERIODS_MANAGE_EXCEPTIONS: 'accountingPeriods.manageExceptions',
  PERIODS_SUBMIT_CLOSE: 'accountingPeriods.submitClose',
  PERIODS_REVIEW_CLOSE: 'accountingPeriods.reviewClose',
  PERIODS_APPROVE_CLOSE: 'accountingPeriods.approveClose',
  PERIODS_EXECUTE_CLOSE: 'accountingPeriods.close',
  PERIODS_REQUEST_REOPEN: 'accountingPeriods.requestReopen',
  PERIODS_APPROVE_REOPEN: 'accountingPeriods.approveReopen',
  PERIODS_RECLOSE: 'accountingPeriods.reclose',
  PERIODS_VIEW_AUDIT: 'accountingPeriods.viewAudit',
  PERIODS_VIEW_SNAPSHOTS: 'accountingPeriods.viewSnapshots',
  PERIODS_EXPORT_CLOSE_PACK: 'accountingPeriods.exportClosePack',
  PERIODS_OVERRIDE_MATERIALITY: 'accountingPeriods.overrideMateriality',
  PERIODS_SET_LOCK_DATE: 'accountingPeriods.setLockDate',
  PERIODS_POST_BACKDATED: 'accountingPeriods.postBackdated',
  PERIODS_POST_FUTURE_DATED: 'accountingPeriods.postFutureDated',
  PERIODS_POST_ADJUSTMENTS: 'accountingPeriods.postAdjustments',
  PERIODS_MIGRATE: 'accountingPeriods.migrate',
  CAPITAL_VIEW: 'capital.view',
  CAPITAL_RECORD: 'capital.record',
  CAPITAL_APPROVE: 'capital.approve',
  AUDIT_VIEW: 'accountingAudit.view',
  ARCHITECTURE_CONFIGURE: 'accountingArchitecture.configure',
  FEATURE_FLAGS_MANAGE: 'accountingFeatureFlags.manage',
  // Phase 6 — historical repair (separation of duties between propose/approve/
  // execute/verify is enforced server-side in the repair services).
  REPAIR_VIEW: 'accountingRepair.view',
  REPAIR_INVESTIGATE: 'accountingRepair.investigate',
  REPAIR_ADD_EVIDENCE: 'accountingRepair.addEvidence',
  REPAIR_PROPOSE: 'accountingRepair.propose',
  REPAIR_PREVIEW: 'accountingRepair.preview',
  REPAIR_APPROVE: 'accountingRepair.approve',
  REPAIR_EXECUTE: 'accountingRepair.execute',
  REPAIR_VERIFY: 'accountingRepair.verify',
  REPAIR_ROLLBACK: 'accountingRepair.rollback',
  REPAIR_ACCEPT_EXCEPTION: 'accountingRepair.acceptException',
  REPAIR_EXPORT: 'accountingRepair.export',
  REPAIR_MANAGE_BATCHES: 'accountingRepair.manageBatches',
  REPAIR_REBUILD_LEDGER: 'accountingRepair.rebuildLedger',
  REPAIR_VIEW_SENSITIVE: 'accountingRepair.viewSensitiveEvidence',
  // Phase 7 — financial reporting engine.
  REPORTS_VIEW: 'reports.view',
  REPORTS_VIEW_STATEMENTS: 'reports.viewFinancialStatements',
  REPORTS_VIEW_TRIAL_BALANCE: 'reports.viewTrialBalance',
  REPORTS_VIEW_RECEIVABLES: 'reports.viewReceivables',
  REPORTS_VIEW_PAYABLES: 'reports.viewPayables',
  REPORTS_VIEW_INVENTORY: 'reports.viewInventory',
  REPORTS_VIEW_PAYROLL: 'reports.viewPayroll',
  REPORTS_VIEW_ASSETS: 'reports.viewAssets',
  REPORTS_VIEW_LOANS: 'reports.viewLoans',
  REPORTS_VIEW_TAX: 'reports.viewTax',
  REPORTS_VIEW_EQUITY: 'reports.viewEquity',
  REPORTS_VIEW_INTEGRITY: 'reports.viewIntegrity',
  REPORTS_VIEW_DRILL_DOWN: 'reports.viewDrillDown',
  REPORTS_EXPORT: 'reports.export',
  REPORTS_REVIEW: 'reports.review',
  REPORTS_APPROVE: 'reports.approve',
  REPORTS_SNAPSHOT: 'reports.snapshot',
  REPORTS_MANAGE_DEFINITIONS: 'reports.manageDefinitions',
  REPORTS_REBUILD_CACHE: 'reports.rebuildCache',
});

/**
 * Architecture/flag management is restricted to explicit permission or the
 * tenant Owner/Admin roles surfaced by the existing framework — never granted
 * implicitly to finance roles.
 * @param {object} user session user
 */
export function canManageAccountingArchitecture(user) {
  return (
    hasPermission(user, ACCOUNTING_PERMISSIONS.ARCHITECTURE_CONFIGURE) ||
    hasPermission(user, ACCOUNTING_PERMISSIONS.FEATURE_FLAGS_MANAGE)
  );
}

/** @param {object} user @param {string} permission one of ACCOUNTING_PERMISSIONS */
export function hasAccountingPermission(user, permission) {
  return hasPermission(user, permission);
}

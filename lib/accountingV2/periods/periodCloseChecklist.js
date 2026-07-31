/**
 * Phase 8 — versioned period close checklist templates (§26–§30).
 *
 * Published template versions are immutable code constants (the same
 * governance model as Phase 7 report definitions): changing a checklist
 * requires publishing a new version here; close runs permanently record the
 * template id and version they were materialized from.
 *
 * Task kinds:
 *  - AUTOMATIC: executed by `runAutomatedCloseChecks` against canonical
 *    Phase 5/6/7 services — never against independent totals.
 *  - MANUAL: completed by an authorized user with comment/evidence.
 * `blocking: true` tasks must PASS (or be waived by an authorized user with
 * reason + risk acknowledgement) before closure.
 */

export const CLOSE_TASK_KIND = Object.freeze({ AUTOMATIC: 'AUTOMATIC', MANUAL: 'MANUAL' });

const t = (taskKey, name, module, kind, blocking, opts = {}) => Object.freeze({
  taskKey,
  name,
  module,
  kind,
  blocking,
  required: opts.required ?? true,
  evidenceRequired: opts.evidenceRequired ?? kind === CLOSE_TASK_KIND.MANUAL,
  description: opts.description ?? name,
});

const STANDARD_MONTHLY_CLOSE_V1 = Object.freeze({
  templateId: 'STANDARD_MONTHLY_CLOSE',
  version: '1.0.0',
  name: 'Standard monthly period close',
  tasks: Object.freeze([
    // ── Automated accounting integrity (blocking) ──
    t('TB_BALANCED', 'Trial Balance balances', 'TRIAL_BALANCE', 'AUTOMATIC', true),
    t('JOURNALS_BALANCED', 'All posted V2 journals balance', 'GENERAL_LEDGER', 'AUTOMATIC', true),
    t('NO_POSTING_IN_FLIGHT', 'No journals stuck in POSTING state', 'POSTING_ENGINE', 'AUTOMATIC', true),
    t('NO_FAILED_POSTINGS', 'No unresolved failed postings in the period', 'POSTING_ENGINE', 'AUTOMATIC', true),
    t('DRAFT_JOURNALS_REVIEWED', 'No unauthorized draft journals remain in the period', 'JOURNALS', 'AUTOMATIC', true),
    t('BS_EQUATION', 'Statement of Financial Position equation holds', 'REPORTS', 'AUTOMATIC', true),
    t('GL_RECONCILIATION', 'Cross-report reconciliation passes (TB/IS/BS/CF/Equity)', 'REPORTS', 'AUTOMATIC', true),
    t('AR_CONTROL_RECONCILED', 'Receivables reconcile to the AR control account', 'RECEIVABLES', 'AUTOMATIC', true),
    t('AP_CONTROL_RECONCILED', 'Payables reconcile to the AP control account', 'PAYABLES', 'AUTOMATIC', true),
    t('OPEN_EXCEPTIONS_RESOLVED', 'No open blocking accounting exceptions for the period', 'EXCEPTIONS', 'AUTOMATIC', true),
    t('REPORTS_GENERATED', 'Income Statement, Balance Sheet, Cash Flow and Equity Statement generate and validate', 'REPORTS', 'AUTOMATIC', true),
    // ── Automated warnings (non-blocking) ──
    t('UNMAPPED_ACCOUNTS', 'No material unmapped account balances', 'CHART_OF_ACCOUNTS', 'AUTOMATIC', false),
    t('CASH_FLOW_RECONCILED', 'Cash Flow reconciles to GL cash movement', 'REPORTS', 'AUTOMATIC', false),
    t('EQUITY_RECONCILED', 'Equity statement reconciles to Balance Sheet equity', 'REPORTS', 'AUTOMATIC', false),
    // ── Manual review tasks ──
    t('BANK_RECONCILIATION_REVIEWED', 'Bank and mobile-money reconciliations complete or exceptions approved', 'BANKING', 'MANUAL', true),
    t('PAYROLL_REVIEWED', 'Payroll posted and payroll liabilities reviewed', 'PAYROLL', 'MANUAL', true),
    t('INVENTORY_REVIEWED', 'Inventory valuation updated and reconciled to control', 'INVENTORY', 'MANUAL', false),
    t('FIXED_ASSETS_REVIEWED', 'Depreciation posted where required; asset register reconciled', 'FIXED_ASSETS', 'MANUAL', false),
    t('LOANS_TAX_REVIEWED', 'Loan balances and tax obligations reviewed', 'LOANS_TAX', 'MANUAL', false),
    t('SUSPENSE_REVIEWED', 'Suspense and rounding accounts reviewed', 'GENERAL_LEDGER', 'MANUAL', false),
    t('UNUSUAL_TRANSACTIONS_REVIEWED', 'Unusual or high-risk transactions reviewed', 'GENERAL_LEDGER', 'MANUAL', false),
  ]),
});

/** Phase 10 — bank recon checklist item becomes AUTOMATIC when live feed is used. */
const STANDARD_MONTHLY_CLOSE_V1_1_0 = Object.freeze({
  templateId: 'STANDARD_MONTHLY_CLOSE',
  version: '1.1.0',
  name: 'Standard monthly period close (bank recon live feed)',
  tasks: Object.freeze(
    STANDARD_MONTHLY_CLOSE_V1.tasks.map((task) =>
      task.taskKey === 'BANK_RECONCILIATION_REVIEWED'
        ? t(
            'BANK_RECONCILIATION_REVIEWED',
            'Bank and mobile-money reconciliations complete or exceptions approved',
            'BANKING',
            'AUTOMATIC',
            true,
            {
              description:
                'Live feed from Phase 10 Bank Reconciliation — completed sessions cover period end (or waived exceptions)',
            }
          )
        : task
    )
  ),
});

const TEMPLATES = Object.freeze({
  'STANDARD_MONTHLY_CLOSE@1.0.0': STANDARD_MONTHLY_CLOSE_V1,
  'STANDARD_MONTHLY_CLOSE@1.1.0': STANDARD_MONTHLY_CLOSE_V1_1_0,
});

/**
 * Fetch an immutable published checklist template version.
 * @throws {RangeError} when the id/version has not been published
 */
export function getChecklistTemplate(templateId, version) {
  const template = TEMPLATES[`${templateId}@${version}`];
  if (!template) {
    throw new RangeError(`Close checklist template ${templateId}@${version} is not published.`);
  }
  return template;
}

/** All published templates (for documentation/UI). */
export function listChecklistTemplates() {
  return Object.values(TEMPLATES).map((tpl) => ({
    templateId: tpl.templateId,
    version: tpl.version,
    name: tpl.name,
    taskCount: tpl.tasks.length,
  }));
}

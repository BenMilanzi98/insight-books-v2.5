/**
 * Versioned STANDARD_YEAR_END_CLOSE checklist template.
 * Published versions are immutable; close runs pin templateId + version.
 */

export const YEAR_END_CHECKLIST_TEMPLATE = Object.freeze({
  templateId: 'STANDARD_YEAR_END_CLOSE',
  version: '1.0.0',
  name: 'Standard Year-End Close',
  tasks: [
    // GENERAL
    { taskKey: 'YE_JOURNALS_BALANCED', name: 'All posted journals balance', module: 'GL', category: 'GENERAL', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 10 },
    { taskKey: 'YE_NO_POSTING_STATE', name: 'No journals remain in POSTING state', module: 'GL', category: 'GENERAL', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 20 },
    { taskKey: 'YE_GL_AGREES', name: 'General Ledger agrees with journal lines', module: 'GL', category: 'GENERAL', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 30 },
    { taskKey: 'YE_TB_BALANCED', name: 'Trial Balance balances', module: 'REPORTING', category: 'GENERAL', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 40 },
    { taskKey: 'YE_SUSPENSE_REVIEW', name: 'Suspense accounts reviewed', module: 'GL', category: 'GENERAL', kind: 'MANUAL', blocking: true, required: true, displayOrder: 50 },
    { taskKey: 'YE_ROUNDING_REVIEW', name: 'Rounding accounts reviewed', module: 'GL', category: 'GENERAL', kind: 'MANUAL', blocking: false, required: true, displayOrder: 60 },
    { taskKey: 'YE_OBE_REVIEW', name: 'Opening Balance Equity reviewed', module: 'GL', category: 'GENERAL', kind: 'MANUAL', blocking: true, required: true, displayOrder: 70 },
    // BANK
    { taskKey: 'YE_BANK_RECONCILED', name: 'Required bank accounts reconciled', module: 'BANKING', category: 'BANKING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 100 },
    { taskKey: 'YE_BANK_OUTSTANDING', name: 'Outstanding payments / deposits in transit reviewed', module: 'BANKING', category: 'BANKING', kind: 'MANUAL', blocking: false, required: true, displayOrder: 110 },
    // AR / AP
    { taskKey: 'YE_AR_RECONCILE', name: 'Receivables aging reconciles to AR control', module: 'RECEIVABLES', category: 'RECEIVABLES', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 200 },
    { taskKey: 'YE_AP_RECONCILE', name: 'Payables aging reconciles to AP control', module: 'PAYABLES', category: 'PAYABLES', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 210 },
    { taskKey: 'YE_BAD_DEBT_REVIEW', name: 'Bad debts / credit-loss provisions reviewed', module: 'RECEIVABLES', category: 'RECEIVABLES', kind: 'MANUAL', blocking: false, required: true, displayOrder: 220 },
    // INVENTORY / PAYROLL / ASSETS / LOANS / TAX
    { taskKey: 'YE_INVENTORY_FINAL', name: 'Inventory valuation finalized and reconciles', module: 'INVENTORY', category: 'INVENTORY', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 300 },
    { taskKey: 'YE_PAYROLL_FINAL', name: 'Final payroll posted; liabilities reconcile', module: 'PAYROLL', category: 'PAYROLL', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 310 },
    { taskKey: 'YE_ASSETS_DEPR', name: 'Depreciation posted through year-end; register reconciles', module: 'FIXED_ASSETS', category: 'FIXED_ASSETS', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 320 },
    { taskKey: 'YE_LOANS_FINAL', name: 'Loan principal and interest finalize', module: 'LOANS', category: 'LOANS', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 330 },
    { taskKey: 'YE_TAX_FINAL', name: 'Tax accounts reconcile; provision reviewed', module: 'TAX', category: 'TAX', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 340 },
    // EQUITY
    { taskKey: 'YE_EQUITY_RECONCILE', name: 'Equity subledger reconciles to Balance Sheet', module: 'EQUITY', category: 'EQUITY', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 400 },
    { taskKey: 'YE_DRAWINGS_DIVIDENDS', name: 'Drawings and dividends treated correctly (not expenses)', module: 'EQUITY', category: 'EQUITY', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 410 },
    { taskKey: 'YE_RE_CYE', name: 'Retained Earnings / Current Year Earnings model verified', module: 'EQUITY', category: 'EQUITY', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 420 },
    // REPORTING / CLOSING
    { taskKey: 'YE_ATB', name: 'Adjusted Trial Balance generated and balances', module: 'REPORTING', category: 'REPORTING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 500 },
    { taskKey: 'YE_FS_VERIFIED', name: 'Final financial statements verified', module: 'REPORTING', category: 'REPORTING', kind: 'MANUAL', blocking: true, required: true, displayOrder: 510 },
    { taskKey: 'YE_CLOSE_METHOD', name: 'Closing method and temporary accounts configured', module: 'CLOSE', category: 'CLOSING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 600 },
    { taskKey: 'YE_CLOSING_PREVIEW', name: 'Closing Journal preview balances', module: 'CLOSE', category: 'CLOSING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 610 },
    { taskKey: 'YE_PCTB_PREVIEW', name: 'Post-Closing Trial Balance preview passes', module: 'CLOSE', category: 'CLOSING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 620 },
    { taskKey: 'YE_NEXT_YEAR', name: 'Next financial year ready', module: 'CALENDAR', category: 'CLOSING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 630 },
    { taskKey: 'YE_SNAPSHOTS', name: 'Annual snapshots ready', module: 'CLOSE', category: 'CLOSING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 640 },
    { taskKey: 'YE_PERIODS_FINAL', name: 'Non-final periods closed; final period open for YE journals', module: 'CALENDAR', category: 'CLOSING', kind: 'AUTOMATIC', blocking: true, required: true, displayOrder: 650 },
  ],
});

export function materializeChecklistTasks(tenantId, closeRunId) {
  return YEAR_END_CHECKLIST_TEMPLATE.tasks.map((t) => ({
    tenantId,
    closeRunId,
    taskKey: t.taskKey,
    name: t.name,
    module: t.module,
    category: t.category,
    kind: t.kind,
    blocking: t.blocking,
    required: t.required,
    status: 'NOT_STARTED',
    displayOrder: t.displayOrder,
  }));
}

import { AccountingValidationError } from '../../accountingV2/domain/errors.js';

export class ClosingConfigurationMissingError extends AccountingValidationError {
  constructor(message = 'Business closing configuration is missing or not approved.', ctx = {}) {
    super(message, [{ path: 'configuration', message: 'required' }], ctx);
    this.name = 'ClosingConfigurationMissingError';
    this.code = 'CLS_CONFIG_MISSING';
  }
}

export class InvalidClosingMethodError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'closeMethod', message: 'invalid' }], ctx);
    this.name = 'InvalidClosingMethodError';
    this.code = 'CLS_METHOD_INVALID';
  }
}

export class FinancialYearNotReadyError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'financialYearId', message: 'not ready' }], ctx);
    this.name = 'FinancialYearNotReadyError';
    this.code = 'CLS_FY_NOT_READY';
  }
}

export class CloseChecklistBlockedError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'checklist', message: 'blocked' }], ctx);
    this.name = 'CloseChecklistBlockedError';
    this.code = 'CLS_CHECKLIST_BLOCKED';
  }
}

export class ClosingJournalUnbalancedError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'batch', message: 'unbalanced' }], ctx);
    this.name = 'ClosingJournalUnbalancedError';
    this.code = 'CLS_001';
  }
}

export class ClosingJournalAlreadyPostedError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'batch', message: 'already posted' }], ctx);
    this.name = 'ClosingJournalAlreadyPostedError';
    this.code = 'CLS_002';
  }
}

export class ClosingPreviewChangedError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'checksum', message: 'stale' }], ctx);
    this.name = 'ClosingPreviewChangedError';
    this.code = 'CLS_024';
  }
}

export class PostClosingTrialBalanceUnbalancedError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'pctb', message: 'unbalanced' }], ctx);
    this.name = 'PostClosingTrialBalanceUnbalancedError';
    this.code = 'CLS_017';
  }
}

export class CurrentYearEarningsDuplicationError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'currentYearEarnings', message: 'duplication' }], ctx);
    this.name = 'CurrentYearEarningsDuplicationError';
    this.code = 'CLS_010';
  }
}

export class RetainedEarningsDuplicationError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'retainedEarnings', message: 'duplication' }], ctx);
    this.name = 'RetainedEarningsDuplicationError';
    this.code = 'CLS_011';
  }
}

export class CrossTenantClosingError extends AccountingValidationError {
  constructor(message = 'Cross-business closing data rejected.', ctx = {}) {
    super(message, [{ path: 'tenantId', message: 'mismatch' }], ctx);
    this.name = 'CrossTenantClosingError';
    this.code = 'CLS_036';
  }
}

export class YearReopenApprovalRequiredError extends AccountingValidationError {
  constructor(message, ctx = {}) {
    super(message, [{ path: 'reopen', message: 'approval required' }], ctx);
    this.name = 'YearReopenApprovalRequiredError';
    this.code = 'CLS_REOPEN_APPROVAL';
  }
}

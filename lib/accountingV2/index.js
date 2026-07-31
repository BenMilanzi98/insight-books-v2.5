/**
 * Accounting V2 — public kernel surface.
 *
 * Consumers import from this barrel (or the contracts module). Importing
 * `infrastructure/legacy/*` from outside the kernel is forbidden by the
 * architecture boundary tests.
 */

// Domain
export * from './domain/enums.js';
export * from './domain/errors.js';
export {
  money,
  addMoneyValues,
  subtractMoneyValues,
  sumMoneyValues,
  convertToBase,
  parseDecimalToMinor,
  minorToDecimalString,
  DEFAULT_CURRENCY,
} from './domain/money.js';
export {
  createAccountingContext,
  contextFromSessionUser,
  assertSameBusiness,
} from './domain/accountingContext.js';
export { createSourceReference, deriveIdempotencyKey, hashCommandContent } from './domain/sourceReference.js';
export { createJournalDraft, createJournalLineDraft } from './domain/journalDraft.js';
export { Dimension, getDimensionPolicy, validateDimensions } from './domain/dimensionPolicy.js';

// Application
export { postAccountingEvent } from './application/accountingPostingService.js';

// Contracts
export {
  CONTRACTS,
  assertImplements,
  accountingPostingService,
  accountMappingService,
  periodResolutionService,
  journalRepository,
  generalLedgerQueryService,
  trialBalanceQueryService,
  reversalService,
} from './contracts/serviceContracts.js';

// Infrastructure (transaction + flags are public; repositories are internal)
export { runInAccountingTransaction } from './infrastructure/transactionBoundary.js';
export {
  FLAG,
  PURCHASES_FLAGS,
  isFlagEnabled,
  setFlag,
  resolvePostingMode,
} from './infrastructure/featureFlags.js';
export { recordAccountingAudit, AUDIT_ACTIONS } from './infrastructure/auditTrail.js';

// Security
export {
  ACCOUNTING_PERMISSIONS,
  canManageAccountingArchitecture,
  hasAccountingPermission,
} from './permissions.js';

// Observability
export {
  getAccountingMetrics,
  logAccountingOperation,
  logAccountingError,
} from './observability/accountingLogger.js';

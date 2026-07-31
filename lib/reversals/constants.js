export const REVERSAL_STATUS = Object.freeze({
  REQUESTED: 'REQUESTED',
  APPROVED: 'APPROVED',
  EXECUTING: 'EXECUTING',
  COMPLETED: 'COMPLETED',
  REJECTED: 'REJECTED',
  FAILED: 'FAILED',
});

export const PERIOD_POLICY = Object.freeze({
  REVERSE_IN_CURRENT_OPEN_PERIOD: 'REVERSE_IN_CURRENT_OPEN_PERIOD',
});

export const SOURCE_TYPES = Object.freeze([
  'Invoice',
  'Expense',
  'Payment',
  'Sale',
  'SupplierPayment',
  'Transaction',
]);

/**
 * Shared filters for outstanding AR invoices (receivables dashboards, exports, aging).
 * Excludes soft-deleted drafts, reversals, voids, and fully paid invoices.
 */
export const OUTSTANDING_RECEIVABLE_INVOICE_FILTER = Object.freeze({
  isDeleted: false,
  isReversal: false,
  voidedAt: null,
  refundedAt: null,
  status: { in: ['Pending', 'Partial', 'pending', 'partial'] },
  remainingBalance: { gt: 0 },
});

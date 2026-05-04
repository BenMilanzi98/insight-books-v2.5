import { describe, it, expect } from 'vitest';
import {
  isCompletedReportStatus,
  isValidReportDocumentStatus,
  normalizeReportYmdParam,
  validInvoiceReportWhere,
  validSaleReportWhere,
} from '../lib/reportingSourceRules.js';

describe('reportingSourceRules', () => {
  it('excludes draft/cancelled/refunded/reversed documents from official reports', () => {
    for (const status of ['Draft', 'cancelled', 'VOIDED', 'Refunded', 'reversed']) {
      expect(isValidReportDocumentStatus(status)).toBe(false);
    }
    for (const status of ['Sent', 'Unpaid', 'Partially Paid', 'Paid', 'Completed', 'posted']) {
      expect(isValidReportDocumentStatus(status)).toBe(true);
    }
  });

  it('normalizes date-only report params without timezone shifting', () => {
    expect(normalizeReportYmdParam('2026-05-04')).toBe('2026-05-04');
    expect(normalizeReportYmdParam('2026-05-04T00:00:00.000Z')).toBe('2026-05-04');
  });

  it('builds invoice and sale filters that exclude voided/refunded/reversal records', () => {
    const start = new Date('2026-05-01T00:00:00.000Z');
    const end = new Date('2026-05-31T23:59:59.999Z');

    expect(validInvoiceReportWhere('tenant-1', 'issueDate', start, end)).toMatchObject({
      tenantId: 'tenant-1',
      voidedAt: null,
      refundedAt: null,
      isReversal: false,
      issueDate: { gte: start, lte: end },
    });

    expect(validSaleReportWhere('tenant-1', 'saleDate', start, end)).toMatchObject({
      tenantId: 'tenant-1',
      status: { equals: 'completed', mode: 'insensitive' },
      voidedAt: null,
      refundedAt: null,
      isReversal: false,
      saleDate: { gte: start, lte: end },
    });
    expect(isCompletedReportStatus('COMPLETED')).toBe(true);
  });
});

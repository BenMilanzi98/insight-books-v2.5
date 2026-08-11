import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('invoice partial-payment recognizes sales accounting', () => {
  const routePath = join(process.cwd(), 'app/api/invoices/partial-payment/route.js');
  const source = readFileSync(routePath, 'utf8');
  const ensureSalesIndex = source.indexOf('ensureInvoiceSalesAccounting');
  const paymentCreateIndex = Math.max(
    source.indexOf('tx.payment.create'),
    source.indexOf('payment.create')
  );
  const postPaymentIndex = source.indexOf('postCustomerPaymentAccounting');
  const ensureRecognitionIndex = source.indexOf('ensureInvoicePaymentRevenueRecognition');

  it('ensures invoice revenue + COGS before posting the payment', () => {
    expect(source).toContain('ensureInvoiceSalesAccounting');
    expect(source).toContain('force: true');
    expect(ensureSalesIndex).toBeGreaterThanOrEqual(0);
    expect(paymentCreateIndex).toBeGreaterThanOrEqual(0);
    expect(ensureSalesIndex).toBeLessThan(paymentCreateIndex);
  });

  it('recognizes invoice revenue after posting the customer payment', () => {
    expect(source).toContain('ensureInvoicePaymentRevenueRecognition');
    expect(source).toContain('ensureInvoiceSalesAccounting');
    expect(source).toContain('postCustomerPaymentAccounting');
    expect(postPaymentIndex).toBeGreaterThanOrEqual(0);
    expect(ensureRecognitionIndex).toBeGreaterThanOrEqual(0);
    expect(postPaymentIndex).toBeLessThan(ensureRecognitionIndex);
    expect(ensureRecognitionIndex).toBeGreaterThan(postPaymentIndex);
  });

  it('stores invoice branchId on the payment so branch-scoped dashboard revenue includes recognition', () => {
    expect(source).toContain('branchId: invoice.branchId');
  });
});

describe('payments route recognizes invoice revenue on cash application', () => {
  const routePath = join(process.cwd(), 'app/api/payments/route.js');
  const source = readFileSync(routePath, 'utf8');

  it('posts issue accounting, cash application, then payment revenue recognition for invoice payments', () => {
    expect(source).toContain('ensureInvoiceSalesAccounting');
    expect(source).toContain('postCustomerPaymentAccounting');
    expect(source).toContain('ensureInvoicePaymentRevenueRecognition');

    const blockStart = source.indexOf("if (type === 'invoice' && invoice)");
    expect(blockStart).toBeGreaterThanOrEqual(0);
    const block = source.slice(blockStart, blockStart + 900);
    const salesIdx = block.indexOf('ensureInvoiceSalesAccounting');
    const cashIdx = block.indexOf('postCustomerPaymentAccounting');
    const revIdx = block.indexOf('ensureInvoicePaymentRevenueRecognition');
    expect(salesIdx).toBeGreaterThanOrEqual(0);
    expect(cashIdx).toBeGreaterThan(salesIdx);
    expect(revIdx).toBeGreaterThan(cashIdx);
  });
});

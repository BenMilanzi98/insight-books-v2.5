import { describe, expect, it, vi, beforeEach } from 'vitest';

const postInvoiceAccounting = vi.fn();
const postCostOfSalesAccounting = vi.fn();
const calculateCOGS = vi.fn();

vi.mock('../lib/accountingV2/adapters/index.js', () => ({
  postInvoiceAccounting: (...args) => postInvoiceAccounting(...args),
  postCostOfSalesAccounting: (...args) => postCostOfSalesAccounting(...args),
}));

vi.mock('../lib/accountingV2/adapters', () => ({
  postInvoiceAccounting: (...args) => postInvoiceAccounting(...args),
  postCostOfSalesAccounting: (...args) => postCostOfSalesAccounting(...args),
}));

vi.mock('../lib/inventoryCosting.js', () => ({
  calculateCOGS: (...args) => calculateCOGS(...args),
}));

describe('ensureInvoiceSalesAccounting', () => {
  // Issue accounting only: postInvoiceAccounting → CUSTOMER_INVOICE (AR+Deferred+VAT).
  // Sales Revenue recognition on payment is out of scope here (Task 6).

  let db;

  beforeEach(() => {
    vi.clearAllMocks();
    postInvoiceAccounting.mockResolvedValue({ ok: true });
    postCostOfSalesAccounting.mockResolvedValue({ ok: true });
    calculateCOGS.mockResolvedValue({ unitCost: 100, cogsAmount: 100, remainingQuantity: 9 });

    db = {
      invoice: {
        findFirst: vi.fn(),
      },
      journalEntry: {
        findFirst: vi.fn(),
      },
      product: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      inventoryTransaction: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
  });

  it('posts Invoice issue journal (AR+Deferred+VAT) when missing, then Invoice-COGS for stocked products', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-1',
      issueDate: new Date('2026-08-10'),
      branchId: null,
      status: 'Partial',
      tenantId: 't1',
      items: [{ productId: 'p1', quantity: 1, description: 'X' }],
    });
    db.journalEntry.findFirst
      .mockResolvedValueOnce(null) // Invoice JE
      .mockResolvedValueOnce(null); // Invoice-COGS JE
    db.product.findUnique.mockResolvedValue({ id: 'p1', isService: false });
    db.inventoryTransaction.findFirst.mockResolvedValue(null);

    const { ensureInvoiceSalesAccounting } = await import(
      '../lib/ensureInvoiceSalesAccounting.js'
    );
    const result = await ensureInvoiceSalesAccounting({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
    });

    expect(postInvoiceAccounting).toHaveBeenCalledWith(
      expect.objectContaining({ invoiceId: 'inv-1', tenantId: 't1' })
    );
    // postInvoiceAccounting uses deferred template — no Sales Revenue on issue.
    expect(postCostOfSalesAccounting).toHaveBeenCalledWith(
      expect.objectContaining({
        documentKind: 'Invoice',
        documentId: 'inv-1',
        cogsAmount: 100,
      })
    );
    expect(result.postedInvoice).toBe(true);
    expect(result.postedCogs).toBe(true);
  });

  it('posts missing Invoice-COGS even when Invoice issue journal already exists', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-1',
      issueDate: new Date('2026-08-10'),
      branchId: null,
      status: 'Paid',
      tenantId: 't1',
      items: [{ productId: 'p1', quantity: 1, description: 'X' }],
    });
    db.journalEntry.findFirst
      .mockResolvedValueOnce({ id: 'je-inv' })
      .mockResolvedValueOnce(null);
    db.product.findUnique.mockResolvedValue({ id: 'p1', isService: false });
    db.inventoryTransaction.findFirst.mockResolvedValue(null);

    const { ensureInvoiceSalesAccounting } = await import(
      '../lib/ensureInvoiceSalesAccounting.js'
    );
    const result = await ensureInvoiceSalesAccounting({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
    });

    expect(postInvoiceAccounting).not.toHaveBeenCalled();
    expect(postCostOfSalesAccounting).toHaveBeenCalled();
    expect(result.postedInvoice).toBe(false);
    expect(result.postedCogs).toBe(true);
  });

  it('skips Draft invoices until they leave draft (unless force)', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-1',
      issueDate: new Date('2026-08-10'),
      branchId: null,
      status: 'Draft',
      tenantId: 't1',
      items: [{ productId: 'p1', quantity: 1 }],
    });

    const { ensureInvoiceSalesAccounting } = await import(
      '../lib/ensureInvoiceSalesAccounting.js'
    );
    const result = await ensureInvoiceSalesAccounting({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
    });

    expect(postInvoiceAccounting).not.toHaveBeenCalled();
    expect(result.skipped).toBe('draft');
  });

  it('posts Draft invoices when force is true (first payment path posts issue+COGS)', async () => {
    db.invoice.findFirst.mockResolvedValue({
      id: 'inv-1',
      invoiceNumber: 'INV-1',
      issueDate: new Date('2026-08-10'),
      branchId: null,
      status: 'Draft',
      tenantId: 't1',
      items: [{ productId: 'p1', quantity: 1 }],
    });
    db.journalEntry.findFirst.mockResolvedValue(null);
    db.product.findUnique.mockResolvedValue({ id: 'p1', isService: false });
    db.inventoryTransaction.findFirst.mockResolvedValue(null);

    const { ensureInvoiceSalesAccounting } = await import(
      '../lib/ensureInvoiceSalesAccounting.js'
    );
    await ensureInvoiceSalesAccounting({
      db,
      tenantId: 't1',
      userId: 'u1',
      invoiceId: 'inv-1',
      force: true,
    });

    expect(postInvoiceAccounting).toHaveBeenCalled();
  });
});

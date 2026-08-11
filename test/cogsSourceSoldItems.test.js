import { describe, it, expect, vi } from 'vitest';
import {
  resolveCogsLinkedSaleId,
  isCogsDocumentSourceType,
} from '../lib/cogsExpenseRegisterLink.js';

describe('cogs source sold items helpers', () => {
  it('resolves invoice and sale document ids from COGS source keys', () => {
    expect(resolveCogsLinkedSaleId('Invoice-COGS', 'inv-1')).toBe('inv-1');
    expect(resolveCogsLinkedSaleId('Sale-COGS', 'sale-1-revenue')).toBe('sale-1');
    expect(isCogsDocumentSourceType('Invoice-COGS')).toBe(true);
    expect(isCogsDocumentSourceType('Sale-COGS')).toBe(true);
  });

  it('prefers stocked lines and maps invoice/sale item shapes', async () => {
    const { loadCogsSourceSoldItems } = await import('../lib/cogsSourceSoldItems.js');

    const db = {
      invoice: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'inv-1',
          invoiceNumber: 'INV-1',
          status: 'Paid',
          issueDate: new Date('2026-08-10'),
          total: 1150,
          client: { id: 'c1', name: 'Acme' },
          items: [
            {
              id: 'ii1',
              description: 'Widget',
              quantity: 2,
              unitPrice: 500,
              amount: 1000,
              netAmount: 1000,
              productId: 'p1',
              product: {
                id: 'p1',
                name: 'Widget',
                sku: 'W-1',
                isService: false,
                cost: 100,
                averageCost: 100,
              },
            },
            {
              id: 'ii2',
              description: 'Consulting',
              quantity: 1,
              unitPrice: 150,
              amount: 150,
              netAmount: 150,
              productId: 'p2',
              product: {
                id: 'p2',
                name: 'Consulting',
                sku: null,
                isService: true,
                cost: 0,
                averageCost: 0,
              },
            },
          ],
        }),
      },
      sale: { findFirst: vi.fn() },
    };

    const result = await loadCogsSourceSoldItems(db, {
      tenantId: 't1',
      sourceType: 'Invoice-COGS',
      sourceId: 'inv-1',
    });

    expect(result.found).toBe(true);
    expect(result.documentNumber).toBe('INV-1');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].description).toBe('Widget');
    expect(result.items[0].cogsAmount).toBe(200);
    expect(db.sale.findFirst).not.toHaveBeenCalled();
  });

  it('enriches COGS register rows with human-readable labels', async () => {
    const { enrichCogsRegisterRowLabels } = await import('../lib/cogsSourceSoldItems.js');

    const db = {
      invoice: {
        findMany: vi.fn().mockResolvedValue([{ id: 'inv-1', invoiceNumber: 'INV-100' }]),
      },
      sale: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const rows = await enrichCogsRegisterRowLabels(db, 't1', [
      {
        id: 'cogs-v2-je-line',
        isCOGS: true,
        sourceType: 'Invoice-COGS',
        sourceId: 'inv-1',
        linkedSaleId: 'inv-1',
        amount: 200,
        description: 'cogs-v2-je-line',
      },
    ]);

    expect(rows[0].documentNumber).toBe('INV-100');
    expect(rows[0].displayTitle).toBe('COGS — Invoice INV-100');
    expect(rows[0].description).toBe('COGS — Invoice INV-100');
    expect(rows[0].attachments).toHaveLength(1);
    expect(rows[0].attachments[0]).toMatchObject({
      virtual: true,
      documentType: 'invoice',
      url: '/api/invoices/inv-1/download/pdf',
      name: 'Invoice INV-100.pdf',
    });
  });

  it('builds virtual POS receipt attachments for Sale-COGS', async () => {
    const { buildCogsVirtualReceiptAttachment } = await import('../lib/cogsSourceSoldItems.js');
    expect(buildCogsVirtualReceiptAttachment('sale', 'sale-9', 'S-9')).toMatchObject({
      virtual: true,
      url: '/api/sales/sale-9/receipt?format=pdf',
      name: 'Sale receipt S-9.pdf',
    });
    expect(buildCogsVirtualReceiptAttachment('invoice', null, 'X')).toBeNull();
  });
});

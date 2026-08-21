import { describe, expect, it } from 'vitest';
import { generateInvoicePdfBuffer, generateQuotationPdfBuffer } from '../lib/server-pdf-jspdf.js';
import { DOCUMENT_LAYOUTS } from '../lib/documentTemplates/registry.js';
import { generateInvoiceHtml } from '../lib/server-pdf-html.js';

const sampleInvoice = {
  invoiceNumber: 'INV-TEST-1',
  title: 'Parity Test',
  status: 'Pending',
  issueDate: new Date('2026-01-15'),
  dueDate: new Date('2026-02-15'),
  subtotal: 100,
  taxAmount: 16.5,
  total: 116.5,
  client: { name: 'Acme Ltd', email: 'a@example.com', phone: '123' },
  items: [
    { description: 'Widget', quantity: 2, unitPrice: 50, taxRate: 16.5, amount: 116.5 },
  ],
  payments: [],
};

const branding = { companyName: 'InsightBooks', primaryColor: '#0ea5e9', tpin: '123456' };

describe('document PDF layout parity', () => {
  it('generates a non-empty jsPDF buffer for every layout', () => {
    for (const layout of DOCUMENT_LAYOUTS) {
      const buf = generateInvoicePdfBuffer(
        sampleInvoice,
        {
          content: JSON.stringify({
            layoutId: layout.id,
            logoPosition: 'center',
            primaryColor: layout.previewAccent,
          }),
        },
        branding
      );
      expect(Buffer.isBuffer(buf) || buf instanceof Uint8Array).toBe(true);
      expect(buf.length).toBeGreaterThan(500);
    }
  });

  it('generates quotation jsPDF for soft-card and ledger', () => {
    for (const layoutId of ['soft-card', 'ledger']) {
      const buf = generateQuotationPdfBuffer(
        {
          quotationNumber: 'QUO-1',
          title: 'Quote',
          issueDate: '15-01-2026',
          validUntil: '15-02-2026',
          status: 'Draft',
          subtotal: 100,
          taxAmount: 0,
          total: 100,
          client: { name: 'Client' },
          items: [{ description: 'Svc', quantity: 1, unitPrice: 100, amount: 100 }],
        },
        { content: { layoutId, primaryColor: '#111111', logoPosition: 'left' } },
        branding
      );
      expect(buf.length).toBeGreaterThan(500);
    }
  });

  it('HTML invoice includes layout-specific chrome for band-header', () => {
    const html = generateInvoiceHtml(
      sampleInvoice,
      { content: { layoutId: 'band-header', primaryColor: '#0e7490' } },
      branding
    );
    expect(html).toMatch(/#1e293b|#0e7490/);
    expect(html).toMatch(/ib-doc-keep/);
  });
});

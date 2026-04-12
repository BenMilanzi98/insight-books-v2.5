import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'invoice';
  const strategy = searchParams.get('strategy') || 'jspdf';
  const results = { type, requestedStrategy: strategy, steps: [] };

  const mockInvoice = {
    invoiceNumber: 'INV-TEST001',
    issueDate: new Date('2026-04-01'),
    dueDate: new Date('2026-04-30'),
    status: 'sent',
    subtotal: 500, taxAmount: 80, total: 580, currency: 'MWK',
    client: { name: 'Test Client', email: 'test@example.com', phone: '+265888000000', address: '123 Test St' },
    items: [
      { description: 'Product A', quantity: 2, unitPrice: 150, taxRate: 16, product: { name: 'Product A' } },
      { description: 'Service B', quantity: 1, unitPrice: 200, taxRate: 16, product: { name: 'Service B' } },
    ],
    payments: [{ amount: 100, paymentDate: new Date(), paymentMethod: 'cash', status: 'completed' }],
    createdBy: { name: 'Admin' },
  };

  const mockTemplate = {
    content: JSON.stringify({ style: 'standard', showLogo: true, showFooter: true, primaryColor: '#3366CC' }),
  };

  const mockBranding = {
    companyName: 'Test Company', primaryColor: '#3366CC',
    email: 'info@test.com', phone: '+265111222333',
    address: 'Lilongwe, Malawi', tpin: '12345',
    defaultBankDetails: 'Bank: Test Bank, Acct: 000111222',
  };

  const mockSale = {
    saleNumber: 'SALE-TEST001',
    saleDate: new Date(), total: 580, subtotal: 500,
    totalTaxAmount: 80, totalDiscountAmount: 0,
    posAmountTendered: 600, posChangeGiven: 20,
    paymentMethod: 'cash',
    tenant: { name: 'Test Company' },
    client: { name: 'Walk-in Customer' },
    createdBy: { name: 'Cashier' },
    items: [
      { description: 'Product A', quantity: 2, unitPrice: 150, taxRate: 16 },
      { description: 'Service B', quantity: 1, unitPrice: 200, taxRate: 16 },
    ],
  };

  // Test 1: jsPDF import
  let jsPDFOk = false;
  try {
    const { jsPDF } = await import('jspdf');
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default || autoTableModule;
    const doc = new jsPDF();
    autoTable(doc, { body: [['test']] });
    jsPDFOk = !!doc.lastAutoTable;
    results.steps.push({ step: 'jsPDF+autoTable import', ok: jsPDFOk, lastAutoTable: !!doc.lastAutoTable });
  } catch (e) {
    results.steps.push({ step: 'jsPDF+autoTable import', ok: false, error: e.message });
  }

  // Test 2: generateInvoicePdfBuffer or generateSaleReceiptPdfBuffer
  let buffer = null;
  if (strategy === 'jspdf') {
    try {
      if (type === 'receipt') {
        const { generateSaleReceiptPdfBuffer } = await import('@/lib/server-pdf-jspdf');
        buffer = generateSaleReceiptPdfBuffer(mockSale, {}, {});
        results.steps.push({ step: 'generateSaleReceiptPdfBuffer', ok: true, bytes: buffer.length });
      } else if (type === 'quotation') {
        const { generateQuotationPdfBuffer } = await import('@/lib/server-pdf-jspdf');
        const mockQuot = { ...mockInvoice, quotationNumber: 'QT-TEST001', title: 'Test Quotation', validUntil: new Date('2026-05-30') };
        buffer = generateQuotationPdfBuffer(mockQuot, mockTemplate, mockBranding);
        results.steps.push({ step: 'generateQuotationPdfBuffer', ok: true, bytes: buffer.length });
      } else {
        const { generateInvoicePdfBuffer } = await import('@/lib/server-pdf-jspdf');
        buffer = generateInvoicePdfBuffer(mockInvoice, mockTemplate, mockBranding);
        results.steps.push({ step: 'generateInvoicePdfBuffer', ok: true, bytes: buffer.length });
      }
    } catch (e) {
      results.steps.push({ step: `generate${type}PdfBuffer`, ok: false, error: e.message, stack: e.stack?.split('\n').slice(0, 5) });
    }
  }

  // Test 3: Puppeteer (optional)
  if (strategy === 'puppeteer' || strategy === 'all') {
    try {
      const { launchPuppeteer } = await import('@/lib/puppeteer-launch');
      const browser = await launchPuppeteer();
      const page = await browser.newPage();
      await page.setContent('<h1>Test PDF</h1><p>This is a Puppeteer test.</p>', { waitUntil: 'load' });
      buffer = await page.pdf({ format: 'A4' });
      await browser.close();
      results.steps.push({ step: 'puppeteer', ok: true, bytes: buffer.length });
    } catch (e) {
      results.steps.push({ step: 'puppeteer', ok: false, error: e.message });
    }
  }

  // If buffer was generated and ?download=1, return it as a PDF
  if (buffer && searchParams.get('download') === '1') {
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="test-${type}.pdf"`,
        'X-PDF-Strategy': strategy,
      },
    });
  }

  results.allPassed = results.steps.every(s => s.ok);
  return NextResponse.json(results, { status: results.allPassed ? 200 : 500 });
}

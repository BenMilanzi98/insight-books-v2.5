import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generatePdf } from '@/lib/server-pdf';
import { textToMinimalPdf } from '@/lib/fallback-text-pdf';
import { addMoney, parseMoney, subtractMoney } from '@/lib/money';
import { shouldDisplayDocumentTax } from '@/lib/documentTaxDisplay';
import { resolveDocumentTemplate } from '@/lib/documentTemplates/resolveDocumentTemplate';

function findPreRenderedPdf(invoiceId, invoiceNumber) {
  try {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) return null;
    const candidates = [
      invoiceNumber && `invoice-${invoiceNumber}.pdf`,
      `invoice-${invoiceId}.pdf`,
    ].filter(Boolean);
    for (const name of candidates) {
      const fp = path.join(tmpDir, name);
      if (fs.existsSync(fp)) {
        const buf = fs.readFileSync(fp);
        if (buf.length > 0) {
          console.log(`[InvoicePDF] Serving pre-rendered: ${name} (${buf.length} bytes)`);
          return buf;
        }
      }
    }
  } catch (e) {
    console.warn('[InvoicePDF] Pre-rendered check error:', e?.message);
  }
  return null;
}

export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id: invoiceId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId, tenantId: user.tenantId },
      include: {
        client: true,
        items: { include: { product: true } },
        payments: {
          select: {
            id: true, amount: true, paymentDate: true,
            paymentMethod: true, reference: true, notes: true,
            status: true, isReversal: true,
          },
          orderBy: { paymentDate: 'desc' },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const safeName = (invoice.invoiceNumber || invoiceId).toString().replace(/[^\w.-]+/g, '_');

    // --- Strategy 0: Pre-rendered PDF from tmp/ (best quality, if available) ---
    const preRendered = findPreRenderedPdf(invoiceId, invoice.invoiceNumber);
    if (preRendered) {
      return new NextResponse(preRendered, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="invoice-${safeName}.pdf"`,
        },
      });
    }

    // Build data objects for server-side generation
    const resolved = await resolveDocumentTemplate(prisma, {
      tenantId: user.tenantId,
      templateId: templateId || invoice.templateId,
    });
    let template = resolved.template;
    if (!template) {
      template = {
        id: 'default',
        name: 'Default Template',
        content: JSON.stringify(resolved.appearance),
      };
    } else {
      // Ensure content carries normalized layoutId for PDF/HTML renderers
      template = {
        ...template,
        content: JSON.stringify({
          ...resolved.appearance,
        }),
      };
    }
    if (template && typeof template.content === 'object') {
      template.content = JSON.stringify(template.content);
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: { settings: true },
    });

    const branding = {
      companyName: tenant?.name || 'Your Company',
      logoUrl: tenant?.logoUrl || null,
      primaryColor: tenant?.primaryColor || '#4f46e5',
      emailFooter: tenant?.settings?.emailFooter || 'Thank you for your business!',
      address: tenant?.settings?.address || '',
      city: tenant?.settings?.city || '',
      phone: tenant?.settings?.phone || '',
      email: tenant?.settings?.email || '',
      businessPhone: tenant?.settings?.businessPhone || '',
      defaultBankDetails: tenant?.settings?.defaultBankDetails || '',
      tpin: tenant?.tpin || '',
    };

    const eligiblePayments = (invoice.payments || []).filter(
      (p) => p && !p.isReversal && (p.status == null || String(p.status) === 'Completed')
    );
    const totalPaidPdf = eligiblePayments.reduce(
      (sum, p) => addMoney(sum, p.amount),
      0
    );
    const invTotalPdf = parseMoney(invoice.total);
    const outstandingPdf = Math.max(0, subtractMoney(invTotalPdf, totalPaidPdf));
    const inv = {
      ...invoice,
      subtotal: parseMoney(invoice.subtotal),
      taxAmount: parseMoney(invoice.taxAmount),
      total: invTotalPdf,
      items: invoice.items.map((item) => ({
        ...item,
        quantity: parseMoney(item.quantity),
        unitPrice: parseMoney(item.unitPrice),
        taxRate: parseMoney(item.taxRate),
        discountAmount: parseMoney(item.discountAmount),
        description: item.description || (item.product ? item.product.name : ''),
      })),
      payments: eligiblePayments,
      paymentInfo: {
        totalPaid: totalPaidPdf,
        outstandingAmount: outstandingPdf,
        isFullyPaid: totalPaidPdf >= invTotalPdf - 0.005,
        isPartiallyPaid: totalPaidPdf > 0 && totalPaidPdf < invTotalPdf - 0.005,
        paymentCount: eligiblePayments.length,
      },
    };

    let buffer;
    let strategy = 'none';

    // --- Strategy 1 (primary): jsPDF programmatic generation ---
    // Works on all platforms (Vercel, VPS, local) with no system dependencies.
    try {
      buffer = await generatePdf(inv, template, branding);
      strategy = 'jspdf';
      console.log(`[InvoicePDF] Generated via jsPDF (${buffer.length} bytes)`);
    } catch (jspdfErr) {
      console.error('[InvoicePDF] jsPDF failed:', jspdfErr?.message);
      console.error('[InvoicePDF] jsPDF stack:', jspdfErr?.stack);

      // --- Strategy 2 (fallback): Puppeteer HTML rendering ---
      // Requires Chromium on the system; works on VPS/local, may not work on serverless.
      try {
        const { generateInvoiceHtml } = await import('@/lib/server-pdf-html');
        const { launchPuppeteer, PDF_SET_CONTENT_OPTIONS } = await import('@/lib/puppeteer-launch');
        const html = generateInvoiceHtml(inv, template, branding);
        const browser = await launchPuppeteer();
        const page = await browser.newPage();
        await page.setContent(html, PDF_SET_CONTENT_OPTIONS);
        await page.evaluate(() => {
          const imgs = Array.from(document.images);
          return Promise.all(imgs.filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; })));
        });
        buffer = await page.pdf({
          format: 'A4', printBackground: true,
          margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
        });
        await browser.close();
        strategy = 'puppeteer';
        console.log(`[InvoicePDF] Generated via Puppeteer (${buffer.length} bytes)`);
      } catch (puppeteerErr) {
        console.error('[InvoicePDF] Puppeteer also failed:', puppeteerErr?.message);

        // --- Strategy 3 (last resort): Plain text PDF ---
        const lines = [];
        lines.push(branding?.companyName || 'Invoice');
        lines.push(`Invoice #${invoice.invoiceNumber || invoiceId}`);
        lines.push(`Client: ${invoice.client?.name || 'N/A'}`);
        lines.push(`Issue: ${invoice.issueDate ? new Date(invoice.issueDate).toLocaleDateString() : ''}`);
        lines.push(`Due: ${invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : ''}`);
        lines.push('');
        lines.push('Items:');
        for (const item of inv.items || []) {
          lines.push(`- ${item.description || ''}  (${item.quantity} x ${item.unitPrice})`);
        }
        lines.push('');
        lines.push(`Subtotal: ${inv.subtotal}`);
        if (shouldDisplayDocumentTax({
          taxAmount: inv.taxAmount,
          taxLines: (inv.items || []).flatMap((item) => item.itemTaxes || []),
        })) {
          lines.push(`Tax: ${inv.taxAmount}`);
        }
        lines.push(`TOTAL: ${inv.total}`);
        lines.push('');
        lines.push(`[Fallback PDF — jsPDF error: ${jspdfErr?.message}]`);
        buffer = textToMinimalPdf(lines.join('\n'));
        strategy = 'text-fallback';
        console.error(`[InvoicePDF] Using text fallback. jsPDF: ${jspdfErr?.message}. Puppeteer: ${puppeteerErr?.message}`);
      }
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${safeName}.pdf"`,
        'X-PDF-Strategy': strategy,
      },
    });
  } catch (error) {
    console.error('[InvoicePDF] Fatal error:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF. Please try again.' },
      { status: 500 }
    );
  }
}

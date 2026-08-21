import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateQuotationPdf } from '@/lib/server-pdf';
import { textToMinimalPdf } from '@/lib/fallback-text-pdf';
import { shouldDisplayDocumentTax } from '@/lib/documentTaxDisplay';
import { resolveDocumentTemplate } from '@/lib/documentTemplates/resolveDocumentTemplate';

function findPreRenderedPdf(quotationId, quotationNumber) {
  try {
    const tmpDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tmpDir)) return null;
    const candidates = [
      `quotation-${quotationId}.pdf`,
      quotationNumber && `quotation-${quotationNumber}.pdf`,
    ].filter(Boolean);
    for (const name of candidates) {
      const fp = path.join(tmpDir, name);
      if (fs.existsSync(fp)) {
        const buf = fs.readFileSync(fp);
        if (buf.length > 0) {
          console.log(`[QuotationPDF] Serving pre-rendered: ${name} (${buf.length} bytes)`);
          return buf;
        }
      }
    }
  } catch (e) {
    console.warn('[QuotationPDF] Pre-rendered check error:', e?.message);
  }
  return null;
}

export async function GET(request, { params }) {
  try {
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const paramsData = await params;
    const quotationId = paramsData.id;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');

    const quotation = await prisma.quotation.findFirst({
      where: { id: quotationId, tenantId: user.tenantId },
      include: {
        items: { include: { product: true } },
        client: true,
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    const safeName = (quotation.quotationNumber || quotationId).toString().replace(/[^\w.-]+/g, '_');

    // --- Strategy 0: Pre-rendered PDF from tmp/ ---
    const preRendered = findPreRenderedPdf(quotationId, quotation.quotationNumber);
    if (preRendered) {
      return new NextResponse(preRendered, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="quotation-${safeName}.pdf"`,
        },
      });
    }

    // Build data objects
    const resolved = await resolveDocumentTemplate(prisma, {
      tenantId: user.tenantId,
      templateId: templateId || quotation.templateId,
    });
    let template = resolved.template;
    if (!template) {
      template = {
        id: 'default',
        name: 'Default Template',
        content: JSON.stringify(resolved.appearance),
      };
    } else {
      template = {
        ...template,
        content: JSON.stringify(resolved.appearance),
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
    };

    const preparedQuotation = {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber || '',
      title: quotation.title || 'Quotation',
      orderNumber: quotation.orderNumber ?? null,
      issueDate: quotation.issueDate
        ? quotation.issueDate.toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0],
      validUntil: quotation.validUntil
        ? quotation.validUntil.toISOString().split('T')[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: quotation.status || 'Draft',
      notes: quotation.notes || '',
      client: {
        id: quotation.client?.id || '',
        name: quotation.client?.name || 'Client',
        email: quotation.client?.email || '',
        phone: quotation.client?.phone || '',
        address: quotation.client?.address || '',
        contactPerson: quotation.client?.contactPerson || '',
      },
      items: quotation.items.map((item) => ({
        id: item.id,
        description: item.description || (item.product ? item.product.name : ''),
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        taxRate: parseFloat(item.taxRate) || 0,
      })),
      subtotal: parseFloat(quotation.subtotal) || 0,
      taxAmount: parseFloat(quotation.taxAmount) || 0,
      total: parseFloat(quotation.total) || 0,
    };

    let buffer;
    let strategy = 'none';

    // --- Strategy 1 (primary): jsPDF programmatic generation ---
    try {
      buffer = await generateQuotationPdf(preparedQuotation, template, branding);
      strategy = 'jspdf';
      console.log(`[QuotationPDF] Generated via jsPDF (${buffer.length} bytes)`);
    } catch (jspdfErr) {
      console.error('[QuotationPDF] jsPDF failed:', jspdfErr?.message);
      console.error('[QuotationPDF] jsPDF stack:', jspdfErr?.stack);

      // --- Strategy 2 (fallback): Puppeteer HTML rendering ---
      try {
        const { generateQuotationHtml } = await import('@/lib/server-pdf-html');
        const { launchPuppeteer, PDF_SET_CONTENT_OPTIONS } = await import('@/lib/puppeteer-launch');
        const html = generateQuotationHtml(preparedQuotation, template, branding);
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
        console.log(`[QuotationPDF] Generated via Puppeteer (${buffer.length} bytes)`);
      } catch (puppeteerErr) {
        console.error('[QuotationPDF] Puppeteer also failed:', puppeteerErr?.message);

        // --- Strategy 3 (last resort): Plain text PDF ---
        const lines = [];
        lines.push(branding?.companyName || 'Quotation');
        lines.push(`Quotation #${preparedQuotation.quotationNumber || quotationId}`);
        lines.push(`Client: ${preparedQuotation.client?.name || 'N/A'}`);
        lines.push(`Issue: ${preparedQuotation.issueDate || ''}`);
        lines.push(`Valid until: ${preparedQuotation.validUntil || ''}`);
        lines.push('');
        lines.push('Items:');
        for (const item of preparedQuotation.items || []) {
          lines.push(`- ${item.description || ''}  (${item.quantity} x ${item.unitPrice})`);
        }
        lines.push('');
        lines.push(`Subtotal: ${preparedQuotation.subtotal}`);
        if (shouldDisplayDocumentTax({
          taxAmount: preparedQuotation.taxAmount,
          taxLines: (preparedQuotation.items || []).flatMap((item) => item.itemTaxes || []),
        })) {
          lines.push(`Tax: ${preparedQuotation.taxAmount}`);
        }
        lines.push(`TOTAL: ${preparedQuotation.total}`);
        lines.push('');
        lines.push(`[Fallback PDF — jsPDF error: ${jspdfErr?.message}]`);
        buffer = textToMinimalPdf(lines.join('\n'));
        strategy = 'text-fallback';
        console.error(`[QuotationPDF] Using text fallback. jsPDF: ${jspdfErr?.message}. Puppeteer: ${puppeteerErr?.message}`);
      }
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quotation-${safeName}.pdf"`,
        'X-PDF-Strategy': strategy,
      },
    });
  } catch (error) {
    console.error('[QuotationPDF] Fatal error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quotation PDF. Please try again.' },
      { status: 500 }
    );
  }
}

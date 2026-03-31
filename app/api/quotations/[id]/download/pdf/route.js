import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generateQuotationPdf } from '@/lib/server-pdf';
import { textToMinimalPdf } from '@/lib/fallback-text-pdf';

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
      where: {
        id: quotationId,
        tenantId: user.tenantId,
      },
      include: {
        items: { include: { product: true } },
        client: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!quotation) {
      return NextResponse.json({ error: 'Quotation not found' }, { status: 404 });
    }

    let template = null;
    if (templateId) {
      template = await prisma.invoiceTemplate.findUnique({
        where: { id: templateId },
      });
    }
    if (!template) {
      template = await prisma.invoiceTemplate.findFirst({
        where: {
          OR: [{ tenantId: user.tenantId, isDefault: true }, { tenantId: user.tenantId }],
        },
        orderBy: { isDefault: 'desc' },
      });
    }
    if (!template) {
      template = {
        id: 'default',
        name: 'Default Template',
        content: JSON.stringify({
          style: 'standard',
          showLogo: true,
          showFooter: true,
          primaryColor: '#4f46e5',
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
    try {
      buffer = await generateQuotationPdf(preparedQuotation, template, branding);
    } catch (pdfErr) {
      const pdfMsg = pdfErr?.message || String(pdfErr);
      console.error('Quotation PDF (puppeteer) failed, falling back to text PDF:', pdfMsg);
      if (pdfErr?.stack) console.error(pdfErr.stack);

      const lines = [];
      lines.push(`${branding?.companyName || 'Quotation'}`);
      lines.push(`Quotation #${preparedQuotation.quotationNumber || quotationId}`);
      lines.push(`Client: ${preparedQuotation.client?.name || 'N/A'}`);
      lines.push(`Issue: ${preparedQuotation.issueDate || ''}`);
      lines.push(`Valid until: ${preparedQuotation.validUntil || ''}`);
      lines.push('');
      lines.push('Items:');
      for (const item of preparedQuotation.items || []) {
        const qty = Number(item.quantity || 0);
        const unit = Number(item.unitPrice || 0);
        const desc = (item.description || '').toString();
        lines.push(`- ${desc}  (${qty} x ${unit})`);
      }
      lines.push('');
      lines.push(`Subtotal: ${preparedQuotation.subtotal}`);
      lines.push(`Tax: ${preparedQuotation.taxAmount}`);
      lines.push(`TOTAL: ${preparedQuotation.total}`);
      lines.push('');
      lines.push('This PDF is a fallback (reduced formatting).');
      lines.push(`PDF error: ${pdfMsg}`);
      buffer = textToMinimalPdf(lines.join('\n'));
    }
    const safeName = (quotation.quotationNumber || quotationId).toString().replace(/[^\w.-]+/g, '_');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="quotation-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Quotation PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to generate quotation PDF. Please try again.' },
      { status: 500 }
    );
  }
}

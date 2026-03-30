import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { generatePdf } from '@/lib/server-pdf';

/**
 * GET binary PDF for invoice (mobile app / download).
 */
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
      where: {
        id: invoiceId,
        tenantId: user.tenantId,
      },
      include: {
        client: true,
        items: {
          include: {
            product: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            paymentMethod: true,
            reference: true,
            notes: true,
            status: true,
            isReversal: true,
          },
          orderBy: { paymentDate: 'desc' },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
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
      tpin: tenant?.tpin || '',
    };

    const inv = {
      ...invoice,
      subtotal: parseFloat(invoice.subtotal) || 0,
      taxAmount: parseFloat(invoice.taxAmount) || 0,
      total: parseFloat(invoice.total) || 0,
      items: invoice.items.map((item) => ({
        ...item,
        quantity: parseFloat(item.quantity) || 0,
        unitPrice: parseFloat(item.unitPrice) || 0,
        taxRate: parseFloat(item.taxRate) || 0,
        description: item.description || (item.product ? item.product.name : ''),
      })),
    };

    const buffer = await generatePdf(inv, template, branding);
    const safeName = (invoice.invoiceNumber || invoiceId).toString().replace(/[^\w.-]+/g, '_');

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Invoice PDF error:', error);
    return NextResponse.json(
      { error: 'Failed to generate invoice PDF. Please try again.' },
      { status: 500 }
    );
  }
}

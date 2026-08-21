import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { addMoney, multiplyMoney, parseMoney, subtractMoney } from '@/lib/money';
import { resolveDocumentTemplate } from '@/lib/documentTemplates/resolveDocumentTemplate';

/**
 * GET handler for downloading invoice data for client-side PDF generation
 */
export async function GET(request, { params }) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Await params for Next.js 15 compatibility
    const { id: invoiceId } = await params;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    
    // Fetch the invoice with all related data
    const invoice = await prisma.invoice.findUnique({
      where: {
        id: invoiceId,
        tenantId: user.tenantId // Ensure tenant security
      },
      include: {
        client: true,
        items: {
          include: {
            product: true
          }
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
            isReversal: true
          },
          orderBy: {
            paymentDate: 'desc'
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    // Fetch the template (query param → document templateId → tenant default)
    const resolved = await resolveDocumentTemplate(prisma, {
      tenantId: user.tenantId,
      templateId: templateId || invoice.templateId,
    });
    let template = resolved.template;
    
    // Fallback to system default template if still not found
    if (!template) {
      template = {
        id: 'default',
        name: 'Default Template',
        content: JSON.stringify(resolved.appearance),
      };
    } else {
      template = { ...template, content: JSON.stringify(resolved.appearance) };
    }
    
    // Ensure template content is properly formatted
    if (template && typeof template.content === 'object') {
      template.content = JSON.stringify(template.content);
    }
    
    // Get tenant branding settings
    const tenant = await prisma.tenant.findUnique({
      where: { id: user.tenantId },
      include: {
        settings: true
      }
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
      tpin: tenant?.tpin || ''
    };
    
    // Calculate payment information (completed payments only; exclude reversals)
    const eligiblePayments = (invoice.payments || []).filter(
      (p) =>
        p &&
        !p.isReversal &&
        (p.status == null || String(p.status) === 'Completed')
    );
    const totalPaid = eligiblePayments.reduce(
      (sum, payment) => addMoney(sum, payment.amount),
      0
    );
    const invTotal = parseMoney(invoice.total);
    const outstandingAmount = Math.max(0, subtractMoney(invTotal, totalPaid));
    const isFullyPaid = totalPaid >= invTotal - 0.005;
    const isPartiallyPaid = totalPaid > 0 && !isFullyPaid;
    
    // Prepare invoice data in the format expected by client-side PDF generator
    const preparedInvoice = {
      ...invoice,
      createdByName: invoice.createdBy?.name || '',
      clientName: invoice.client?.name || '',
      items: invoice.items.map(item => ({
        ...item,
        description: item.description || (item.product ? item.product.name : ''),
        amount: multiplyMoney(item.quantity, item.unitPrice)
      })),
      paymentInfo: {
        totalPaid,
        outstandingAmount,
        isFullyPaid,
        isPartiallyPaid,
        paymentCount: eligiblePayments.length
      }
    };
    
    // Return JSON with all necessary data for client-side PDF generation
    return NextResponse.json({
      invoice: preparedInvoice,
      template,
      branding
    });
    
  } catch (error) {
    console.error('Error preparing invoice data:', error);
    return NextResponse.json(
      { error: 'Failed to prepare invoice data. Please try again.' },
      { status: 500 }
    );
  }
}
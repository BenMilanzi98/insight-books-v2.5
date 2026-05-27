import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { multiplyMoney } from '@/lib/money';

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
    
    // Fetch the template
    let template = null;
    if (templateId) {
      template = await prisma.invoiceTemplate.findUnique({
        where: { id: templateId }
      });
    }
    
    // If no template specified or not found, use tenant's default template
    if (!template) {
      template = await prisma.invoiceTemplate.findFirst({
        where: {
          OR: [
            { tenantId: user.tenantId, isDefault: true },
            { tenantId: user.tenantId }
          ]
        },
        orderBy: {
          isDefault: 'desc'
        }
      });
    }
    
    // Fallback to system default template if still not found
    if (!template) {
      template = {
        id: 'default',
        name: 'Default Template',
        content: JSON.stringify({
          style: 'standard',
          showLogo: true,
          showFooter: true,
          primaryColor: '#4f46e5'
        })
      };
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
      (sum, payment) => sum + (parseFloat(payment.amount) || 0),
      0
    );
    const invTotal = parseFloat(invoice.total) || 0;
    const outstandingAmount = Math.max(0, invTotal - totalPaid);
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
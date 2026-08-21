// app/api/quotations/[id]/download/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { resolveDocumentTemplate } from '@/lib/documentTemplates/resolveDocumentTemplate';

/**
 * GET handler for downloading quotation data for client-side PDF generation
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

    const paramsData= await params;
    const quotationId = paramsData.id;
    const { searchParams } = new URL(request.url);
    const templateId = searchParams.get('templateId');
    // Check if quotation exists and belongs to the user's tenant
    const quotation = await prisma.quotation.findFirst({
      where: {
        id: quotationId,
        tenantId: user.tenantId
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        client: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    if (!quotation) {
      return NextResponse.json(
        { error: 'Quotation not found' },
        { status: 404 }
      );
    }
    
    // Fetch the template (query param → document templateId → tenant default)
    const resolved = await resolveDocumentTemplate(prisma, {
      tenantId: user.tenantId,
      templateId: templateId || quotation.templateId,
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
      defaultBankDetails: tenant?.settings?.defaultBankDetails || ''
    };
    
    // Prepare quotation data in the format expected by client-side PDF generator
    const preparedQuotation = {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber || '',
      title: quotation.title || 'Quotation',
      orderNumber: quotation.orderNumber ?? null,
      issueDate: quotation.issueDate ? quotation.issueDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      validUntil: quotation.validUntil ? quotation.validUntil.toISOString().split('T')[0] : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: quotation.status || 'Draft',
      notes: quotation.notes || '',
      createdAt: quotation.createdAt ? quotation.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      // Client information
      client: {
        id: quotation.client?.id || '',
        name: quotation.client?.name || 'Client Name Not Available',
        email: quotation.client?.email || '',
        phone: quotation.client?.phone || '',
        address: quotation.client?.address || '',
        contactPerson: quotation.client?.contactPerson || ''
      },
      // Created by information
      createdBy: {
        id: quotation.createdBy?.id || '',
        name: quotation.createdBy?.name || 'N/A',
        email: quotation.createdBy?.email || ''
      },
      // Items with proper structure
      items: quotation.items.map(item => ({
        id: item.id,
        description: item.description || (item.product ? item.product.name : ''),
        quantity: item.quantity || 0,
        unitPrice: item.unitPrice || 0,
        taxRate: item.taxRate || 0,
        discountRate: item.discountRate || 0,
        discountAmount: item.discountAmount || 0,
        netAmount: item.netAmount || 0,
        amount: parseFloat(((item.quantity || 0) * (item.unitPrice || 0)).toFixed(2)),
        product: item.product || null
      })),
      // Financial totals
      subtotal: quotation.subtotal || 0,
      totalDiscountAmount: quotation.totalDiscountAmount || 0,
      taxAmount: quotation.taxAmount || 0,
      total: quotation.total || 0,
      discount: quotation.discount || 0,
      // Footer overrides for phone and bank details
      footerPhoneOverride: quotation.footerPhoneOverride ?? null,
      footerBankDetailsOverride: quotation.footerBankDetailsOverride ?? null
    };
    
    // Return JSON with all necessary data for client-side PDF generation
    return NextResponse.json({
      quotation: preparedQuotation,
      template,
      branding
    });
    
  } catch (error) {
    console.error('Error preparing quotation data:', error);
    return NextResponse.json(
      { error: 'Failed to prepare quotation data. Please try again.' },
      { status: 500 }
    );
  }
}
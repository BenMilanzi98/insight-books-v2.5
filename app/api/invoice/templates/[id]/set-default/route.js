// app/api/invoice/templates/[id]/set-default/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
export async function PUT(request, { params }) {
  try {
    const templateId = params.id;
    
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check if the template exists and belongs to this tenant
    const template = await prisma.invoiceTemplate.findFirst({
      where: {
        id: templateId,
        tenantId: user.tenantId
      }
    });
    
    if (!template) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      );
    }
    
    // Update this template as default
    await prisma.invoiceTemplate.update({
      where: { id: templateId },
      data: { isDefault: true }
    });
    
    // Update all other templates to not be default
    await prisma.invoiceTemplate.updateMany({
      where: { 
        tenantId: user.tenantId,
        id: { not: templateId }
      },
      data: { isDefault: false }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'INVOICE_TEMPLATE_SET_DEFAULT',
        entityType: 'INVOICE_TEMPLATE',
        entityId: templateId,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: template.name
        })
      }
    });
    
    return NextResponse.json({
      message: 'Default template updated successfully'
    });
  } catch (error) {
    console.error('Error setting default template:', error);
    return NextResponse.json(
      { error: 'Failed to set default template. Please try again.' },
      { status: 500 }
    );
  }
}
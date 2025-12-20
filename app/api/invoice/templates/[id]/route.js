// app/api/invoice/templates/[id]/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
export async function DELETE(request, { params }) {
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
    
    // Cannot delete a default template
    if (template.isDefault) {
      return NextResponse.json(
        { error: 'Cannot delete the default template. Please set another template as default first.' },
        { status: 400 }
      );
    }
    
    // Delete the template
    await prisma.invoiceTemplate.delete({
      where: { id: templateId }
    });
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'INVOICE_TEMPLATE_DELETED',
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
      message: 'Template deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to delete template. Please try again.' },
      { status: 500 }
    );
  }
}
// app/api/invoice/templates/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { serializeTemplateContent } from '@/lib/documentTemplates/parseTemplateContent';

function normalizeContentInput(raw) {
  if (raw == null) return serializeTemplateContent({});
  if (typeof raw === 'string') {
    try {
      return serializeTemplateContent(JSON.parse(raw || '{}'));
    } catch {
      return serializeTemplateContent({});
    }
  }
  return serializeTemplateContent(raw);
}export async function GET(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with this user' },
        { status: 400 }
      );
    }
    
    // Fetch invoice templates for this tenant
    const templates = await prisma.invoiceTemplate.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: 'asc' }
    });
    
    // If no templates exist, create a default one
    if (templates.length === 0) {
      const defaultTemplate = await prisma.invoiceTemplate.create({
        data: {
          name: 'Standard Invoice',
          isDefault: true,
          content: JSON.stringify({}), // Default template content
          tenantId: user.tenantId
        }
      });
      
      return NextResponse.json({
        templates: [defaultTemplate]
      });
    }
    
    return NextResponse.json({
      templates
    });
  } catch (error) {
    console.error('Error fetching invoice templates:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice templates. Please try again.' },
      { status: 500 }
    );
  }
}

// POST - Create new invoice template
export async function POST(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.name) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }
    
    // Create the template
    const template = await prisma.invoiceTemplate.create({
      data: {
        name: body.name,
        isDefault: body.isDefault || false,
        content: normalizeContentInput(body.content),
        tenant: {
          connect: { id: user.tenantId }
        }
      }
    });
    
    // If this is set as default, update other templates
    if (template.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: { 
          tenantId: user.tenantId,
          id: { not: template.id }
        },
        data: {
          isDefault: false
        }
      });
    }
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'INVOICE_TEMPLATE_CREATED',
        entityType: 'INVOICE_TEMPLATE',
        entityId: template.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: template.name,
          isDefault: template.isDefault
        })
      }
    });
    
    return NextResponse.json({
      message: 'Template created successfully',
      template
    });
  } catch (error) {
    console.error('Error creating invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to create template. Please try again.' },
      { status: 500 }
    );
  }
}

// PUT - Update existing invoice template
export async function PUT(request) {
  try {
    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    
    // Validate required fields
    if (!body.id || !body.name) {
      return NextResponse.json(
        { error: 'Template ID and name are required' },
        { status: 400 }
      );
    }
    
    // Check if the template exists and belongs to this tenant
    const existingTemplate = await prisma.invoiceTemplate.findFirst({
      where: {
        id: body.id,
        tenantId: user.tenantId
      }
    });
    
    if (!existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found or access denied' },
        { status: 404 }
      );
    }
    
    // Update the template
    const template = await prisma.invoiceTemplate.update({
      where: { id: body.id },
      data: {
        name: body.name,
        isDefault: body.isDefault || false,
        content: body.content != null ? normalizeContentInput(body.content) : existingTemplate.content
      }
    });
    
    // If this is set as default, update other templates
    if (template.isDefault) {
      await prisma.invoiceTemplate.updateMany({
        where: { 
          tenantId: user.tenantId,
          id: { not: template.id }
        },
        data: {
          isDefault: false
        }
      });
    }
    
    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: 'INVOICE_TEMPLATE_UPDATED',
        entityType: 'INVOICE_TEMPLATE',
        entityId: template.id,
        userId: user.id,
        tenantId: user.tenantId,
        details: JSON.stringify({
          name: template.name,
          isDefault: template.isDefault
        })
      }
    });
    
    return NextResponse.json({
      message: 'Template updated successfully',
      template
    });
  } catch (error) {
    console.error('Error updating invoice template:', error);
    return NextResponse.json(
      { error: 'Failed to update template. Please try again.' },
      { status: 500 }
    );
  }
}
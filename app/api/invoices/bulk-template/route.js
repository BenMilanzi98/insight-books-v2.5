import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { parseTemplateContent, serializeTemplateContent } from '@/lib/documentTemplates/parseTemplateContent';

/**
 * PATCH /api/invoices/bulk-template
 * Body: { invoiceIds: string[], templateId?: string, appearance?: object, setAsDefault?: boolean }
 */
export async function PATCH(request) {
  try {
    const perm = await requirePermission(request, 'invoices.update');
    if (perm) return perm;

    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const invoiceIds = Array.isArray(body.invoiceIds) ? body.invoiceIds.filter(Boolean) : [];
    if (invoiceIds.length === 0) {
      return NextResponse.json({ error: 'invoiceIds required' }, { status: 400 });
    }

    let templateId = body.templateId || null;

    if (body.appearance && typeof body.appearance === 'object') {
      const content = serializeTemplateContent(body.appearance);
      if (templateId) {
        const existing = await prisma.invoiceTemplate.findFirst({
          where: { id: templateId, tenantId: user.tenantId },
        });
        if (!existing) {
          return NextResponse.json({ error: 'Template not found' }, { status: 404 });
        }
        await prisma.invoiceTemplate.update({
          where: { id: templateId },
          data: {
            content,
            isDefault: body.setAsDefault ? true : undefined,
          },
        });
      } else {
        const created = await prisma.invoiceTemplate.create({
          data: {
            name: `Appearance ${new Date().toISOString().slice(0, 16)}`,
            isDefault: !!body.setAsDefault,
            content,
            tenantId: user.tenantId,
          },
        });
        templateId = created.id;
      }

      if (body.setAsDefault && templateId) {
        await prisma.invoiceTemplate.updateMany({
          where: { tenantId: user.tenantId, id: { not: templateId } },
          data: { isDefault: false },
        });
        await prisma.invoiceTemplate.update({
          where: { id: templateId },
          data: { isDefault: true },
        });
      }
    } else if (templateId) {
      const existing = await prisma.invoiceTemplate.findFirst({
        where: { id: templateId, tenantId: user.tenantId },
      });
      if (!existing) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }
      if (body.setAsDefault) {
        await prisma.invoiceTemplate.updateMany({
          where: { tenantId: user.tenantId, id: { not: templateId } },
          data: { isDefault: false },
        });
        await prisma.invoiceTemplate.update({
          where: { id: templateId },
          data: { isDefault: true },
        });
      }
    } else {
      return NextResponse.json(
        { error: 'templateId or appearance required' },
        { status: 400 }
      );
    }

    const result = await prisma.invoice.updateMany({
      where: { tenantId: user.tenantId, id: { in: invoiceIds } },
      data: { templateId },
    });

    return NextResponse.json({
      message: 'Template applied',
      updated: result.count,
      templateId,
      appearance: parseTemplateContent(
        (
          await prisma.invoiceTemplate.findUnique({ where: { id: templateId } })
        )?.content
      ),
    });
  } catch (error) {
    console.error('bulk-template invoices error:', error);
    return NextResponse.json({ error: 'Failed to apply template' }, { status: 500 });
  }
}

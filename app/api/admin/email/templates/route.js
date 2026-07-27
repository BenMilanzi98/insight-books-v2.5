import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { sanitizeTemplateVariables } from '@/lib/admin/emailSafety';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.email.view) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.email.templatesManage)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const templates = await prisma.platformEmailTemplate.findMany({
      orderBy: [{ code: 'asc' }, { version: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ success: true, templates });
  } catch (error) {
    console.error('email templates GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load templates' },
      { status: 500 }
    );
  }
}

/**
 * POST — create a new template version (never stores SMTP secrets).
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.email.templatesManage)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const code = String(body.code || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const subject = String(body.subject || '').trim();
    const bodyHtml = String(body.bodyHtml || body.body || '').trim();

    if (!code || !name || !subject || !bodyHtml) {
      return NextResponse.json(
        { success: false, error: 'code, name, subject, and bodyHtml are required' },
        { status: 400 }
      );
    }

    // Reject accidental secret fields
    if (body.smtpPassword || body.apiKey || body.password) {
      return NextResponse.json(
        { success: false, error: 'SMTP/API secrets must not be stored on templates' },
        { status: 400 }
      );
    }

    const latest = await prisma.platformEmailTemplate.findFirst({
      where: { code },
      orderBy: { version: 'desc' },
    });
    const nextVersion = latest ? latest.version + 1 : 1;

    if (latest && latest.status === 'ACTIVE') {
      await prisma.platformEmailTemplate.update({
        where: { id: latest.id },
        data: { status: 'SUPERSEDED' },
      });
    }

    const variables = Array.isArray(body.variables)
      ? body.variables
      : Object.keys(sanitizeTemplateVariables(body.sampleVariables || {}));

    const template = await prisma.platformEmailTemplate.create({
      data: {
        code,
        version: nextVersion,
        name,
        subject,
        bodyHtml,
        bodyText: body.bodyText ? String(body.bodyText) : null,
        language: String(body.language || 'en'),
        category: String(body.category || 'transactional'),
        status: 'ACTIVE',
        variables,
        createdBy: admin.id,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'EMAIL_TEMPLATE_VERSION_CREATE',
        entityType: 'EMAIL_TEMPLATE',
        entityId: template.id,
        details: JSON.stringify({ code, version: nextVersion }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error) {
    console.error('email templates POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save template' },
      { status: 500 }
    );
  }
}

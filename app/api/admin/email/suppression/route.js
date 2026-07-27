import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.email.view) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.email.suppressionManage)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const rows = await prisma.platformEmailSuppression.findMany({
      where: { active: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return NextResponse.json({ success: true, suppressions: rows });
  } catch (error) {
    console.error('suppression GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list suppressions' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.email.suppressionManage)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body.email || '').trim().toLowerCase();
    const reason = String(body.reason || 'manual').trim();
    const source = String(body.source || 'manual').trim();

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      );
    }

    const row = await prisma.platformEmailSuppression.upsert({
      where: { email },
      create: {
        email,
        reason,
        source,
        active: true,
        createdBy: admin.id,
      },
      update: {
        reason,
        source,
        active: true,
        updatedAt: new Date(),
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'EMAIL_SUPPRESSION_UPSERT',
        entityType: 'EMAIL_SUPPRESSION',
        entityId: row.id,
        details: JSON.stringify({ email, reason, source }),
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json({ success: true, suppression: row });
  } catch (error) {
    console.error('suppression POST:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update suppression' },
      { status: 500 }
    );
  }
}

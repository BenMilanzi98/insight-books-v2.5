import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import {
  ENTITLEMENT_SOURCES,
  ENTITLEMENT_STATUSES,
  validateEntitlementWrite,
} from '@/lib/admin/featureEntitlements';

function clientMeta(request) {
  return {
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

/**
 * GET /api/admin/feature-entitlements?tenantId=
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.settings.features)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId') || undefined;
    const status = searchParams.get('status') || undefined;

    const entitlements = await prisma.platformFeatureEntitlement.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: [{ tenantId: 'asc' }, { featureCode: 'asc' }],
      take: 500,
    });

    return NextResponse.json({ success: true, entitlements });
  } catch (error) {
    console.error('feature-entitlements GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load entitlements' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/feature-entitlements
 * Upsert tenant override. Disabling never deletes tenant operational data.
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.settings.features)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const featureCode = String(body.featureCode || '').trim();
    const tenantId = String(body.tenantId || '').trim();
    const status = String(body.status || ENTITLEMENT_STATUSES.ACTIVE).toUpperCase();
    const validation = validateEntitlementWrite({ featureCode, tenantId, status });
    if (!validation.ok) {
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      return NextResponse.json({ success: false, error: 'Tenant not found' }, { status: 404 });
    }

    const entitlement = await prisma.platformFeatureEntitlement.upsert({
      where: {
        tenantId_featureCode: { tenantId, featureCode },
      },
      create: {
        tenantId,
        featureCode,
        featureName: body.featureName ? String(body.featureName) : featureCode,
        source: body.source || ENTITLEMENT_SOURCES.TENANT_OVERRIDE,
        status,
        reason: body.reason ? String(body.reason) : null,
        startDate: body.startDate ? new Date(body.startDate) : new Date(),
        endDate: body.endDate ? new Date(body.endDate) : null,
        grantedBy: admin.id,
      },
      update: {
        featureName: body.featureName ? String(body.featureName) : undefined,
        status,
        reason: body.reason != null ? String(body.reason) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
        grantedBy: admin.id,
      },
    });

    const meta = clientMeta(request);
    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'FEATURE_ENTITLEMENT_UPSERT',
        entityType: 'FEATURE_ENTITLEMENT',
        entityId: entitlement.id,
        details: JSON.stringify({
          tenantId,
          featureCode,
          status,
          note: 'Entitlement change does not delete tenant data',
        }),
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });

    return NextResponse.json({
      success: true,
      entitlement,
      message: 'Entitlement saved. Tenant historical data was not deleted.',
    });
  } catch (error) {
    console.error('feature-entitlements POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save entitlement' },
      { status: 500 }
    );
  }
}

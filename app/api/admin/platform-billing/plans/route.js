import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';
import {
  assertPlanPriceChangeCreatesVersion,
} from '@/lib/admin/platformBilling';
import { seedDataFromCatalogPlan, serializePlanVersion } from '@/lib/admin/mraEisPlans';

function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function serializePlan(p) {
  return serializePlanVersion(p);
}

/**
 * GET — list versioned plans; seed from subscriptionConfig if empty (read catalog).
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (typeof prisma.platformPlanVersion?.findMany !== 'function') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Platform plan model unavailable. Stop the Next.js server, run `npx prisma generate`, then start it again.',
          plans: [],
          latest: [],
        },
        { status: 500 }
      );
    }

    let plans = await prisma.platformPlanVersion.findMany({
      orderBy: [{ planCode: 'asc' }, { version: 'desc' }],
      take: 200,
    });

    // Seed v1 from code catalog once (no silent price edits afterward).
    if (plans.length === 0) {
      const catalog = Object.values(SUBSCRIPTION_PLANS || {});
      for (const plan of catalog) {
        await prisma.platformPlanVersion.create({
          data: seedDataFromCatalogPlan(plan, admin.id),
        });
      }
      plans = await prisma.platformPlanVersion.findMany({
        orderBy: [{ planCode: 'asc' }, { version: 'desc' }],
        take: 200,
      });
    }

    const latestByCode = {};
    for (const p of plans) {
      if (!latestByCode[p.planCode]) latestByCode[p.planCode] = p;
    }

    return NextResponse.json({
      success: true,
      plans: plans.map(serializePlan),
      latest: Object.values(latestByCode).map(serializePlan),
    });
  } catch (error) {
    console.error('platform plans GET error:', error);
    const message = error?.message || 'Failed to load plans';
    const code = error?.code;
    const missingDelegate =
      typeof message === 'string' &&
      (message.includes('platformPlanVersion') ||
        message.includes('is not a function') ||
        code === 'P2021');
    return NextResponse.json(
      {
        success: false,
        error: missingDelegate
          ? 'Platform plan tables/client unavailable. Run migrations and restart the Next.js server after `npx prisma generate`.'
          : 'Failed to load plans',
        details: process.env.NODE_ENV === 'development' ? message : undefined,
        code: process.env.NODE_ENV === 'development' ? code : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST — create a new plan version (required when price changes).
 * Body: { planCode, name, basePrice, currency, billingFrequency, features?, forceNewVersion? }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.plansManage)) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const planCode = String(body.planCode || '').trim();
    const name = String(body.name || '').trim();
    const basePrice = toNumber(body.basePrice);
    const currency = String(body.currency || 'MWK').toUpperCase();
    const billingFrequency = String(body.billingFrequency || 'month');
    const forceNewVersion = body.forceNewVersion !== false;

    if (!planCode || !name) {
      return NextResponse.json(
        { success: false, error: 'planCode and name are required' },
        { status: 400 }
      );
    }
    if (basePrice < 0) {
      return NextResponse.json(
        { success: false, error: 'basePrice cannot be negative' },
        { status: 400 }
      );
    }

    const latest = await prisma.platformPlanVersion.findFirst({
      where: { planCode },
      orderBy: { version: 'desc' },
    });

    if (latest) {
      const check = assertPlanPriceChangeCreatesVersion({
        existingPrice: latest.basePrice,
        newPrice: basePrice,
        forceNewVersion,
      });
      if (!check.ok) {
        return NextResponse.json(
          { success: false, error: check.error },
          { status: 400 }
        );
      }
    }

    const nextVersion = latest ? latest.version + 1 : 1;

    if (latest && latest.status === 'ACTIVE') {
      await prisma.platformPlanVersion.update({
        where: { id: latest.id },
        data: {
          status: 'SUPERSEDED',
          effectiveTo: new Date(),
        },
      });
    }

    const created = await prisma.platformPlanVersion.create({
      data: {
        planCode,
        version: nextVersion,
        name,
        description: body.description ? String(body.description) : null,
        currency,
        basePrice,
        billingFrequency,
        userLimit: body.userLimit != null ? Number(body.userLimit) : null,
        businessLimit: body.businessLimit != null ? Number(body.businessLimit) : null,
        featuresJson: Array.isArray(body.features) ? body.features : [],
        status: 'ACTIVE',
        createdBy: admin.id,
      },
    });

    await prisma.adminAuditLog.create({
      data: {
        adminId: admin.id,
        action: 'PLATFORM_PLAN_VERSION_CREATE',
        entityType: 'PLATFORM_PLAN',
        entityId: created.id,
        details: JSON.stringify({
          planCode,
          version: nextVersion,
          basePrice,
          supersededId: latest?.id || null,
        }),
        ipAddress:
          request.headers.get('x-forwarded-for') ||
          request.headers.get('x-real-ip') ||
          'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown',
      },
    });

    return NextResponse.json(
      { success: true, plan: serializePlan(created) },
      { status: 201 }
    );
  } catch (error) {
    console.error('platform plans POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create plan version',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

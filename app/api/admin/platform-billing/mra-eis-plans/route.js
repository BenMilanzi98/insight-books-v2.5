import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { SUBSCRIPTION_PLANS } from '@/lib/subscriptionConfig';
import { assertPlanPriceChangeCreatesVersion } from '@/lib/admin/platformBilling';
import {
  PLAN_CATEGORY,
  PLAN_STATUS,
  seedDataFromCatalogPlan,
  serializePlanVersion,
  toNumber,
} from '@/lib/admin/mraEisPlans';

/**
 * GET/POST — MRA EIS commercial plans (PlatformPlanVersion where planCategory=MRA_EIS).
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.view) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.mraPlans.view)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    if (typeof prisma.platformPlanVersion?.findMany !== 'function') {
      return NextResponse.json(
        {
          success: false,
          error: 'Platform plan model unavailable. Restart after prisma generate.',
          plans: [],
          latest: [],
        },
        { status: 500 }
      );
    }

    let plans;
    try {
      plans = await prisma.platformPlanVersion.findMany({
        where: { planCategory: PLAN_CATEGORY.MRA_EIS },
        orderBy: [{ displayOrder: 'asc' }, { planCode: 'asc' }, { version: 'desc' }],
        take: 200,
      });
    } catch (queryErr) {
      const msg = String(queryErr?.message || '');
      if (msg.includes('planCategory') || msg.includes('Unknown argument')) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Prisma client is outdated (missing planCategory). Stop the dev server, run npx prisma generate, then restart npm run dev.',
            plans: [],
            latest: [],
            details: process.env.NODE_ENV === 'development' ? msg : undefined,
          },
          { status: 500 }
        );
      }
      throw queryErr;
    }

    // Seed EIS catalog rows if none categorized yet
    if (plans.length === 0) {
      const eisCatalog = Object.values(SUBSCRIPTION_PLANS || {}).filter((p) => p.requiresEIS);
      for (const plan of eisCatalog) {
        const existing = await prisma.platformPlanVersion.findFirst({
          where: { planCode: plan.id },
        });
        if (existing) {
          await prisma.platformPlanVersion.update({
            where: { id: existing.id },
            data: {
              planCategory: PLAN_CATEGORY.MRA_EIS,
              productCode: 'MRA_EIS',
              publicName: existing.publicName || existing.name,
              isPublic: true,
              status:
                existing.status === 'ACTIVE' ? PLAN_STATUS.PUBLISHED : existing.status,
            },
          });
        } else {
          await prisma.platformPlanVersion.create({
            data: seedDataFromCatalogPlan(plan, admin.id),
          });
        }
      }
      plans = await prisma.platformPlanVersion.findMany({
        where: { planCategory: PLAN_CATEGORY.MRA_EIS },
        orderBy: [{ displayOrder: 'asc' }, { planCode: 'asc' }, { version: 'desc' }],
        take: 200,
      });
    }

    const latestByCode = {};
    for (const p of plans) {
      if (!latestByCode[p.planCode]) latestByCode[p.planCode] = p;
    }

    return NextResponse.json({
      success: true,
      plans: plans.map(serializePlanVersion),
      latest: Object.values(latestByCode).map(serializePlanVersion),
      policy: {
        entitlement: 'SUBSCRIPTION_FIRST',
        note: 'Payment activates commercial subscription; entitlement stays pending admin review.',
      },
    });
  } catch (error) {
    console.error('mra-eis-plans GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to load MRA EIS plans',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

/**
 * POST — create draft or new version of an MRA EIS plan.
 * Body: { planCode, name, publicName?, basePrice, billingFrequency, features?, limits?,
 *         isPublic?, isFeatured?, displayOrder?, trialEnabled?, trialDays?, status?,
 *         forceNewVersion? }
 */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.billing.plansManage) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.mraPlans.create) &&
      !adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.mraPlans.editDraft)
    ) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const planCode = String(body.planCode || '').trim();
    const name = String(body.name || '').trim();
    const publicName = String(body.publicName || name).trim();
    const basePrice = toNumber(body.basePrice);
    const billingFrequency = String(body.billingFrequency || 'month');
    const forceNewVersion = body.forceNewVersion !== false;
    const status = String(body.status || PLAN_STATUS.DRAFT).toUpperCase();

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
      where: { planCode, planCategory: PLAN_CATEGORY.MRA_EIS },
      orderBy: { version: 'desc' },
    });

    if (latest) {
      const check = assertPlanPriceChangeCreatesVersion({
        existingPrice: latest.basePrice,
        newPrice: basePrice,
        forceNewVersion,
      });
      if (!check.ok) {
        return NextResponse.json({ success: false, error: check.error }, { status: 400 });
      }
      if (
        (latest.status === PLAN_STATUS.PUBLISHED || latest.status === PLAN_STATUS.ACTIVE) &&
        Number(latest.basePrice) !== basePrice &&
        !forceNewVersion
      ) {
        return NextResponse.json(
          { success: false, error: 'Published prices require a new version' },
          { status: 400 }
        );
      }
    }

    const nextVersion = latest ? latest.version + 1 : 1;
    if (latest && Number(latest.basePrice) !== basePrice) {
      await prisma.platformPlanVersion.update({
        where: { id: latest.id },
        data: { status: PLAN_STATUS.SUPERSEDED, effectiveTo: new Date() },
      });
    }

    const created = await prisma.platformPlanVersion.create({
      data: {
        planCode,
        version: nextVersion,
        name,
        publicName,
        description: body.description ? String(body.description) : null,
        planCategory: PLAN_CATEGORY.MRA_EIS,
        productCode: 'MRA_EIS',
        currency: String(body.currency || 'MWK').toUpperCase(),
        basePrice,
        billingFrequency,
        featuresJson: body.features || body.featuresJson || [],
        limitsJson: body.limits || body.limitsJson || {},
        eligibilityJson: body.eligibility || body.eligibilityJson || {
          requiresEntitlementApproval: true,
        },
        billingCyclesJson: body.billingCycles || body.billingCyclesJson || [
          {
            cycle: billingFrequency === 'year' ? 'ANNUAL' : 'MONTHLY',
            price: basePrice,
            preferred: true,
          },
        ],
        presentationJson: body.presentation || body.presentationJson || {},
        status: [PLAN_STATUS.DRAFT, PLAN_STATUS.PUBLISHED, PLAN_STATUS.SUSPENDED].includes(status)
          ? status
          : PLAN_STATUS.DRAFT,
        isPublic: Boolean(body.isPublic),
        isFeatured: Boolean(body.isFeatured),
        displayOrder: toNumber(body.displayOrder, 0),
        trialEnabled: Boolean(body.trialEnabled),
        trialDays: body.trialDays != null ? toNumber(body.trialDays) : null,
        ctaText: body.ctaText ? String(body.ctaText) : 'Subscribe to MRA EIS',
        highlightText: body.highlightText ? String(body.highlightText) : null,
        createdBy: admin.id,
      },
    });

    return NextResponse.json({
      success: true,
      plan: serializePlanVersion(created),
    });
  } catch (error) {
    console.error('mra-eis-plans POST error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to save MRA EIS plan',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}

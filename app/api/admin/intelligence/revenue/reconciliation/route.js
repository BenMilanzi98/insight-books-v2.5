import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

import { getAdminFromRequest } from '@/lib/adminAuth';

import { authorizeAdminDecision } from '@/lib/admin/authorization/authorizeAdminDecision';

import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

import {

  buildRevenueKpiPack,

  filterRevenuePackBySection,

  reconstructMrrHistory,

  persistMrrSnapshots,

  mrrMetricKeys,

} from '@/lib/admin/revenue';



/** Same gate as GET pack: dashboard.view OR intel.revenue.read (Super Admin break-glass). */

export function canReadRevenuePack(admin) {

  if (!admin) return false;

  const view = authorizeAdminDecision({

    admin,

    permission: SYSTEM_ADMIN_PERMISSIONS.dashboard.view,

  });

  const intel = authorizeAdminDecision({

    admin,

    permission: SYSTEM_ADMIN_PERMISSIONS.intel.revenueRead,

  });

  return view.allowed === true || intel.allowed === true;

}



/**

 * POST reconstruct/persist requires BOTH:

 * - revenue read (dashboard.view OR intel.revenue.read)

 * - AND health.view (or Super Admin break-glass via authorizeAdminDecision)

 */

export function canPostRevenueReconciliation(admin) {

  if (!admin) return false;

  if (!canReadRevenuePack(admin)) return false;

  const health = authorizeAdminDecision({

    admin,

    permission: SYSTEM_ADMIN_PERMISSIONS.health.view,

  });

  return health.allowed === true;

}



/** GET remains read-only status (no reconstruct/persist side effects). */

export async function GET(request) {

  try {

    const admin = await getAdminFromRequest(request);

    if (!admin) {

      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    }



    const { searchParams } = new URL(request.url);

    const days = parseInt(searchParams.get('days') || '30', 10);

    const currency = searchParams.get('currency') || 'MWK';

    const now = new Date();

    const periodStart = new Date(now.getTime() - Math.min(Math.max(days, 1), 365) * 864e5);



    let pack = await buildRevenueKpiPack(prisma, {

      admin,

      periodStart,

      periodEnd: now,

      currency,

      now,

    });



    if (pack.forbidden) {

      return NextResponse.json(

        { success: false, error: 'Insufficient admin privileges' },

        { status: 403 }

      );

    }



    pack = filterRevenuePackBySection(pack, 'reconciliation');



    return NextResponse.json({

      success: true,

      ...pack,

      snapshotKeys: mrrMetricKeys(currency),

      reconstruct: null,

    });

  } catch (error) {

    console.error('revenue reconciliation error:', error);

    return NextResponse.json(

      { success: false, error: 'Failed to build revenue reconciliation' },

      { status: 500 }

    );

  }

}



/** POST reconstruct/persist — body { reconstruct: true }. */

export async function POST(request) {

  try {

    const admin = await getAdminFromRequest(request);

    if (!admin) {

      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    }



    if (!canPostRevenueReconciliation(admin)) {

      return NextResponse.json(

        {

          success: false,

          error:

            'Insufficient privileges to reconstruct MRR history (requires revenue read and health.view)',

        },

        { status: 403 }

      );

    }



    let body = {};

    try {

      body = await request.json();

    } catch {

      body = {};

    }



    if (!body?.reconstruct) {

      return NextResponse.json(

        { success: false, error: 'Body must include { reconstruct: true }' },

        { status: 400 }

      );

    }



    const { searchParams } = new URL(request.url);

    const days = parseInt(

      body.days != null ? String(body.days) : searchParams.get('days') || '30',

      10

    );

    const currency = String(

      body.currency || searchParams.get('currency') || 'MWK'

    ).toUpperCase();

    const force = Boolean(body.force);

    const now = new Date();

    const periodStart = new Date(now.getTime() - Math.min(Math.max(days, 1), 365) * 864e5);



    const reconstructResult = await reconstructMrrHistory(prisma, {

      from: periodStart,

      to: now,

      currency,

    });

    const persistResult = await persistMrrSnapshots(prisma, reconstructResult, {

      force,

    });



    return NextResponse.json({

      success: true,

      snapshotKeys: mrrMetricKeys(currency),

      reconstruct: {

        confidence: reconstructResult?.confidence,

        dayCount: reconstructResult?.days?.length || 0,

        gaps: reconstructResult?.gaps || [],

        persisted: persistResult,

      },

    });

  } catch (error) {

    console.error('revenue reconciliation reconstruct error:', error);

    return NextResponse.json(

      { success: false, error: 'Failed to reconstruct MRR history' },

      { status: 500 }

    );

  }

}



import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

import { requirePermission } from '@/lib/auth';

import { formatYmdInTimeZone } from '@/lib/dateUtils';

import { bootstrapReportRoute, auditReportAccess, tenantNameMap } from '@/lib/reportRouteBootstrap';



/**

 * Read-only accounting periods for report date filtering (reports.view).

 */

export async function GET(request) {

  try {

    const perm = await requirePermission(request, 'reports.view');

    if (perm) return perm;



    const boot = await bootstrapReportRoute(request);

    if (boot.error) return boot.error;

    const { user, tw, scope, tenantIds, tenants } = boot;



    const periods = await prisma.accountingPeriod.findMany({

      where: { ...tw },

      orderBy: [{ tenantId: 'asc' }, { startDate: 'desc' }],

      select: {

        id: true,

        tenantId: true,

        name: true,

        periodType: true,

        startDate: true,

        endDate: true,

        status: true,

        isClosed: true,

      },

    });



    const tMap = tenantNameMap(tenants);



    await auditReportAccess({

      user,

      reportType: 'accounting-periods',

      tenantIds,

      scope,

    });



    return NextResponse.json({

      periods: periods.map((p) => ({

        id: p.id,

        tenantId: p.tenantId,

        businessName: tMap.get(p.tenantId) || p.tenantId,

        name: p.name,

        periodType: p.periodType,

        startDate: formatYmdInTimeZone(p.startDate),

        endDate: formatYmdInTimeZone(p.endDate),

        status: p.status,

        isClosed: Boolean(p.isClosed),

        label: `${p.name} (${formatYmdInTimeZone(p.startDate)} – ${formatYmdInTimeZone(p.endDate)})${p.isClosed ? ' · Closed' : ''}`,

      })),

      scope,

    });

  } catch (error) {

    console.error('Error fetching report accounting periods:', error);

    return NextResponse.json(

      { error: 'Failed to load accounting periods' },

      { status: 500 }

    );

  }

}


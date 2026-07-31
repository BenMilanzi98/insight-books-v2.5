import { NextResponse } from 'next/server';
import prisma from '../../../../../../lib/prisma.js';
import { guardPlanningRoute, accountingErrorResponse } from '../../../../../../lib/financialPlanning/api/routeGuard.js';
import { PLANNING_PERMISSIONS } from '../../../../../../lib/financialPlanning/permissions.js';
import { exportForecastPack } from '../../../../../../lib/financialPlanning/application/exportService.js';

export async function GET(request, { params }) {
  try {
    const guard = await guardPlanningRoute(request, PLANNING_PERMISSIONS.EXPORT);
    if (guard.response) return guard.response;
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'xlsx').toLowerCase();

    const exported = await exportForecastPack(prisma, guard.context, id, {
      format: format === 'json' ? 'json' : 'xlsx',
    });

    if (exported.contentType === 'application/json') {
      return NextResponse.json(exported.body, {
        headers: {
          'Content-Disposition': `attachment; filename="${exported.filename}"`,
        },
      });
    }

    return new NextResponse(exported.body, {
      status: 200,
      headers: {
        'Content-Type': exported.contentType,
        'Content-Disposition': `attachment; filename="${exported.filename}"`,
        'X-Forecast-Checksum': exported.packMeta?.checksum || '',
        'X-Forecast-Integrity': exported.packMeta?.integrityStatus || '',
      },
    });
  } catch (error) {
    return accountingErrorResponse(error, 'export forecast');
  }
}

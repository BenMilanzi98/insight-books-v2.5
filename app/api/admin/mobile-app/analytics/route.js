import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';

function parseIsoDate(raw, endOfDay) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

/**
 * GET ?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let from = parseIsoDate(searchParams.get('from'), false);
    let to = parseIsoDate(searchParams.get('to'), true);
    if (!from || !to) {
      to = new Date();
      to.setUTCHours(23, 59, 59, 999);
      from = new Date(to);
      from.setUTCDate(from.getUTCDate() - 30);
      from.setUTCHours(0, 0, 0, 0);
    }
    if (from > to) {
      return NextResponse.json({ success: false, error: 'Invalid date range' }, { status: 400 });
    }

    const [
      uniqueRow,
      checksRow,
      completedRow,
      failedRow,
      startedRow,
      installPromptedRow,
      dauSeries,
      recent,
    ] = await Promise.all([
      prisma.$queryRaw`
        SELECT COUNT(DISTINCT "deviceId")::int AS n
        FROM "MobileAppClientEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS n
        FROM "MobileAppClientEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND "eventType" = 'version_check'
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS n
        FROM "MobileAppClientEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND "eventType" = 'download_completed'
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS n
        FROM "MobileAppClientEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND "eventType" = 'download_failed'
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS n
        FROM "MobileAppClientEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND "eventType" = 'download_started'
      `,
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS n
        FROM "MobileAppClientEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND "eventType" = 'install_prompted'
      `,
      prisma.$queryRaw`
        SELECT
          to_char(date_trunc('day', "createdAt" AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
          COUNT(DISTINCT "deviceId")::int AS dau
        FROM "MobileAppClientEvent"
        WHERE "createdAt" >= ${from} AND "createdAt" <= ${to}
          AND "eventType" = 'version_check'
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.mobileAppClientEvent.findMany({
        where: { createdAt: { gte: from, lte: to } },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          createdAt: true,
          eventType: true,
          deviceId: true,
          versionCode: true,
          versionName: true,
          targetVersionCode: true,
          bytesReceived: true,
          bytesTotal: true,
          error: true,
        },
      }),
    ]);

    const uniqueDevices = uniqueRow[0]?.n ?? 0;
    const versionCheckCount = checksRow[0]?.n ?? 0;
    const downloadCompleted = completedRow[0]?.n ?? 0;
    const downloadFailed = failedRow[0]?.n ?? 0;
    const downloadStarted = startedRow[0]?.n ?? 0;

    const funnel = {
      versionChecks: versionCheckCount,
      downloadStarted,
      downloadCompleted,
      downloadFailed,
      installPrompted: installPromptedRow[0]?.n ?? 0,
    };

    const dauChart = (dauSeries || []).map((r) => ({
      day: r.day,
      dau: r.dau,
    }));

    return NextResponse.json({
      success: true,
      from: from.toISOString(),
      to: to.toISOString(),
      summary: {
        uniqueDevices,
        versionCheckCount,
        downloadCompleted,
        downloadFailed,
        downloadStarted,
        funnelConversion:
          versionCheckCount > 0
            ? Math.round((downloadCompleted / versionCheckCount) * 1000) / 10
            : null,
      },
      funnel,
      dauByDay: dauChart,
      recentEvents: recent.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        deviceId: `${String(e.deviceId).slice(0, 8)}…`,
      })),
    });
  } catch (e) {
    console.error('admin mobile-app analytics', e);
    return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
  }
}

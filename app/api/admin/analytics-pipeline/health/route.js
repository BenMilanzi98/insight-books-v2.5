import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminDecision } from '@/lib/admin/authorization/requireAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { OUTBOX_STATUS } from '@/lib/admin/analytics/catalogue';

export async function GET(request) {
  try {
    const gate = await requireAdminDecision(request, {
      permission: SYSTEM_ADMIN_PERMISSIONS.health.view,
    });
    if (!gate.ok) return gate.response;

    if (typeof prisma.analyticsOutbox?.count !== 'function') {
      return NextResponse.json({
        success: true,
        available: false,
        error: 'Analytics plane not generated — run prisma generate / db push',
      });
    }

    const [pending, claimed, dead, events, freshness, lastRecon, checkpoints] =
      await Promise.all([
        prisma.analyticsOutbox.count({ where: { status: OUTBOX_STATUS.PENDING } }),
        prisma.analyticsOutbox.count({ where: { status: OUTBOX_STATUS.CLAIMED } }),
        prisma.analyticsOutbox.count({ where: { status: OUTBOX_STATUS.DEAD } }),
        prisma.analyticsEvent.count(),
        prisma.analyticsDataFreshness.findMany({ take: 20 }),
        prisma.analyticsReconciliationRun.findMany({
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.analyticsConsumerCheckpoint.findMany({ take: 20 }),
      ]);

    return NextResponse.json({
      success: true,
      available: true,
      health: {
        outbox: { pending, claimed, dead },
        eventCount: events,
        freshness,
        lastReconciliation: lastRecon,
        checkpoints,
      },
    });
  } catch (error) {
    console.error('analytics-pipeline health error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load analytics pipeline health' },
      { status: 500 }
    );
  }
}

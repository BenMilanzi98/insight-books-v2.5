import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminDecision } from '@/lib/admin/authorization/requireAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { dispatchAnalyticsOutbox } from '@/lib/admin/analytics/dispatcher';

export async function POST(request) {
  try {
    const gate = await requireAdminDecision(request, {
      permission: SYSTEM_ADMIN_PERMISSIONS.health.retryJobs,
    });
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    const limit = parseInt(body?.limit || '50', 10);
    const result = await dispatchAnalyticsOutbox(prisma, {
      workerId: `admin:${gate.admin.id}`,
      limit,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('analytics-pipeline dispatch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to dispatch analytics outbox' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminDecision } from '@/lib/admin/authorization/requireAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { runFactConsumers } from '@/lib/admin/analytics/consumers';
import { rebuildDailyBillingSnapshots } from '@/lib/admin/analytics/snapshots';

export async function POST(request) {
  try {
    const gate = await requireAdminDecision(request, {
      permission: SYSTEM_ADMIN_PERMISSIONS.health.retryJobs,
    });
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    const limit = parseInt(body?.limit || '50', 10);
    const consume = await runFactConsumers(prisma, { limit });
    const snaps = await rebuildDailyBillingSnapshots(prisma);

    return NextResponse.json({ success: true, consume, snapshots: snaps });
  } catch (error) {
    console.error('analytics-pipeline consume error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run analytics consumers' },
      { status: 500 }
    );
  }
}

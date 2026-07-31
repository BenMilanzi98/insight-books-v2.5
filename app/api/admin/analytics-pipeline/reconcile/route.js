import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminDecision } from '@/lib/admin/authorization/requireAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { reconcilePlatformPayments } from '@/lib/admin/analytics/reconcile';

export async function POST(request) {
  try {
    const gate = await requireAdminDecision(request, {
      permission: SYSTEM_ADMIN_PERMISSIONS.health.view,
    });
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    const result = await reconcilePlatformPayments(prisma, {
      periodStart: body?.periodStart,
      periodEnd: body?.periodEnd,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('analytics-pipeline reconcile error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reconcile analytics pipeline' },
      { status: 500 }
    );
  }
}

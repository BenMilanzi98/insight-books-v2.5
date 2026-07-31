import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminDecision } from '@/lib/admin/authorization/requireAdminDecision';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import { runPaymentEventBackfill } from '@/lib/admin/analytics/backfill';

export async function GET(request) {
  try {
    const gate = await requireAdminDecision(request, {
      permission: SYSTEM_ADMIN_PERMISSIONS.health.view,
    });
    if (!gate.ok) return gate.response;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const result = await runPaymentEventBackfill(prisma, { dryRun: true, limit });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('analytics-pipeline backfill GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to plan analytics backfill' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const gate = await requireAdminDecision(request, {
      permission: SYSTEM_ADMIN_PERMISSIONS.health.retryJobs,
    });
    if (!gate.ok) return gate.response;

    const body = await request.json().catch(() => ({}));
    const dryRun = body?.dryRun !== false;
    const limit = parseInt(body?.limit || '100', 10);
    const result = await runPaymentEventBackfill(prisma, { dryRun, limit });
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('analytics-pipeline backfill POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to run analytics backfill' },
      { status: 500 }
    );
  }
}

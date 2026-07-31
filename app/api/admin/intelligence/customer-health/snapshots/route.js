import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listHealthSnapshots,
  rebuildHealthSnapshot,
  resolveHealthAccess,
} from '@/lib/admin/health';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listHealthSnapshots(prisma, {
      admin,
      tenantId: searchParams.get('tenantId') || undefined,
      band: searchParams.get('band') || undefined,
      pageSize: searchParams.get('pageSize') || '50',
      latestOnly: searchParams.get('latestOnly') !== 'false',
      now: new Date(),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer-health snapshots list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list health snapshots' },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const access = resolveHealthAccess(admin);
    if (!access.canRebuild) {
      return NextResponse.json(
        { success: false, error: 'Rebuild requires customerHealth.rebuild' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const result = await rebuildHealthSnapshot(prisma, {
      admin,
      tenantId: body.tenantId,
      asOf: body.asOf,
      definitionVersion: body.definitionVersion,
      currency: body.currency || 'MWK',
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Rebuild failed', ...result },
        { status: result.notFound ? 404 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('customer-health snapshots rebuild error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to rebuild health snapshot' },
      { status: 500 }
    );
  }
}

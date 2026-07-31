import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  approveDemoEnvironment,
  deprovisionDemoEnvironment,
  getDemoEnvironment,
  listDemoEnvironments,
  provisionDemoEnvironment,
  requestDemoEnvironment,
  resetDemoEnvironment,
  runDemoEnvironmentHealthCheck,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || searchParams.get('environmentId');
    if (id) {
      const result = await getDemoEnvironment(prisma, { admin, environmentId: id });
      if (result.forbidden) {
        return NextResponse.json(
          { success: false, error: 'Insufficient admin privileges' },
          { status: 403 }
        );
      }
      if (result.notFound) {
        return NextResponse.json(
          { success: false, error: result.error || 'Not found' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, ...result });
    }

    const result = await listDemoEnvironments(prisma, {
      admin,
      demoId: searchParams.get('demoId') || undefined,
      status: searchParams.get('status') || undefined,
      limit: searchParams.get('limit') || '50',
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo environments list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list demo environments' },
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

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'request').trim().toLowerCase();
    let result;

    if (action === 'approve') {
      result = await approveDemoEnvironment(prisma, {
        admin,
        environmentId: body.environmentId || body.id,
      });
    } else if (action === 'provision') {
      result = await provisionDemoEnvironment(prisma, {
        admin,
        environmentId: body.environmentId || body.id,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'health') {
      result = await runDemoEnvironmentHealthCheck(prisma, {
        admin,
        environmentId: body.environmentId || body.id,
      });
    } else if (action === 'reset') {
      result = await resetDemoEnvironment(prisma, {
        admin,
        environmentId: body.environmentId || body.id,
        idempotencyKey: body.idempotencyKey,
      });
    } else if (action === 'deprovision') {
      result = await deprovisionDemoEnvironment(prisma, {
        admin,
        environmentId: body.environmentId || body.id,
        idempotencyKey: body.idempotencyKey,
      });
    } else {
      result = await requestDemoEnvironment(prisma, {
        admin,
        demoId: body.demoId,
        expiresAt: body.expiresAt,
        dataPackId: body.dataPackId,
        notes: body.notes,
        idempotencyKey: body.idempotencyKey,
        aliasMraEisSandbox: body.aliasMraEisSandbox,
        useProductionTenant: body.useProductionTenant,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'Not found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed environment action', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo environments action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed demo environment action' },
      { status: 500 }
    );
  }
}

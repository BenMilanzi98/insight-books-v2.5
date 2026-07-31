import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  createDemoReportSchedule,
  listDemoReportSchedules,
  runDemoReportSchedule,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listDemoReportSchedules(prisma, {
      admin,
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
    console.error('CRM demo report schedules list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list demo report schedules' },
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
    const action = String(body.action || 'create').trim().toLowerCase();
    let result;

    if (action === 'run') {
      result = await runDemoReportSchedule(prisma, {
        admin,
        scheduleId: body.scheduleId || body.id,
      });
    } else {
      result = await createDemoReportSchedule(prisma, {
        admin,
        name: body.name,
        cronExpression: body.cronExpression,
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
        { success: false, error: result.error || 'Failed' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo report schedules error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process demo report schedule' },
      { status: 500 }
    );
  }
}

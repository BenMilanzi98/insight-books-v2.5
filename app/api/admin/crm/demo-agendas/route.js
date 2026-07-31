import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  approveAgendaVersion,
  createAgendaVersion,
  listAgendaVersions,
  requestAgendaApproval,
  updateAgendaVersion,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listAgendaVersions(prisma, {
      admin,
      code: searchParams.get('code') || undefined,
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
    console.error('CRM demo agendas list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list demo agendas' },
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

    if (action === 'update') {
      result = await updateAgendaVersion(prisma, {
        admin,
        agendaId: body.agendaId || body.id,
        patch: body.patch || body,
      });
    } else if (action === 'request-approval') {
      result = await requestAgendaApproval(prisma, {
        admin,
        agendaId: body.agendaId || body.id,
      });
    } else if (action === 'approve') {
      result = await approveAgendaVersion(prisma, {
        admin,
        agendaId: body.agendaId || body.id,
      });
    } else {
      result = await createAgendaVersion(prisma, {
        admin,
        code: body.code,
        name: body.name,
        itemsJson: body.itemsJson,
        customerSafeSummary: body.customerSafeSummary,
        version: body.version,
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
        { success: false, error: result.error || 'Failed agenda action' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo agendas action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed demo agenda action' },
      { status: 500 }
    );
  }
}

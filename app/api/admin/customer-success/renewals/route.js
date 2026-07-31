import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  listRenewalWorkspaces,
  openRenewalWorkspace,
  setRenewalOutcome,
} from '@/lib/admin/customerSuccess';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listRenewalWorkspaces(prisma, {
      admin,
      tenantId: searchParams.get('tenantId') || undefined,
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
    console.error('CS renewals list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list renewal workspaces' },
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
    const action = String(body.action || 'open').toLowerCase();

    let result;
    if (action === 'outcome' || action === 'set_outcome') {
      result = await setRenewalOutcome(prisma, {
        admin,
        workspaceId: body.workspaceId || body.id,
        outcome: body.outcome,
        evidenceNote: body.evidenceNote,
        notes: body.notes,
      });
    } else {
      result = await openRenewalWorkspace(prisma, {
        admin,
        tenantId: body.tenantId,
        periodKey: body.periodKey,
        notes: body.notes,
      });
    }

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json({ success: false, error: 'Workspace not found' }, { status: 404 });
    }
    if (!result.ok) {
      const status = result.evidenceMissing ? 422 : result.status === 'UNAVAILABLE' ? 503 : 400;
      return NextResponse.json(
        {
          success: false,
          error: result.error || result.reason || 'Renewal action failed',
          ...result,
        },
        { status }
      );
    }

    return NextResponse.json(
      { success: true, ...result },
      { status: result.created ? 201 : 200 }
    );
  } catch (error) {
    console.error('CS renewals action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process renewal workspace' },
      { status: 500 }
    );
  }
}

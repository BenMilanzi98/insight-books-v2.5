import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  approveContentVersion,
  createContentVersion,
  listContentVersions,
  requestContentApproval,
  updateContentVersion,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listContentVersions(prisma, {
      admin,
      code: searchParams.get('code') || undefined,
      status: searchParams.get('status') || undefined,
      kind: searchParams.get('kind') || undefined,
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
    console.error('CRM demo content list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list demo content' },
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
      result = await updateContentVersion(prisma, {
        admin,
        contentId: body.contentId || body.id,
        patch: body.patch || body,
      });
    } else if (action === 'request-approval') {
      result = await requestContentApproval(prisma, {
        admin,
        contentId: body.contentId || body.id,
      });
    } else if (action === 'approve') {
      result = await approveContentVersion(prisma, {
        admin,
        contentId: body.contentId || body.id,
      });
    } else {
      result = await createContentVersion(prisma, {
        admin,
        code: body.code,
        name: body.name,
        kind: body.kind,
        classification: body.classification,
        assetRef: body.assetRef,
        bodyJson: body.bodyJson,
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
        { success: false, error: result.error || 'Failed content action' },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM demo content action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed demo content action' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listMergeRequests, requestMerge } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listMergeRequests(prisma, {
      admin,
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
    console.error('CRM merge list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list merge requests' },
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
    const result = await requestMerge(prisma, {
      admin,
      entityType: body.entityType || 'LEAD',
      survivorId: body.survivorId,
      loserId: body.loserId,
      reason: body.reason,
      duplicateCandidateId: body.duplicateCandidateId,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }
    if (result.notFound) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Entity not found',
        },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to request merge', ...result },
        { status: result.status === 'UNAVAILABLE' || result.status === 'NOT_AVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json(
      { success: true, mergeRequest: result.mergeRequest },
      { status: 201 }
    );
  } catch (error) {
    console.error('CRM merge request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to request CRM merge' },
      { status: 500 }
    );
  }
}

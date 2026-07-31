import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import { listDuplicateCandidates, reviewDuplicateCandidate } from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listDuplicateCandidates(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      leadId: searchParams.get('leadId') || undefined,
      limit: searchParams.get('limit') || '50',
      offset: searchParams.get('offset') || undefined,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM duplicates list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list duplicate candidates' },
      { status: 500 }
    );
  }
}

/** POST — review a duplicate candidate (no merge). */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await reviewDuplicateCandidate(prisma, {
      admin,
      id: body.id || body.candidateId,
      status: body.status,
      reason: body.reason || body.decisionReason,
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges', reason: result.reason },
        { status: 403 }
      );
    }

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'not_found' },
        { status: 404 }
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'review_failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM duplicate review error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to review duplicate candidate' },
      { status: 500 }
    );
  }
}

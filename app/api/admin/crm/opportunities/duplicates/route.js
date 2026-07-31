import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  detectOpportunityDuplicateCandidates,
  listOpportunityDuplicateCandidates,
  reviewOpportunityDuplicateCandidate,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = await listOpportunityDuplicateCandidates(prisma, {
      admin,
      status: searchParams.get('status') || undefined,
      opportunityId: searchParams.get('opportunityId') || undefined,
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
    console.error('CRM opportunity duplicates list error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to list opportunity duplicates' },
      { status: 500 }
    );
  }
}

/** POST — detect (opportunityId) or review (id + status + reason). Never merges. */
export async function POST(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body.action || 'detect').trim().toLowerCase();

    if (action === 'review') {
      const result = await reviewOpportunityDuplicateCandidate(prisma, {
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
    }

    const result = await detectOpportunityDuplicateCandidates(prisma, {
      admin,
      opportunityId: body.opportunityId,
    });

    if (result.notFound) {
      return NextResponse.json(
        { success: false, error: result.error || 'not_found' },
        { status: 404 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'detect_failed', ...result },
        { status: result.status === 'UNAVAILABLE' ? 503 : 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM opportunity duplicates post error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process opportunity duplicates' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  evaluateNextAction,
  listNoNextActionOpportunities,
} from '@/lib/admin/crm';

export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('mode') || 'evaluate';

    if (mode === 'no-next-action-opportunities') {
      const result = await listNoNextActionOpportunities(prisma, {
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
    }

    const result = await evaluateNextAction(prisma, {
      admin,
      subjectType: searchParams.get('subjectType') || 'OPPORTUNITY',
      subjectId:
        searchParams.get('subjectId') ||
        searchParams.get('opportunityId') ||
        searchParams.get('leadId'),
    });

    if (result.forbidden) {
      return NextResponse.json(
        { success: false, error: 'Insufficient admin privileges' },
        { status: 403 }
      );
    }
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to evaluate next action' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('CRM next-action error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to evaluate CRM next action' },
      { status: 500 }
    );
  }
}

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { reverseCapitalContribution } from '@/lib/capitalContributionReversal.js';

export async function POST(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { reference, journalId, reason } = body;

    const result = await reverseCapitalContribution({
      tenantId: user.tenantId,
      userId: user.id,
      reference: reference || undefined,
      journalId: journalId || undefined,
      reason,
    });

    return NextResponse.json({
      message: 'Capital contribution reversed successfully',
      ...result,
    });
  } catch (error) {
    const status = error.statusCode || 500;
    return NextResponse.json(
      { error: error.message || 'Failed to reverse capital contribution' },
      { status }
    );
  }
}

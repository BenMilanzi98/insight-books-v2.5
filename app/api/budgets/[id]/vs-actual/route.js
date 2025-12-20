// app/api/budgets/[id]/vs-actual/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getBudgetVsActual } from '@/lib/budgetService';

// GET - Get budget vs actual comparison
export async function GET(request, { params }) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const asOfDate = searchParams.get('asOfDate');

    const comparison = await getBudgetVsActual(params.id, user.tenantId, asOfDate);

    return NextResponse.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('Error getting budget vs actual:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get budget vs actual comparison' },
      { status: 500 }
    );
  }
}











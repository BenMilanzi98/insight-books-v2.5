// app/api/budgets/[id]/approve/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { approveBudget } from '@/lib/budgetService';

// POST - Approve budget
export async function POST(request, { params }) {
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

    const budget = await approveBudget(params.id, user.tenantId, user.id);

    return NextResponse.json({
      success: true,
      message: 'Budget approved successfully',
      data: budget
    });
  } catch (error) {
    console.error('Error approving budget:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve budget' },
      { status: 500 }
    );
  }
}











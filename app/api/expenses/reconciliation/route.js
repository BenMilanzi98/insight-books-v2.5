import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { GL_POSTED_STATUSES } from '@/lib/expenseGlPosting';

/**
 * GET — Audit: approved expense sub-ledger vs expense-sourced GL postings (orphans).
 */
export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const baseWhere = {
      tenantId: user.tenantId,
      isDeleted: false,
      status: 'Approved'
    };
    if (user.currentBranchId) {
      baseWhere.branchId = user.currentBranchId;
    }

    const [sumAgg, approvedCount, approvedRows, glLinks] = await Promise.all([
      prisma.expense.aggregate({
        where: baseWhere,
        _sum: { amount: true }
      }),
      prisma.expense.count({ where: baseWhere }),
      prisma.expense.findMany({
        where: baseWhere,
        select: {
          id: true,
          amount: true,
          description: true,
          branchId: true,
          paymentStatus: true,
          expenseAccountId: true
        }
      }),
      prisma.transaction.findMany({
        where: {
          tenantId: user.tenantId,
          sourceType: 'Expense',
          status: GL_POSTED_STATUSES,
          isReversal: false,
          sourceId: { not: null },
          ...(user.currentBranchId ? { branchId: user.currentBranchId } : {})
        },
        select: { sourceId: true }
      })
    ]);

    const postedExpenseIds = new Set(
      glLinks.map((t) => t.sourceId).filter(Boolean)
    );

    const approvedWithoutGl = approvedRows.filter((e) => !postedExpenseIds.has(e.id));
    const approvedWithoutGlSum = approvedWithoutGl.reduce(
      (s, e) => s + (Number(e.amount) || 0),
      0
    );

    return NextResponse.json({
      scope: {
        tenantId: user.tenantId,
        branchId: user.currentBranchId || null,
        description:
          'Approved Expense rows in this branch (if any) compared to posted Transaction rows with sourceType Expense.'
      },
      subledger: {
        approvedExpenseCount: approvedCount,
        approvedExpenseSum: Number(sumAgg._sum?.amount || 0)
      },
      glExpenseSource: {
        distinctPostedExpenseIds: postedExpenseIds.size
      },
      exceptions: {
        approvedCountWithoutPostedGl: approvedWithoutGl.length,
        approvedAmountWithoutPostedGl: approvedWithoutGlSum,
        sampleApprovedWithoutGl: approvedWithoutGl.slice(0, 50).map((e) => ({
          id: e.id,
          amount: e.amount,
          description: e.description,
          paymentStatus: e.paymentStatus,
          branchId: e.branchId
        }))
      }
    });
  } catch (error) {
    console.error('Expense reconciliation:', error);
    return NextResponse.json(
      { error: 'Failed to build reconciliation summary.' },
      { status: 500 }
    );
  }
}

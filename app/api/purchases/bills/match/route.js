import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { matchSupplierBill } from '@/lib/purchases/threeWayMatching';

/**
 * POST /api/purchases/bills/match
 * Body: { billId }
 * Evaluates three-way match and persists matchingStatus.
 */
export async function POST(request) {
  try {
    const perm = await requirePermission(request, 'purchases.view');
    if (perm) return perm;

    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.billId) {
      return NextResponse.json({ error: 'billId is required' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const match = await matchSupplierBill(tx, {
        tenantId: user.tenantId,
        billId: body.billId,
        requireReceiptForInventory: true,
      });

      await tx.supplierBill.update({
        where: { id: body.billId },
        data: { matchingStatus: match.matchingStatus },
      });

      if (Array.isArray(match.lineResults)) {
        for (const line of match.lineResults) {
          if (line.billLineNumber == null) continue;
          await tx.supplierBillItem.updateMany({
            where: { billId: body.billId, lineNumber: line.billLineNumber },
            data: { matchStatus: line.status },
          });
        }
      }

      return match;
    });

    return NextResponse.json({ match: result });
  } catch (error) {
    console.error('Bill match error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to match bill' },
      { status: 500 }
    );
  }
}

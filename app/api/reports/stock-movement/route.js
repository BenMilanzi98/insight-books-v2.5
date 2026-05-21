// app/api/reports/stock-movement/route.js
/**
 * Stock Movement Report API
 * Uses lib/stockMovementService – Direct Method: opening from pre-period sum,
 * Qty In = goods_receipt + sales_return, Qty Out = sales + purchase_return,
 * running balance, numeric qty (never "-").
 */
import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { generateStockMovementReport } from '@/lib/stockMovementService';

export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required or no tenant associated' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const productId = searchParams.get('productId') || null;

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: 'Start date and end date are required' },
        { status: 400 }
      );
    }

    // Normalize branchId to string (session may store object { id: '...' })
    let branchId = user.currentBranchId ?? null;
    if (branchId && typeof branchId !== 'string') {
      branchId = branchId?.id && typeof branchId.id === 'string' ? branchId.id : null;
    }

    const report = await generateStockMovementReport(
      user.tenantId,
      startDate,
      endDate,
      productId,
      branchId
    );

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating stock movement report:', error);
    const message =
      process.env.NODE_ENV === 'development'
        ? error?.message || String(error)
        : 'Failed to generate stock movement report. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

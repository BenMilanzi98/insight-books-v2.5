// app/api/sales/[id]/refund/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { refundSale } from '@/lib/sales/refundSale';

export async function POST(request, { params }) {
  try {
    const { id: saleId } = await params;

    // Get user from session
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const perm = await requirePermission(request, 'sales.refund');
    if (perm) return perm;

    const body = await request.json();

    const result = await refundSale({ user, saleId, body });

    return NextResponse.json({
      success: true,
      sale: result,
      message: `Sale ${result.saleNumber} has been refunded successfully`
    });

  } catch (error) {
    if (error?.name === 'ServiceHttpError') {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('Error refunding sale:', error);
    
    // Handle specific error types
    if (error.message.includes('not found')) {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    if (error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }
    
    if (error.message.includes('Only completed sales')) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to refund sale' },
      { status: 500 }
    );
  }
}

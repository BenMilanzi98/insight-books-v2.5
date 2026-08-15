// app/api/sales/[id]/void/route.js
import { NextResponse } from 'next/server';
import { getUserFromSession, requirePermission } from '@/lib/auth';
import { voidSale } from '@/lib/sales/voidSale';

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

    const perm = await requirePermission(request, 'sales.void');
    if (perm) return perm;

    const { reason } = await request.json();

    const result = await voidSale({ user, saleId, reason });

    return NextResponse.json({
      success: true,
      sale: result,
      message: `Sale ${result.saleNumber} has been voided successfully`
    });

  } catch (error) {
    if (error?.name === 'ServiceHttpError') {
      return NextResponse.json(error.body, { status: error.status });
    }

    console.error('Error voiding sale:', error);
    
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
      { error: error.message || 'Failed to void sale' },
      { status: 500 }
    );
  }
}

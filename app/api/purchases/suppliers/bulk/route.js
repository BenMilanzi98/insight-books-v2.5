// app/api/purchases/suppliers/bulk/route.js
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';

/**
 * PUT /api/purchases/suppliers/bulk
 * Bulk update suppliers (activate/deactivate)
 */
export async function PUT(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { ids, updates } = body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Supplier IDs are required' },
        { status: 400 }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return NextResponse.json(
        { error: 'Updates object is required' },
        { status: 400 }
      );
    }

    // Update all suppliers in bulk
    const result = await prisma.supplier.updateMany({
      where: {
        id: { in: ids },
        tenantId: user.tenantId
      },
      data: {
        ...updates,
        modifiedById: user.id
      }
    });

    return NextResponse.json({
      success: true,
      count: result.count,
      message: `Updated ${result.count} supplier${result.count !== 1 ? 's' : ''}`
    });
  } catch (error) {
    console.error('Error bulk updating suppliers:', error);
    return NextResponse.json(
      { error: 'Failed to update suppliers. Please try again.' },
      { status: 500 }
    );
  }
}


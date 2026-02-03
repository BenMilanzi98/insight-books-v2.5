// app/api/suppliers/[id]/summary/route.js
/**
 * Supplier Financial Summary API Route
 * Returns detailed financial information for a supplier
 */

import { NextResponse } from 'next/server';
import { getSupplierFinancialSummary } from '@/lib/supplierService';

/**
 * GET /api/suppliers/[id]/summary
 * Get supplier financial summary including balance, aging, and pending bills
 */
export async function GET(request, { params }) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    const { id } = params;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const summary = await getSupplierFinancialSummary(id, tenantId);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error fetching supplier summary:', error);
    
    if (error.message === 'Supplier not found') {
      return NextResponse.json(
        { error: error.message },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: error.message || 'Failed to fetch supplier summary' },
      { status: 500 }
    );
  }
}

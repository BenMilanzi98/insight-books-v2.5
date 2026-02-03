// app/api/suppliers/reports/top-spending/route.js
/**
 * Supplier Top Spending Report API Route
 * Returns top suppliers by spending
 */

import { NextResponse } from 'next/server';
import { getTopSuppliersBySpending } from '@/lib/supplierService';

/**
 * GET /api/suppliers/reports/top-spending
 * Get top suppliers by spending for a period
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');
    
    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      );
    }

    const options = {
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      limit: parseInt(searchParams.get('limit')) || 10
    };

    const report = await getTopSuppliersBySpending(tenantId, options);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating top spending report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate top spending report' },
      { status: 500 }
    );
  }
}

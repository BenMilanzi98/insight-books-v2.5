// app/api/suppliers/reports/aging/route.js
/**
 * Supplier Aging Report API Route
 * Returns accounts payable aging analysis across all suppliers
 */

import { NextResponse } from 'next/server';
import { getSuppliersAgingReport } from '@/lib/supplierService';

/**
 * GET /api/suppliers/reports/aging
 * Get accounts payable aging report for all suppliers
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
      asOfDate: searchParams.get('asOfDate') || new Date(),
      includeDetails: searchParams.get('includeDetails') === 'true'
    };

    const report = await getSuppliersAgingReport(tenantId, options);

    return NextResponse.json(report);
  } catch (error) {
    console.error('Error generating aging report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate aging report' },
      { status: 500 }
    );
  }
}

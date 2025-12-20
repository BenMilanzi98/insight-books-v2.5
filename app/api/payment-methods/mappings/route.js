// app/api/payment-methods/mappings/route.js
// API endpoint to view and verify payment method to account mappings

import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { getPaymentMethodMappings, verifyPaymentMethodMappings } from '@/lib/paymentMethodAccountMapping';

// GET - Get payment method mappings for current tenant
export async function GET(request) {
  try {
    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const verify = searchParams.get('verify') === 'true';

    if (verify) {
      // Return verification results
      const verification = await verifyPaymentMethodMappings(user.tenantId);
      return NextResponse.json({
        success: true,
        data: verification
      });
    } else {
      // Return mappings
      const mappings = await getPaymentMethodMappings(user.tenantId);
      return NextResponse.json({
        success: true,
        data: {
          mappings,
          totalMethods: mappings.length,
          configuredMethods: mappings.filter(m => m.isConfigured).length,
          missingMethods: mappings.filter(m => !m.isConfigured).length
        }
      });
    }
  } catch (error) {
    console.error('Error getting payment method mappings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get payment method mappings' },
      { status: 500 }
    );
  }
}











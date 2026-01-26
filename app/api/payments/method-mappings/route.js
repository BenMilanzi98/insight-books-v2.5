import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { requireStandardAccess } from '@/lib/accessControl';
import { getPaymentMethodMappings } from '@/lib/paymentMethodAccountMapping';

export async function GET(request) {
  try {
    const accessError = await requireStandardAccess(request);
    if (accessError) return accessError;

    const user = await getUserFromSession(request);
    if (!user || !user.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const mappings = await getPaymentMethodMappings(user.tenantId);
    return NextResponse.json({ success: true, mappings });
  } catch (error) {
    console.error('Error fetching payment method mappings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch payment method mappings' },
      { status: 500 }
    );
  }
}







import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import { requirePremiumAccess } from '@/lib/accessControl';

export async function POST(request) {
  try {
    const body = await request.json();
    const { name } = body;
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const user = await getUserFromSession(request);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Require active paid subscription to create a new business
    const accessError = await requirePremiumAccess(request);
    if (accessError) {
      return NextResponse.json(
        { 
          error: 'Active subscription required to create a new business. Please subscribe first.',
          code: 'SUBSCRIPTION_REQUIRED'
        },
        { status: 403 }
      );
    }

    // Create the tenant (current user is the main tenant / owner)
    const tenant = await prisma.tenant.create({
      data: {
        name,
        subdomain: `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
        // Set subscription based on the selected plan
        subscriptionPlan: body.selectedPlan === '1year' ? '1year' : 
                         body.selectedPlan === '3months' ? '3months' : 
                         body.selectedPlan === '1month' ? '1month' : '1month',
        status: 'active',
        ownerUserId: user.id,
      }
    });

    // Then connect the user to the tenant via the many-to-many relationship
    await prisma.user.update({
      where: { id: user.id },
      data: {
        tenants: {
          connect: { id: tenant.id }
        }
      }
    });

    // Initialize default payment accounts
    const { initializeDefaultPaymentAccounts } = await import('@/lib/paymentAccountInitialization');
    await initializeDefaultPaymentAccounts(tenant.id);

    return NextResponse.json({ success: true, tenant });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

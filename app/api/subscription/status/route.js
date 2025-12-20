import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getTenantSubscription, getRemainingTrialDays, isTenantTrialActive } from '@/lib/subscriptionService';

export async function GET() {
  try {
    // Get session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
   
    if (!sessionCookie) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }
   
    try {
      // Parse session data
      const sessionData = JSON.parse(Buffer.from(sessionCookie.value, 'base64').toString());
     
      if (!sessionData.userId) {
        throw new Error('Invalid session');
      }
     
      // Get user data from database
      const user = await prisma.user.findUnique({
        where: { id: sessionData.userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          tenantId: true,
          isActive: true,
          tenant: {
            select: {
              id: true,
              name: true,
              subdomain: true,
              status: true,
              subscriptionPlan: true
            }
          }
        }
      });
     
      if (!user) {
        throw new Error('User not found');
      }

      // Get subscription details using subscription service
      const currentSubscription = await getTenantSubscription(user.tenantId);
      const isTrialActive = await isTenantTrialActive(user.tenantId);
      const remainingTrialDays = await getRemainingTrialDays(user.tenantId);

      // Get subscription details (for backward compatibility)
      const subscription = await prisma.accountSubscription.findFirst({
        where: {
          tenantId: user.tenantId,
          isActive: true
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Get payment history for this tenant
      const paymentHistory = await prisma.accountSubscription.findMany({
        where: {
          tenantId: user.tenantId
        },
        orderBy: {
          createdAt: 'desc'
        },
        select: {
          id: true,
          txRef: true,
          amount: true,
          currency: true,
          status: true,
          paymentDate: true,
          createdAt: true,
          plan: true
        }
      });

      // Check subscription status
      let subscriptionStatus = {
        hasActiveSubscription: false,
        isActive: false,
        plan: 'FREE',
        status: 'inactive',
        startedAt: null,
        expiresAt: null,
        trialEndDate: null,
        isExpired: false,
        daysRemaining: 0
      };

      if (currentSubscription) {
        const now = new Date();
        const expiresAt = currentSubscription.isTrial ? currentSubscription.trialEndDate : currentSubscription.expiresAt;
        const isExpired = expiresAt ? now > expiresAt : false;
        const daysRemaining = expiresAt ? Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24)) : 0;

        subscriptionStatus = {
          hasActiveSubscription: currentSubscription.isActive && !isExpired,
          isActive: currentSubscription.isActive && !isExpired,
          plan: currentSubscription.plan || 'TRIAL',
          status: currentSubscription.status || 'active',
          startedAt: currentSubscription.startedAt ?? null,
          expiresAt: currentSubscription.isTrial ? null : (currentSubscription.expiresAt ?? null),
          trialEndDate: currentSubscription.isTrial ? (currentSubscription.trialEndDate ?? null) : null,
          isTrial: currentSubscription.isTrial || false,
          isExpired: isExpired,
          daysRemaining: Math.max(0, daysRemaining),
          amount: currentSubscription.amount,
          currency: currentSubscription.currency
        };
      }

      return NextResponse.json({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
          tenant: user.tenant
        },
        subscription: subscriptionStatus,
        paymentHistory: paymentHistory || [],
        subscriptionStatus: subscriptionStatus,
        remainingTrialDays: remainingTrialDays || 0,
        isTrialActive: isTrialActive || false
      });
     
    } catch (error) {
      console.error('Error parsing session:', error);
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription status' },
      { status: 500 }
    );
  }
}
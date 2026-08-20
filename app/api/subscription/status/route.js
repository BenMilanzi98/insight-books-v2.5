import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { getTenantSubscription, getRemainingTrialDays, isTenantTrialActive } from '@/lib/subscriptionService';
import { parseSessionPayload } from '@/lib/sessionCookie';

export async function GET() {
  try {
    // Get session cookie
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');
   
    if (!sessionCookie) {
      // Return a valid response with default values instead of 401
      // This allows the subscription page to load and show appropriate message
      return NextResponse.json({
        user: null,
        subscription: {
          hasActiveSubscription: false,
          isActive: false,
          plan: 'FREE',
          status: 'inactive',
          startedAt: null,
          expiresAt: null,
          trialEndDate: null,
          isExpired: false,
          daysRemaining: 0,
          isTrial: false,
          amount: 0,
          currency: 'MWK'
        },
        paymentHistory: [],
        subscriptionStatus: {
          hasActiveSubscription: false,
          isActive: false,
          plan: 'FREE',
          status: 'inactive',
          startedAt: null,
          expiresAt: null,
          trialEndDate: null,
          isExpired: false,
          daysRemaining: 0
        },
        remainingTrialDays: 0,
        isTrialActive: false,
        error: 'Not authenticated. Please log in.'
      }, { status: 200 }); // Return 200 with error message instead of 401
    }
   
    try {
      // Supports v2 signed sessions and legacy base64 payloads
      const sessionData = parseSessionPayload(sessionCookie.value);
     
      if (!sessionData?.userId) {
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
      // Wrap in try-catch to handle any errors gracefully
      let currentSubscription = null;
      let isTrialActive = false;
      let remainingTrialDays = 0;
      
      try {
        currentSubscription = await getTenantSubscription(user.tenantId);
        isTrialActive = await isTenantTrialActive(user.tenantId);
        remainingTrialDays = await getRemainingTrialDays(user.tenantId);
      } catch (subscriptionError) {
        console.error('Error fetching subscription details:', subscriptionError);
        // Continue with default values if subscription service fails
      }

      // Get subscription details (for backward compatibility)
      let subscription = null;
      try {
        subscription = await prisma.accountSubscription.findFirst({
          where: {
            tenantId: user.tenantId,
            isActive: true
          },
          orderBy: {
            createdAt: 'desc'
          }
        });
      } catch (dbError) {
        console.error('Error fetching subscription from database:', dbError);
        // Continue with null subscription
      }

      // Get payment history for this tenant
      let paymentHistory = [];
      try {
        paymentHistory = await prisma.accountSubscription.findMany({
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
      } catch (historyError) {
        console.error('Error fetching payment history:', historyError);
        // Continue with empty array
      }

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
        daysRemaining: 0,
        isTrial: false,
        amount: 0,
        currency: 'MWK'
      };

      if (currentSubscription) {
        try {
          const now = new Date();
          const expiresAt = currentSubscription.isTrial 
            ? (currentSubscription.trialEndDate ? new Date(currentSubscription.trialEndDate) : null)
            : (currentSubscription.expiresAt ? new Date(currentSubscription.expiresAt) : null);
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
            amount: currentSubscription.amount || 0,
            currency: currentSubscription.currency || 'MWK'
          };
        } catch (statusError) {
          console.error('Error calculating subscription status:', statusError);
          // Use default status if calculation fails
        }
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
      console.error('Error parsing session or fetching data:', error);
      // Return a valid response with default values instead of 401
      // This allows the subscription page to load and show appropriate message
      return NextResponse.json({
        user: null,
        subscription: {
          hasActiveSubscription: false,
          isActive: false,
          plan: 'FREE',
          status: 'inactive',
          startedAt: null,
          expiresAt: null,
          trialEndDate: null,
          isExpired: false,
          daysRemaining: 0,
          isTrial: false,
          amount: 0,
          currency: 'MWK'
        },
        paymentHistory: [],
        subscriptionStatus: {
          hasActiveSubscription: false,
          isActive: false,
          plan: 'FREE',
          status: 'inactive',
          startedAt: null,
          expiresAt: null,
          trialEndDate: null,
          isExpired: false,
          daysRemaining: 0
        },
        remainingTrialDays: 0,
        isTrialActive: false,
        error: 'Session expired or invalid. Please log in again.'
      }, { status: 200 }); // Return 200 with error message instead of 401
    }
  } catch (error) {
    console.error('Error fetching subscription status:', error);
    // Return a valid response with default values instead of 500 error
    // This prevents redirect loops and allows the page to load
    return NextResponse.json({
      user: null,
      subscription: {
        hasActiveSubscription: false,
        isActive: false,
        plan: 'FREE',
        status: 'inactive',
        startedAt: null,
        expiresAt: null,
        trialEndDate: null,
        isExpired: false,
        daysRemaining: 0,
        isTrial: false,
        amount: 0,
        currency: 'MWK'
      },
      paymentHistory: [],
      subscriptionStatus: {
        hasActiveSubscription: false,
        isActive: false,
        plan: 'FREE',
        status: 'inactive',
        startedAt: null,
        expiresAt: null,
        trialEndDate: null,
        isExpired: false,
        daysRemaining: 0
      },
      remainingTrialDays: 0,
      isTrialActive: false,
      error: 'Failed to fetch subscription status. Please try again.'
    }, { status: 200 }); // Return 200 with error message instead of 500
  }
}
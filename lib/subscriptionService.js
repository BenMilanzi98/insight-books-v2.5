import prisma from '@/lib/prisma';

import { TRIAL_DURATION_DAYS, calculateSubscriptionExpiry } from './subscriptionConfig';

/**
 * Trial period duration in days
 */

/**
 * Calculate trial end date from start date
 */
export function calculateTrialEndDate(startDate = new Date()) {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + TRIAL_DURATION_DAYS);
  return endDate;
}

/**
 * Get tenant's current subscription (trial or paid)
 */
export async function getTenantSubscription(tenantId) {
  // First, check for active paid subscription
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: new Date() },
      isTrial: false
    },
    orderBy: { expiresAt: 'desc' }
  });
  
  // If there's an active paid subscription, return it
  if (activePaidSubscription) {
    return activePaidSubscription;
  }
  
  // If no active paid subscription, check for active trial
  const activeTrial = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: true,
      trialEndDate: { gt: new Date() }
    },
    orderBy: { trialEndDate: 'desc' }
  });
  
  return activeTrial;
}

/**
 * Check if tenant has an active trial
 */
export async function isTenantTrialActive(tenantId) {
  // First check if there's an active paid subscription
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: new Date() },
      isTrial: false
    }
  });
  
  // If there's an active paid subscription, trial is not active
  if (activePaidSubscription) {
    return false;
  }
  
  // Check for active trial only if no paid subscription
  const subscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: true,
      trialEndDate: { gt: new Date() }
    }
  });
  
  return !!subscription;
}

/**
 * Get remaining trial days for a tenant
 */
export async function getRemainingTrialDays(tenantId) {
  // First check if there's an active paid subscription
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: new Date() },
      isTrial: false
    }
  });
  
  // If there's an active paid subscription, trial days are 0
  if (activePaidSubscription) {
    return 0;
  }
  
  // Check for active trial only if no paid subscription
  const subscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: true,
      trialEndDate: { gt: new Date() }
    }
  });
  
  if (!subscription || !subscription.trialEndDate) {
    return 0;
  }
  
  const now = new Date();
  const trialEnd = new Date(subscription.trialEndDate);
  
  if (now >= trialEnd) {
    return 0;
  }
  
  const timeDiff = trialEnd.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
  
  return Math.max(0, daysDiff);
}

/**
 * Get trial countdown message
 */
export async function getTrialCountdownMessage(tenantId) {
  // First check if there's an active paid subscription
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: new Date() },
      isTrial: false
    }
  });
  
  // If there's an active paid subscription, return subscription message
  if (activePaidSubscription) {
    return "Active subscription";
  }
  
  const remainingDays = await getRemainingTrialDays(tenantId);
  
  if (remainingDays === 0) {
    return "Your free trial has ended";
  } else if (remainingDays === 1) {
    return "1 day remaining";
  } else {
    return `${remainingDays} days remaining`;
  }
}

/**
 * Check if tenant has access to premium features
 */
export async function hasPremiumAccess(tenantId) {
  // Premium access requires an active PAID subscription (not trial).
  // Trust the isTrial field - if isTrial is false and subscription is active, consider it paid.
  const now = new Date();
  const subscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      isTrial: false,
      expiresAt: { gt: now }
    }
  });

  return Boolean(subscription);
}

/**
 * Check if tenant has access to standard features
 * Never throws: on DB/schema errors returns true in dev (allow) or false in prod (deny).
 */
export async function hasStandardAccess(tenantId) {
  try {
    return await hasStandardAccessImpl(tenantId);
  } catch (error) {
    console.error('hasStandardAccess error:', error?.message || error);
    if (process.env.NODE_ENV === 'development') {
      return true;
    }
    return false;
  }
}

async function hasStandardAccessImpl(tenantId) {
  // Check if there's an active paid subscription
  // Trust the isTrial field - if isTrial is false and subscription is active, consider it paid
  const now = new Date();
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: now },
      isTrial: false
    }
  });
  
  // If there's an active paid subscription, grant access
  if (activePaidSubscription) {
    return true;
  }
  
  // Check for active trial that hasn't expired
  let activeTrial = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: true,
      isActive: true,
      trialEndDate: { gt: now }
    }
  });
  
  // If no active trial, check if there are expired trials and deactivate them
  if (!activeTrial) {
    const expiredTrials = await prisma.accountSubscription.findMany({
      where: {
        tenantId,
        isTrial: true,
        isActive: true,
        trialEndDate: { lte: now }
      }
    });
    
    // Deactivate expired trials
    if (expiredTrials.length > 0) {
      await prisma.accountSubscription.updateMany({
        where: {
          tenantId,
          isTrial: true,
          isActive: true,
        trialEndDate: { lte: now }
        },
        data: {
          isActive: false,
          status: 'Expired'
        }
      });
    }
    
    // If no active trial exists at all, automatically initialize one
    const anyTrial = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        isTrial: true
      }
    });
    
    if (!anyTrial) {
      // Auto-initialize trial for tenant
      try {
        activeTrial = await initializeTenantTrial(tenantId);
      } catch (error) {
        console.error('Error initializing trial:', error);
        // If initialization fails, still allow access in development
        // In production, you might want to return false here
        if (process.env.NODE_ENV === 'development') {
          return true;
        }
      }
    }
  }
  
  return !!activeTrial;
}

/**
 * Initialize trial for a new tenant
 */
export async function initializeTenantTrial(tenantId) {
  const trialStartDate = new Date();
  const trialEndDate = calculateTrialEndDate(trialStartDate);
  
  // Check if tenant already has a trial subscription
  const existingTrial = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: true
    }
  });
  
  if (existingTrial) {
    return existingTrial;
  }
  
  // Create new trial subscription
  const trialSubscription = await prisma.accountSubscription.create({
    data: {
      tenantId,
      plan: 'trial',
      txRef: `TRIAL_${tenantId}_${Date.now()}`,
      amount: 0,
      currency: 'MWK',
      status: 'Active',
      paymentMethod: 'trial',
      isActive: true, // Trial should be active during trial period
      isTrial: true,
      trialStartDate,
      trialEndDate,
      startedAt: trialStartDate,
      paymentDate: trialStartDate,
      notes: '3-day free trial'
    }
  });
  
  return trialSubscription;
}

/**
 * Update tenant subscription status when trial expires
 */
export async function expireTenantTrial(tenantId) {
  await prisma.accountSubscription.updateMany({
    where: {
      tenantId,
      isTrial: true,
      trialEndDate: { lte: new Date() }
    },
    data: {
      status: 'Expired'
    }
  });
}

/**
 * Upgrade tenant to paid subscription
 */
export async function upgradeTenantSubscription(tenantId, plan, amount, currency = 'MWK') {
  // End any existing trial
  await prisma.accountSubscription.updateMany({
    where: {
      tenantId,
      isTrial: true
    },
    data: {
      status: 'Expired'
    }
  });
  
  const startDate = new Date();
  // Calculate expiry date based on plan
  const expiresAt = calculateSubscriptionExpiry(plan, startDate);
  
  // Create new paid subscription
  const paidSubscription = await prisma.accountSubscription.create({
    data: {
      tenantId,
      plan,
      txRef: `PAID_${tenantId}_${Date.now()}`,
      amount,
      currency,
      status: 'Completed',
      paymentMethod: 'paychangu',
      isActive: true,
      isTrial: false,
      startedAt: startDate,
      expiresAt: expiresAt,
      paymentDate: startDate,
      notes: `Upgraded to ${plan} plan`
    }
  });
  
  return paidSubscription;
}

/**
 * Get tenant with subscription details
 */
export async function getTenantWithSubscription(tenantId) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      accountSubscriptions: {
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  
  if (!tenant) return null;
  
  const now = new Date();
  // Trust the isTrial field - if isTrial is false and subscription is active, consider it paid
  const isPaidActive = (sub) =>
    sub &&
    sub.isActive === true &&
    sub.isTrial === false &&
    sub.expiresAt instanceof Date &&
    sub.expiresAt > now;

  // First, check if there's an active paid subscription
  const activePaidSubscription = tenant.accountSubscriptions.find(isPaidActive);
  
  // If there's an active paid subscription, use it and ignore trials
  if (activePaidSubscription) {
    return {
      tenant,
      subscription: activePaidSubscription,
      isTrialActive: false, // Trial is hidden when paid subscription is active
      hasPremiumAccess: true,
      remainingTrialDays: 0
    };
  }
  
  // If no active paid subscription, check for active trial
  const activeTrial = tenant.accountSubscriptions.find(
    (sub) => sub?.isTrial === true && sub?.trialEndDate instanceof Date && sub.trialEndDate > now
  );
  
  // Calculate trial status
  const isTrialActive = !!activeTrial;
  const remainingTrialDays = activeTrial ? await getRemainingTrialDays(tenantId) : 0;
  
  // Use the active trial as current subscription if no paid subscription
  const currentSubscription = activeTrial || tenant.accountSubscriptions[0] || null;
  
  return {
    tenant,
    subscription: currentSubscription,
    isTrialActive,
    hasPremiumAccess: false, // No premium access during trial
    remainingTrialDays
  };
}

/**
 * Check and expire trials for all tenants (to be run as a cron job)
 */
export async function checkAndExpireTrials() {
  const now = new Date();
  
  const expiredTrials = await prisma.accountSubscription.findMany({
    where: {
      isTrial: true,
      trialEndDate: {
        lte: now
      },
      status: {
        not: 'Expired'
      }
    }
  });
  
  for (const trial of expiredTrials) {
    await expireTenantTrial(trial.tenantId);
  }
  
  return expiredTrials.length;
}

/**
 * Compute subscription status from an array of accountSubscriptions (no DB call).
 * Used by admin tenants list and dashboard to match tenant-management logic.
 * @param {Array<{ isTrial?: boolean, isActive?: boolean, status?: string, trialEndDate?: Date|null, expiresAt?: Date|null }>} accountSubscriptions
 * @param {Date} [now]
 * @returns {'active'|'trial'|'inactive'|'expired'}
 */
export function getSubscriptionStatusFromSubscriptions(accountSubscriptions, now = new Date()) {
  const subs = Array.isArray(accountSubscriptions) ? accountSubscriptions : [];
  const isPaidActive = (s) =>
    s &&
    s.isActive === true &&
    s.isTrial === false &&
    s.expiresAt != null &&
    new Date(s.expiresAt) > now &&
    !['cancelled', 'pending', 'processing', 'Expired'].includes(String(s.status || '').trim());
  const isTrialActive = (s) =>
    s &&
    s.isTrial === true &&
    s.trialEndDate != null &&
    new Date(s.trialEndDate) > now &&
    String(s.status || '') !== 'Expired';
  if (subs.some(isPaidActive)) return 'active';
  if (subs.some(isTrialActive)) return 'trial';
  const hasExpired = subs.some(
    (s) =>
      (s.isTrial && s.trialEndDate != null && new Date(s.trialEndDate) <= now) ||
      (!s.isTrial && s.expiresAt != null && new Date(s.expiresAt) <= now) ||
      String(s.status || '') === 'Expired'
  );
  return hasExpired ? 'expired' : 'inactive';
}

/**
 * Get subscription status for display
 */
export async function getSubscriptionStatus(tenantId) {
  // Check for active paid subscription
  // Trust the isTrial field - if isTrial is false and subscription is active, consider it paid.
  const now = new Date();
  const activePaidSubscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isActive: true,
      expiresAt: { gt: now },
      isTrial: false
    }
  });
  
  // If there's an active paid subscription, return subscription status
  if (activePaidSubscription) {
    return {
      status: 'active',
      message: 'Active subscription',
      canAccessStandard: true,
      canAccessPremium: true,
      remainingDays: 0
    };
  }
  
  // If no active paid subscription, check for trial
  const subscription = await prisma.accountSubscription.findFirst({
    where: {
      tenantId,
      isTrial: true,
      trialEndDate: { gt: now }
    }
  });
  
  if (!subscription) {
    return {
      status: 'none',
      message: 'No active subscription',
      canAccessStandard: false,
      canAccessPremium: false,
      remainingDays: 0
    };
  }
  
  if (subscription.isTrial) {
    const remainingDays = await getRemainingTrialDays(tenantId);
    return {
      status: 'trial',
      message: remainingDays > 0 ? `${remainingDays} days remaining` : 'Trial expired',
      canAccessStandard: remainingDays > 0,
      canAccessPremium: false,
      remainingDays
    };
  }
  
  return {
    status: 'expired',
    message: 'Subscription expired',
    canAccessStandard: false,
    canAccessPremium: false,
    remainingDays: 0
  };
} 
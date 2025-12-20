import { NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth';
import { hasStandardAccess, hasPremiumAccess, getTenantWithSubscription } from '@/lib/subscriptionService';

/**
 * Middleware to check if user has standard access (trial or paid)
 */
export async function requireStandardAccess(request) {
  try {
    const user = await getUserFromSession(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      );
    }

    const hasAccess = await hasStandardAccess(user.tenantId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { 
          error: 'Access denied. Please upgrade your subscription to continue.',
          code: 'SUBSCRIPTION_REQUIRED'
        },
        { status: 403 }
      );
    }

    return null; // Access granted
  } catch (error) {
    console.error('Error in requireStandardAccess:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Middleware to check if user has premium access (paid subscription)
 */
export async function requirePremiumAccess(request) {
  try {
    const user = await getUserFromSession(request);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    if (!user.tenantId) {
      return NextResponse.json(
        { error: 'No tenant associated with user' },
        { status: 400 }
      );
    }

    const hasAccess = await hasPremiumAccess(user.tenantId);
    
    if (!hasAccess) {
      return NextResponse.json(
        { 
          error: 'Premium access required. Please upgrade to access this feature.',
          code: 'PREMIUM_REQUIRED'
        },
        { status: 403 }
      );
    }

    return null; // Access granted
  } catch (error) {
    console.error('Error in requirePremiumAccess:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Get user access level for display purposes
 */
export async function getUserAccessLevel(request) {
  try {
    const user = await getUserFromSession(request);
    
    if (!user) {
      return {
        authenticated: false,
        hasStandardAccess: false,
        hasPremiumAccess: false,
        subscriptionStatus: null
      };
    }

    if (!user.tenantId) {
      return {
        authenticated: true,
        hasStandardAccess: false,
        hasPremiumAccess: false,
        subscriptionStatus: 'no_tenant'
      };
    }

    const tenantData = await getTenantWithSubscription(user.tenantId);
    
    if (!tenantData) {
      return {
        authenticated: true,
        hasStandardAccess: false,
        hasPremiumAccess: false,
        subscriptionStatus: 'no_subscription'
      };
    }

    return {
      authenticated: true,
      hasStandardAccess: tenantData.isTrialActive || tenantData.hasPremiumAccess,
      hasPremiumAccess: tenantData.hasPremiumAccess,
      subscriptionStatus: tenantData.subscription?.isTrial ? 'trial' : 
                         tenantData.subscription?.isActive ? 'active' : 'expired',
      trialActive: tenantData.isTrialActive,
      user: user,
      tenant: tenantData.tenant,
      subscription: tenantData.subscription
    };
  } catch (error) {
    console.error('Error in getUserAccessLevel:', error);
    return {
      authenticated: false,
      hasStandardAccess: false,
      hasPremiumAccess: false,
      subscriptionStatus: null,
      error: error.message
    };
  }
}

/**
 * Wrapper for API routes that require standard access
 */
export function withStandardAccess(handler) {
  return async function(request, ...args) {
    const accessError = await requireStandardAccess(request);
    if (accessError) {
      return accessError;
    }
    return handler(request, ...args);
  };
}

/**
 * Wrapper for API routes that require premium access
 */
export function withPremiumAccess(handler) {
  return async function(request, ...args) {
    const accessError = await requirePremiumAccess(request);
    if (accessError) {
      return accessError;
    }
    return handler(request, ...args);
  };
}

/**
 * Features that require premium access
 */
export const PREMIUM_FEATURES = [
  'mra_einvoicing',
  'advanced_reports',
  'multi_user',
  'api_access',
  'priority_support'
];

/**
 * Check if a specific feature requires premium access
 */
export function featureRequiresPremium(featureName) {
  return PREMIUM_FEATURES.includes(featureName);
} 
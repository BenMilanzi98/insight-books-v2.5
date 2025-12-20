import prisma from '@/lib/prisma';

/**
 * Trial Expiration Service
 * Handles trial expiration, user lockout, and subscription enforcement
 */

/**
 * Check and expire trials for all tenants
 * This should be run as a cron job or scheduled task
 */
export async function checkAndExpireTrials() {
  const now = new Date();
  console.log('🕐 Checking for expired trials...');
  
  try {
    // Find all active trials that have expired
    const expiredTrials = await prisma.accountSubscription.findMany({
      where: {
        isTrial: true,
        isActive: true,
        trialEndDate: {
          lte: now
        }
      },
      include: {
        tenant: {
          include: {
            users: true
          }
        }
      }
    });

    console.log(`📊 Found ${expiredTrials.length} expired trials`);

    for (const trial of expiredTrials) {
      await expireTrialForTenant(trial.tenantId);
    }

    return {
      success: true,
      expiredCount: expiredTrials.length,
      message: `Expired ${expiredTrials.length} trials`
    };

  } catch (error) {
    console.error('❌ Error checking expired trials:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Expire trial for a specific tenant
 */
export async function expireTrialForTenant(tenantId) {
  try {
    console.log(`🔒 Expiring trial for tenant: ${tenantId}`);

    // Update trial subscription to expired
    await prisma.accountSubscription.updateMany({
      where: {
        tenantId,
        isTrial: true,
        isActive: true
      },
      data: {
        isActive: false,
        status: 'Expired'
      }
    });

    // Log the expiration
    await prisma.auditLog.create({
      data: {
        action: 'TRIAL_EXPIRED',
        entityType: 'SUBSCRIPTION',
        entityId: tenantId,
        userId: null, // System action
        details: JSON.stringify({
          tenantId,
          expiredAt: new Date().toISOString(),
          reason: 'Trial period ended'
        }),
        tenantId
      }
    });

    console.log(`✅ Trial expired for tenant: ${tenantId}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Error expiring trial for tenant ${tenantId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if a tenant's trial has expired
 */
export async function isTrialExpired(tenantId) {
  try {
    const trial = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        isTrial: true
      },
      orderBy: {
        trialEndDate: 'desc'
      }
    });

    if (!trial) {
      return false; // No trial found
    }

    return new Date() > new Date(trial.trialEndDate);
  } catch (error) {
    console.error('Error checking trial expiration:', error);
    return false;
  }
}

/**
 * Get trial expiration status for a tenant
 */
export async function getTrialExpirationStatus(tenantId) {
  try {
    const trial = await prisma.accountSubscription.findFirst({
      where: {
        tenantId,
        isTrial: true
      },
      orderBy: {
        trialEndDate: 'desc'
      }
    });

    if (!trial) {
      return {
        hasTrial: false,
        isExpired: false,
        daysRemaining: 0,
        trialEndDate: null
      };
    }

    const now = new Date();
    const trialEnd = new Date(trial.trialEndDate);
    const isExpired = now > trialEnd;
    const daysRemaining = isExpired ? 0 : Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));

    return {
      hasTrial: true,
      isExpired,
      daysRemaining,
      trialEndDate: trial.trialEndDate,
      trialStartDate: trial.trialStartDate
    };

  } catch (error) {
    console.error('Error getting trial expiration status:', error);
    return {
      hasTrial: false,
      isExpired: false,
      daysRemaining: 0,
      trialEndDate: null
    };
  }
}

/**
 * Force expire a trial (for admin use)
 */
export async function forceExpireTrial(tenantId, adminUserId) {
  try {
    console.log(`🔒 Force expiring trial for tenant: ${tenantId} by admin: ${adminUserId}`);

    // Update trial subscription
    await prisma.accountSubscription.updateMany({
      where: {
        tenantId,
        isTrial: true
      },
      data: {
        isActive: false,
        status: 'Force Expired'
      }
    });

    // Log the force expiration
    await prisma.auditLog.create({
      data: {
        action: 'TRIAL_FORCE_EXPIRED',
        entityType: 'SUBSCRIPTION',
        entityId: tenantId,
        userId: adminUserId,
        details: JSON.stringify({
          tenantId,
          expiredAt: new Date().toISOString(),
          reason: 'Force expired by admin',
          adminUserId
        }),
        tenantId
      }
    });

    console.log(`✅ Trial force expired for tenant: ${tenantId}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ Error force expiring trial for tenant ${tenantId}:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all tenants with expired trials
 */
export async function getTenantsWithExpiredTrials() {
  try {
    const now = new Date();
    
    const expiredTrials = await prisma.accountSubscription.findMany({
      where: {
        isTrial: true,
        trialEndDate: {
          lte: now
        }
      },
      include: {
        tenant: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      },
      orderBy: {
        trialEndDate: 'desc'
      }
    });

    return expiredTrials.map(trial => ({
      tenantId: trial.tenantId,
      tenantName: trial.tenant.name,
      trialEndDate: trial.trialEndDate,
      daysExpired: Math.ceil((now - new Date(trial.trialEndDate)) / (1000 * 60 * 60 * 24)),
      users: trial.tenant.users,
      isActive: trial.isActive
    }));

  } catch (error) {
    console.error('Error getting tenants with expired trials:', error);
    return [];
  }
}

/**
 * Send trial expiration notifications
 */
export async function sendTrialExpirationNotifications() {
  try {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    // Find trials expiring in 1 day
    const expiringTrials = await prisma.accountSubscription.findMany({
      where: {
        isTrial: true,
        isActive: true,
        trialEndDate: {
          gte: now,
          lte: oneDayFromNow
        }
      },
      include: {
        tenant: {
          include: {
            users: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    console.log(`📧 Found ${expiringTrials.length} trials expiring in 1 day`);

    // Here you would implement email notifications
    // For now, just log the notifications
    for (const trial of expiringTrials) {
      console.log(`📧 Trial expiring for tenant: ${trial.tenant.name}`);
      console.log(`   Users to notify: ${trial.tenant.users.map(u => u.email).join(', ')}`);
    }

    return {
      success: true,
      notificationsSent: expiringTrials.length
    };

  } catch (error) {
    console.error('Error sending trial expiration notifications:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

// lib/subscriptionExpiryEmailService.js
// Service for sending subscription expiry reminder emails

import prisma from '@/lib/prisma';
import { sendSubscriptionExpiryReminderEmail } from './email';

/**
 * Find subscriptions expiring in a specific number of days
 * @param {number} days - Number of days until expiry (1 or 2)
 * @returns {Promise<Array>} Array of subscriptions expiring in the specified days
 */
export async function findSubscriptionsExpiringInDays(days) {
  try {
    const now = new Date();
    
    // Calculate target date: subscriptions expiring exactly 'days' days from now
    // We check the entire day (00:00:00 to 23:59:59) to catch subscriptions expiring at any time
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + days);
    
    const startOfTargetDate = new Date(targetDate);
    startOfTargetDate.setHours(0, 0, 0, 0);
    
    const endOfTargetDate = new Date(targetDate);
    endOfTargetDate.setHours(23, 59, 59, 999);

    console.log(`🔍 Finding subscriptions expiring in ${days} day(s) (between ${startOfTargetDate.toISOString()} and ${endOfTargetDate.toISOString()})`);

    // Find active paid subscriptions expiring in the specified days
    const paidSubscriptions = await prisma.accountSubscription.findMany({
      where: {
        isActive: true,
        isTrial: false,
        expiresAt: {
          gte: startOfTargetDate,
          lte: endOfTargetDate
        },
        status: {
          not: 'Expired'
        }
      },
      include: {
        tenant: {
          include: {
            users: {
              where: {
                role: {
                  name: {
                    in: ['Super Admin', 'Admin']
                  }
                }
              },
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

    // Find active trials expiring in the specified days
    const trialSubscriptions = await prisma.accountSubscription.findMany({
      where: {
        isTrial: true,
        trialEndDate: {
          gte: startOfTargetDate,
          lte: endOfTargetDate
        },
        status: {
          not: 'Expired'
        }
      },
      include: {
        tenant: {
          include: {
            users: {
              where: {
                role: {
                  name: {
                    in: ['Super Admin', 'Admin']
                  }
                }
              },
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

    // Combine and filter out tenants that have active paid subscriptions (trials are hidden)
    const allSubscriptions = [...paidSubscriptions, ...trialSubscriptions];
    
    // Filter: if a tenant has an active paid subscription, exclude their trial
    const filteredSubscriptions = allSubscriptions.filter(sub => {
      if (sub.isTrial) {
        // Check if tenant has an active paid subscription
        const hasActivePaid = paidSubscriptions.some(
          paid => paid.tenantId === sub.tenantId && !paid.isTrial
        );
        return !hasActivePaid; // Only include trial if no active paid subscription
      }
      return true; // Always include paid subscriptions
    });

    console.log(`✅ Found ${filteredSubscriptions.length} subscription(s) expiring in ${days} day(s)`);
    
    return filteredSubscriptions;
  } catch (error) {
    console.error(`Error finding subscriptions expiring in ${days} days:`, error);
    return [];
  }
}

/**
 * Send expiry reminder emails for subscriptions expiring in a specific number of days
 * @param {number} days - Number of days until expiry (1 or 2)
 * @returns {Promise<Object>} Result object with success status and counts
 */
export async function sendExpiryReminderEmails(days) {
  try {
    console.log(`📧 Starting to send expiry reminder emails for subscriptions expiring in ${days} day(s)`);
    
    const subscriptions = await findSubscriptionsExpiringInDays(days);
    
    if (subscriptions.length === 0) {
      console.log(`ℹ️  No subscriptions expiring in ${days} day(s). Skipping email sending.`);
      return {
        success: true,
        daysRemaining: days,
        totalSubscriptions: 0,
        emailsSent: 0,
        emailsFailed: 0,
        errors: []
      };
    }

    let emailsSent = 0;
    let emailsFailed = 0;
    const errors = [];

    for (const subscription of subscriptions) {
      try {
        const expiryDate = subscription.isTrial ? subscription.trialEndDate : subscription.expiresAt;
        
        if (!expiryDate) {
          console.warn(`⚠️  Subscription ${subscription.id} has no expiry date. Skipping.`);
          continue;
        }

        // Calculate days remaining more accurately
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        // Use the calculated days remaining (should be close to 'days' parameter)
        // If it's significantly different, use the parameter value for consistency
        const daysRemaining = Math.abs(diffDays - days) <= 1 ? diffDays : days;

        // Get tenant admin users to send emails to
        const adminUsers = subscription.tenant.users || [];
        
        if (adminUsers.length === 0) {
          console.warn(`⚠️  Tenant ${subscription.tenantId} has no admin users. Skipping email.`);
          continue;
        }

        // Send email to each admin user
        for (const user of adminUsers) {
          if (!user.email) {
            console.warn(`⚠️  User ${user.id} has no email address. Skipping.`);
            continue;
          }

          const renewalUrl = `${process.env.APP_URL || 'https://insightbooksafrica.com'}/subscription`;
          
          const emailResult = await sendSubscriptionExpiryReminderEmail(
            user.email,
            user.name || 'Valued Customer',
            subscription.tenant.name || 'Your Business',
            daysRemaining,
            expiryDate,
            subscription.isTrial,
            subscription.plan || 'Premium',
            renewalUrl
          );

          if (emailResult.success) {
            emailsSent++;
            console.log(`✅ Sent expiry reminder email to ${user.email} for subscription ${subscription.id}`);
          } else {
            emailsFailed++;
            const errorMsg = `Failed to send email to ${user.email}: ${emailResult.error}`;
            errors.push(errorMsg);
            console.error(`❌ ${errorMsg}`);
          }
        }
      } catch (error) {
        emailsFailed++;
        const errorMsg = `Error processing subscription ${subscription.id}: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`, error);
      }
    }

    const result = {
      success: true,
      daysRemaining: days,
      totalSubscriptions: subscriptions.length,
      emailsSent,
      emailsFailed,
      errors: errors.length > 0 ? errors : undefined
    };

    console.log(`📊 Expiry reminder email summary for ${days} day(s):`, result);
    
    return result;
  } catch (error) {
    console.error(`Error sending expiry reminder emails for ${days} days:`, error);
    return {
      success: false,
      daysRemaining: days,
      error: error.message
    };
  }
}

/**
 * Process all subscription expiry reminders (2 days and 1 day before)
 * @returns {Promise<Object>} Combined result object
 */
export async function processSubscriptionExpiryReminders() {
  try {
    console.log('🚀 Starting subscription expiry reminder process...');
    
    // Send reminders for subscriptions expiring in 2 days
    const twoDayResult = await sendExpiryReminderEmails(2);
    
    // Send reminders for subscriptions expiring in 1 day
    const oneDayResult = await sendExpiryReminderEmails(1);
    
    const combinedResult = {
      success: twoDayResult.success && oneDayResult.success,
      timestamp: new Date().toISOString(),
      twoDaysRemaining: {
        totalSubscriptions: twoDayResult.totalSubscriptions || 0,
        emailsSent: twoDayResult.emailsSent || 0,
        emailsFailed: twoDayResult.emailsFailed || 0,
        errors: twoDayResult.errors
      },
      oneDayRemaining: {
        totalSubscriptions: oneDayResult.totalSubscriptions || 0,
        emailsSent: oneDayResult.emailsSent || 0,
        emailsFailed: oneDayResult.emailsFailed || 0,
        errors: oneDayResult.errors
      },
      total: {
        subscriptions: (twoDayResult.totalSubscriptions || 0) + (oneDayResult.totalSubscriptions || 0),
        emailsSent: (twoDayResult.emailsSent || 0) + (oneDayResult.emailsSent || 0),
        emailsFailed: (twoDayResult.emailsFailed || 0) + (oneDayResult.emailsFailed || 0)
      }
    };

    console.log('✅ Subscription expiry reminder process completed:', combinedResult);
    
    return combinedResult;
  } catch (error) {
    console.error('❌ Error processing subscription expiry reminders:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}


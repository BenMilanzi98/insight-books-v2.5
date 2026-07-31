/**
 * Onboarding notifications stub — Phase 17 Wave 4.
 * Typed unavailable until notification providers wired.
 */

export const ONBOARDING_NOTIFICATIONS_STATUS = 'STUB_NOT_CONFIGURED';

export function getOnboardingNotificationContract() {
  return {
    status: ONBOARDING_NOTIFICATIONS_STATUS,
    channels: [],
    inventDeliveryForbidden: true,
  };
}

/**
 * Stub enqueue — never claims delivery.
 */
export async function enqueueOnboardingNotification(_prisma, args = {}) {
  return {
    ok: true,
    queued: false,
    status: ONBOARDING_NOTIFICATIONS_STATUS,
    reason: 'notification_provider_not_configured',
    eventType: args.eventType || null,
  };
}

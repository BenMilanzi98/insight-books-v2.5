/**
 * Training notifications stub — Phase 18 Wave 4.
 * Typed unavailable until notification providers wired.
 */

export const TRAINING_NOTIFICATIONS_STATUS = 'STUB_NOT_CONFIGURED';

export function getTrainingNotificationContract() {
  return {
    status: TRAINING_NOTIFICATIONS_STATUS,
    channels: [],
    inventDeliveryForbidden: true,
  };
}

/**
 * Stub enqueue — never claims delivery.
 */
export async function enqueueTrainingNotification(_prisma, args = {}) {
  return {
    ok: true,
    queued: false,
    status: TRAINING_NOTIFICATIONS_STATUS,
    reason: 'notification_provider_not_configured',
    eventType: args.eventType || null,
  };
}

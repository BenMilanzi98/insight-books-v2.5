import { getSubscriptionStatus } from '../../subscriptionService.js';
import { DESKTOP_CODES } from '../codes.js';

export async function heartbeatDesktopDevice({ prisma, tenantId, deviceId }) {
  const device = await prisma.desktopDevice.findFirst({
    where: { tenantId, deviceId, unboundAt: null },
  });

  if (!device) {
    const error = new Error('Desktop device is not bound');
    error.code = DESKTOP_CODES.NOT_BOUND;
    error.status = 403;
    throw error;
  }

  const now = new Date();
  await prisma.desktopDevice.update({
    where: { deviceId },
    data: { lastHeartbeatAt: now },
  });

  const subscription = await getSubscriptionStatus(tenantId);
  const subscriptionActive = subscription.status === 'active' || subscription.status === 'trial';
  return {
    serverNow: now.toISOString(),
    bound: true,
    subscriptionActive,
    ...(subscriptionActive ? {} : { code: DESKTOP_CODES.SUBSCRIPTION_INACTIVE }),
  };
}

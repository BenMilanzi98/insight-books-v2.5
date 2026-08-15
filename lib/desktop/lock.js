export const LOCK_MS = 24 * 60 * 60 * 1000;
export const WARN_MS = 20 * 60 * 60 * 1000;
export const CLOCK_BACKSHIFT_MS = 5 * 60 * 1000;

export function evaluateDesktopLock({
  lastSuccessfulSyncAt,
  lastLocalNow,
  now,
  subscriptionActive,
}) {
  const nowMs = Number(now);
  const syncMs = Number(lastSuccessfulSyncAt);
  const lastLocalMs = Number(lastLocalNow);
  const hoursSinceSync = (nowMs - syncMs) / (60 * 60 * 1000);

  if (subscriptionActive === false) {
    return { locked: true, warning: false, hoursSinceSync, reason: 'subscription' };
  }
  if (Number.isFinite(lastLocalMs) && lastLocalMs - nowMs > CLOCK_BACKSHIFT_MS) {
    return { locked: true, warning: false, hoursSinceSync, reason: 'clock' };
  }
  if (nowMs - syncMs >= LOCK_MS) {
    return { locked: true, warning: true, hoursSinceSync, reason: 'stale' };
  }
  if (nowMs - syncMs >= WARN_MS) {
    return { locked: false, warning: true, hoursSinceSync, reason: null };
  }
  return { locked: false, warning: false, hoursSinceSync, reason: null };
}

export function hoursLeft(lockMs, hoursSinceSync) {
  return Math.max(0, lockMs / 3600000 - hoursSinceSync);
}

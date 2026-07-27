/** Short-lived in-process cache for capability evaluation. Defaults to correctness. */

const store = new Map();
const TTL_MS = 5_000;
let generation = 0;

export function invalidateEisCapabilityCache() {
  generation += 1;
  store.clear();
}

export function cacheGet(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.generation !== generation || hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function cacheSet(key, value) {
  store.set(key, {
    value,
    generation,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function buildCapabilityCacheKey(parts) {
  return [
    parts.tenantId,
    parts.businessId,
    parts.requestedOperation,
    parts.environment,
    parts.platformVersion,
    parts.entitlementVersion,
    parts.participationVersion,
    parts.businessVersion,
    parts.certVersion,
    parts.policyVersion,
  ].join('|');
}

/**
 * EIS control notifications — preference-aware stub that writes audit-safe log lines.
 * Deep links are returned for UI/email integration without calling MRA.
 */

const recent = new Map();
const DEDUPE_MS = 60_000;

export async function notifyEisControlEvent({ type, tenantId, businessId, message, deepLink }) {
  const key = `${type}:${tenantId || 'platform'}:${businessId || ''}`;
  const last = recent.get(key);
  if (last && Date.now() - last < DEDUPE_MS) {
    return { delivered: false, deduped: true };
  }
  recent.set(key, Date.now());

  const payload = {
    channel: 'eis-control',
    type,
    tenantId: tenantId || null,
    businessId: businessId || tenantId || null,
    message,
    deepLink: deepLink || (tenantId ? '/settings/integrations/mra-eis' : '/insightbooks/mra-eis'),
    at: new Date().toISOString(),
  };

  // Structured log only — no secrets. Email/in-app can subscribe later.
  console.info('[mra-eis-notify]', JSON.stringify(payload));
  return { delivered: true, deduped: false, payload };
}

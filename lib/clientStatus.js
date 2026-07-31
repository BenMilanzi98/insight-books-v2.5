/**
 * Client Active/Inactive is a persisted master-data flag (Client.isActive).
 * It must never be derived from invoice or sale activity.
 */

export function parseClientIsActive(value, defaultValue = true) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return defaultValue;
  const s = String(value).trim().toLowerCase();
  if (['inactive', 'false', '0', 'no', 'off'].includes(s)) return false;
  if (['active', 'true', '1', 'yes', 'on'].includes(s)) return true;
  return defaultValue;
}

export function clientStatusLabel(isActive) {
  return isActive ? 'Active' : 'Inactive';
}

/** Attach display `status` from persisted isActive. */
export function withClientStatus(client) {
  if (!client) return client;
  const isActive = client.isActive !== false;
  return {
    ...client,
    isActive,
    status: clientStatusLabel(isActive),
  };
}

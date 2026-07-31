/**
 * Server-side field-level security / masking.
 */

export function maskBankAccount(value) {
  if (value == null) return value;
  const s = String(value).replace(/\s+/g, '');
  if (s.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

export function maskIdentity(value) {
  if (value == null) return value;
  const s = String(value);
  if (s.length <= 3) return '***';
  return `${s.slice(0, 1)}${'*'.repeat(s.length - 2)}${s.slice(-1)}`;
}

/**
 * @param {'FULL'|'MASKED'|'NONE'} access
 */
export function applyFieldAccess(record, fieldPolicies = {}, accessMap = {}) {
  if (!record || typeof record !== 'object') return record;
  const out = { ...record };
  for (const [field, classification] of Object.entries(fieldPolicies)) {
    const access = accessMap[field] || accessMap[classification] || 'NONE';
    if (access === 'FULL') continue;
    if (access === 'NONE') {
      delete out[field];
      continue;
    }
    if (access === 'MASKED') {
      if (/bank|accountNumber|iban/i.test(field) || classification === 'RESTRICTED_BANKING') {
        out[field] = maskBankAccount(out[field]);
      } else {
        out[field] = maskIdentity(out[field]);
      }
    }
  }
  return out;
}

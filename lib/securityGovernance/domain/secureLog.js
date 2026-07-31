/**
 * Privacy-aware structured logging helpers.
 */

import { redactForAudit } from './auditEvents.js';

export function secureLog(level, message, context = {}) {
  const safe = redactForAudit(context);
  const line = {
    level,
    message,
    ...safe,
    ts: new Date().toISOString(),
  };
  // Prefer structured JSON; avoid dumping secrets
  if (level === 'error') console.error(JSON.stringify(line));
  else if (level === 'warn') console.warn(JSON.stringify(line));
  else console.log(JSON.stringify(line));
}

/**
 * Signed session tokens (HMAC-SHA256) with legacy base64 fallback.
 * Encoding lives here; parsing is shared via lib/sessionCookie.js for middleware.
 */

import { createHmac, randomUUID } from 'crypto';
import { parseSessionPayload } from '../../sessionCookie.js';

const V2_PREFIX = 'v2.';

export function getSessionSigningSecret() {
  return (
    process.env.SESSION_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    null
  );
}

export function encodeSessionToken(payload, { sessionId } = {}) {
  const body = {
    ...payload,
    sessionId: sessionId || payload.sessionId || randomUUID(),
    iat: Math.floor(Date.now() / 1000),
  };
  const json = JSON.stringify(body);
  const b64 = Buffer.from(json, 'utf8').toString('base64url');
  const secret = getSessionSigningSecret();
  if (!secret) {
    return Buffer.from(json, 'utf8').toString('base64');
  }
  const sig = createHmac('sha256', secret).update(`${V2_PREFIX}${b64}`).digest('hex');
  return `${V2_PREFIX}${b64}.${sig}`;
}

export function decodeSessionToken(token) {
  return parseSessionPayload(token);
}

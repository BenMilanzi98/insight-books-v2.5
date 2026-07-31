/**
 * Edge-safe admin JWT verify (signature + exp + isAdmin claim).
 * Does not hit the database — API routes still reload Admin via getAdminFromRequest.
 */

function b64urlToBytes(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function getEdgeJwtSecret() {
  const jwt = (process.env.JWT_SECRET || '').trim();
  if (jwt.length >= 16) return jwt;
  const session = (process.env.SESSION_SECRET || '').trim();
  if (session.length >= 16) return session;
  if (process.env.NODE_ENV === 'production') return null;
  return 'insightbooks-local-dev-only-jwt-secret-min-32-chars';
}

/**
 * @param {string|undefined|null} token
 * @returns {Promise<{ ok: true, payload: object } | { ok: false, reason: string }>}
 */
export async function verifyAdminJwtEdge(token) {
  if (!token || typeof token !== 'string' || token.split('.').length !== 3) {
    return { ok: false, reason: 'malformed' };
  }

  const secret = getEdgeJwtSecret();
  if (!secret) {
    return { ok: false, reason: 'secret_missing' };
  }

  try {
    const [headerB64, payloadB64, sigB64] = token.split('.');
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const valid = await crypto.subtle.verify('HMAC', key, b64urlToBytes(sigB64), data);
    if (!valid) return { ok: false, reason: 'bad_signature' };

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    if (!payload?.isAdmin || !payload?.adminId) {
      return { ok: false, reason: 'not_admin' };
    }
    if (payload.exp && Number(payload.exp) * 1000 <= Date.now()) {
      return { ok: false, reason: 'expired' };
    }
    return { ok: true, payload };
  } catch {
    return { ok: false, reason: 'verify_failed' };
  }
}

/**
 * Edge-safe session payload parse (Web Crypto — no Node `crypto` / Buffer).
 * Used by middleware.js only.
 */

const BASE64_SESSION_REGEX = /^[A-Za-z0-9+/]*={0,2}$/;
const V2_PREFIX = 'v2.';

function getSigningSecret() {
  return (
    process.env.SESSION_SIGNING_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET ||
    null
  );
}

function normalizeUserId(raw) {
  if (typeof raw === 'string') return raw.trim();
  if (raw != null && (typeof raw === 'number' || typeof raw === 'bigint')) return String(raw);
  return '';
}

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function base64ToUtf8(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function hexToBytes(hex) {
  if (!hex || hex.length % 2 !== 0) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function verifyHmacSha256Hex(secret, message, sigHex) {
  const sig = hexToBytes(sigHex);
  if (!sig) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  return crypto.subtle.verify('HMAC', key, sig, enc.encode(message));
}

/**
 * @param {string|null|undefined} sessionValue
 * @returns {Promise<object|null>}
 */
export async function parseSessionPayloadEdge(sessionValue) {
  if (sessionValue == null || typeof sessionValue !== 'string') return null;
  const trimmed = sessionValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(V2_PREFIX)) {
    const rest = trimmed.slice(V2_PREFIX.length);
    const lastDot = rest.lastIndexOf('.');
    if (lastDot <= 0) return null;
    const b64 = rest.slice(0, lastDot);
    const sig = rest.slice(lastDot + 1);
    const secret = getSigningSecret();
    if (!secret) return null;
    const ok = await verifyHmacSha256Hex(secret, `${V2_PREFIX}${b64}`, sig);
    if (!ok) return null;
    try {
      const json = new TextDecoder().decode(base64UrlToBytes(b64));
      const data = JSON.parse(json);
      if (!data || typeof data !== 'object') return null;
      const userId = normalizeUserId(data.userId);
      if (!userId) return null;
      return { ...data, userId, _signed: true };
    } catch {
      return null;
    }
  }

  if (process.env.ALLOW_LEGACY_UNSIGNED_SESSION === 'false') return null;
  void BASE64_SESSION_REGEX;
  try {
    const decoded = base64ToUtf8(trimmed);
    if (!decoded?.trim()) return null;
    const data = JSON.parse(decoded);
    if (!data || typeof data !== 'object') return null;
    const userId = normalizeUserId(data.userId);
    if (!userId) return null;
    return { ...data, userId, _signed: false, _legacy: true };
  } catch {
    return null;
  }
}

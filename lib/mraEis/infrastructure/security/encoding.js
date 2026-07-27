import { CryptoErrors } from './cryptoErrors.js';

export function utf8Bytes(value) {
  return Buffer.from(String(value), 'utf8');
}

export function encodeBase64Standard(bytes) {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return buf.toString('base64');
}

export function decodeBase64Standard(value) {
  try {
    return Buffer.from(String(value), 'base64');
  } catch {
    throw CryptoErrors.encoding({ message: 'Invalid standard Base64 input.' });
  }
}

export function encodeBase64UrlSafe(bytes, { pad = true } = {}) {
  let out = encodeBase64Standard(bytes).replace(/\+/g, '-').replace(/\//g, '_');
  if (!pad) out = out.replace(/=+$/g, '');
  return out;
}

export function encodeBase64UrlSafeWithoutPadding(bytes) {
  return encodeBase64UrlSafe(bytes, { pad: false });
}

export function decodeBase64UrlSafe(value) {
  let s = String(value).replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  return decodeBase64Standard(s);
}

export function encodeHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

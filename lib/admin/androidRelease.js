/**
 * Android release safety — checksums and public metadata only.
 * Signing credentials must never be accepted or returned.
 */

import { createHash } from 'crypto';

export const ANDROID_SECRET_DENYLIST = [
  'signingKey',
  'signingPassword',
  'keystore',
  'keystorePassword',
  'keyAlias',
  'keyPassword',
  'playSigningKey',
  'certificate',
  'privateKey',
  'secret',
  'password',
  'token',
];

export function assertNoSigningSecrets(body = {}) {
  for (const key of ANDROID_SECRET_DENYLIST) {
    if (body[key] !== undefined && body[key] !== null && body[key] !== '') {
      return {
        ok: false,
        error: `Signing credential field "${key}" must not be submitted`,
      };
    }
  }
  return { ok: true };
}

export function sha256Hex(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

export function assertValidChecksum(checksum) {
  if (checksum == null || checksum === '') {
    return { ok: true, checksum: null };
  }
  const s = String(checksum).trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(s)) {
    return { ok: false, error: 'apkChecksum must be a 64-char SHA-256 hex digest' };
  }
  return { ok: true, checksum: s };
}

export function assertUniqueVersionCode(existingCodes, versionCode) {
  const n = Number(versionCode);
  if (!Number.isFinite(n) || n < 1) {
    return { ok: false, error: 'Invalid version code' };
  }
  if ([...existingCodes].map(Number).includes(n)) {
    return { ok: false, error: 'Version code already published' };
  }
  return { ok: true, versionCode: n };
}

export const RELEASE_CHANNELS = ['INTERNAL', 'BETA', 'STABLE', 'EMERGENCY'];

export function assertReleaseChannel(channel) {
  const c = String(channel || 'STABLE').toUpperCase();
  if (!RELEASE_CHANNELS.includes(c)) {
    return { ok: false, error: `Invalid release channel` };
  }
  return { ok: true, channel: c };
}

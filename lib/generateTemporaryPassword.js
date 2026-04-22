import crypto from 'crypto';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/**
 * 6-character random password for welcome emails (letters + digits only).
 * Uses `crypto.randomInt` (not `Math.random`) so distribution is suitable for credentials.
 */
export function generateSixCharAlphanumericPassword() {
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += ALPHANUM[crypto.randomInt(0, ALPHANUM.length)];
  }
  return out;
}

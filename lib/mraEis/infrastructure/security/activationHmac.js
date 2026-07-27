import { createHmac } from 'crypto';
import { assertCryptoAllowed } from './cryptoRegistry.js';
import { encodeBase64Standard, utf8Bytes } from './encoding.js';

export const ACTIVATION_CONFIRMATION_KAT = Object.freeze({
  plaintext: 'MRA',
  key: '123456',
  expected:
    'xludP1OafF422HgSRaKqZiUXaFALv8D+mnBJOWd5vDK7N7T22V+WOTvgIFQ7I1p+S2cIPg3JxuVm4xth+8UQ/Q==',
});

/** Pure HMAC for known-answer tests (does not touch vault / Prisma). */
export function computeActivationConfirmationSignature(tac, secretKey) {
  assertCryptoAllowed('ACTIVATION_CONFIRMATION_HMAC_SHA512_V1', { forProduction: false });
  const mac = createHmac('sha512', utf8Bytes(secretKey)).update(utf8Bytes(tac)).digest();
  return encodeBase64Standard(mac);
}

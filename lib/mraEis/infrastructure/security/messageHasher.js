import './serverOnly.js';
import { assertCryptoAllowed } from './cryptoRegistry.js';
import { CryptoErrors } from './cryptoErrors.js';
import { incSecurityMetric } from './securityMetrics.js';

/**
 * Endpoint-specific message hashing — fails closed until Phase 1 Q-010/Q-011 resolved.
 */
export async function hashEisMessage(/* input */) {
  incSecurityMetric('eis.crypto.blocked_unverified');
  try {
    assertCryptoAllowed('REQUEST_MESSAGE_HASH_V1');
  } catch (err) {
    throw CryptoErrors.contractUnverified({
      message:
        'x-eis-message-hash contract is unverified (Phase 1 Q-010/Q-011). Hashing fails closed.',
    });
  }
  throw CryptoErrors.messageHash({ message: 'Message hasher unexpectedly reached implementation.' });
}

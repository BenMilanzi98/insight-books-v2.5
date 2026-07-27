import './serverOnly.js';
import { assertCryptoAllowed } from './cryptoRegistry.js';
import { CryptoErrors } from './cryptoErrors.js';
import { incSecurityMetric } from './securityMetrics.js';

/**
 * Offline signing boundary — blocked until contract KAT + certification.
 */
export async function signOfflineTransaction(/* input */) {
  incSecurityMetric('eis.crypto.blocked_unverified');
  try {
    assertCryptoAllowed('OFFLINE_SIGNATURE_HMAC_SHA256_V1');
  } catch {
    throw CryptoErrors.offlineUnavailable({
      message:
        'Offline signing is blocked until Phase 1 offline KAT (Q-040) and certification gating pass.',
    });
  }
  throw CryptoErrors.offlineUnavailable();
}

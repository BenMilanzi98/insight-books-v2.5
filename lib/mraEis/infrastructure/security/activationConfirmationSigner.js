import './serverOnly.js';
import crypto from 'crypto';
import { assertCryptoAllowed } from './cryptoRegistry.js';
import {
  computeActivationConfirmationSignature,
  ACTIVATION_CONFIRMATION_KAT,
} from './activationHmac.js';
import { withSecret } from './secretProvider.js';
import { EIS_CRYPTO_OPERATION } from './secretTypes.js';
import { EIS_SERVICE_IDENTITY } from './serviceIdentity.js';
import { CryptoErrors } from './cryptoErrors.js';
import { incSecurityMetric } from './securityMetrics.js';

export { computeActivationConfirmationSignature, ACTIVATION_CONFIRMATION_KAT };

/**
 * Sign activation confirmation using stored terminal secret.
 * Does not call MRA. Production use remains disabled at registry level.
 */
export async function signActivationConfirmation({
  tenantId,
  businessId = tenantId,
  terminalId,
  environment,
  credentialReferenceId,
  activationCode,
  forProduction = false,
  requestId = null,
  correlationId = null,
  db,
}) {
  if (forProduction || environment === 'PRODUCTION') {
    throw CryptoErrors.contractUnverified({
      message:
        'Activation confirmation signer is VERIFIED_WITH_TEST_VECTOR only; sandbox verification required before production.',
    });
  }
  assertCryptoAllowed('ACTIVATION_CONFIRMATION_HMAC_SHA512_V1', { forProduction: false });

  const signature = await withSecret(
    {
      credentialReferenceId,
      tenantId,
      businessId,
      terminalId,
      environment,
      operation: EIS_CRYPTO_OPERATION.MRA_ACTIVATION_CONFIRMATION,
      serviceIdentity: EIS_SERVICE_IDENTITY.ACTIVATION_CONFIRMATION_SERVICE,
      requestId,
      correlationId,
      db,
    },
    async (secretKey) => computeActivationConfirmationSignature(activationCode, secretKey)
  );

  incSecurityMetric('eis.signing.activation_confirmation');
  return {
    signature,
    signerVersion: 'ACTIVATION_CONFIRMATION_HMAC_SHA512_V1',
    algorithm: 'HMAC-SHA512',
    safeInputChecksum: crypto.createHash('sha256').update(String(activationCode)).digest('hex'),
    generatedAt: new Date().toISOString(),
  };
}

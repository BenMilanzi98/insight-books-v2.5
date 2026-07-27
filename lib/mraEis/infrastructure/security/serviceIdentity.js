import { EIS_CRYPTO_OPERATION, EIS_SECRET_TYPE } from './secretTypes.js';
import { CryptoErrors } from './cryptoErrors.js';

/**
 * Trusted backend service identities and allowed secret operations.
 */
export const EIS_SERVICE_IDENTITY = Object.freeze({
  TERMINAL_ACTIVATION_SERVICE: 'TerminalActivationService',
  ACTIVATION_CONFIRMATION_SERVICE: 'ActivationConfirmationService',
  MRA_API_CLIENT: 'MraApiClient',
  CONFIGURATION_SYNC_WORKER: 'ConfigurationSyncWorker',
  SALES_TRANSMISSION_WORKER: 'SalesTransmissionWorker',
  OFFLINE_SIGNING_SERVICE: 'OfflineSigningService',
  CREDENTIAL_ROTATION_WORKER: 'CredentialRotationWorker',
  SECURITY_DIAGNOSTICS_SERVICE: 'SecurityDiagnosticsService',
  PHASE6_SECURITY_SERVICE: 'Phase6SecurityService',
});

const POLICY = Object.freeze({
  [EIS_SERVICE_IDENTITY.TERMINAL_ACTIVATION_SERVICE]: {
    secretTypes: [EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE, EIS_SECRET_TYPE.MRA_TERMINAL_JWT],
    operations: [EIS_CRYPTO_OPERATION.MRA_ACTIVATION_REQUEST, EIS_CRYPTO_OPERATION.MRA_HTTP_AUTHORIZATION],
  },
  [EIS_SERVICE_IDENTITY.ACTIVATION_CONFIRMATION_SERVICE]: {
    secretTypes: [EIS_SECRET_TYPE.MRA_TERMINAL_SECRET, EIS_SECRET_TYPE.MRA_TERMINAL_ACTIVATION_CODE],
    operations: [EIS_CRYPTO_OPERATION.MRA_ACTIVATION_CONFIRMATION],
  },
  [EIS_SERVICE_IDENTITY.MRA_API_CLIENT]: {
    secretTypes: [EIS_SECRET_TYPE.MRA_TERMINAL_JWT],
    operations: [EIS_CRYPTO_OPERATION.MRA_HTTP_AUTHORIZATION],
  },
  [EIS_SERVICE_IDENTITY.CONFIGURATION_SYNC_WORKER]: {
    secretTypes: [EIS_SECRET_TYPE.MRA_TERMINAL_JWT],
    operations: [EIS_CRYPTO_OPERATION.MRA_HTTP_AUTHORIZATION],
  },
  [EIS_SERVICE_IDENTITY.SALES_TRANSMISSION_WORKER]: {
    secretTypes: [EIS_SECRET_TYPE.MRA_TERMINAL_JWT, EIS_SECRET_TYPE.MRA_TERMINAL_SECRET],
    operations: [
      EIS_CRYPTO_OPERATION.MRA_HTTP_AUTHORIZATION,
      EIS_CRYPTO_OPERATION.MRA_REQUEST_MESSAGE_HASH,
    ],
  },
  [EIS_SERVICE_IDENTITY.OFFLINE_SIGNING_SERVICE]: {
    secretTypes: [EIS_SECRET_TYPE.MRA_TERMINAL_SECRET, EIS_SECRET_TYPE.MRA_OFFLINE_SIGNING_SECRET],
    operations: [EIS_CRYPTO_OPERATION.MRA_OFFLINE_SIGN],
  },
  [EIS_SERVICE_IDENTITY.CREDENTIAL_ROTATION_WORKER]: {
    secretTypes: Object.values(EIS_SECRET_TYPE),
    operations: [EIS_CRYPTO_OPERATION.CREDENTIAL_ROTATION, EIS_CRYPTO_OPERATION.MASTER_KEY_REWRAP],
  },
  [EIS_SERVICE_IDENTITY.SECURITY_DIAGNOSTICS_SERVICE]: {
    secretTypes: Object.values(EIS_SECRET_TYPE),
    operations: [EIS_CRYPTO_OPERATION.SECURITY_DIAGNOSTICS_METADATA],
  },
  [EIS_SERVICE_IDENTITY.PHASE6_SECURITY_SERVICE]: {
    secretTypes: Object.values(EIS_SECRET_TYPE),
    operations: Object.values(EIS_CRYPTO_OPERATION),
  },
});

export function assertServiceMayAccess({ serviceIdentity, secretType, operation }) {
  const policy = POLICY[serviceIdentity];
  if (!policy) {
    throw CryptoErrors.secretAccessDenied({
      message: 'Unknown or unauthorized service identity.',
      details: { serviceIdentity },
    });
  }
  if (!policy.secretTypes.includes(secretType)) {
    throw CryptoErrors.secretAccessDenied({
      message: 'Service identity may not access this secret type.',
      details: { serviceIdentity, secretType },
    });
  }
  if (!policy.operations.includes(operation)) {
    throw CryptoErrors.secretAccessDenied({
      message: 'Service identity may not perform this cryptographic operation.',
      details: { serviceIdentity, operation },
    });
  }
}

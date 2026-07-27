/**
 * MRA EIS Sales Endpoint Contract Registry — Phase 13.
 * Production transmission blocked until contract verified (hash + success codes).
 */

export const SALES_ENDPOINT_CONTRACT_VERSION = 'phase13-sales-endpoint-contract-v1';

export const SALES_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL_SANDBOX_ONLY: 'PROVISIONAL_SANDBOX_ONLY',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

const contracts = [
  {
    contractVersion: 'MOCK_SALES_V1',
    environment: 'MOCK',
    baseUrlKey: 'mock://mra-eis',
    endpointPath: '/api/v1/sales/submit-sales-transaction',
    httpMethod: 'POST',
    contentType: 'application/json',
    characterEncoding: 'UTF-8',
    authenticationMode: 'BEARER_JWT',
    requestHashRequired: true,
    requestHashHeaderName: 'x-eis-message-hash',
    requestHashMode: 'MOCK_SYNTHETIC_SHA256_HEX',
    requestCanonicalizationVersion: 'PAYLOAD_CANONICALIZATION_V1',
    requestSchemaVersion: 'SALES_PAYLOAD_V1_PROVISIONAL',
    responseSchemaVersion: 'SALES_RESPONSE_V1_PROVISIONAL',
    responseContentTypes: ['application/json'],
    maximumRequestBytes: 512000,
    maximumResponseBytes: 512000,
    connectionTimeout: 10000,
    responseTimeout: 30000,
    applicationStatusField: 'responseCode',
    acceptedStatusValues: ['SUCCESS', '0', '00'],
    rejectedStatusValues: ['REJECTED', '1', 'VALIDATION_ERROR'],
    temporaryStatusValues: ['RETRY', '503'],
    configurationRefreshFields: ['shouldRefreshConfiguration', 'refreshConfiguration'],
    terminalBlockFields: ['shouldBlockTerminal', 'blockTerminal'],
    externalTransactionIdFields: ['mraTransactionId', 'transactionId'],
    validationDataFields: ['validationUrl', 'qrData'],
    retrySafety: 'UNKNOWN_UNTIL_SANDBOX',
    duplicateRequestSemantics: 'REQUIRES_MRA_CLARIFICATION',
    contractStatus: SALES_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    evidenceReferences: ['Phase 1 EP-SAL-05', 'Phase 13 mock provisional'],
    isMraVerifiedHash: false,
    productionEnabled: false,
  },
  {
    contractVersion: 'SANDBOX_SALES_PROVISIONAL_V1',
    environment: 'SANDBOX',
    baseUrlKey: 'MRA_EIS_SANDBOX_BASE_URL',
    endpointPath: '/api/v1/sales/submit-sales-transaction',
    httpMethod: 'POST',
    contentType: 'application/json',
    characterEncoding: 'UTF-8',
    authenticationMode: 'BEARER_JWT',
    requestHashRequired: true,
    requestHashHeaderName: 'x-eis-message-hash',
    requestHashMode: 'REQUIRES_MRA_CLARIFICATION',
    requestCanonicalizationVersion: 'PAYLOAD_CANONICALIZATION_V1',
    requestSchemaVersion: 'SALES_PAYLOAD_V1_PROVISIONAL',
    responseSchemaVersion: 'SALES_RESPONSE_V1_PROVISIONAL',
    responseContentTypes: ['application/json'],
    maximumRequestBytes: 512000,
    maximumResponseBytes: 512000,
    connectionTimeout: 10000,
    responseTimeout: 30000,
    applicationStatusField: 'responseCode',
    acceptedStatusValues: [], // fail closed — do not hardcode disputed codes for live sandbox
    rejectedStatusValues: [],
    temporaryStatusValues: [],
    configurationRefreshFields: ['shouldRefreshConfiguration'],
    terminalBlockFields: ['shouldBlockTerminal'],
    externalTransactionIdFields: ['mraTransactionId'],
    validationDataFields: ['validationUrl', 'qrData'],
    retrySafety: 'UNKNOWN',
    duplicateRequestSemantics: 'REQUIRES_MRA_CLARIFICATION',
    contractStatus: SALES_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    evidenceReferences: ['Phase 1 Q-010/Q-011', 'Clarification Register'],
    isMraVerifiedHash: false,
    productionEnabled: false,
    liveTransmissionBlocked: true,
    blockReason: 'x-eis-message-hash and application success codes unverified for live sandbox/production',
  },
  {
    contractVersion: 'PRODUCTION_SALES_BLOCKED_V1',
    environment: 'PRODUCTION',
    baseUrlKey: 'MRA_EIS_PRODUCTION_BASE_URL',
    endpointPath: '/api/v1/sales/submit-sales-transaction',
    httpMethod: 'POST',
    contentType: 'application/json',
    characterEncoding: 'UTF-8',
    authenticationMode: 'BEARER_JWT',
    requestHashRequired: true,
    requestHashHeaderName: 'x-eis-message-hash',
    requestHashMode: 'REQUIRES_MRA_CLARIFICATION',
    requestCanonicalizationVersion: 'PAYLOAD_CANONICALIZATION_V1',
    requestSchemaVersion: 'SALES_PAYLOAD_V1_PROVISIONAL',
    responseSchemaVersion: 'SALES_RESPONSE_V1_PROVISIONAL',
    responseContentTypes: ['application/json'],
    maximumRequestBytes: 512000,
    maximumResponseBytes: 512000,
    connectionTimeout: 10000,
    responseTimeout: 30000,
    applicationStatusField: 'responseCode',
    acceptedStatusValues: [],
    rejectedStatusValues: [],
    temporaryStatusValues: [],
    configurationRefreshFields: ['shouldRefreshConfiguration'],
    terminalBlockFields: ['shouldBlockTerminal'],
    externalTransactionIdFields: ['mraTransactionId'],
    validationDataFields: ['validationUrl', 'qrData'],
    retrySafety: 'BLOCKED',
    duplicateRequestSemantics: 'REQUIRES_MRA_CLARIFICATION',
    contractStatus: SALES_CONTRACT_STATUS.BLOCKED,
    evidenceReferences: ['Phase 1 Clarification Register', 'Phase 12 G12-001'],
    isMraVerifiedHash: false,
    productionEnabled: false,
    liveTransmissionBlocked: true,
    blockReason: 'Production Sales transmission blocked until MRA contract verified',
  },
];

export function getSalesEndpointContractRegistry() {
  return {
    version: SALES_ENDPOINT_CONTRACT_VERSION,
    contracts,
    noAutomaticEndpointFallback: true,
    noAutomaticMethodFallback: true,
    http200NotAcceptance: true,
  };
}

/**
 * Resolve contract for environment + activation mode.
 * LIVE sandbox/production remain blocked; MOCK provisional allowed.
 */
export function resolveSalesEndpointContract({ environment = 'SANDBOX', mode = 'MOCK' } = {}) {
  const env = String(environment).toUpperCase();
  const m = String(mode).toUpperCase();

  if (m === 'MOCK' || env === 'MOCK') {
    const c = contracts.find((x) => x.environment === 'MOCK');
    return {
      contract: c,
      allowsTransmission: true,
      isMock: true,
      decision: SALES_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
      message: 'Mock provisional Sales contract — synthetic acceptance codes only. Not MRA certification.',
    };
  }

  const c =
    contracts.find((x) => x.environment === env) ||
    contracts.find((x) => x.environment === 'PRODUCTION');

  return {
    contract: c,
    allowsTransmission: false,
    isMock: false,
    decision: c?.contractStatus || SALES_CONTRACT_STATUS.BLOCKED,
    message: c?.blockReason || 'Sales endpoint contract unverified — transmission blocked.',
  };
}

export function getSalesEndpointContractDecision() {
  return {
    decision: SALES_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    path: '/api/v1/sales/submit-sales-transaction',
    httpMethod: 'POST',
    mockTransmission: 'ALLOWED',
    liveSandboxTransmission: 'BLOCKED',
    productionTransmission: 'BLOCKED',
    requestHash: 'REQUIRES_MRA_CLARIFICATION (mock synthetic only)',
    successCodes: 'PROVISIONAL_MOCK_ONLY — fail closed for live',
    notes: [
      'No automatic fallback between endpoints/methods/hash algorithms',
      'HTTP 200 alone is never acceptance',
    ],
  };
}

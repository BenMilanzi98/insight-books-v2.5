/**
 * Phase 14 — QR Source Contract Registry.
 * Never invent production QR content. Never use local InsightBooks URLs as MRA validation QR.
 */

export const QR_SOURCE_TYPE = Object.freeze({
  MRA_VALIDATION_URL: 'MRA_VALIDATION_URL',
  MRA_RAW_QR_PAYLOAD: 'MRA_RAW_QR_PAYLOAD',
  MRA_VALIDATION_REFERENCE: 'MRA_VALIDATION_REFERENCE',
  MRA_PROVIDED_QR_IMAGE_REFERENCE: 'MRA_PROVIDED_QR_IMAGE_REFERENCE',
  COMPOSITE_VERIFIED_PAYLOAD: 'COMPOSITE_VERIFIED_PAYLOAD',
  CONTRACT_UNRESOLVED: 'CONTRACT_UNRESOLVED',
});

export const QR_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL_SANDBOX_ONLY: 'PROVISIONAL_SANDBOX_ONLY',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

const MOCK_ALLOWED_HOSTS = Object.freeze([
  'mock.mra.local',
  'sandbox-mock.mra.local',
]);

/** Provisional — production hosts require MRA clarification before use. */
const PROVISIONAL_PRODUCTION_HOSTS = Object.freeze([
  'eis.mra.mw',
  'www.mra.mw',
  'mra.mw',
]);

const REGISTRY = Object.freeze({
  'qr-source-mock-v1': {
    contractVersion: 'qr-source-mock-v1',
    environment: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    modes: ['MOCK'],
    sourceType: QR_SOURCE_TYPE.MRA_VALIDATION_URL,
    sourceResponseFields: ['validationUrl', 'qrData'],
    sourcePrecedence: [QR_SOURCE_TYPE.MRA_VALIDATION_URL, QR_SOURCE_TYPE.MRA_RAW_QR_PAYLOAD],
    requiredPrefix: null,
    requiredEncoding: 'utf-8',
    URLPolicy: {
      requireHttps: true,
      allowlistedHosts: MOCK_ALLOWED_HOSTS,
      allowIpHosts: false,
      allowLocalhost: false,
      allowPrivateNetworks: false,
      allowEmbeddedCredentials: false,
      allowNonStandardPorts: false,
      maxLength: 2048,
    },
    allowedSchemes: ['https'],
    allowedHosts: MOCK_ALLOWED_HOSTS,
    allowedPaths: ['/validate', '/validate/'],
    maximumLength: 2048,
    UnicodePolicy: 'reject-control-characters',
    whitespacePolicy: 'preserve-exact-no-trim-semantics',
    QRVersionPolicy: 'auto',
    errorCorrectionLevel: 'M',
    quietZone: 4,
    minimumPixelSize: 160,
    maximumPixelSize: 512,
    outputFormats: ['PNG', 'SVG'],
    verificationPolicy: 'decode-must-match-exact-source',
    contractStatus: QR_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsQrGeneration: true,
    inventPayloadForbidden: true,
    localAppUrlForbidden: true,
    evidenceReferences: ['Phase 13 mock validationUrl', 'G14-003'],
  },
  'qr-source-sandbox-live-v1': {
    contractVersion: 'qr-source-sandbox-live-v1',
    environment: ['SANDBOX'],
    modes: ['SANDBOX'],
    sourceType: QR_SOURCE_TYPE.CONTRACT_UNRESOLVED,
    sourcePrecedence: [],
    contractStatus: QR_CONTRACT_STATUS.BLOCKED,
    allowsQrGeneration: false,
    blockerCodes: ['LIVE_QR_PAYLOAD_SEMANTICS_UNVERIFIED'],
    URLPolicy: {
      requireHttps: true,
      allowlistedHosts: PROVISIONAL_PRODUCTION_HOSTS,
      allowIpHosts: false,
      allowLocalhost: false,
      allowPrivateNetworks: false,
      allowEmbeddedCredentials: false,
      allowNonStandardPorts: false,
      maxLength: 2048,
    },
    inventPayloadForbidden: true,
    evidenceReferences: ['G14-001'],
  },
  'qr-source-production-v1': {
    contractVersion: 'qr-source-production-v1',
    environment: ['PRODUCTION'],
    modes: ['PRODUCTION'],
    sourceType: QR_SOURCE_TYPE.CONTRACT_UNRESOLVED,
    sourcePrecedence: [],
    contractStatus: QR_CONTRACT_STATUS.BLOCKED,
    allowsQrGeneration: false,
    blockerCodes: ['PRODUCTION_QR_SOURCE_UNVERIFIED', 'PRODUCTION_ALLOWLIST_UNVERIFIED'],
    URLPolicy: {
      requireHttps: true,
      allowlistedHosts: PROVISIONAL_PRODUCTION_HOSTS,
      allowIpHosts: false,
      allowLocalhost: false,
      allowPrivateNetworks: false,
      allowEmbeddedCredentials: false,
      allowNonStandardPorts: false,
      maxLength: 2048,
    },
    inventPayloadForbidden: true,
    evidenceReferences: ['G14-002'],
  },
});

export function getQrSourceContractRegistry() {
  return REGISTRY;
}

export function resolveQrSourceContract({ environment, mode = 'MOCK' } = {}) {
  const env = String(environment || 'SANDBOX').toUpperCase();
  const m = String(mode || 'MOCK').toUpperCase();

  let contract;
  if (m === 'MOCK' || env === 'DEVELOPMENT' || env === 'TEST') {
    contract = REGISTRY['qr-source-mock-v1'];
  } else if (env === 'PRODUCTION' || m === 'PRODUCTION') {
    contract = REGISTRY['qr-source-production-v1'];
  } else {
    contract = REGISTRY['qr-source-sandbox-live-v1'];
  }

  return {
    contract,
    allowsQrGeneration: Boolean(contract.allowsQrGeneration),
    decision: contract.contractStatus,
  };
}

export function getQrSourceContractDecision() {
  return {
    mock: QR_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    sandboxLive: QR_CONTRACT_STATUS.BLOCKED,
    production: QR_CONTRACT_STATUS.BLOCKED,
    precedence: 'validationUrl over raw qrData when both present (mock)',
    inventForbidden: true,
    localVerifyUrlForbidden: true,
  };
}

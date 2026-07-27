/**
 * Phase 16 — Offline / Signature / Numbering / Receipt / Upload contract registries.
 * Production remains BLOCKED until MRA verification + certification evidence.
 */

export const OFFLINE_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL_SANDBOX_ONLY: 'PROVISIONAL_SANDBOX_ONLY',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  REQUIRES_CERTIFICATION: 'REQUIRES_CERTIFICATION',
  BLOCKED: 'BLOCKED',
});

const OFFLINE_MODE = Object.freeze({
  'offline-mode-mock-v1': {
    contractVersion: 'offline-mode-mock-v1',
    environment: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    modes: ['MOCK'],
    contractStatus: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsOfflineSales: true,
    allowsProduction: false,
    browserAuthoritativeFiscalization: false,
    maintenanceAutoEnableForbidden: true,
    evidenceReferences: ['G16-001', 'Phase 3 blueprint'],
  },
  'offline-mode-sandbox-live-v1': {
    contractVersion: 'offline-mode-sandbox-live-v1',
    environment: ['SANDBOX'],
    modes: ['SANDBOX'],
    contractStatus: OFFLINE_CONTRACT_STATUS.BLOCKED,
    allowsOfflineSales: false,
    blockerCodes: ['LIVE_OFFLINE_CONTRACT_UNVERIFIED'],
  },
  'offline-mode-production-v1': {
    contractVersion: 'offline-mode-production-v1',
    environment: ['PRODUCTION'],
    modes: ['PRODUCTION'],
    contractStatus: OFFLINE_CONTRACT_STATUS.BLOCKED,
    allowsOfflineSales: false,
    blockerCodes: ['PRODUCTION_OFFLINE_REQUIRES_CERTIFICATION'],
  },
});

const SIGNATURE = Object.freeze({
  'offline-sig-mock-hmac-v1': {
    contractVersion: 'offline-sig-mock-hmac-v1',
    algorithm: 'HMAC-SHA256',
    encoding: 'base64',
    keyType: 'MOCK_SYNTHETIC_ONLY',
    canonicalizationVersion: 'offline-canon-v1',
    contractStatus: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsSigning: true,
    browserSigningForbidden: true,
    onlineJwtForbiddenAsSigningKey: true,
    algorithmFallbackForbidden: true,
    evidenceReferences: ['G16-002', 'Q-040'],
  },
  'offline-sig-production-v1': {
    contractVersion: 'offline-sig-production-v1',
    contractStatus: OFFLINE_CONTRACT_STATUS.BLOCKED,
    allowsSigning: false,
    blockerCodes: ['PRODUCTION_SIGNATURE_CONTRACT_UNVERIFIED', 'REQUIRES_CERTIFICATION'],
  },
});

const NUMBERING = Object.freeze({
  'offline-number-mock-v1': {
    contractVersion: 'offline-number-mock-v1',
    separateFromOnline: true,
    maxPlusOneForbidden: true,
    restartMustNotReset: true,
    reuseForbidden: true,
    backwardMoveForbidden: true,
    contractStatus: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsAllocation: true,
  },
  'offline-number-production-v1': {
    contractVersion: 'offline-number-production-v1',
    contractStatus: OFFLINE_CONTRACT_STATUS.BLOCKED,
    allowsAllocation: false,
    blockerCodes: ['PRODUCTION_OFFLINE_NUMBERING_UNVERIFIED'],
  },
});

const RECEIPT = Object.freeze({
  'offline-receipt-mock-v1': {
    contractVersion: 'offline-receipt-mock-v1',
    claimAcceptanceBeforeUploadForbidden: true,
    inventValidationUrlForbidden: true,
    localAppUrlAsMraQrForbidden: true,
    pendingWording: 'Created in certified offline mode — awaiting MRA upload',
    acceptedWording: 'Offline transaction accepted by MRA',
    sandboxBannerRequired: true,
    contractStatus: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsReceipt: true,
  },
  'offline-receipt-production-v1': {
    contractVersion: 'offline-receipt-production-v1',
    contractStatus: OFFLINE_CONTRACT_STATUS.BLOCKED,
    allowsReceipt: false,
    blockerCodes: ['PRODUCTION_OFFLINE_RECEIPT_QR_UNVERIFIED'],
  },
});

const UPLOAD = Object.freeze({
  'offline-upload-mock-v1': {
    contractVersion: 'offline-upload-mock-v1',
    endpointPath: '/mock/offline-upload',
    HTTPMethod: 'POST',
    resultCardinality: 'SINGLE_OR_ORDERED_BATCH',
    blindRetryUnknownForbidden: true,
    acceptedResubmitForbidden: true,
    contractStatus: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsUpload: true,
  },
  'offline-upload-production-v1': {
    contractVersion: 'offline-upload-production-v1',
    contractStatus: OFFLINE_CONTRACT_STATUS.BLOCKED,
    allowsUpload: false,
    blockerCodes: ['PRODUCTION_OFFLINE_UPLOAD_UNVERIFIED'],
  },
});

function pick(registry, mockKey, prodKey, { environment = 'SANDBOX', mode = 'MOCK' } = {}) {
  const env = String(environment).toUpperCase();
  const m = String(mode).toUpperCase();
  if (m === 'MOCK' || env === 'DEVELOPMENT' || env === 'TEST') {
    return registry[mockKey];
  }
  if (env === 'PRODUCTION' || m === 'PRODUCTION') {
    return registry[prodKey];
  }
  // live sandbox → blocked production-style until verified
  return registry[prodKey] || Object.values(registry).find((c) => c.contractStatus === OFFLINE_CONTRACT_STATUS.BLOCKED);
}

export function resolveOfflineModeContract({ environment = 'SANDBOX', mode = 'MOCK' } = {}) {
  const env = String(environment).toUpperCase();
  const m = String(mode).toUpperCase();
  let contract;
  if (m === 'MOCK' || env === 'DEVELOPMENT' || env === 'TEST') {
    contract = OFFLINE_MODE['offline-mode-mock-v1'];
  } else if (env === 'PRODUCTION' || m === 'PRODUCTION') {
    contract = OFFLINE_MODE['offline-mode-production-v1'];
  } else {
    contract = OFFLINE_MODE['offline-mode-sandbox-live-v1'];
  }
  return {
    contract,
    allowsOfflineSales: Boolean(contract.allowsOfflineSales),
    decision: contract.contractStatus,
  };
}

export function resolveOfflineSignatureContract(opts = {}) {
  const contract = pick(SIGNATURE, 'offline-sig-mock-hmac-v1', 'offline-sig-production-v1', opts);
  return {
    contract,
    allowsSigning: Boolean(contract.allowsSigning),
    decision: contract.contractStatus,
  };
}

export function resolveOfflineNumberingContract(opts = {}) {
  const contract = pick(NUMBERING, 'offline-number-mock-v1', 'offline-number-production-v1', opts);
  return {
    contract,
    allowsAllocation: Boolean(contract.allowsAllocation),
    decision: contract.contractStatus,
  };
}

export function resolveOfflineReceiptContract(opts = {}) {
  const contract = pick(RECEIPT, 'offline-receipt-mock-v1', 'offline-receipt-production-v1', opts);
  return {
    contract,
    allowsReceipt: Boolean(contract.allowsReceipt),
    decision: contract.contractStatus,
  };
}

export function resolveOfflineUploadContract(opts = {}) {
  const contract = pick(UPLOAD, 'offline-upload-mock-v1', 'offline-upload-production-v1', opts);
  return {
    contract,
    allowsUpload: Boolean(contract.allowsUpload),
    decision: contract.contractStatus,
  };
}

export function getOfflineContractDecision() {
  return {
    offlineModeMock: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    offlineModeLiveSandbox: OFFLINE_CONTRACT_STATUS.BLOCKED,
    offlineModeProduction: OFFLINE_CONTRACT_STATUS.BLOCKED,
    signatureMock: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    signatureProduction: OFFLINE_CONTRACT_STATUS.BLOCKED,
    numberingMock: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    numberingProduction: OFFLINE_CONTRACT_STATUS.BLOCKED,
    receiptMock: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    receiptProduction: OFFLINE_CONTRACT_STATUS.BLOCKED,
    uploadMock: OFFLINE_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    uploadProduction: OFFLINE_CONTRACT_STATUS.BLOCKED,
    browserAuthoritativeFiscalization: 'PROHIBITED',
    navigatorOnlineInsufficient: true,
    localStorageAuthoritativeForbidden: true,
    maintenanceAutoEnableForbidden: true,
    note: 'Production offline disabled until MRA contracts + CERTIFIED_PRODUCTION evidence.',
  };
}

export function getOfflineContractRegistries() {
  return { OFFLINE_MODE, SIGNATURE, NUMBERING, RECEIPT, UPLOAD };
}

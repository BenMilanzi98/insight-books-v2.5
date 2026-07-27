/**
 * Phase 15 — Last Online / Last Offline Transaction contract registry.
 * Production and live-sandbox queries fail closed until verified.
 */

export const LAST_TX_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL_SANDBOX_ONLY: 'PROVISIONAL_SANDBOX_ONLY',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

export const LAST_TX_ENDPOINT_TYPE = Object.freeze({
  LAST_ONLINE_TRANSACTION: 'LAST_ONLINE_TRANSACTION',
  LAST_OFFLINE_TRANSACTION: 'LAST_OFFLINE_TRANSACTION',
});

const REGISTRY = Object.freeze({
  'last-online-mock-v1': {
    contractVersion: 'last-online-mock-v1',
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
    environment: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    modes: ['MOCK'],
    endpointPath: '/mock/last-online-transaction',
    HTTPMethod: 'GET',
    authenticationMode: 'MOCK_BEARER',
    requestHashRequired: false,
    requestSchemaVersion: '1',
    responseSchemaVersion: '1',
    terminalScope: true,
    SiteScope: true,
    taxpayerScope: true,
    resultCardinality: 'SINGLE_LATEST',
    ordering: 'LATEST_ONLY',
    absenceIsConclusive: false, // critical: absence ≠ not processed
    timeSemantics: 'serverTimestamp-ISO',
    fiscalNumberSemantics: 'exact-string',
    mraTransactionIdSemantics: 'exact-string',
    amountSemantics: 'decimal-string-2dp',
    acceptedStateEvidence: ['applicationStatus=SUCCESS|ACCEPTED'],
    rejectedStateEvidence: ['applicationStatus=REJECTED|VALIDATION_ERROR'],
    duplicateSemantics: 'REQUIRES_MRA_CLARIFICATION',
    configurationRefreshFields: ['shouldRefreshConfiguration'],
    terminalBlockFields: ['shouldBlockTerminal'],
    maximumResponseBytes: 65536,
    timeoutMs: 15000,
    retrySafety: 'RECONCILE_ONLY',
    contractStatus: LAST_TX_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsQuery: true,
    evidenceReferences: ['Phase 13 mock Sales', 'G15-001'],
  },
  'last-online-sandbox-live-v1': {
    contractVersion: 'last-online-sandbox-live-v1',
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
    environment: ['SANDBOX'],
    modes: ['SANDBOX'],
    contractStatus: LAST_TX_CONTRACT_STATUS.BLOCKED,
    allowsQuery: false,
    absenceIsConclusive: false,
    blockerCodes: ['LIVE_LAST_ONLINE_CONTRACT_UNVERIFIED'],
    evidenceReferences: ['G15-001', 'G12-003'],
  },
  'last-online-production-v1': {
    contractVersion: 'last-online-production-v1',
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
    environment: ['PRODUCTION'],
    modes: ['PRODUCTION'],
    contractStatus: LAST_TX_CONTRACT_STATUS.BLOCKED,
    allowsQuery: false,
    absenceIsConclusive: false,
    blockerCodes: ['PRODUCTION_LAST_ONLINE_CONTRACT_UNVERIFIED'],
    evidenceReferences: ['G15-002'],
  },
  'last-offline-blocked-v1': {
    contractVersion: 'last-offline-blocked-v1',
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_OFFLINE_TRANSACTION,
    environment: ['SANDBOX', 'PRODUCTION', 'DEVELOPMENT'],
    modes: ['MOCK', 'SANDBOX', 'PRODUCTION'],
    contractStatus: LAST_TX_CONTRACT_STATUS.BLOCKED,
    allowsQuery: false,
    absenceIsConclusive: false,
    blockerCodes: ['OFFLINE_LAST_TRANSACTION_DISABLED_UNTIL_CERTIFIED_OFFLINE'],
    evidenceReferences: ['G15-003', 'Phase 16'],
  },
});

export function getLastTransactionContractRegistry() {
  return REGISTRY;
}

export function resolveLastTransactionContract({
  endpointType = LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
  environment = 'SANDBOX',
  mode = 'MOCK',
} = {}) {
  const env = String(environment).toUpperCase();
  const m = String(mode).toUpperCase();

  if (endpointType === LAST_TX_ENDPOINT_TYPE.LAST_OFFLINE_TRANSACTION) {
    return {
      contract: REGISTRY['last-offline-blocked-v1'],
      allowsQuery: false,
      decision: LAST_TX_CONTRACT_STATUS.BLOCKED,
    };
  }

  let contract;
  if (m === 'MOCK' || env === 'DEVELOPMENT' || env === 'TEST') {
    contract = REGISTRY['last-online-mock-v1'];
  } else if (env === 'PRODUCTION' || m === 'PRODUCTION') {
    contract = REGISTRY['last-online-production-v1'];
  } else {
    contract = REGISTRY['last-online-sandbox-live-v1'];
  }

  return {
    contract,
    allowsQuery: Boolean(contract.allowsQuery),
    decision: contract.contractStatus,
  };
}

export function getLastTransactionContractDecision() {
  return {
    lastOnlineMock: LAST_TX_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    lastOnlineLiveSandbox: LAST_TX_CONTRACT_STATUS.BLOCKED,
    lastOnlineProduction: LAST_TX_CONTRACT_STATUS.BLOCKED,
    lastOffline: LAST_TX_CONTRACT_STATUS.BLOCKED,
    absenceIsConclusive: false,
    note: 'Single latest transaction ≠ authoritative history. Absence is not conclusive non-processing.',
  };
}

/**
 * Fiscal Number Contract Registry — Phase 12.
 * Production allocation is blocked until MRA numbering contract is verified.
 * Never use local Invoice/POS numbers as MRA fiscal numbers without verified permission.
 * Never use MAX(number)+1.
 */

export const FISCAL_NUMBER_CONTRACT_VERSION = 'phase12-fiscal-number-contract-v1';

export const CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL: 'PROVISIONAL',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  BLOCKED: 'BLOCKED',
});

export const ONLINE_OFFLINE_NUMBER_POLICY = Object.freeze({
  SHARED_SEQUENCE: 'SHARED_SEQUENCE',
  SEPARATE_ONLINE_OFFLINE_SEQUENCES: 'SEPARATE_ONLINE_OFFLINE_SEQUENCES',
  OFFLINE_RANGE_RESERVATION: 'OFFLINE_RANGE_RESERVATION',
  MRA_ASSIGNED_OFFLINE_RANGE: 'MRA_ASSIGNED_OFFLINE_RANGE',
  UNKNOWN: 'UNKNOWN',
  BLOCKED: 'BLOCKED',
});

const contracts = [
  {
    key: 'SANDBOX_SYNTHETIC_TERMINAL_DAILY',
    environment: 'SANDBOX',
    sourceTransactionTypes: ['POS_SALE', 'SALES_INVOICE'],
    numberFieldName: 'fiscalNumber',
    numberFormat: 'SYN-{terminalShort}-{yyyyMMdd}-{seq6}',
    numericOrAlphanumeric: 'ALPHANUMERIC',
    prefixRules: 'SYN- label required for non-production',
    suffixRules: null,
    minLength: 16,
    maxLength: 64,
    padding: 6,
    allowedCharacters: 'A-Z0-9-',
    sequenceScope: 'TERMINAL_BUSINESS_DATE_ENVIRONMENT',
    resetPolicy: 'PER_BUSINESS_DAY',
    startingValue: 1,
    increment: 1,
    onlineOfflinePolicy: ONLINE_OFFLINE_NUMBER_POLICY.SEPARATE_ONLINE_OFFLINE_SEQUENCES,
    uniquenessScope: 'TERMINAL_BUSINESS_DATE_ENVIRONMENT',
    gapRules: 'PRESERVE_CONSUMED_VALUES',
    reuseRules: 'NEVER_SILENT_REUSE',
    cancellationRules: 'VOID_PRESERVES_VALUE',
    contractStatus: CONTRACT_STATUS.PROVISIONAL,
    sourceEvidence: 'Phase 12 synthetic sandbox numbering only — not an MRA fiscal number',
    effectiveDate: '2026-07-22',
    isMraFiscalNumber: false,
    syntheticOnly: true,
  },
  {
    key: 'PRODUCTION_MRA_FISCAL_NUMBER',
    environment: 'PRODUCTION',
    sourceTransactionTypes: ['POS_SALE', 'SALES_INVOICE'],
    numberFieldName: 'fiscalNumber',
    numberFormat: 'UNVERIFIED',
    numericOrAlphanumeric: 'UNKNOWN',
    prefixRules: 'UNKNOWN',
    suffixRules: 'UNKNOWN',
    minLength: null,
    maxLength: null,
    padding: null,
    allowedCharacters: 'UNKNOWN',
    sequenceScope: 'UNKNOWN',
    resetPolicy: 'UNKNOWN',
    startingValue: null,
    increment: 1,
    onlineOfflinePolicy: ONLINE_OFFLINE_NUMBER_POLICY.BLOCKED,
    uniquenessScope: 'UNKNOWN',
    gapRules: 'PRESERVE_ALL',
    reuseRules: 'NEVER_SILENT_REUSE',
    cancellationRules: 'UNKNOWN',
    contractStatus: CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    sourceEvidence: 'Phase 1 Clarification Register — fiscal number format/scope unresolved',
    effectiveDate: null,
    isMraFiscalNumber: true,
    syntheticOnly: false,
  },
];

export function getMraEisFiscalNumberContractRegistry() {
  return {
    version: FISCAL_NUMBER_CONTRACT_VERSION,
    contracts,
    offlineAllocationDefault: 'DISABLED',
    maxPlusOneProhibited: true,
    localInvoiceNumberAsFiscalProhibited: true,
  };
}

export function resolveFiscalNumberContract({ environment = 'SANDBOX' } = {}) {
  const env = String(environment).toUpperCase();
  const entry = contracts.find((c) => c.environment === env) || contracts.find((c) => c.environment === 'PRODUCTION');
  const allowsAllocation =
    entry &&
    (entry.contractStatus === CONTRACT_STATUS.VERIFIED ||
      entry.contractStatus === CONTRACT_STATUS.VERIFIED_IN_SANDBOX ||
      (entry.syntheticOnly &&
        entry.environment === 'SANDBOX' &&
        process.env.MRA_EIS_ALLOW_SYNTHETIC_FISCAL_NUMBERS !== '0'));

  return {
    contract: entry,
    allowsAllocation: Boolean(allowsAllocation),
    productionBlocked:
      env === 'PRODUCTION' ||
      entry?.contractStatus === CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION ||
      entry?.contractStatus === CONTRACT_STATUS.BLOCKED,
    isSynthetic: Boolean(entry?.syntheticOnly),
    message: allowsAllocation
      ? entry.syntheticOnly
        ? 'Synthetic sandbox fiscal number allowed (not an MRA fiscal number).'
        : 'Verified fiscal number allocation allowed.'
      : 'Fiscal-number contract unverified — production allocation blocked.',
    registryVersion: FISCAL_NUMBER_CONTRACT_VERSION,
  };
}

export function getOnlineOfflineNumberPolicy() {
  return {
    policy: ONLINE_OFFLINE_NUMBER_POLICY.BLOCKED,
    offlineAllocationEnabled: false,
    reason: 'Certified offline numbering disabled until certification + verified architecture.',
    policyVersion: 'phase12-online-offline-v1',
  };
}

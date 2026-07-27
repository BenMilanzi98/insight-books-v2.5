/**
 * Phase 14 — versioned Receipt Contract Registry.
 * Production generation blocked where mandatory QR/receipt semantics remain unresolved.
 */

export const RECEIPT_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL_SANDBOX_ONLY: 'PROVISIONAL_SANDBOX_ONLY',
  PARTIALLY_VERIFIED: 'PARTIALLY_VERIFIED',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

export const RECEIPT_TYPE = Object.freeze({
  POS_FISCAL_RECEIPT_58MM: 'POS_FISCAL_RECEIPT_58MM',
  POS_FISCAL_RECEIPT_80MM: 'POS_FISCAL_RECEIPT_80MM',
  POS_BROWSER_PRINT: 'POS_BROWSER_PRINT',
  SALES_INVOICE_FISCAL_A4: 'SALES_INVOICE_FISCAL_A4',
  SALES_INVOICE_FISCAL_HTML: 'SALES_INVOICE_FISCAL_HTML',
  FISCAL_RECEIPT_EMAIL: 'FISCAL_RECEIPT_EMAIL',
  FISCAL_RECEIPT_EVIDENCE_EXPORT: 'FISCAL_RECEIPT_EVIDENCE_EXPORT',
});

const SHARED_WORDING = Object.freeze({
  originalWording: 'ORIGINAL',
  reprintWording: 'REPRINT / COPY — NOT A NEW SALE',
  onlineWording: 'Online fiscal receipt — Accepted by MRA',
  offlineWording: 'Offline certified receipt — not implemented in Phase 14',
  validationWording:
    'Scan the QR code or open the validation URL to verify this receipt with MRA.',
  sandboxBanner: 'SANDBOX / TEST — NOT A PRODUCTION FISCAL RECEIPT',
  noCertificationClaim: true,
});

/** @type {Record<string, object>} */
const REGISTRY = Object.freeze({
  'receipt-contract-mock-v1': {
    contractVersion: 'receipt-contract-mock-v1',
    environment: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    modes: ['MOCK'],
    receiptTypes: [
      RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM,
      RECEIPT_TYPE.POS_BROWSER_PRINT,
      RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4,
      RECEIPT_TYPE.SALES_INVOICE_FISCAL_HTML,
      RECEIPT_TYPE.FISCAL_RECEIPT_EMAIL,
      RECEIPT_TYPE.FISCAL_RECEIPT_EVIDENCE_EXPORT,
    ],
    unsupportedReceiptTypes: [RECEIPT_TYPE.POS_FISCAL_RECEIPT_58MM],
    supportedSourceTypes: ['POS_SALE', 'SALES_INVOICE'],
    requiredSellerFields: ['legalName', 'sellerTin'],
    requiredBuyerFields: [],
    requiredFiscalFields: ['fiscalNumber', 'mraTransactionId', 'transactionDateTime'],
    requiredLineFields: ['lineNumber', 'description', 'quantity', 'unitPrice', 'grossAmount'],
    requiredTaxFields: ['taxableAmount', 'taxAmount'],
    requiredLevyFields: [],
    requiredPaymentFields: ['classification', 'totalPaymentAmount'],
    requiredValidationFields: ['validationUrlOrQrPayload', 'mraTransactionId'],
    requiredFooterText: [
      SHARED_WORDING.validationWording,
      'This document is derived from accepted MRA response evidence and an immutable fiscal snapshot.',
    ],
    ...SHARED_WORDING,
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
    currencyFormat: 'code-with-2dp',
    decimalPolicy: { moneyScale: 2, quantityScale: 6 },
    QRSourceContractVersion: 'qr-source-mock-v1',
    templateVersion: 'tpl-pos80-mock-v1',
    minimumQRSizeMm: 20,
    QRQuietZoneModules: 4,
    QRErrorCorrection: 'M',
    effectiveFrom: '2026-07-01T00:00:00.000Z',
    effectiveTo: null,
    contractStatus: RECEIPT_CONTRACT_STATUS.PROVISIONAL_SANDBOX_ONLY,
    allowsGeneration: true,
    evidenceReferences: [
      'Phase 1 Clarification Register (provisional)',
      'Phase 13 mock accepted response',
      'docs/mra-eis/phase-14/RECEIPT_QR_CONTRACT_DECISION.md',
    ],
  },
  'receipt-contract-sandbox-live-v1': {
    contractVersion: 'receipt-contract-sandbox-live-v1',
    environment: ['SANDBOX'],
    modes: ['SANDBOX'],
    receiptTypes: Object.values(RECEIPT_TYPE),
    unsupportedReceiptTypes: [RECEIPT_TYPE.POS_FISCAL_RECEIPT_58MM],
    contractStatus: RECEIPT_CONTRACT_STATUS.BLOCKED,
    allowsGeneration: false,
    blockerCodes: ['LIVE_SANDBOX_RECEIPT_CONTRACT_UNVERIFIED', 'QR_PAYLOAD_SEMANTICS_UNVERIFIED'],
    QRSourceContractVersion: 'qr-source-sandbox-live-v1',
    evidenceReferences: ['G14-001', 'G13-001', 'G13-002'],
    ...SHARED_WORDING,
  },
  'receipt-contract-production-v1': {
    contractVersion: 'receipt-contract-production-v1',
    environment: ['PRODUCTION'],
    modes: ['PRODUCTION'],
    receiptTypes: Object.values(RECEIPT_TYPE),
    unsupportedReceiptTypes: [RECEIPT_TYPE.POS_FISCAL_RECEIPT_58MM],
    contractStatus: RECEIPT_CONTRACT_STATUS.BLOCKED,
    allowsGeneration: false,
    blockerCodes: [
      'PRODUCTION_RECEIPT_CONTRACT_UNVERIFIED',
      'PRODUCTION_QR_SOURCE_UNVERIFIED',
      'PRODUCTION_FISCAL_NUMBER_CONTRACT_BLOCKED',
    ],
    QRSourceContractVersion: 'qr-source-production-v1',
    evidenceReferences: ['G14-002', 'Phase 12 production fiscal-number block'],
    ...SHARED_WORDING,
  },
});

export function getReceiptContractRegistry() {
  return REGISTRY;
}

export function resolveReceiptContract({ environment, mode = 'MOCK', receiptType = null } = {}) {
  const env = String(environment || 'SANDBOX').toUpperCase();
  const m = String(mode || 'MOCK').toUpperCase();

  let contract;
  if (m === 'MOCK' || env === 'DEVELOPMENT' || env === 'TEST') {
    contract = REGISTRY['receipt-contract-mock-v1'];
  } else if (env === 'PRODUCTION' || m === 'PRODUCTION') {
    contract = REGISTRY['receipt-contract-production-v1'];
  } else {
    contract = REGISTRY['receipt-contract-sandbox-live-v1'];
  }

  const typeBlocked =
    receiptType &&
    Array.isArray(contract.unsupportedReceiptTypes) &&
    contract.unsupportedReceiptTypes.includes(receiptType);

  return {
    contract,
    allowsGeneration: Boolean(contract.allowsGeneration) && !typeBlocked,
    typeBlocked,
    decision: contract.contractStatus,
    receiptType,
  };
}

export function getReceiptContractDecision() {
  return {
    mock: REGISTRY['receipt-contract-mock-v1'].contractStatus,
    sandboxLive: REGISTRY['receipt-contract-sandbox-live-v1'].contractStatus,
    production: REGISTRY['receipt-contract-production-v1'].contractStatus,
    productionGeneration: 'BLOCKED',
    liveSandboxGeneration: 'BLOCKED',
    mockGeneration: 'PROVISIONAL_SANDBOX_ONLY',
    pos58mm: 'UNSUPPORTED_UNTIL_COMPLIANT_FIT',
    decisionDocument: 'docs/mra-eis/phase-14/RECEIPT_QR_CONTRACT_DECISION.md',
  };
}

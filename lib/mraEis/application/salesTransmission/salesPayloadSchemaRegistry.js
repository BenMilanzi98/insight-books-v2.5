/**
 * Sales payload / response schema registries — Phase 13 (provisional mock-oriented).
 */

export const SALES_PAYLOAD_SCHEMA_VERSION = 'SALES_PAYLOAD_V1_PROVISIONAL';
export const SALES_RESPONSE_SCHEMA_VERSION = 'SALES_RESPONSE_V1_PROVISIONAL';
export const SALES_MAPPER_VERSION = 'phase13-sales-mapper-v1';

export function getSalesPayloadSchemaRegistry() {
  return {
    version: SALES_PAYLOAD_SCHEMA_VERSION,
    mapperVersion: SALES_MAPPER_VERSION,
    header: {
      required: [
        'sellerTIN',
        'terminalId',
        'fiscalNumber',
        'invoiceDateTime',
        'currency',
        'invoiceTotal',
        'onlineIndicator',
      ],
      forbidden: ['journalEntryId', 'stockMovementId', 'chartOfAccountCode', 'tenantId', 'businessId'],
      decimalScale: 2,
      dateFormat: 'ISO8601',
    },
    buyer: {
      conditionalB2B: ['buyerTIN', 'buyerName'],
      anonymousB2C: { omitTin: true },
    },
    line: {
      required: ['lineNumber', 'itemCode', 'description', 'quantity', 'unitPrice', 'lineTotal'],
      decimalQuantityScale: 6,
      decimalMoneyScale: 2,
    },
    taxSummary: { required: ['taxableAmount', 'taxAmount'] },
    levy: { optional: true },
    vat5: { distinctFromZeroRated: true, blockedUntilVerified: true },
    payment: { requireAllComponents: true, creditPreserved: true },
    amountTendered: { requiredWhenCash: true },
    offlineFields: { omitForOnline: true, inventOfflineSignature: false },
    unknownFieldPolicy: 'REJECT',
    nullPolicy: 'OMIT_UNDEFINED',
  };
}

export function getSalesResponseSchemaRegistry() {
  return {
    version: SALES_RESPONSE_SCHEMA_VERSION,
    parserVersion: 'phase13-response-parser-v1',
    validatorVersion: 'phase13-response-validator-v1',
    classifierVersion: 'phase13-app-status-classifier-v1',
    envelope: {
      applicationStatusField: 'responseCode',
      remarkField: 'remark',
      transactionIdField: 'mraTransactionId',
      validationUrlField: 'validationUrl',
      qrDataField: 'qrData',
      refreshField: 'shouldRefreshConfiguration',
      blockField: 'shouldBlockTerminal',
    },
    httpSuccessAloneNotAcceptance: true,
    missingTransactionIdBlocksAcceptance: true,
    maximumResponseBytes: 512000,
    unknownFieldPolicy: 'RETAIN_SAFE',
  };
}

/**
 * Deterministic mock Last Online Transaction server — Phase 15.
 * Synthetic data only. Not certification evidence.
 */

let scenario = 'MATCH_ACCEPTED';
let callLog = [];
let seedTransaction = null;

export function resetMockLastTransactionState() {
  scenario = 'MATCH_ACCEPTED';
  callLog = [];
  seedTransaction = null;
}

export function setMockLastTransactionScenario(name) {
  scenario = String(name || 'MATCH_ACCEPTED').toUpperCase();
}

export function seedMockLastTransaction(txn) {
  seedTransaction = txn ? { ...txn } : null;
}

export function getMockLastTransactionCallLog() {
  return [...callLog];
}

/**
 * @param {{ fiscalNumber?: string, terminalId?: string, environment?: string, expected?: object }} args
 */
export async function mockQueryLastOnlineTransaction({
  fiscalNumber = null,
  terminalId = null,
  environment = 'SANDBOX',
  expected = null,
} = {}) {
  callLog.push({
    at: new Date().toISOString(),
    scenario,
    fiscalNumber,
    terminalId,
    // never log credentials
  });

  const base = {
    taxpayerTin: expected?.sellerTin || 'TIN123',
    mraTerminalId: expected?.mraTerminalId || 'MRA-T1',
    localTerminalId: terminalId,
    siteId: expected?.siteMappingId || 'site-1',
    currency: expected?.currency || 'MWK',
    environment,
    onlineOrOfflineMode: 'ONLINE',
    serverTimestamp: new Date().toISOString(),
    shouldRefreshConfiguration: false,
    shouldBlockTerminal: false,
  };

  switch (scenario) {
    case 'MATCH_ACCEPTED':
      return respond(200, {
        ...base,
        ...(seedTransaction || {}),
        fiscalNumber: fiscalNumber || seedTransaction?.fiscalNumber || expected?.fiscalNumber,
        sourceTransactionNumber: expected?.localDocumentNumber || 'POS-1',
        mraTransactionId: seedTransaction?.mraTransactionId || `MOCK-RECON-${Date.now()}`,
        transactionDate: expected?.transactionDate || new Date().toISOString(),
        grossAmount: expected?.grossTotal || '100.00',
        taxAmount: expected?.taxTotal || '0.00',
        levyAmount: expected?.levyTotal || '0.00',
        applicationStatus: 'SUCCESS',
        responseCode: 'SUCCESS',
      });

    case 'DIFFERENT_LATEST':
      return respond(200, {
        ...base,
        fiscalNumber: 'SYN-OTHER-999999',
        mraTransactionId: 'MOCK-OTHER',
        grossAmount: '50.00',
        taxAmount: '0.00',
        levyAmount: '0.00',
        applicationStatus: 'SUCCESS',
      });

    case 'TARGET_ABSENT':
    case 'NO_TRANSACTION':
      return respond(200, { noTransaction: true, environment });

    case 'AMOUNT_MISMATCH':
      return respond(200, {
        ...base,
        fiscalNumber,
        mraTransactionId: 'MOCK-AMT-MISMATCH',
        grossAmount: '999.99',
        taxAmount: '0.00',
        levyAmount: '0.00',
        applicationStatus: 'SUCCESS',
      });

    case 'DUPLICATE_ACCEPTED':
      return respond(200, {
        ...base,
        fiscalNumber,
        mraTransactionId: 'MOCK-DUP',
        grossAmount: expected?.grossTotal || '100.00',
        taxAmount: expected?.taxTotal || '0.00',
        levyAmount: expected?.levyTotal || '0.00',
        applicationStatus: 'SUCCESS',
        duplicate: true,
        duplicateIndicator: true,
      });

    case 'REJECTED':
      return respond(200, {
        ...base,
        fiscalNumber,
        mraTransactionId: null,
        grossAmount: expected?.grossTotal || '100.00',
        applicationStatus: 'REJECTED',
        responseCode: 'VALIDATION_ERROR',
      });

    case 'CONFIG_REFRESH':
      return respond(200, {
        ...base,
        fiscalNumber,
        mraTransactionId: 'MOCK-REFRESH',
        grossAmount: expected?.grossTotal || '100.00',
        applicationStatus: 'SUCCESS',
        shouldRefreshConfiguration: true,
      });

    case 'TERMINAL_BLOCK':
      return respond(200, {
        ...base,
        fiscalNumber,
        mraTransactionId: 'MOCK-BLOCK',
        grossAmount: expected?.grossTotal || '100.00',
        applicationStatus: 'SUCCESS',
        shouldBlockTerminal: true,
      });

    case 'MRA_AHEAD':
      return respond(200, {
        ...base,
        fiscalNumber: 'SYN-AHEAD-000099',
        mraTransactionId: 'MOCK-AHEAD',
        grossAmount: '200.00',
        applicationStatus: 'SUCCESS',
        mraAhead: true,
      });

    case 'HTTP_401':
      return respond(401, { responseCode: 'UNAUTHORIZED', remark: 'Auth failed (mock)' });

    case 'HTTP_429':
      return respond(429, {
        responseCode: 'RATE_LIMITED',
        remark: 'Rate limited (mock)',
        retryAfterSeconds: 60,
      });

    case 'HTTP_503':
      return respond(503, { responseCode: 'MAINTENANCE', remark: 'MRA maintenance (mock)' });

    case 'TIMEOUT':
      return {
        httpStatus: null,
        errorKind: 'TIMEOUT',
        body: null,
        bodyText: '',
        responseChecksum: null,
      };

    case 'MALFORMED':
      return {
        httpStatus: 200,
        body: null,
        bodyText: '{not-json',
        parseError: 'MALFORMED_JSON',
        responseChecksum: null,
      };

    default:
      return respond(200, {
        ...base,
        fiscalNumber,
        applicationStatus: 'SUCCESS',
        grossAmount: expected?.grossTotal || '100.00',
        mraTransactionId: `MOCK-DEFAULT-${Date.now()}`,
      });
  }
}

function respond(httpStatus, body) {
  const bodyText = JSON.stringify(body);
  return {
    httpStatus,
    body,
    bodyText,
    contentType: 'application/json',
    responseByteLength: bodyText.length,
  };
}

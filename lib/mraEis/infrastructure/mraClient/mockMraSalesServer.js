/**
 * Deterministic mock MRA Sales server — Phase 13.
 * Synthetic data only. Not certification evidence.
 */

let scenario = 'ACCEPT_STANDARD';
let callLog = [];

export function resetMockSalesState() {
  scenario = 'ACCEPT_STANDARD';
  callLog = [];
}

export function setMockSalesScenario(name) {
  scenario = String(name || 'ACCEPT_STANDARD').toUpperCase();
}

export function getMockSalesCallLog() {
  return [...callLog];
}

/**
 * @param {{ body: object, headers?: object, fiscalNumber?: string }} args
 */
export async function mockSubmitSalesTransaction({ body, headers = {}, fiscalNumber = null } = {}) {
  const started = Date.now();
  const hash = headers['x-eis-message-hash'] || headers['X-Eis-Message-Hash'];
  const auth = headers.Authorization || headers.authorization;

  callLog.push({
    at: new Date().toISOString(),
    scenario,
    hasHash: Boolean(hash),
    hasAuth: Boolean(auth),
    fiscalNumber: fiscalNumber || body?.header?.fiscalNumber,
    // Never log JWT/hash values
  });

  if (!hash) {
    return respond(400, {
      responseCode: 'VALIDATION_ERROR',
      remark: 'Missing x-eis-message-hash',
      shouldRefreshConfiguration: false,
      shouldBlockTerminal: false,
    });
  }
  if (!auth || !String(auth).startsWith('Bearer ')) {
    return respond(401, {
      responseCode: 'REJECTED',
      remark: 'Unauthorized',
      shouldRefreshConfiguration: false,
      shouldBlockTerminal: false,
    });
  }

  switch (scenario) {
    case 'ACCEPT_STANDARD':
    case 'ACCEPT_PRODUCT':
    case 'ACCEPT_CREDIT':
      return respond(200, {
        responseCode: 'SUCCESS',
        remark: 'Accepted (mock)',
        mraTransactionId: `MOCK-TXN-${Date.now()}`,
        validationUrl: 'https://mock.mra.local/validate/MOCK',
        qrData: 'MOCK_QR_DATA_NOT_RENDERED_IN_PHASE_13',
        shouldRefreshConfiguration: false,
        shouldBlockTerminal: false,
        serverTimestamp: new Date().toISOString(),
      });

    case 'ACCEPT_WITH_REFRESH':
      return respond(200, {
        responseCode: 'SUCCESS',
        remark: 'Accepted with configuration refresh (mock)',
        mraTransactionId: `MOCK-TXN-REFRESH-${Date.now()}`,
        validationUrl: 'https://mock.mra.local/validate/MOCK',
        qrData: 'MOCK_QR_DATA',
        shouldRefreshConfiguration: true,
        shouldBlockTerminal: false,
      });

    case 'ACCEPT_WITH_TERMINAL_BLOCK':
      return respond(200, {
        responseCode: 'SUCCESS',
        remark: 'Accepted with terminal block (mock)',
        mraTransactionId: `MOCK-TXN-BLOCK-${Date.now()}`,
        validationUrl: 'https://mock.mra.local/validate/MOCK',
        qrData: 'MOCK_QR_DATA',
        shouldRefreshConfiguration: false,
        shouldBlockTerminal: true,
      });

    case 'REJECT_VALIDATION':
      return respond(200, {
        responseCode: 'VALIDATION_ERROR',
        remark: 'Invalid Product code (mock)',
        validationErrors: [{ field: 'lines[0].itemCode', code: 'INVALID_PRODUCT' }],
        shouldRefreshConfiguration: false,
        shouldBlockTerminal: false,
      });

    case 'HTTP_200_UNKNOWN_CODE':
      return respond(200, {
        responseCode: 'WEIRD_UNDOCUMENTED_CODE',
        remark: 'Unrecognized',
        mraTransactionId: null,
      });

    case 'HTTP_200_MALFORMED':
      return {
        ok: true,
        httpStatus: 200,
        contentType: 'application/json',
        bodyText: '{not-json',
        body: null,
        parseError: 'MALFORMED_JSON',
        durationMs: Date.now() - started,
      };

    case 'HTTP_401':
      return respond(401, { responseCode: 'REJECTED', remark: 'Unauthorized' });

    case 'HTTP_429':
      return respond(429, { responseCode: 'RETRY', remark: 'Rate limited' });

    case 'HTTP_500':
      return respond(500, { responseCode: 'RETRY', remark: 'Server error' });

    case 'TIMEOUT':
      return {
        ok: false,
        httpStatus: null,
        contentType: null,
        body: null,
        bodyText: null,
        errorKind: 'TIMEOUT',
        durationMs: Date.now() - started,
      };

    case 'DUPLICATE':
      return respond(200, {
        responseCode: 'VALIDATION_ERROR',
        remark: 'Duplicate transaction (mock)',
        mraTransactionId: null,
      });

    default:
      return respond(200, {
        responseCode: 'SUCCESS',
        remark: 'Accepted (mock default)',
        mraTransactionId: `MOCK-TXN-${Date.now()}`,
        validationUrl: 'https://mock.mra.local/validate/MOCK',
        qrData: 'MOCK_QR_DATA',
        shouldRefreshConfiguration: false,
        shouldBlockTerminal: false,
      });
  }

  function respond(httpStatus, body) {
    return {
      ok: httpStatus >= 200 && httpStatus < 300,
      httpStatus,
      contentType: 'application/json',
      body,
      bodyText: JSON.stringify(body),
      durationMs: Date.now() - started,
      isMock: true,
    };
  }
}

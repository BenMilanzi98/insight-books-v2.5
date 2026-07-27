/**
 * Deterministic mock Offline MRA upload server — synthetic data only.
 */

let scenario = 'ACCEPT';
let callLog = [];

export function resetMockOfflineUploadState() {
  scenario = 'ACCEPT';
  callLog = [];
}

export function setMockOfflineUploadScenario(name) {
  scenario = String(name || 'ACCEPT').toUpperCase();
}

export function getMockOfflineUploadCallLog() {
  return [...callLog];
}

export async function mockOfflineUpload({
  offlineFiscalNumber = null,
  offlineSignature = null,
  queueSequence = null,
  environment = 'SANDBOX',
} = {}) {
  callLog.push({
    at: new Date().toISOString(),
    scenario,
    offlineFiscalNumber,
    queueSequence,
    // never log keys/JWT
  });

  switch (scenario) {
    case 'ACCEPT':
      return respond(200, {
        applicationStatus: 'SUCCESS',
        responseCode: 'SUCCESS',
        mraTransactionId: `MOCK-OFF-${Date.now()}`,
        offlineFiscalNumber,
        environment,
      });
    case 'REJECT_SIGNATURE':
      return respond(200, {
        applicationStatus: 'REJECTED',
        responseCode: 'INVALID_SIGNATURE',
        offlineFiscalNumber,
      });
    case 'REJECT_DUPLICATE':
      return respond(200, {
        applicationStatus: 'REJECTED',
        responseCode: 'DUPLICATE',
        duplicateIndicator: true,
        offlineFiscalNumber,
      });
    case 'OUT_OF_ORDER':
      return respond(200, {
        applicationStatus: 'REJECTED',
        responseCode: 'OUT_OF_ORDER',
        offlineFiscalNumber,
      });
    case 'TERMINAL_BLOCK':
      return respond(200, {
        applicationStatus: 'REJECTED',
        responseCode: 'TERMINAL_BLOCKED',
        shouldBlockTerminal: true,
        offlineFiscalNumber,
      });
    case 'CONFIG_REFRESH':
      return respond(200, {
        applicationStatus: 'SUCCESS',
        responseCode: 'SUCCESS',
        shouldRefreshConfiguration: true,
        mraTransactionId: `MOCK-OFF-CFG-${Date.now()}`,
        offlineFiscalNumber,
      });
    case 'TIMEOUT':
      return {
        httpStatus: null,
        timedOut: true,
        body: null,
        outcome: 'UNKNOWN_OUTCOME',
      };
    case 'HTTP_500':
      return respond(500, { error: 'INTERNAL' });
    case 'HTTP_429':
      return respond(429, { error: 'RATE_LIMIT', retryAfterSeconds: 30 });
    default:
      return respond(200, {
        applicationStatus: 'UNKNOWN_CODE',
        responseCode: 'UNKNOWN',
        offlineFiscalNumber,
      });
  }
}

function respond(httpStatus, body) {
  return {
    httpStatus,
    timedOut: false,
    body,
    outcome:
      httpStatus >= 500
        ? 'TEMPORARY_FAILURE'
        : body.applicationStatus === 'SUCCESS'
          ? 'ACCEPTED'
          : body.applicationStatus === 'REJECTED'
            ? 'REJECTED'
            : 'UNKNOWN_OUTCOME',
  };
}

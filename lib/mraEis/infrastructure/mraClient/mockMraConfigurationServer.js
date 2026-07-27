import crypto from 'crypto';
import { CONFIGURATION_TYPE } from '../../domain/operationalEnums.js';

/**
 * Deterministic mock MRA configuration server — synthetic data only.
 */

const STATE = {
  versions: {
    GLOBAL: 'mock-g-2',
    TERMINAL: 'mock-t-2',
    TAXPAYER: 'mock-p-2',
  },
  scenario: null,
};

export function resetMockConfigState() {
  STATE.scenario = null;
  STATE.versions = { GLOBAL: 'mock-g-2', TERMINAL: 'mock-t-2', TAXPAYER: 'mock-p-2' };
}

export function setMockConfigScenario(scenario) {
  STATE.scenario = scenario;
}

function payloadFor(type, requestBody) {
  const version = STATE.versions[type];
  if (type === CONFIGURATION_TYPE.GLOBAL) {
    return {
      version,
      effectiveFrom: new Date().toISOString(),
      taxRates: [
        { id: 'TAX-A', code: 'A', name: 'Standard VAT', rate: 17.5, chargeMode: 'PERCENT', category: 'VAT', active: true },
        { id: 'TAX-B', code: 'B', name: 'Zero rated', rate: 0, chargeMode: 'PERCENT', category: 'ZERO', active: true },
      ],
      levies: [{ id: 'LEVY-1', code: 'TL', name: 'Tourism levy', rate: 1, chargeMode: 'PERCENT', active: true }],
      receiptRequirements: {
        version: 'rcpt-1',
        requiredSellerFields: ['tin', 'name'],
        requiredBuyerFields: ['tin'],
        qrRequired: true,
      },
      offlinePolicies: { offlineAllowed: false, maximumAmount: 0, maximumAgeHours: 0 },
    };
  }
  if (type === CONFIGURATION_TYPE.TERMINAL) {
    return {
      version,
      terminalId: requestBody?.terminalId,
      terminalBlocked: false,
      offlineAllowed: false,
      offlineMaximumAmount: 0,
      offlineMaximumAgeHours: 0,
      configurationRefreshHours: 24,
      description: 'Mock terminal configuration',
    };
  }
  return {
    version,
    tin: requestBody?.taxpayerTin || 'TEST-TIN-0001',
    legalName: 'Mock Taxpayer Ltd',
    tradingName: 'Mock Trading',
    status: 'ACTIVE',
  };
}

export async function mockGetConfiguration(configurationType, requestBody, { scenario } = {}) {
  const sc = scenario || STATE.scenario || 'SUCCESS';

  if (sc === 'TIMEOUT') {
    const err = new Error('Mock configuration timeout after dispatch');
    err.code = 'MOCK_TIMEOUT_AFTER_DISPATCH';
    err.dispatched = true;
    throw err;
  }
  if (sc === 'HTTP_429') {
    return { httpStatus: 429, body: { statusCode: 0, remark: 'Rate limited', errors: [{ code: 'RATE_LIMIT' }] } };
  }
  if (sc === 'HTTP_500') {
    return { httpStatus: 500, body: { statusCode: 0, remark: 'Server error', errors: [{ code: 'SERVER_ERROR' }] } };
  }
  if (sc === 'INVALID_SCHEMA') {
    return { httpStatus: 200, body: { statusCode: 1, remark: 'ok', data: { configuration: { /* no version */ taxRates: [] } } } };
  }
  if (sc === 'TIN_MISMATCH' && configurationType === CONFIGURATION_TYPE.TAXPAYER) {
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        remark: 'ok',
        data: { configuration: { ...payloadFor(configurationType, requestBody), tin: 'OTHER-TIN-9999' } },
      },
    };
  }
  if (sc === 'TERMINAL_MISMATCH' && configurationType === CONFIGURATION_TYPE.TERMINAL) {
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        remark: 'ok',
        data: { configuration: { ...payloadFor(configurationType, requestBody), terminalId: 'OTHER-TID' } },
      },
    };
  }
  if (sc === 'TERMINAL_BLOCKED' && configurationType === CONFIGURATION_TYPE.TERMINAL) {
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        remark: 'blocked',
        data: { configuration: { ...payloadFor(configurationType, requestBody), terminalBlocked: true } },
      },
    };
  }
  if (sc === 'NO_CHANGE') {
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        remark: 'unchanged',
        data: {
          configuration: {
            ...payloadFor(configurationType, requestBody),
            version: requestBody?.currentVersion || STATE.versions[configurationType],
            unchanged: true,
          },
        },
      },
    };
  }
  if (sc === 'SAME_VERSION_CONFLICT') {
    const base = payloadFor(configurationType, requestBody);
    return {
      httpStatus: 200,
      body: {
        statusCode: 1,
        remark: 'conflict payload',
        data: {
          configuration: {
            ...base,
            version: requestBody?.currentVersion || base.version,
            conflictMarker: crypto.randomBytes(4).toString('hex'),
          },
        },
      },
    };
  }
  if (sc === 'TAXPAYER_FAIL' && configurationType === CONFIGURATION_TYPE.TAXPAYER) {
    return {
      httpStatus: 500,
      body: { statusCode: 0, remark: 'Temporary taxpayer failure', errors: [{ code: 'SERVER_ERROR' }] },
    };
  }

  return {
    httpStatus: 200,
    body: {
      statusCode: 1,
      remark: 'Configuration retrieved',
      data: { configuration: payloadFor(configurationType, requestBody) },
      errors: [],
    },
  };
}

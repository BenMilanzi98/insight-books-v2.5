import crypto from 'crypto';
import { ACTIVATION_OUTCOME } from '../../domain/operationalEnums.js';

/**
 * Deterministic mock MRA activation/confirmation server for Phase 7 tests.
 * Synthetic credentials only — never production values.
 */

const USED_TACS = new Set();

export function resetMockMraState() {
  USED_TACS.clear();
}

function scenarioFromTac(tac) {
  const t = String(tac || '');
  if (t === 'MOCK-TIMEOUT') return 'TIMEOUT';
  if (t === 'MOCK-RESET') return 'CONNECTION_RESET';
  if (t === 'MOCK-429') return 'RATE_LIMIT';
  if (t === 'MOCK-500') return 'SERVER_ERROR';
  if (t === 'MOCK-INVALID-TAC') return 'INVALID_TAC';
  if (t === 'MOCK-EXPIRED-TAC') return 'TAC_EXPIRED';
  if (t === 'MOCK-USED-TAC') return 'TAC_ALREADY_USED';
  if (t === 'MOCK-BAD-PRODUCT') return 'PRODUCT_REJECTED';
  if (t === 'MOCK-MISSING-JWT') return 'MISSING_JWT';
  if (t === 'MOCK-MISSING-SECRET') return 'MISSING_SECRET';
  if (t === 'MOCK-REJECT') return 'REJECTED';
  if (t.startsWith('MOCK-OK') || t === 'MOCK-SUCCESS') return 'SUCCESS';
  if (USED_TACS.has(t)) return 'TAC_ALREADY_USED';
  return 'SUCCESS';
}

export async function mockActivateTerminal(requestBody, { scenario } = {}) {
  const tac = requestBody?.terminalActivationCode;
  const sc = scenario || scenarioFromTac(tac);

  if (sc === 'TIMEOUT') {
    const err = new Error('Mock MRA activation timed out after dispatch');
    err.code = 'MOCK_TIMEOUT_AFTER_DISPATCH';
    err.dispatched = true;
    throw err;
  }
  if (sc === 'CONNECTION_RESET') {
    const err = new Error('Mock connection reset after dispatch');
    err.code = 'MOCK_CONNECTION_RESET';
    err.dispatched = true;
    throw err;
  }
  if (sc === 'RATE_LIMIT') {
    return { httpStatus: 429, body: { statusCode: 0, remark: 'Rate limited', data: null, errors: [{ code: 'RATE_LIMIT' }] } };
  }
  if (sc === 'SERVER_ERROR') {
    return { httpStatus: 500, body: { statusCode: 0, remark: 'Internal error', data: null, errors: [{ code: 'SERVER_ERROR' }] } };
  }
  if (sc === 'INVALID_TAC') {
    return {
      httpStatus: 200,
      body: {
        statusCode: 0,
        remark: 'Invalid TAC',
        data: null,
        errors: [{ code: 'INVALID_TAC', message: 'Terminal activation code invalid' }],
        outcomeHint: ACTIVATION_OUTCOME.INVALID_TAC,
      },
    };
  }
  if (sc === 'TAC_EXPIRED') {
    return {
      httpStatus: 200,
      body: { statusCode: 0, remark: 'TAC expired', data: null, errors: [{ code: 'TAC_EXPIRED' }] },
    };
  }
  if (sc === 'TAC_ALREADY_USED') {
    return {
      httpStatus: 200,
      body: { statusCode: 0, remark: 'TAC already used', data: null, errors: [{ code: 'TAC_ALREADY_USED' }] },
    };
  }
  if (sc === 'PRODUCT_REJECTED') {
    return {
      httpStatus: 200,
      body: { statusCode: 0, remark: 'Product not approved', data: null, errors: [{ code: 'PRODUCT_NOT_APPROVED' }] },
    };
  }
  if (sc === 'REJECTED') {
    return {
      httpStatus: 200,
      body: { statusCode: 0, remark: 'Activation rejected', data: null, errors: [{ code: 'REJECTED' }] },
    };
  }

  USED_TACS.add(String(tac));
  const terminalId = `MOCK-TID-${crypto.randomBytes(4).toString('hex')}`;
  const jwtToken = `eyJhbGciOiJub25lIn0.${Buffer.from(JSON.stringify({ sub: terminalId, mock: true })).toString('base64url')}.mocksig`;
  const secretKey = `mock-secret-${crypto.randomBytes(8).toString('hex')}`;

  const credentials = {
    jwtToken: sc === 'MISSING_JWT' ? undefined : jwtToken,
    secretKey: sc === 'MISSING_SECRET' ? undefined : secretKey,
  };

  return {
    httpStatus: 200,
    body: {
      statusCode: 1,
      remark: 'Activation pending confirmation',
      data: {
        activatedTerminal: {
          terminalId,
          activationDate: new Date().toISOString(),
          terminalCredentials: credentials,
          globalConfiguration: { version: 'mock-g-1', taxRates: [{ id: 'A', rate: 17.5 }] },
          terminalConfiguration: { version: 'mock-t-1', offlineLimit: { amount: 0 } },
          taxpayerConfiguration: { version: 'mock-p-1', tin: requestBody?.taxpayerTin || 'TEST-TIN-0001' },
        },
      },
      errors: [],
    },
  };
}

export async function mockConfirmTerminal(requestBody, { scenario = 'SUCCESS' } = {}) {
  if (scenario === 'TIMEOUT') {
    const err = new Error('Mock confirmation timed out after dispatch');
    err.code = 'MOCK_TIMEOUT_AFTER_DISPATCH';
    err.dispatched = true;
    throw err;
  }
  if (scenario === 'REJECT') {
    return {
      httpStatus: 200,
      body: { statusCode: 0, remark: 'Confirmation rejected', data: null, errors: [{ code: 'CONFIRMATION_REJECTED' }] },
    };
  }
  return {
    httpStatus: 200,
    body: {
      statusCode: 1,
      remark: 'Terminal confirmed',
      data: { terminalId: requestBody?.terminalId, confirmed: true },
      errors: [],
    },
  };
}

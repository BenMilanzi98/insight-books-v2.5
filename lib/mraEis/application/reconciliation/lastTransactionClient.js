/**
 * Phase 15 — Last Online/Offline query client.
 * Live calls blocked unless contract allows; mock path for provisional sandbox.
 */

import crypto from 'crypto';
import {
  resolveLastTransactionContract,
  LAST_TX_ENDPOINT_TYPE,
} from './lastTransactionContractRegistry.js';
import { mockQueryLastOnlineTransaction } from './mockLastTransactionServer.js';
import { ReconciliationErrors } from './reconciliationErrors.js';

function sha256(text) {
  return crypto.createHash('sha256').update(String(text || ''), 'utf8').digest('hex');
}

export async function queryLastOnlineTransaction({
  environment = 'SANDBOX',
  mode = 'MOCK',
  terminalId,
  fiscalNumber,
  expectedLocal = null,
} = {}) {
  const resolved = resolveLastTransactionContract({
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
    environment,
    mode,
  });

  if (!resolved.allowsQuery) {
    throw ReconciliationErrors.contractUnverified({
      details: {
        decision: resolved.decision,
        blockers: resolved.contract.blockerCodes || [],
      },
    });
  }

  const useMock = mode === 'MOCK' || process.env.MRA_EIS_USE_MOCK === '1';
  if (!useMock) {
    throw ReconciliationErrors.lastOnlineQuery({
      message: 'Live Last Online Transaction client is blocked until contract verification.',
      details: { decision: resolved.decision },
    });
  }

  const httpResult = await mockQueryLastOnlineTransaction({
    fiscalNumber,
    terminalId,
    environment,
    expected: expectedLocal,
  });

  if (httpResult.errorKind === 'TIMEOUT' || httpResult.parseError) {
    return {
      ok: false,
      contract: resolved.contract,
      httpResult,
      responseChecksum: null,
      temporaryFailure: true,
    };
  }

  const responseChecksum = sha256(httpResult.bodyText || '');
  return {
    ok: true,
    contract: resolved.contract,
    httpResult,
    responseChecksum,
    calledMra: false,
    calledMock: true,
  };
}

export async function queryLastOfflineTransaction({ environment = 'SANDBOX', mode = 'MOCK' } = {}) {
  const resolved = resolveLastTransactionContract({
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_OFFLINE_TRANSACTION,
    environment,
    mode,
  });
  // Always blocked in Phase 15
  throw ReconciliationErrors.lastOfflineQuery({
    details: {
      decision: resolved.decision,
      blockers: resolved.contract.blockerCodes,
      offlineModeEnabled: false,
    },
  });
}

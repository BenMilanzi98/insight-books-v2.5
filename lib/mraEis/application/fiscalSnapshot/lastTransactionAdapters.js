/**
 * Last Online / Offline Transaction integration — Phase 12 foundation + Phase 15 mock path.
 * Live adapters remain blocked until endpoint contracts are verified.
 */

import {
  resolveLastTransactionContract,
  LAST_TX_ENDPOINT_TYPE,
} from '../reconciliation/lastTransactionContractRegistry.js';
import { queryLastOnlineTransaction } from '../reconciliation/lastTransactionClient.js';

export const LAST_TRANSACTION_ADAPTER_VERSION = 'phase15-last-txn-adapter-v1';

export async function getLastOnlineTransaction(args = {}) {
  const {
    tenantId,
    businessId,
    terminalId = null,
    fiscalNumber = null,
    environment = 'SANDBOX',
    mode = process.env.MRA_EIS_USE_MOCK === '1' ? 'MOCK' : 'SANDBOX',
    expectedLocal = null,
  } = args;

  const resolved = resolveLastTransactionContract({
    endpointType: LAST_TX_ENDPOINT_TYPE.LAST_ONLINE_TRANSACTION,
    environment,
    mode,
  });

  if (!resolved.allowsQuery) {
    return {
      ok: false,
      blocked: true,
      status: resolved.decision,
      message:
        'Last Online Transaction endpoint is not verified for this environment. No MRA call was made.',
      adapterVersion: LAST_TRANSACTION_ADAPTER_VERSION,
      calledMra: false,
      absenceIsConclusive: false,
      tenantId,
      businessId,
      terminalId,
    };
  }

  try {
    const result = await queryLastOnlineTransaction({
      environment,
      mode,
      terminalId,
      fiscalNumber,
      expectedLocal,
    });
    return {
      ok: result.ok,
      blocked: false,
      status: resolved.decision,
      adapterVersion: LAST_TRANSACTION_ADAPTER_VERSION,
      calledMra: Boolean(result.calledMra),
      calledMock: Boolean(result.calledMock),
      absenceIsConclusive: false,
      body: result.httpResult?.body || null,
      responseChecksum: result.responseChecksum,
      contractVersion: resolved.contract.contractVersion,
    };
  } catch (err) {
    return {
      ok: false,
      blocked: true,
      status: err.code || 'QUERY_FAILED',
      message: err.message,
      adapterVersion: LAST_TRANSACTION_ADAPTER_VERSION,
      calledMra: false,
      absenceIsConclusive: false,
    };
  }
}

export async function getLastOfflineTransaction(/* args */) {
  return {
    ok: false,
    blocked: true,
    status: 'REQUIRES_MRA_CLARIFICATION',
    message:
      'Last Offline Transaction endpoint is not verified. Offline numbering remains disabled. No MRA call was made. Phase 16 owns certified offline.',
    adapterVersion: LAST_TRANSACTION_ADAPTER_VERSION,
    calledMra: false,
    absenceIsConclusive: false,
    offlineModeEnabled: false,
  };
}

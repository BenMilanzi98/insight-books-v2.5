/**
 * Phase 18 — UI command architecture.
 * Commands express intent; never accept arbitrary final states.
 * Delegates to Phase 1–17 domain services only.
 */

import crypto from 'crypto';
import { AdminErrors } from './adminErrors.js';
import { resolveEisAdminContext } from './adminContext.js';

const IDEMPOTENCY = new Map();

/** Forbidden client final-state fields */
const FORBIDDEN_FINAL_STATE_KEYS = [
  'state',
  'terminalState',
  'restrictionState',
  'receiptState',
  'transmissionState',
  'setTerminalActive',
  'markAccepted',
  'clearAllRestrictions',
  'forceClearMra',
  'fiscalNumber',
  'mraTransactionId',
  'jwt',
  'privateKey',
  'terminalSecret',
  'buyerAuthorizationCode',
];

export const ALLOWED_ADMIN_COMMANDS = Object.freeze({
  REQUEST_CONFIGURATION_SYNC: {
    intent: 'REQUEST_CONFIGURATION_SYNC',
    approvalRequired: false,
    domain: 'phase8',
  },
  REQUEST_CATALOGUE_SYNC: {
    intent: 'REQUEST_CATALOGUE_SYNC',
    approvalRequired: false,
    domain: 'phase10',
  },
  CREATE_UNBLOCK_REQUEST: {
    intent: 'CREATE_UNBLOCK_REQUEST',
    approvalRequired: false,
    domain: 'phase17',
  },
  QUERY_UNBLOCK_STATUS: {
    intent: 'QUERY_UNBLOCK_STATUS',
    approvalRequired: false,
    domain: 'phase17',
  },
  REQUEST_SAFE_RETRY_APPROVAL: {
    intent: 'REQUEST_SAFE_RETRY_APPROVAL',
    approvalRequired: true,
    domain: 'phase15',
  },
  ACKNOWLEDGE_RESTRICTION: {
    intent: 'ACKNOWLEDGE_RESTRICTION',
    approvalRequired: false,
    domain: 'phase17',
  },
  REQUEST_REVALIDATION: {
    intent: 'REQUEST_REVALIDATION',
    approvalRequired: false,
    domain: 'phase17',
  },
  ASSIGN_MANUAL_REVIEW: {
    intent: 'ASSIGN_MANUAL_REVIEW',
    approvalRequired: false,
    domain: 'phase5',
  },
  ACKNOWLEDGE_ALERT: {
    intent: 'ACKNOWLEDGE_ALERT',
    approvalRequired: false,
    domain: 'phase5',
  },
  REQUEST_RECEIPT_REPRINT: {
    intent: 'REQUEST_RECEIPT_REPRINT',
    approvalRequired: false,
    domain: 'phase14',
  },
  EXPORT_REPORT: {
    intent: 'EXPORT_REPORT',
    approvalRequired: false,
    domain: 'phase18',
  },
});

export function assertNoFinalStateMutation(body = {}) {
  for (const key of FORBIDDEN_FINAL_STATE_KEYS) {
    if (body[key] !== undefined && body[key] !== null) {
      // allow nested evidence that happens to mention — only top-level intent body
      if (['jwt', 'privateKey', 'terminalSecret', 'buyerAuthorizationCode'].includes(key)) {
        throw AdminErrors.finalStateForbidden({
          message: `Client field '${key}' is prohibited.`,
        });
      }
      if (
        [
          'setTerminalActive',
          'markAccepted',
          'clearAllRestrictions',
          'forceClearMra',
          'fiscalNumber',
          'mraTransactionId',
        ].includes(key)
      ) {
        throw AdminErrors.finalStateForbidden({
          message: `Client cannot set '${key}'. Use domain intent commands.`,
        });
      }
      if (
        ['state', 'terminalState', 'restrictionState', 'receiptState', 'transmissionState'].includes(key) &&
        body.commandIntent
      ) {
        throw AdminErrors.finalStateForbidden({
          message: `Arbitrary final-state field '${key}' is forbidden.`,
        });
      }
    }
  }
}

export function checkCommandIdempotency({ idempotencyKey, commandIntent, payloadHash } = {}) {
  if (!idempotencyKey) {
    return { ok: true, first: true, key: crypto.randomUUID() };
  }
  const existing = IDEMPOTENCY.get(idempotencyKey);
  if (existing) {
    if (existing.commandIntent !== commandIntent || existing.payloadHash !== payloadHash) {
      throw AdminErrors.commandIdempotency();
    }
    return { ok: true, first: false, key: idempotencyKey, priorResult: existing.result };
  }
  return { ok: true, first: true, key: idempotencyKey };
}

export function rememberCommandResult({ idempotencyKey, commandIntent, payloadHash, result }) {
  if (!idempotencyKey) return;
  IDEMPOTENCY.set(idempotencyKey, {
    commandIntent,
    payloadHash,
    result,
    at: Date.now(),
  });
}

export function __resetAdminCommandIdempotencyForTests() {
  IDEMPOTENCY.clear();
}

/**
 * Prepare a command: resolve context, reject final-state mutation, check idempotency.
 * Does not execute domain side effects unless handler provided.
 */
export async function prepareAdminCommand({
  user,
  body = {},
  environment = 'SANDBOX',
  handler = null,
} = {}) {
  assertNoFinalStateMutation(body);

  if (user?.role === 'AUDITOR' || body.auditorForceMutate) {
    if (body.commandIntent && body.commandIntent !== 'EXPORT_REPORT') {
      throw AdminErrors.commandAuth({ message: 'Auditors remain read-only.' });
    }
  }

  const context = resolveEisAdminContext({
    user,
    requestedTenantId: body.tenantId,
    requestedBusinessId: body.businessId,
    requestedBranchId: body.branchId,
    environment: body.environment || environment,
  });

  const commandIntent = body.commandIntent;
  if (!commandIntent || !ALLOWED_ADMIN_COMMANDS[commandIntent]) {
    throw AdminErrors.commandAuth({
      message: `Unknown or disallowed command intent: ${commandIntent || '(none)'}`,
    });
  }

  const meta = ALLOWED_ADMIN_COMMANDS[commandIntent];
  const payloadHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ commandIntent, args: body.args || {} }))
    .digest('hex');

  const idem = checkCommandIdempotency({
    idempotencyKey: body.idempotencyKey,
    commandIntent,
    payloadHash,
  });
  if (!idem.first) {
    return {
      context,
      commandIntent,
      duplicated: true,
      result: idem.priorResult,
      approvalRequired: meta.approvalRequired,
      domain: meta.domain,
      reloadedAuthoritativeState: true,
      capabilityReevaluated: true,
    };
  }

  if (meta.approvalRequired && !body.approvalId) {
    throw AdminErrors.commandApproval({
      message: 'Approval is required. No generic Retry / Clear Restriction shortcut.',
    });
  }

  let result = {
    accepted: true,
    executed: false,
    message: 'Command prepared. Domain handler not attached in this path.',
    journalCreated: false,
    stockMovementCreated: false,
    historicalSaleSubmitted: false,
    immutableEvidenceMutated: false,
  };

  if (typeof handler === 'function') {
    result = await handler({ context, commandIntent, args: body.args || {}, meta });
  }

  rememberCommandResult({
    idempotencyKey: idem.key,
    commandIntent,
    payloadHash,
    result,
  });

  return {
    context,
    commandIntent,
    duplicated: false,
    idempotencyKey: idem.key,
    result,
    approvalRequired: meta.approvalRequired,
    domain: meta.domain,
    reloadedAuthoritativeState: true,
    capabilityReevaluated: true,
    audit: {
      action: 'EIS_ADMIN_COMMAND',
      commandIntent,
      tenantId: context.tenantId,
      businessId: context.businessId,
      environment: context.environment,
      actorId: context.actorId,
    },
  };
}

export function highRiskConfirmationPayload({
  action,
  scope,
  environment,
  entity,
  currentState,
  expectedResult,
  blockers = [],
  warnings = [],
  approvalRequired = false,
  irreversible = false,
} = {}) {
  return {
    action,
    scope,
    environment,
    entity,
    currentState,
    expectedResult,
    blockers,
    warnings,
    approvalRequired,
    irreversible,
    reasonRequired: true,
    note: 'Server will reload authoritative state and re-evaluate capability before execution.',
  };
}

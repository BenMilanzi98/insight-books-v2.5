/**
 * Segregation-of-Duties policy engine (pure).
 */

import { SegregationOfDutiesConflictError, SelfApprovalNotAllowedError } from './errors.js';

/** Default hard SoD pairs: (createAction, approveAction) cannot be same actor */
export const DEFAULT_SOD_RULES = Object.freeze([
  {
    code: 'SOD_CREATE_APPROVE',
    description: 'Creator cannot approve the same transaction',
    conflictWhen: 'SAME_ACTOR_CREATE_AND_APPROVE',
  },
  {
    code: 'SOD_APPROVE_POST',
    description: 'Sole approver cannot also be sole poster for high-risk journals when configured',
    conflictWhen: 'SAME_ACTOR_APPROVE_AND_POST',
  },
  {
    code: 'SOD_RECON_PREPARE_COMPLETE',
    description: 'Preparer cannot complete bank reconciliation when separate approver required',
    conflictWhen: 'SAME_ACTOR_PREPARE_AND_COMPLETE',
  },
  {
    code: 'SOD_CLOSE_GENERATE_APPROVE',
    description: 'Closing journal generator cannot sole-approve',
    conflictWhen: 'SAME_ACTOR_GENERATE_AND_APPROVE_CLOSE',
  },
  {
    code: 'SOD_PERMISSION_GRANT',
    description: 'Permission granter cannot sole-approve their own sensitive grant',
    conflictWhen: 'SAME_ACTOR_GRANT_AND_APPROVE_PERMISSION',
  },
  {
    code: 'SOD_SCORE_OVERRIDE',
    description: 'Score override requester cannot approve override',
    conflictWhen: 'SAME_ACTOR_REQUEST_AND_APPROVE_SCORE',
  },
]);

/**
 * @param {{ creatorId?: string|null, approverId?: string|null, selfApprovalAllowed?: boolean, ruleCode?: string }} input
 */
export function evaluateMakerChecker(input = {}) {
  const creatorId = input.creatorId || input.preparedBy || input.requestedBy || null;
  const approverId = input.approverId || input.actorId || null;
  const selfApprovalAllowed = Boolean(input.selfApprovalAllowed);

  if (!creatorId || !approverId) {
    return { conflict: false, ruleCode: null };
  }
  if (String(creatorId) === String(approverId)) {
    if (selfApprovalAllowed) {
      return { conflict: false, ruleCode: null, warning: 'SELF_APPROVAL_ALLOWED_BY_POLICY' };
    }
    return {
      conflict: true,
      ruleCode: input.ruleCode || 'SOD_CREATE_APPROVE',
      message: 'Segregation of duties: the preparer/creator cannot approve this action.',
    };
  }
  return { conflict: false, ruleCode: null };
}

export function assertMakerChecker(input = {}) {
  const result = evaluateMakerChecker(input);
  if (result.conflict) {
    throw new SelfApprovalNotAllowedError(result.message);
  }
  return result;
}

/**
 * Evaluate a list of conflict checks.
 */
export function evaluateSodConflicts(checks = []) {
  const conflicts = [];
  for (const check of checks) {
    const r = evaluateMakerChecker(check);
    if (r.conflict) {
      conflicts.push({
        ...r,
        sourceModule: check.sourceModule || null,
        sourceId: check.sourceId || null,
      });
    }
  }
  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  };
}

export function assertNoSodConflicts(checks = []) {
  const result = evaluateSodConflicts(checks);
  if (result.hasConflict) {
    throw new SegregationOfDutiesConflictError('One or more segregation-of-duties conflicts.', {
      conflicts: result.conflicts,
    });
  }
  return result;
}

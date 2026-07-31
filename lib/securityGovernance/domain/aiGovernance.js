/**
 * Platform-wide AI governance — cannot post, approve, change permissions/scores.
 */

import { AiGovernanceBlockedError } from './errors.js';
import { evaluateAuthorization } from './authorizationEngine.js';

const FORBIDDEN_AI_ACTIONS = new Set([
  'journal.post',
  'journal.approve',
  'journal.reverse',
  'forecast.approve',
  'loanReadiness.approveAssessment',
  'security.assignSensitivePermission',
  'admin.impersonate',
  'score.override',
  'permission.grant',
]);

const SENSITIVE_PROMPT_KEYS = [
  'password',
  'apiKey',
  'token',
  'bankStatement',
  'identityDocument',
  'payrollFile',
  'collateralDocument',
  'ownershipDocument',
  'taxDocument',
  'personalGuarantee',
];

export function assertAiActionAllowed(actor, permission, { businessId } = {}) {
  if (FORBIDDEN_AI_ACTIONS.has(permission)) {
    throw new AiGovernanceBlockedError('AI cannot execute privileged financial or security actions.', {
      permission,
    });
  }
  const evalResult = evaluateAuthorization({
    actor,
    permission,
    resourceBusinessId: businessId || actor?.businessId,
  });
  if (evalResult.decision !== 'ALLOW') {
    throw new AiGovernanceBlockedError(evalResult.reason, { permission, code: evalResult.code });
  }
  return evalResult;
}

export function minimizeAiPromptPayload(payload = {}) {
  const out = {};
  for (const [k, v] of Object.entries(payload)) {
    if (SENSITIVE_PROMPT_KEYS.some((s) => k.toLowerCase().includes(s.toLowerCase()))) {
      out[k] = '[REDACTED_REFERENCE_ONLY]';
      continue;
    }
    if (typeof v === 'string' && v.length > 4000) {
      out[k] = `${v.slice(0, 500)}…[TRUNCATED]`;
    } else {
      out[k] = v;
    }
  }
  return {
    data: out,
    governance: {
      autoExecute: false,
      canPostJournal: false,
      canApprove: false,
      canChangePermissions: false,
      canAlterScores: false,
      requiresHumanReview: true,
    },
  };
}

export function validateAiOutputClaims(output = {}) {
  const text = JSON.stringify(output).toLowerCase();
  const blocked = [];
  if (text.includes('journal posted') || text.includes('posted to gl')) blocked.push('JOURNAL_POST_CLAIM');
  if (text.includes('approved forecast') && output?.executedApproval) blocked.push('APPROVAL_EXECUTION');
  if (output?.actions?.some?.((a) => FORBIDDEN_AI_ACTIONS.has(a))) blocked.push('FORBIDDEN_ACTION');
  return {
    valid: blocked.length === 0,
    blocked,
  };
}

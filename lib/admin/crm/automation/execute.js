/**
 * CRM automation idempotent execution — Phase 13 Wave 4 foundations.
 * Only APPROVED rules; small trigger set; no sequences / arbitrary code.
 */

import {
  CRM_AUTOMATION_EXECUTION_STATUS,
  CRM_AUTOMATION_RULE_STATUS,
  CRM_AUTOMATION_TRIGGER,
  CRM_SUBJECT_TYPE,
} from '../catalogue.js';
import { resolveCrmAccess } from '../authz.js';
import { createTask } from '../tasks.js';
import {
  CRM_AUTOMATION_ACTION,
  CRM_AUTOMATION_DEFINITION_VERSION,
} from './catalogue.js';
import { hasCrmAutomationRuleModel } from './rules.js';

export function hasCrmAutomationExecutionModel(prisma) {
  return typeof prisma?.crmAutomationExecution?.create === 'function';
}

function buildIdempotencyKey({ ruleId, trigger, subjectType, subjectId, occurrenceKey }) {
  return [
    String(ruleId || ''),
    String(trigger || ''),
    String(subjectType || ''),
    String(subjectId || ''),
    String(occurrenceKey || 'default'),
  ].join('|');
}

/** Only SUCCESS/SKIPPED short-circuit as successful idempotent replay. FAILED may retry. */
function isSuccessfulExecutionStatus(status) {
  return (
    status === CRM_AUTOMATION_EXECUTION_STATUS.SUCCESS ||
    status === CRM_AUTOMATION_EXECUTION_STATUS.SKIPPED
  );
}

function priorFailurePayload(prior) {
  const err =
    prior?.resultJson && typeof prior.resultJson === 'object'
      ? prior.resultJson.error
      : null;
  return {
    ok: false,
    error: err || 'prior_execution_failed',
    execution: serializeExecution(prior),
    idempotent: true,
    status: prior?.status || CRM_AUTOMATION_EXECUTION_STATUS.FAILED,
    priorFailure: true,
  };
}

function serializeExecution(row) {
  if (!row) return null;
  return {
    id: row.id,
    ruleId: row.ruleId,
    idempotencyKey: row.idempotencyKey,
    trigger: row.trigger,
    action: row.action,
    subjectType: row.subjectType || null,
    subjectId: row.subjectId || null,
    status: row.status,
    resultJson: row.resultJson ?? null,
    executedByAdminId: row.executedByAdminId || null,
    at: row.at ? new Date(row.at).toISOString() : null,
  };
}

async function runApprovedAction(prisma, args) {
  const { rule, subjectType, subjectId, admin, now } = args;
  const action = rule.action;

  if (action === CRM_AUTOMATION_ACTION.CREATE_FIRST_CONTACT_TASK) {
    if (subjectType !== CRM_SUBJECT_TYPE.LEAD) {
      return { ok: false, error: 'lead_subject_required_for_first_contact' };
    }
    const title =
      (rule.configJson && rule.configJson.taskTitle) ||
      'First contact — follow up after Lead assignment';
    const taskResult = await createTask(prisma, {
      admin,
      subjectType: CRM_SUBJECT_TYPE.LEAD,
      subjectId,
      title: String(title),
      dueAt: rule.configJson?.dueAt || null,
      allocateTaskNumber: true,
      now,
    });
    if (!taskResult.ok) return taskResult;
    return {
      ok: true,
      result: { taskId: taskResult.task?.id || null, task: taskResult.task },
    };
  }

  if (action === CRM_AUTOMATION_ACTION.CREATE_CHECKLIST_TASK) {
    if (subjectType !== CRM_SUBJECT_TYPE.OPPORTUNITY) {
      return { ok: false, error: 'opportunity_subject_required_for_checklist' };
    }
    const stageCode = rule.configJson?.stageCode || args.stageCode || null;
    const title =
      (rule.configJson && rule.configJson.taskTitle) ||
      `Stage checklist${stageCode ? ` — ${stageCode}` : ''}`;
    const taskResult = await createTask(prisma, {
      admin,
      subjectType: CRM_SUBJECT_TYPE.OPPORTUNITY,
      subjectId,
      title: String(title),
      dueAt: rule.configJson?.dueAt || null,
      allocateTaskNumber: true,
      now,
    });
    if (!taskResult.ok) return taskResult;
    return {
      ok: true,
      result: {
        taskId: taskResult.task?.id || null,
        task: taskResult.task,
        stageCode,
      },
    };
  }

  if (action === CRM_AUTOMATION_ACTION.EMIT_NO_NEXT_ACTION_WARNING) {
    return {
      ok: true,
      result: {
        warning: 'NO_NEXT_ACTION',
        subjectType,
        subjectId,
        fabricatedNextAction: false,
        message:
          'No next action found — warning only; no fabricated Task/Follow-Up created',
      },
    };
  }

  return { ok: false, error: 'action_not_implemented_in_approved_set' };
}

/**
 * Execute an APPROVED automation rule idempotently.
 *
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{
 *   admin: object,
 *   ruleId: string,
 *   subjectType: string,
 *   subjectId: string,
 *   occurrenceKey?: string,
 *   stageCode?: string|null,
 *   now?: Date,
 * }} args
 */
export async function executeAutomationRule(prisma, args = {}) {
  const access = resolveCrmAccess(args.admin);
  if (!access.canEditActivities && !access.canEditLeads && !access.canEditOpportunities) {
    return { ok: false, forbidden: true, reason: 'crm_automation_execute_forbidden' };
  }

  if (!hasCrmAutomationRuleModel(prisma)) {
    return {
      ok: false,
      error: 'crm_automation_rule_model_unavailable',
      status: 'UNAVAILABLE',
    };
  }

  const ruleId = args.ruleId ? String(args.ruleId).trim() : '';
  const subjectType = String(args.subjectType || '').trim().toUpperCase();
  const subjectId = args.subjectId ? String(args.subjectId).trim() : '';
  if (!ruleId) return { ok: false, error: 'ruleId_required' };
  if (!subjectType || !subjectId) {
    return { ok: false, error: 'subjectType_and_subjectId_required' };
  }

  let rule = null;
  try {
    rule = await prisma.crmAutomationRule.findUnique({ where: { id: ruleId } });
  } catch {
    rule = null;
  }
  if (!rule) return { ok: false, notFound: true, error: 'rule_not_found' };

  if (rule.status !== CRM_AUTOMATION_RULE_STATUS.APPROVED) {
    return { ok: false, error: 'rule_not_approved', status: rule.status };
  }

  const occurrenceKey =
    args.occurrenceKey != null
      ? String(args.occurrenceKey).trim()
      : args.stageCode
        ? String(args.stageCode).trim().toUpperCase()
        : 'default';

  const idempotencyKey = buildIdempotencyKey({
    ruleId: rule.id,
    trigger: rule.trigger,
    subjectType,
    subjectId,
    occurrenceKey,
  });

  let priorNonSuccess = null;
  if (hasCrmAutomationExecutionModel(prisma)) {
    try {
      const prior = await prisma.crmAutomationExecution.findUnique({
        where: { idempotencyKey },
      });
      if (prior) {
        if (isSuccessfulExecutionStatus(prior.status)) {
          return {
            ok: true,
            execution: serializeExecution(prior),
            idempotent: true,
            status: CRM_AUTOMATION_EXECUTION_STATUS.IDEMPOTENT_REPLAY,
            meta: {
              definitionVersion: CRM_AUTOMATION_DEFINITION_VERSION,
              sequencesForbidden: true,
            },
          };
        }
        // FAILED / non-success: allow retry (do not mask as ok:true replay)
        priorNonSuccess = prior;
      }
    } catch {
      // continue
    }
  }

  const now = args.now || new Date();
  const actionResult = await runApprovedAction(prisma, {
    rule,
    subjectType,
    subjectId,
    admin: args.admin,
    now,
    stageCode: args.stageCode,
  });

  const execStatus = actionResult.ok
    ? CRM_AUTOMATION_EXECUTION_STATUS.SUCCESS
    : CRM_AUTOMATION_EXECUTION_STATUS.FAILED;
  const resultJson = actionResult.ok
    ? actionResult.result || null
    : { error: actionResult.error || 'failed' };

  let execution = null;
  if (hasCrmAutomationExecutionModel(prisma)) {
    try {
      if (priorNonSuccess) {
        execution = await prisma.crmAutomationExecution.update({
          where: { id: priorNonSuccess.id },
          data: {
            status: execStatus,
            resultJson,
            executedByAdminId: args.admin?.id || null,
            at: now,
          },
        });
      } else {
        execution = await prisma.crmAutomationExecution.create({
          data: {
            ruleId: rule.id,
            idempotencyKey,
            trigger: rule.trigger,
            action: rule.action,
            subjectType,
            subjectId,
            status: execStatus,
            resultJson,
            executedByAdminId: args.admin?.id || null,
            at: now,
          },
        });
      }
    } catch (e) {
      // Unique race → only SUCCESS/SKIPPED replays are ok:true
      if (e?.code === 'P2002' || String(e?.message || '').includes('Unique')) {
        try {
          const prior = await prisma.crmAutomationExecution.findUnique({
            where: { idempotencyKey },
          });
          if (prior) {
            if (isSuccessfulExecutionStatus(prior.status)) {
              return {
                ok: true,
                execution: serializeExecution(prior),
                idempotent: true,
                status: CRM_AUTOMATION_EXECUTION_STATUS.IDEMPOTENT_REPLAY,
              };
            }
            return priorFailurePayload(prior);
          }
        } catch {
          // fall through
        }
      }
    }
  }

  if (!actionResult.ok) {
    return {
      ok: false,
      error: actionResult.error || 'execution_failed',
      execution: serializeExecution(execution),
      forbidden: actionResult.forbidden,
    };
  }

  return {
    ok: true,
    execution: serializeExecution(execution),
    result: actionResult.result,
    idempotent: false,
    status: CRM_AUTOMATION_EXECUTION_STATUS.SUCCESS,
    meta: {
      definitionVersion: CRM_AUTOMATION_DEFINITION_VERSION,
      sequencesForbidden: true,
      arbitraryCodeForbidden: true,
      trigger: rule.trigger,
      approvedTriggerSet: Object.values(CRM_AUTOMATION_TRIGGER),
    },
  };
}

export { buildIdempotencyKey, serializeExecution };

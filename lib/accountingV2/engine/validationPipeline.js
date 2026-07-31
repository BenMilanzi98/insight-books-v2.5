/**
 * Posting engine — deterministic journal validation pipeline (Phase 4).
 *
 * A fixed, ordered list of stages shared by preview (collect mode) and posting
 * (strict mode). Strict mode throws the first typed error; collect mode records
 * every issue it can reach and never mutates anything. The pipeline itself is
 * read-only — persistence happens only in the posting engine after the pipeline
 * has fully passed.
 *
 * Stage order (deterministic):
 *   1. COMMAND        — schema already enforced by createPostingCommand
 *   2. BUSINESS_SCOPE — context integrity
 *   3. TEMPLATE       — active template resolution + source-type support
 *   4. SOURCE         — typed source validator
 *   5. APPROVAL       — requirement resolution + approval facts from the source
 *   6. PERIOD         — server-side period resolution and authorization
 *   7. DRAFT          — template draft generation (mapping resolution inside)
 *   8. ACCOUNTS       — per-line account validation
 *   9. DOUBLE_ENTRY   — exact balance re-verification (transaction + base)
 *  10. FINAL          — pre-persistence structural checks
 */

import { getActiveTemplate } from '../templates/index.js';
import { validateSource } from './sourceValidation.js';
import { resolveApprovalRequirement, validateApproval } from './approvalValidation.js';
import { resolvePostingPeriod } from './periodResolution.js';
import { validateDraftAccounts } from './accountValidation.js';
import { resolvePurposeAccount } from '../../coaV2/application/accountMappingRegistry.js';
import {
  AccountingV2Error,
  AccountingContextRequiredError,
  UnbalancedJournalError,
  PostingTemplateValidationError,
} from '../domain/errors.js';
import { sumMoneyValues } from '../domain/money.js';

export const PIPELINE_STAGES = Object.freeze([
  'COMMAND',
  'BUSINESS_SCOPE',
  'TEMPLATE',
  'SOURCE',
  'APPROVAL',
  'PERIOD',
  'DRAFT',
  'ACCOUNTS',
  'DOUBLE_ENTRY',
  'FINAL',
]);

/**
 * @typedef {object} PipelineOutcome
 * @property {boolean} valid
 * @property {Array<{stage: string, code: string, message: string, retryable: boolean}>} issues
 * @property {import('../domain/journalDraft.js').JournalDraft|null} draft
 * @property {object|null} source
 * @property {object|null} template
 * @property {import('./periodResolution.js').PeriodResolution|null} period
 * @property {import('./approvalValidation.js').ApprovalRequirement|null} approvalRequirement
 * @property {string[]} warnings
 */

/**
 * Run the pipeline.
 * @param {object} db transaction client (posting) or prisma (preview)
 * @param {import('../domain/accountingContext.js').AccountingContext} context
 * @param {import('./postingCommand.js').PostingCommand} command
 * @param {object} options
 * @param {'strict'|'collect'} [options.mode]
 * @param {(permission: string) => boolean} options.hasPermission
 * @returns {Promise<PipelineOutcome>}
 */
export async function runValidationPipeline(db, context, command, options) {
  const mode = options.mode ?? 'strict';
  const issues = [];
  const warnings = [];
  const record = (stage, err) => {
    const entry = {
      stage,
      code: err instanceof AccountingV2Error ? err.code : 'INTERNAL_VALIDATION_ERROR',
      message: err instanceof AccountingV2Error ? err.userMessage : 'Validation failed.',
      retryable: err instanceof AccountingV2Error ? err.retryable : false,
    };
    issues.push(entry);
    if (mode === 'strict') throw err;
  };

  let template = null;
  let source = null;
  let period = null;
  let draft = null;
  let approvalRequirement = null;

  // 1–2. Command + business scope (command construction already validated schema).
  if (!context?.businessId || !context.userId) {
    record('BUSINESS_SCOPE', new AccountingContextRequiredError());
    return outcome();
  }

  // 3. Template resolution.
  try {
    template = getActiveTemplate(command.sourceReference.eventType, {
      requestId: context.requestId,
      correlationId: context.correlationId,
    });
    if (
      template.supportedSourceTypes.length > 0 &&
      !template.supportedSourceTypes.includes(command.sourceReference.sourceType)
    ) {
      throw new PostingTemplateValidationError(
        [{ path: 'sourceType', message: `template ${template.templateId} does not support source type "${command.sourceReference.sourceType}"` }],
        { requestId: context.requestId, correlationId: context.correlationId }
      );
    }
    for (const dim of template.requiredDimensions) {
      if (!command.dimensions[dim]) {
        throw new PostingTemplateValidationError(
          [{ path: `dimensions.${dim}`, message: `required by template ${template.templateId}` }],
          { requestId: context.requestId, correlationId: context.correlationId }
        );
      }
    }
    for (const dim of template.prohibitedDimensions) {
      if (command.dimensions[dim]) {
        throw new PostingTemplateValidationError(
          [{ path: `dimensions.${dim}`, message: `prohibited by template ${template.templateId}` }],
          { requestId: context.requestId, correlationId: context.correlationId }
        );
      }
    }
  } catch (err) {
    record('TEMPLATE', err);
    return outcome();
  }

  // 4. Source validation.
  try {
    source = await validateSource(db, context, command);
  } catch (err) {
    record('SOURCE', err);
    return outcome();
  }

  // 6. Period resolution (before approval so backdating informs the requirement).
  try {
    period = await resolvePostingPeriod(db, context, {
      transactionDate: command.transactionDate,
      requestedPostingDate: command.requestedPostingDate,
      sourceModule: command.sourceReference?.sourceModule,
      sourceType: command.sourceReference?.sourceType,
      eventType: command.sourceReference?.eventType,
      hasPermission: options.hasPermission,
    });
    warnings.push(...period.warnings);
  } catch (err) {
    record('PERIOD', err);
  }

  // 5. Approval validation (uses approval facts persisted on the source).
  try {
    approvalRequirement = resolveApprovalRequirement({
      eventType: command.sourceReference.eventType,
      amountMinor: command.totalAmount?.minor ?? null,
      backdated: period?.backdated ?? false,
      periodStatus: period?.periodStatus,
    });
    validateApproval({
      context,
      requirement: approvalRequirement,
      approval: source
        ? {
            approvedById: source.approvedById ?? source.approvedBy ?? null,
            approvedAt: source.approvedAt ?? null,
            createdById: source.createdById ?? source.createdBy ?? null,
          }
        : null,
      initiatorId: command.initiatedBy,
    });
  } catch (err) {
    record('APPROVAL', err);
  }

  // 7. Draft generation (account-mapping resolution happens inside the template).
  try {
    const resolvePurpose = (purpose, opts = {}) =>
      resolvePurposeAccount(
        context,
        purpose,
        {
          module: command.sourceReference.sourceModule,
          currency: command.currency,
          branchId: context.branchId,
          at: new Date(period?.postingDate ?? command.transactionDate),
          ...opts,
        },
        db
      );
    draft = await template.buildDraft({ db, context, command, source, resolvePurpose });
  } catch (err) {
    record('DRAFT', err);
    return outcome();
  }

  // 8. Account validation.
  try {
    await validateDraftAccounts(db, context, draft, {
      isManual: ['MANUAL_JOURNAL', 'ADJUSTMENT_JOURNAL'].includes(template.templateId),
      hasPermission: options.hasPermission,
    });
  } catch (err) {
    record('ACCOUNTS', err);
  }

  // 9. Double-entry re-verification (draft creation already enforced balance).
  try {
    if (draft.lines.length < 2) {
      throw new UnbalancedJournalError({ debitMinor: 0, creditMinor: 0 });
    }
    if (draft.totals.debitMinor !== draft.totals.creditMinor) {
      throw new UnbalancedJournalError(draft.totals);
    }
    if (draft.totals.debitMinor === 0 && draft.totals.creditMinor === 0) {
      throw new UnbalancedJournalError(draft.totals);
    }
    const baseDebit = sumMoneyValues(
      draft.lines.map((l) => l.baseDebit).filter(Boolean),
      draft.lines.find((l) => l.baseDebit)?.baseDebit?.currency ?? draft.currency
    );
    const baseCredit = sumMoneyValues(
      draft.lines.map((l) => l.baseCredit).filter(Boolean),
      draft.lines.find((l) => l.baseCredit)?.baseCredit?.currency ?? draft.currency
    );
    if (baseDebit.minor !== baseCredit.minor) {
      throw new UnbalancedJournalError({ debitMinor: baseDebit.minor, creditMinor: baseCredit.minor });
    }
  } catch (err) {
    record('DOUBLE_ENTRY', err);
  }

  // 10. Final pre-persistence checks.
  try {
    for (const line of draft.lines) {
      if (!Number.isSafeInteger(line.debit?.minor ?? 0) || !Number.isSafeInteger(line.credit?.minor ?? 0)) {
        throw new UnbalancedJournalError(draft.totals);
      }
    }
  } catch (err) {
    record('FINAL', err);
  }

  return outcome();

  function outcome() {
    return {
      valid: issues.length === 0,
      issues,
      draft,
      source,
      template,
      period,
      approvalRequirement,
      warnings,
    };
  }
}

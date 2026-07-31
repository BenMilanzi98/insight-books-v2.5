/**
 * Posting engine — central orchestrator (Phase 4).
 *
 * The ONLY approved entry points for new accounting writes:
 *
 *   previewPosting  — read-only: builds the command, runs the validation
 *                     pipeline in collect mode, returns a clearly non-posted
 *                     preview. Claims nothing, consumes no journal number.
 *
 *   executePosting  — resolves the posting mode server-side, then:
 *                     NEW_ENGINE   → claim event, validate, persist journal,
 *                                    update source, audit + outbox — all atomic.
 *                     DISABLED     → refused (containment).
 *
 * Concurrency and idempotency model:
 *   Claim transaction (small, committed first): registers/claims the event via
 *   the AcctV2EventRegistry unique constraints and moves it to IN_PROGRESS.
 *   Posting transaction: every financial write. If it fails everything rolls
 *   back and the claim is settled to FAILED through the sanctioned
 *   failure-recording path (the registry row is the controlled observability
 *   record the spec permits outside the posting transaction).
 *   An idempotent retry of a POSTED event returns the original result.
 */

import prisma from '../../prisma.js';
import { runInAccountingTransaction } from '../infrastructure/transactionBoundary.js';
import {
  registerEvent,
  updateEventStatus,
  recordPostingAttempt,
} from '../infrastructure/eventRegistryRepository.js';
import { enqueueOutboxMessage } from '../infrastructure/outbox.js';
import { resolvePostingMode } from '../infrastructure/featureFlags.js';
import { recordAccountingAudit } from '../infrastructure/auditTrail.js';
import { persistShadowJournal, persistShadowComparison } from '../shadow/shadowAccounting.js';
import { findLegacyPostingsBySource } from '../infrastructure/legacy/legacyPostingAdapter.js';
import { logAccountingOperation } from '../observability/accountingLogger.js';
import { createPostingCommand, computeCommandHash } from './postingCommand.js';
import { buildPostingResult } from './postingResult.js';
import { runValidationPipeline } from './validationPipeline.js';
import { allocateJournalNumber } from './journalNumbering.js';
import { createPostedJournal, promoteDraftToPosted, linkReversalToOriginal } from './journalPersistence.js';
import { assertNewEnginePostingAllowed } from './legacyGuard.js';
import { classifyPostingFailure, MAX_POSTING_ATTEMPTS } from './retryPolicy.js';
import { loadAccountsForValidation } from './accountValidation.js';
import { assertEventStatusTransition } from '../domain/eventStatus.js';
import { minorToDecimalString } from '../domain/money.js';
import {
  PostingMode,
  EventRegistryStatus,
  AttemptStatus,
  AccountingEventType,
} from '../domain/enums.js';
import {
  AccountingConfigurationError,
  AccountingValidationError,
  PostingDisabledError,
  PostingInProgressError,
  DuplicateAccountingEventError,
  SourceStateUpdateError,
} from '../domain/errors.js';
// Registering the template catalogue and pilot source validators is a side
// effect of these imports — the engine is unusable without them.
import '../templates/index.js';
import './sourceValidation.js';

/** Templates whose source row IS the draft journal (promote in place). */
const PROMOTE_IN_PLACE_TEMPLATES = new Set(['MANUAL_JOURNAL', 'ADJUSTMENT_JOURNAL']);

const AUDIT = Object.freeze({
  POSTED: 'acctv2.posting.posted',
  SHADOWED: 'acctv2.posting.shadowed',
  FAILED: 'acctv2.posting.failed',
  REPLAYED: 'acctv2.posting.replayed',
});

/** Base-currency totals of a validated draft, as decimal strings. */
function baseTotals(draft) {
  let debit = 0;
  let credit = 0;
  for (const line of draft.lines) {
    debit += line.baseDebit?.minor ?? line.debit?.minor ?? 0;
    credit += line.baseCredit?.minor ?? line.credit?.minor ?? 0;
  }
  return { baseTotalDebit: minorToDecimalString(debit), baseTotalCredit: minorToDecimalString(credit) };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Preview
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Read-only posting preview. Never claims the event, never consumes a journal
 * number, never writes anything. The result is explicitly marked non-posted.
 *
 * @param {object} input same shape as executePosting input
 * @param {(permission: string) => boolean} input.hasPermission
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function previewPosting(input, db = prisma) {
  const command = createPostingCommand(input);
  const { context } = command;

  const postingMode = await resolvePostingMode(db, {
    tenantId: context.businessId,
    moduleKey: command.sourceReference.sourceModule,
    eventType: command.sourceReference.eventType,
  });

  const outcome = await runValidationPipeline(db, context, command, {
    mode: 'collect',
    hasPermission: input.hasPermission,
  });

  let lines = [];
  if (outcome.draft) {
    const accounts = await loadAccountsForValidation(
      db, context, outcome.draft.lines.map((l) => l.accountId)
    );
    lines = outcome.draft.lines.map((line) => {
      const account = accounts.get(line.accountId);
      return {
        accountId: line.accountId,
        accountCode: account?.accountCode ?? account?.code ?? null,
        accountName: account?.accountName ?? account?.name ?? null,
        debit: line.debit?.decimal ?? null,
        credit: line.credit?.decimal ?? null,
        currency: outcome.draft.currency,
        description: line.description,
        dimensions: line.dimensions,
        taxCode: line.taxReference,
      };
    });
  }

  return Object.freeze({
    preview: true,
    posted: false, // a preview NEVER represents a financial effect
    valid: outcome.valid,
    postingMode,
    eventType: command.sourceReference.eventType,
    sourceReference: {
      sourceModule: command.sourceReference.sourceModule,
      sourceType: command.sourceReference.sourceType,
      sourceId: command.sourceReference.sourceId,
    },
    template: outcome.template
      ? {
          templateId: outcome.template.templateId,
          templateVersion: outcome.template.templateVersion,
          status: outcome.template.status,
        }
      : null,
    postingDate: outcome.period?.postingDate ?? command.requestedPostingDate ?? command.transactionDate,
    accountingPeriodId: outcome.period?.accountingPeriodId ?? null,
    periodName: outcome.period?.periodName ?? null,
    currency: command.currency,
    totalDebit: outcome.draft ? minorToDecimalString(outcome.draft.totals.debitMinor) : null,
    totalCredit: outcome.draft ? minorToDecimalString(outcome.draft.totals.creditMinor) : null,
    lines,
    validationErrors: outcome.issues,
    warnings: outcome.warnings,
    requestId: context.requestId,
    correlationId: context.correlationId,
  });
}

/* ────────────────────────────────────────────────────────────────────────────
 * Execute
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Submit a posting command for execution under the server-resolved posting mode.
 *
 * @param {object} input createPostingCommand input plus `hasPermission`
 * @param {(permission: string) => boolean} input.hasPermission
 * @param {import('@prisma/client').PrismaClient} [db]
 * @returns {Promise<import('./postingResult.js').PostingResult>}
 */
export async function executePosting(input, db = prisma) {
  const command = createPostingCommand(input);
  const { context, sourceReference: ref } = command;
  const startedAt = Date.now();

  const postingMode = await resolvePostingMode(db, {
    tenantId: context.businessId,
    moduleKey: ref.sourceModule,
    eventType: ref.eventType,
  });

  let result;
  try {
    if (postingMode === PostingMode.DISABLED) {
      throw new PostingDisabledError({ requestId: context.requestId, correlationId: context.correlationId });
    }
    result = await executeNewEnginePosting(db, command, PostingMode.NEW_ENGINE, input.hasPermission);
  } finally {
    logAccountingOperation({
      operation: 'executePosting',
      context,
      sourceReference: ref,
      postingMode,
      status: result?.postingStatus ?? 'FAILED',
      durationMs: Date.now() - startedAt,
      journalId: result?.journalEntryId ?? null,
    });
  }
  return result;
}

/* ── NEW_ENGINE mode ──────────────────────────────────────────────────────── */

async function executeNewEnginePosting(db, command, postingMode, hasPermission) {
  const { context, sourceReference: ref } = command;
  const commandHash = await computeCommandHash(command);

  // Phase A — claim the accounting identity in its own committed transaction so
  // a later posting failure can be recorded against a durable registry row.
  const claim = await runInAccountingTransaction(db, context, async (tx) => {
    let registration;
    try {
      registration = await registerEvent(tx, context, {
        sourceReference: ref,
        idempotencyKey: command.idempotencyKey,
        commandHash,
        transactionDate: command.transactionDate,
        requestedPostingDate: command.requestedPostingDate,
        currency: command.currency,
        amountDecimal: command.totalAmount?.decimal ?? null,
        postingMode,
      });
    } catch (err) {
      if (err instanceof DuplicateAccountingEventError) {
        // A concurrent request won the insert; treat it as a replay candidate.
        const winner = await tx.acctV2EventRegistry.findUnique({
          where: { idempotencyKey: command.idempotencyKey },
        });
        if (winner?.status === EventRegistryStatus.POSTED) {
          return { event: winner, replayedPosted: true };
        }
        throw new PostingInProgressError({
          requestId: context.requestId,
          correlationId: context.correlationId,
          diagnostic: { winnerEventId: winner?.id },
        });
      }
      throw err;
    }

    const { row: event, replayed } = registration;

    if (replayed) {
      if (event.status === EventRegistryStatus.POSTED) {
        return { event, replayedPosted: true };
      }
      if (event.status === EventRegistryStatus.IN_PROGRESS) {
        throw new PostingInProgressError({
          requestId: context.requestId,
          correlationId: context.correlationId,
          diagnostic: { eventId: event.id },
        });
      }
      if (event.status === EventRegistryStatus.SHADOWED) {
        throw new AccountingValidationError(
          'This accounting identity was recorded as a shadow posting. Authoritative posting requires a new event version.',
          [{ path: 'eventVersion', message: 'shadowed identity cannot be posted in place' }],
          { requestId: context.requestId, correlationId: context.correlationId }
        );
      }
      // RECEIVED: fall through and claim it.
    }

    const attemptCount = await tx.acctV2PostingAttempt.count({
      where: { eventRegistryId: event.id },
    });
    if (attemptCount >= MAX_POSTING_ATTEMPTS) {
      throw new AccountingValidationError(
        'This accounting event has exhausted its posting attempts. Review the recorded failures before resubmitting.',
        [{ path: 'attempts', message: `limit of ${MAX_POSTING_ATTEMPTS} reached` }],
        { requestId: context.requestId, correlationId: context.correlationId }
      );
    }

    assertEventStatusTransition(event.status, EventRegistryStatus.IN_PROGRESS);
    const claimed = await updateEventStatus(tx, context, event.id, {
      status: EventRegistryStatus.IN_PROGRESS,
    });
    return { event: claimed, replayedPosted: false };
  });

  // Idempotent replay: return the ORIGINAL result — never a second journal.
  if (claim.replayedPosted) {
    const journal = claim.event.journalEntryId
      ? await db.journalEntry.findFirst({
          where: { id: claim.event.journalEntryId, tenantId: context.businessId },
        })
      : null;
    await recordAccountingAudit(
      {
        action: AUDIT.REPLAYED,
        entityType: 'AcctV2EventRegistry',
        entityId: claim.event.id,
        userId: context.userId,
        tenantId: context.businessId,
        reason: 'Idempotent retry returned the original posting result.',
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      db
    );
    return buildPostingResult({
      event: claim.event,
      context,
      sourceReference: ref,
      postingMode: claim.event.postingMode,
      journal,
      wasExistingPosting: true,
      warnings: ['Idempotent replay: the original posting result was returned.'],
    });
  }

  const event = claim.event;
  const postingStartedAt = Date.now();

  // Phase B — the atomic posting transaction. Any failure rolls back every
  // financial write; the claim is settled to FAILED afterwards.
  try {
    const posted = await runInAccountingTransaction(
      db,
      context,
      async (tx) => {
        // Legacy↔new guard inside the transaction: no legacy active effect may coexist.
        await assertNewEnginePostingAllowed(tx, context, {
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
        });

        // Deterministic validation pipeline (strict: first failure throws).
        const outcome = await runValidationPipeline(tx, context, command, {
          mode: 'strict',
          hasPermission,
        });
        const { draft, template, period, source } = outcome;

        const journalNumber = await allocateJournalNumber(tx, context, {
          eventType: ref.eventType,
          postingDate: period.postingDate,
        });

        const persistenceParams = {
          draft,
          journalNumber,
          template: { templateId: template.templateId, templateVersion: template.templateVersion },
          accountingEventId: event.id,
          period: {
            accountingPeriodId: period.accountingPeriodId,
            financialYearLabel: period.financialYearLabel,
          },
          postingMode,
          approval: {
            approvedById: source.approvedById ?? source.approvedBy ?? null,
            approvedAt: source.approvedAt ?? null,
          },
        };

        let journal;
        if (PROMOTE_IN_PLACE_TEMPLATES.has(template.templateId)) {
          // The source row IS the draft journal — promote it to POSTED in place
          // (this is also the source posting-state update for these templates).
          journal = await promoteDraftToPosted(tx, context, source.id, persistenceParams);
        } else {
          const isReversal = template.templateId === 'REVERSAL_JOURNAL';
          journal = await createPostedJournal(tx, context, {
            ...persistenceParams,
            entryType:
              template.templateId === 'OPENING_BALANCE'
                ? 'OpeningBalance'
                : template.templateId === 'HISTORICAL_REPAIR'
                  ? 'HistoricalRepair'
                  : isReversal
                    ? 'Reversal'
                    : 'Regular',
            ...(isReversal
              ? { reversal: { originalJournalId: source.id, reversalStatus: 'REVERSAL' } }
              : {}),
          });
          await updateSourcePostingState(tx, context, { template, source, journal, event });
        }

        assertEventStatusTransition(event.status, EventRegistryStatus.POSTED);
        await updateEventStatus(tx, context, event.id, {
          status: EventRegistryStatus.POSTED,
          journalEntryId: journal.id,
        });
        // Template + approval traceability on the registry row (Phase 4 columns).
        await tx.acctV2EventRegistry.update({
          where: { id: event.id },
          data: {
            templateId: template.templateId,
            templateVersion: template.templateVersion,
            approvalReference: command.approvalReference,
            approvedBy: persistenceParams.approval.approvedById,
          },
        });

        await recordPostingAttempt(tx, {
          eventRegistryId: event.id,
          status: AttemptStatus.SUCCEEDED,
          requestId: context.requestId,
          correlationId: context.correlationId,
          transactionId: journal.id,
          durationMs: Date.now() - postingStartedAt,
          completed: true,
        });

        await recordAccountingAudit(
          {
            action: AUDIT.POSTED,
            entityType: 'JournalEntry',
            entityId: journal.id,
            userId: context.userId,
            tenantId: context.businessId,
            newValues: {
              journalNumber,
              accountingEventId: event.id,
              templateId: template.templateId,
              templateVersion: template.templateVersion,
              eventType: ref.eventType,
              sourceType: ref.sourceType,
              sourceId: ref.sourceId,
              accountingPeriodId: period.accountingPeriodId,
              postingDate: period.postingDate,
              totalDebit: minorToDecimalString(draft.totals.debitMinor),
              totalCredit: minorToDecimalString(draft.totals.creditMinor),
              approvedBy: persistenceParams.approval.approvedById,
              postingMode,
            },
            requestId: context.requestId,
            correlationId: context.correlationId,
          },
          tx
        );

        await enqueueOutboxMessage(tx, context, {
          aggregateType: 'JournalEntry',
          aggregateId: journal.id,
          eventType: 'JOURNAL_POSTED',
          payload: {
            journalNumber,
            accountingEventId: event.id,
            eventType: ref.eventType,
            sourceType: ref.sourceType,
            sourceId: ref.sourceId,
            postingMode,
          },
        });
        await enqueueOutboxMessage(tx, context, {
          aggregateType: 'AccountingEvent',
          aggregateId: event.id,
          eventType: 'SOURCE_ACCOUNTING_STATUS_CHANGED',
          payload: { sourceType: ref.sourceType, sourceId: ref.sourceId, accountingStatus: 'POSTED' },
        });

        return { journal, draft, period, warnings: outcome.warnings };
      },
      // The claim already serializes competing requests; do not retry the whole
      // posting body automatically — retries go through the recorded-failure path.
      { maxAttempts: 1 }
    );

    const postingResult = buildPostingResult({
      event: { ...event, status: EventRegistryStatus.POSTED },
      context,
      sourceReference: ref,
      postingMode,
      journal: posted.journal,
      draft: posted.draft,
      postingStatus: EventRegistryStatus.POSTED,
      accountingPeriodId: posted.period.accountingPeriodId,
      ...baseTotals(posted.draft),
      warnings: posted.warnings,
    });

    // Best-effort tax subledger projection — must never fail the posting.
    try {
      const { projectJournalToTaxSubledger } = await import(
        '../../taxManagement/taxTransactionSubledger.js'
      );
      const lines = await db.journalEntryLine.findMany({
        where: { journalEntryId: posted.journal.id },
      });
      await projectJournalToTaxSubledger({
        tenantId: context.businessId,
        journalEntry: posted.journal,
        lines,
        isReversal:
          Boolean(posted.journal?.originalJournalId) ||
          String(ref.eventType || '').includes('REVERSAL'),
        db,
      });

    } catch (projErr) {
      console.warn(
        '[tax-subledger] projection skipped:',
        projErr instanceof Error ? projErr.message : String(projErr)
      );
    }

    return postingResult;
  } catch (err) {
    await settleFailedClaim(db, context, event, err, postingStartedAt);
    throw err;
  }
}


/**
 * Source posting-state update for templates whose source is NOT the journal row.
 * The registry is the central source-accounting link; sources with their own
 * lifecycle (opening-balance batch) are additionally stamped here.
 */
async function updateSourcePostingState(tx, context, { template, source, journal, event }) {
  try {
    if (template.templateId === 'OPENING_BALANCE') {
      await tx.acctV2OpeningBalanceBatch.update({
        where: { id: source.id },
        data: {
          status: 'POSTED',
          journalEntryId: journal.id,
          accountingEventId: event.id,
        },
      });
    }
    if (template.templateId === 'REVERSAL_JOURNAL') {
      // Bidirectional reversal linkage, atomic with the reversal posting —
      // performed by the approved journal persistence module.
      await linkReversalToOriginal(tx, context, source.id, journal);
    }
    if (template.templateId === 'HISTORICAL_REPAIR') {
      // Repair action + anomaly are stamped inside the posting transaction so
      // a repair journal can never exist with an unresolved action (or vice
      // versa). If any of these updates fail the journal rolls back too.
      await tx.acctV2RepairAction.update({
        where: { id: source.id },
        data: {
          status: 'COMPLETED',
          journalEntryIds: [journal.id],
          lastAttemptAt: new Date(),
          executedBy: context.userId ?? null,
          resultSummary: {
            journalEntryId: journal.id,
            journalNumber: journal.journalNumber ?? null,
            accountingEventId: event.id,
          },
        },
      });
      await tx.acctV2HistoricalAnomaly.update({
        where: { id: source.anomalyId },
        data: {
          status: 'REPAIRED',
          repairedAt: new Date(),
          repairBatchId: source.batchId,
        },
      });
    }
    // Other operational sources keep the AcctV2EventRegistry as their
    // accounting link (central source-link decision, SOURCE_POSTING_STATUS.md).
  } catch (err) {
    throw new SourceStateUpdateError({
      requestId: context.requestId,
      correlationId: context.correlationId,
      diagnostic: { sourceId: source.id, cause: err instanceof Error ? err.message : String(err) },
    });
  }
}

/**
 * Sanctioned failure-recording path: the posting transaction has rolled back;
 * settle the durable claim to FAILED with a sanitized classification. Never
 * throws — a failure to record the failure must not mask the original error.
 */
async function settleFailedClaim(db, context, event, err, startedAt) {
  const classification = classifyPostingFailure(err);
  try {
    await runInAccountingTransaction(db, context, async (tx) => {
      const current = await tx.acctV2EventRegistry.findUnique({ where: { id: event.id } });
      if (!current || current.status !== EventRegistryStatus.IN_PROGRESS) return;
      await tx.acctV2EventRegistry.update({
        where: { id: event.id },
        data: {
          status: EventRegistryStatus.FAILED,
          failureCode: classification.code,
          failureMessage: classification.safeMessage,
          failureRetryable: classification.retryable,
        },
      });
      await recordPostingAttempt(tx, {
        eventRegistryId: event.id,
        status: classification.retryable ? AttemptStatus.FAILED_RETRYABLE : AttemptStatus.FAILED_FATAL,
        requestId: context.requestId,
        correlationId: context.correlationId,
        failureCode: classification.code,
        sanitizedFailureMessage: classification.safeMessage,
        retryable: classification.retryable,
        durationMs: Date.now() - startedAt,
        completed: true,
      });
      await recordAccountingAudit(
        {
          action: AUDIT.FAILED,
          entityType: 'AcctV2EventRegistry',
          entityId: event.id,
          userId: context.userId,
          tenantId: context.businessId,
          newValues: { failureCode: classification.code, retryable: classification.retryable },
          requestId: context.requestId,
          correlationId: context.correlationId,
        },
        tx
      );
    });
  } catch (recordErr) {
    logAccountingOperation({
      operation: 'settleFailedClaim',
      context,
      status: 'FAILURE_RECORDING_FAILED',
      error: recordErr instanceof Error ? recordErr.message : String(recordErr),
    });
  }
}

/* ── SHADOW / DUAL_COMPARE mode ───────────────────────────────────────────── */

async function executeShadowPosting(db, command, postingMode, hasPermission) {
  const { context, sourceReference: ref } = command;
  const commandHash = await computeCommandHash(command);
  const startedAt = Date.now();

  return runInAccountingTransaction(db, context, async (tx) => {
    const { row: event, replayed } = await registerEvent(tx, context, {
      sourceReference: ref,
      idempotencyKey: command.idempotencyKey,
      commandHash,
      transactionDate: command.transactionDate,
      requestedPostingDate: command.requestedPostingDate,
      currency: command.currency,
      amountDecimal: command.totalAmount?.decimal ?? null,
      postingMode,
    });

    if (replayed && event.status !== EventRegistryStatus.RECEIVED) {
      return buildPostingResult({
        event,
        context,
        sourceReference: ref,
        postingMode: event.postingMode,
        wasExistingPosting: true,
        warnings: ['Idempotent replay of an existing shadow registration.'],
      });
    }

    // Same validation and template logic as authoritative posting — but the
    // proposal lands only in the isolated shadow tables.
    const outcome = await runValidationPipeline(tx, context, command, {
      mode: 'collect',
      hasPermission,
    });

    if (!outcome.draft) {
      // The proposal could not even be generated — record the failure and stop.
      assertEventStatusTransition(event.status, EventRegistryStatus.FAILED);
      await tx.acctV2EventRegistry.update({
        where: { id: event.id },
        data: {
          status: EventRegistryStatus.FAILED,
          failureCode: outcome.issues[0]?.code ?? 'INVALID_NEW_PROPOSAL',
          failureMessage: outcome.issues[0]?.message ?? 'Shadow proposal could not be generated.',
          failureRetryable: outcome.issues[0]?.retryable ?? false,
        },
      });
      await recordPostingAttempt(tx, {
        eventRegistryId: event.id,
        status: AttemptStatus.FAILED_FATAL,
        requestId: context.requestId,
        correlationId: context.correlationId,
        failureCode: outcome.issues[0]?.code ?? 'INVALID_NEW_PROPOSAL',
        sanitizedFailureMessage: outcome.issues[0]?.message ?? null,
        retryable: false,
        durationMs: Date.now() - startedAt,
        completed: true,
      });
      return buildPostingResult({
        event: { ...event, status: EventRegistryStatus.FAILED },
        context,
        sourceReference: ref,
        postingMode,
        postingStatus: EventRegistryStatus.FAILED,
        comparisonStatus: 'INVALID_NEW_PROPOSAL',
        warnings: outcome.issues.map((i) => `${i.stage}: ${i.message}`),
      });
    }

    const shadowJournal = await persistShadowJournal(tx, context, event.id, outcome.draft);
    const legacy = await findLegacyPostingsBySource(
      context,
      { sourceType: ref.sourceType, sourceId: ref.sourceId },
      tx
    );
    const comparison = await persistShadowComparison(tx, context, shadowJournal, outcome.draft, legacy);

    assertEventStatusTransition(event.status, EventRegistryStatus.SHADOWED);
    await updateEventStatus(tx, context, event.id, { status: EventRegistryStatus.SHADOWED });
    await tx.acctV2EventRegistry.update({
      where: { id: event.id },
      data: {
        templateId: outcome.template?.templateId ?? null,
        templateVersion: outcome.template?.templateVersion ?? null,
      },
    });
    await recordPostingAttempt(tx, {
      eventRegistryId: event.id,
      status: AttemptStatus.SUCCEEDED,
      requestId: context.requestId,
      correlationId: context.correlationId,
      durationMs: Date.now() - startedAt,
      completed: true,
    });
    await recordAccountingAudit(
      {
        action: AUDIT.SHADOWED,
        entityType: 'AcctV2ShadowJournal',
        entityId: shadowJournal.id,
        userId: context.userId,
        tenantId: context.businessId,
        newValues: {
          accountingEventId: event.id,
          comparisonStatus: comparison.status,
          eventType: ref.eventType,
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
        },
        requestId: context.requestId,
        correlationId: context.correlationId,
      },
      tx
    );
    await enqueueOutboxMessage(tx, context, {
      aggregateType: 'AccountingEvent',
      aggregateId: event.id,
      eventType: 'ACCOUNTING_SHADOW_COMPARED',
      payload: {
        shadowJournalId: shadowJournal.id,
        comparisonStatus: comparison.status,
        sourceType: ref.sourceType,
        sourceId: ref.sourceId,
      },
    });

    const invalidProposal = !outcome.valid;
    return buildPostingResult({
      event: { ...event, status: EventRegistryStatus.SHADOWED },
      context,
      sourceReference: ref,
      postingMode,
      postingStatus: EventRegistryStatus.SHADOWED,
      shadowJournalId: shadowJournal.id,
      comparisonStatus: invalidProposal ? 'INVALID_NEW_PROPOSAL' : comparison.status,
      draft: outcome.draft,
      ...baseTotals(outcome.draft),
      warnings: [
        ...outcome.warnings,
        ...outcome.issues.map((i) => `Shadow validation issue — ${i.stage}: ${i.message}`),
      ],
    });
  });
}

/* ── Retry ────────────────────────────────────────────────────────────────── */

/**
 * Retry a FAILED, retryable accounting event with its ORIGINAL identity.
 * The caller supplies the same command input; the derived idempotency key and
 * command hash must match the recorded event (materially different commands
 * are rejected by the registry's conflict check).
 *
 * @param {object} input executePosting input
 * @param {import('@prisma/client').PrismaClient} [db]
 */
export async function retryPosting(input, db = prisma) {
  const command = createPostingCommand(input);
  const existing = await db.acctV2EventRegistry.findUnique({
    where: { idempotencyKey: command.idempotencyKey },
  });
  if (!existing || existing.tenantId !== command.context.businessId) {
    throw new AccountingValidationError('No recorded accounting event exists for this identity.', [
      { path: 'idempotencyKey', message: 'unknown event' },
    ]);
  }
  if (existing.status === EventRegistryStatus.POSTED) {
    // Retry after success is an idempotent replay — executePosting handles it.
    return executePosting(input, db);
  }
  if (existing.status !== EventRegistryStatus.FAILED) {
    throw new AccountingValidationError(
      `Only failed events can be retried (current status: ${existing.status}).`,
      [{ path: 'status', message: 'not retryable' }]
    );
  }
  if (!existing.failureRetryable) {
    throw new AccountingValidationError(
      'The recorded failure is not retryable. Correct the underlying cause and submit a new command.',
      [{ path: 'failureRetryable', message: existing.failureCode ?? 'non-retryable failure' }]
    );
  }
  return executePosting(input, db);
}

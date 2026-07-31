/**
 * Setup lifecycle: validate → submit → approve → post (B1) → complete / reopen.
 */

import prisma from '../prisma.js';
import {
  SETUP_RUN_STATUS,
  SETUP_STEP_STATUS,
} from './constants.js';
import { assertRunTransition } from './stateMachine.js';
import {
  BusinessSetupNotFoundError,
  BusinessSetupAlreadyCompletedError,
  CrossBusinessSetupDataError,
  OpeningTrialBalanceOutOfBalanceError,
  SetupApprovalRequiredError,
  SetupPostingInProgressError,
  SetupReopenNotAllowedError,
} from './errors.js';
import { compileOpeningLines, computeBalanceSheetEquation } from './openingLineCompiler.js';
import { runSetupReconciliations } from './reconciliationService.js';
import { resolveSetupSodPolicy, assertSetupApprovalAllowed } from './sodPolicy.js';
import {
  createOpeningBalanceBatch,
  submitOpeningBalanceBatch,
  approveOpeningBalanceBatch,
  postOpeningBalanceBatch,
  OpeningBalanceBatchStatus,
} from '../accountingV2/application/openingBalanceService.js';
import { ACCOUNTING_PERMISSIONS } from '../accountingV2/permissions.js';
import { getSetupRun } from './setupRunService.js';
import { createHash } from 'crypto';

function checksumFromCompile(compiled) {
  const payload = JSON.stringify(
    compiled.journalLines.map((l) => ({
      a: l.accountId,
      d: l.debit,
      c: l.credit,
    }))
  );
  return createHash('sha256').update(payload).digest('hex');
}

async function loadRun(runId, tenantId, db) {
  const run = await db.businessSetupRun.findFirst({
    where: { id: runId },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!run) throw new BusinessSetupNotFoundError({ setupRunId: runId });
  if (run.tenantId !== tenantId) throw new CrossBusinessSetupDataError({ setupRunId: runId });
  return run;
}

/**
 * Full validation preview (TB + equation + reconciliations).
 */
export async function validateSetupRun(runId, tenantId, db = prisma) {
  const run = await loadRun(runId, tenantId, db);
  const mappingStep = run.steps.find((s) => s.stepId === 'accountMappings');
  const mappingAccounts = mappingStep?.payload?.mappings || {};

  const compiled = await compileOpeningLines(run, {}, db);
  const equation = computeBalanceSheetEquation(compiled.lines);
  const reconciliations = runSetupReconciliations(compiled, mappingAccounts);

  if (!equation.balanced) {
    compiled.issues.push({
      severity: 'CRITICAL',
      code: 'BALANCE_SHEET_EQUATION',
      message: `Assets (${equation.totalAssets}) − Liabilities (${equation.totalLiabilities}) − Equity (${equation.totalEquity}) = ${equation.difference}`,
    });
  }

  const critical = compiled.issues.filter((i) => i.severity === 'CRITICAL');
  const blockers = [
    ...critical,
    ...reconciliations.results
      .filter((r) => r.status === 'FAILED' && r.subledger !== '0.00' && r.generalLedger !== '0.00')
      .map((r) => ({
        severity: 'CRITICAL',
        code: 'CONTROL_MISMATCH',
        message: `${r.control}: subledger ${r.subledger} vs GL ${r.generalLedger}`,
      })),
  ];

  return {
    runId: run.id,
    setupVersion: run.setupVersion,
    status: run.status,
    openingBalanceDate: run.openingBalanceDate,
    cutoverDate: run.cutoverDate,
    compiled: {
      lineCount: compiled.lines.length,
      lines: compiled.lines.map((l) => ({
        accountId: l.accountId,
        accountCode: l.accountCode,
        accountName: l.accountName,
        accountType: l.accountType,
        debit: l.debit,
        credit: l.credit,
        sourceStepId: l.sourceStepId,
        description: l.description,
        dimensions: l.dimensions || {},
      })),
      journalLines: compiled.journalLines,
      totals: compiled.totals,
      issues: compiled.issues,
    },
    equation,
    reconciliations,
    blockers,
    canSubmit: blockers.length === 0 && compiled.totals.balanced && compiled.lines.length >= 2,
    sourceChecksum: checksumFromCompile(compiled),
  };
}

export async function submitSetupForReview(runId, tenantId, userId, db = prisma) {
  const preview = await validateSetupRun(runId, tenantId, db);
  if (!preview.canSubmit) {
    throw new OpeningTrialBalanceOutOfBalanceError({
      setupRunId: runId,
      diagnostic: { blockers: preview.blockers },
    });
  }
  const run = await loadRun(runId, tenantId, db);
  assertRunTransition(run.status, SETUP_RUN_STATUS.READY_FOR_REVIEW, { setupRunId: runId });

  return db.businessSetupRun.update({
    where: { id: runId },
    data: {
      status: SETUP_RUN_STATUS.READY_FOR_REVIEW,
      submittedById: userId,
      submittedAt: new Date(),
      sourceChecksum: preview.sourceChecksum,
      lastUpdatedById: userId,
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
}

export async function approveSetupRun(runId, tenantId, userId, db = prisma) {
  const run = await loadRun(runId, tenantId, db);
  if (
    ![SETUP_RUN_STATUS.READY_FOR_REVIEW, SETUP_RUN_STATUS.UNDER_REVIEW].includes(run.status)
  ) {
    assertRunTransition(run.status, SETUP_RUN_STATUS.APPROVED, { setupRunId: runId });
  }

  const preview = await validateSetupRun(runId, tenantId, db);
  if (!preview.canSubmit) {
    throw new OpeningTrialBalanceOutOfBalanceError({ setupRunId: runId });
  }
  if (run.sourceChecksum && run.sourceChecksum !== preview.sourceChecksum) {
    throw new OpeningTrialBalanceOutOfBalanceError({
      setupRunId: runId,
      diagnostic: { reason: 'Material change since submit — re-submit required.' },
    });
  }

  const sod = await resolveSetupSodPolicy(tenantId, db);
  try {
    assertSetupApprovalAllowed(sod, run.submittedById || run.createdById, userId);
  } catch (e) {
    const err = new SetupApprovalRequiredError({
      setupRunId: runId,
      diagnostic: { message: e.message, policy: sod.policy },
    });
    throw err;
  }

  return db.businessSetupRun.update({
    where: { id: runId },
    data: {
      status: SETUP_RUN_STATUS.APPROVED,
      approvedById: userId,
      approvedAt: new Date(),
      sourceChecksum: preview.sourceChecksum,
      lastUpdatedById: userId,
      metadata: {
        ...(run.metadata && typeof run.metadata === 'object' ? run.metadata : {}),
        sodPolicy: sod,
      },
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
}

/**
 * Post one consolidated Opening Journal via AcctV2OpeningBalanceBatch (B1).
 * Idempotent: if already linked to a posted batch, return existing result.
 */
export async function postSetupRun(runId, tenantId, userId, context, hasPermission, db = prisma) {
  const run = await loadRun(runId, tenantId, db);

  if (run.status === SETUP_RUN_STATUS.COMPLETED || run.status === SETUP_RUN_STATUS.COMPLETED_WITH_WARNINGS) {
    if (run.journalEntryId || run.openingBalanceBatchId) {
      return {
        idempotent: true,
        run: await getSetupRun(runId, tenantId, db),
        batchId: run.openingBalanceBatchId,
        journalEntryId: run.journalEntryId,
      };
    }
    throw new BusinessSetupAlreadyCompletedError({ setupRunId: runId });
  }

  if (run.status === SETUP_RUN_STATUS.POSTING) {
    throw new SetupPostingInProgressError({ setupRunId: runId });
  }

  if (run.status !== SETUP_RUN_STATUS.APPROVED) {
    throw new SetupApprovalRequiredError({ setupRunId: runId });
  }

  if (!run.openingBalanceDate) {
    throw new OpeningTrialBalanceOutOfBalanceError({
      setupRunId: runId,
      diagnostic: { reason: 'Opening Balance Date is required.' },
    });
  }

  const preview = await validateSetupRun(runId, tenantId, db);
  if (!preview.canSubmit) {
    throw new OpeningTrialBalanceOutOfBalanceError({
      setupRunId: runId,
      diagnostic: { blockers: preview.blockers },
    });
  }
  if (run.sourceChecksum && run.sourceChecksum !== preview.sourceChecksum) {
    throw new OpeningTrialBalanceOutOfBalanceError({
      setupRunId: runId,
      diagnostic: { reason: 'Checksum mismatch — re-approve after changes.' },
    });
  }

  if (preview.reconciliations.failedControls?.length) {
    // only fail if both sides non-zero mismatch already filtered in validate
  }

  const sod = await resolveSetupSodPolicy(tenantId, db);
  const can = hasPermission || (() => true);

  await db.businessSetupRun.update({
    where: { id: runId },
    data: { status: SETUP_RUN_STATUS.POSTING, lastUpdatedById: userId },
  });

  try {
    let batchId = run.openingBalanceBatchId;
    if (!batchId) {
      const batch = await createOpeningBalanceBatch(
        context,
        {
          effectiveDate: run.openingBalanceDate.toISOString().slice(0, 10),
          version: run.setupVersion,
          description: `Business setup opening balances v${run.setupVersion}`,
          evidenceReference: `BUSINESS_SETUP:${tenantId}:${run.setupVersion}`,
          currency: run.baseCurrency || context.currency || 'MWK',
          lines: (preview.compiled.journalLines || preview.compiled.lines).map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
            dimensions: l.dimensions || {},
          })),
        },
        { hasPermission: can },
        db
      );
      batchId = batch.id;
      await db.businessSetupRun.update({
        where: { id: runId },
        data: { openingBalanceBatchId: batchId },
      });
    }

    const batch = await db.acctV2OpeningBalanceBatch.findFirst({ where: { id: batchId } });
    if (!batch) throw new BusinessSetupNotFoundError({ setupRunId: runId });

    if (batch.status === OpeningBalanceBatchStatus.POSTED) {
      await db.businessSetupRun.update({
        where: { id: runId },
        data: {
          status: SETUP_RUN_STATUS.COMPLETED,
          journalEntryId: batch.journalEntryId,
          postedById: userId,
          postedAt: new Date(),
          completedAt: new Date(),
        },
      });
      return {
        idempotent: true,
        run: await getSetupRun(runId, tenantId, db),
        batchId,
        journalEntryId: batch.journalEntryId,
      };
    }

    if (batch.status === OpeningBalanceBatchStatus.DRAFT) {
      await submitOpeningBalanceBatch(context, batchId, { hasPermission: can }, db);
    }

    const refreshed = await db.acctV2OpeningBalanceBatch.findFirst({ where: { id: batchId } });
    if (refreshed.status === OpeningBalanceBatchStatus.PENDING_APPROVAL) {
      await approveOpeningBalanceBatch(
        context,
        batchId,
        { hasPermission: can, allowSelfApproval: sod.allowSelfApproval },
        db
      );
    }

    const postResult = await postOpeningBalanceBatch(
      context,
      batchId,
      { hasPermission: can },
      db
    );

    const journalEntryId =
      postResult?.journalEntryId ||
      postResult?.journal?.id ||
      postResult?.id ||
      null;

    const postedBatch = await db.acctV2OpeningBalanceBatch.findFirst({ where: { id: batchId } });

    await db.$transaction(async (tx) => {
      await tx.businessSetupRun.update({
        where: { id: runId },
        data: {
          status: SETUP_RUN_STATUS.COMPLETED,
          openingBalanceBatchId: batchId,
          journalEntryId: postedBatch?.journalEntryId || journalEntryId,
          postedById: userId,
          postedAt: new Date(),
          completedAt: new Date(),
          lastUpdatedById: userId,
        },
      });
      await tx.businessSetupStep.updateMany({
        where: { setupRunId: runId, tenantId },
        data: { status: SETUP_STEP_STATUS.POSTED },
      });
    });

    return {
      idempotent: false,
      run: await getSetupRun(runId, tenantId, db),
      batchId,
      journalEntryId: postedBatch?.journalEntryId || journalEntryId,
      postResult,
    };
  } catch (error) {
    await db.businessSetupRun.update({
      where: { id: runId },
      data: {
        status: SETUP_RUN_STATUS.POSTING_FAILED,
        lastUpdatedById: userId,
        metadata: {
          ...(run.metadata && typeof run.metadata === 'object' ? run.metadata : {}),
          lastPostingError: error?.code || error?.message || 'POSTING_FAILED',
        },
      },
    });
    throw error;
  }
}

export async function requestSetupReopen(runId, tenantId, userId, reason, db = prisma) {
  const run = await loadRun(runId, tenantId, db);
  if (
    ![SETUP_RUN_STATUS.COMPLETED, SETUP_RUN_STATUS.COMPLETED_WITH_WARNINGS].includes(run.status)
  ) {
    throw new SetupReopenNotAllowedError({ setupRunId: runId });
  }
  if (!reason || !String(reason).trim()) {
    throw new SetupReopenNotAllowedError({
      setupRunId: runId,
      diagnostic: { reason: 'Reopen reason required.' },
    });
  }
  assertRunTransition(run.status, SETUP_RUN_STATUS.REOPEN_REQUESTED, { setupRunId: runId });
  return db.businessSetupRun.update({
    where: { id: runId },
    data: {
      status: SETUP_RUN_STATUS.REOPEN_REQUESTED,
      reopenReason: String(reason).trim(),
      lastUpdatedById: userId,
    },
    include: { steps: { orderBy: { sortOrder: 'asc' } } },
  });
}

/**
 * Approve reopen → create new setup version (IN_PROGRESS), preserve original journals.
 */
export async function approveSetupReopen(runId, tenantId, userId, db = prisma) {
  const run = await loadRun(runId, tenantId, db);
  if (run.status !== SETUP_RUN_STATUS.REOPEN_REQUESTED) {
    throw new SetupReopenNotAllowedError({ setupRunId: runId });
  }

  return db.$transaction(async (tx) => {
    await tx.businessSetupRun.update({
      where: { id: runId },
      data: {
        status: SETUP_RUN_STATUS.REOPENED,
        lastUpdatedById: userId,
      },
    });

    const nextVersion = run.setupVersion + 1;
    const created = await tx.businessSetupRun.create({
      data: {
        tenantId,
        setupVersion: nextVersion,
        setupType: 'REIMPLEMENTATION_RECOVERY',
        status: SETUP_RUN_STATUS.IN_PROGRESS,
        currentStepId: 'profile',
        baseCurrency: run.baseCurrency,
        timezone: run.timezone,
        openingBalanceDate: run.openingBalanceDate,
        cutoverDate: run.cutoverDate,
        createdById: userId,
        lastUpdatedById: userId,
        activityClassification: 'REQUIRES_CONTROLLED_CONVERSION',
        reopenReason: run.reopenReason,
        metadata: {
          priorSetupRunId: run.id,
          priorJournalEntryId: run.journalEntryId,
          priorOpeningBalanceBatchId: run.openingBalanceBatchId,
        },
        steps: {
          create: run.steps.map((s, index) => ({
            tenantId,
            stepId: s.stepId,
            status: SETUP_STEP_STATUS.NOT_STARTED,
            sortOrder: index,
            optional: s.optional,
            payload: s.payload || {},
          })),
        },
      },
      include: { steps: { orderBy: { sortOrder: 'asc' } } },
    });
    return created;
  });
}

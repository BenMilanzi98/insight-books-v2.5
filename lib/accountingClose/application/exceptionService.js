import { CloseExceptionStatus } from '../domain/enums.js';
import { CloseChecklistBlockedError, CrossTenantClosingError } from '../domain/errors.js';
import { loadCloseRun } from './closeRunService.js';
import { recordAccountingAudit } from '../../accountingV2/infrastructure/auditTrail.js';

export async function createCloseException(db, context, closeRunId, input) {
  const run = await loadCloseRun(db, context, closeRunId);
  if (!input.description) throw new CloseChecklistBlockedError('Exception description required.');

  const row = await db.closeV2YearEndCloseException.create({
    data: {
      tenantId: context.businessId,
      financialYearId: run.financialYearId,
      closeRunId,
      taskId: input.taskId || null,
      category: input.category || 'GENERAL',
      severity: input.severity || 'MEDIUM',
      amountMinor: input.amountMinor != null ? BigInt(input.amountMinor) : null,
      currency: input.currency || context.currency || 'MWK',
      description: String(input.description).trim(),
      rootCause: input.rootCause || null,
      evidence: input.evidence || null,
      status: CloseExceptionStatus.OPEN,
      proposedResolution: input.proposedResolution || null,
      disclosureRequired: input.disclosureRequired !== false,
      metadata: input.metadata || null,
    },
  });

  await recordAccountingAudit(
    {
      action: 'closev2.exception.created',
      entityType: 'CloseV2YearEndCloseException',
      entityId: row.id,
      userId: context.userId,
      tenantId: context.businessId,
      newValues: { severity: row.severity, category: row.category },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return row;
}

export async function resolveCloseException(db, context, exceptionId, { resolution } = {}) {
  const row = await db.closeV2YearEndCloseException.findFirst({
    where: { id: exceptionId, tenantId: context.businessId },
  });
  if (!row) throw new CrossTenantClosingError('Exception not found.');

  return db.closeV2YearEndCloseException.update({
    where: { id: exceptionId },
    data: {
      status: CloseExceptionStatus.RESOLVED,
      proposedResolution: resolution || row.proposedResolution,
      resolvedBy: context.userId,
      resolvedAt: new Date(),
    },
  });
}

export async function acceptCloseException(db, context, exceptionId, { reason } = {}) {
  const row = await db.closeV2YearEndCloseException.findFirst({
    where: { id: exceptionId, tenantId: context.businessId },
  });
  if (!row) throw new CrossTenantClosingError('Exception not found.');
  if (['CRITICAL'].includes(row.severity) && !reason) {
    throw new CloseChecklistBlockedError('Accepting a CRITICAL exception requires a reason.');
  }

  const updated = await db.closeV2YearEndCloseException.update({
    where: { id: exceptionId },
    data: {
      status: CloseExceptionStatus.ACCEPTED_FOR_CLOSE,
      acceptedBy: context.userId,
      acceptedAt: new Date(),
      proposedResolution: reason || row.proposedResolution,
      disclosureRequired: true,
    },
  });

  await recordAccountingAudit(
    {
      action: 'closev2.exception.accepted',
      entityType: 'CloseV2YearEndCloseException',
      entityId: exceptionId,
      userId: context.userId,
      tenantId: context.businessId,
      reason: reason || null,
      newValues: { severity: row.severity, status: CloseExceptionStatus.ACCEPTED_FOR_CLOSE },
      requestId: context.requestId,
      correlationId: context.correlationId,
    },
    db
  );

  return updated;
}

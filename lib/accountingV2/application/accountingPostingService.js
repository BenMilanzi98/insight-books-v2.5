/**
 * Accounting V2 — transition posting coordinator (retired).
 *
 * Fresh-books V2-only: all authoritative posting must use `executePosting`.
 * This module remains as a hard refuse for any leftover transition callers.
 */

import { PostingMode } from '../domain/enums.js';
import { AccountingConfigurationError, PostingDisabledError } from '../domain/errors.js';
import { resolvePostingMode } from '../infrastructure/featureFlags.js';
import prisma from '../../prisma.js';
import { validateDimensions } from '../domain/dimensionPolicy.js';

/**
 * @deprecated Use `executePosting` from `lib/accountingV2/engine/postingEngine.js`.
 */
export async function postAccountingEvent(command, db = prisma) {
  const { context, sourceReference: ref } = command;
  if (!context?.businessId) {
    throw new AccountingConfigurationError('Posting command requires an accounting context.');
  }
  validateDimensions(ref.eventType, command.dimensions ?? {});

  const mode = await resolvePostingMode(db, {
    tenantId: context.businessId,
    moduleKey: ref.sourceModule,
    eventType: ref.eventType,
  });

  if (mode === PostingMode.DISABLED) {
    throw new PostingDisabledError({ requestId: context.requestId, correlationId: context.correlationId });
  }

  throw new AccountingConfigurationError(
    'postAccountingEvent is retired. Use executePosting (NEW_ENGINE) for all financial posting.',
    { requestId: context.requestId, correlationId: context.correlationId }
  );
}

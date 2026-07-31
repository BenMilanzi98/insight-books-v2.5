/**
 * Phase 9+ — module cutover bridge (V2-only).
 *
 * NEW_ENGINE is the sole posting authority. DISABLED refuses posting.
 * Legacy / shadow dual-paths are removed.
 */

import { resolvePostingMode } from '../infrastructure/featureFlags.js';
import { executePosting } from '../engine/postingEngine.js';
import { PostingMode } from '../domain/enums.js';
import { PostingDisabledError } from '../domain/errors.js';

const ids = (context) => ({ requestId: context.requestId, correlationId: context.correlationId });

/**
 * @param {object} params
 * @param {object} params.db
 * @param {import('../domain/accountingContext.js').AccountingContext} params.context
 * @param {string} params.moduleKey AccountingSourceModule
 * @param {string} params.eventType AccountingEventType
 * @param {() => Promise<object>|object} params.buildEngineInput
 * @param {(p: string) => boolean} [params.hasPermission]
 */
export async function runCutoverPosting({
  db,
  context,
  moduleKey,
  eventType,
  buildEngineInput,
  hasPermission = () => true,
}) {
  const mode = await resolvePostingMode(db, {
    tenantId: context.businessId,
    moduleKey,
    eventType,
  });

  if (mode === PostingMode.DISABLED) {
    throw new PostingDisabledError(
      'Financial posting is disabled for this module/event.',
      ids(context)
    );
  }

  const input = await buildEngineInput();
  // Must forward `db` (often the caller’s interactive transaction) so source
  // validation can see uncommitted operational rows created in the same tx.
  const result = await executePosting(
    {
      ...input,
      context,
      hasPermission,
    },
    db
  );
  return { mode: PostingMode.NEW_ENGINE, authority: 'V2', result };
}

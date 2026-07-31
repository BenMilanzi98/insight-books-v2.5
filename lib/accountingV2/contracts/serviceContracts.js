/**
 * Accounting V2 — service contracts.
 *
 * JavaScript equivalent of interface definitions: each contract lists the methods a
 * conforming implementation must provide. `assertImplements` gives runtime enforcement;
 * the architecture test suite verifies every registered implementation.
 *
 * Phase responsibilities:
 *  - Phase 2 ships legacy-backed implementations (read-only) and the transition
 *    posting coordinator.
 *  - Phases 3–8 replace implementations behind the same contracts.
 */

import { getLegacyLedgerTotals, getLegacyAccountLines } from '../infrastructure/legacy/legacyLedgerQueryAdapter.js';
import { getLegacyTrialBalance } from '../infrastructure/legacy/legacyTrialBalanceAdapter.js';
import { resolveLegacyPeriod } from '../infrastructure/legacy/legacyPeriodResolver.js';
import { resolveMappedAccountV2 } from '../../coaV2/application/accountMappingRegistry.js';
import { getLegacyReversalState } from '../infrastructure/legacy/legacyReversalAdapter.js';
import { findLegacyPostingsBySource } from '../infrastructure/legacy/legacyPostingAdapter.js';
import { postAccountingEvent } from '../application/accountingPostingService.js';
import { findByIdempotencyKey, findBySource } from '../infrastructure/eventRegistryRepository.js';

/** @param {object} impl @param {string[]} methods @param {string} contractName */
export function assertImplements(impl, methods, contractName) {
  const missing = methods.filter((m) => typeof impl?.[m] !== 'function');
  if (missing.length > 0) {
    throw new TypeError(`${contractName} implementation missing: ${missing.join(', ')}`);
  }
  return impl;
}

export const CONTRACTS = Object.freeze({
  AccountingPostingService: ['post'],
  AccountMappingService: ['resolveMappedAccount'],
  PeriodResolutionService: ['resolvePeriod'],
  JournalRepository: ['findEventByIdempotencyKey', 'findEventsBySource', 'findLegacyPostingsBySource'],
  GeneralLedgerQueryService: ['getLedgerTotals', 'getAccountActivity'],
  TrialBalanceQueryService: ['getTrialBalance'],
  ReversalService: ['getReversalState'],
});

/**
 * Posting service — transition coordinator (see accountingPostingService.js).
 */
export const accountingPostingService = assertImplements(
  { post: postAccountingEvent },
  CONTRACTS.AccountingPostingService,
  'AccountingPostingService'
);

/**
 * Account mapping — Phase 3 registry-backed (`CoaV2AccountMapping`). Registry rows
 * take precedence; while the `coaV2CanonicalMappings` flag is OFF for a business,
 * missing rows fall back to the Phase 2 legacy-code adapter. Missing mapping raises
 * MissingAccountMappingError, never a silent fallback account.
 */
export const accountMappingService = assertImplements(
  {
    /** @param {object} context @param {string} mappingKey */
    resolveMappedAccount: (context, mappingKey, db) => resolveMappedAccountV2(context, mappingKey, db),
  },
  CONTRACTS.AccountMappingService,
  'AccountMappingService'
);

/**
 * Period resolution — deny-by-default policy over legacy period rows.
 * Phase 8 (Financial Calendar) replaces the backing.
 */
export const periodResolutionService = assertImplements(
  {
    resolvePeriod: (context, entryDate, db) => resolveLegacyPeriod(context, entryDate, db),
  },
  CONTRACTS.PeriodResolutionService,
  'PeriodResolutionService'
);

/**
 * Journal repository — V2 event registry + read-only legacy lookups.
 * Deliberately provides NO update/delete of posted journals.
 */
export const journalRepository = assertImplements(
  {
    findEventByIdempotencyKey: (db, context, key) => findByIdempotencyKey(db, context, key),
    findEventsBySource: (db, context, ref) => findBySource(db, context, ref),
    findLegacyPostingsBySource: (context, ref, db) => findLegacyPostingsBySource(context, ref, db),
  },
  CONTRACTS.JournalRepository,
  'JournalRepository'
);

/**
 * General Ledger queries — read-only, legacy-backed. Phase 5 swaps the backing
 * behind the `accountingV2NewLedgerQuery` flag.
 */
export const generalLedgerQueryService = assertImplements(
  {
    getLedgerTotals: (context, range, db) => getLegacyLedgerTotals(context, range, db),
    getAccountActivity: (context, accountId, range, db) => getLegacyAccountLines(context, accountId, range, db),
  },
  CONTRACTS.GeneralLedgerQueryService,
  'GeneralLedgerQueryService'
);

/**
 * Trial Balance queries — read-only, legacy-backed. Phase 7 swaps the backing
 * behind the `accountingV2NewTrialBalance` flag.
 */
export const trialBalanceQueryService = assertImplements(
  {
    getTrialBalance: (context, query, db) => getLegacyTrialBalance(context, query, db),
  },
  CONTRACTS.TrialBalanceQueryService,
  'TrialBalanceQueryService'
);

/**
 * Reversal service — Phase 2 exposes read-only reversal state; execution arrives
 * with the V2 engine (duplicate-reversal prevention via event identity:
 * REVERSAL_POSTED + eventVersion in the registry).
 */
export const reversalService = assertImplements(
  {
    getReversalState: (context, transactionId, db) => getLegacyReversalState(context, transactionId, db),
  },
  CONTRACTS.ReversalService,
  'ReversalService'
);

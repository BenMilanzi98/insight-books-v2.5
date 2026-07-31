/**
 * CoA V2 — feature flags (Phase 3 §40).
 *
 * Server-controlled flags stored in the Phase 2 `AcctV2FeatureFlag` table and
 * evaluated with the same scope-precedence rules (`isFlagEnabled`). Keys are
 * registered in the Phase 2 flag framework (single source); this module
 * re-exports them under the CoA name. All flags default OFF: strict enforcement
 * never activates before migration readiness.
 */

import { COA_FLAGS } from '../../accountingV2/infrastructure/featureFlags.js';

export const COA_FLAG = COA_FLAGS;
export const COA_FLAG_KEYS = Object.freeze(Object.values(COA_FLAGS));

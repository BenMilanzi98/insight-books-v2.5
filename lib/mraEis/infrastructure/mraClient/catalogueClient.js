import { resolveActivationMode } from './environmentConfig.js';
import { mockGetCatalogue, mockSubmitInitialInventory } from './mockMraCatalogueServer.js';
import {
  assertCatalogueSyncContractAllowsLiveCall,
  getInitialInventoryContractDecision,
} from '../../application/catalogue/productSyncContract.js';
import { EisErrors } from '../../domain/errors.js';

/**
 * Server-only catalogue client. No GET↔POST fallback. Production live calls blocked.
 */
export async function fetchCatalogueFromMra({
  mappedRequest,
  environment = 'SANDBOX',
  method = 'POST',
}) {
  const mode = resolveActivationMode();
  assertCatalogueSyncContractAllowsLiveCall({ environment, mode });

  if (String(method).toUpperCase() !== 'POST') {
    throw EisErrors.validation({
      message: 'Catalogue client does not fall back between GET and POST.',
      code: 'PRODUCT_SYNC_METHOD_CONFLICT',
    });
  }

  if (mode !== 'MOCK' && String(environment).toUpperCase() === 'PRODUCTION') {
    throw EisErrors.validation({
      message: 'Production catalogue synchronization is blocked until the Product sync contract is verified.',
      code: 'PRODUCT_SYNC_CONTRACT_UNVERIFIED',
    });
  }

  // MOCK path only for now
  return mockGetCatalogue({ body: mappedRequest.body, method: 'POST' });
}

export async function submitInitialInventoryToMra({ snapshotId, idempotencyKey, environment = 'SANDBOX' }) {
  const decision = getInitialInventoryContractDecision();
  const flag = String(process.env.MRA_EIS_INITIAL_INVENTORY_SUBMIT || '').toLowerCase() === 'true';
  if (!decision.submissionEnabled || !flag) {
    throw EisErrors.validation({
      message: decision.message,
      code: 'INITIAL_INVENTORY_CONTRACT_UNVERIFIED',
      httpStatus: 409,
      requiredAction: 'AWAIT_MRA_CLARIFICATION',
    });
  }
  const mode = resolveActivationMode();
  if (mode !== 'MOCK') {
    throw EisErrors.validation({
      message: 'Live Initial Inventory submission is not enabled.',
      code: 'INITIAL_INVENTORY_CONTRACT_UNVERIFIED',
    });
  }
  return mockSubmitInitialInventory({ snapshotId, idempotencyKey, environment });
}

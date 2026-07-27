/**
 * Product/Service sync contract decision (Phase 1 Q-003).
 * Guide documents GET; OpenAPI documents POST for get-terminal-site-products.
 * Production calls remain blocked until MRA clarifies. MOCK uses verified POST shape.
 */
export const PRODUCT_SYNC_CONTRACT_STATUS = Object.freeze({
  VERIFIED_GET: 'VERIFIED_GET',
  VERIFIED_POST: 'VERIFIED_POST',
  VERIFIED_OTHER_METHOD: 'VERIFIED_OTHER_METHOD',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

export const CATALOGUE_REPLACEMENT_POLICY = Object.freeze({
  FULL_SNAPSHOT: 'FULL_SNAPSHOT',
  DELTA: 'DELTA',
  PAGINATED_FULL_SNAPSHOT: 'PAGINATED_FULL_SNAPSHOT',
  PAGINATED_DELTA: 'PAGINATED_DELTA',
  UNKNOWN: 'UNKNOWN',
});

export const INITIAL_INVENTORY_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

export function getProductSyncContractDecision() {
  return {
    status: PRODUCT_SYNC_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    preferredMethodAssumption: 'POST',
    preferredRouteAssumption: '/api/v1/utilities/get-terminal-site-products',
    clarificationId: 'Q-003',
    productionCallsAllowed: false,
    mockCallsAllowed: true,
    autoFallbackBetweenGetAndPost: false,
    message:
      'Product sync HTTP method remains conflicting (GET guide vs POST OpenAPI). Production sync blocked. MOCK uses POST only — never falls back to GET.',
    decisionVersion: 'phase10-product-sync-contract-v1',
  };
}

export function getServiceSyncContractDecision() {
  return {
    status: PRODUCT_SYNC_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    preferredMethodAssumption: 'POST',
    sharedEndpointWithProducts: true,
    externalTypeFilter: 'SERVICE',
    productionCallsAllowed: false,
    mockCallsAllowed: true,
    clarificationId: 'Q-003',
    message:
      'Service catalogue assumed to share Product utility endpoint with externalType discrimination until MRA clarifies. Production sync blocked.',
    decisionVersion: 'phase10-service-sync-contract-v1',
  };
}

export function getCatalogueReplacementDeltaPolicy() {
  return {
    policy: CATALOGUE_REPLACEMENT_POLICY.UNKNOWN,
    inactivationAllowedOnPartialPage: false,
    inactivationRequiresCompleteValidatedRun: true,
    message:
      'Response semantics (full snapshot vs delta) are not verified. Missing records are never inactivated after partial failures or under UNKNOWN policy.',
    policyVersion: 'phase10-catalogue-replacement-delta-v1',
  };
}

export function getInitialInventoryContractDecision() {
  return {
    status: INITIAL_INVENTORY_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
    submissionEnabled: false,
    featureFlag: 'MRA_EIS_INITIAL_INVENTORY_SUBMIT',
    message:
      'Initial Inventory submission remains blocked until the MRA Inventory endpoint, method, hashing and acceptance semantics are verified.',
    decisionVersion: 'phase10-initial-inventory-contract-v1',
  };
}

export function assertCatalogueSyncContractAllowsLiveCall({ environment, mode }) {
  const product = getProductSyncContractDecision();
  const isMock = String(mode || process.env.MRA_EIS_ACTIVATION_MODE || 'MOCK').toUpperCase() === 'MOCK';
  const env = String(environment || '').toUpperCase();
  if (env === 'PRODUCTION' || !isMock) {
    const err = new Error(product.message);
    err.code = 'PRODUCT_SYNC_CONTRACT_UNVERIFIED';
    err.httpStatus = 409;
    throw err;
  }
  if (!product.mockCallsAllowed) {
    const err = new Error('Catalogue mock sync is not permitted.');
    err.code = 'PRODUCT_SYNC_CONTRACT_BLOCKED';
    throw err;
  }
  return { allowed: true, method: 'POST', mock: true };
}

import { MAPPING_TYPE } from '../../domain/operationalEnums.js';
import { EisErrors } from '../../domain/errors.js';

export const BUNDLE_POLICY = Object.freeze({
  MAP_BUNDLE_AS_APPROVED_PRODUCT: 'MAP_BUNDLE_AS_APPROVED_PRODUCT',
  EXPLODE_TO_COMPONENTS: 'EXPLODE_TO_COMPONENTS',
  MAP_AS_SERVICE: 'MAP_AS_SERVICE',
  UNSUPPORTED: 'UNSUPPORTED',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
});

export const VARIANT_POLICY = Object.freeze({
  SEPARATE_MRA_PRODUCTS: 'SEPARATE_MRA_PRODUCTS',
  SINGLE_WITH_DESCRIPTION: 'SINGLE_WITH_DESCRIPTION',
  SINGLE_WITH_BARCODE: 'SINGLE_WITH_BARCODE',
  UNSUPPORTED: 'UNSUPPORTED',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
});

export function getBundlePolicy() {
  return {
    policy: BUNDLE_POLICY.REQUIRES_MRA_CLARIFICATION,
    blocked: true,
    message: 'Bundle/kit/composite fiscalization is blocked until MRA treatment is verified. No silent explode/flatten.',
    policyVersion: 'phase10-bundle-policy-v1',
  };
}

export function getVariantPolicy() {
  return {
    policy: VARIANT_POLICY.REQUIRES_MRA_CLARIFICATION,
    // No ProductVariant model in schema — treat as unsupported structure when detected
    blocked: false,
    requiresExplicitMappingPerSellableSku: true,
    message: 'No ProductVariant model; each sellable SKU/barcode must map explicitly. Do not collapse variants automatically.',
    policyVersion: 'phase10-variant-policy-v1',
  };
}

/**
 * Cross-type mappings blocked unless APPROVED_* type after official permission.
 */
export function assertCrossTypeMappingAllowed(mappingType) {
  if (mappingType === 'PRODUCT_TO_SERVICE' || mappingType === 'SERVICE_TO_PRODUCT') {
    throw EisErrors.productMappingConflict({
      message: 'Cross-type Product↔Service mapping is blocked by default.',
      code: 'PRODUCT_SERVICE_TYPE_MISMATCH',
    });
  }
  if (
    mappingType === MAPPING_TYPE.APPROVED_PRODUCT_TO_SERVICE
    || mappingType === MAPPING_TYPE.APPROVED_SERVICE_TO_PRODUCT
  ) {
    return { allowed: true, requiresApproval: true, requiresManualReview: true };
  }
  return { allowed: true, requiresApproval: false };
}

export function assertExternalTypeMatchesMapping({ mappingType, externalType, isLocalService }) {
  const ext = String(externalType || '').toUpperCase();
  if (mappingType === MAPPING_TYPE.PRODUCT_TO_PRODUCT) {
    if (isLocalService || ext !== 'PRODUCT') {
      throw EisErrors.productMappingConflict({
        message: 'PRODUCT_TO_PRODUCT requires local Product and external Product.',
        code: 'PRODUCT_SERVICE_TYPE_MISMATCH',
      });
    }
  }
  if (mappingType === MAPPING_TYPE.SERVICE_TO_SERVICE) {
    if (!isLocalService || ext !== 'SERVICE') {
      throw EisErrors.productMappingConflict({
        message: 'SERVICE_TO_SERVICE requires local Service and external Service.',
        code: 'PRODUCT_SERVICE_TYPE_MISMATCH',
      });
    }
  }
}

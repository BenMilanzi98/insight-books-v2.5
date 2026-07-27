import { SPLIT_PAYMENT_POLICY } from '../../domain/operationalEnums.js';

export const MAPPING_CONTRACT_STATUS = Object.freeze({
  VERIFIED: 'VERIFIED',
  VERIFIED_IN_SANDBOX: 'VERIFIED_IN_SANDBOX',
  PROVISIONAL: 'PROVISIONAL',
  CONFLICTING_DOCUMENTATION: 'CONFLICTING_DOCUMENTATION',
  REQUIRES_MRA_CLARIFICATION: 'REQUIRES_MRA_CLARIFICATION',
  BLOCKED: 'BLOCKED',
});

/**
 * Canonical Phase 9 mapping-type registry.
 */
export const MraMappingTypeRegistry = Object.freeze({
  BUSINESS_TO_TAXPAYER_IDENTITY: {
    mappingType: 'BUSINESS_TO_TAXPAYER_IDENTITY',
    scope: 'BUSINESS',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  BRANCH_TO_MRA_SITE: {
    mappingType: 'BRANCH_TO_MRA_SITE',
    scope: 'BRANCH',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  WAREHOUSE_TO_MRA_SITE: {
    mappingType: 'WAREHOUSE_TO_MRA_SITE',
    scope: 'WAREHOUSE',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE: {
    mappingType: 'WAREHOUSE_TO_MRA_VIRTUAL_WAREHOUSE',
    scope: 'WAREHOUSE',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
  },
  TERMINAL_TO_MRA_SITE: {
    mappingType: 'TERMINAL_TO_MRA_SITE',
    scope: 'TERMINAL',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  LOCAL_TAX_RATE_TO_MRA_TAX_ID: {
    mappingType: 'LOCAL_TAX_RATE_TO_MRA_TAX_ID',
    scope: 'TAX',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  LOCAL_LEVY_TO_MRA_LEVY: {
    mappingType: 'LOCAL_LEVY_TO_MRA_LEVY',
    scope: 'LEVY',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  LOCAL_PAYMENT_METHOD_TO_MRA_PAYMENT_CODE: {
    mappingType: 'LOCAL_PAYMENT_METHOD_TO_MRA_PAYMENT_CODE',
    scope: 'PAYMENT',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  CREDIT_SALE_TO_MRA_CREDIT_CODE: {
    mappingType: 'CREDIT_SALE_TO_MRA_CREDIT_CODE',
    scope: 'PAYMENT',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  SPLIT_PAYMENT_TO_MRA_REPRESENTATION: {
    mappingType: 'SPLIT_PAYMENT_TO_MRA_REPRESENTATION',
    scope: 'PAYMENT',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
  },
  PRODUCT_TO_PRODUCT: {
    mappingType: 'PRODUCT_TO_PRODUCT',
    scope: 'PRODUCT',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  SERVICE_TO_SERVICE: {
    mappingType: 'SERVICE_TO_SERVICE',
    scope: 'SERVICE',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.PROVISIONAL,
  },
  PRODUCT_TO_SERVICE: {
    mappingType: 'PRODUCT_TO_SERVICE',
    scope: 'PRODUCT',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.BLOCKED,
  },
  SERVICE_TO_PRODUCT: {
    mappingType: 'SERVICE_TO_PRODUCT',
    scope: 'SERVICE',
    verificationRequired: true,
    approvalRequiredProduction: true,
    contractStatus: MAPPING_CONTRACT_STATUS.BLOCKED,
  },
});

export function getSplitPaymentPolicy() {
  const forced = String(process.env.MRA_EIS_SPLIT_PAYMENT_POLICY || '').toUpperCase();
  if (forced && Object.values(SPLIT_PAYMENT_POLICY).includes(forced)) return forced;
  return SPLIT_PAYMENT_POLICY.REQUIRES_MRA_CLARIFICATION;
}

export function getMappingType(mappingType) {
  return MraMappingTypeRegistry[mappingType] || null;
}

export function isMappingTypeBlocked(mappingType) {
  const entry = MraMappingTypeRegistry[mappingType];
  if (!entry) return true;
  return [
    MAPPING_CONTRACT_STATUS.BLOCKED,
    MAPPING_CONTRACT_STATUS.REQUIRES_MRA_CLARIFICATION,
  ].includes(entry.contractStatus);
}

/**
 * Canonical Sales transaction type registry — Phase 11.
 * Classification is structural, not amount-based.
 */

export const SALES_SOURCE_TYPE = Object.freeze({
  POS_SALE: 'POS_SALE',
  SALES_INVOICE: 'SALES_INVOICE',
  CREDIT_NOTE: 'CREDIT_NOTE',
  DEBIT_NOTE: 'DEBIT_NOTE',
  SALE_RETURN: 'SALE_RETURN',
  SALE_CANCELLATION: 'SALE_CANCELLATION',
  POS_REFUND: 'POS_REFUND',
  QUOTATION: 'QUOTATION',
  ESTIMATE: 'ESTIMATE',
  PROFORMA_INVOICE: 'PROFORMA_INVOICE',
  PURCHASE: 'PURCHASE',
  PURCHASE_INVOICE: 'PURCHASE_INVOICE',
  SUPPLIER_PAYMENT: 'SUPPLIER_PAYMENT',
  CUSTOMER_PAYMENT: 'CUSTOMER_PAYMENT',
  EXPENSE: 'EXPENSE',
  JOURNAL_ENTRY: 'JOURNAL_ENTRY',
  OPENING_BALANCE: 'OPENING_BALANCE',
  OPENING_STOCK: 'OPENING_STOCK',
  STOCK_TRANSFER: 'STOCK_TRANSFER',
  STOCK_ADJUSTMENT: 'STOCK_ADJUSTMENT',
  LOAN: 'LOAN',
  DEPOSIT: 'DEPOSIT',
  CUSTOMER_ADVANCE: 'CUSTOMER_ADVANCE',
  DELIVERY_NOTE: 'DELIVERY_NOTE',
  SALES_ORDER: 'SALES_ORDER',
  INTERNAL_TRANSFER: 'INTERNAL_TRANSFER',
});

/** @typedef {'PHASE_11'|'PHASE_12_PLUS'|'NEVER'|'FUTURE_CORRECTION'} PhaseOwnership */

const QUALIFYING = new Set([SALES_SOURCE_TYPE.POS_SALE, SALES_SOURCE_TYPE.SALES_INVOICE]);

const CORRECTION = new Set([
  SALES_SOURCE_TYPE.CREDIT_NOTE,
  SALES_SOURCE_TYPE.DEBIT_NOTE,
  SALES_SOURCE_TYPE.SALE_RETURN,
  SALES_SOURCE_TYPE.SALE_CANCELLATION,
  SALES_SOURCE_TYPE.POS_REFUND,
]);

const EXPLICIT_NON_SALE = new Set([
  SALES_SOURCE_TYPE.QUOTATION,
  SALES_SOURCE_TYPE.ESTIMATE,
  SALES_SOURCE_TYPE.PROFORMA_INVOICE,
  SALES_SOURCE_TYPE.PURCHASE,
  SALES_SOURCE_TYPE.PURCHASE_INVOICE,
  SALES_SOURCE_TYPE.SUPPLIER_PAYMENT,
  SALES_SOURCE_TYPE.CUSTOMER_PAYMENT,
  SALES_SOURCE_TYPE.EXPENSE,
  SALES_SOURCE_TYPE.JOURNAL_ENTRY,
  SALES_SOURCE_TYPE.OPENING_BALANCE,
  SALES_SOURCE_TYPE.OPENING_STOCK,
  SALES_SOURCE_TYPE.STOCK_TRANSFER,
  SALES_SOURCE_TYPE.STOCK_ADJUSTMENT,
  SALES_SOURCE_TYPE.LOAN,
  SALES_SOURCE_TYPE.DEPOSIT,
  SALES_SOURCE_TYPE.CUSTOMER_ADVANCE,
  SALES_SOURCE_TYPE.DELIVERY_NOTE,
  SALES_SOURCE_TYPE.SALES_ORDER,
  SALES_SOURCE_TYPE.INTERNAL_TRANSFER,
]);

/**
 * @returns {{
 *   sourceType: string,
 *   eisApplicability: 'QUALIFYING'|'EXCLUDED'|'CORRECTION_FUTURE'|'UNKNOWN',
 *   triggerState: string|null,
 *   accountingEffect: string,
 *   inventoryEffect: string,
 *   buyerRequirement: string,
 *   paymentRequirement: string,
 *   correctionStatus: string,
 *   phaseOwnership: PhaseOwnership,
 *   eligibilityContractStatus: string,
 * }}
 */
export function getSalesTransactionTypeDefinition(sourceType) {
  const type = String(sourceType || '').toUpperCase();

  if (QUALIFYING.has(type)) {
    return {
      sourceType: type,
      eisApplicability: 'QUALIFYING',
      triggerState: type === SALES_SOURCE_TYPE.POS_SALE ? 'COMPLETED' : 'ISSUED_OR_POSTED',
      accountingEffect: 'EXISTING_AUTHORITATIVE_POSTING',
      inventoryEffect: type === SALES_SOURCE_TYPE.POS_SALE ? 'EXISTING_AUTHORITATIVE_POSTING' : 'WHEN_APPLICABLE',
      buyerRequirement: 'CLASSIFY_THEN_EVALUATE',
      paymentRequirement: 'RESOLVE_ALL_COMPONENTS',
      correctionStatus: 'NOT_A_CORRECTION',
      phaseOwnership: 'PHASE_11',
      eligibilityContractStatus: 'VERIFIED_IN_SANDBOX',
    };
  }

  if (CORRECTION.has(type)) {
    return {
      sourceType: type,
      eisApplicability: 'CORRECTION_FUTURE',
      triggerState: null,
      accountingEffect: 'LOCAL_ONLY_UNTIL_MRA_CORRECTION',
      inventoryEffect: 'LOCAL_ONLY_UNTIL_MRA_CORRECTION',
      buyerRequirement: 'DEFER',
      paymentRequirement: 'DEFER',
      correctionStatus: 'FUTURE_MRA_CORRECTION_WORKFLOW',
      phaseOwnership: 'FUTURE_CORRECTION',
      eligibilityContractStatus: 'BLOCKED',
    };
  }

  if (EXPLICIT_NON_SALE.has(type)) {
    return {
      sourceType: type,
      eisApplicability: 'EXCLUDED',
      triggerState: null,
      accountingEffect: 'UNCHANGED_LOCAL',
      inventoryEffect: 'UNCHANGED_LOCAL',
      buyerRequirement: 'N_A',
      paymentRequirement: 'N_A',
      correctionStatus: 'N_A',
      phaseOwnership: 'NEVER',
      eligibilityContractStatus: 'VERIFIED',
    };
  }

  return {
    sourceType: type || 'UNKNOWN',
    eisApplicability: 'UNKNOWN',
    triggerState: null,
    accountingEffect: 'UNKNOWN',
    inventoryEffect: 'UNKNOWN',
    buyerRequirement: 'MANUAL_REVIEW',
    paymentRequirement: 'MANUAL_REVIEW',
    correctionStatus: 'MANUAL_REVIEW',
    phaseOwnership: 'NEVER',
    eligibilityContractStatus: 'REQUIRES_MRA_CLARIFICATION',
  };
}

export function isQualifyingSalesSourceType(sourceType) {
  return QUALIFYING.has(String(sourceType || '').toUpperCase());
}

export function isExplicitNonSaleSourceType(sourceType) {
  return EXPLICIT_NON_SALE.has(String(sourceType || '').toUpperCase());
}

export function isCorrectionSourceType(sourceType) {
  return CORRECTION.has(String(sourceType || '').toUpperCase());
}

/** Never classify by amount alone. */
export function classifySourceTypeFromHints({
  documentKind = null,
  invoiceStatus = null,
  isProforma = false,
  isQuotation = false,
  isEstimate = false,
  isPurchase = false,
  isExpense = false,
  isCustomerPayment = false,
  isPosSale = false,
  isSalesInvoice = false,
} = {}) {
  if (isCustomerPayment) return SALES_SOURCE_TYPE.CUSTOMER_PAYMENT;
  if (isPurchase) return SALES_SOURCE_TYPE.PURCHASE_INVOICE;
  if (isExpense) return SALES_SOURCE_TYPE.EXPENSE;
  if (isQuotation || String(documentKind).toUpperCase() === 'QUOTATION') {
    return SALES_SOURCE_TYPE.QUOTATION;
  }
  if (isEstimate) return SALES_SOURCE_TYPE.ESTIMATE;
  if (isProforma || String(invoiceStatus).toUpperCase() === 'PROFORMA') {
    return SALES_SOURCE_TYPE.PROFORMA_INVOICE;
  }
  if (isPosSale) return SALES_SOURCE_TYPE.POS_SALE;
  if (isSalesInvoice) return SALES_SOURCE_TYPE.SALES_INVOICE;
  return 'UNKNOWN';
}

export const SALES_TRANSACTION_TYPE_REGISTRY_VERSION = 'phase11-sales-type-registry-v1';

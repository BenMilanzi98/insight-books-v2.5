/**
 * Non-mutating preflight eligibility command — Phase 11.
 */
import {
  evaluateMraEisSaleEligibility,
  EVALUATION_PURPOSE,
} from './eligibilityPipeline.js';
import { projectTransactionEisStatus } from './statusAndMessaging.js';
import { documentTypeMessage } from './statusAndMessaging.js';
import {
  classifySourceTypeFromHints,
  SALES_SOURCE_TYPE,
} from './salesTransactionTypeRegistry.js';
import { SalesEligibilityErrors } from './salesEligibilityErrors.js';

/**
 * PreflightMraEisSaleEligibility — does not finalize, create journals, stock, bridge, or outbox.
 */
export async function preflightMraEisSaleEligibility({
  sourceType,
  sourceId = null,
  expectedSourceVersion = '1',
  intendedFinalizationAction = 'FINALIZE',
  actorContext = null,
  ...candidate
} = {}) {
  if (!candidate.tenantId) {
    throw SalesEligibilityErrors.businessMismatch({ message: 'tenantId is required.' });
  }

  let resolvedType = sourceType;
  if (!resolvedType) {
    resolvedType = classifySourceTypeFromHints({
      isPosSale: candidate.isPosSale,
      isSalesInvoice: candidate.isSalesInvoice,
      isQuotation: candidate.isQuotation,
      isProforma: candidate.isProforma,
      isCustomerPayment: candidate.isCustomerPayment,
      isPurchase: candidate.isPurchase,
      isExpense: candidate.isExpense,
    });
  }

  const typeMsg = documentTypeMessage(resolvedType);
  if (
    resolvedType === SALES_SOURCE_TYPE.QUOTATION ||
    resolvedType === SALES_SOURCE_TYPE.PROFORMA_INVOICE ||
    resolvedType === SALES_SOURCE_TYPE.CUSTOMER_PAYMENT ||
    resolvedType === SALES_SOURCE_TYPE.PURCHASE_INVOICE
  ) {
    return {
      purpose: EVALUATION_PURPOSE.PREFLIGHT,
      mutates: false,
      createsJournal: false,
      createsStockMovement: false,
      createsBridge: false,
      createsOutbox: false,
      callsMraApi: false,
      finalValidationRequiredAtFinalization: true,
      staleAfterMs: 60_000,
      documentMessage: typeMsg,
      eisStatus: 'EIS_NOT_APPLICABLE',
      eligibility: {
        decision: 'NOT_APPLICABLE',
        safeDecisionSummary: typeMsg,
        blockerCodes: [],
        warningCodes: [],
      },
    };
  }

  const eligibility = await evaluateMraEisSaleEligibility({
    ...candidate,
    sourceType: resolvedType,
    sourceId,
    sourceVersion: expectedSourceVersion,
    purpose: EVALUATION_PURPOSE.PREFLIGHT,
    actorContext,
  });

  return {
    purpose: EVALUATION_PURPOSE.PREFLIGHT,
    intendedFinalizationAction,
    expectedSourceVersion,
    mutates: false,
    createsJournal: false,
    createsStockMovement: false,
    createsBridge: false,
    createsOutbox: false,
    callsMraApi: false,
    finalValidationRequiredAtFinalization: true,
    staleAfterMs: 60_000,
    notice: 'Preflight results must not be trusted indefinitely. Final validation runs again during finalization.',
    eisStatus: projectTransactionEisStatus({
      applicability: eligibility.stages?.applicability,
      eligibilityDecision: eligibility,
      purpose: EVALUATION_PURPOSE.PREFLIGHT,
    }),
    eligibility,
    requiredActions: (eligibility.blockerCodes || []).map((code) => ({
      code,
      action: 'RESOLVE_BEFORE_FINALIZATION',
    })),
  };
}

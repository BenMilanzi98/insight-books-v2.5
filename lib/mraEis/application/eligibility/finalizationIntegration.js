/**
 * Authoritative POS / Invoice finalization integration helpers — Phase 11.
 * Replaces post-commit lib/eisService.submitInvoice for the MraEis path.
 * Never calls MRA. Never creates Journals or Stock Movements.
 */
import { MraEisControlError } from '../../domain/errors.js';
import { SALES_SOURCE_TYPE } from './salesTransactionTypeRegistry.js';
import { preflightMraEisSaleEligibility } from './preflightEligibility.js';
import { attachEisSalesBridgeAfterFinalization } from './salesBridgeService.js';
import { ELIGIBILITY_DECISION } from './eligibilityPipeline.js';
import { getComplianceHoldPolicy } from './complianceHoldPolicy.js';

/**
 * Optional gate before local finalization. Returns null when EIS not applicable.
 * Throws MraEisControlError when blocked and policy is BLOCK_FINALIZATION.
 */
export async function assertEisFinalizationAllowed(candidate) {
  const preflight = await preflightMraEisSaleEligibility(candidate);
  const decision = preflight.eligibility?.decision;
  if (decision === ELIGIBILITY_DECISION.NOT_APPLICABLE) {
    return { allowed: true, applicable: false, preflight };
  }
  if (
    decision === ELIGIBILITY_DECISION.BLOCKED ||
    decision === ELIGIBILITY_DECISION.MANUAL_REVIEW ||
    decision === ELIGIBILITY_DECISION.COMPLIANCE_HOLD
  ) {
    const hold = getComplianceHoldPolicy({
      environment: preflight.eligibility?.environment,
      blockers: preflight.eligibility?.blockerCodes || [],
      purpose: 'PREFLIGHT',
    });
    if (!hold.allowLocalFinalization) {
      throw new MraEisControlError({
        code: 'MRA_EIS_SALE_ELIGIBILITY_BLOCKED',
        message: preflight.eligibility?.safeDecisionSummary || 'MRA EIS eligibility blocked.',
        httpStatus: 422,
        requiredAction: 'RESOLVE_BLOCKERS',
        details: {
          blockerCodes: preflight.eligibility?.blockerCodes,
          warningCodes: preflight.eligibility?.warningCodes,
          eisStatus: preflight.eisStatus,
        },
      });
    }
  }
  return { allowed: true, applicable: true, preflight };
}

/**
 * Post-local-commit bridge attachment with recovery marker on failure.
 * Accounting/Inventory already committed — never repost.
 */
export async function bridgePosSaleAfterCommit({
  tenantId,
  sale,
  items = [],
  payments = [],
  requestData = {},
  actorContext = null,
}) {
  try {
    return await attachEisSalesBridgeAfterFinalization({
      tenantId,
      businessId: tenantId,
      sourceType: SALES_SOURCE_TYPE.POS_SALE,
      sourceId: sale.id,
      sourceVersion: String(sale.updatedAt?.getTime?.() || Date.now()),
      sourceState: 'COMPLETED',
      sourceTransactionNumber: sale.saleNumber,
      finalizedAt: sale.saleDate || sale.createdAt || new Date(),
      branchId: sale.branchId || requestData.branchId || null,
      currency: 'MWK',
      lines: (items.length ? items : sale.items || []).map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxAmount: i.taxAmount || i.tax || 0,
        discountAmount: i.discountAmount || 0,
        description: i.description,
        isService: i.isService || i.isCustom,
        taxRateId: i.taxRateId || i.taxTypeId,
      })),
      payments: (payments.length ? payments : []).map((p) => ({
        localPaymentMethodId: p.paymentMethod || p.method || sale.paymentMethod || 'Cash',
        amount: p.amount ?? sale.total,
      })),
      header: {
        subtotal: sale.subtotal,
        taxAmount: sale.totalTaxAmount || sale.taxAmount,
        totalDiscountAmount: sale.totalDiscountAmount,
        total: sale.total,
        paymentMethod: sale.paymentMethod || requestData.paymentMethod,
        paymentMethodId: requestData.paymentMethodId,
        amountTendered: sale.posAmountTendered,
        changeGiven: sale.posChangeGiven,
      },
      buyer: {
        customerId: sale.clientId || requestData.clientId,
        customerName: requestData.clientName || sale.clientName || 'Walk-in Customer',
        customerTPIN: requestData.customerTPIN || sale.customerTPIN,
        isB2B: Boolean(requestData.isB2B),
      },
      isCreditSale: /credit/i.test(String(sale.paymentMethod || requestData.paymentMethod || '')),
      isVat5: Boolean(requestData.isReliefSupply || requestData.isVat5),
      isReliefSupply: Boolean(requestData.isReliefSupply),
      buyerAuthorizationEphemeralProvided: Boolean(requestData.buyerAuthorizationEphemeralProvided),
      blockFinalizationOnEligibilityFailure: false,
      actorContext,
    });
  } catch (err) {
    console.error('⚠️ EIS Phase 11 bridge recovery required (sale already saved):', err.message);
    return {
      ok: false,
      recoveryRequired: true,
      error: err.code || 'BRIDGE_ATTACHMENT_FAILED',
      message: 'This sale has been finalized locally and is waiting for the EIS bridge to recover.',
      createsJournal: false,
      createsStockMovement: false,
      callsMraApi: false,
    };
  }
}

export async function bridgeSalesInvoiceAfterCommit({
  tenantId,
  invoice,
  actorContext = null,
}) {
  if (!invoice || String(invoice.status).toUpperCase() === 'DRAFT') {
    return { ok: true, applicable: false, reason: 'DRAFT' };
  }
  if (String(invoice.status).toUpperCase() === 'PROFORMA') {
    return { ok: true, applicable: false, reason: 'PROFORMA' };
  }

  try {
    return await attachEisSalesBridgeAfterFinalization({
      tenantId,
      businessId: tenantId,
      sourceType: SALES_SOURCE_TYPE.SALES_INVOICE,
      sourceId: invoice.id,
      sourceVersion: String(invoice.updatedAt?.getTime?.() || Date.now()),
      sourceState: String(invoice.status || 'ISSUED').toUpperCase(),
      sourceTransactionNumber: invoice.invoiceNumber,
      finalizedAt: invoice.issueDate || invoice.postedAt || invoice.createdAt || new Date(),
      branchId: invoice.branchId || null,
      currency: invoice.currency || 'MWK',
      lines: (invoice.items || []).map((i) => ({
        id: i.id,
        productId: i.productId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        taxAmount: i.taxAmount || 0,
        discountAmount: i.discountAmount || 0,
        description: i.description,
        isService: i.isService,
        taxRateId: i.taxRateId || i.taxTypeId,
      })),
      payments: [
        {
          localPaymentMethodId: invoice.paymentMethod || 'Credit',
          amount: invoice.total,
          isCredit: true,
        },
      ],
      header: {
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        totalDiscountAmount: invoice.totalDiscountAmount || invoice.discount,
        total: invoice.total,
        paymentMethod: invoice.paymentMethod || 'Credit',
      },
      buyer: {
        customerId: invoice.clientId || invoice.client?.id,
        customerName: invoice.client?.name,
        customerTPIN: invoice.client?.tpin || invoice.client?.tin,
        isB2B: Boolean(invoice.client?.isBusiness || invoice.client?.tin),
      },
      isCreditSale: true,
      blockFinalizationOnEligibilityFailure: false,
      actorContext,
    });
  } catch (err) {
    console.error('⚠️ EIS Phase 11 invoice bridge recovery required:', err.message);
    return {
      ok: false,
      recoveryRequired: true,
      error: err.code || 'BRIDGE_ATTACHMENT_FAILED',
      message: 'This invoice has been finalized locally and is waiting for the EIS bridge to recover.',
    };
  }
}

/** Explicit exclusion for customer payment routes — architecture guard. */
export function assertCustomerPaymentNotFiscalSale() {
  return {
    createsSalesBridge: false,
    sourceType: SALES_SOURCE_TYPE.CUSTOMER_PAYMENT,
    message: 'Customer payment updates AR/Cash only; it is not a new MRA EIS sale.',
  };
}

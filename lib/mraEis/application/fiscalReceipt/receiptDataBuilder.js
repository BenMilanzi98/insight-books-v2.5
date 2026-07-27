/**
 * Phase 14 — immutable Receipt Data Model from snapshot + accepted response only.
 * Never reads mutable Product/Customer/Business master data.
 */

import crypto from 'crypto';
import { FISCAL_RECEIPT_CLASSIFICATION } from '../../domain/operationalEnums.js';

function sha256Json(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function assertNoSecrets(obj) {
  const s = JSON.stringify(obj);
  if (/buyerAuthorizationCode|Bearer |Authorization|terminalSecret|"tac"|jwt/i.test(s)) {
    throw new Error('SECRET_PATTERN_IN_RECEIPT_DATA');
  }
}

/**
 * Build immutable fiscal receipt data DTO.
 */
export function buildImmutableReceiptData({
  identity,
  environment,
  classification,
  originalOrReprint = 'ORIGINAL',
  reprintSequence = null,
  canonicalSnapshot,
  responseEvidence,
  qrResolution,
  receiptContract,
  template,
  qrEvidenceMeta = null,
} = {}) {
  const canon = canonicalSnapshot || {};
  const seller = canon.seller || {};
  const buyer = canon.buyer || {};
  const terminal = canon.terminal || {};
  const location = canon.location || {};
  const payment = canon.payment || {};
  const currency = canon.currency || {};
  const totals = canon.totals || {};
  const fiscalNumber = canon.fiscalNumber?.formatted || identity.fiscalNumber;
  const mraTxn =
    responseEvidence?.sanitizedCanonicalResponse?.mraTransactionId || identity.mraTransactionId;

  const isSandbox =
    String(environment).toUpperCase() !== 'PRODUCTION' ||
    String(identity.mode || '').toUpperCase() === 'MOCK';

  let resolvedClassification = classification;
  if (!resolvedClassification) {
    if (originalOrReprint === 'REPRINT') {
      resolvedClassification = FISCAL_RECEIPT_CLASSIFICATION.REPRINT_POS_FISCAL_RECEIPT;
    } else if (payment.classification === 'CREDIT') {
      resolvedClassification = FISCAL_RECEIPT_CLASSIFICATION.ORIGINAL_CREDIT_SALE_FISCAL_DOCUMENT;
    } else if (identity.sourceType === 'SALES_INVOICE') {
      resolvedClassification = FISCAL_RECEIPT_CLASSIFICATION.ORIGINAL_SALES_INVOICE_FISCAL_DOCUMENT;
    } else {
      resolvedClassification = FISCAL_RECEIPT_CLASSIFICATION.ORIGINAL_POS_FISCAL_RECEIPT;
    }
  }
  if (isSandbox) {
    // Keep primary classification; sandbox is also flagged in receiptClassification flags
  }

  const lines = (canon.lines || []).map((line, idx) => ({
    lineNumber: line.lineNumber ?? idx + 1,
    code: line.mraProductCode || line.localProductId || line.localServiceId || null,
    description: line.description || '',
    quantity: line.quantity,
    unit: line.unitOfMeasure || null,
    unitPrice: line.unitPrice,
    discount: line.discountAmount || '0.00',
    netAmount: line.netAmount,
    taxTreatment: line.taxTreatment || line.mraTaxRateId || null,
    taxAmount: line.taxAmount || '0.00',
    levyAmount: line.levyAmount || '0.00',
    lineTotal: line.grossAmount,
    isProduct: Boolean(line.isProduct),
    isService: Boolean(line.isService) || line.sourceLineType === 'SERVICE',
  }));

  const data = {
    schemaVersion: 'fiscal-receipt-data-v1',
    identity: {
      fiscalReceiptId: identity.fiscalReceiptId,
      transmissionId: identity.transmissionId,
      acceptedAttemptId: identity.acceptedAttemptId,
      responseEvidenceId: identity.responseEvidenceId,
      fiscalSnapshotId: identity.fiscalSnapshotId,
      fiscalNumberAssignmentId: identity.fiscalNumberAssignmentId,
      localTransactionReference: identity.localTransactionNumber || canon.source?.sourceTransactionNumber,
      mraTransactionId: mraTxn,
      receiptContractVersion: receiptContract.contractVersion,
      templateVersion: template?.templateVersion || receiptContract.templateVersion,
      qrSourceContractVersion: qrResolution.contractVersion,
    },
    environment,
    receiptClassification: resolvedClassification,
    sandbox: isSandbox,
    originalOrReprint,
    reprintSequence,
    seller: {
      legalName: seller.legalName || null,
      tradingName: seller.tradingName || null,
      tin: seller.sellerTin || null,
      address: seller.address || location.branchAddress || null,
      city: seller.city || null,
      country: seller.country || 'MW',
      mraSiteId: location.mraSiteId || location.siteMappingId || null,
      siteName: location.siteName || null,
      branchName: location.branchName || null,
      terminalId: terminal.mraTerminalId || seller.mraTerminalId || identity.terminalId || null,
      terminalPosition: terminal.position || null,
    },
    buyer: {
      anonymous: buyer.buyerClassification === 'ANONYMOUS_B2C' || !buyer.legalName,
      legalName: buyer.legalName || null,
      tin: buyer.buyerTin || null,
      address: buyer.address || null,
      classification: buyer.buyerClassification || null,
      b2b: Boolean(buyer.b2bStatus),
      vat5: Boolean(buyer.vat5Status),
      // Never include Buyer Authorization Code
    },
    terminal: {
      mraTerminalId: terminal.mraTerminalId || seller.mraTerminalId || null,
      localTerminalId: identity.terminalId || null,
    },
    location: {
      siteMappingId: location.siteMappingId || null,
      branchName: location.branchName || null,
      branchAddress: location.branchAddress || null,
    },
    fiscal: {
      fiscalNumber,
      mraTransactionId: mraTxn,
      mraFiscalReference: responseEvidence?.sanitizedCanonicalResponse?.mraFiscalReference || null,
      receiptReference: responseEvidence?.sanitizedCanonicalResponse?.receiptReference || null,
      transactionDateTime:
        canon.source?.sourceFinalizedAt ||
        canon.transaction?.transactionDateTime ||
        identity.transactionDateTime ||
        null,
      mraAcceptedAt: responseEvidence?.receivedAt || null,
      onlineOffline: 'ONLINE',
    },
    transaction: {
      saleType: canon.transaction?.saleType || null,
      localDocumentNumber: identity.localTransactionNumber || null,
      sourceType: identity.sourceType || null,
    },
    lines,
    discounts: {
      headerDiscountTotal: totals.headerDiscountTotal || '0.00',
      lineDiscountsPreserved: true,
    },
    taxSummary: (canon.taxSummary || []).map((t) => ({
      mraTaxId: t.mraTaxId || t.mraTaxRateId || null,
      treatmentType: t.treatmentType || null,
      rate: t.rate || null,
      taxableAmount: t.taxableAmount,
      taxAmount: t.taxAmount,
      zeroRatedAmount: t.zeroRatedAmount || null,
      exemptAmount: t.exemptAmount || null,
      vat5: Boolean(t.vat5),
    })),
    levySummary: (canon.levySummary || []).map((l) => ({
      code: l.code || l.mraLevyId || null,
      name: l.name || null,
      rate: l.rate || null,
      applicableAmount: l.applicableAmount || null,
      levyAmount: l.levyAmount || l.amount || null,
    })),
    payment: {
      classification: payment.classification || null,
      representationType: payment.representationType || null,
      components: (payment.components || []).map((c) => ({
        mraPaymentMethodCode: c.mraPaymentMethodCode || null,
        amount: c.amount,
        isCreditComponent: Boolean(c.isCreditComponent),
        amountTendered: c.amountTendered || null,
        changeAmount: c.changeAmount || null,
      })),
      totalPaymentAmount: payment.totalPaymentAmount || totals.headerGrossTotal || null,
      amountTendered: payment.amountTendered || null,
      changeGiven: payment.changeAmount || payment.changeGiven || null,
      creditAmount: payment.creditAmount || null,
    },
    currency: {
      code: currency.transactionCurrency || 'MWK',
      exchangeRate: currency.exchangeRate || null,
    },
    totals: {
      netTotal: totals.headerNetTotal || null,
      discountTotal: totals.headerDiscountTotal || '0.00',
      taxTotal: totals.headerTaxTotal || '0.00',
      levyTotal: totals.headerLevyTotal || '0.00',
      grossTotal: totals.headerGrossTotal || null,
      paymentTotal: payment.totalPaymentAmount || totals.headerGrossTotal || null,
    },
    mraValidation: {
      wording: receiptContract.validationWording || receiptContract.onlineWording,
      validationUrl: qrResolution.validationUrl || null,
      validationUrlClickable: Boolean(qrResolution.resolved && qrResolution.validationUrl),
      mraTransactionId: mraTxn,
      acceptedWording: 'Accepted by MRA',
      noCertificationClaim: true,
    },
    QR: {
      sourceType: qrResolution.sourceType,
      sourceField: qrResolution.sourceResponseField,
      exactSourceChecksum: qrResolution.exactSourceChecksum,
      decodeVerified: qrEvidenceMeta?.decodeVerified || false,
      generatorVersion: qrEvidenceMeta?.generatorVersion || null,
      altText: template?.accessibilityMetadata?.qrAlt || 'QR code for MRA receipt validation.',
    },
    footer: {
      required: receiptContract.requiredFooterText || [],
      originalOrReprintWording:
        originalOrReprint === 'REPRINT'
          ? receiptContract.reprintWording
          : receiptContract.originalWording,
      sandboxBanner: isSandbox ? receiptContract.sandboxBanner : null,
      templateVersion: template?.templateVersion || null,
    },
    complianceEvidence: {
      responseChecksum: responseEvidence?.sourceChecksum || null,
      snapshotChecksum: identity.snapshotChecksum || null,
      http200AloneIsNotAcceptance: true,
      builtFromImmutableSnapshotOnly: true,
      builtFromMutableMasterData: false,
    },
  };

  assertNoSecrets(data);
  const checksum = sha256Json(data);
  return { receiptData: data, receiptDataChecksum: checksum };
}

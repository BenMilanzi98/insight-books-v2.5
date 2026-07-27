/**
 * Build immutable canonical fiscal snapshot sections — Phase 12.
 * Uses Phase 6 canonicalize for final bytes/checksum.
 * No credentials / Buyer Authorization plaintext.
 */
import { canonicalize, serializeExactDecimal, CANONICALIZATION_VERSION } from '../../infrastructure/security/canonicalization.js';
import { createChecksum } from '../../domain/valueObjects/index.js';
export const SNAPSHOT_SCHEMA_VERSION = 'phase12-fiscal-snapshot-schema-v1';
export const CHECKSUM_ALGORITHM_VERSION = 'SHA256_V1';

function moneyStr(v, scale = 2) {
  if (v == null || v === '') return serializeExactDecimal(0, { scale });
  try {
    return serializeExactDecimal(v, { scale });
  } catch {
    return serializeExactDecimal(Number(v) || 0, { scale });
  }
}

function assertNoSecrets(obj) {
  const text = JSON.stringify(obj ?? {});
  // Match secret *values/keys*, not policy status field names like buyerAuthorizationRequired.
  if (
    /"(buyerAuthorizationCode|secretKey|jwt|tac|authorizationHeader|terminalSecret)"\s*:/i.test(text) ||
    /"authorization"\s*:\s*"(Bearer\s|[^"]+)"/i.test(text) ||
    /Bearer\s+[A-Za-z0-9\-._~+/]+=*/.test(text)
  ) {
    throw new Error('Snapshot section contains forbidden secret fields.');
  }
}

export function buildSellerSnapshot({ bridge, terminal, businessTaxpayer = null }) {
  const seller = {
    tenantId: bridge.tenantId,
    businessId: bridge.businessId,
    sellerTin: businessTaxpayer?.tin || businessTaxpayer?.mraTin || null,
    legalName: businessTaxpayer?.legalName || null,
    tradingName: businessTaxpayer?.tradingName || null,
    address: businessTaxpayer?.address || null,
    city: businessTaxpayer?.city || null,
    country: businessTaxpayer?.country || 'MW',
    mraSiteId: null,
    siteMappingId: bridge.siteMappingId || null,
    branchId: bridge.branchId || null,
    terminalId: bridge.terminalId || null,
    terminalPosition: terminal?.terminalPosition || null,
    mraTerminalId: terminal?.mraTerminalId || null,
    productId: terminal?.productId || null,
    productVersion: terminal?.productVersion || null,
    environment: bridge.environment,
    configurationSetChecksum: bridge.configurationSetChecksum || null,
  };
  assertNoSecrets(seller);
  return {
    ...seller,
    sellerSnapshotChecksum: createChecksum(seller).value,
  };
}

export function buildBuyerSnapshot({ bridge, decision, source, customer }) {
  const buyer = {
    buyerClassification: bridge.buyerClassification || decision?.buyerClassification || 'ANONYMOUS_B2C',
    localCustomerId: customer?.id || source?.clientId || null,
    customerRecordVersion: customer?.updatedAt?.toISOString?.() || null,
    buyerLegalName: customer?.name || source?.clientName || null,
    tradingName: customer?.tradingName || null,
    buyerTin: customer?.tin || customer?.tpin || source?.customerTPIN || null,
    address: customer?.address || null,
    city: customer?.city || null,
    country: customer?.country || 'MW',
    b2bStatus: Boolean(customer?.tin || customer?.tpin),
    vat5Status: false,
    buyerTinFormatValidationStatus: customer?.tin || customer?.tpin ? 'FORMAT_ONLY' : 'NOT_PRESENT',
    buyerExternalValidationStatus: 'NOT_PERFORMED',
    buyerAuthorizationRequired: false,
    buyerAuthorizationReadinessStatus: 'NOT_REQUIRED',
    // Explicitly never store BAC
    buyerAuthorizationCode: undefined,
  };
  delete buyer.buyerAuthorizationCode;
  assertNoSecrets(buyer);
  return {
    ...buyer,
    buyerSnapshotChecksum: createChecksum(buyer).value,
  };
}

export function buildTerminalSnapshot({ terminal, bridge }) {
  const snap = {
    localTerminalId: terminal?.id || bridge.terminalId,
    mraTerminalId: terminal?.mraTerminalId || null,
    terminalLabel: terminal?.terminalLabel || null,
    terminalPosition: terminal?.terminalPosition || null,
    environment: bridge.environment,
    statusAtSnapshot: terminal?.status || null,
    productId: terminal?.productId || null,
    productVersion: terminal?.productVersion || null,
    siteRelationship: terminal?.branchId || bridge.branchId || null,
    configurationVersionReferences: {
      global: terminal?.activeGlobalConfigurationSnapshotId || null,
      terminal: terminal?.activeTerminalConfigurationSnapshotId || null,
      taxpayer: terminal?.activeTaxpayerConfigurationSnapshotId || null,
    },
    credentialReferencePresent: Boolean(terminal?.currentCredentialReferenceId),
  };
  assertNoSecrets(snap);
  return { ...snap, terminalIdentityChecksum: createChecksum(snap).value };
}

export function buildLocationSnapshot({ bridge }) {
  return {
    branchId: bridge.branchId || null,
    siteMappingId: bridge.siteMappingId || null,
    warehouseMappingId: bridge.warehouseMappingId || null,
    environment: bridge.environment,
    resolutionVersion: 'phase12-location-from-bridge-v1',
  };
}

export function buildFiscalLines({ lines = [], bridge }) {
  return (lines || []).map((l, idx) => {
    const qty = moneyStr(l.quantity, 6);
    const unitPrice = moneyStr(l.unitPrice, 2);
    const discountAmount = moneyStr(l.discountAmount || 0, 2);
    const taxAmount = moneyStr(l.taxAmount || 0, 2);
    const levyAmount = moneyStr(l.levyAmount || 0, 2);
    const netAmount = moneyStr(
      l.netAmount ?? l.amount ?? Number(l.quantity || 0) * Number(l.unitPrice || 0),
      2
    );
    const grossAmount = moneyStr(l.grossAmount ?? l.amount ?? netAmount, 2);
    const line = {
      sourceLineId: l.id || `line-${idx}`,
      lineNumber: idx + 1,
      sourceLineType: l.isService ? 'SERVICE' : 'PRODUCT',
      localProductId: l.isService ? null : l.productId || null,
      localServiceId: l.isService ? l.productId || l.serviceId || null : null,
      localProductVariantId: l.variantId || null,
      description: l.description || 'Item',
      isProduct: !l.isService,
      unitOfMeasure: l.unitOfMeasure || 'EA',
      quantity: qty,
      unitPrice,
      discountAmount,
      netAmount,
      taxAmount,
      levyAmount,
      grossAmount,
      productMappingId: null,
      serviceMappingId: null,
      taxMappingId: null,
      mappingVersion: null,
      siteMappingId: bridge.siteMappingId || null,
      warehouseMappingId: bridge.warehouseMappingId || null,
    };
    return { ...line, lineChecksum: createChecksum(line).value };
  });
}

export function buildPaymentSnapshot({ payments = [], bridge, source }) {
  const components = (payments || []).length
    ? payments.map((p, idx) => ({
        sequence: idx + 1,
        localPaymentReferenceId: p.id || null,
        localPaymentMethodId: p.paymentMethod || p.method || source?.paymentMethod || 'Cash',
        mraPaymentMethodCode: null,
        amount: moneyStr(p.amount, 2),
        isCreditComponent: /credit/i.test(String(p.paymentMethod || p.method || '')),
        amountTendered: p.amountTendered != null ? moneyStr(p.amountTendered, 2) : null,
        changeAmount: p.changeAmount != null ? moneyStr(p.changeAmount, 2) : null,
      }))
    : [
        {
          sequence: 1,
          localPaymentMethodId: source?.paymentMethod || 'Cash',
          amount: moneyStr(bridge.grossAmount ?? source?.total, 2),
          isCreditComponent: /credit/i.test(String(source?.paymentMethod || '')),
        },
      ];

  const payment = {
    classification: components.some((c) => c.isCreditComponent) ? 'CREDIT_SALE' : 'IMMEDIATE',
    representationType: components.length > 1 ? 'SPLIT' : 'SINGLE',
    components,
    amountTendered:
      source?.posAmountTendered != null ? moneyStr(source.posAmountTendered, 2) : null,
    changeGiven: source?.posChangeGiven != null ? moneyStr(source.posChangeGiven, 2) : null,
    totalPaymentAmount: moneyStr(
      components.reduce((s, c) => s + Number(c.amount), 0),
      2
    ),
    splitPaymentPolicyVersion: 'phase9-split-v1',
    laterCustomerPaymentsDoNotAlter: true,
  };
  assertNoSecrets(payment);
  return payment;
}

export function buildTaxAndLevySummaries({ fiscalLines }) {
  const taxTotal = fiscalLines.reduce((s, l) => s + Number(l.taxAmount || 0), 0);
  const levyTotal = fiscalLines.reduce((s, l) => s + Number(l.levyAmount || 0), 0);
  return {
    taxSummary: [
      {
        mraTaxId: null,
        treatmentType: 'STANDARD_OR_UNSPECIFIED',
        rate: null,
        taxableAmount: moneyStr(
          fiscalLines.reduce((s, l) => s + Number(l.netAmount || 0), 0),
          2
        ),
        taxAmount: moneyStr(taxTotal, 2),
        lineCount: fiscalLines.length,
        zeroRatedDistinctFromExempt: true,
        vat5Distinct: true,
      },
    ],
    levySummary:
      levyTotal > 0
        ? [{ mraLevyId: null, amount: moneyStr(levyTotal, 2), lineCount: fiscalLines.length }]
        : [],
  };
}

export function buildTotalsSnapshot({ bridge, source, fiscalLines, payment }) {
  const lineNet = fiscalLines.reduce((s, l) => s + Number(l.netAmount || 0), 0);
  const lineTax = fiscalLines.reduce((s, l) => s + Number(l.taxAmount || 0), 0);
  const lineLevy = fiscalLines.reduce((s, l) => s + Number(l.levyAmount || 0), 0);
  const lineDisc = fiscalLines.reduce((s, l) => s + Number(l.discountAmount || 0), 0);
  const lineGross = fiscalLines.reduce((s, l) => s + Number(l.grossAmount || 0), 0);
  const headerGross = Number(bridge.grossAmount ?? source?.total ?? lineGross);

  return {
    lineNetTotal: moneyStr(lineNet, 2),
    lineDiscountTotal: moneyStr(lineDisc, 2),
    lineTaxTotal: moneyStr(lineTax, 2),
    lineLevyTotal: moneyStr(lineLevy, 2),
    lineGrossTotal: moneyStr(lineGross, 2),
    headerNetTotal: moneyStr(source?.subtotal ?? lineNet, 2),
    headerDiscountTotal: moneyStr(source?.totalDiscountAmount ?? source?.discount ?? lineDisc, 2),
    headerTaxTotal: moneyStr(source?.totalTaxAmount ?? source?.taxAmount ?? lineTax, 2),
    headerLevyTotal: moneyStr(bridge.levyAmount ?? lineLevy, 2),
    headerGrossTotal: moneyStr(headerGross, 2),
    paymentTotal: payment.totalPaymentAmount,
    creditAmount: payment.classification === 'CREDIT_SALE' ? moneyStr(headerGross, 2) : moneyStr(0, 2),
    amountTendered: payment.amountTendered,
    change: payment.changeGiven,
    roundingAmount: moneyStr(0, 2),
    reconciliationDifference: moneyStr(Math.abs(lineGross - headerGross), 2),
    allowedTolerance: moneyStr(0.01, 2),
    reconciliationVersion: 'phase12-totals-v1',
    valid: Math.abs(lineGross - headerGross) <= 0.01 || fiscalLines.length === 0,
  };
}

export function buildCanonicalFiscalSnapshot({
  bridge,
  decision,
  seller,
  buyer,
  terminalSnap,
  location,
  fiscalLines,
  taxSummary,
  levySummary,
  payment,
  totals,
  currency = 'MWK',
  fiscalNumber = null,
  accountingPostingIdentity = null,
  inventoryPostingIdentity = null,
  sourceChecksum,
}) {
  const canonical = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshotIdentity: {
      tenantId: bridge.tenantId,
      businessId: bridge.businessId,
      bridgeRecordId: bridge.id,
      sourceFinalizationIdentity: bridge.sourceFinalizationIdentity,
      environment: bridge.environment,
    },
    source: {
      sourceType: bridge.sourceType,
      sourceId: bridge.sourceId,
      sourceVersion: bridge.sourceVersion,
      sourceFinalizationIdentity: bridge.sourceFinalizationIdentity,
      sourceTransactionNumber: bridge.sourceTransactionNumber,
      sourceFinalizedAt: bridge.sourceFinalizedAt?.toISOString?.() || null,
      sourceChecksum,
      sourceChecksumVersion: 'phase12-source-checksum-v1',
    },
    seller,
    buyer,
    terminal: terminalSnap,
    location,
    configuration: {
      configurationSetChecksum: bridge.configurationSetChecksum || null,
      mappingCompletenessVersion: bridge.mappingCompletenessVersion || null,
      productServiceCompletenessVersion: bridge.productServiceCompletenessVersion || null,
    },
    transaction: {
      businessDate: bridge.businessDate?.toISOString?.()?.slice(0, 10) || null,
      timezone: 'Africa/Blantyre',
      currency,
      buyerClassification: bridge.buyerClassification,
      lineCount: fiscalLines.length,
      saleType: payment.classification,
    },
    lines: fiscalLines,
    taxSummary,
    levySummary,
    payment,
    currency: {
      transactionCurrency: currency,
      currencyDecimalScale: 2,
      businessBaseCurrency: 'MWK',
      policyVersion: 'phase11-currency-v1',
    },
    totals,
    complianceEvidence: {
      eligibilityDecisionId: bridge.eligibilityDecisionId,
      eligibilityPolicyVersion: bridge.eligibilityPolicyVersion,
      accountingPostingIdentity,
      inventoryPostingIdentity,
      vat5AuthorizationCodePresent: false,
      credentialsPresent: false,
    },
    fiscalNumber: fiscalNumber
      ? {
          formatted: fiscalNumber.formatted,
          rawSequence: fiscalNumber.rawSequence,
          isSynthetic: fiscalNumber.isSynthetic,
          isMraFiscalNumber: false,
          contractVersion: fiscalNumber.contractVersion,
          scopeKey: fiscalNumber.scopeKey,
        }
      : null,
  };

  assertNoSecrets(canonical);
  const canon = canonicalize(canonical, {
    contractVersion: '1',
    canonicalizationVersion: CANONICALIZATION_VERSION,
  });

  return {
    canonical,
    canonicalJson: canon.canonicalJson,
    snapshotChecksum: canon.checksum,
    canonicalizationVersion: CANONICALIZATION_VERSION,
    checksumAlgorithmVersion: CHECKSUM_ALGORITHM_VERSION,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
  };
}

/**
 * Staged EIS Sales Eligibility Evaluation Pipeline — Phase 11.
 * Stages 1–10. No Journals, Stock Movements, bridge, or MRA API calls.
 */
import crypto from 'crypto';
import prisma from '@/lib/prisma.js';
import { assertTenantBusinessMatch } from '../../domain/valueObjects/index.js';
import {
  resolveMraTaxForSaleLine,
  resolveMraLevyForSaleLine,
  resolveMraPaymentRepresentation,
} from '../mapping/resolutionServices.js';
import {
  resolveMraProductForSaleLine,
  resolveMraServiceForSaleLine,
} from '../catalogue/productServiceResolution.js';
import { getBundlePolicy } from '../catalogue/crossTypeAndBundlePolicy.js';
import { evaluateEisApplicability } from './eisApplicability.js';
import { ELIGIBILITY_POLICY_VERSION } from './eligibilityPolicyRegistry.js';
import { classifyAllSaleLines, SALE_LINE_CLASS } from './lineClassification.js';
import {
  resolveMraTerminalForLocalSale,
  resolveBranchForSale,
  resolveSiteAndWarehouseForSale,
} from './terminalAndLocation.js';
import {
  classifyBuyer,
  evaluateB2cBuyerRequirements,
  evaluateB2bBuyerReadiness,
  evaluateBuyerAuthorizationReadiness,
  evaluateVat5SaleReadiness,
  BUYER_AUTH_STATUS,
} from './buyerAndVat5.js';
import {
  validateSalesCurrency,
  validateSalesDecimals,
  reconcileSalesTotals,
  sumMoney,
} from './totalsAndCurrency.js';
import { getComplianceHoldPolicy } from './complianceHoldPolicy.js';
import { safeEligibilityMessage } from './statusAndMessaging.js';

export const ELIGIBILITY_DECISION = Object.freeze({
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  ELIGIBLE: 'ELIGIBLE',
  ELIGIBLE_WITH_WARNINGS: 'ELIGIBLE_WITH_WARNINGS',
  BLOCKED: 'BLOCKED',
  COMPLIANCE_HOLD: 'COMPLIANCE_HOLD',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  SUPERSEDED: 'SUPERSEDED',
});

export const EVALUATION_PURPOSE = Object.freeze({
  PREFLIGHT: 'PREFLIGHT',
  FINALIZATION: 'FINALIZATION',
  RECONCILIATION: 'RECONCILIATION',
});

function checksum(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj ?? {})).digest('hex');
}

function money(v) {
  if (v == null) return 0;
  if (typeof v === 'object' && typeof v.toString === 'function') return Number(v.toString());
  return Number(v) || 0;
}

/**
 * Evaluate full eligibility for a candidate sale document (POS or Invoice).
 * `source` is a normalized sale candidate — not a DB mutation.
 */
export async function evaluateMraEisSaleEligibility({
  tenantId,
  businessId = tenantId,
  sourceType,
  sourceId = null,
  sourceVersion = '1',
  sourceState = null,
  environment = null,
  purpose = EVALUATION_PURPOSE.PREFLIGHT,
  branchId = null,
  warehouseId = null,
  preferredTerminalId = null,
  transactionDate = new Date(),
  finalizedAt = null,
  currency = 'MWK',
  lines = [],
  payments = [],
  header = {},
  buyer = {},
  isCreditSale = false,
  isVat5 = false,
  isReliefSupply = false,
  buyerAuthorizationEphemeralProvided = false,
  historicalTransaction = false,
  actorContext = null,
  db = prisma,
} = {}) {
  assertTenantBusinessMatch(tenantId, businessId);
  const stages = {};
  const blockers = [];
  const warnings = [];
  const evaluatedAt = new Date().toISOString();

  // STAGE 1 — Applicability
  const applicability = await evaluateEisApplicability({
    tenantId,
    businessId,
    sourceType,
    sourceId,
    sourceState,
    environment,
    transactionFinalizedAt: finalizedAt || transactionDate,
    historicalTransaction,
    actorContext,
    db,
  });
  stages.applicability = applicability;
  if (!applicability.applicable) {
    return buildDecision({
      decision:
        applicability.reason === 'MANUAL_REVIEW'
          ? ELIGIBILITY_DECISION.MANUAL_REVIEW
          : applicability.reason?.startsWith('BLOCKED')
            ? ELIGIBILITY_DECISION.BLOCKED
            : ELIGIBILITY_DECISION.NOT_APPLICABLE,
      tenantId,
      businessId,
      sourceType,
      sourceId,
      sourceVersion,
      environment: applicability.environment,
      stages,
      blockers: applicability.blockers || [],
      warnings: applicability.warnings || [],
      purpose,
      evaluatedAt,
      applicabilityReason: applicability.reason,
      actorContext,
    });
  }

  const env = applicability.environment;

  // STAGE 2 — Source integrity
  const classified = classifyAllSaleLines(lines);
  const sellable = classified.filter((l) => l.sellable);
  if (!sellable.length) blockers.push('NO_SELLABLE_LINES');
  for (const l of classified) {
    if (l.class === SALE_LINE_CLASS.UNKNOWN) blockers.push('UNKNOWN_LINE_TYPE');
    const qty = Number(l.line.quantity ?? 0);
    if (l.sellable && qty === 0) blockers.push('ZERO_QUANTITY');
    if (l.sellable && qty < 0) blockers.push('NEGATIVE_QUANTITY_REQUIRES_CORRECTION_POLICY');
  }
  stages.sourceIntegrity = {
    lineCount: classified.length,
    sellableCount: sellable.length,
    blockers: blockers.filter((b) =>
      ['NO_SELLABLE_LINES', 'UNKNOWN_LINE_TYPE', 'ZERO_QUANTITY', 'NEGATIVE_QUANTITY_REQUIRES_CORRECTION_POLICY'].includes(b)
    ),
  };

  // STAGE 3 — Terminal + configuration
  const terminal = await resolveMraTerminalForLocalSale({
    tenantId,
    businessId,
    branchId,
    sourceType,
    sourceId,
    transactionDate,
    environment: env,
    preferredTerminalId,
    db,
  });
  stages.terminal = terminal;
  blockers.push(...(terminal.blockers || []));
  warnings.push(...(terminal.warnings || []));

  // STAGE 4 — Location
  const branch = await resolveBranchForSale({ tenantId, businessId, branchId, db });
  stages.branch = branch;
  blockers.push(...(branch.blockers || []));

  const hasProductLines = sellable.some(
    (l) => l.class === SALE_LINE_CLASS.PRODUCT || l.class === SALE_LINE_CLASS.PRODUCT_VARIANT
  );
  const location = await resolveSiteAndWarehouseForSale({
    tenantId,
    businessId,
    branchId,
    warehouseId,
    terminalId: terminal.terminalId,
    transactionDate,
    environment: env,
    hasProductLines,
    db,
  });
  stages.location = location;
  blockers.push(...(location.site.blockers || []));
  blockers.push(...(location.warehouse.blockers || []));
  warnings.push(...(location.site.warnings || []));
  warnings.push(...(location.warehouse.warnings || []));

  // STAGE 5 — Lines (product/service/variant/bundle)
  const lineResolutions = [];
  const bundlePolicy = getBundlePolicy();
  for (const entry of sellable) {
    const line = entry.line;
    if (entry.class === SALE_LINE_CLASS.BUNDLE) {
      if (bundlePolicy.blocked || bundlePolicy.policy === 'REQUIRES_MRA_CLARIFICATION' || bundlePolicy.policy === 'UNSUPPORTED') {
        blockers.push('BUNDLE_REQUIRES_MRA_CLARIFICATION');
        lineResolutions.push({ sourceLineId: entry.sourceLineId, resolved: false, class: entry.class });
        continue;
      }
    }

    if (entry.class === SALE_LINE_CLASS.SERVICE) {
      const resolved = await resolveMraServiceForSaleLine({
        tenantId,
        businessId,
        branchId,
        terminalId: terminal.terminalId,
        localServiceId: line.serviceId || line.productId || line.localItemId,
        transactionDate,
        environment: env,
        quantity: line.quantity,
        localUnitOrBasis: line.unitOfMeasure || 'EA',
        localTaxRateId: line.taxRateId || line.taxTypeId || null,
        db,
      });
      lineResolutions.push({ sourceLineId: entry.sourceLineId, class: entry.class, ...resolved });
      blockers.push(...(resolved.blockers || []));
      warnings.push(...(resolved.warnings || []));
      continue;
    }

    if (
      entry.class === SALE_LINE_CLASS.PRODUCT ||
      entry.class === SALE_LINE_CLASS.PRODUCT_VARIANT ||
      entry.class === SALE_LINE_CLASS.BUNDLE
    ) {
      const resolved = await resolveMraProductForSaleLine({
        tenantId,
        businessId,
        branchId,
        warehouseId,
        terminalId: terminal.terminalId,
        localProductId: line.productId || line.localProductId || line.localItemId,
        localProductVariantId: line.localProductVariantId || line.variantId || null,
        transactionDate,
        environment: env,
        quantity: line.quantity,
        localUnitOfMeasure: line.unitOfMeasure || 'EA',
        localTaxRateId: line.taxRateId || line.taxTypeId || null,
        db,
      });
      lineResolutions.push({ sourceLineId: entry.sourceLineId, class: entry.class, ...resolved });
      blockers.push(...(resolved.blockers || []));
      warnings.push(...(resolved.warnings || []));
      continue;
    }

    if (entry.class === SALE_LINE_CLASS.OTHER_CHARGE || entry.class === SALE_LINE_CLASS.SHIPPING_LINE) {
      blockers.push('UNSUPPORTED_CHARGE_LINE');
      lineResolutions.push({ sourceLineId: entry.sourceLineId, resolved: false, class: entry.class });
    }
  }
  stages.lines = { resolutions: lineResolutions, classified };

  // STAGE 6 — Tax and levy
  const taxResults = [];
  const levyResults = [];
  for (const entry of sellable) {
    const line = entry.line;
    if (line.taxRateId || line.taxTypeId || line.localTaxRateId) {
      const tax = await resolveMraTaxForSaleLine({
        tenantId,
        businessId,
        localTaxRateId: line.taxRateId || line.taxTypeId || line.localTaxRateId,
        transactionDate,
        environment: env,
        db,
      });
      taxResults.push(tax);
      blockers.push(...(tax.blockers || []));
      warnings.push(...(tax.warnings || []));
    }
    for (const levyId of line.localLevyIds || []) {
      const levy = await resolveMraLevyForSaleLine({
        tenantId,
        businessId,
        localLevyId: levyId,
        transactionDate,
        environment: env,
        db,
      });
      levyResults.push(levy);
      blockers.push(...(levy.blockers || []));
    }
  }
  stages.taxLevy = { taxResults, levyResults };

  // STAGE 7 — Buyer
  const buyerClass = classifyBuyer({
    customerId: buyer.customerId,
    customerName: buyer.customerName || buyer.name,
    buyerTin: buyer.buyerTin || buyer.tin || buyer.customerTPIN,
    customerType: buyer.customerType,
    isVat5,
    isReliefSupply,
    isB2BHint: buyer.isB2B,
    isGovernment: buyer.isGovernment,
    isExport: buyer.isExport,
  });
  const authReady = evaluateBuyerAuthorizationReadiness({
    required: Boolean(buyer.buyerAuthorizationRequired || isVat5 || isReliefSupply),
    ephemeralProvided: buyerAuthorizationEphemeralProvided,
    expired: Boolean(buyer.buyerAuthorizationExpired),
    scopeMismatch: Boolean(buyer.buyerAuthorizationScopeMismatch),
  });
  const b2c = evaluateB2cBuyerRequirements({ buyerClassification: buyerClass.buyerClassification });
  const b2b = evaluateB2bBuyerReadiness({
    buyerClassification: buyerClass.buyerClassification,
    buyerId: buyer.customerId,
    buyerLegalName: buyer.customerName || buyer.name,
    buyerTin: buyer.buyerTin || buyer.tin || buyer.customerTPIN,
    buyerAddress: buyer.address,
    buyerAuthorizationRequired: authReady.status !== BUYER_AUTH_STATUS.NOT_REQUIRED,
    buyerAuthorizationStatus: authReady.status,
  });
  blockers.push(...(b2b.blockers || []));
  warnings.push(...(b2c.warnings || []), ...(b2b.warnings || []), ...(authReady.warnings || []));
  blockers.push(...(authReady.blockers || []));
  stages.buyer = { buyerClass, b2c, b2b, authReady };

  // VAT5
  const vat5 = evaluateVat5SaleReadiness({
    isVat5,
    isReliefSupply,
    buyerTinPresent: b2b.buyerTinPresent,
    buyerAuthorizationReady: authReady.ready,
    taxTreatmentCompatible: true,
  });
  stages.vat5 = vat5;
  blockers.push(...(vat5.blockers || []));
  warnings.push(...(vat5.warnings || []));

  // STAGE 8 — Payment
  let paymentComponents = Array.isArray(payments) ? payments : [];
  if (!paymentComponents.length && header.paymentMethod) {
    paymentComponents = [
      {
        localPaymentMethodId: header.paymentMethodId || header.paymentMethod,
        amount: header.total ?? header.grossAmount ?? 0,
        isCredit: isCreditSale || /credit/i.test(String(header.paymentMethod)),
      },
    ];
  }
  if (isCreditSale && paymentComponents.length === 1) {
    paymentComponents[0].isCredit = true;
  }

  const payment = await resolveMraPaymentRepresentation({
    tenantId,
    businessId,
    paymentComponents,
    transactionType: isCreditSale ? 'CREDIT_SALE' : 'SALE',
    transactionDate,
    environment: env,
    db,
  });
  stages.payment = payment;
  blockers.push(...(payment.blockers || []));
  warnings.push(...(payment.warnings || []));
  if (isCreditSale && !payment.creditComponent && payment.resolved) {
    // Credit mapping may still be missing even if single component resolved non-credit
    if (!payment.resolvedComponents?.some((c) => c.isCredit)) {
      blockers.push('CREDIT_PAYMENT_MAPPING_REQUIRED');
    }
  }

  // STAGE 9 — Totals / currency / decimals
  const currencyResult = validateSalesCurrency({
    sourceCurrency: currency,
    businessBaseCurrency: 'MWK',
    paymentCurrencies: paymentComponents.map((p) => p.currency || currency),
  });
  blockers.push(...(currencyResult.blockers || []));
  warnings.push(...(currencyResult.warnings || []));

  for (const entry of sellable) {
    const dec = validateSalesDecimals({
      quantity: entry.line.quantity,
      unitPrice: entry.line.unitPrice,
      discountAmount: entry.line.discountAmount || 0,
      taxAmount: entry.line.taxAmount || 0,
      netAmount: entry.line.netAmount ?? entry.line.lineTotal,
      grossAmount: entry.line.grossAmount ?? entry.line.lineTotal,
    });
    blockers.push(...(dec.blockers || []));
  }

  const lineNet = sumMoney(sellable.map((l) => l.line.netAmount ?? money(l.line.quantity) * money(l.line.unitPrice)));
  const lineTax = sumMoney(sellable.map((l) => l.line.taxAmount || 0));
  const lineLevy = sumMoney(sellable.map((l) => l.line.levyAmount || 0));
  const lineDisc = sumMoney(sellable.map((l) => l.line.discountAmount || 0));
  const lineGross = sumMoney(
    sellable.map((l) => l.line.grossAmount ?? l.line.lineTotal ?? money(l.line.quantity) * money(l.line.unitPrice))
  );
  const totals = reconcileSalesTotals({
    lineNetTotal: lineNet,
    lineTaxTotal: lineTax,
    lineLevyTotal: lineLevy,
    lineDiscountTotal: lineDisc,
    lineGrossTotal: header.total != null ? header.total : lineGross,
    headerNetTotal: header.subtotal ?? header.netAmount ?? lineNet,
    headerTaxTotal: header.taxAmount ?? header.taxTotal ?? lineTax,
    headerLevyTotal: header.levyAmount ?? header.levyTotal ?? lineLevy,
    headerDiscountTotal: header.discountAmount ?? header.totalDiscountAmount ?? lineDisc,
    headerGrossTotal: header.total ?? header.grossAmount ?? lineGross,
    paymentTotal: sumMoney(paymentComponents.map((p) => p.amount)),
    amountTendered: header.amountTendered ?? null,
    changeGiven: header.changeGiven ?? null,
  });
  // For header/line gross: if we used header.total as lineGrossTotal above incorrectly when lines differ,
  // prefer comparing computed lineGross to header
  const totalsStrict = reconcileSalesTotals({
    lineNetTotal: lineNet,
    lineTaxTotal: lineTax,
    lineLevyTotal: lineLevy,
    lineDiscountTotal: lineDisc,
    lineGrossTotal: lineGross,
    headerNetTotal: header.subtotal ?? header.netAmount ?? lineNet,
    headerTaxTotal: header.taxAmount ?? header.taxTotal ?? lineTax,
    headerLevyTotal: header.levyAmount ?? header.levyTotal ?? lineLevy,
    headerDiscountTotal: header.discountAmount ?? header.totalDiscountAmount ?? lineDisc,
    headerGrossTotal: header.total ?? header.grossAmount ?? lineGross,
    paymentTotal: isCreditSale ? header.total ?? lineGross : sumMoney(paymentComponents.map((p) => p.amount)),
    amountTendered: header.amountTendered ?? null,
    changeGiven: header.changeGiven ?? null,
  });
  stages.totals = totalsStrict;
  blockers.push(...(totalsStrict.blockers || []));
  warnings.push(...(totalsStrict.warnings || []), ...(totals.warnings || []));

  // STAGE 10 — Decision
  const uniqueBlockers = [...new Set(blockers)];
  const uniqueWarnings = [...new Set(warnings)];
  let decision = ELIGIBILITY_DECISION.ELIGIBLE;
  if (uniqueBlockers.length) {
    const hold = getComplianceHoldPolicy({
      environment: env,
      blockers: uniqueBlockers,
      purpose,
    });
    decision =
      hold.policy === 'FINALIZE_LOCALLY_AND_HOLD_FISCAL_BRIDGE' && purpose === EVALUATION_PURPOSE.FINALIZATION
        ? ELIGIBILITY_DECISION.COMPLIANCE_HOLD
        : hold.policy === 'MANUAL_APPROVAL_REQUIRED'
          ? ELIGIBILITY_DECISION.MANUAL_REVIEW
          : ELIGIBILITY_DECISION.BLOCKED;
    stages.complianceHold = hold;
  } else if (uniqueWarnings.length) {
    decision = ELIGIBILITY_DECISION.ELIGIBLE_WITH_WARNINGS;
  }

  const sourceChecksum = checksum({
    sourceType,
    sourceId,
    sourceVersion,
    branchId,
    lines: sellable.map((l) => ({
      id: l.sourceLineId,
      productId: l.line.productId,
      qty: l.line.quantity,
      price: l.line.unitPrice,
      tax: l.line.taxAmount,
    })),
    payments: paymentComponents,
    total: header.total,
    currency,
  });

  return buildDecision({
    decision,
    tenantId,
    businessId,
    sourceType,
    sourceId,
    sourceVersion,
    environment: env,
    stages,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    purpose,
    evaluatedAt,
    applicabilityReason: applicability.reason,
    actorContext,
    terminalId: terminal.terminalId,
    configurationSetChecksum: terminal.configurationSetChecksum,
    sourceChecksum,
    lineCount: classified.length,
    currency: currencyResult.currency,
    grossAmount: totalsStrict.headerGrossTotal,
    netAmount: totalsStrict.headerNetTotal,
    taxAmount: totalsStrict.headerTaxTotal,
    levyAmount: totalsStrict.headerLevyTotal,
    discountAmount: String(header.discountAmount ?? header.totalDiscountAmount ?? lineDisc),
    paymentTotal: totalsStrict.paymentTotal,
    buyerClassification: buyerClass.buyerClassification,
    siteMappingId: location.site.siteMappingId,
    warehouseMappingId: location.site.warehouseMappingId,
  });
}

function buildDecision(input) {
  const safeDecisionSummary = safeEligibilityMessage({
    decision: input.decision,
    blockers: input.blockers,
    applicabilityReason: input.applicabilityReason,
  });

  return {
    tenantId: input.tenantId,
    businessId: input.businessId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceVersion: input.sourceVersion,
    environment: input.environment,
    decision: input.decision,
    policyVersion: ELIGIBILITY_POLICY_VERSION,
    evaluatedAt: input.evaluatedAt,
    evaluatedBy: input.actorContext?.userId || input.actorContext?.actorId || null,
    terminalId: input.terminalId || null,
    configurationSetChecksum: input.configurationSetChecksum || null,
    mappingCompletenessVersion: null,
    productServiceCompletenessVersion: null,
    sourceChecksum: input.sourceChecksum || null,
    lineCount: input.lineCount ?? 0,
    currency: input.currency || 'MWK',
    grossAmount: input.grossAmount ?? null,
    netAmount: input.netAmount ?? null,
    taxAmount: input.taxAmount ?? null,
    levyAmount: input.levyAmount ?? null,
    discountAmount: input.discountAmount ?? null,
    paymentTotal: input.paymentTotal ?? null,
    buyerClassification: input.buyerClassification || null,
    blockerCodes: input.blockers || [],
    warningCodes: input.warnings || [],
    safeDecisionSummary,
    applicabilityReason: input.applicabilityReason || null,
    purpose: input.purpose,
    stages: input.stages,
    siteMappingId: input.siteMappingId || null,
    warehouseMappingId: input.warehouseMappingId || null,
    bridgePermitted:
      input.decision === ELIGIBILITY_DECISION.ELIGIBLE ||
      input.decision === ELIGIBILITY_DECISION.ELIGIBLE_WITH_WARNINGS,
    mutatesAccounting: false,
    mutatesInventory: false,
    createsBridge: false,
    callsMraApi: false,
  };
}

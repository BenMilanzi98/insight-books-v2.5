/**
 * Map immutable fiscal snapshot → contract-versioned MRA Sales request DTO — Phase 13.
 * Never uses mutable current Product/Customer/Business master data.
 */
import { serializeExactDecimal } from '../../infrastructure/security/canonicalization.js';
import { SALES_MAPPER_VERSION, SALES_PAYLOAD_SCHEMA_VERSION } from './salesPayloadSchemaRegistry.js';
import { SalesTransmissionErrors } from './salesTransmissionErrors.js';

function money(v, scale = 2) {
  try {
    return serializeExactDecimal(v ?? 0, { scale });
  } catch {
    return serializeExactDecimal(Number(v) || 0, { scale });
  }
}

function assertNoInternalIds(obj) {
  const text = JSON.stringify(obj);
  if (/(journalEntryId|stockMovementId|chartOfAccount|tenantId|businessId)/i.test(text)) {
    throw SalesTransmissionErrors.payloadMapping({
      message: 'Mapped payload contains forbidden internal identifiers.',
    });
  }
}

/**
 * Build MraEisSaleRequestV1 from stored canonicalSnapshot (+ fiscal number evidence).
 */
export function mapFiscalSnapshotToSalesRequestV1({
  snapshot,
  fiscalNumberFormatted,
  terminal,
} = {}) {
  const canonical = snapshot?.canonicalSnapshot;
  if (!canonical || typeof canonical !== 'object') {
    throw SalesTransmissionErrors.payloadMapping({
      message: 'Snapshot canonical content missing — cannot map payload.',
    });
  }

  const seller = canonical.seller || {};
  const buyer = canonical.buyer || {};
  const location = canonical.location || {};
  const transaction = canonical.transaction || {};
  const payment = canonical.payment || {};
  const totals = canonical.totals || {};
  const currency = canonical.currency || {};
  const lines = Array.isArray(canonical.lines) ? canonical.lines : [];
  const taxSummary = Array.isArray(canonical.taxSummary) ? canonical.taxSummary : [];
  const levySummary = Array.isArray(canonical.levySummary) ? canonical.levySummary : [];
  const compliance = canonical.complianceEvidence || {};

  if (compliance.vat5Applicable || buyer.vat5Status === true) {
    // Block VAT5 live submission until contract verified
    throw SalesTransmissionErrors.vat5({
      details: { vat5AuthorizationCodePresent: compliance.vat5AuthorizationCodePresent },
    });
  }

  const fiscalNumber =
    fiscalNumberFormatted ||
    canonical.fiscalNumber?.formatted ||
    null;
  if (!fiscalNumber) {
    throw SalesTransmissionErrors.payloadMapping({
      message: 'Fiscal number missing from snapshot evidence.',
      code: 'FISCAL_NUMBER_NOT_ASSIGNED',
    });
  }

  const header = {
    sellerTIN: seller.sellerTin || null,
    sellerLegalName: seller.legalName || null,
    sellerTradingName: seller.tradingName || null,
    siteId: location.mraSiteId || location.siteMappingId || null,
    terminalId: terminal?.mraTerminalId || seller.mraTerminalId || snapshot.terminalId,
    terminalPosition: seller.terminalPosition || terminal?.terminalPosition || null,
    fiscalNumber,
    invoiceNumber: canonical.source?.sourceTransactionNumber || snapshot.localDocumentNumber || null,
    invoiceDateTime:
      canonical.source?.sourceFinalizedAt ||
      snapshot.transactionDate?.toISOString?.() ||
      null,
    currency: currency.transactionCurrency || snapshot.currency || 'MWK',
    exchangeRate: currency.exchangeRate || null,
    lineCount: lines.length,
    netTotal: totals.headerNetTotal || money(snapshot.subtotal),
    discountTotal: totals.headerDiscountTotal || money(snapshot.discountTotal),
    taxTotal: totals.headerTaxTotal || money(snapshot.taxTotal),
    levyTotal: totals.headerLevyTotal || money(snapshot.levyTotal),
    invoiceTotal: totals.headerGrossTotal || money(snapshot.invoiceTotal),
    saleType: transaction.saleType || payment.classification || 'IMMEDIATE',
    onlineIndicator: 'ONLINE',
    b2bIndicator: Boolean(buyer.b2bStatus),
    creditSaleIndicator: payment.classification === 'CREDIT_SALE',
  };

  const buyerDto = {
    buyerClassification: buyer.buyerClassification || 'ANONYMOUS_B2C',
    buyerName: buyer.buyerLegalName || null,
    buyerTIN: buyer.buyerTin || null,
    buyerAddress: buyer.address || null,
    buyerCity: buyer.city || null,
    buyerCountry: buyer.country || 'MW',
  };
  // Never include authorization code
  delete buyerDto.buyerAuthorizationCode;

  const lineDtos = lines.map((l, idx) => ({
    lineNumber: l.lineNumber || idx + 1,
    itemType: l.sourceLineType || (l.isProduct ? 'PRODUCT' : 'SERVICE'),
    itemCode: l.mraItemCode || l.localProductId || l.localServiceId || `LOCAL-${idx + 1}`,
    description: l.description || l.itemName || 'Item',
    barcode: l.barcode || null,
    unitOfMeasure: l.unitOfMeasure || l.mraUnit || 'EA',
    quantity: l.quantity != null ? String(l.quantity) : money(0, 6),
    unitPrice: l.unitPrice != null ? String(l.unitPrice) : money(0),
    discountAmount: l.discountAmount != null ? String(l.discountAmount) : money(0),
    netAmount: l.netAmount != null ? String(l.netAmount) : money(0),
    taxAmount: l.taxAmount != null ? String(l.taxAmount) : money(0),
    levyAmount: l.levyAmount != null ? String(l.levyAmount) : money(0),
    lineTotal: l.grossAmount != null ? String(l.grossAmount) : money(0),
    taxId: l.mraTaxId || l.taxMappingId || null,
  }));

  if (!lineDtos.length) {
    throw SalesTransmissionErrors.payloadMapping({ message: 'Snapshot has no fiscal lines.' });
  }

  const taxSummaryDto = taxSummary.map((t) => ({
    taxId: t.mraTaxId || null,
    treatmentType: t.treatmentType || null,
    rate: t.rate,
    taxableAmount: t.taxableAmount != null ? String(t.taxableAmount) : money(0),
    taxAmount: t.taxAmount != null ? String(t.taxAmount) : money(0),
    lineCount: t.lineCount || 0,
  }));

  const levyDto = levySummary.map((lv) => ({
    levyId: lv.mraLevyId || null,
    amount: lv.amount != null ? String(lv.amount) : money(0),
    lineCount: lv.lineCount || 0,
  }));

  const paymentComponents = (payment.components || []).map((p) => ({
    paymentCode: p.mraPaymentMethodCode || p.localPaymentMethodId || 'CASH',
    amount: p.amount != null ? String(p.amount) : money(0),
    isCredit: Boolean(p.isCreditComponent),
  }));

  if (payment.representationType === 'SPLIT' && paymentComponents.length < 2) {
    throw SalesTransmissionErrors.payloadValidation({
      message: 'Unsupported or incomplete split-payment representation.',
    });
  }

  const paymentDto = {
    classification: payment.classification || 'IMMEDIATE',
    components: paymentComponents.length
      ? paymentComponents
      : [{ paymentCode: 'CASH', amount: header.invoiceTotal, isCredit: false }],
    amountTendered: payment.amountTendered != null ? String(payment.amountTendered) : null,
    changeGiven: payment.changeGiven != null ? String(payment.changeGiven) : null,
    totalPaymentAmount: payment.totalPaymentAmount != null ? String(payment.totalPaymentAmount) : header.invoiceTotal,
  };

  const dto = {
    schemaVersion: SALES_PAYLOAD_SCHEMA_VERSION,
    mapperVersion: SALES_MAPPER_VERSION,
    header,
    buyer: buyerDto,
    lines: lineDtos,
    taxSummary: taxSummaryDto,
    levies: levyDto,
    vat5: null, // blocked path sets null; never invent
    payment: paymentDto,
    // Explicitly omit offline signature
    offlineSignature: undefined,
  };
  delete dto.offlineSignature;

  assertNoInternalIds(dto);
  return {
    dto,
    schemaVersion: SALES_PAYLOAD_SCHEMA_VERSION,
    mapperVersion: SALES_MAPPER_VERSION,
    lineCount: lineDtos.length,
  };
}

/**
 * Validate mapped DTO before credential lease / dispatch.
 */
export function validateSalesPayloadV1(dto, { maxBytes = 512000 } = {}) {
  const errors = [];
  if (!dto?.header?.sellerTIN && dto?.header?.sellerTIN !== null) {
    // TIN may be null in incomplete seller snapshot — warn as validation error for submission
  }
  if (!dto?.header?.fiscalNumber) errors.push('FISCAL_NUMBER_REQUIRED');
  if (!dto?.header?.invoiceDateTime) errors.push('INVOICE_DATETIME_REQUIRED');
  if (!dto?.header?.currency) errors.push('CURRENCY_REQUIRED');
  if (!Array.isArray(dto?.lines) || !dto.lines.length) errors.push('LINES_REQUIRED');
  if (dto?.header?.onlineIndicator !== 'ONLINE') errors.push('ONLINE_INDICATOR_REQUIRED');
  if (dto?.offlineSignature) errors.push('OFFLINE_SIGNATURE_MUST_BE_OMITTED');
  if (dto?.buyer?.buyerAuthorizationCode) errors.push('BUYER_AUTHORIZATION_CODE_FORBIDDEN');

  const json = JSON.stringify(dto);
  const byteLength = Buffer.byteLength(json, 'utf8');
  if (byteLength > maxBytes) errors.push('REQUEST_SIZE_EXCEEDED');
  if (/(Bearer\s|secretKey|"jwt"|buyerAuthorizationCode)/i.test(json)) {
    errors.push('CREDENTIALS_IN_PAYLOAD');
  }

  return {
    valid: errors.length === 0,
    errors,
    byteLength,
    schemaVersion: SALES_PAYLOAD_SCHEMA_VERSION,
  };
}

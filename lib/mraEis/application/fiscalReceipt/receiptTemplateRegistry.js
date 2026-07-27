/**
 * Phase 14 — versioned, immutable approved receipt templates.
 * Template changes are prospective; historical artifacts retain original templateVersion.
 */

import { RECEIPT_TYPE } from './receiptContractRegistry.js';

export const TEMPLATE_APPROVAL_STATUS = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  DEPRECATED: 'DEPRECATED',
  BLOCKED: 'BLOCKED',
});

const REGISTRY = Object.freeze({
  'tpl-pos80-mock-v1': {
    templateVersion: 'tpl-pos80-mock-v1',
    environmentEligibility: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    receiptType: RECEIPT_TYPE.POS_FISCAL_RECEIPT_80MM,
    sourceTransactionTypes: ['POS_SALE', 'SALES_INVOICE'],
    pageOrPaper: { widthMm: 80, heightMm: null, continuous: true },
    marginsMm: { top: 2, right: 2, bottom: 2, left: 2 },
    fontPolicy: { family: 'monospace', bodyPt: 9, headerPt: 11 },
    lineHeightPolicy: 1.25,
    qrPlacement: 'after-validation-section',
    fiscalSectionPlacement: 'header',
    taxSummaryPlacement: 'after-lines',
    paymentSectionPlacement: 'after-tax',
    footerPlacement: 'end',
    originalOrReprintLabelPlacement: 'top-banner',
    accessibilityMetadata: { lang: 'en', qrAlt: 'QR code for MRA receipt validation.' },
    language: 'en',
    effectiveFrom: '2026-07-01T00:00:00.000Z',
    effectiveTo: null,
    approvalStatus: TEMPLATE_APPROVAL_STATUS.APPROVED,
    sourceContractVersion: 'receipt-contract-mock-v1',
    checksum: 'tpl-pos80-mock-v1-sha256:placeholder',
    createdBy: 'system:phase14',
    approvedBy: 'system:phase14',
    createdAt: '2026-07-22T00:00:00.000Z',
    immutableWhenApproved: true,
    brandingMayNotHideMandatoryFields: true,
    logoMustNotObscureQr: true,
    noMraEndorsementImplied: true,
  },
  'tpl-browser-print-mock-v1': {
    templateVersion: 'tpl-browser-print-mock-v1',
    environmentEligibility: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    receiptType: RECEIPT_TYPE.POS_BROWSER_PRINT,
    sourceTransactionTypes: ['POS_SALE', 'SALES_INVOICE'],
    pageOrPaper: { widthMm: 80, heightMm: null },
    marginsMm: { top: 4, right: 4, bottom: 4, left: 4 },
    fontPolicy: { family: 'monospace', bodyPt: 10, headerPt: 12 },
    lineHeightPolicy: 1.3,
    qrPlacement: 'after-validation-section',
    approvalStatus: TEMPLATE_APPROVAL_STATUS.APPROVED,
    sourceContractVersion: 'receipt-contract-mock-v1',
    checksum: 'tpl-browser-print-mock-v1-sha256:placeholder',
    createdBy: 'system:phase14',
    approvedBy: 'system:phase14',
    createdAt: '2026-07-22T00:00:00.000Z',
    immutableWhenApproved: true,
    accessibilityMetadata: { lang: 'en', qrAlt: 'QR code for MRA receipt validation.' },
  },
  'tpl-a4-invoice-mock-v1': {
    templateVersion: 'tpl-a4-invoice-mock-v1',
    environmentEligibility: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    receiptType: RECEIPT_TYPE.SALES_INVOICE_FISCAL_A4,
    sourceTransactionTypes: ['SALES_INVOICE', 'POS_SALE'],
    pageOrPaper: { widthMm: 210, heightMm: 297, format: 'A4' },
    marginsMm: { top: 12, right: 12, bottom: 14, left: 12 },
    fontPolicy: { family: 'helvetica', bodyPt: 9, headerPt: 14 },
    lineHeightPolicy: 1.35,
    qrPlacement: 'validation-box',
    approvalStatus: TEMPLATE_APPROVAL_STATUS.APPROVED,
    sourceContractVersion: 'receipt-contract-mock-v1',
    checksum: 'tpl-a4-invoice-mock-v1-sha256:placeholder',
    createdBy: 'system:phase14',
    approvedBy: 'system:phase14',
    createdAt: '2026-07-22T00:00:00.000Z',
    immutableWhenApproved: true,
    multiPage: true,
    repeatTableHeaders: true,
    accessibilityMetadata: { lang: 'en', qrAlt: 'QR code for MRA receipt validation.' },
  },
  'tpl-html-view-mock-v1': {
    templateVersion: 'tpl-html-view-mock-v1',
    environmentEligibility: ['SANDBOX', 'DEVELOPMENT', 'TEST'],
    receiptType: RECEIPT_TYPE.SALES_INVOICE_FISCAL_HTML,
    sourceTransactionTypes: ['POS_SALE', 'SALES_INVOICE'],
    approvalStatus: TEMPLATE_APPROVAL_STATUS.APPROVED,
    sourceContractVersion: 'receipt-contract-mock-v1',
    checksum: 'tpl-html-view-mock-v1-sha256:placeholder',
    createdBy: 'system:phase14',
    approvedBy: 'system:phase14',
    createdAt: '2026-07-22T00:00:00.000Z',
    immutableWhenApproved: true,
    accessibilityMetadata: { lang: 'en', qrAlt: 'QR code for MRA receipt validation.' },
  },
  'tpl-pos58-blocked-v1': {
    templateVersion: 'tpl-pos58-blocked-v1',
    environmentEligibility: ['SANDBOX', 'PRODUCTION'],
    receiptType: RECEIPT_TYPE.POS_FISCAL_RECEIPT_58MM,
    approvalStatus: TEMPLATE_APPROVAL_STATUS.BLOCKED,
    sourceContractVersion: 'receipt-contract-mock-v1',
    blockerCodes: ['MANDATORY_QR_AND_FIELDS_CANNOT_FIT_58MM_COMPLIANTLY'],
    createdBy: 'system:phase14',
    createdAt: '2026-07-22T00:00:00.000Z',
  },
});

export function getReceiptTemplateRegistry() {
  return REGISTRY;
}

export function resolveReceiptTemplate({ receiptType, environment = 'SANDBOX' } = {}) {
  const env = String(environment).toUpperCase();
  const entry = Object.values(REGISTRY).find(
    (t) =>
      t.receiptType === receiptType &&
      t.approvalStatus === TEMPLATE_APPROVAL_STATUS.APPROVED &&
      (!t.environmentEligibility || t.environmentEligibility.includes(env) || env === 'DEVELOPMENT')
  );

  if (!entry) {
    const blocked = Object.values(REGISTRY).find((t) => t.receiptType === receiptType);
    return {
      resolved: false,
      template: blocked || null,
      reason: blocked?.blockerCodes?.[0] || 'RECEIPT_TEMPLATE_UNAVAILABLE',
    };
  }

  return { resolved: true, template: entry, reason: null };
}

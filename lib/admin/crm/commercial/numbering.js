/**
 * Commercial numbering — PRQ / PROP / QUO-YYYY-###### (UTC year).
 * Reuses CrmNumberSeq CAS via allocateCrmNumber.
 */

import { allocateCrmNumber, formatCrmNumber, utcYearOf } from '../numbering.js';
import {
  CRM_NUMBER_PREFIX,
  CRM_PRICE_BOOK_NUMBER_RE,
  CRM_PROPOSAL_NUMBER_RE,
  CRM_PROPOSAL_REQUEST_NUMBER_RE,
  CRM_QUOTATION_NUMBER_RE,
} from '../catalogue.js';

export async function allocateProposalRequestNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.PRQ,
    now: opts.now,
  });
}

export async function allocateProposalNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.PROP,
    now: opts.now,
  });
}

export async function allocateQuotationNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.QUO,
    now: opts.now,
  });
}

export async function allocatePriceBookNumber(prisma, opts = {}) {
  return allocateCrmNumber(prisma, {
    prefix: CRM_NUMBER_PREFIX.PB,
    now: opts.now,
  });
}

export function formatDocumentVersionLabel(documentNumber, versionNumber) {
  return `${documentNumber}-V${Number(versionNumber) || 1}`;
}

export {
  formatCrmNumber,
  utcYearOf,
  CRM_PROPOSAL_REQUEST_NUMBER_RE,
  CRM_PROPOSAL_NUMBER_RE,
  CRM_QUOTATION_NUMBER_RE,
  CRM_PRICE_BOOK_NUMBER_RE,
  CRM_NUMBER_PREFIX,
};

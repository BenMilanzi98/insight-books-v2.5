/**
 * CrmQuotation typed extension — Phase 15 Wave 1.
 * CRM Quotation ≠ tenant Quotation (WRONG_DOMAIN).
 */

import { CRM_COMMERCIAL_DOCUMENT_FAMILY, getCommercialDomainContract } from './catalogue.js';
import { createCommercialDocument, getCommercialDocument } from './documents.js';

/**
 * Create a Quotation commercial document (QUO-YYYY-######) + draft V1 + CrmQuotation.
 */
export async function createQuotation(prisma, args = {}) {
  const result = await createCommercialDocument(prisma, {
    ...args,
    documentFamily: CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION,
  });
  if (!result.ok) return result;
  return {
    ...result,
    domain: {
      ...getCommercialDomainContract(),
      tenantQuotationDomain: 'WRONG_DOMAIN',
    },
  };
}

export async function getQuotation(prisma, args = {}) {
  const result = await getCommercialDocument(prisma, args);
  if (!result.ok) return result;
  if (result.document?.documentFamily !== CRM_COMMERCIAL_DOCUMENT_FAMILY.QUOTATION) {
    return { ok: false, error: 'not_a_quotation', notFound: true };
  }
  return result;
}

/**
 * CrmProposal typed extension — Phase 15 Wave 1.
 * Never aliases tenant Quotation domain.
 */

import { CRM_COMMERCIAL_DOCUMENT_FAMILY } from './catalogue.js';
import { createCommercialDocument, getCommercialDocument } from './documents.js';

/**
 * Create a Proposal commercial document (PROP-YYYY-######) + draft V1 + CrmProposal.
 */
export async function createProposal(prisma, args = {}) {
  return createCommercialDocument(prisma, {
    ...args,
    documentFamily: CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL,
  });
}

export async function getProposal(prisma, args = {}) {
  const result = await getCommercialDocument(prisma, args);
  if (!result.ok) return result;
  if (result.document?.documentFamily !== CRM_COMMERCIAL_DOCUMENT_FAMILY.PROPOSAL) {
    return { ok: false, error: 'not_a_proposal', notFound: true };
  }
  return result;
}

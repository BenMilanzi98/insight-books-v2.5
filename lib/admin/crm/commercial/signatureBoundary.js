/**
 * E-signature provider boundary — Phase 15 Wave 3.
 * Provider is NOT_CONFIGURED; never fabricate signatures.
 */

export const CRM_ESIGN_STATUS = Object.freeze({
  NOT_CONFIGURED: 'NOT_CONFIGURED',
});

export function getESignatureProviderStatus() {
  return Object.freeze({ status: CRM_ESIGN_STATUS.NOT_CONFIGURED });
}

export function assertESignNotFabricated() {
  return {
    ok: false,
    error: 'e_sign_not_configured',
    status: CRM_ESIGN_STATUS.NOT_CONFIGURED,
  };
}

/**
 * Signature request boundary — records NOT_CONFIGURED only; never creates fake signatures.
 */
export async function createSignatureRequestBoundary(prisma, args = {}) {
  if (typeof prisma?.crmCommercialSignatureRequest?.create !== 'function') {
    return {
      ok: false,
      error: 'crm_commercial_signature_request_model_unavailable',
      status: 'UNAVAILABLE',
      providerStatus: CRM_ESIGN_STATUS.NOT_CONFIGURED,
    };
  }

  const row = await prisma.crmCommercialSignatureRequest.create({
    data: {
      documentVersionId: args.documentVersionId || null,
      recipientId: args.recipientId || null,
      providerStatus: CRM_ESIGN_STATUS.NOT_CONFIGURED,
      status: 'NOT_CONFIGURED',
      reason: 'e_sign_provider_not_configured',
      createdAt: args.now || new Date(),
      updatedAt: args.now || new Date(),
    },
  });

  return {
    ok: false,
    error: 'e_sign_not_configured',
    signatureRequest: row,
    providerStatus: CRM_ESIGN_STATUS.NOT_CONFIGURED,
  };
}

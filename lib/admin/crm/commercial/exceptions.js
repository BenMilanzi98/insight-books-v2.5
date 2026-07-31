/**

 * Pricing exceptions — Phase 15 Wave 2.

 * Manual unit price / below-min / nonstandard terms require reason + approval.

 * Create always PENDING; APPROVED only via SoD approve path. Calc verifies DB.

 */



import { resolveCrmAccess } from '../authz.js';

import {

  hasCrmPricingExceptionModel,

  resolveCommercialActor,

} from './model.js';



export async function createPricingException(prisma, args = {}) {

  const admin = resolveCommercialActor(args);

  const access = resolveCrmAccess(admin);

  if (!(access.canEditOpportunities || access.canEditLeads || access.isSuperAdmin)) {

    return { ok: false, forbidden: true, reason: 'crm_pricing_exception_forbidden' };

  }

  if (!hasCrmPricingExceptionModel(prisma)) {

    return { ok: false, error: 'crm_pricing_exception_model_unavailable', status: 'UNAVAILABLE' };

  }



  const reason = args.reason != null ? String(args.reason).trim() : '';

  if (!reason) return { ok: false, error: 'pricing_exception_reason_required' };



  const now = args.now || new Date();

  // Never self-approve on create — APPROVED only via approvePricingException (SoD).

  const row = await prisma.crmPricingException.create({

    data: {

      documentVersionId: String(args.commercialDocumentVersionId || args.documentVersionId || '').trim(),

      exceptionType: String(args.exceptionType || 'MANUAL_UNIT_PRICE').trim().toUpperCase(),

      reason,

      evidenceJson: args.evidenceJson ?? null,

      status: 'PENDING',

      requestedByAdminId: admin?.id || null,

      approvedByAdminId: null,

      expiresAt: args.expiresAt || null,

      payloadJson: args.payloadJson ?? null,

      createdAt: now,

      updatedAt: now,

    },

  });



  return {

    ok: true,

    exception: {

      id: row.id,

      status: row.status,

      exceptionType: row.exceptionType,

      reason: row.reason,

    },

  };

}



export async function approvePricingException(prisma, args = {}) {

  const admin = resolveCommercialActor(args);

  const access = resolveCrmAccess(admin);

  if (!(access.canApproveMerge || access.isSuperAdmin || access.canEditOpportunities)) {

    return { ok: false, forbidden: true, reason: 'crm_pricing_exception_approve_forbidden' };

  }

  if (!hasCrmPricingExceptionModel(prisma)) {

    return { ok: false, error: 'crm_pricing_exception_model_unavailable', status: 'UNAVAILABLE' };

  }



  const row = await prisma.crmPricingException.findUnique({

    where: { id: String(args.pricingExceptionId || args.exceptionId || '').trim() },

  });

  if (!row) return { ok: false, notFound: true, error: 'pricing_exception_not_found' };



  const approverId = admin?.id ? String(admin.id) : '';

  const requesterId = row.requestedByAdminId ? String(row.requestedByAdminId) : '';

  if (requesterId && approverId && requesterId === approverId) {

    return {

      ok: false,

      error: 'pricing_exception_self_approval_blocked',

      reason: 'sod_requester_must_differ_from_approver',

    };

  }



  if (String(row.status || '').toUpperCase() === 'APPROVED') {

    return {

      ok: true,

      alreadyExists: true,

      exception: { id: row.id, status: row.status, exceptionType: row.exceptionType, reason: row.reason },

    };

  }



  const now = args.now || new Date();

  const updated = await prisma.crmPricingException.update({

    where: { id: row.id },

    data: {

      status: 'APPROVED',

      approvedByAdminId: approverId || null,

      approvedAt: now,

      updatedAt: now,

    },

  });



  return {

    ok: true,

    exception: {

      id: updated.id,

      status: updated.status,

      exceptionType: updated.exceptionType,

      reason: updated.reason,

    },

  };

}



/**

 * Only DB-verified APPROVED exceptions may alter effective pricing.

 * In-memory status/approved flags without id + DB APPROVED are rejected.

 */

export async function filterApprovedExceptions(prisma, exceptions = []) {

  const approved = [];



  for (const e of exceptions || []) {

    const id = e?.id != null ? String(e.id).trim() : '';

    if (!id || !hasCrmPricingExceptionModel(prisma)) {

      continue;

    }



    try {

      const row = await prisma.crmPricingException.findUnique({ where: { id } });

      if (!row || String(row.status || '').toUpperCase() !== 'APPROVED') {

        continue;

      }



      const payload =

        row.payloadJson && typeof row.payloadJson === 'object' && !Array.isArray(row.payloadJson)

          ? row.payloadJson

          : {};



      approved.push({

        id: row.id,

        status: 'APPROVED',

        exceptionType: row.exceptionType,

        reason: row.reason,

        productRef: payload.productRef ?? e.productRef,

        lineKey: payload.lineKey ?? e.lineKey,

        unitPrice: payload.unitPrice != null ? payload.unitPrice : e.unitPrice,

        payloadJson: row.payloadJson,

      });

    } catch {

      // skip unverifiable

    }

  }



  return approved;

}



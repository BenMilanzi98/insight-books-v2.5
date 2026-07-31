/**

 * Discount policies & requests — Phase 15 Wave 2.

 * Threshold e.g. salesperson max 10%; above threshold stays PENDING until approved.

 * Not applied to effective pricing until APPROVED. SoD on approve.

 */



import { CRM_SUBJECT_TYPE, CRM_TIMELINE_EVENT_TYPE } from '../catalogue.js';

import { resolveCrmAccess } from '../authz.js';

import { appendTimelineEvent } from '../timeline.js';

import {

  CRM_DEFAULT_SALESPERSON_DISCOUNT_MAX_PERCENT,

  CRM_DISCOUNT_REQUEST_STATUS,

} from './catalogue.js';

import {

  hasCrmDiscountPolicyModel,

  hasCrmDiscountRequestModel,

  resolveCommercialActor,

  serializeDiscountRequest,

} from './model.js';



function canEdit(access) {

  return access.canEditOpportunities || access.canEditLeads || access.canCreateLeads;

}



async function resolveMaxPercent(prisma) {

  if (!hasCrmDiscountPolicyModel(prisma)) {

    return CRM_DEFAULT_SALESPERSON_DISCOUNT_MAX_PERCENT;

  }

  try {

    const policy = await prisma.crmDiscountPolicy.findFirst({

      where: { code: 'SALESPERSON_MAX', status: 'ACTIVE' },

      orderBy: { version: 'desc' },

    });

    if (policy && Number.isFinite(Number(policy.maxPercent))) {

      return Number(policy.maxPercent);

    }

  } catch {

    // fall through

  }

  return CRM_DEFAULT_SALESPERSON_DISCOUNT_MAX_PERCENT;

}



export async function createDiscountRequest(prisma, args = {}) {

  const admin = resolveCommercialActor(args);

  const access = resolveCrmAccess(admin);

  if (!canEdit(access)) {

    return { ok: false, forbidden: true, reason: 'crm_discount_request_forbidden' };

  }

  if (!hasCrmDiscountRequestModel(prisma)) {

    return { ok: false, error: 'crm_discount_request_model_unavailable', status: 'UNAVAILABLE' };

  }



  const percent = Number(args.percent);

  if (!Number.isFinite(percent) || percent < 0 || percent > 100) {

    return { ok: false, error: 'invalid_discount_percent' };

  }



  const maxPercent = await resolveMaxPercent(prisma);

  const requiresApproval = percent > maxPercent;

  const now = args.now || new Date();



  const row = await prisma.crmDiscountRequest.create({

    data: {

      documentVersionId: String(args.commercialDocumentVersionId || args.documentVersionId || '').trim(),

      percent,

      status: requiresApproval

        ? CRM_DISCOUNT_REQUEST_STATUS.PENDING

        : CRM_DISCOUNT_REQUEST_STATUS.APPROVED,

      requiresApproval,

      maxPolicyPercent: maxPercent,

      reason: args.reason != null ? String(args.reason).trim().slice(0, 1000) : null,

      requestedByAdminId: admin?.id || null,

      approvedByAdminId: requiresApproval ? null : admin?.id || null,

      createdAt: now,

      updatedAt: now,

    },

  });



  await appendTimelineEvent(prisma, {

    subjectType: CRM_SUBJECT_TYPE.ACCOUNT,

    subjectId: row.documentVersionId || row.id,

    eventType: CRM_TIMELINE_EVENT_TYPE.DISCOUNT_REQUEST_CREATED,

    summary: `Discount request ${percent}% (${row.status})`,

    payload: { discountRequestId: row.id, percent, requiresApproval },

    actorAdminId: admin?.id || null,

    at: now,

  });



  return { ok: true, request: serializeDiscountRequest(row) };

}



export async function approveDiscountRequest(prisma, args = {}) {

  const admin = resolveCommercialActor(args);

  const access = resolveCrmAccess(admin);

  if (!(access.canApproveMerge || access.isSuperAdmin || access.canEditOpportunities)) {

    return { ok: false, forbidden: true, reason: 'crm_discount_approve_forbidden' };

  }

  if (!hasCrmDiscountRequestModel(prisma)) {

    return { ok: false, error: 'crm_discount_request_model_unavailable', status: 'UNAVAILABLE' };

  }



  const row = await prisma.crmDiscountRequest.findUnique({

    where: { id: String(args.discountRequestId || '').trim() },

  });

  if (!row) return { ok: false, notFound: true, error: 'discount_request_not_found' };



  const approverId = admin?.id ? String(admin.id) : '';

  const requesterId = row.requestedByAdminId ? String(row.requestedByAdminId) : '';

  if (requesterId && approverId && requesterId === approverId) {

    return {

      ok: false,

      error: 'discount_self_approval_blocked',

      reason: 'sod_requester_must_differ_from_approver',

    };

  }



  if (row.status === CRM_DISCOUNT_REQUEST_STATUS.APPROVED) {

    return { ok: true, alreadyExists: true, request: serializeDiscountRequest(row) };

  }



  const now = args.now || new Date();

  const updated = await prisma.crmDiscountRequest.update({

    where: { id: row.id },

    data: {

      status: CRM_DISCOUNT_REQUEST_STATUS.APPROVED,

      approvedByAdminId: approverId || null,

      approvedAt: now,

      updatedAt: now,

    },

  });

  return { ok: true, request: serializeDiscountRequest(updated) };

}



/**

 * Split discount requests into applied (APPROVED) vs pending.

 * Approval is resolved exclusively from CrmDiscountRequest by id — never from caller status.

 * Pending / missing / forged statuses never reduce effective net pricing.

 */

export async function resolveDiscountApplication(prisma, discountRequests = []) {

  const pending = [];

  const applied = [];

  let appliedPercent = 0;



  for (const d of discountRequests || []) {

    const id = d?.id != null ? String(d.id).trim() : '';

    let status = null;

    let percent = null;



    if (id && hasCrmDiscountRequestModel(prisma)) {

      try {

        const row = await prisma.crmDiscountRequest.findUnique({ where: { id } });

        if (row) {

          status = row.status;

          percent = Number(row.percent);

        } else {

          // Unknown id — never trust caller APPROVED

          pending.push({

            id,

            percent: Number(d.percent),

            status: CRM_DISCOUNT_REQUEST_STATUS.PENDING,

          });

          continue;

        }

      } catch {

        pending.push({

          id,

          percent: Number(d.percent),

          status: CRM_DISCOUNT_REQUEST_STATUS.PENDING,

        });

        continue;

      }

    } else {

      // No id (or model unavailable) — reject in-memory APPROVED; treat as pending

      pending.push({

        id: id || null,

        percent: Number(d.percent),

        status: CRM_DISCOUNT_REQUEST_STATUS.PENDING,

      });

      continue;

    }



    if (!Number.isFinite(percent)) continue;



    if (String(status || '').toUpperCase() === CRM_DISCOUNT_REQUEST_STATUS.APPROVED) {

      applied.push({ id, percent, status: CRM_DISCOUNT_REQUEST_STATUS.APPROVED });

      appliedPercent = Math.max(appliedPercent, percent);

    } else {

      pending.push({

        id,

        percent,

        status: status || CRM_DISCOUNT_REQUEST_STATUS.PENDING,

      });

    }

  }



  return {

    appliedDiscountPercent: appliedPercent,

    pendingDiscounts: pending,

    appliedDiscounts: applied,

  };

}



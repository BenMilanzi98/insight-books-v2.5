import { getAdminFromRequest } from '@/lib/adminAuth';
import {
  SYSTEM_EIS_PERMISSIONS,
  adminHasEisPermission,
  getCurrentEntitlement,
  upgradeTenantEntitlementToProduction,
  suspendTenantEntitlement,
  resumeTenantEntitlement,
  revokeTenantEntitlement,
  evaluateTenantEisCapability,
  getEisReadinessSummary,
  EIS_OPERATION,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse, requestMeta, readRequestId } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import prisma from '@/lib/prisma';

export async function GET(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.ENTITLEMENT_VIEW)) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }
    const tenantId = params.tenantId;
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, subdomain: true, status: true, eisEnabled: true, tpin: true },
    });
    if (!tenant) {
      return eisErrorResponse(EisErrors.validation({ message: 'Tenant not found.', httpStatus: 404 }));
    }
    const entitlement = await getCurrentEntitlement(tenantId);
    const history = await prisma.mraEisTenantEntitlement.findMany({
      where: { tenantId },
      orderBy: { version: 'desc' },
      take: 20,
    });
    const readiness = await getEisReadinessSummary(tenantId);
    const capability = await evaluateTenantEisCapability({
      tenantId,
      requestedOperation: EIS_OPERATION.TRANSMIT_SALE,
    });
    const audit = await prisma.mraEisControlAuditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return eisJson({ tenant, entitlement, history, readiness, capability, audit });
  } catch (err) {
    return eisErrorResponse(err);
  }
}

export async function POST(request, { params }) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    const tenantId = params.tenantId;
    const body = await request.json();
    const meta = requestMeta(request);
    const action = String(body.action || '').toLowerCase();
    const base = {
      admin,
      tenantId,
      reason: body.reason,
      expectedVersion: body.expectedVersion,
      requestId: readRequestId(body, request),
      ...meta,
    };

    if (action === 'upgrade') {
      if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.ENTITLEMENT_UPGRADE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(
        await upgradeTenantEntitlementToProduction({
          ...base,
          approvalReference: body.approvalReference,
          productionApprovalRequired: Boolean(body.productionApprovalRequired),
        })
      );
    }
    if (action === 'suspend') {
      if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.ENTITLEMENT_SUSPEND)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await suspendTenantEntitlement(base));
    }
    if (action === 'resume') {
      if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.ENTITLEMENT_RESUME)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await resumeTenantEntitlement(base));
    }
    if (action === 'revoke') {
      if (!adminHasEisPermission(admin, SYSTEM_EIS_PERMISSIONS.ENTITLEMENT_REVOKE)) {
        return eisErrorResponse(EisErrors.permissionDenied());
      }
      return eisJson(await revokeTenantEntitlement(base));
    }
    return eisErrorResponse(EisErrors.validation({ message: 'Unknown action. Use upgrade|suspend|resume|revoke.' }));
  } catch (err) {
    return eisErrorResponse(err);
  }
}

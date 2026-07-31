import { getUserFromSession, hasPermission } from '@/lib/auth';
import {
  TENANT_EIS_PERMISSIONS,
  tenantHasEisPermission,
  getCurrentEntitlement,
  getParticipation,
  getBusinessEisSetting,
  getEisReadinessSummary,
  HUMAN_LABELS,
} from '@/lib/mraEis/index.js';
import { eisJson, eisErrorResponse } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';
import prisma from '@/lib/prisma';
import { resolveTenantEisManagementAccess } from '@/lib/mraEis/navAccess.js';

export async function GET() {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    }
    const allowed =
      tenantHasEisPermission(user, TENANT_EIS_PERMISSIONS.AVAILABILITY_VIEW) ||
      hasPermission(user, 'settings.view') ||
      hasPermission(user, 'reports.view');
    if (!allowed) {
      return eisErrorResponse(EisErrors.permissionDenied());
    }

    const tenantId = user.tenantId;
    const entitlement = await getCurrentEntitlement(tenantId);
    const participation = await getParticipation(tenantId);
    const businessSetting = await getBusinessEisSetting(tenantId, tenantId);
    const readiness = await getEisReadinessSummary(tenantId);
    const managementAccess = await resolveTenantEisManagementAccess(tenantId);
    const audit = await prisma.mraEisControlAuditEvent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    return eisJson({
      tenantId,
      businessId: tenantId,
      entitlement,
      entitlementLabel: HUMAN_LABELS.entitlement[entitlement?.status] || 'Not entitled',
      participation,
      participationLabel: HUMAN_LABELS.participation[participation?.status] || 'Not started',
      businessSetting,
      businessLabel: HUMAN_LABELS.businessOps[businessSetting?.status] || 'Unavailable',
      readiness,
      managementAccess: {
        unlocked: managementAccess.unlocked,
        via: managementAccess.via,
        hasActiveEisSubscription: managementAccess.hasActiveEisSubscription,
        entitlementStatus: managementAccess.entitlementStatus,
        navItems: managementAccess.navItems,
      },
      audit,
      systemControlledFields: [
        'entitlement.status',
        'entitlement.sandboxAllowed',
        'entitlement.productionAllowed',
        'entitlement.effectiveFrom',
        'entitlement.effectiveUntil',
      ],
      note:
        'EIS entitlement is controlled by InsightBooks System Administration. Opting in does not authorize production or activate terminals. Full management nav unlocks with an active MRA EIS subscription or entitled status.',
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}

import { getUserFromSession } from '@/lib/auth';
import { resolveTenantEisManagementAccess } from '@/lib/mraEis/navAccess.js';
import { eisJson, eisErrorResponse } from '@/lib/mraEis/http.js';
import { EisErrors } from '@/lib/mraEis/domain/errors.js';

/**
 * Lightweight nav unlock for the tenant sidebar.
 * Any authenticated tenant user may read managementAccess (no EIS permission required).
 */
export async function GET() {
  try {
    const user = await getUserFromSession();
    if (!user?.tenantId) {
      return eisErrorResponse(EisErrors.permissionDenied({ httpStatus: 401, message: 'Unauthorized' }));
    }

    const managementAccess = await resolveTenantEisManagementAccess(user.tenantId);

    return eisJson({
      managementAccess: {
        unlocked: managementAccess.unlocked,
        via: managementAccess.via,
        hasActiveEisSubscription: managementAccess.hasActiveEisSubscription,
        entitlementStatus: managementAccess.entitlementStatus,
        navItems: managementAccess.navItems,
      },
    });
  } catch (err) {
    return eisErrorResponse(err);
  }
}

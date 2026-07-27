import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';

/**
 * Honest compliance snapshot from control-plane signals — no invented scorecards.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.security.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [auditCount30d, activeAdmins, supportSessions, suppressions] = await Promise.all([
      prisma.adminAuditLog.count({ where: { timestamp: { gte: since30d } } }),
      prisma.admin.count({ where: { isActive: true } }),
      prisma.platformSupportAccess.count({ where: { status: 'ACTIVE' } }),
      prisma.platformEmailSuppression.count({ where: { active: true } }),
    ]);

    const policies = [
      {
        id: 'audit-logging',
        name: 'Admin audit logging',
        status: auditCount30d > 0 ? 'compliant' : 'partial',
        detail: `${auditCount30d} admin audit events in last 30 days`,
      },
      {
        id: 'active-admins',
        name: 'Active platform admins',
        status: activeAdmins > 0 ? 'compliant' : 'non-compliant',
        detail: `${activeAdmins} active admin accounts`,
      },
      {
        id: 'support-access',
        name: 'Support access sessions',
        status: 'info',
        detail: `${supportSessions} active support-access sessions`,
      },
      {
        id: 'email-suppression',
        name: 'Email suppression list',
        status: 'info',
        detail: `${suppressions} active suppressions`,
      },
    ];

    return NextResponse.json({
      success: true,
      compliance: {
        overallScore: null,
        scoreNote: 'No composite compliance score is inventoriable — review individual signals',
        policies,
        auditRequirements: [
          {
            id: 'append-only-audit',
            name: 'Append-only AdminAuditLog',
            status: 'enforced-app-layer',
            detail: 'Updates/deletes forbidden via appendOnlyAudit helper',
          },
        ],
        lastAssessment: new Date().toISOString(),
        nextAssessment: null,
        source: 'control_plane_signals',
      },
    });
  } catch (error) {
    console.error('security/compliance GET:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load compliance signals' },
      { status: 500 }
    );
  }
}

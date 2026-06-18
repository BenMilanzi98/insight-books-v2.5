/**
 * Audit logging for report generation and exports.
 */
import prisma from '@/lib/prisma';

/**
 * @param {object} params
 * @param {string} params.userId
 * @param {string} [params.tenantId] Primary tenant for audit row (session tenant or first in scope)
 * @param {string} params.reportType
 * @param {string} params.action REPORT_GENERATED | REPORT_EXPORTED
 * @param {string[]} params.tenantIds
 * @param {string[]} [params.businessNames]
 * @param {object} [params.filters]
 * @param {string} [params.format] csv | xlsx | pdf
 */
export async function logReportAccess({
  userId,
  tenantId,
  reportType,
  action,
  tenantIds,
  businessNames,
  filters = {},
  format = null,
}) {
  if (!userId || !reportType) return;

  const primaryTenant = tenantId || tenantIds?.[0];
  if (!primaryTenant) return;

  try {
    await prisma.auditLog.create({
      data: {
        action,
        entityType: 'REPORT',
        entityId: reportType,
        userId,
        tenantId: primaryTenant,
        details: JSON.stringify({
          reportType,
          format,
          tenantIds: tenantIds || [],
          businessNames: businessNames || [],
          filters,
          generatedAt: new Date().toISOString(),
        }),
      },
    });
  } catch (err) {
    console.warn('[reportAudit] Failed to log report access:', err?.message || err);
  }
}

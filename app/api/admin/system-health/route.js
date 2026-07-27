import { NextResponse } from 'next/server';
import { getAdminFromRequest, adminHasPermission } from '@/lib/adminAuth';
import { SYSTEM_ADMIN_PERMISSIONS } from '@/lib/admin/permissions';
import prisma from '@/lib/prisma';

/**
 * Real platform health — no random/mock CPU metrics, no secret exposure.
 */
export async function GET(request) {
  try {
    const admin = await getAdminFromRequest(request);
    if (!admin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (!adminHasPermission(admin, SYSTEM_ADMIN_PERMISSIONS.health.view)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const checkedAt = new Date().toISOString();
    const services = [];

    let dbStatus = 'failed';
    let dbLatency = null;
    let dbError = null;
    const dbStart = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatency = Date.now() - dbStart;
      dbStatus = 'healthy';
    } catch (e) {
      dbLatency = Date.now() - dbStart;
      dbError = 'Database connectivity check failed';
    }
    services.push({
      name: 'database',
      status: dbStatus,
      latencyMs: dbLatency,
      message: dbError || undefined,
    });

    services.push({
      name: 'application',
      status: 'healthy',
      latencyMs: 0,
      message: 'Admin API process responding',
    });

    let tenantCount = null;
    let adminCount = null;
    let countsError = null;
    try {
      const [tenants, admins] = await Promise.all([
        prisma.tenant.count(),
        prisma.admin.count({ where: { isActive: true } }),
      ]);
      tenantCount = tenants;
      adminCount = admins;
      services.push({
        name: 'platform_counts',
        status: 'healthy',
        message: `${tenants} tenants, ${admins} active admins`,
      });
    } catch (e) {
      countsError = 'Platform count query failed';
      services.push({
        name: 'platform_counts',
        status: 'failed',
        message: countsError,
      });
    }

    let emailPending = null;
    let emailFailed = null;
    let emailSent24h = null;
    let emailQueueError = null;
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [pending, failed, sent24h] = await Promise.all([
        prisma.emailLog.count({ where: { status: 'pending' } }),
        prisma.emailLog.count({ where: { status: 'failed' } }),
        prisma.emailLog.count({
          where: {
            status: 'sent',
            OR: [
              { sentAt: { gte: since24h } },
              { AND: [{ sentAt: null }, { updatedAt: { gte: since24h } }] },
            ],
          },
        }),
      ]);
      emailPending = pending;
      emailFailed = failed;
      emailSent24h = sent24h;

      let emailServiceStatus = 'healthy';
      let emailMessage = `${pending} pending, ${failed} failed, ${sent24h} sent (24h)`;
      if (failed > 0 || pending > 100) {
        emailServiceStatus = 'degraded';
        emailMessage =
          failed > 0 && pending > 100
            ? `${failed} failed emails; backlog ${pending} pending`
            : failed > 0
              ? `${failed} failed emails in queue`
              : `Email backlog high (${pending} pending)`;
      }
      services.push({
        name: 'email',
        status: emailServiceStatus,
        message: emailMessage,
      });
    } catch (e) {
      emailQueueError = 'Email queue stats query failed';
      services.push({
        name: 'email',
        status: 'failed',
        message: emailQueueError,
      });
    }

    const failed = services.filter((s) => s.status === 'failed').length;
    const degraded = services.filter((s) => s.status === 'degraded').length;
    const overall =
      failed > 0 ? 'failed' : degraded > 0 ? 'degraded' : 'healthy';

    const queues =
      emailQueueError != null
        ? { email: { error: emailQueueError } }
        : {
            email: {
              pending: emailPending,
              failed: emailFailed,
              sent24h: emailSent24h,
            },
          };

    const jobs =
      emailQueueError != null
        ? { retryableFailedEmails: null, error: emailQueueError }
        : { retryableFailedEmails: emailFailed };

    const body = {
      success: overall === 'healthy',
      status: overall,
      checkedAt,
      app: { status: 'healthy', latencyMs: 0 },
      database: {
        status: dbStatus,
        latencyMs: dbLatency,
        ...(dbError ? { error: dbError } : {}),
      },
      email:
        emailQueueError != null
          ? { status: 'failed', error: emailQueueError }
          : {
              status:
                emailFailed > 0 || emailPending > 100 ? 'degraded' : 'healthy',
              pending: emailPending,
              failed: emailFailed,
              sent24h: emailSent24h,
            },
      // Omit invented zero metrics for failed subsystems — expose error instead
      counts:
        countsError != null
          ? { error: countsError }
          : { tenants: tenantCount, activeAdmins: adminCount },
      queues,
      jobs,
      services,
    };

    // Do not report HTTP 200 success when core DB check failed
    const httpStatus = overall === 'failed' ? 503 : 200;
    return NextResponse.json(body, { status: httpStatus });
  } catch (error) {
    console.error('system-health error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'System health check failed',
        status: 'failed',
        checkedAt: new Date().toISOString(),
        services: [],
        database: { status: 'failed', error: 'Health check aborted' },
        app: { status: 'unknown' },
      },
      { status: 500 }
    );
  }
}

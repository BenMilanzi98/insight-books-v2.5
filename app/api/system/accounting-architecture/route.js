import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getUserFromSession } from '@/lib/auth';
import {
  canManageAccountingArchitecture,
  ACCOUNTING_PERMISSIONS,
  hasAccountingPermission,
} from '@/lib/accountingV2/permissions.js';
import { setFlag } from '@/lib/accountingV2/infrastructure/featureFlags.js';
import { recordAccountingAudit, AUDIT_ACTIONS } from '@/lib/accountingV2/infrastructure/auditTrail.js';
import { flagChangeSchema, configurationChangeSchema } from '@/lib/accountingV2/contracts/apiSchemas.js';
import { getAccountingMetrics } from '@/lib/accountingV2/observability/accountingLogger.js';
import { PostingMode } from '@/lib/accountingV2/domain/enums.js';

/**
 * GET /api/system/accounting-architecture
 * Read-only architecture status for the internal admin page. Tenant-scoped:
 * administrators see their own business configuration, flags, and shadow summary.
 */
export async function GET(request) {
  const user = await getUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (
    !canManageAccountingArchitecture(user) &&
    !hasAccountingPermission(user, ACCOUNTING_PERMISSIONS.AUDIT_VIEW)
  ) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }
  const tenantId = user.tenantId;
  if (!tenantId) {
    return NextResponse.json({ error: 'No business scope' }, { status: 400 });
  }

  const [configuration, flags, eventCounts, comparisonCounts, lastComparison, blockers] =
    await Promise.all([
      prisma.acctV2Configuration.findUnique({ where: { tenantId } }),
      prisma.acctV2FeatureFlag.findMany({
        where: { tenantId: { in: [tenantId, '*'] } },
        orderBy: [{ flagKey: 'asc' }],
      }),
      prisma.acctV2EventRegistry.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      prisma.acctV2ShadowComparison.groupBy({
        by: ['status'],
        where: { tenantId },
        _count: { _all: true },
      }),
      prisma.acctV2ShadowComparison.findFirst({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        select: { id: true, status: true, severity: true, createdAt: true },
      }),
      prisma.acctV2ShadowComparison.count({
        where: { tenantId, severity: { in: ['CRITICAL', 'HIGH'] } },
      }),
    ]);

  return NextResponse.json({
    architectureVersion: configuration?.accountingArchitectureVersion ?? 'ACCOUNTING_V2',
    defaultPostingMode: configuration?.defaultPostingMode ?? PostingMode.NEW_ENGINE,
    configuration: configuration ?? null,
    flags: flags.map((f) => ({
      flagKey: f.flagKey,
      scope: { tenantId: f.tenantId, moduleKey: f.moduleKey, eventType: f.eventType },
      enabled: f.enabled,
      updatedAt: f.updatedAt,
    })),
    events: Object.fromEntries(eventCounts.map((c) => [c.status, c._count._all])),
    shadowComparisons: Object.fromEntries(comparisonCounts.map((c) => [c.status, c._count._all])),
    lastComparison,
    outstandingCriticalBlockers: blockers,
    integrityMonitoring: configuration?.enableIntegrityMonitoring ?? false,
    cutoverReadiness: 'ACTIVE (Phase 9 — NEW_ENGINE authoritative)',
    processMetrics: getAccountingMetrics(),
  });
}

/**
 * POST /api/system/accounting-architecture
 * Body: { kind: 'flag', ...flagChange } | { kind: 'configuration', ...configChange }
 * Every change requires a reason and is written to the audit trail.
 */
export async function POST(request) {
  const user = await getUserFromSession(request);
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (!canManageAccountingArchitecture(user)) {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body?.kind === 'flag') {
    const parsed = flagChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }
    const data = parsed.data;
    // Tenant admins may only manage flags for their own business (or leave global to platform ops).
    if (data.tenantId !== user.tenantId && data.tenantId !== '*') {
      return NextResponse.json({ error: 'Cannot manage flags for another business' }, { status: 403 });
    }
    if (data.tenantId === '*' && user.tenantId) {
      return NextResponse.json({ error: 'Global flags require platform operations access' }, { status: 403 });
    }
    const previous = await prisma.acctV2FeatureFlag.findUnique({
      where: {
        tenantId_flagKey_moduleKey_eventType: {
          tenantId: data.tenantId,
          flagKey: data.flagKey,
          moduleKey: data.moduleKey,
          eventType: data.eventType,
        },
      },
    });
    const row = await setFlag(prisma, { ...data, updatedBy: user.id });
    await recordAccountingAudit({
      action: AUDIT_ACTIONS.FLAG_CHANGE,
      entityType: 'AcctV2FeatureFlag',
      entityId: row.id,
      userId: user.id,
      tenantId: user.tenantId,
      previousValues: previous ? { enabled: previous.enabled } : null,
      newValues: { enabled: row.enabled },
      reason: data.reason,
    });
    return NextResponse.json({ ok: true, flag: { flagKey: row.flagKey, enabled: row.enabled } });
  }

  if (body?.kind === 'configuration') {
    const parsed = configurationChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
    }
    const data = parsed.data;
    if (data.tenantId !== user.tenantId) {
      return NextResponse.json({ error: 'Cannot configure another business' }, { status: 403 });
    }
    const { reason, tenantId, ...changes } = data;
    if (
      changes.defaultPostingMode &&
      changes.defaultPostingMode !== PostingMode.NEW_ENGINE &&
      changes.defaultPostingMode !== PostingMode.DISABLED
    ) {
      return NextResponse.json(
        { error: 'Only NEW_ENGINE or DISABLED posting modes are allowed (legacy/shadow removed).' },
        { status: 409 }
      );
    }
    const previous = await prisma.acctV2Configuration.findUnique({ where: { tenantId } });
    const row = await prisma.acctV2Configuration.upsert({
      where: { tenantId },
      create: {
        tenantId,
        ...changes,
        accountingArchitectureVersion: 'ACCOUNTING_V2',
        defaultPostingMode: changes.defaultPostingMode || PostingMode.NEW_ENGINE,
        enableShadowAccounting: false,
      },
      update: {
        ...changes,
        accountingArchitectureVersion: 'ACCOUNTING_V2',
        enableShadowAccounting: false,
      },
    });
    await recordAccountingAudit({
      action: AUDIT_ACTIONS.CONFIG_CHANGE,
      entityType: 'AcctV2Configuration',
      entityId: row.id,
      userId: user.id,
      tenantId,
      previousValues: previous
        ? { defaultPostingMode: previous.defaultPostingMode, enableShadowAccounting: previous.enableShadowAccounting }
        : null,
      newValues: changes,
      reason,
    });
    return NextResponse.json({ ok: true, configuration: row });
  }

  return NextResponse.json({ error: 'Unknown change kind' }, { status: 400 });
}

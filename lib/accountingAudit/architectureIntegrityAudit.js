/**
 * Architecture integrity monitor (Phase 2 extension of the Phase 1 audit engine).
 * READ-ONLY. Verifies the Accounting V2 transition foundation invariants:
 *   ARCH-001 registry event missing idempotency key or correlation id
 *   ARCH-002 registry event stuck IN_PROGRESS (> 1h)
 *   ARCH-003 shadow comparison with critical/high severity awaiting review
 *   ARCH-004 configuration requests NEW_ENGINE mode (unsupported in this release)
 *   ARCH-005 outbox backlog (> 100 pending or oldest pending > 24h)
 *   ARCH-006 registry event missing architecture version
 *   ARCH-007 shadow journal without comparison (incomplete shadow run)
 *   ARCH-008 cross-tenant reference between shadow journal and event registry
 */

import { SEVERITY, CONFIDENCE, makeFinding } from './findings.js';

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{tenantId?: string|null}} scope
 */
export async function runArchitectureIntegrityAudit(prisma, scope = {}) {
  const findings = [];
  const artifacts = {};
  if (!prisma.acctV2EventRegistry) {
    // V2 tables not migrated in this environment — report and exit gracefully.
    return { findings, artifacts: { note: 'AcctV2 tables not present' } };
  }
  const tenantWhere = scope.tenantId ? { tenantId: scope.tenantId } : {};

  const events = await prisma.acctV2EventRegistry.findMany({ where: tenantWhere });
  artifacts.eventCount = events.length;

  for (const event of events) {
    if (!event.idempotencyKey || !event.correlationId) {
      findings.push(
        makeFinding({
          ruleCode: 'ARCH-001',
          severity: SEVERITY.HIGH,
          category: 'architecture',
          tenantId: event.tenantId,
          entityType: 'AcctV2EventRegistry',
          entityId: event.id,
          description: 'Accounting event registered without idempotency key or correlation id.',
          expected: 'idempotencyKey and correlationId present',
          actual: `idempotencyKey=${Boolean(event.idempotencyKey)}, correlationId=${Boolean(event.correlationId)}`,
        })
      );
    }
    if (!event.architectureVersion) {
      findings.push(
        makeFinding({
          ruleCode: 'ARCH-006',
          severity: SEVERITY.MEDIUM,
          category: 'architecture',
          tenantId: event.tenantId,
          entityType: 'AcctV2EventRegistry',
          entityId: event.id,
          description: 'Accounting event missing architecture version tag.',
        })
      );
    }
    if (
      event.status === 'IN_PROGRESS' &&
      Date.now() - new Date(event.updatedAt).getTime() > 60 * 60 * 1000
    ) {
      findings.push(
        makeFinding({
          ruleCode: 'ARCH-002',
          severity: SEVERITY.HIGH,
          category: 'architecture',
          tenantId: event.tenantId,
          entityType: 'AcctV2EventRegistry',
          entityId: event.id,
          description: 'Accounting event stuck IN_PROGRESS for over an hour (possible crashed attempt).',
          recommendation: 'Inspect posting attempts; re-open or fail the registration explicitly.',
        })
      );
    }
  }

  const badComparisons = await prisma.acctV2ShadowComparison.findMany({
    where: { ...tenantWhere, severity: { in: ['CRITICAL', 'HIGH'] } },
  });
  for (const comparison of badComparisons) {
    findings.push(
      makeFinding({
        ruleCode: 'ARCH-003',
        severity: SEVERITY.HIGH,
        category: 'architecture',
        tenantId: comparison.tenantId,
        entityType: 'AcctV2ShadowComparison',
        entityId: comparison.id,
        description: `Shadow comparison flagged ${comparison.status}.`,
        actual: comparison.explanation ?? comparison.status,
        confidence: CONFIDENCE.CONFIRMED,
        recommendation: 'Review before widening shadow rollout or considering cutover.',
      })
    );
  }

  const configs = await prisma.acctV2Configuration.findMany({ where: tenantWhere });
  for (const config of configs) {
    if (config.defaultPostingMode === 'LEGACY' || config.defaultPostingMode === 'SHADOW') {
      findings.push(
        makeFinding({
          ruleCode: 'ARCH-004',
          severity: SEVERITY.MEDIUM,
          category: 'architecture',
          tenantId: config.tenantId,
          entityType: 'AcctV2Configuration',
          entityId: config.id,
          description: `Configuration still uses ${config.defaultPostingMode}; Phase 9 default is NEW_ENGINE.`,
          recommendation: 'Flip defaultPostingMode to NEW_ENGINE unless this tenant is on an intentional rollback.',
        })
      );
    }
  }

  const pendingOutbox = await prisma.acctV2Outbox.findMany({
    where: { ...tenantWhere, status: 'PENDING' },
    orderBy: { occurredAt: 'asc' },
  });
  if (pendingOutbox.length > 100 || (pendingOutbox[0] && Date.now() - new Date(pendingOutbox[0].occurredAt).getTime() > 24 * 60 * 60 * 1000)) {
    findings.push(
      makeFinding({
        ruleCode: 'ARCH-005',
        severity: SEVERITY.MEDIUM,
        category: 'architecture',
        tenantId: scope.tenantId ?? null,
        entityType: 'AcctV2Outbox',
        description: `Outbox backlog: ${pendingOutbox.length} pending message(s), oldest ${pendingOutbox[0]?.occurredAt ?? 'n/a'}.`,
        recommendation: 'Run or fix the outbox dispatcher.',
      })
    );
  }

  const shadowJournals = await prisma.acctV2ShadowJournal.findMany({
    where: tenantWhere,
    include: { comparison: true, eventRegistry: { select: { tenantId: true } } },
  });
  for (const shadow of shadowJournals) {
    if (!shadow.comparison) {
      findings.push(
        makeFinding({
          ruleCode: 'ARCH-007',
          severity: SEVERITY.LOW,
          category: 'architecture',
          tenantId: shadow.tenantId,
          entityType: 'AcctV2ShadowJournal',
          entityId: shadow.id,
          description: 'Shadow journal has no comparison record (incomplete shadow run).',
        })
      );
    }
    if (shadow.eventRegistry && shadow.eventRegistry.tenantId !== shadow.tenantId) {
      findings.push(
        makeFinding({
          ruleCode: 'ARCH-008',
          severity: SEVERITY.CRITICAL,
          category: 'architecture',
          tenantId: shadow.tenantId,
          entityType: 'AcctV2ShadowJournal',
          entityId: shadow.id,
          description: 'Shadow journal references an event registry row from another business.',
          expected: shadow.tenantId,
          actual: shadow.eventRegistry.tenantId,
        })
      );
    }
  }

  artifacts.summary = {
    events: events.length,
    criticalComparisons: badComparisons.length,
    pendingOutbox: pendingOutbox.length,
    shadowJournals: shadowJournals.length,
  };
  return { findings, artifacts };
}

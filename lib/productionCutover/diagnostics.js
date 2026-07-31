/**
 * Pre-migration diagnostic checks (safe, read-oriented).
 * Pass a prisma-like client; when unavailable, returns SKIPPED.
 */

export async function runPreMigrationDiagnostics(prisma) {
  const findings = [];
  const push = (code, severity, message, detail = {}) =>
    findings.push({ code, severity, message, detail, at: new Date().toISOString() });

  if (!prisma) {
    push('DIAG_NO_DB', 'INFO', 'Prisma client not provided — diagnostics skipped.');
    return { status: 'SKIPPED', findings };
  }

  try {
    // Orphan-ish / integrity probes — soft fail if models missing
    if (prisma.tenant?.count) {
      const tenants = await prisma.tenant.count();
      push('DIAG_TENANT_COUNT', 'INFO', `Tenant/Business count: ${tenants}`, { tenants });
    }

    if (prisma.user?.count) {
      const users = await prisma.user.count();
      push('DIAG_USER_COUNT', 'INFO', `User count: ${users}`, { users });
    }

    // Canonical journals if AcctV2 models exist
    if (prisma.acctV2JournalEntry?.count) {
      const journals = await prisma.acctV2JournalEntry.count();
      push('DIAG_JOURNAL_COUNT', 'INFO', `AcctV2 journal count: ${journals}`, { journals });
    }

    if (prisma.acctV2JournalEntryLine?.count) {
      const lines = await prisma.acctV2JournalEntryLine.count();
      push('DIAG_JOURNAL_LINE_COUNT', 'INFO', `AcctV2 journal line count: ${lines}`, { lines });
    }

    // Cross-tenant probe: lines with business mismatch would need raw SQL — flag as manual
    push(
      'DIAG_CROSS_TENANT_MANUAL',
      'WARNING',
      'Cross-Business journal/account references require SQL review before cutover (see PRE_MIGRATION_DIAGNOSTIC_REPORT).'
    );

    push(
      'DIAG_UNBALANCED_MANUAL',
      'WARNING',
      'Unbalanced Journals must be scanned with forensic audit / verify:accounting-scenario before go-live.'
    );
  } catch (e) {
    push('DIAG_ERROR', 'HIGH', e.message || String(e));
  }

  const blocking = findings.filter((f) => f.severity === 'CRITICAL' || f.severity === 'HIGH');
  return {
    status: blocking.some((f) => f.code === 'DIAG_ERROR') ? 'FAILED' : 'COMPLETED_WITH_WARNINGS',
    findings,
    blockingCount: blocking.length,
  };
}

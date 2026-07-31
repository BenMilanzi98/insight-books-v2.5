/**
 * Tenant accounting boundary — Phase 16 Wave 2.
 * Conversion may init CoA/period templates; never journals / balances / AR / revenue.
 */

/**
 * Assert conversion has not posted Tenant journals or account balances.
 */
export async function assertNoTenantAccountingSideEffects(prisma, args = {}) {
  const tenantId = args.tenantId ? String(args.tenantId).trim() : '';
  if (!tenantId) {
    return { ok: false, error: 'tenantId_required' };
  }

  let journalCount = 0;
  let balanceCount = 0;

  if (typeof prisma?.journalEntry?.count === 'function') {
    journalCount = await prisma.journalEntry.count({ where: { tenantId } });
  } else if (typeof prisma?.journalEntry?.findMany === 'function') {
    const rows = await prisma.journalEntry.findMany({ where: { tenantId } });
    journalCount = rows.length;
  }

  if (typeof prisma?.accountBalance?.count === 'function') {
    balanceCount = await prisma.accountBalance.count({ where: { tenantId } });
  } else if (typeof prisma?.accountBalance?.findMany === 'function') {
    const rows = await prisma.accountBalance.findMany({ where: { tenantId } });
    balanceCount = rows.length;
  }

  if (journalCount > 0 || balanceCount > 0) {
    return {
      ok: false,
      error: 'tenant_accounting_side_effect_detected',
      journalCount,
      balanceCount,
      conversionId: args.conversionId || null,
      tenantId,
    };
  }

  return {
    ok: true,
    journalCount: 0,
    balanceCount: 0,
    conversionId: args.conversionId || null,
    tenantId,
  };
}


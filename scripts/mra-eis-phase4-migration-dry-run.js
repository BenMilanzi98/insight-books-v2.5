/**
 * Dry-run classification of existing tenants for Phase 4 entitlement migration.
 * Does not grant entitlement, activate terminals, or call MRA.
 *
 * Usage: node scripts/mra-eis-phase4-migration-dry-run.js
 */
import prisma from '../lib/prisma.js';
import { EIS_PLAN_IDS } from '../lib/subscriptionConfig.js';
import fs from 'fs';
import path from 'path';

function classify(tenant, { hasEisSub, hasConfig, hasInvoice }) {
  if (hasInvoice || (hasConfig && tenant.eisEnabled)) {
    return 'REQUIRES_MANUAL_REVIEW';
  }
  if (hasConfig && !tenant.eisEnabled) {
    return 'EXISTING_EIS_SETTING_DISABLED';
  }
  if (tenant.eisEnabled && !hasConfig && !hasEisSub) {
    return 'EXISTING_EIS_SETTING_ENABLED_WITHOUT_EVIDENCE';
  }
  if (hasEisSub && !tenant.eisEnabled) {
    return 'EXISTING_MRA_CONFIGURATION';
  }
  if (hasEisSub && tenant.eisEnabled) {
    return 'REQUIRES_MANUAL_REVIEW';
  }
  return 'NO_EXISTING_EIS_DATA';
}

async function main() {
  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true, subdomain: true, eisEnabled: true, tpin: true },
  });
  const now = new Date();
  const rows = [];

  for (const tenant of tenants) {
    const hasEisSub = Boolean(
      await prisma.accountSubscription.findFirst({
        where: {
          tenantId: tenant.id,
          isActive: true,
          expiresAt: { gt: now },
          plan: { in: EIS_PLAN_IDS },
        },
      })
    );
    const hasConfig = Boolean(
      await prisma.eISConfiguration.findFirst({ where: { tenantId: tenant.id } }).catch(() => null)
    );
    const hasInvoice = Boolean(
      await prisma.eISInvoice.findFirst({ where: { tenantId: tenant.id } }).catch(() => null)
    );
    const classification = classify(tenant, { hasEisSub, hasConfig, hasInvoice });
    rows.push({
      tenantId: tenant.id,
      name: tenant.name,
      subdomain: tenant.subdomain,
      eisEnabled: tenant.eisEnabled,
      hasEisSub,
      hasConfig,
      hasInvoice,
      classification,
      proposedEntitlement: classification === 'NO_EXISTING_EIS_DATA' ? 'NOT_ENTITLED' : 'MANUAL_REVIEW_NO_AUTO_GRANT',
    });
  }

  const summary = rows.reduce((acc, r) => {
    acc[r.classification] = (acc[r.classification] || 0) + 1;
    return acc;
  }, {});

  const outDir = path.join(process.cwd(), 'docs/mra-eis/phase-4');
  fs.mkdirSync(outDir, { recursive: true });
  const reportPath = path.join(outDir, 'ENTITLEMENT_DATA_MIGRATION_REPORT.md');
  const body = [
    '# Entitlement Data Migration Report',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Mode:** DRY_RUN`,
    '',
    '## Summary',
    '',
    ...Object.entries(summary).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Rules applied',
    '',
    '- Ordinary tenants → NOT_ENTITLED (no auto grant)',
    '- Ambiguous enabled flags / existing EIS invoices → REQUIRES_MANUAL_REVIEW',
    '- No production entitlement inferred from Boolean alone',
    '- No MRA calls, no terminal activation, no Sale/Journal changes',
    '',
    '## Rows',
    '',
    '| Tenant | Classification | eisEnabled | EIS sub | Config | Invoices |',
    '|---|---|---|---|---|---|',
    ...rows.map(
      (r) =>
        `| ${r.name || r.tenantId} | ${r.classification} | ${r.eisEnabled} | ${r.hasEisSub} | ${r.hasConfig} | ${r.hasInvoice} |`
    ),
    '',
  ].join('\n');
  fs.writeFileSync(reportPath, body, 'utf8');
  console.log(JSON.stringify({ total: rows.length, summary, reportPath }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});

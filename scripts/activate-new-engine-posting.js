#!/usr/bin/env node
/**
 * Flip every tenant to NEW_ENGINE posting and enable accountingV2Enabled globally.
 *
 * Usage: node scripts/activate-new-engine-posting.js
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const FLAG_V2_ENABLED = 'accountingV2Enabled';
const FLAG_SHADOW_MODE = 'accountingV2ShadowMode';

const prisma = new PrismaClient();

async function main() {
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  console.log(`Activating NEW_ENGINE for ${tenants.length} tenant(s)…`);

  for (const t of tenants) {
    await prisma.acctV2Configuration.upsert({
      where: { tenantId: t.id },
      create: {
        tenantId: t.id,
        defaultPostingMode: 'NEW_ENGINE',
        accountingArchitectureVersion: 'ACCOUNTING_V2',
        enableShadowAccounting: false,
        enableIntegrityMonitoring: true,
      },
      update: {
        defaultPostingMode: 'NEW_ENGINE',
        accountingArchitectureVersion: 'ACCOUNTING_V2',
        enableShadowAccounting: false,
      },
    });
    console.log(`  ✓ config ${t.name || t.id}`);
  }

  await prisma.acctV2FeatureFlag.upsert({
    where: {
      tenantId_flagKey_moduleKey_eventType: {
        tenantId: '*',
        flagKey: FLAG_V2_ENABLED,
        moduleKey: '*',
        eventType: '*',
      },
    },
    create: {
      tenantId: '*',
      flagKey: FLAG_V2_ENABLED,
      moduleKey: '*',
      eventType: '*',
      enabled: true,
      reason: 'Phase 9 cutover — NEW_ENGINE authoritative for all modules',
    },
    update: {
      enabled: true,
      reason: 'Phase 9 cutover — NEW_ENGINE authoritative for all modules',
    },
  });
  console.log('  ✓ global flag accountingV2Enabled=true');

  const shadowResult = await prisma.acctV2FeatureFlag.updateMany({
    where: { flagKey: FLAG_SHADOW_MODE, enabled: true },
    data: {
      enabled: false,
      reason: 'Disabled — NEW_ENGINE is authoritative; shadow observation off',
    },
  });
  console.log(`  ✓ shadow-mode flags disabled (${shadowResult.count})`);

  const modes = await prisma.acctV2Configuration.groupBy({
    by: ['defaultPostingMode'],
    _count: { _all: true },
  });
  console.log(
    'Posting modes now:',
    modes.map((m) => `${m.defaultPostingMode}=${m._count._all}`).join(', ')
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

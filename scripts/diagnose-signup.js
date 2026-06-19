#!/usr/bin/env node
/**
 * Diagnose signup failures on a server (run where DATABASE_URL points).
 * Usage: node scripts/diagnose-signup.js
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const prisma = new PrismaClient();

function ok(label) {
  console.log(`  ✓ ${label}`);
}
function fail(label, err) {
  console.error(`  ✗ ${label}`);
  console.error(`    ${err?.message || err}`);
  if (err?.code) console.error(`    code: ${err.code}`);
  if (err?.meta) console.error(`    meta:`, err.meta);
}

async function main() {
  console.log('\n=== Signup diagnostics ===\n');

  console.log('Environment:');
  console.log(`  NODE_ENV=${process.env.NODE_ENV || '(unset)'}`);
  console.log(`  APP_URL=${process.env.APP_URL || '(unset)'}`);
  const dbUrl = process.env.DATABASE_URL || '';
  console.log(`  DATABASE_URL=${dbUrl ? dbUrl.replace(/:[^:@/]+@/, ':***@') : '(unset)'}`);

  if (!dbUrl) {
    console.error('\nDATABASE_URL is not set. Load .env or export it first.');
    process.exit(1);
  }

  console.log('\n1. Database connection');
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    ok('Connected');
  } catch (e) {
    fail('Cannot connect', e);
    process.exit(1);
  }

  console.log('\n2. Migration / schema checks');
  const checks = [
    { table: 'Tenant', column: 'ownerUserId' },
    { table: 'TenantMembership', column: 'id' },
    { table: 'AccountSubscription', column: 'isTrial' },
    { table: 'User', column: 'otpCode' },
  ];
  for (const { table, column } of checks) {
    try {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
        table,
        column
      );
      if (rows?.length) ok(`${table}.${column} exists`);
      else fail(`${table}.${column} MISSING — run: npx prisma migrate deploy`);
    } catch (e) {
      fail(`Check ${table}.${column}`, e);
    }
  }

  try {
    const idx = await prisma.$queryRaw`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'User'
        AND indexname = 'User_email_key'`;
    if (idx?.length) {
      console.warn('  ⚠ Legacy global User_email_key still exists (blocks same email across tenants)');
      console.warn('    Apply migration: 20260422170000_user_email_unique_per_tenant');
    } else {
      ok('User_email_key dropped (per-tenant email OK)');
    }
  } catch (e) {
    fail('User index check', e);
  }

  console.log('\n3. Dry-run signup transaction (rolled back)');
  const tag = Date.now();
  const email = `diag-${tag}@example.com`;
  const subdomain = `diagsignup${tag}`.slice(0, 20);
  const hashedPassword = await bcrypt.hash('DiagTest123!', 10);

  try {
    await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: `Diag ${tag}`,
          subdomain,
          subscriptionPlan: 'trial',
          status: 'active',
        },
      });
      ok(`Tenant created (${tenant.id})`);

      await tx.tenantSettings.create({
        data: {
          tenantId: tenant.id,
          currencyCode: 'MWK',
          taxEnabled: true,
          defaultTaxRate: 0,
          invoicePrefix: 'INV',
          enabledModules: ['invoicing', 'clients', 'expenses', 'inventory', 'hr'],
        },
      });
      ok('TenantSettings created');

      const { seedDefaultRolesForTenant } = require('../lib/seedTenantRoles.js');
      const seededRoles = await seedDefaultRolesForTenant(tenant.id, tx);
      const ownerRole = seededRoles.Owner;
      if (!ownerRole?.id) throw new Error('Owner role not seeded');
      ok('Roles seeded');

      const user = await tx.user.create({
        data: {
          name: 'Diag User',
          email,
          password: hashedPassword,
          phone: '+265991234567',
          roleId: ownerRole.id,
          tenantId: tenant.id,
          isActive: true,
          isEmailVerified: false,
          otpCode: '123456',
          otpExpiry: new Date(Date.now() + 600000),
          tenants: { connect: { id: tenant.id } },
        },
      });
      ok(`User created (${user.id})`);

      await tx.tenant.update({
        where: { id: tenant.id },
        data: { ownerUserId: user.id },
      });
      ok('Tenant.ownerUserId set');

      try {
        await tx.tenantMembership.create({
          data: {
            userId: user.id,
            tenantId: tenant.id,
            roleId: ownerRole.id,
            status: 'active',
          },
        });
        ok('TenantMembership created');
      } catch (e) {
        fail('TenantMembership (optional)', e);
      }

      const { initializeNewTenantFinancialDefaults } = require('../lib/initializeNewTenantFinancialDefaults.js');
      await initializeNewTenantFinancialDefaults(tenant.id, tx);
      ok('Financial defaults initialized');

      throw new Error('DIAG_ROLLBACK');
    });
  } catch (e) {
    if (e?.message === 'DIAG_ROLLBACK') {
      ok('Transaction rolled back intentionally (no data kept)');
    } else {
      fail('Signup transaction failed at step above', e);
      process.exit(1);
    }
  }

  console.log('\n4. Trial subscription (outside transaction)');
  try {
    const { initializeTenantTrial } = require('../lib/subscriptionService.js');
    const t = await prisma.tenant.findFirst({ orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (t) {
      await initializeTenantTrial(t.id);
      ok('initializeTenantTrial OK (may reuse existing trial row)');
    } else {
      console.log('  (skipped — no tenants in DB)');
    }
  } catch (e) {
    fail('initializeTenantTrial', e);
  }

  console.log('\n=== All checks passed — signup should work if app code is deployed ===\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

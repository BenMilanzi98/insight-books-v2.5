#!/usr/bin/env node
/**
 * Create tenant + owner via admin API (full CoA bootstrap) + Prisma user row.
 * Usage:
 *   node scripts/bootstrap-tenant-with-user.cjs "<tenantName>" <email> "<userName>" <password>
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const APP_URL = process.env.BOOTSTRAP_APP_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@insightbooks.com';
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'Password2026';

async function adminLoginCookie() {
  const res = await fetch(`${APP_URL}/api/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Admin login failed: ${data.error || res.status}`);
  }
  const cookie = res.headers.get('set-cookie')?.split(';')[0];
  if (!cookie) throw new Error('Admin login did not return a session cookie');
  return cookie;
}

async function createTenantViaAdmin(cookie, tenantName) {
  const res = await fetch(`${APP_URL}/api/admin/tenants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ name: tenantName }),
  });
  const data = await res.json();
  if (!data.success) {
    throw new Error(`Tenant create failed: ${data.error || res.status}`);
  }
  return data.tenant;
}

async function ensureYearSubscription(tenantId) {
  const sub = await prisma.accountSubscription.findFirst({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
  });
  if (!sub) return null;
  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);
  return prisma.accountSubscription.update({
    where: { id: sub.id },
    data: {
      plan: '1year',
      isTrial: false,
      isActive: true,
      status: 'Active',
      expiresAt,
      notes: '1-year plan (bootstrap)',
    },
  });
}

async function bootstrapTenantWithUser(tenantName, email, userName, password) {
  const normalizedEmail = email.toLowerCase().trim();

  let tenant = await prisma.tenant.findFirst({ where: { name: tenantName.trim() } });
  if (!tenant) {
    console.log('Creating tenant via admin API (CoA + roles + settings)...');
    const cookie = await adminLoginCookie();
    const created = await createTenantViaAdmin(cookie, tenantName.trim());
    tenant = await prisma.tenant.findUnique({ where: { id: created.id } });
    if (!tenant) throw new Error('Tenant not found after API create');
  } else {
    console.log(`Tenant "${tenantName}" already exists (${tenant.id})`);
  }

  let user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: normalizedEmail },
  });

  if (!user) {
    const ownerRole =
      (await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Owner' } })) ||
      (await prisma.role.findFirst({ where: { tenantId: tenant.id, name: 'Admin' } }));
    if (!ownerRole) throw new Error('No Owner/Admin role found — tenant bootstrap may be incomplete');

    const hashedPassword = await bcrypt.hash(password, 12);
    user = await prisma.user.create({
      data: {
        name: userName,
        email: normalizedEmail,
        password: hashedPassword,
        phone: '',
        roleId: ownerRole.id,
        tenantId: tenant.id,
        isActive: true,
        isEmailVerified: true,
        tenants: { connect: { id: tenant.id } },
      },
    });

    await prisma.tenantMembership.upsert({
      where: { userId_tenantId: { userId: user.id, tenantId: tenant.id } },
      update: { roleId: ownerRole.id, status: 'active' },
      create: {
        userId: user.id,
        tenantId: tenant.id,
        roleId: ownerRole.id,
        status: 'active',
      },
    });

    await prisma.tenant.update({
      where: { id: tenant.id },
      data: { ownerUserId: user.id },
    });
    console.log('Created owner user');
  } else {
    console.log(`User ${normalizedEmail} already exists`);
  }

  await ensureYearSubscription(tenant.id);
  await prisma.tenantSettings.updateMany({
    where: { tenantId: tenant.id },
    data: { businessEmail: normalizedEmail },
  });

  const [txnCount, saleCount, expenseCount, accountCount] = await Promise.all([
    prisma.transaction.count({ where: { tenantId: tenant.id } }),
    prisma.sale.count({ where: { tenantId: tenant.id } }),
    prisma.expense.count({ where: { tenantId: tenant.id } }),
    prisma.account.count({ where: { tenantId: tenant.id } }),
  ]);

  console.log('\n✅ Insight Books tenant ready\n');
  console.log('Tenant:', tenant.name);
  console.log('Tenant ID:', tenant.id);
  console.log('Subdomain:', tenant.subdomain);
  console.log('Login URL:', `${APP_URL}/auth/login`);
  console.log('Email:', normalizedEmail);
  console.log('Password:', password);
  console.log('\nOperational data (should be 0):');
  console.log('  GL transactions:', txnCount);
  console.log('  Sales:', saleCount);
  console.log('  Expenses:', expenseCount);
  console.log('  CoA accounts:', accountCount, '(structure only)');
}

const tenantName = process.argv[2];
const email = process.argv[3];
const userName = process.argv[4];
const password = process.argv[5];

if (!tenantName || !email || !userName || !password) {
  console.log(
    'Usage: node scripts/bootstrap-tenant-with-user.cjs "<tenantName>" <email> "<userName>" <password>'
  );
  process.exit(1);
}

bootstrapTenantWithUser(tenantName, email, userName, password)
  .catch((err) => {
    console.error('❌ Bootstrap failed:', err.message || err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

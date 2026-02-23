#!/usr/bin/env node
/**
 * Find tenant by name (or subdomain).
 * Usage: node scripts/find-tenant-by-name.js <tenant name or subdomain>
 * Example: node scripts/find-tenant-by-name.js acme
 *          node scripts/find-tenant-by-name.js "Acme Corp"
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const nameArg = process.argv[2];
  if (!nameArg || !nameArg.trim()) {
    console.log('Usage: node scripts/find-tenant-by-name.js <tenant name or subdomain>');
    console.log('Example: node scripts/find-tenant-by-name.js acme');
    process.exit(1);
  }

  const search = nameArg.trim();
  const tenants = await prisma.tenant.findMany({
    where: {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { subdomain: { contains: search, mode: 'insensitive' } },
      ],
    },
    select: {
      id: true,
      name: true,
      subdomain: true,
      status: true,
      subscriptionPlan: true,
      createdAt: true,
    },
    orderBy: { name: 'asc' },
  });

  if (tenants.length === 0) {
    console.log(`No tenant found matching "${search}".`);
    process.exit(1);
  }

  console.log(`Found ${tenants.length} tenant(s) matching "${search}":\n`);
  tenants.forEach((t) => {
    console.log(`  ID:        ${t.id}`);
    console.log(`  Name:      ${t.name}`);
    console.log(`  Subdomain: ${t.subdomain}`);
    console.log(`  Status:    ${t.status}`);
    console.log(`  Plan:      ${t.subscriptionPlan}`);
    console.log(`  Created:   ${t.createdAt}`);
    console.log('');
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

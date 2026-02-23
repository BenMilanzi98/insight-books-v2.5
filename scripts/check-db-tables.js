#!/usr/bin/env node
/**
 * Check that all tables expected by the Prisma schema exist in the database.
 * Run from project root: node scripts/check-db-tables.js
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const prisma = new PrismaClient();

// Expected table names: Prisma uses model name by default; these have @@map
const MAP_OVERRIDES = { BaseUnit: 'base_units', Unit: 'units', ProductUnit: 'product_units' };

function getExpectedTables() {
  const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  const models = schema.match(/^model\s+(\w+)\s*\{/gm) || [];
  const names = models.map((m) => m.replace(/^model\s+(\w+)\s*\{/, '$1'));
  const tables = names.map((n) => MAP_OVERRIDES[n] || n);
  return [...new Set(tables)].sort();
}

async function main() {
  const result = await prisma.$queryRaw`
    SELECT tablename AS name
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  const existing = result.map((r) => r.name).sort();
  const expected = getExpectedTables();

  const missing = expected.filter((t) => !existing.includes(t));
  const extra = existing.filter((t) => !expected.includes(t));

  console.log('=== Database tables check ===\n');
  console.log('Tables in DB (public schema):', existing.length);
  console.log('Tables expected from schema:', expected.length);

  if (missing.length > 0) {
    console.log('\n--- MISSING (in schema but not in DB) ---');
    missing.forEach((t) => console.log('  -', t));
  } else {
    console.log('\n✓ All expected tables exist.');
  }

  if (extra.length > 0) {
    console.log('\n--- EXTRA (in DB but not in schema) ---');
    extra.forEach((t) => console.log('  +', t));
  }

  console.log('\n--- All tables in DB ---');
  existing.forEach((t) => console.log('  ', t));
}

main()
  .catch((e) => {
    console.error('Error:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

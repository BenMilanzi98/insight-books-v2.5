#!/usr/bin/env node
/**
 * One-time script to baseline an existing database: mark all migrations as applied
 * so that "prisma migrate deploy" stops failing with P3005 (database not empty).
 *
 * Run from project root: node scripts/baseline-migrations.js
 *
 * Prerequisites:
 * - Database is already in the desired schema state (e.g. created with db push or manual SQL).
 * - If tax account columns are missing, add them first:
 *   ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "taxInflowAccountId" TEXT;
 *   ALTER TABLE "TenantSettings" ADD COLUMN IF NOT EXISTS "taxOutflowAccountId" TEXT;
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '..', 'prisma', 'migrations');
const dirs = fs.readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && /^\d+_.+/.test(d.name))
  .map((d) => d.name)
  .sort();

console.log(`Found ${dirs.length} migrations to mark as applied.`);

for (const name of dirs) {
  try {
    execSync(`npx prisma migrate resolve --applied "${name}"`, {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    console.log(`  Resolved: ${name}`);
  } catch (e) {
    console.error(`  Failed for ${name}:`, e.message);
  }
}

console.log('Done. You can now run: npx prisma migrate deploy');

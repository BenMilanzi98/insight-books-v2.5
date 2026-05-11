#!/usr/bin/env node
/**
 * System verification: Prisma schema, DB connectivity, and API route existence.
 * Run from project root: node scripts/verify-system.js
 * Requires: DATABASE_URL in .env for DB check (optional for schema-only).
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const projectRoot = path.resolve(__dirname, '..');
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

async function main() {
  console.log('\n==========================================');
  log('System verification', 'cyan');
  console.log('==========================================\n');

  let hasError = false;

  // 1. Prisma schema validate
  log('1. Validating Prisma schema...', 'cyan');
  try {
    execSync('npx prisma validate', {
      cwd: projectRoot,
      stdio: 'pipe',
      encoding: 'utf8',
    });
    log('   ✓ Prisma schema is valid', 'green');
  } catch (e) {
    const msg = (e.stderr || e.stdout || e.message || '').toString();
    if (msg.includes('Environment variable not found') || msg.includes('DATABASE_URL')) {
      log('   ⚠ Skip (DATABASE_URL not set)', 'yellow');
    } else {
      log('   ✗ Prisma validate failed', 'red');
      if (msg) process.stderr.write(msg);
      hasError = true;
    }
  }

  // 2. Database connectivity (optional)
  log('\n2. Checking database connectivity...', 'cyan');
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    log('   ✓ Database connection OK', 'green');
  } catch (e) {
    if (e.message && (e.message.includes('DATABASE_URL') || e.message.includes('connect'))) {
      log('   ⚠ Skip (no DATABASE_URL or DB unreachable)', 'yellow');
    } else {
      log('   ✗ Database check failed: ' + (e.message || e), 'red');
      hasError = true;
    }
  }

  // 3. Critical API route files exist
  log('\n3. Checking critical API route files...', 'cyan');
  const criticalRoutes = [
    'app/api/auth/login/route.js',
    'app/api/tenant/info/route.js',
    'app/api/tenant/settings/route.js',
    'app/api/dashboard/metrics/route.js',
    'app/api/invoices/route.js',
    'app/api/expenses/route.js',
    'app/api/sales/route.js',
    'app/api/clients/route.js',
    'app/api/purchases/orders/route.js',
    'app/api/purchases/suppliers/route.js',
    'app/api/general-ledger/route.js',
    'app/api/journal-entries/route.js',
    'app/api/chart-of-accounts/route.js',
    'app/api/chart-of-accounts/picker/route.js',
    'app/api/accounting-periods/route.js',
    'app/api/payments/route.js',
    'app/api/stock/route.js',
    'app/api/stock-transfers/route.js',
    'app/api/tax-types/route.js',
    'app/api/budgets/route.js',
    'app/api/admin/system-health/route.js',
  ];
  let missing = 0;
  for (const r of criticalRoutes) {
    const full = path.join(projectRoot, r);
    if (!fs.existsSync(full)) {
      log('   ✗ Missing: ' + r, 'red');
      missing++;
    }
  }
  if (missing === 0) {
    log('   ✓ All ' + criticalRoutes.length + ' critical route files exist', 'green');
  } else {
    log('   ✗ ' + missing + ' route file(s) missing', 'red');
    hasError = true;
  }

  // 4. Total API route count
  log('\n4. API route count...', 'cyan');
  try {
    function countRouteFiles(dir) {
      let n = 0;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) n += countRouteFiles(full);
        else if (e.name === 'route.js') n += 1;
      }
      return n;
    }
    const apiDir = path.join(projectRoot, 'app', 'api');
    const count = fs.existsSync(apiDir) ? countRouteFiles(apiDir) : 0;
    log('   ✓ ' + count + ' API route(s) (app/api/**/route.js)', 'green');
  } catch (err) {
    log('   ⚠ Could not count routes: ' + (err.message || err), 'yellow');
  }

  console.log('');
  if (hasError) {
    log('Verification finished with errors.', 'red');
    process.exit(1);
  }
  log('Verification passed.', 'green');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Phase 18 pre-migration diagnostics runner (local/staging).
 * Does not modify data. Optional Prisma when DATABASE_URL present.
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const outDir = path.join(process.cwd(), 'artifacts', 'production-cutover');
  fs.mkdirSync(outDir, { recursive: true });

  let report = {
    title: 'Pre-migration diagnostics',
    status: 'SKIPPED',
    findings: [],
    generatedAt: new Date().toISOString(),
  };

  try {
    // Dynamic import of ESM helpers via compiled path — use inline lightweight checks
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    const findings = [];

    try {
      if (prisma.tenant) {
        const tenants = await prisma.tenant.count();
        findings.push({ code: 'DIAG_TENANT_COUNT', severity: 'INFO', message: `tenants=${tenants}` });
      }
    } catch (e) {
      findings.push({ code: 'DIAG_TENANT_SKIP', severity: 'INFO', message: e.message });
    }

    try {
      if (prisma.user) {
        const users = await prisma.user.count();
        findings.push({ code: 'DIAG_USER_COUNT', severity: 'INFO', message: `users=${users}` });
      }
    } catch (e) {
      findings.push({ code: 'DIAG_USER_SKIP', severity: 'INFO', message: e.message });
    }

    findings.push({
      code: 'DIAG_CROSS_TENANT_MANUAL',
      severity: 'WARNING',
      message: 'Run forensic cross-tenant SQL before production cutover.',
    });
    findings.push({
      code: 'DIAG_FINANCIAL_MANUAL',
      severity: 'WARNING',
      message: 'Run npm run verify:accounting-scenario and Trial Balance comparison before go-live.',
    });

    report = {
      ...report,
      status: 'COMPLETED_WITH_WARNINGS',
      findings,
    };
    await prisma.$disconnect();
  } catch (e) {
    report = {
      ...report,
      status: 'SKIPPED',
      findings: [{ code: 'DIAG_NO_DB', severity: 'INFO', message: e.message }],
    };
  }

  const outFile = path.join(outDir, `diagnostics-${Date.now()}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(outDir, 'diagnostics-latest.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: true, status: report.status, outFile }, null, 2));
}

main();

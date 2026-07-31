#!/usr/bin/env node
/**
 * CoA V2 governance CLI (Phase 3).
 *
 * Commands:
 *   node scripts/coa-v2-governance.mjs classify [--apply] [--force] [--business <tenantId>]
 *       Stage-2 classification backfill. Dry run by default; --apply writes ONLY the
 *       new nullable V2 columns. Never touches balances, journals, or legacy fields.
 *
 *   node scripts/coa-v2-governance.mjs duplicates [--business <tenantId>]
 *       Duplicate-account register → artifacts/accounting-coa/duplicate-account-register.csv
 *
 *   node scripts/coa-v2-governance.mjs readiness [--business <tenantId>]
 *       Business readiness → artifacts/accounting-coa/business-coa-readiness.csv
 *
 *   node scripts/coa-v2-governance.mjs salary-audit [--business <tenantId>]
 *       Salary-account audit → artifacts/accounting-coa/salary-account-audit.csv
 *
 *   node scripts/coa-v2-governance.mjs seed-templates
 *       Registers the built-in versioned templates (idempotent, never overwrites).
 *
 *   node scripts/coa-v2-governance.mjs all [--apply]
 *       classify + duplicates + readiness + salary-audit + seed-templates.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { runClassificationBackfill } from '../lib/coaV2/application/classificationBackfill.js';
import { classifyDuplicateAccounts, duplicateRegisterToCsv } from '../lib/coaV2/application/duplicateClassifier.js';
import { assessBusinessReadiness, readinessToCsv } from '../lib/coaV2/application/businessReadiness.js';
import { auditSalaryAccounts } from '../lib/coaV2/application/salaryAccountEnforcement.js';
import { ensureBuiltInTemplates } from '../lib/coaV2/templates/coaTemplates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'artifacts', 'accounting-coa');

function parseArgs(argv) {
  const args = { command: argv[2] ?? 'all', apply: false, force: false, tenantId: null };
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === '--apply') args.apply = true;
    else if (argv[i] === '--force') args.force = true;
    else if (argv[i] === '--business') args.tenantId = argv[++i];
  }
  return args;
}

function writeCsv(fileName, content) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, fileName);
  fs.writeFileSync(file, content, 'utf8');
  console.log(`  wrote ${path.relative(process.cwd(), file)}`);
}

const simpleCsv = (rows) => {
  if (!rows.length) return 'no rows';
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
};

async function main() {
  const args = parseArgs(process.argv);
  const prisma = new PrismaClient();
  const scope = args.tenantId ? { tenantId: args.tenantId } : {};

  try {
    if (args.command === 'classify' || args.command === 'all') {
      console.log(`\n▶ Stage-2 classification backfill (${args.apply ? 'APPLY' : 'DRY RUN'})`);
      const { summary, manualReviewRows } = await runClassificationBackfill(
        { apply: args.apply, force: args.force, tenantId: args.tenantId }, prisma
      );
      console.table(summary);
      if (manualReviewRows.length > 0) {
        writeCsv('classification-manual-review.csv', simpleCsv(manualReviewRows));
      }
    }

    if (args.command === 'duplicates' || args.command === 'all') {
      console.log('\n▶ Duplicate account classification');
      const rows = await classifyDuplicateAccounts(prisma, scope);
      console.log(`  ${rows.length} duplicate candidate rows`);
      writeCsv('duplicate-account-register.csv', duplicateRegisterToCsv(rows));
    }

    if (args.command === 'readiness' || args.command === 'all') {
      console.log('\n▶ Business readiness assessment');
      const rows = await assessBusinessReadiness(prisma, scope);
      console.table(rows.map((r) => ({ tenant: r.tenantName, status: r.status, blockers: r.blockers })));
      writeCsv('business-coa-readiness.csv', readinessToCsv(rows));
    }

    if (args.command === 'salary-audit' || args.command === 'all') {
      console.log('\n▶ Salary account audit');
      const tenants = args.tenantId
        ? [{ id: args.tenantId }]
        : await prisma.tenant.findMany({ select: { id: true } });
      const rows = [];
      for (const t of tenants) {
        const r = await auditSalaryAccounts({ businessId: t.id }, prisma);
        rows.push(...r.map((x) => ({ tenantId: t.id, ...x })));
      }
      console.log(`  ${rows.length} salary-like accounts`);
      writeCsv('salary-account-audit.csv', simpleCsv(rows));
    }

    if (args.command === 'seed-templates' || args.command === 'all') {
      console.log('\n▶ Registering versioned CoA templates');
      const results = await ensureBuiltInTemplates(prisma);
      console.table(results);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

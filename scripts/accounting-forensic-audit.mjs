#!/usr/bin/env node
/**
 * Phase 1 accounting forensic audit CLI. READ-ONLY.
 *
 * Usage:
 *   node scripts/accounting-forensic-audit.mjs                       # full audit, all tenants
 *   node scripts/accounting-forensic-audit.mjs --business <tenantId>
 *   node scripts/accounting-forensic-audit.mjs --module journals,coa
 *   node scripts/accounting-forensic-audit.mjs --from 2026-01-01 --to 2026-12-31
 *   node scripts/accounting-forensic-audit.mjs --format json --output artifacts/accounting-audit
 *   node scripts/accounting-forensic-audit.mjs --verbose
 *
 * Outputs a console summary plus JSON/CSV artifacts under artifacts/accounting-audit/.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { runAccountingAudit, AUDIT_MODULES } from '../lib/accountingAudit/accountingAuditService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function parseArgs(argv) {
  const args = { format: 'json', output: 'artifacts/accounting-audit', verbose: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--business') args.tenantId = argv[++i];
    else if (a === '--module') args.modules = argv[++i]?.split(',').map((s) => s.trim());
    else if (a === '--from') args.from = new Date(argv[++i]);
    else if (a === '--to') args.to = new Date(argv[++i]);
    else if (a === '--format') args.format = argv[++i];
    else if (a === '--output') args.output = argv[++i];
    else if (a === '--verbose') args.verbose = true;
    else if (a === '--help' || a === '-h') {
      console.log(`Read-only forensic audit.\nModules: ${Object.keys(AUDIT_MODULES).join(', ')}\nFlags: --business <tenantId> --module <a,b> --from <date> --to <date> --format json --output <dir> --verbose`);
      process.exit(0);
    }
  }
  return args;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

async function main() {
  const args = parseArgs(process.argv);
  const prisma = new PrismaClient();

  const dbUrl = process.env.DATABASE_URL || '';
  const dbHost = dbUrl.replace(/^postgresql:\/\/[^@]*@/, '').split('/')[0];
  console.log('=== InsightBooks Phase 1 Accounting Forensic Audit (READ-ONLY) ===');
  console.log(`Database host: ${dbHost}`);
  console.log(`Scope: tenant=${args.tenantId || 'ALL'} modules=${args.modules?.join(',') || 'ALL'}`);

  // Safety: record row counts before + after to prove no accounting data changed.
  const countAccounting = async () => ({
    transactions: await prisma.transaction.count(),
    transactionLines: await prisma.transactionLine.count(),
    journalEntries: await prisma.journalEntry.count(),
    journalEntryLines: await prisma.journalEntryLine.count(),
    accounts: await prisma.account.count(),
  });

  const before = await countAccounting();
  const result = await runAccountingAudit(prisma, args);
  const after = await countAccounting();

  const unchanged = JSON.stringify(before) === JSON.stringify(after);
  if (!unchanged) {
    console.error('!! Record counts changed during audit run — investigate immediately.');
    console.error({ before, after });
    process.exitCode = 2;
  }

  const outDir = path.resolve(projectRoot, args.output);
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = result.startedAt.replace(/[:.]/g, '-');
  const reportPath = path.join(outDir, `audit-run-${stamp}.json`);
  fs.writeFileSync(
    reportPath,
    JSON.stringify({ ...result, recordCounts: { before, after, unchanged } }, null, 2)
  );

  const findingsCsvPath = path.join(outDir, 'findings-latest.csv');
  fs.writeFileSync(
    findingsCsvPath,
    toCsv(
      result.findings.map((f) => ({
        findingId: f.findingId,
        module: f.auditModule,
        ruleCode: f.ruleCode,
        severity: f.severity,
        confidence: f.confidence,
        tenantId: f.tenantId,
        entityType: f.entityType,
        entityId: f.entityId,
        differenceAmount: f.differenceAmount,
        description: f.description,
        recommendation: f.recommendation,
      }))
    )
  );

  // Per-module tabular artifacts
  const art = result.artifacts;
  if (art.ledger?.rows) {
    fs.writeFileSync(path.join(outDir, 'general-ledger-reconciliation.csv'), toCsv(art.ledger.rows));
    fs.writeFileSync(
      path.join(outDir, 'account-balance-differences.csv'),
      toCsv(art.ledger.rows.filter((r) => r.difference !== 0))
    );
  }
  if (art['trial-balance']?.perTenant) {
    fs.writeFileSync(path.join(outDir, 'independent-trial-balance.csv'), toCsv(art['trial-balance'].accountRows || []));
    fs.writeFileSync(path.join(outDir, 'trial-balance-per-tenant.csv'), toCsv(art['trial-balance'].perTenant));
  }
  if (art.capital?.traces) {
    fs.writeFileSync(
      path.join(outDir, 'equity-reconciliation.csv'),
      toCsv(
        art.capital.traces.map(({ sources, ...rest }) => ({
          ...rest,
          sourceRefs: sources.map((s) => `${s.ledger}:${s.ref}(D${s.debit}/C${s.credit})`).join(' ; '),
        }))
      )
    );
    fs.writeFileSync(path.join(outDir, 'capital-duplication-evidence.json'), JSON.stringify(art.capital.traces, null, 2));
  }
  if (art['ar-ap']?.rows) {
    fs.writeFileSync(
      path.join(outDir, 'ar-ap-reconciliation.csv'),
      toCsv(art['ar-ap'].rows.map(({ detail, ...rest }) => ({ ...rest, detail: JSON.stringify(detail) })))
    );
  }
  if (art.coa?.accounts) {
    fs.writeFileSync(
      path.join(outDir, 'accounts.csv'),
      toCsv(
        art.coa.accounts.map((a) => ({
          tenantId: a.tenantId,
          accountCode: a.accountCode,
          accountName: a.accountName,
          accountType: a.accountType,
          normalBalance: a.normalBalance,
          parentAccountId: a.parentAccountId,
          isActive: a.isActive,
          isSystem: a.isSystem,
          acceptsNewTransactions: a.acceptsNewTransactions,
          mergedIntoAccountId: a.mergedIntoAccountId,
          storedBalance: String(a.balance),
        }))
      )
    );
  }

  // Console summary
  console.log(`\nRun ${result.runId} finished in ${((new Date(result.finishedAt) - new Date(result.startedAt)) / 1000).toFixed(1)}s`);
  console.log(`Findings: ${result.summary.totalFindings}`);
  for (const [sev, n] of Object.entries(result.summary.bySeverity).sort()) {
    console.log(`  ${sev.padEnd(14)} ${n}`);
  }
  console.log(`Record counts unchanged: ${unchanged ? 'YES' : 'NO'}`);
  console.log(`Report: ${path.relative(projectRoot, reportPath)}`);
  console.log(`Findings CSV: ${path.relative(projectRoot, findingsCsvPath)}`);

  if (args.verbose) {
    for (const f of result.findings) {
      console.log(`\n[${f.severity.toUpperCase()}] ${f.ruleCode} (${f.auditModule}) tenant=${f.tenantId ?? '-'}`);
      console.log(`  ${f.description}`);
      if (f.differenceAmount != null) console.log(`  difference: ${f.differenceAmount}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
